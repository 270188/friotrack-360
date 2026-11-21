// /api/despacho y /api/control (DespachoController, ControlController).
import { ahoraLima, conflicto, creado, noEncontrado, ok, pagina, paginacion, reglaNegocio, sinContenido, solicitudInvalida,
  Validador, type Cuerpo } from "../core.ts";
import { controlDto, decimal, despachoDto, despachoPorId, ESTADOS_DESPACHO, esTerminal, evaluar, fueraDeRango, motivo,
  registrarEvento, SQL_CONTROL, SQL_DESPACHO } from "../dominio.ts";
import { idDe, type Router } from "../router.ts";
import type { Db, Fila } from "../db.ts";
import type { Usuario } from "../auth.ts";

const COLUMNAS_DESPACHO: Record<string, string> = {
  idDespacho: "d.id_despacho", codigo: "d.codigo", destino: "d.destino", estado: "d.estado",
  fechaProgramada: "d.fecha_programada", fechaSalida: "d.fecha_salida", fechaLlegada: "d.fecha_llegada", fechaCreacion: "d.fecha_creacion",
};

async function despacho(db: Db, id: number) {
  const d = await despachoPorId(db, id);
  if (!d) throw noEncontrado("Despacho", id);
  return d;
}

/** DespachoDto.Item: vínculo despacho-lote con el resumen del lote. */
const SQL_ITEM = `
  SELECT dl.id_despacho_lote, dl.id_despacho, dl.cantidad AS cantidad_item, l.id_lote, l.codigo_lote, l.cantidad, l.unidad, l.estado,
         p.nombre AS producto_nombre
  FROM despacho_lote dl JOIN lote l ON l.id_lote = dl.id_lote JOIN producto p ON p.id_producto = l.id_producto`;

const itemDto = (f: Fila) => ({
  id_despacho_lote: f.id_despacho_lote,
  id_despacho: f.id_despacho,
  lote: { id_lote: f.id_lote, codigo_lote: f.codigo_lote, producto: f.producto_nombre, cantidad: f.cantidad, unidad: f.unidad, estado: f.estado },
  cantidad: f.cantidad_item,
});

function leerDespacho(body: Cuerpo, creando: boolean) {
  const v = new Validador(body);
  const d = {
    codigo: creando ? v.texto("codigo", { obligatorio: true, max: 80 }) : null,
    transportista: v.texto("transportista", { max: 150 }),
    vehiculo: v.texto("vehiculo", { max: 100 }),
    placa: v.texto("placa", { max: 20 }),
    destino: v.texto("destino", { obligatorio: creando, max: 150 }),
    direccion_destino: v.texto("direccion_destino", { max: 255 }),
    contacto_destino: v.texto("contacto_destino", { max: 150 }),
    fecha_programada: v.fechaHora("fecha_programada"),
    observacion: v.texto("observacion"),
  };
  v.verificar();
  return d;
}

const TRANSICIONES: Record<string, string[]> = {
  PENDIENTE: ["PREPARACION", "EN_TRANSITO", "CANCELADO"],
  PREPARACION: ["EN_TRANSITO", "CANCELADO"],
  EN_TRANSITO: ["ENTREGADO", "CANCELADO"],
};
const sufijo = (m: string | null) => (m && m.trim() ? `. ${m}` : "");

