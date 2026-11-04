import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { nombreMarca } from './config';

/** Título de la pestaña: "<página> · <marca>". */
@Injectable({ providedIn: 'root' })
export class TituloConMarca extends TitleStrategy {
  private title = inject(Title);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const pagina = this.buildTitle(snapshot);
    this.title.setTitle(pagina ? `${pagina} · ${nombreMarca()}` : nombreMarca());
  }
}
