import { obtineIndexCachedat } from "./index-cachedat.mjs";

let ok = 0, rau = 0;
const t = (n, c, info) => { if (c) { ok++; console.log("  ok  " + n); } else { rau++; console.log("  RAU " + n + (info ? " -> " + info : "")); } };

// Magazie falsă care respectă onlyIfNew / onlyIfMatch și dă un etag la fiecare scriere.
function magazie() {
  const m = new Map(); let seq = 0;
  return {
    async get(k) { return m.has(k) ? m.get(k).val : null; },
    async getWithMetadata(k) { return m.has(k) ? { data: m.get(k).val, etag: m.get(k).etag } : null; },
    async setJSON(k, val, opts = {}) {
      const cur = m.get(k);
      if (opts.onlyIfNew && cur) return { modified: false };
      if (opts.onlyIfMatch && (!cur || cur.etag !== opts.onlyIfMatch)) return { modified: false };
      const etag = "e" + (++seq);
      m.set(k, { val: JSON.parse(JSON.stringify(val)), etag });
      return { modified: true, etag };
    },
    async delete(k) { m.delete(k); },
    _m: m,
  };
}

const acumISO = () => new Date().toISOString();
const vechiISO = "1970-01-01T00:00:00.000Z";

await (async () => {
  // 1. Index proaspăt → nu reconstruiește.
  {
    const s = magazie(); let n = 0;
    await s.setJSON("idx", { generat: acumISO(), marca: "vechi" });
    const r = await obtineIndexCachedat(s, { cheie: "idx", ttlMs: 60000, construieste: async () => { n++; return { generat: acumISO(), marca: "nou" }; } });
    t("proaspăt: nu reconstruiește", n === 0 && r.marca === "vechi", "n=" + n);
  }

  // 2. Index lipsă → reconstruiește o dată și scrie.
  {
    const s = magazie(); let n = 0;
    const r = await obtineIndexCachedat(s, { cheie: "idx", ttlMs: 60000, construieste: async () => { n++; return { generat: acumISO(), marca: "nou" }; } });
    const scris = await s.get("idx");
    t("lipsă: reconstruiește o dată", n === 1 && r.marca === "nou" && scris?.marca === "nou", "n=" + n);
  }

  // 3. Index învechit + lacăt viu al altcuiva → servește copia veche, NU reconstruiește.
  {
    const s = magazie(); let n = 0;
    await s.setJSON("idx", { generat: vechiISO, marca: "vechi" });
    await s.setJSON("idx-lacat", { la: Date.now() });   // lacăt proaspăt, ținut de altcineva
    const r = await obtineIndexCachedat(s, { cheie: "idx", ttlMs: 1000, construieste: async () => { n++; return { generat: acumISO(), marca: "nou" }; } });
    t("învechit + lacăt viu: servește vechea, fără reconstrucție", n === 0 && r.marca === "vechi", "n=" + n);
  }

  // 4. Index învechit + fără lacăt → reconstruiește și eliberează lacătul.
  {
    const s = magazie(); let n = 0;
    await s.setJSON("idx", { generat: vechiISO, marca: "vechi" });
    const r = await obtineIndexCachedat(s, { cheie: "idx", ttlMs: 1000, construieste: async () => { n++; return { generat: acumISO(), marca: "nou" }; } });
    const lacat = await s.get("idx-lacat");
    t("învechit + fără lacăt: reconstruiește", n === 1 && r.marca === "nou", "n=" + n);
    t("lacătul e eliberat după reconstrucție", lacat === null);
  }

  console.log("\n" + ok + " ok, " + rau + " rău");
  if (rau) process.exit(1);
})();
