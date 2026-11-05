import { Pipe, PipeTransform } from '@angular/core';
import { dinero, etiqueta, fecha, fechaHora, num, rango } from './format';

@Pipe({ name: 'fecha' })
export class FechaPipe implements PipeTransform {
  transform(v: string | null | undefined): string {
    return fecha(v);
  }
}

@Pipe({ name: 'fechaHora' })
export class FechaHoraPipe implements PipeTransform {
  transform(v: string | null | undefined): string {
    return fechaHora(v);
  }
}

@Pipe({ name: 'num' })
export class NumPipe implements PipeTransform {
  transform(v: number | null | undefined, dec = 2): string {
    return num(v, dec);
  }
}

@Pipe({ name: 'dinero' })
export class DineroPipe implements PipeTransform {
  transform(v: number | null | undefined): string {
    return dinero(v);
  }
}

@Pipe({ name: 'etiqueta' })
export class EtiquetaPipe implements PipeTransform {
  transform(v: string | null | undefined): string {
    return etiqueta(v);
  }
}

@Pipe({ name: 'rango' })
export class RangoPipe implements PipeTransform {
  transform(min: number | null | undefined, max: number | null | undefined, unidad: string): string {
    return rango(min, max, unidad);
  }
}

export const PIPES = [FechaPipe, FechaHoraPipe, NumPipe, DineroPipe, EtiquetaPipe, RangoPipe] as const;
