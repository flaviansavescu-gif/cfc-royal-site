// progres-cursuri.mjs — progresul PERSONAL al unui candidat (per cod individual).
// POST { id: <codul candidatului> } -> { "modul-1": { procent, promovat, data }, ... }
// M1: câmpul `id` poartă acum CODUL candidatului, nu insigna (care ajungea la lectori).
// Serverul calculează insigna: id_intern = sha256(cod). Cheia rămâne progres/<insignă>/<modul>
// (scrisă de test-modul.mjs). Aici le adunăm într-un singur obiect pentru tablou.
import { getStore } from "@netlify/blobs";
import { sha256 } from "./_comun/roluri.mjs";
import { cuLimitareCod } from "./_comun/limitare.mjs";
import { json } from "./_comun/raspuns.mjs";

// Codul candidatului (câmpul `id`) se poate ghici — limităm, ca „{}" vs progres real să
// nu fie un oracol de validare a codurilor.
export default cuLimitareCod(async (req) => {
  if (req.method !== "POST") return json({ eroare: "Metodă nepermisă." }, 405);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ eroare: "Cerere invalidă." }, 400);
  }

  const cod = String(body.id || "").trim();
  const id = cod ? sha256(cod) : "";
  if (!id) return json({});

  // Cod NECUNOSCUT => 401, nu 200 cu obiect gol. Un 200 la un cod inexistent făcea din
  // funcția asta un poligon de ghicit fără penalizare (eșecurile nu se numărau) — și,
  // până azi, ștergea și contorul celorlalte porți. Acum ghicitul se plătește.
  const store = getStore("cursuri");
  const cand = await store.get("candidat/" + id, { type: "json" }).catch(() => null);
  if (!cand) return json({ eroare: "Cod necunoscut." }, 401);

  const out = {};
  try {
    const prefix = "progres/" + id + "/";
    const { blobs } = await store.list({ prefix });
    for (const b of blobs) {
      const r = await store.get(b.key, { type: "json" });
      if (r) out[b.key.slice(prefix.length)] = r;
    }
  } catch (err) {
    console.error("Citire progres eșuată:", err);
  }
  return json(out);
});
