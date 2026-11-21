// /api/incidencia, /api/evidencia, /api/evento, /api/trazabilidad y /api/dashboard.
import { ahoraLima, creado, hoyLima, minutosEntre, noEncontrado, ok, pagina, paginacion, reglaNegocio, sinContenido,
  solicitudInvalida, sumarDias, Validador, type Cuerpo } from "../core.ts";
import { controlDto, ESTADOS_DESPACHO, ESTADOS_INCIDENCIA, evidenciaDto, evidenciaResumen, eventoDto, incidenciaConEvidencias,
  incidenciaDto, ORDEN_PRIORIDAD, PRIORIDADES, productoDto, registrarEvento, resumenIncidencias, SQL_CONTROL, SQL_EVENTO,
  SQL_EVIDENCIA, SQL_INCIDENCIA, timeline, TIPOS_EVENTO, TIPOS_INCIDENCIA, lotePorId, vencido } from "../dominio.ts";
import { idDe, type Ctx, type Router } from "../router.ts";
import type { Db } from "../db.ts";
import type { Usuario } from "../auth.ts";

// ------------------------------------------------------------------ incidencias

const TRANSICIONES: Record<string, string[]> = {
  ABIERTA: ["EN_PROCESO", "RESUELTA", "CERRADA"],
  EN_PROCESO: ["RESUELTA", "CERRADA"],
  RESUELTA: ["CERRADA", "EN_PROCESO"],
};

async function incidencia(db: Db, id: number) {
  const i = await db.uno("SELECT * FROM incidencia WHERE id_incidencia = $1", [id]);
  if (!i) throw noEncontrado("Incidencia", id);
  return i;
}

async function responsable(db: Db, idResponsable: number | null, actor: Usuario): Promise<number> {
  if (idResponsable === null) return actor.id_usuario;
  if (!(await db.uno("SELECT 1 FROM usuario WHERE id_usuario = $1", [idResponsable]))) throw noEncontrado("Usuario responsable", idResponsable);
  return idResponsable;
}

async function registrarEvidencia(db: Db, idIncidencia: number, body: Cuerpo, actor: Usuario) {
  const v = new Validador(body);
  const tipo = v.texto("tipo", { obligatorio: true })!;
  const nombre = v.texto("nombre_archivo", { obligatorio: true, max: 255 })!;
  const url = v.texto("url", { max: 500 });
  const descripcion = v.texto("descripcion", { max: 500 });
  v.verificar();
  const inc = await incidencia(db, idIncidencia);
  const n = await db.uno(
    `INSERT INTO evidencia (id_incidencia, tipo, nombre_archivo, url, descripcion, fecha_creacion, id_usuario)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id_evidencia`,
    [idIncidencia, tipo, nombre, url, descripcion, ahoraLima(true), actor.id_usuario],
  );
  await registrarEvento(db, "OTRO", inc.id_lote, inc.id_despacho, actor,
    `Evidencia ${n!.id_evidencia} (${tipo}) adjunta a la incidencia ${idIncidencia}: ${nombre}`);
  return evidenciaDto((await db.uno(`${SQL_EVIDENCIA} WHERE e.id_evidencia = $1`, [n!.id_evidencia]))!);
}

const evidenciasDeIncidencias = (db: Db, where: string, param: number) =>
  db.q(`${SQL_EVIDENCIA} WHERE e.id_incidencia IN (SELECT id_incidencia FROM incidencia WHERE ${where})
        ORDER BY i.fecha_creacion DESC, i.id_incidencia DESC, e.fecha_creacion ASC, e.id_evidencia ASC`, [param]);

// ------------------------------------------------------------------ eventos

const COLUMNAS_EVENTO: Record<string, string> = {
  idEvento: "e.id_evento", fechaHora: "e.fecha_hora", tipo: "e.tipo",
};

