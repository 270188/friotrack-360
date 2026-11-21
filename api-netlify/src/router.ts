// Enrutador mínimo: método + patrón ("/api/lote/:id") → manejador.
import { solicitudInvalida, type Cuerpo, type Query, type Respuesta } from "./core.ts";
import type { Db } from "./db.ts";
import type { Usuario } from "./auth.ts";

export type Ctx = {
  params: Record<string, string>;
  query: Query;
  /** Cuerpo JSON (objeto); {} si no hay cuerpo. */
  body: () => Promise<Cuerpo>;
  /** Cuerpo JSON opcional: null si viene vacío (como @RequestBody(required = false)). */
  bodyOpcional: () => Promise<Cuerpo | null>;
  usuario: Usuario | null;
  /** Usuario autenticado (las rutas protegidas siempre lo tienen). */
  yo: () => Usuario;
  db: Db;
};

export type Manejador = (ctx: Ctx) => Promise<Respuesta>;
export type Ruta = { metodo: string; partes: string[]; fn: Manejador; propiaTransaccion?: boolean };

export class Router {
  rutas: Ruta[] = [];
  private agregar(metodo: string, patron: string, fn: Manejador, propiaTransaccion = false) {
    this.rutas.push({ metodo, partes: patron.split("/").filter(Boolean), fn, propiaTransaccion });
  }
  get(p: string, fn: Manejador) { this.agregar("GET", p, fn); }
  post(p: string, fn: Manejador, propiaTransaccion = false) { this.agregar("POST", p, fn, propiaTransaccion); }
  put(p: string, fn: Manejador) { this.agregar("PUT", p, fn); }
  patch(p: string, fn: Manejador) { this.agregar("PATCH", p, fn); }
  delete(p: string, fn: Manejador) { this.agregar("DELETE", p, fn); }

  /** Busca la ruta. Los segmentos literales ganan a los parámetros (como Spring). */
  buscar(metodo: string, ruta: string): { ruta: Ruta; params: Record<string, string> } | { metodos: string[] } | null {
    const seg = ruta.split("/").filter(Boolean);
    const candidatas: { ruta: Ruta; params: Record<string, string>; literales: number }[] = [];
    for (const r of this.rutas) {
      if (r.partes.length !== seg.length) continue;
      const params: Record<string, string> = {};
      let literales = 0;
      let ok = true;
      for (let i = 0; i < seg.length; i++) {
        const p = r.partes[i];
        if (p.startsWith(":")) params[p.slice(1)] = decodeURIComponent(seg[i]);
        else if (p === seg[i]) literales++;
        else { ok = false; break; }
      }
      if (ok) candidatas.push({ ruta: r, params, literales });
    }
    if (!candidatas.length) return null;
    const delMetodo = candidatas.filter((c) => c.ruta.metodo === metodo).sort((a, b) => b.literales - a.literales);
    if (delMetodo.length) return { ruta: delMetodo[0].ruta, params: delMetodo[0].params };
    return { metodos: [...new Set(candidatas.map((c) => c.ruta.metodo))] };
  }
}

/** Parámetro de ruta numérico (Long). */
export function idDe(ctx: Ctx, nombre = "id"): number {
  const v = ctx.params[nombre];
  if (!/^\d+$/.test(v)) throw solicitudInvalida(`Valor invalido para '${nombre}': ${v}. Se esperaba Long`);
  return Number(v);
}
