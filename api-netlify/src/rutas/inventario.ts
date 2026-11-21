// /api/producto y /api/lote (ProductoController, LoteController).
import { ahoraLima, conflicto, creado, hoyLima, noEncontrado, ok, pagina, paginacion, reglaNegocio, sinContenido,
  solicitudInvalida, sumarDias, Validador, type Cuerpo } from "../core.ts";
import { decimal, ESTADOS_LOTE, loteDto, lotePorId, productoDto, registrarEvento, SQL_LOTE } from "../dominio.ts";
import { idDe, type Router } from "../router.ts";
import type { Db } from "../db.ts";

// ------------------------------------------------------------------ productos

const COLUMNAS_PRODUCTO: Record<string, string> = {
  idProducto: "id_producto", nombre: "nombre", categoria: "categoria", activo: "activo", fechaCreacion: "fecha_creacion",
  temperaturaMin: "temperatura_min", temperaturaMax: "temperatura_max",
};

async function producto(db: Db, id: number) {
  const p = await db.uno("SELECT * FROM producto WHERE id_producto = $1", [id]);
  if (!p) throw noEncontrado("Producto", id);
  return p;
}

function leerProducto(body: Cuerpo) {
  const v = new Validador(body);
  const r = {
    nombre: v.texto("nombre", { obligatorio: true, max: 150 })!,
    categoria: v.texto("categoria", { max: 100 }),
    descripcion: v.texto("descripcion"),
    temperatura_min: v.numero("temperatura_min", { min: -50, max: 50 }),
    temperatura_max: v.numero("temperatura_max", { min: -50, max: 50 }),
    humedad_min: v.numero("humedad_min", { min: 0, max: 100 }),
    humedad_max: v.numero("humedad_max", { min: 0, max: 100 }),
    activo: v.booleano("activo"),
  };
  v.verificar();
  if (r.temperatura_min !== null && r.temperatura_max !== null && r.temperatura_min > r.temperatura_max) {
    throw reglaNegocio("temperaturaMin no puede ser mayor que temperaturaMax");
  }
  if (r.humedad_min !== null && r.humedad_max !== null && r.humedad_min > r.humedad_max) {
    throw reglaNegocio("humedadMin no puede ser mayor que humedadMax");
  }
  return r;
}

// ------------------------------------------------------------------ lotes

const COLUMNAS_LOTE: Record<string, string> = {
  idLote: "l.id_lote", codigoLote: "l.codigo_lote", fechaProduccion: "l.fecha_produccion",
  fechaVencimiento: "l.fecha_vencimiento", cantidad: "l.cantidad", estado: "l.estado", fechaCreacion: "l.fecha_creacion",
};

async function lote(db: Db, id: number) {
  const l = await lotePorId(db, id);
  if (!l) throw noEncontrado("Lote", id);
  return l;
}

function validarFechas(produccion: string | null, vencimiento: string | null) {
  if (produccion && vencimiento && produccion > vencimiento) {
    throw reglaNegocio("fechaProduccion no puede ser posterior a fechaVencimiento");
  }
}

const motivoTexto = (m: unknown) => (typeof m === "string" && m.trim() ? m : "no indicado");

async function leerMotivo(cuerpo: Cuerpo | null) {
  if (!cuerpo) return null;
  const v = new Validador(cuerpo);
  const m = v.texto("motivo", { max: 500 });
  v.verificar();
  return m;
}

