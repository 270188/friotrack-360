// Autenticación con JWT (HS256) y autorización por rol, con las mismas reglas que SecurityConfig.java.
import { createHmac, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { HttpError } from "./core.ts";
import type { Db, Fila } from "./db.ts";

export type Rol = "ADMIN" | "OPERADOR" | "CALIDAD" | "SUPERVISOR";
export const ROLES: readonly Rol[] = ["ADMIN", "OPERADOR", "CALIDAD", "SUPERVISOR"];

export type Usuario = {
  id_usuario: number;
  nombre: string;
  apellido: string;
  username: string;
  password_hash: string;
  rol: Rol;
  activo: boolean;
  fecha_creacion: string;
};

const b64url = (b: Buffer | string) => Buffer.from(b).toString("base64url");

function secreto(): Buffer {
  const s = process.env.APP_JWT_SECRET;
  if (!s || s.length < 32) throw new Error("APP_JWT_SECRET debe tener al menos 32 caracteres");
  return Buffer.from(s, "utf8");
}
export const expiracionSegundos = () => Number(process.env.APP_JWT_EXPIRACION ?? 7200);

export function generarToken(username: string, id: number, rol: Rol): string {
  const ahora = Math.floor(Date.now() / 1000);
  const cab = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const datos = b64url(JSON.stringify({ sub: username, id_usuario: id, rol, iat: ahora, exp: ahora + expiracionSegundos() }));
  const firma = b64url(createHmac("sha256", secreto()).update(`${cab}.${datos}`).digest());
  return `${cab}.${datos}.${firma}`;
}

/** Devuelve el username del token si la firma y la vigencia son correctas; null en otro caso. */
export function validarToken(token: string): string | null {
  const partes = token.split(".");
  if (partes.length !== 3) return null;
  const [cab, datos, firma] = partes;
  const esperada = createHmac("sha256", secreto()).update(`${cab}.${datos}`).digest();
  const recibida = Buffer.from(firma, "base64url");
  if (recibida.length !== esperada.length || !timingSafeEqual(recibida, esperada)) return null;
  try {
    const h = JSON.parse(Buffer.from(cab, "base64url").toString("utf8"));
    if (h.alg !== "HS256") return null;
    const p = JSON.parse(Buffer.from(datos, "base64url").toString("utf8"));
    if (typeof p.exp !== "number" || p.exp * 1000 <= Date.now()) return null;
    return typeof p.sub === "string" ? p.sub : null;
  } catch {
    return null;
  }
}

export const hashClave = (clave: string) => bcrypt.hash(clave, 10);
export const verificarClave = (clave: string, hash: string) => bcrypt.compare(clave, hash);

/** Usuario del token (si existe y está activo); si no, null. Equivale a JwtAuthFilter. */
export async function usuarioDelToken(cabecera: string | null, db: Db): Promise<Usuario | null> {
  if (!cabecera?.startsWith("Bearer ")) return null;
  const username = validarToken(cabecera.slice(7).trim());
  if (!username) return null;
  const u = (await db.uno("SELECT * FROM usuario WHERE username = $1", [username])) as Usuario | null;
  return u && u.activo ? u : null;
}

// ------------------------------------------------------------------ reglas de acceso

const TODOS: Rol[] = ["OPERADOR", "CALIDAD", "SUPERVISOR", "ADMIN"];

/** Coincidencia al estilo Ant de Spring: "/api/x/**" incluye "/api/x"; "*" es un solo segmento. */
function coincide(ruta: string, patron: string): boolean {
  if (patron.endsWith("/**")) {
    const base = patron.slice(0, -3);
    return ruta === base || ruta.startsWith(base + "/");
  }
  const a = ruta.split("/");
  const b = patron.split("/");
  return a.length === b.length && b.every((s, i) => s === "*" || s === a[i]);
}

/**
 * Roles permitidos para un método y una ruta (null = público). Mismo orden que SecurityConfig:
 * gana la primera regla que coincide.
 */
export function rolesPermitidos(metodo: string, ruta: string): Rol[] | null | "autenticado" {
  const m = metodo.toUpperCase();
  if (ruta === "/api/auth/login") return null;
  if (coincide(ruta, "/api/auth/**")) return "autenticado";
  if (m === "GET" && coincide(ruta, "/api/usuario/**")) return TODOS;
  if (coincide(ruta, "/api/usuario/**")) return ["ADMIN"];
  if (["bloquear", "liberar", "descartar"].some((a) => coincide(ruta, `/api/lote/*/${a}`))) return ["CALIDAD", "ADMIN"];
  if (m === "POST" && ruta === "/api/producto") return ["ADMIN"];
  if ((m === "PUT" || m === "DELETE") && coincide(ruta, "/api/producto/**")) return ["ADMIN"];
  const incOEvi = coincide(ruta, "/api/incidencia/**") || coincide(ruta, "/api/evidencia/**");
  if (["POST", "PUT", "PATCH"].includes(m) && incOEvi) return ["CALIDAD", "ADMIN"];
  if (m === "DELETE" && coincide(ruta, "/api/evidencia/**")) return ["CALIDAD", "ADMIN"];
  if (m === "POST" && coincide(ruta, "/api/comprobante/**")) return ["OPERADOR", "ADMIN"];
  if (m === "GET") return TODOS;
  return ["OPERADOR", "CALIDAD", "ADMIN"];
}

/** Aplica las reglas: 401 si falta sesión, 403 si el rol no alcanza. */
export function autorizar(metodo: string, ruta: string, usuario: Usuario | null) {
  const roles = rolesPermitidos(metodo, ruta);
  if (roles === null) return;
  if (!usuario) throw new HttpError(401, "Credenciales invalidas o token ausente");
  if (roles === "autenticado") return;
  if (!roles.includes(usuario.rol)) throw new HttpError(403, "No cuenta con permisos para esta operacion");
}

/** UsuarioDto.Response */
export function usuarioDto(u: Fila) {
  return {
    id_usuario: u.id_usuario,
    nombre: u.nombre,
    apellido: u.apellido,
    username: u.username,
    rol: u.rol,
    activo: u.activo,
    fecha_creacion: u.fecha_creacion,
  };
}
