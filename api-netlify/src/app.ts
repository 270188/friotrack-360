// Punto de entrada común: CORS, autenticación, enrutado, transacciones y formato de errores.
import { cuerpoError, cuerpoInvalido, HttpError, Query, type Cuerpo, type Respuesta } from "./core.ts";
import { db, enTransaccion, type Db } from "./db.ts";
import { autorizar, usuarioDelToken, type Usuario } from "./auth.ts";
import { Router, type Ctx } from "./router.ts";
import { rutasUsuarios } from "./rutas/usuarios.ts";
import { rutasInventario } from "./rutas/inventario.ts";
import { rutasDespachos } from "./rutas/despachos.ts";
import { rutasCalidad } from "./rutas/calidad.ts";
import { rutasComprobantes } from "./rutas/comprobantes.ts";

export const router = new Router();
rutasUsuarios(router);
rutasInventario(router);
rutasDespachos(router);
rutasCalidad(router);
rutasComprobantes(router);

// ------------------------------------------------------------------ CORS

function origenPermitido(origen: string | null): string | null {
  if (!origen) return null;
  const lista = (process.env.APP_CORS_ORIGINS ?? "http://localhost:4200,http://localhost:3000")
    .split(",").map((o) => o.trim()).filter(Boolean);
  const ok = lista.some((p) => {
    if (!p.includes("*")) return p === origen;
    const re = new RegExp("^" + p.split("*").map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join("[^/]*") + "$");
    return re.test(origen);
  });
  return ok ? origen : null;
}

function cabecerasCors(origen: string | null): Record<string, string> {
  const o = origenPermitido(origen);
  if (!o) return {};
  return {
    "access-control-allow-origin": o,
    "access-control-allow-credentials": "true",
    "access-control-expose-headers": "Authorization, Content-Disposition",
    vary: "Origin",
  };
}

// ------------------------------------------------------------------ manejo de la petición

function responder(r: Respuesta, cors: Record<string, string>): Response {
  const headers: Record<string, string> = { ...cors, ...(r.headers ?? {}) };
  if (r.binario) return new Response(Buffer.from(r.binario), { status: r.status, headers });
  if (r.status === 204 || r.body === undefined) return new Response(null, { status: r.status, headers });
  headers["content-type"] = "application/json";
  return new Response(JSON.stringify(r.body), { status: r.status, headers });
}

export async function manejar(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const ruta = url.pathname.replace(/\/+$/, "") || "/";
  const metodo = req.method.toUpperCase();
  const cors = cabecerasCors(req.headers.get("origin"));

  if (metodo === "OPTIONS") {
    if (!Object.keys(cors).length) return new Response("Invalid CORS request", { status: 403 });
    return new Response(null, {
      status: 200,
      headers: {
        ...cors,
        "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
        "access-control-allow-headers": "Authorization, Content-Type",
        "access-control-max-age": "1800",
      },
    });
  }
  if (req.headers.get("origin") && !Object.keys(cors).length) {
    return new Response("Invalid CORS request", { status: 403 });
  }

  try {
    if (ruta === "/" || ruta === "/api" || ruta === "/api/salud") {
      return responder({ status: 200, body: { servicio: "FrioTrack 360 API", estado: "en línea", hora_lima: new Date(Date.now() - 18e6).toISOString().slice(0, 19) } }, cors);
    }
    const lectura = db();
    const usuario = await usuarioDelToken(req.headers.get("authorization"), lectura);
    autorizar(metodo, ruta, usuario);

    const encontrada = router.buscar(metodo, ruta);
    if (!encontrada) throw new HttpError(404, "El recurso solicitado no existe");
    if ("metodos" in encontrada) {
      throw new HttpError(405, `Metodo ${metodo} no permitido en esta ruta`, null, { allow: encontrada.metodos.join(", ") });
    }

    let textoCuerpo: string | null = null;
    const leerTexto = async () => (textoCuerpo ??= await req.text());
    const parsear = async (): Promise<Cuerpo | null> => {
      const t = (await leerTexto()).trim();
      if (!t) return null;
      let j: unknown;
      try {
        j = JSON.parse(t);
      } catch {
        throw cuerpoInvalido();
      }
      if (typeof j !== "object" || j === null || Array.isArray(j)) throw cuerpoInvalido();
      return j as Cuerpo;
    };

    const crearCtx = (d: Db): Ctx => ({
      params: encontrada.params,
      query: new Query(url.searchParams),
      body: async () => {
        const b = await parsear();
        if (b === null) throw cuerpoInvalido();
        return b;
      },
      bodyOpcional: parsear,
      usuario,
      yo: () => usuario as Usuario,
      db: d,
    });

    const r = metodo === "GET" || encontrada.ruta.propiaTransaccion
      ? await encontrada.ruta.fn(crearCtx(lectura))
      : await enTransaccion((tx) => encontrada.ruta.fn(crearCtx(tx)));
    return responder(r, cors);
  } catch (e) {
    if (e instanceof HttpError) {
      return responder({ status: e.status, body: cuerpoError(e.status, e.message, ruta, e.campos), headers: e.headers }, cors);
    }
    const err = e as { code?: string; message?: string };
    // Violación de integridad (único, clave foránea, check) → 409 como DataIntegrityViolationException.
    if (err.code && /^23/.test(err.code)) {
      console.warn(`Violacion de integridad en ${ruta}: ${err.message}`);
      return responder({ status: 409, body: cuerpoError(409, "La operacion viola una restriccion de integridad (valor duplicado o referencia invalida)", ruta) }, cors);
    }
    console.error(`Error inesperado en ${ruta}`, e);
    return responder({ status: 500, body: cuerpoError(500, "Error interno del servidor", ruta) }, cors);
  }
}
