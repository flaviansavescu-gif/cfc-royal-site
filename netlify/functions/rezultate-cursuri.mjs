// rezultate-cursuri.mjs — registrul rezultatelor testelor (Școala de Arbitraj).
// POST { cod } -> lista completă a rezultatelor, DOAR cu codul de administrator
// (verificat prin SHA-256 pe server; amprenta de mai jos nu deschide nimic).
import { getStore } from "@netlify/blobs";
import { createHash } from "node:crypto";

const ADMIN_HASH = "66c260e81fd07dae6c76578609d8e4982cb92bd510a7fde396069de586bd2bfb";

export default async (req) => {
  if (req.method !== "POST")
    return new Response(JSON.stringify({ eroare: "Metodă nepermisă." }), { status: 405 });

  let cod = "";
  try {
    cod = (await req.json()).cod || "";
  } catch {}
  const hash = createHash("sha256").update(String(cod)).digest("hex");
  if (hash !== ADMIN_HASH)
    return new Response(JSON.stringify({ eroare: "Cod de administrator incorect." }), { status: 401 });

  const store = getStore("cursuri");
  const rezultate = (await store.get("rezultate", { type: "json" })) || [];
  // cele mai recente primele
  rezultate.sort((a, b) => (b.data || "").localeCompare(a.data || ""));
  return new Response(JSON.stringify({ rezultate }), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
};
