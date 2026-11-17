import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Notificaciones as ServicioNotificaciones } from '../../core/notificaciones';
import { Notificaciones } from './notificaciones';

describe('Notificaciones', () => {
  let fixture: ComponentFixture<Notificaciones>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Notificaciones] }).compileComponents();
    fixture = TestBed.createComponent(Notificaciones);
  });

  it('muestra los avisos que otro componente publica en el servicio', () => {
    const servicio = TestBed.inject(ServicioNotificaciones);
    servicio.ok('Guardado');
    servicio.error('Algo falló');
    fixture.detectChanges();
    const avisos = fixture.nativeElement.querySelectorAll('.aviso');
    expect(avisos.length).toBe(2);
    expect(avisos[1].classList).toContain('aviso--alerta');

    (avisos[0].querySelector('button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.aviso').length).toBe(1);
  });
});