export function rutasInventario(r: Router) {
  // ---------------------------------------------------------------- productos
  r.get("/api/producto", async (ctx) => {
    const q = ctx.query.texto("q")?.trim() || null;
    const activo = ctx.query.booleano("activo");
    const p = paginacion(ctx.query, COLUMNAS_PRODUCTO, "id_producto ASC");
    const where = `($1::boolean IS NULL OR activo = $1)
      AND ($2::text IS NULL OR LOWER(nombre) LIKE '%' || LOWER($2) || '%' OR LOWER(COALESCE(categoria, '')) LIKE '%' || LOWER($2) || '%')`;
    const total = Number(await ctx.db.valor(`SELECT COUNT(*) FROM producto WHERE ${where}`, [activo, q]));
    const filas = await ctx.db.q(`SELECT * FROM producto WHERE ${where} ORDER BY ${p.orden} LIMIT $3 OFFSET $4`,
      [activo, q, p.size, p.page * p.size]);
    return ok(pagina(filas.map(productoDto), total, p));
  });
  r.get("/api/producto/activos", async (ctx) =>
    ok((await ctx.db.q("SELECT * FROM producto WHERE activo ORDER BY nombre ASC")).map(productoDto)));
  r.get("/api/producto/con-lotes", async (ctx) =>
    ok((await ctx.db.q("SELECT * FROM producto p WHERE EXISTS (SELECT 1 FROM lote l WHERE l.id_producto = p.id_producto) ORDER BY id_producto")).map(productoDto)));
  r.get("/api/producto/:id", async (ctx) => ok(productoDto(await producto(ctx.db, idDe(ctx)))));
  r.post("/api/producto", async (ctx) => {
    const d = leerProducto(await ctx.body());
    const p = await ctx.db.uno(
      `INSERT INTO producto (nombre, categoria, descripcion, temperatura_min, temperatura_max, humedad_min, humedad_max, activo, fecha_creacion)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [d.nombre, d.categoria, d.descripcion, d.temperatura_min, d.temperatura_max, d.humedad_min, d.humedad_max, d.activo ?? true, ahoraLima(true)],
    );
    return creado(productoDto(p!));
  });
  r.put("/api/producto/:id", async (ctx) => {
    const id = idDe(ctx);
    const d = leerProducto(await ctx.body());
    await producto(ctx.db, id);
    const p = await ctx.db.uno(
      `UPDATE producto SET nombre = $2, categoria = $3, descripcion = $4, temperatura_min = $5, temperatura_max = $6,
              humedad_min = $7, humedad_max = $8, activo = COALESCE($9, activo)
       WHERE id_producto = $1 RETURNING *`,
      [id, d.nombre, d.categoria, d.descripcion, d.temperatura_min, d.temperatura_max, d.humedad_min, d.humedad_max, d.activo],
    );
    return ok(productoDto(p!));
  });
  r.delete("/api/producto/:id", async (ctx) => {
    const id = idDe(ctx);
    await producto(ctx.db, id);
    await ctx.db.q("UPDATE producto SET activo = FALSE WHERE id_producto = $1", [id]);
    return sinContenido();
  });
  r.delete("/api/producto/:id/definitivo", async (ctx) => {
    const id = idDe(ctx);
    await producto(ctx.db, id);
    if (await ctx.db.uno("SELECT 1 FROM lote WHERE id_producto = $1 LIMIT 1", [id])) {
      throw conflicto("El producto tiene lotes asociados: desactivezlo en lugar de eliminarlo");
    }
    await ctx.db.q("DELETE FROM producto WHERE id_producto = $1", [id]);
    return sinContenido();
  });

  // ---------------------------------------------------------------- lotes
  r.get("/api/lote", async (ctx) => {
    const q = ctx.query.texto("q")?.trim() || null;
    const estado = ctx.query.enumeracion("estado", ESTADOS_LOTE);
    const idProducto = ctx.query.entero("idProducto");
    const p = paginacion(ctx.query, COLUMNAS_LOTE, "l.id_lote ASC");
    const where = `($1::text IS NULL OR l.estado = $1) AND ($2::bigint IS NULL OR l.id_producto = $2)
      AND ($3::text IS NULL OR LOWER(l.codigo_lote) LIKE '%' || LOWER($3) || '%')`;
    const total = Number(await ctx.db.valor(`SELECT COUNT(*) FROM lote l WHERE ${where}`, [estado, idProducto, q]));
    const filas = await ctx.db.q(`${SQL_LOTE} WHERE ${where} ORDER BY ${p.orden} LIMIT $4 OFFSET $5`,
      [estado, idProducto, q, p.size, p.page * p.size]);
    return ok(pagina(filas.map(loteDto), total, p));
  });
  r.get("/api/lote/estado/:estado", async (ctx) => {
    const e = ctx.params.estado;
    if (!(ESTADOS_LOTE as readonly string[]).includes(e)) {
      throw solicitudInvalida(`Valor invalido para 'estado': ${e}. Se esperaba uno de [${ESTADOS_LOTE.join(", ")}]`);
    }
    return ok((await ctx.db.q(`${SQL_LOTE} WHERE l.estado = $1 ORDER BY l.fecha_creacion DESC`, [e])).map(loteDto));
  });
  r.get("/api/lote/producto/:idProducto", async (ctx) =>
    ok((await ctx.db.q(`${SQL_LOTE} WHERE l.id_producto = $1 ORDER BY l.codigo_lote ASC`, [idDe(ctx, "idProducto")])).map(loteDto)));
  r.get("/api/lote/por-vencer", async (ctx) => {
    const limite = ctx.query.fecha("limite") ?? sumarDias(hoyLima(), 30);
    return ok((await ctx.db.q(`${SQL_LOTE} WHERE l.fecha_vencimiento < $1 ORDER BY l.fecha_vencimiento ASC`, [limite])).map(loteDto));
  });
  r.get("/api/lote/codigo/:codigo", async (ctx) => {
    const l = await ctx.db.uno(`${SQL_LOTE} WHERE l.codigo_lote = $1`, [ctx.params.codigo]);
    if (!l) throw noEncontrado(`No existe un lote con codigo ${ctx.params.codigo}`);
    return ok(loteDto(l));
  });
  r.get("/api/lote/:id", async (ctx) => ok(loteDto(await lote(ctx.db, idDe(ctx)))));

  r.post("/api/lote", async (ctx) => {
    const v = new Validador(await ctx.body());
    const idProducto = v.id("id_producto", true);
    const codigo = v.texto("codigo_lote", { obligatorio: true, max: 80 })!;
    const fp = v.fecha("fecha_produccion");
    const fv = v.fecha("fecha_vencimiento");
    const cantidad = v.numero("cantidad", { obligatorio: true, min: 0, enteros: 9, decimales: 3 });
    const unidad = v.texto("unidad", { max: 30 });
    const estado = v.enumeracion("estado", ESTADOS_LOTE);
    v.verificar();
    const prod = await producto(ctx.db, idProducto!);
    if (await ctx.db.uno("SELECT 1 FROM lote WHERE codigo_lote = $1", [codigo])) throw conflicto(`Ya existe un lote con el codigo ${codigo}`);
    validarFechas(fp, fv);
    const ahora = ahoraLima(true);
    const nuevo = await ctx.db.uno(
      `INSERT INTO lote (id_producto, codigo_lote, fecha_produccion, fecha_vencimiento, cantidad, unidad, estado, fecha_creacion)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id_lote, cantidad, unidad`,
      [idProducto, codigo, fp, fv, cantidad, unidad?.trim() ? unidad : "UNIDAD", estado ?? "DISPONIBLE", ahora],
    );
    await registrarEvento(ctx.db, "CREACION_LOTE", nuevo!.id_lote, null, ctx.yo(),
      `Lote ${codigo} creado con ${decimal(nuevo!.cantidad, 3)} ${nuevo!.unidad} de ${prod.nombre}`);
    return creado(loteDto((await lotePorId(ctx.db, nuevo!.id_lote))!));
  });

  r.put("/api/lote/:id", async (ctx) => {
    const id = idDe(ctx);
    const v = new Validador(await ctx.body());
    const fp = v.fecha("fecha_produccion");
    const fv = v.fecha("fecha_vencimiento");
    const cantidad = v.numero("cantidad", { min: 0, enteros: 9, decimales: 3 });
    const unidad = v.texto("unidad", { max: 30 });
    v.verificar();
    const l = await lote(ctx.db, id);
    validarFechas(fp ?? l.fecha_produccion, fv ?? l.fecha_vencimiento);
    await ctx.db.q(
      `UPDATE lote SET fecha_produccion = COALESCE($2, fecha_produccion), fecha_vencimiento = COALESCE($3, fecha_vencimiento),
              cantidad = COALESCE($4, cantidad), unidad = COALESCE($5, unidad) WHERE id_lote = $1`,
      [id, fp, fv, cantidad, unidad?.trim() ? unidad : null],
    );
    return ok(loteDto((await lotePorId(ctx.db, id))!));
  });

  r.patch("/api/lote/:id/bloquear", async (ctx) => {
    const id = idDe(ctx);
    const motivo = await leerMotivo(await ctx.bodyOpcional());
    const l = await lote(ctx.db, id);
    if (l.estado === "BLOQUEADO") throw reglaNegocio(`El lote ${l.codigo_lote} ya esta bloqueado`);
    if (l.estado === "ENTREGADO" || l.estado === "DESCARTADO") {
      throw reglaNegocio(`El lote ${l.codigo_lote} esta en un estado terminal (${l.estado}) y no puede bloquearse`);
    }
    await ctx.db.q("UPDATE lote SET estado = 'BLOQUEADO' WHERE id_lote = $1", [id]);
    await registrarEvento(ctx.db, "BLOQUEO_LOTE", id, null, ctx.yo(),
      `Lote bloqueado (${l.estado} -> BLOQUEADO). Motivo: ${motivoTexto(motivo)}`);
    return ok(loteDto((await lotePorId(ctx.db, id))!));
  });
  r.patch("/api/lote/:id/liberar", async (ctx) => {
    const id = idDe(ctx);
    const motivo = await leerMotivo(await ctx.bodyOpcional());
    const l = await lote(ctx.db, id);
    if (l.estado !== "BLOQUEADO") throw reglaNegocio(`El lote ${l.codigo_lote} no esta bloqueado`);
    await ctx.db.q("UPDATE lote SET estado = 'DISPONIBLE' WHERE id_lote = $1", [id]);
    await registrarEvento(ctx.db, "LIBERACION_LOTE", id, null, ctx.yo(),
      `Lote liberado (BLOQUEADO -> DISPONIBLE) por ${ctx.yo().username}. Motivo: ${motivoTexto(motivo)}`);
    return ok(loteDto((await lotePorId(ctx.db, id))!));
  });
  r.patch("/api/lote/:id/descartar", async (ctx) => {
    const id = idDe(ctx);
    const motivo = await leerMotivo(await ctx.bodyOpcional());
    const l = await lote(ctx.db, id);
    if (l.estado === "DESCARTADO") throw reglaNegocio(`El lote ${l.codigo_lote} ya fue descartado`);
    await ctx.db.q("UPDATE lote SET estado = 'DESCARTADO' WHERE id_lote = $1", [id]);
    await registrarEvento(ctx.db, "DESCARTE_LOTE", id, null, ctx.yo(), `Lote descartado. Motivo: ${motivoTexto(motivo)}`);
    return ok(loteDto((await lotePorId(ctx.db, id))!));
  });
}