export function rutasCalidad(r: Router) {
  // ---------------------------------------------------------------- incidencias
  r.get("/api/incidencia", async (ctx) => {
    const estado = ctx.query.enumeracion("estado", ESTADOS_INCIDENCIA);
    const prioridad = ctx.query.enumeracion("prioridad", PRIORIDADES);
    const tipo = ctx.query.enumeracion("tipo", TIPOS_INCIDENCIA);
    const idLote = ctx.query.entero("idLote");
    const idDespacho = ctx.query.entero("idDespacho");
    let lista;
    if (idLote !== null) lista = await resumenIncidencias(ctx.db, "i.id_lote = $1", [idLote], "i.fecha_creacion DESC, i.id_incidencia DESC");
    else if (idDespacho !== null) lista = await resumenIncidencias(ctx.db, "i.id_despacho = $1", [idDespacho], "i.fecha_creacion DESC, i.id_incidencia DESC");
    else if (tipo !== null) lista = await resumenIncidencias(ctx.db, "i.tipo = $1", [tipo], "i.fecha_creacion DESC, i.id_incidencia DESC");
    else if (estado !== null) lista = await resumenIncidencias(ctx.db, "i.estado = $1", [estado], `${ORDEN_PRIORIDAD}, i.fecha_creacion ASC`);
    else throw reglaNegocio("Debe indicar estado, tipo, idLote o idDespacho para listar incidencias");
    return ok(prioridad === null ? lista : lista.filter((i) => i.prioridad === prioridad));
  });
  r.get("/api/incidencia/abiertas", async (ctx) => {
    const ids = await ctx.db.q(`SELECT i.id_incidencia FROM incidencia i WHERE i.estado IN ('ABIERTA', 'EN_PROCESO')
      ORDER BY ${ORDEN_PRIORIDAD}, i.fecha_creacion ASC`);
    const lista = [];
    for (const { id_incidencia } of ids) lista.push(await incidenciaConEvidencias(ctx.db, id_incidencia));
    return ok(lista);
  });
  r.get("/api/incidencia/:id", async (ctx) => {
    const i = await incidenciaConEvidencias(ctx.db, idDe(ctx));
    if (!i) throw noEncontrado("Incidencia", idDe(ctx));
    return ok(i);
  });

  r.post("/api/incidencia", async (ctx) => {
    const v = new Validador(await ctx.body());
    const idControl = v.id("id_control");
    const idLote = v.id("id_lote", true);
    const idDespacho = v.id("id_despacho");
    const tipo = v.enumeracion("tipo", TIPOS_INCIDENCIA);
    const descripcion = v.texto("descripcion", { obligatorio: true })!;
    const prioridad = v.enumeracion("prioridad", PRIORIDADES);
    const idResponsable = v.id("id_responsable");
    v.verificar();
    let lote: number;
    let desp: number | null;
    if (idControl !== null) {
      const c = await ctx.db.uno("SELECT id_lote, id_despacho FROM control WHERE id_control = $1", [idControl]);
      if (!c) throw noEncontrado("Control", idControl);
      lote = c.id_lote;
      desp = c.id_despacho;
    } else {
      if (!(await ctx.db.uno("SELECT 1 FROM lote WHERE id_lote = $1", [idLote]))) throw noEncontrado("Lote", idLote);
      lote = idLote!;
      desp = null;
      if (idDespacho !== null) {
        if (!(await ctx.db.uno("SELECT 1 FROM despacho WHERE id_despacho = $1", [idDespacho]))) throw noEncontrado("Despacho", idDespacho);
        desp = idDespacho;
      }
    }
    const actor = ctx.yo();
    const resp = await responsable(ctx.db, idResponsable, actor);
    const n = await ctx.db.uno(
      `INSERT INTO incidencia (id_control, id_lote, id_despacho, tipo, descripcion, prioridad, estado, responsable, fecha_creacion)
       VALUES ($1, $2, $3, $4, $5, $6, 'ABIERTA', $7, $8) RETURNING id_incidencia, tipo, prioridad`,
      [idControl, lote, desp, tipo ?? "OTRA", descripcion, prioridad ?? "MEDIA", resp, ahoraLima(true)],
    );
    await registrarEvento(ctx.db, "OTRO", lote, desp, actor,
      `Incidencia ${n!.id_incidencia} creada (${n!.tipo}, ${n!.prioridad}): ${descripcion}`);
    return creado(await incidenciaConEvidencias(ctx.db, n!.id_incidencia));
  });

  r.put("/api/incidencia/:id", async (ctx) => {
    const id = idDe(ctx);
    const v = new Validador(await ctx.body());
    const tipo = v.enumeracion("tipo", TIPOS_INCIDENCIA);
    const descripcion = v.texto("descripcion", { max: 4000 });
    const prioridad = v.enumeracion("prioridad", PRIORIDADES);
    const causa = v.texto("causa", { max: 4000 });
    const accion = v.texto("accion", { max: 4000 });
    const idResponsable = v.id("id_responsable");
    v.verificar();
    await incidencia(ctx.db, id);
    const resp = idResponsable === null ? null : await responsable(ctx.db, idResponsable, ctx.yo());
    await ctx.db.q(
      `UPDATE incidencia SET tipo = COALESCE($2, tipo), descripcion = COALESCE($3, descripcion), prioridad = COALESCE($4, prioridad),
              causa = COALESCE($5, causa), accion = COALESCE($6, accion), responsable = COALESCE($7, responsable)
       WHERE id_incidencia = $1`, [id, tipo, descripcion, prioridad, causa, accion, resp]);
    return ok(await incidenciaConEvidencias(ctx.db, id));
  });

  r.patch("/api/incidencia/:id/estado", async (ctx) => {
    const id = idDe(ctx);
    const v = new Validador(await ctx.body());
    const nuevo = v.enumeracion("estado", ESTADOS_INCIDENCIA, true)!;
    const causa = v.texto("causa", { max: 4000 });
    const accion = v.texto("accion", { max: 4000 });
    const idResponsable = v.id("id_responsable");
    const motivo = v.texto("motivo", { max: 500 });
    v.verificar();
    const i = await incidencia(ctx.db, id);
    const anterior = i.estado;
    if (anterior === nuevo) throw reglaNegocio(`La incidencia ya se encuentra en estado ${nuevo}`);
    if (!(TRANSICIONES[anterior] ?? []).includes(nuevo)) throw reglaNegocio(`Transicion de incidencia invalida: ${anterior} -> ${nuevo}`);
    const cierra = nuevo === "RESUELTA" || nuevo === "CERRADA";
    if (cierra && i.causa === null && causa === null) throw reglaNegocio("Para resolver o cerrar la incidencia debe registrar la causa");
    const actor = ctx.yo();
    const resp = idResponsable === null ? null : await responsable(ctx.db, idResponsable, actor);
    await ctx.db.q(
      `UPDATE incidencia SET estado = $2, causa = COALESCE($3, causa), accion = COALESCE($4, accion),
              responsable = COALESCE($5, responsable), fecha_cierre = $6 WHERE id_incidencia = $1`,
      [id, nuevo, causa, accion, resp, cierra ? ahoraLima(true) : null]);
    await registrarEvento(ctx.db, "OTRO", i.id_lote, i.id_despacho, actor,
      `Incidencia ${id}: ${anterior} -> ${nuevo}${motivo && motivo.trim() ? `. ${motivo}` : ""}`);
    return ok(await incidenciaConEvidencias(ctx.db, id));
  });

  r.get("/api/incidencia/:id/evidencias", async (ctx) =>
    ok((await ctx.db.q(`${SQL_EVIDENCIA} WHERE e.id_incidencia = $1 ORDER BY e.fecha_creacion ASC, e.id_evidencia ASC`, [idDe(ctx)])).map(evidenciaDto)));
  r.post("/api/incidencia/:id/evidencias", async (ctx) => creado(await registrarEvidencia(ctx.db, idDe(ctx), await ctx.body(), ctx.yo())));

  // ---------------------------------------------------------------- evidencias
  r.get("/api/evidencia", async (ctx) => {
    const idIncidencia = ctx.query.entero("idIncidencia");
    const idLote = ctx.query.entero("idLote");
    const idDespacho = ctx.query.entero("idDespacho");
    if (idIncidencia !== null) {
      return ok((await ctx.db.q(`${SQL_EVIDENCIA} WHERE e.id_incidencia = $1 ORDER BY e.fecha_creacion ASC, e.id_evidencia ASC`, [idIncidencia])).map(evidenciaDto));
    }
    if (idLote !== null) return ok((await evidenciasDeIncidencias(ctx.db, "id_lote = $1", idLote)).map(evidenciaDto));
    if (idDespacho !== null) return ok((await evidenciasDeIncidencias(ctx.db, "id_despacho = $1", idDespacho)).map(evidenciaDto));
    throw reglaNegocio("Debe indicar idIncidencia, idLote o idDespacho para listar evidencias");
  });
  r.get("/api/evidencia/:id", async (ctx) => {
    const e = await ctx.db.uno(`${SQL_EVIDENCIA} WHERE e.id_evidencia = $1`, [idDe(ctx)]);
    if (!e) throw noEncontrado("Evidencia", idDe(ctx));
    return ok(evidenciaDto(e));
  });
  r.post("/api/evidencia", async (ctx) => {
    const idIncidencia = ctx.query.entero("idIncidencia");
    if (idIncidencia === null) throw solicitudInvalida("Falta el parametro obligatorio 'idIncidencia'");
    return creado(await registrarEvidencia(ctx.db, idIncidencia, await ctx.body(), ctx.yo()));
  });
  r.delete("/api/evidencia/:id", async (ctx) => {
    const id = idDe(ctx);
    if (!(await ctx.db.uno("SELECT 1 FROM evidencia WHERE id_evidencia = $1", [id]))) throw noEncontrado("Evidencia", id);
    await ctx.db.q("DELETE FROM evidencia WHERE id_evidencia = $1", [id]);
    return sinContenido();
  });

  // ---------------------------------------------------------------- eventos
  r.get("/api/evento", async (ctx) => {
    const idLote = ctx.query.entero("idLote");
    const idDespacho = ctx.query.entero("idDespacho");
    const tipo = ctx.query.enumeracion("tipo", TIPOS_EVENTO);
    const desde = ctx.query.fechaHora("desde");
    const hasta = ctx.query.fechaHora("hasta");
    const p = paginacion(ctx.query, COLUMNAS_EVENTO, "e.id_evento ASC");
    const where = `($1::bigint IS NULL OR e.id_lote = $1) AND ($2::bigint IS NULL OR e.id_despacho = $2) AND ($3::text IS NULL OR e.tipo = $3)
      AND ($4::timestamp IS NULL OR e.fecha_hora >= $4) AND ($5::timestamp IS NULL OR e.fecha_hora <= $5)`;
    const params = [idLote, idDespacho, tipo, desde, hasta];
    const total = Number(await ctx.db.valor(`SELECT COUNT(*) FROM evento e WHERE ${where}`, params));
    const filas = await ctx.db.q(`${SQL_EVENTO} WHERE ${where} ORDER BY ${p.orden}, e.id_evento DESC LIMIT $6 OFFSET $7`,
      [...params, p.size, p.page * p.size]);
    return ok(pagina(filas.map(eventoDto), total, p));
  });
  r.get("/api/evento/tipo/:tipo", async (ctx) => {
    const t = ctx.params.tipo;
    if (!(TIPOS_EVENTO as readonly string[]).includes(t)) {
      throw solicitudInvalida(`Valor invalido para 'tipo': ${t}. Se esperaba uno de [${TIPOS_EVENTO.join(", ")}]`);
    }
    return ok((await ctx.db.q(`${SQL_EVENTO} WHERE e.tipo = $1 ORDER BY e.fecha_hora DESC, e.id_evento DESC`, [t])).map(eventoDto));
  });
  r.get("/api/evento/timeline/lote/:idLote", async (ctx) =>
    ok((await ctx.db.q(`${SQL_EVENTO} WHERE e.id_lote = $1 ORDER BY e.fecha_hora ASC, e.id_evento ASC`, [idDe(ctx, "idLote")])).map(timeline)));
  r.get("/api/evento/timeline/despacho/:idDespacho", async (ctx) =>
    ok((await ctx.db.q(`${SQL_EVENTO} WHERE e.id_despacho = $1 ORDER BY e.fecha_hora ASC, e.id_evento ASC`, [idDe(ctx, "idDespacho")])).map(timeline)));
  r.post("/api/evento", async (ctx) => {
    const v = new Validador(await ctx.body());
    const idLote = v.id("id_lote");
    const idDespacho = v.id("id_despacho");
    const tipo = v.enumeracion("tipo", TIPOS_EVENTO);
    const descripcion = v.texto("descripcion", { max: 2000 });
    const ubicacion = v.texto("ubicacion", { max: 255 });
    const fechaHora = v.fechaHora("fecha_hora");
    v.verificar();
    if (idLote === null && idDespacho === null) throw reglaNegocio("Un evento debe estar anclado a un lote o a un despacho");
    if (tipo === null) throw solicitudInvalida("Cuerpo de la solicitud invalido o valor de enum desconocido");
    if (idLote !== null && !(await ctx.db.uno("SELECT 1 FROM lote WHERE id_lote = $1", [idLote]))) throw noEncontrado("Lote", idLote);
    if (idDespacho !== null && !(await ctx.db.uno("SELECT 1 FROM despacho WHERE id_despacho = $1", [idDespacho]))) throw noEncontrado("Despacho", idDespacho);
    const n = await ctx.db.uno(
      `INSERT INTO evento (id_lote, id_despacho, tipo, descripcion, ubicacion, fecha_hora, id_usuario)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id_evento`,
      [idLote, idDespacho, tipo, descripcion, ubicacion, fechaHora ?? ahoraLima(true), ctx.yo().id_usuario]);
    return creado(eventoDto((await ctx.db.uno(`${SQL_EVENTO} WHERE e.id_evento = $1`, [n!.id_evento]))!));
  });

  // ---------------------------------------------------------------- trazabilidad
  r.get("/api/trazabilidad/lote/:idLote", async (ctx) => {
    const id = idDe(ctx, "idLote");
    const l = await lotePorId(ctx.db, id);
    if (!l) throw noEncontrado("Lote", id);
    const [despachos, controles, incidencias, evidencias, eventos] = await Promise.all([
      ctx.db.q(`SELECT d.*, dl.cantidad AS cantidad_vinculo FROM despacho_lote dl JOIN despacho d ON d.id_despacho = dl.id_despacho
                WHERE dl.id_lote = $1 ORDER BY dl.id_despacho_lote ASC`, [id]),
      ctx.db.q(`${SQL_CONTROL} WHERE c.id_lote = $1 ORDER BY c.fecha_hora ASC, c.id_control ASC`, [id]),
      resumenIncidencias(ctx.db, "i.id_lote = $1", [id], "i.fecha_creacion DESC, i.id_incidencia DESC"),
      evidenciasDeIncidencias(ctx.db, "id_lote = $1", id),
      ctx.db.q(`${SQL_EVENTO} WHERE e.id_lote = $1 ORDER BY e.fecha_hora ASC, e.id_evento ASC`, [id]),
    ]);
    const p = productoDto(Object.fromEntries(Object.entries(l).filter(([k]) => k.startsWith("p_")).map(([k, v]) => [k.slice(2), v])));
    return ok({
      id_lote: l.id_lote, codigo_lote: l.codigo_lote, producto: p, cantidad: l.cantidad, unidad: l.unidad, estado: l.estado,
      fecha_produccion: l.fecha_produccion, fecha_vencimiento: l.fecha_vencimiento, vencido: vencido(l.fecha_vencimiento),
      despachos: despachos.map((d) => ({
        id_despacho: d.id_despacho, codigo: d.codigo, estado: d.estado, destino: d.destino, cantidad: d.cantidad_vinculo,
        fecha_programada: d.fecha_programada, fecha_salida: d.fecha_salida, fecha_llegada: d.fecha_llegada,
      })),
      controles: controles.map(controlDto),
      incidencias,
      evidencias: evidencias.map(evidenciaResumen),
      timeline: eventos.map(timeline),
    });
  });
  r.get("/api/trazabilidad/despacho/:idDespacho", async (ctx) => {
    const id = idDe(ctx, "idDespacho");
    const d = await ctx.db.uno("SELECT d.*, u.username FROM despacho d JOIN usuario u ON u.id_usuario = d.id_usuario WHERE d.id_despacho = $1", [id]);
    if (!d) throw noEncontrado("Despacho", id);
    const [lotes, controles, incidencias, evidencias, eventos] = await Promise.all([
      ctx.db.q(`SELECT l.*, p.nombre AS producto_nombre FROM despacho_lote dl JOIN lote l ON l.id_lote = dl.id_lote
                JOIN producto p ON p.id_producto = l.id_producto WHERE dl.id_despacho = $1 ORDER BY dl.id_despacho_lote ASC`, [id]),
      ctx.db.q(`${SQL_CONTROL} WHERE c.id_despacho = $1 ORDER BY c.fecha_hora ASC, c.id_control ASC`, [id]),
      resumenIncidencias(ctx.db, "i.id_despacho = $1", [id], "i.fecha_creacion DESC, i.id_incidencia DESC"),
      evidenciasDeIncidencias(ctx.db, "id_despacho = $1", id),
      ctx.db.q(`${SQL_EVENTO} WHERE e.id_despacho = $1 ORDER BY e.fecha_hora ASC, e.id_evento ASC`, [id]),
    ]);
    return ok({
      id_despacho: d.id_despacho, codigo: d.codigo, transportista: d.transportista, vehiculo: d.vehiculo, placa: d.placa,
      destino: d.destino, estado: d.estado, fecha_programada: d.fecha_programada, fecha_salida: d.fecha_salida,
      fecha_llegada: d.fecha_llegada, responsable: d.username,
      lotes: lotes.map((l) => ({ id_lote: l.id_lote, codigo_lote: l.codigo_lote, producto: l.producto_nombre, cantidad: l.cantidad, unidad: l.unidad, estado: l.estado })),
      controles: controles.map(controlDto),
      incidencias,
      evidencias: evidencias.map(evidenciaResumen),
      timeline: eventos.map(timeline),
    });
  });

  // ---------------------------------------------------------------- dashboard
  r.get("/api/dashboard", async (ctx: Ctx) => {
    const desde = ctx.query.fecha("desde");
    const hasta = ctx.query.fecha("hasta");
    const desdeFiltro = desde ? `${desde}T00:00:00` : "1970-01-01T00:00:00";
    const hastaFiltro = hasta ? `${sumarDias(hasta, 1)}T00:00:00` : `${sumarDias(hoyLima(), 1)}${ahoraLima().slice(10)}`;
    const redondear = (n: number) => Math.round(n * 100) / 100;
    const db = ctx.db;
    const [ctrl, desp, lotes, inc, porEstado, porProducto, abiertas, resueltas, recientes, fechasCierre] = await Promise.all([
      db.uno(`SELECT COUNT(*) AS controles, COUNT(*) FILTER (WHERE resultado = 'FUERA_RANGO') AS fuera
              FROM control WHERE fecha_hora BETWEEN $1 AND $2`, [desdeFiltro, hastaFiltro]),
      db.uno(`SELECT (SELECT COUNT(*) FROM despacho) AS total,
                     (SELECT COUNT(*) FROM despacho d WHERE d.estado NOT IN ('ENTREGADO', 'CANCELADO')
                        AND NOT EXISTS (SELECT 1 FROM incidencia i WHERE i.id_despacho = d.id_despacho AND i.estado IN ('ABIERTA', 'EN_PROCESO'))) AS sin_inc,
                     (SELECT COUNT(*) FROM control c JOIN despacho d ON d.id_despacho = c.id_despacho
                        WHERE c.resultado = 'FUERA_RANGO' AND d.estado NOT IN ('ENTREGADO', 'CANCELADO')) AS desv_activos`),
      db.uno(`SELECT COUNT(*) AS total,
                     COUNT(*) FILTER (WHERE estado = 'DISPONIBLE') AS disponibles, COUNT(*) FILTER (WHERE estado = 'BLOQUEADO') AS bloqueados,
                     COUNT(*) FILTER (WHERE estado = 'EN_TRANSITO') AS en_transito, COUNT(*) FILTER (WHERE estado = 'ENTREGADO') AS entregados,
                     COUNT(*) FILTER (WHERE estado = 'DESCARTADO') AS descartados, COUNT(*) FILTER (WHERE fecha_vencimiento < $1) AS por_vencer
              FROM lote`, [sumarDias(hoyLima(), 30)]),
      db.uno(`SELECT COUNT(*) AS total,
                     COUNT(*) FILTER (WHERE estado = 'ABIERTA') AS abiertas, COUNT(*) FILTER (WHERE estado = 'EN_PROCESO') AS en_proceso,
                     COUNT(*) FILTER (WHERE estado = 'RESUELTA') AS resueltas, COUNT(*) FILTER (WHERE estado = 'CERRADA') AS cerradas,
                     COUNT(*) FILTER (WHERE prioridad = 'CRITICA') AS criticas, COUNT(*) FILTER (WHERE prioridad = 'ALTA') AS altas
              FROM incidencia`),
      db.q("SELECT estado, COUNT(*) AS total FROM despacho GROUP BY estado"),
      db.q(`SELECT p.id_producto, p.nombre, COUNT(c.id_control) AS controles, COUNT(c.id_control) FILTER (WHERE c.resultado = 'FUERA_RANGO') AS desviaciones
            FROM producto p JOIN lote l ON l.id_producto = p.id_producto LEFT JOIN control c ON c.id_lote = l.id_lote
            GROUP BY p.id_producto, p.nombre ORDER BY p.id_producto`),
      resumenIncidencias(db, "i.estado IN ('ABIERTA', 'EN_PROCESO')", [], `${ORDEN_PRIORIDAD}, i.fecha_creacion ASC LIMIT 10`),
      resumenIncidencias(db, "i.estado = 'RESUELTA'", [], "i.fecha_cierre DESC NULLS LAST LIMIT 10"),
      db.q(`${SQL_EVENTO} ORDER BY e.fecha_hora DESC, e.id_evento DESC LIMIT 10`),
      db.q("SELECT fecha_creacion, fecha_cierre FROM incidencia WHERE fecha_cierre IS NOT NULL"),
    ]);
    const controles = ctrl!.controles, fuera = ctrl!.fuera;
    const promedio = fechasCierre.length
      ? fechasCierre.reduce((s, f) => s + minutosEntre(f.fecha_creacion, f.fecha_cierre), 0) / fechasCierre.length
      : 0;
    const conteo = Object.fromEntries(porEstado.map((f) => [f.estado, f.total]));
    return ok({
      cumplimiento: {
        controles, en_rango: controles - fuera, fuera_de_rango: fuera,
        porcentaje_en_rango: controles === 0 ? 100.0 : redondear(((controles - fuera) * 100) / controles),
        despachos: desp!.total, despachos_sin_incidencias: desp!.sin_inc, desviaciones_en_despachos_activos: desp!.desv_activos,
        desde, hasta,
      },
      lotes: {
        total: lotes!.total, disponibles: lotes!.disponibles, bloqueados: lotes!.bloqueados, en_transito: lotes!.en_transito,
        entregados: lotes!.entregados, descartados: lotes!.descartados, por_vencer: lotes!.por_vencer,
      },
      incidencias: { ...inc, promedio_minutos_resolucion: redondear(promedio) },
      despachos_por_estado: ESTADOS_DESPACHO.map((estado) => ({ estado, total: conteo[estado] ?? 0 })),
      cumplimiento_por_producto: porProducto.map((f) => ({
        id_producto: f.id_producto, nombre: f.nombre, controles: f.controles, desviaciones: f.desviaciones,
        porcentaje_en_rango: f.controles === 0 ? 100.0 : redondear(((f.controles - f.desviaciones) * 100) / f.controles),
      })),
      incidencias_abiertas: abiertas,
      ultima_incidencia_resuelta: resueltas,
      eventos_recientes: recientes.map(timeline),
    });
  });
}

export { incidenciaDto };
