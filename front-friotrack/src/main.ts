import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { cargarConfiguracion } from './app/core/config';

// La URL del backend se lee en tiempo de ejecución desde /config.json
// (en Docker se genera a partir de la variable de entorno API_URL).
cargarConfiguracion()
  .then(() => bootstrapApplication(App, appConfig))
  .catch((err) => console.error(err));
