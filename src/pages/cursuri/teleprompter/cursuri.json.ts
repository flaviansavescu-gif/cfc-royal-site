// /cursuri/teleprompter/cursuri.json — programa pentru teleprompter:
// cursurile lectorilor care au versiune text (md), grupate pe lector.
// Consumat de js/platform.js din aplicația Sufler („Încarcă un curs”).
import type { APIRoute } from "astro";
import { LECTORI } from "../../../data/cursuri";

export const GET: APIRoute = () => {
  const lectori = LECTORI.map((l) => ({
    lector: l.nume,
    cursuri: l.materiale
      .filter((m) => m.md)
      .map((m) => ({ titlu: m.titlu.replace(/\s*\(PDF\)\s*$/i, ""), url: m.md })),
  })).filter((l) => l.cursuri.length > 0);

  return new Response(JSON.stringify({ lectori }), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
};