async function cambiarEstado(db: Db, id: number, nuevo: string, motivoCambio: string | null, actor: Usuario) {
  const d = await despacho(db, id);
  const anterior = d.estado;
  if (anterior === nuevo) throw reglaNegocio(`El despacho ya se encuentra en ${nuevo}`);
  if (esTerminal(anterior)) throw reglaNegocio(`El despacho ${d.codigo} esta en estado terminal (${anterior})`);
  if (nuevo === "ENTREGADO" && anterior !== "EN_TRANSITO") throw reglaNegocio("Solo un despacho EN_TRANSITO puede marcarse como ENTREGADO");
  if (!(TRANSICIONES[anterior] ?? []).includes(nuevo)) throw reglaNegocio(`Transicion de despacho invalida: ${anterior} -> ${nuevo}`);
  const ahora = ahoraLima(true);
  const items = await db.q(`${SQL_ITEM} WHERE dl.id_despacho = $1 ORDER BY dl.id_despacho_lote ASC`, [id]);
  if (nuevo === "EN_TRANSITO") {
    for (const it of items) {
      if (it.estado === "BLOQUEADO") throw reglaNegocio(`El lote ${it.codigo_lote} esta bloqueado: no puede enviarse`);
    }
    await db.q("UPDATE despacho SET estado = $2, fecha_salida = $3 WHERE id_despacho = $1", [id, nuevo, ahora]);
    for (const it of items) {
      await db.q("UPDATE lote SET estado = 'EN_TRANSITO' WHERE id_lote = $1", [it.id_lote]);
      await registrarEvento(db, "SALIDA", it.id_lote, id, actor,
        `Lote ${it.codigo_lote} en salida hacia ${d.destino} (despacho ${d.codigo})`);
    }
    await registrarEvento(db, "SALIDA", null, id, actor, `Salida del despacho ${d.codigo} hacia ${d.destino}${sufijo(motivoCambio)}`);
  } else if (nuevo === "ENTREGADO") {
    await db.q("UPDATE despacho SET estado = $2, fecha_llegada = $3 WHERE id_despacho = $1", [id, nuevo, ahora]);
    for (const it of items) {
      if (it.estado === "BLOQUEADO" || it.estado === "DESCARTADO") continue;
      await db.q("UPDATE lote SET estado = 'ENTREGADO' WHERE id_lote = $1", [it.id_lote]);
      await registrarEvento(db, "ENTREGA", it.id_lote, id, actor, `Lote ${it.codigo_lote} entregado en ${d.destino}`);
    }
    await registrarEvento(db, "ENTREGA", null, id, actor, `Entrega del despacho ${d.codigo} en ${d.destino}${sufijo(motivoCambio)}`);
  } else {
    await db.q("UPDATE despacho SET estado = $2 WHERE id_despacho = $1", [id, nuevo]);
    await registrarEvento(db, "OTRO", null, id, actor, nuevo === "CANCELADO"
      ? `Despacho cancelado (${anterior} -> CANCELADO)${sufijo(motivoCambio)}`
      : `Estado del despacho ${d.codigo}: ${anterior} -> ${nuevo}`);
  }
  return despachoDto((await despachoPorId(db, id))!);
}

/** Incidencia automática por lectura fuera de rango (IncidenciaService.registrarDesviacion). */
async function registrarDesviacion(db: Db, c: Fila, actor: Usuario) {
  const fueraT = fueraDeRango(c.temperatura, c.temperatura_min, c.temperatura_max);
  const fueraH = fueraDeRango(c.humedad, c.humedad_min, c.humedad_max);
  const tipo = fueraT && !fueraH ? "TEMPERATURA" : fueraH && !fueraT ? "HUMEDAD" : "OTRA";
  const m = motivo(c);
  const descripcion = m ?? `Lectura fuera de rango registrada en el control ${c.id_control}`;
  const inc = await db.uno(
    `INSERT INTO incidencia (id_control, id_lote, id_despacho, tipo, descripcion, prioridad, estado, responsable, fecha_creacion)
     VALUES ($1, $2, $3, $4, $5, 'ALTA', 'ABIERTA', $6, $7) RETURNING id_incidencia`,
    [c.id_control, c.id_lote, c.id_despacho, tipo, descripcion, actor.id_usuario, ahoraLima(true)],
  );
  await registrarEvento(db, "OTRO", c.id_lote, c.id_despacho, actor,
    `Incidencia ${inc!.id_incidencia} abierta automaticamente (${tipo}, ALTA): ${descripcion}`);
}

