import { aDate, aInputFechaHora, etiqueta, limpiar, num, numOrNull, rango } from './format';

describe('format', () => {
  it('convierte enums del backend en texto legible', () => {
    expect(etiqueta('EN_TRANSITO')).toBe('En tránsito');
    expect(etiqueta('FUERA_RANGO')).toBe('Fuera de rango');
    expect(etiqueta('DISPONIBLE')).toBe('Disponible');
    expect(etiqueta(null)).toBe('—');
  });

  it('describe rangos con límites abiertos o cerrados', () => {
    expect(rango(2, 8, '°C')).toBe('2 a 8 °C');
    expect(rango(null, 8, '°C')).toBe('≤ 8 °C');
    expect(rango(-18, null, '°C')).toBe('≥ -18 °C');
    expect(rango(null, null, '%')).toBe('Sin rango');
  });

  it('interpreta fechas ISO y arreglos de Jackson', () => {
    expect(aDate('2026-10-12')?.getDate()).toBe(12);
    expect(aDate([2026, 10, 12, 18, 9])?.getHours()).toBe(18);
    expect(aDate('no-es-fecha')).toBeNull();
    expect(aInputFechaHora(new Date(2026, 0, 5, 7, 3))).toBe('2026-01-05T07:03');
  });

  it('limpia cadenas vacías y números', () => {
    expect(limpiar({ a: '', b: 'x', c: 0 })).toEqual({ a: null, b: 'x', c: 0 });
    expect(numOrNull('')).toBeNull();
    expect(numOrNull('9.5')).toBe(9.5);
    expect(num(null)).toBe('—');
  });
});
