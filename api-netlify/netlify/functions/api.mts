// Función de Netlify que atiende toda la API REST de FrioTrack 360 (/api/*).
import type { Config } from "@netlify/functions";
import { manejar } from "../../src/app.ts";

export default async (req: Request) => manejar(req);

export const config: Config = {
  path: ["/api/*", "/api", "/"],
};
