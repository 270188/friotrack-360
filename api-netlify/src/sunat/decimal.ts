// Aritmética decimal exacta (como BigDecimal de Java con RoundingMode.HALF_UP) para montos e IGV.

export type Dec = { v: bigint; s: number };

const P10 = (n: number) => 10n ** BigInt(n);

/** Crea un decimal desde un número o texto ("12.5", 3, -0.25). */
export function dec(x: number | string | Dec): Dec {
  if (typeof x === "object") return x;
  let t = typeof x === "number" ? numeroATexto(x) : x.trim();
  const neg = t.startsWith("-");
  if (neg) t = t.slice(1);
  const [ent, frac = ""] = t.split(".");
  const v = BigInt((ent || "0") + frac);
  return { v: neg ? -v : v, s: frac.length };
}

/** Evita la notación exponencial de JavaScript (1e-7). */
function numeroATexto(n: number): string {
  const t = String(n);
  if (!/e/i.test(t)) return t;
  return n.toFixed(20).replace(/0+$/, "").replace(/\.$/, "");
}

/** División entera con redondeo HALF_UP (alejándose de cero en el empate). */
function dividirRedondeado(a: bigint, b: bigint): bigint {
  const neg = (a < 0n) !== (b < 0n);
  const aa = a < 0n ? -a : a;
  const bb = b < 0n ? -b : b;
  let q = aa / bb;
  if ((aa % bb) * 2n >= bb) q += 1n;
  return neg ? -q : q;
}

export function escala(d: Dec, s: number): Dec {
  if (s >= d.s) return { v: d.v * P10(s - d.s), s };
  return { v: dividirRedondeado(d.v, P10(d.s - s)), s };
}

export const sumar = (a: Dec, b: Dec): Dec => {
  const s = Math.max(a.s, b.s);
  return { v: escala(a, s).v + escala(b, s).v, s };
};
export const restar = (a: Dec, b: Dec): Dec => sumar(a, { v: -b.v, s: b.s });
export const multiplicar = (a: Dec, b: Dec): Dec => ({ v: a.v * b.v, s: a.s + b.s });

/** a / b con s decimales y redondeo HALF_UP. */
export function dividir(a: Dec, b: Dec, s: number): Dec {
  // a.v/10^a.s ÷ b.v/10^b.s = (a.v * 10^(s + b.s - a.s)) / b.v  (en unidades de 10^-s)
  const e = s + b.s - a.s;
  const num = e >= 0 ? a.v * P10(e) : a.v;
  const den = e >= 0 ? b.v : b.v * P10(-e);
  return { v: dividirRedondeado(num, den), s };
}

/** Texto sin notación científica con exactamente d.s decimales (toPlainString). */
export function texto(d: Dec): string {
  const neg = d.v < 0n;
  let t = (neg ? -d.v : d.v).toString().padStart(d.s + 1, "0");
  if (d.s > 0) t = `${t.slice(0, -d.s)}.${t.slice(-d.s)}`;
  return (neg ? "-" : "") + t;
}

/** Quita ceros a la derecha (stripTrailingZeros). */
export function sinCeros(d: Dec): Dec {
  let { v, s } = d;
  while (s > 0 && v % 10n === 0n) {
    v /= 10n;
    s--;
  }
  return { v, s };
}

export const aNumero = (d: Dec) => Number(texto(d));
export const comparar = (a: Dec, b: Dec) => {
  const r = restar(a, b).v;
  return r === 0n ? 0 : r < 0n ? -1 : 1;
};
