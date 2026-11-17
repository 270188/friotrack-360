import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { MiCuenta } from './mi-cuenta';

describe('MiCuenta', () => {
  let component: MiCuenta;
  let fixture: ComponentFixture<MiCuenta>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MiCuenta],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(MiCuenta);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  it('se crea y pide el perfil del usuario', () => {
    expect(component).toBeTruthy();
    http.expectOne((r) => r.url.endsWith('/api/auth/me'));
  });

  it('el formulario reactivo valida la contraseña nueva y su confirmación', () => {
    const f = component.form;
    f.setValue({ actual: 'admin123', nueva: 'corta', confirmar: 'otra' });
    f.markAllAsTouched();
    expect(f.valid).toBe(false);
    expect(component.mensaje('nueva')).toContain('al menos 8 caracteres');
    expect(component.mensaje('confirmar')).toBe('No coincide con la nueva contraseña.');

    f.setValue({ actual: 'admin123', nueva: 'admin123', confirmar: 'admin123' });
    expect(component.mensaje('nueva')).toBe('Debe ser distinta de la contraseña actual.');

    f.setValue({ actual: 'admin123', nueva: 'FrioTrack2026', confirmar: 'FrioTrack2026' });
    expect(f.valid).toBe(true);
  });

  it('marca como pendiente un formulario modificado (para el guard de salida)', () => {
    expect(component.tieneCambiosPendientes()).toBe(false);
    component.form.controls.actual.setValue('x');
    component.form.markAsDirty();
    expect(component.tieneCambiosPendientes()).toBe(true);
  });
});
