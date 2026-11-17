import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FortalezaClave, nivelClave } from './fortaleza-clave';

describe('FortalezaClave', () => {
  let fixture: ComponentFixture<FortalezaClave>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [FortalezaClave] }).compileComponents();
    fixture = TestBed.createComponent(FortalezaClave);
  });

  it('calcula el nivel de la contraseña', () => {
    expect(nivelClave('')).toBe(0);
    expect(nivelClave('abc')).toBe(1);
    expect(nivelClave('frio2026')).toBe(2);
    expect(nivelClave('FrioTrack-2026!')).toBe(4);
  });

  it('muestra el texto y avisa al padre el nivel (input → output)', () => {
    const niveles: number[] = [];
    fixture.componentInstance.nivelCambio.subscribe((n) => niveles.push(n));
    fixture.componentRef.setInput('clave', 'FrioTrack-2026!');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Seguridad: Fuerte');
    expect(niveles.at(-1)).toBe(4);
  });
});
