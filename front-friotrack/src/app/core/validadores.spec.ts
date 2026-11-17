import { FormControl, FormGroup, Validators } from '@angular/forms';
import { claveSegura, coinciden, distintos, documentoPeruano, mensajeCampo, rangoValido } from './validadores';

describe('validadores propios', () => {
  it('claveSegura exige letra y número', () => {
    const c = new FormControl('', claveSegura());
    c.setValue('solotexto');
    expect(c.errors).toEqual({ claveSegura: true });
    c.setValue('12345678');
    expect(c.errors).toEqual({ claveSegura: true });
    c.setValue('frio2026');
    expect(c.errors).toBeNull();
  });

  it('coinciden y distintos comparan dos campos del grupo', () => {
    const g = new FormGroup(
      { actual: new FormControl('vieja123'), nueva: new FormControl('nueva123'), confirmar: new FormControl('otra1234') },
      { validators: [coinciden('nueva', 'confirmar'), distintos('nueva', 'actual')] },
    );
    expect(g.errors).toEqual({ noCoinciden: true });
    g.patchValue({ confirmar: 'nueva123' });
    expect(g.errors).toBeNull();
    g.patchValue({ nueva: 'vieja123', confirmar: 'vieja123' });
    expect(g.errors).toEqual({ iguales: true });
  });

  it('rangoValido exige mínimo < máximo solo si ambos están llenos', () => {
    const g = new FormGroup({ min: new FormControl<number | null>(8), max: new FormControl<number | null>(2) }, { validators: rangoValido('min', 'max', 'rangoTemperatura') });
    expect(g.errors).toEqual({ rangoTemperatura: true });
    g.patchValue({ max: null });
    expect(g.errors).toBeNull();
    g.patchValue({ max: 10 });
    expect(g.errors).toBeNull();
  });

  it('documentoPeruano valida DNI y RUC', () => {
    expect(new FormControl('1234567', documentoPeruano('DNI')).errors).toEqual({ dni: true });
    expect(new FormControl('45678912', documentoPeruano('DNI')).errors).toBeNull();
    expect(new FormControl('30100070970', documentoPeruano('RUC')).errors).toEqual({ ruc: true });
    expect(new FormControl('20100070970', documentoPeruano('RUC')).errors).toBeNull();
  });

  it('mensajeCampo solo habla de campos tocados', () => {
    const c = new FormControl('', [Validators.required]);
    expect(mensajeCampo(c, 'La contraseña')).toBeNull();
    c.markAsTouched();
    expect(mensajeCampo(c, 'La contraseña')).toBe('Completa este campo.');
    c.setValue('ab');
    c.setValidators([Validators.minLength(8)]);
    c.updateValueAndValidity();
    expect(mensajeCampo(c, 'La contraseña')).toBe('La contraseña debe tener al menos 8 caracteres.');
  });
});
