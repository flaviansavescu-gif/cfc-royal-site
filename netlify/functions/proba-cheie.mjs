// =========================================================================
// proba-cheie.mjs — spune dacă cheia de API funcționează, FĂRĂ să o arate nimănui.
//
// DE CE EXISTĂ. Cheia se pune în Netlify de mâna omului și nu se mai poate citi înapoi —
// asta e bine. Dar atunci nimeni nu știe dacă a fost lipită întreagă, dacă a nimerit în
// spațiul de lucru cu plafon sau dacă are credit. Se afla abia la prima citire de acte,
// adică exact când registratura are treabă.
//
// CE NU ÎNTOARCE NICIODATĂ: cheia, nici măcar câteva caractere din ea. Nici în răspuns,
// nici în jurnale. O cheie „doar pe jumătate arătată" e tot o scurgere: îngustează
// căutarea pentru cine ar vrea s-o ghicească, și nu ajută cu nimic la depanare.
//
// CE ÎNTOARCE: dacă merge, ce model a răspuns, câte jetoane a costat cererea și cât face
// asta în bani. Iar dacă nu merge, motivul pe înțelesul omului, nu codul de eroare.
//
// PĂZITĂ CU SECRETUL, ca funcțiile de administrare: altfel oricine ar putea s-o apese la
// nesfârșit și să-ți cheltuie creditul cu firimituri.
//
//   POST { secret }  ->  { ok, model, jetoane, cost, mesaj }
// =========================================================================
import Anthropic from "@anthropic-ai/sdk";
import { secretEgal } from "./_comun/secret.mjs";

const json = (b, s = 200) =>
  new Response(JSON.stringify(b, null, 2), {
    status: s,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

// Prețul modelului, ca să spunem costul în bani, nu doar în jetoane.
const PRET = { intrare: 5 / 1_000_000, iesire: 25 / 1_000_000 };   // USD per jeton, Claude Opus 5

export default async (req) => {
  if (req.method !== "POST") return json({ eroare: "Folosește POST." }, 405);
  const body = await req.json().catch(() => null);
  if (!body || !secretEgal(body.secret, process.env.EXPO_SYNC_SECRET)) {
    return json({ eroare: "Neautorizat" }, 401);
  }

  const cheie = process.env.ANTHROPIC_API_KEY;
  if (!cheie) {
    return json({
      ok: false,
      mesaj: "Netlify nu are variabila ANTHROPIC_API_KEY pentru funcții. " +
        "Verifică numele (majuscule, liniuțe jos), că e bifat scope-ul Functions și că s-a făcut o publicare DUPĂ ce ai salvat-o.",
    }, 200);
  }

  const client = new Anthropic({ apiKey: cheie });

  try {
    const r = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 256,
      // Efort mic: proba n-are nimic de gândit, iar costul rămâne cât mai aproape de zero.
      output_config: { effort: "low" },
      messages: [{ role: "user", content: "Răspunde doar cu cuvântul: MERGE" }],
    });

    const text = (r.content || []).filter((b) => b.type === "text").map((b) => b.text).join("").trim();
    const jIn = r.usage?.input_tokens ?? 0;
    const jOut = r.usage?.output_tokens ?? 0;
    const cost = jIn * PRET.intrare + jOut * PRET.iesire;

    return json({
      ok: true,
      mesaj: "Cheia merge.",
      raspuns: text,
      model: r.model,
      jetoane: { intrare: jIn, iesire: jOut },
      cost: {
        usd: Number(cost.toFixed(6)),
        // Ca să se vadă ordinul de mărime, nu doar o cifră cu șase zecimale.
        explicatie: `~${(cost * 100).toFixed(3)} cenți pentru această cerere`,
      },
    });
  } catch (err) {
    // Motivul, spus omenește. Codul de eroare nu-i spune nimic celui care trebuie să repare.
    let mesaj;
    if (err instanceof Anthropic.AuthenticationError) {
      mesaj = "Cheia nu e recunoscută. Cel mai des: s-a lipit trunchiat, sau a fost ștearsă din Console. Fă alta și pune-o din nou.";
    } else if (err instanceof Anthropic.PermissionDeniedError) {
      mesaj = "Cheia e bună, dar nu are drept pe modelul cerut. Verifică spațiul de lucru în care ai creat-o.";
    } else if (err instanceof Anthropic.RateLimitError) {
      mesaj = "Prea multe cereri într-un interval scurt. Mai încearcă peste un minut.";
    } else if (err instanceof Anthropic.BadRequestError && /credit|balance|billing/i.test(err.message || "")) {
      mesaj = "Cheia e bună, dar contul n-are credit. Încarcă la Settings → Billing (minimul e 5 dolari).";
    } else if (err instanceof Anthropic.APIConnectionError) {
      mesaj = "N-am putut ajunge la API. Rețea sau pană de partea lor — mai încearcă.";
    } else {
      mesaj = "Cererea a căzut: " + (err?.message || String(err));
    }
    console.error("proba-cheie:", err?.message || err);   // în jurnal intră mesajul, NU cheia
    return json({ ok: false, mesaj }, 200);
  }
};
