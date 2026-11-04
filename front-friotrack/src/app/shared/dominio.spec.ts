import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { Control } from '../core/types';
import { Grafico, TablaControles } from './dominio';

const control = (id: number, t: number, resultado: 'NORMAL' | 'FUERA_RANGO', min: number): Control => ({
  id_control: id, id_despacho: 1, codigo_despacho: 'DSP-1', id_lote: 1, codigo_lote: 'LOT-1',
  fecha_hora: `2026-10-12T10:${String(min).padStart(2, '0')}:00`, temperatura: t, humedad: null, resultado,
  motivo_desviacion: resultado === 'FUERA_RANGO' ? 'temperatura fuera de 2-8 °C' : null, observacion: null, id_usuario: 1, username: 'op',
});

describe('Grafico', () => {
  it('dibuja un punto por lectura y marca las desviaciones', () => {
    TestBed.configureTestingModule({});
    const f = TestBed.createComponent(Grafico);
    f.componentRef.setInput('controles', [control(1, 4, 'NORMAL', 0), control(2, 9.6, 'FUERA_RANGO', 30), control(3, 5, 'NORMAL', 50)]);
    f.componentRef.setInput('min', 2);
    f.componentRef.setInput('max', 8);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelectorAll('circle').length).toBe(3);
    expect(el.querySelectorAll('circle.fill-alert-500').length).toBe(1);
    expect(el.querySelector('rect')).not.toBeNull(); // banda del rango permitido
  });

  it('muestra un mensaje si no hay lecturas', () => {
    TestBed.configureTestingModule({});
    const f = TestBed.createComponent(Grafico);
    f.componentRef.setInput('controles', []);
    f.detectChanges();
    expect((f.nativeElement as HTMLElement).textContent).toContain('Sin lecturas de temperatura');
  });
});

describe('TablaControles', () => {
  it('oculta la columna redundante según la ficha y ordena de la más reciente a la más antigua', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const f = TestBed.createComponent(TablaControles);
    f.componentRef.setInput('controles', [control(1, 4, 'NORMAL', 0), control(2, 9.6, 'FUERA_RANGO', 30)]);
    f.componentRef.setInput('contexto', 'lote');
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    const cabeceras = Array.from(el.querySelectorAll('th')).map((th) => th.textContent?.trim());
    expect(cabeceras).toContain('Despacho');
    expect(cabeceras).not.toContain('Lote');
    expect(el.querySelector('tbody tr')?.textContent).toContain('9.6 °C');
  });
});