export function rutasDespachos(r: Router) {
  // ---------------------------------------------------------------- despachos
  r.get("/api/despacho", async (ctx) => {
    const q = ctx.query.texto("q")?.trim() || null;
    const estado = ctx.query.enumeracion("estado", ESTADOS_DESPACHO);
    const p = paginacion(ctx.query, COLUMNAS_DESPACHO, "d.id_despacho ASC");
    const where = `($1::text IS NULL OR d.estado = $1)
      AND ($2::text IS NULL OR LOWER(d.codigo) LIKE '%' || LOWER($2) || '%' OR LOWER(d.destino) LIKE '%' || LOWER($2) || '%'
           OR LOWER(COALESCE(d.transportista, '')) LIKE '%' || LOWER($2) || '%')`;
    const total = Number(await ctx.db.valor(`SELECT COUNT(*) FROM despacho d WHERE ${where}`, [estado, q]));
    const filas = await ctx.db.q(`${SQL_DESPACHO} WHERE ${where} ORDER BY ${p.orden} LIMIT $3 OFFSET $4`, [estado, q, p.size, p.page * p.size]);
    return ok(pagina(filas.map(despachoDto), total, p));
  });
  r.get("/api/despacho/estado/:estado", async (ctx) => {
    const e = ctx.params.estado;
    if (!(ESTADOS_DESPACHO as readonly string[]).includes(e)) {
      throw solicitudInvalida(`Valor invalido para 'estado': ${e}. Se esperaba uno de [${ESTADOS_DESPACHO.join(", ")}]`);
    }
    return ok((await ctx.db.q(`${SQL_DESPACHO} WHERE d.estado = $1 ORDER BY d.fecha_creacion DESC`, [e])).map(despachoDto));
  });
  r.get("/api/despacho/programados", async (ctx) => {
    const desde = ctx.query.fechaHora("desde", true);
    const hasta = ctx.query.fechaHora("hasta", true);
    return ok((await ctx.db.q(`${SQL_DESPACHO} WHERE d.fecha_programada BETWEEN $1 AND $2 ORDER BY d.fecha_programada ASC`,
      [desde, hasta])).map(despachoDto));
  });
  r.get("/api/despacho/codigo/:codigo", async (ctx) => {
    const d = await ctx.db.uno(`${SQL_DESPACHO} WHERE d.codigo = $1`, [ctx.params.codigo]);
    if (!d) throw noEncontrado(`No existe un despacho con codigo ${ctx.params.codigo}`);
    return ok(despachoDto(d));
  });
  r.get("/api/despacho/:id", async (ctx) => ok(despachoDto(await despacho(ctx.db, idDe(ctx)))));

  r.post("/api/despacho", async (ctx) => {
    const d = leerDespacho(await ctx.body(), true);
    if (await ctx.db.uno("SELECT 1 FROM despacho WHERE codigo = $1", [d.codigo])) throw conflicto(`Ya existe un despacho con el codigo ${d.codigo}`);
    const n = await ctx.db.uno(
      `INSERT INTO despacho (codigo, transportista, vehiculo, placa, destino, direccion_destino, contacto_destino, fecha_programada,
                             observacion, estado, id_usuario, fecha_creacion)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PENDIENTE', $10, $11) RETURNING id_despacho`,
      [d.codigo, d.transportista, d.vehiculo, d.placa, d.destino, d.direccion_destino, d.contacto_destino, d.fecha_programada,
        d.observacion, ctx.yo().id_usuario, ahoraLima(true)],
    );
    return creado(despachoDto((await despachoPorId(ctx.db, n!.id_despacho))!));
  });

  r.put("/api/despacho/:id", async (ctx) => {
    const id = idDe(ctx);
    const d = leerDespacho(await ctx.body(), false);
    const actual = await despacho(ctx.db, id);
    if (esTerminal(actual.estado)) throw reglaNegocio(`El despacho ${actual.codigo} esta en estado terminal y no admite cambios`);
    await ctx.db.q(
      `UPDATE despacho SET transportista = COALESCE($2, transportista), vehiculo = COALESCE($3, vehiculo), placa = COALESCE($4, placa),
              destino = COALESCE($5, destino), direccion_destino = COALESCE($6, direccion_destino),
              contacto_destino = COALESCE($7, contacto_destino), fecha_programada = COALESCE($8, fecha_programada),
              observacion = COALESCE($9, observacion)
       WHERE id_despacho = $1`,
      [id, d.transportista, d.vehiculo, d.placa, d.destino, d.direccion_destino, d.contacto_destino, d.fecha_programada, d.observacion],
    );
    return ok(despachoDto((await despachoPorId(ctx.db, id))!));
  });

  r.patch("/api/despacho/:id/estado", async (ctx) => {
    const id = idDe(ctx);
    const v = new Validador(await ctx.body());
    const estado = v.enumeracion("estado", ESTADOS_DESPACHO, true);
    const m = v.texto("motivo", { max: 500 });
    v.verificar();
    return ok(await cambiarEstado(ctx.db, id, estado!, m, ctx.yo()));
  });

  r.get("/api/despacho/:id/lotes", async (ctx) =>
    ok((await ctx.db.q(`${SQL_ITEM} WHERE dl.id_despacho = $1 ORDER BY dl.id_despacho_lote ASC`, [idDe(ctx)])).map(itemDto)));

  r.post("/api/despacho/:id/lotes", async (ctx) => {
    const idDespacho = idDe(ctx);
    const v = new Validador(await ctx.body());
    const idLote = v.id("id_lote", true);
    const cantidad = v.numero("cantidad", { obligatorio: true, min: 0.001, enteros: 9, decimales: 3, mensajeMin: "debe ser mayor que o igual a 0.001" });
    v.verificar();
    const d = await despacho(ctx.db, idDespacho);
    const l = await ctx.db.uno("SELECT * FROM lote WHERE id_lote = $1", [idLote]);
    if (!l) throw noEncontrado("Lote", idLote);
    if (esTerminal(d.estado)) throw reglaNegocio(`El despacho ${d.codigo} esta en estado terminal (${d.estado}): no admite mas lotes`);
    if (l.estado === "BLOQUEADO") throw reglaNegocio(`El lote ${l.codigo_lote} esta bloqueado y no puede incluirse en un despacho`);
    if (l.estado === "DESCARTADO" || l.estado === "ENTREGADO") {
      throw reglaNegocio(`El lote ${l.codigo_lote} esta en estado ${l.estado} y no puede despacharse`);
    }
    if (await ctx.db.uno("SELECT 1 FROM despacho_lote WHERE id_despacho = $1 AND id_lote = $2", [idDespacho, idLote])) {
      throw conflicto(`El lote ${l.codigo_lote} ya esta asociado al despacho ${d.codigo}`);
    }
    if (cantidad === null || cantidad <= 0) throw reglaNegocio("La cantidad debe ser mayor que cero");
    const pendiente = Number(await ctx.db.valor(
      `SELECT COALESCE(SUM(dl.cantidad), 0) FROM despacho_lote dl JOIN despacho x ON x.id_despacho = dl.id_despacho
       WHERE dl.id_lote = $1 AND x.estado NOT IN ('ENTREGADO', 'CANCELADO')`, [idLote]));
    if (pendiente + cantidad > l.cantidad + 1e-9) {
      throw reglaNegocio(`El lote ${l.codigo_lote} tiene ${decimal(l.cantidad, 3)} ${l.unidad} y ya tiene ${decimal(pendiente, 3)} comprometido en despachos no terminales`);
    }
    const n = await ctx.db.uno("INSERT INTO despacho_lote (id_despacho, id_lote, cantidad) VALUES ($1, $2, $3) RETURNING id_despacho_lote",
      [idDespacho, idLote, cantidad]);
    await registrarEvento(ctx.db, "PREPARACION", idLote, idDespacho, ctx.yo(),
      `Lote ${l.codigo_lote} asociado al despacho ${d.codigo} (${decimal(cantidad, 3)} ${l.unidad})`);
    if (d.estado === "PENDIENTE") await ctx.db.q("UPDATE despacho SET estado = 'PREPARACION' WHERE id_despacho = $1", [idDespacho]);
    return creado(itemDto((await ctx.db.uno(`${SQL_ITEM} WHERE dl.id_despacho_lote = $1`, [n!.id_despacho_lote]))!));
  });

  r.delete("/api/despacho/lote/:idDespachoLote", async (ctx) => {
    const id = idDe(ctx, "idDespachoLote");
    const it = await ctx.db.uno(
      `SELECT dl.*, d.codigo, d.estado, l.codigo_lote FROM despacho_lote dl JOIN despacho d ON d.id_despacho = dl.id_despacho
       JOIN lote l ON l.id_lote = dl.id_lote WHERE dl.id_despacho_lote = $1`, [id]);
    if (!it) throw noEncontrado("DespachoLote", id);
    if (esTerminal(it.estado)) throw reglaNegocio(`El despacho ${it.codigo} esta cerrado: no se puede modificar su contenido`);
    await registrarEvento(ctx.db, "OTRO", it.id_lote, it.id_despacho, ctx.yo(), `Lote ${it.codigo_lote} retirado del despacho ${it.codigo}`);
    await ctx.db.q("DELETE FROM despacho_lote WHERE id_despacho_lote = $1", [id]);
    return sinContenido();
  });

  // ---------------------------------------------------------------- controles
  r.get("/api/control", async (ctx) => {
    const idDespacho = ctx.query.entero("idDespacho");
    const idLote = ctx.query.entero("idLote");
    if (idDespacho === null && idLote === null) throw reglaNegocio("Debe indicar idDespacho o idLote para listar controles");
    const filas = await ctx.db.q(
      `${SQL_CONTROL} WHERE ($1::bigint IS NULL OR c.id_lote = $1) AND ($2::bigint IS NULL OR c.id_despacho = $2)
       ORDER BY c.fecha_hora ASC, c.id_control ASC`, [idLote, idDespacho]);
    return ok(filas.map(controlDto));
  });
  r.get("/api/control/fuera-de-rango", async (ctx) =>
    ok((await ctx.db.q(`${SQL_CONTROL} WHERE c.resultado = 'FUERA_RANGO' ORDER BY c.fecha_hora DESC, c.id_control DESC`)).map(controlDto)));
  r.get("/api/control/:id", async (ctx) => {
    const c = await ctx.db.uno(`${SQL_CONTROL} WHERE c.id_control = $1`, [idDe(ctx)]);
    if (!c) throw noEncontrado("Control", idDe(ctx));
    return ok(controlDto(c));
  });

  r.post("/api/control", async (ctx) => {
    const v = new Validador(await ctx.body());
    const idDespacho = v.id("id_despacho", true);
    const idLote = v.id("id_lote", true);
    const fechaHora = v.fechaHora("fecha_hora");
    const temperatura = v.numero("temperatura", { min: -50, max: 50 });
    const humedad = v.numero("humedad", { min: 0, max: 100 });
    const observacion = v.texto("observacion", { max: 1000 });
    v.verificar();
    const d = await despacho(ctx.db, idDespacho!);
    const l = await ctx.db.uno("SELECT l.codigo_lote, p.* FROM lote l JOIN producto p ON p.id_producto = l.id_producto WHERE l.id_lote = $1", [idLote]);
    if (!l) throw noEncontrado("Lote", idLote);
    if (!(await ctx.db.uno("SELECT 1 FROM despacho_lote WHERE id_despacho = $1 AND id_lote = $2", [idDespacho, idLote]))) {
      throw reglaNegocio(`El lote ${l.codigo_lote} no esta asociado al despacho ${d.codigo}`);
    }
    if (esTerminal(d.estado)) throw reglaNegocio(`El despacho ${d.codigo} esta cerrado: no admite lecturas`);
    const actor = ctx.yo();
    const resultado = evaluar(temperatura, humedad, l);
    const n = await ctx.db.uno(
      `INSERT INTO control (id_despacho, id_lote, fecha_hora, temperatura, humedad, resultado, observacion, id_usuario)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id_control`,
      [idDespacho, idLote, fechaHora ?? ahoraLima(true), temperatura, humedad, resultado, observacion, actor.id_usuario],
    );
    const c = (await ctx.db.uno(`${SQL_CONTROL} WHERE c.id_control = $1`, [n!.id_control]))!;
    const partes: string[] = [];
    if (c.temperatura !== null) partes.push(`${decimal(c.temperatura, 2)} °C`);
    if (c.humedad !== null) partes.push(`${decimal(c.humedad, 2)} %`);
    const m = motivo(c);
    await registrarEvento(ctx.db, "CONTROL", idLote, idDespacho, actor,
      `Lectura ${partes.length ? partes.join(" / ") : "sin valores"} -> ${resultado}${m === null ? "" : ` (${m})`}`);
    if (resultado === "FUERA_RANGO") await registrarDesviacion(ctx.db, c, actor);
    return creado(controlDto(c));
  });
}
