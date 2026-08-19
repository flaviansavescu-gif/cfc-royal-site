// _harness.mjs — unelte MINIME pentru probe de comportament pe handlere reale (P2-5).
//
// NU e o probă (nu se termină în `.test.mjs`), deci runner-ul nu o rulează singură.
//
// Handlerele cheamă `getStore()` din `@netlify/blobs`, care are nevoie de rețea. Le izolăm
// cu `mock.module` (node:test) + o magazie în memorie. `mock.module` cere flag-ul
// `--experimental-test-module-mocks`; `bootstrapMockModule` re-execută procesul CU flag
// dacă lipsește, o SINGURĂ dată, iar dacă tot lipsește (Node prea vechi) semnalează „skip"
// ca suita să rămână verde oriunde. Nu e o suită E2E — sunt mocks minimale în jurul
// handlerului REAL, nu regexuri pe sursă.
import { mock } from "node:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

/**
 * Întoarce `true` dacă `mock.module` e disponibil (rulăm testele). Dacă nu, re-execută o
 * dată procesul cu flagul necesar și iese cu statusul copilului. Dacă nici după re-exec nu
 * există (Node fără suport), întoarce `false` => testele se sar, nu cad.
 */
export function bootstrapMockModule(testUrl) {
  if (typeof mock.module === "function") return true;
  if (process.env._REEXEC_MOCKS === "1") return false; // deja re-executat: nu se poate, sărim
  const r = spawnSync(
    process.execPath,
    ["--experimental-test-module-mocks", fileURLToPath(testUrl)],
    { stdio: "inherit", env: { ...process.env, _REEXEC_MOCKS: "1" } },
  );
  process.exit(r.status ?? 1);
}

/**
 * Magazie Netlify Blobs în memorie, cu exact API-ul folosit de handlere:
 * get / getWithMetadata / setJSON (onlyIfNew, onlyIfMatch) / set / delete / list(prefix).
 * `seed` = obiect { cheie: valoare } cu starea inițială.
 */
export function magazieFalsa(seed = {}) {
  const m = new Map(Object.entries(seed));
  const meta = new Map();
  const etag = (k) => "e:" + k + ":" + JSON.stringify(m.get(k));
  return {
    async get(key) { return m.has(key) ? m.get(key) : null; },
    async getWithMetadata(key) {
      if (!m.has(key)) return null;
      return { data: m.get(key), etag: etag(key), metadata: meta.get(key) || {} };
    },
    async setJSON(key, val, opts = {}) {
      if (opts.onlyIfNew && m.has(key)) return { modified: false };
      if (opts.onlyIfMatch && m.has(key) && opts.onlyIfMatch !== etag(key)) return { modified: false };
      m.set(key, val);
      return { modified: true };
    },
    async set(key, val, opts = {}) { m.set(key, val); if (opts.metadata) meta.set(key, opts.metadata); return {}; },
    async delete(key) { m.delete(key); },
    async list({ prefix = "" } = {}) {
      return { blobs: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })) };
    },
    _map: m,
  };
}

/** O cerere POST JSON către un handler (URL-ul e nefolosit de handlere, doar metoda + corpul). */
export const reqJSON = (body) =>
  new Request("https://cfc-royal.ro/.netlify/functions/proba", {
    method: "POST",
    headers: { "content-type": "application/json", "x-nf-client-connection-ip": "203.0.113.7" },
    body: JSON.stringify(body),
  });

/** Instalează mock-ul de `@netlify/blobs` care întoarce mereu magazia dată. */
export function mockBlobs(store) {
  // `namedExports` funcționează pe Node 22 (CI + Netlify) ȘI pe Node 24 (local). Opțiunea
  // mai nouă `exports` merge doar pe Node 24 — pe Node 22 nu expune `getStore` ca export
  // numit (SyntaxError). `namedExports` e depreciată pe 24, dar depreciat != scos; avertismentul
  // e cosmetic, iar compatibilitatea cu versiunea din CI/Netlify e ce contează.
  mock.module("@netlify/blobs", { namedExports: { getStore: () => store } });
}
