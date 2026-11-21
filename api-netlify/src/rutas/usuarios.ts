// /api/auth y /api/usuario (AuthController, UsuarioController).
import { conflicto, creado, noEncontrado, ok, pagina, paginacion, reglaNegocio, solicitudInvalida, Validador, type Cuerpo } from "../core.ts";
import { expiracionSegundos, generarToken, hashClave, ROLES, usuarioDto, verificarClave, type Rol } from "../auth.ts";
import { ahoraLima } from "../core.ts";
import { idDe, type Ctx, type Router } from "../router.ts";
import type { Db } from "../db.ts";

const COLUMNAS_USUARIO: Record<string, string> = {
  idUsuario: "id_usuario", nombre: "nombre", apellido: "apellido", username: "username",
  rol: "rol", activo: "activo", fechaCreacion: "fecha_creacion",
};

async function usuario(db: Db, id: number) {
  const u = await db.uno("SELECT * FROM usuario WHERE id_usuario = $1", [id]);
  if (!u) throw noEncontrado("Usuario", id);
  return u;
}

function leerCambioPassword(body: Cuerpo) {
  const v = new Validador(body);
  const actual = v.texto("password_actual", { obligatorio: true, min: 8, max: 255 })!;
  const nuevo = v.texto("password_nuevo", { obligatorio: true, min: 8, max: 255 })!;
  v.verificar();
  return { actual, nuevo };
}

async function cambiarPassword(db: Db, id: number, body: Cuerpo) {
  const { actual, nuevo } = leerCambioPassword(body);
  const u = await usuario(db, id);
  if (!(await verificarClave(actual, u.password_hash))) throw reglaNegocio("La contraseña actual no es correcta");
  if (await verificarClave(nuevo, u.password_hash)) throw reglaNegocio("La nueva contraseña debe ser distinta de la actual");
  const r = await db.uno("UPDATE usuario SET password_hash = $2 WHERE id_usuario = $1 RETURNING *", [id, await hashClave(nuevo)]);
  return usuarioDto(r!);
}

export function rutasUsuarios(r: Router) {
  // ---------------------------------------------------------------- auth
  r.post("/api/auth/login", async (ctx) => {
    const v = new Validador(await ctx.body());
    const username = v.texto("username", { obligatorio: true })!;
    const password = v.texto("password", { obligatorio: true })!;
    v.verificar();
    const u = await ctx.db.uno("SELECT * FROM usuario WHERE username = $1", [username]);
    if (!u || !(await verificarClave(password, u.password_hash))) throw reglaNegocio("Usuario o contrasena incorrectos");
    if (!u.activo) throw reglaNegocio("Usuario o contrasena incorrectos");
    return ok({
      token: generarToken(u.username, u.id_usuario, u.rol),
      tipo: "Bearer",
      id_usuario: u.id_usuario,
      username: u.username,
      rol: u.rol,
      expira_en_segundos: expiracionSegundos(),
    });
  });
  r.get("/api/auth/me", async (ctx) => ok(usuarioDto(ctx.yo())));
  r.patch("/api/auth/password", async (ctx) => ok(await cambiarPassword(ctx.db, ctx.yo().id_usuario, await ctx.body())));

  // ---------------------------------------------------------------- usuarios
  r.get("/api/usuario", async (ctx) => {
    const p = paginacion(ctx.query, COLUMNAS_USUARIO, "id_usuario ASC");
    const total = Number(await ctx.db.valor("SELECT COUNT(*) FROM usuario"));
    const filas = await ctx.db.q(`SELECT * FROM usuario ORDER BY ${p.orden} LIMIT $1 OFFSET $2`, [p.size, p.page * p.size]);
    return ok(pagina(filas.map(usuarioDto), total, p));
  });
  r.get("/api/usuario/activos", async (ctx) =>
    ok((await ctx.db.q("SELECT * FROM usuario WHERE activo ORDER BY apellido ASC, nombre ASC")).map(usuarioDto)));
  r.get("/api/usuario/rol/:rol", async (ctx) => {
    const rol = ctx.params.rol as Rol;
    if (!ROLES.includes(rol)) throw solicitudInvalida(`Valor invalido para 'rol': ${rol}. Se esperaba uno de [${ROLES.join(", ")}]`);
    return ok((await ctx.db.q("SELECT * FROM usuario WHERE rol = $1 ORDER BY id_usuario", [rol])).map(usuarioDto));
  });
  r.get("/api/usuario/username/:username", async (ctx) => {
    const u = await ctx.db.uno("SELECT * FROM usuario WHERE username = $1", [ctx.params.username]);
    if (!u) throw noEncontrado(`No existe un usuario con username ${ctx.params.username}`);
    return ok(usuarioDto(u));
  });
  r.get("/api/usuario/:id", async (ctx) => ok(usuarioDto(await usuario(ctx.db, idDe(ctx)))));

  r.post("/api/usuario", async (ctx) => {
    const v = new Validador(await ctx.body());
    const nombre = v.texto("nombre", { obligatorio: true, max: 100 })!;
    const apellido = v.texto("apellido", { obligatorio: true, max: 100 })!;
    const username = v.texto("username", { obligatorio: true, max: 80 })!;
    const password = v.texto("password", { min: 8, max: 255 });
    const rol = v.enumeracion("rol", ROLES);
    const activo = v.booleano("activo");
    v.verificar();
    if (!password || !password.trim()) throw reglaNegocio("La contrasena es obligatoria al crear un usuario");
    if (await ctx.db.uno("SELECT 1 FROM usuario WHERE username = $1", [username])) {
      throw conflicto(`El username ${username} ya esta registrado`);
    }
    const u = await ctx.db.uno(
      `INSERT INTO usuario (nombre, apellido, username, password_hash, rol, activo, fecha_creacion)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [nombre, apellido, username, await hashClave(password), rol ?? "OPERADOR", activo ?? true, ahoraLima(true)],
    );
    return creado(usuarioDto(u!));
  });

  r.put("/api/usuario/:id", async (ctx: Ctx) => {
    const id = idDe(ctx);
    const v = new Validador(await ctx.body());
    const nombre = v.texto("nombre", { obligatorio: true, max: 100 })!;
    const apellido = v.texto("apellido", { obligatorio: true, max: 100 })!;
    const rol = v.enumeracion("rol", ROLES);
    const activo = v.booleano("activo");
    v.verificar();
    await usuario(ctx.db, id);
    const u = await ctx.db.uno(
      `UPDATE usuario SET nombre = $2, apellido = $3, rol = COALESCE($4, rol), activo = COALESCE($5, activo)
       WHERE id_usuario = $1 RETURNING *`,
      [id, nombre, apellido, rol, activo],
    );
    return ok(usuarioDto(u!));
  });
  r.patch("/api/usuario/:id/password", async (ctx) => ok(await cambiarPassword(ctx.db, idDe(ctx), await ctx.body())));
  r.patch("/api/usuario/:id/activar", async (ctx) => {
    const id = idDe(ctx);
    await usuario(ctx.db, id);
    return ok(usuarioDto((await ctx.db.uno("UPDATE usuario SET activo = TRUE WHERE id_usuario = $1 RETURNING *", [id]))!));
  });
  r.delete("/api/usuario/:id", async (ctx) => {
    const id = idDe(ctx);
    await usuario(ctx.db, id);
    if (id === ctx.yo().id_usuario) throw reglaNegocio("Un usuario no puede desactivar su propia cuenta");
    return ok(usuarioDto((await ctx.db.uno("UPDATE usuario SET activo = FALSE WHERE id_usuario = $1 RETURNING *", [id]))!));
  });
}
