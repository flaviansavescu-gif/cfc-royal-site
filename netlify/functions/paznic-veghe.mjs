// =========================================================================
// paznic-veghe.mjs — paznicul de intruziune, treaz la fiecare jumătate de oră.
//
// Face trei lucruri, în ordinea asta:
//   1. se uită înapoi peste ultimele trei ore și JUDECĂ tiparul (vezi `_comun/paznic.mjs`);
//   2. dacă e cazul, scrie o scrisoare — și tace dacă a scris-o deja;
//   3. lunea, la ora 8 dimineața, trimite raportul săptămânal, chiar dacă n-a fost nimic.
//
// DE CE RAPORTUL DE LUNI, CHIAR CÂND E LINIȘTE. Două motive, amândouă practice. Întâi,
// un e-mail previzibil te învață cum arată normalul, așa încât unul altfel să se vadă din
// prima linie. Al doilea e mai important: rezolvă problema paznicului mort. Dacă raportul
// nu ajunge luni, tăcerea devine ea însăși un semnal — altfel un paznic căzut ar arăta
// exact ca un paznic mulțumit.
//
// DE CE NU BLOCHEAZĂ NIMIC. Hotărâre luată în cunoștință de cauză: o adresă IP e împărțită
// de tot blocul, de toată școala sau de toți abonații unui operator mobil. O blocare
// automată ar putea închide pe dinafară exact oamenii asociației, în ziua expoziției.
// Blocarea rămâne cea generoasă din zidul anti-ghicire; paznicul doar POVESTEȘTE.
//
// Variabile de mediu: ALERTE_EMAIL, BREVO_API_KEY (aceleași ca la paznicul de disponibilitate).
// =========================================================================
import { getStore } from "@netlify/blobs";
import { trimite, pagina, escapeHtml, ADRESA_ASOCIATIEI } from "./_comun/posta.mjs";
import {
  strange, strangeZile, judeca, meritaSunat, momentLocal, oraLocala, eLuni,
  ORE_VEGHE, RETENTIE_ZILE,
} from "./_comun/paznic.mjs";

const magazie = () => getStore("acces");
const CHEIE_STARE = "paznic-stare";
const CHEIE_RAPORT = "paznic-ultimul-raport";

import { json } from "./_comun/raspuns.mjs";

const nr = (n) => new Intl.NumberFormat("ro-RO").format(n);
const cifra = (t) => `<span style="font-variant-numeric:tabular-nums">${t}</span>`;
const PANOU = "https://cfc-royal.ro/registru/admin/paznic/";
const SEMNATURA =
  `<p style="border-top:1px solid #ddd;padding-top:12px;margin-top:22px;color:#888;font-size:13px">` +
  `Paznicul de intruziune · Club Federal Chinologic Royal<br />` +
  `Toate încercările, pe larg: <a href="${PANOU}">cfc-royal.ro/registru/admin/paznic</a></p>`;

// ——————————————————————— Scrisorile ———————————————————————

/** Alarmă: val susținut, de la adrese rotite. */
function scrisoareAlarma(v, f) {
  const usi = Object.entries(f.peUsa).sort((a, b) => b[1] - a[1]).slice(0, 3);
  return {
    subiect: `ALARMĂ — încercări susținute la ${v.usa}`,
    html: pagina(
      "Cineva încearcă serios, chiar acum",
      "#8C1D2F",
      `<p style="font-size:17px;font-weight:600;color:#8C1D2F;margin:0 0 14px">` +
        `Nimeni n-a intrat. Dar cineva încearcă serios, chiar acum.</p>` +
      `<p>În ultimele ${ORE_VEGHE} ore au venit ${cifra(nr(f.refuzuri))} de încercări de cod, ` +
        `de la ${cifra(nr(f.urme.size))} adrese diferite.` +
        (f.trunchiat ? " (Numărul încercărilor e estimat — au fost prea multe ca să le număr pe toate.)" : "") +
        `</p>` +
      `<p>Atâtea adrese diferite într-un timp atât de scurt nu înseamnă atâția oameni: ` +
        `e o unealtă care își schimbă adresa ca să nu fie blocată.</p>` +
      `<p style="color:#666;font-size:13px;text-transform:uppercase;letter-spacing:.08em;margin:20px 0 6px">Unde s-a bătut</p>` +
      `<ul style="margin:0;padding-left:20px">` +
        usi.map(([u, n]) => `<li>${escapeHtml(u)} — ${cifra(nr(n))} încercări</li>`).join("") +
      `</ul>` +
      `<p style="color:#666;font-size:13px;text-transform:uppercase;letter-spacing:.08em;margin:20px 0 6px">Cât de aproape a ajuns</p>` +
      `<p>Niciuna n-a nimerit. Codurile au opt caractere din treizeci și unu posibile — ` +
        `852 de miliarde de variante. Chiar și cu adresele rotite, la ritmul de acum ar dura ` +
        `mii de ani. Nu e o cursă pe care o poate câștiga.</p>` +
      `<p style="color:#666;font-size:13px;text-transform:uppercase;letter-spacing:.08em;margin:20px 0 6px">Ce lucrează deja</p>` +
      `<ul style="margin:0;padding-left:20px">` +
        `<li>fiecare adresă e blocată automat după douăzeci de încercări greșite;</li>` +
        `<li>codurile nu se păstrează nicăieri în clar — nici dacă ar intra n-ar găsi altele;</li>` +
        `<li>administrarea cere, pe lângă cod, și un dispozitiv recunoscut.</li>` +
      `</ul>` +
      `<p style="color:#666;font-size:13px;text-transform:uppercase;letter-spacing:.08em;margin:20px 0 6px">Ce ți-aș propune</p>` +
      `<ul style="margin:0;padding-left:20px">` +
        `<li><b>Cel mai probabil: nimic.</b> Astfel de valuri se opresc singure în câteva ore.</li>` +
        `<li>Dacă ține peste o zi — punem Cloudflare în fața domeniului și se termină la poartă.</li>` +
        `<li>Dacă ai un cod scris undeva unde l-a văzut cineva, schimbă-l azi.</li>` +
      `</ul>` +
      `<p style="color:#888;font-size:13px;margin-top:18px">Îți scriu din nou doar dacă situația ` +
        `se schimbă — nu la fiecare jumătate de oră.</p>` +
      SEMNATURA,
    ),
  };
}

/** Semnal: cineva a bătut la uși fără legătură între ele. */
function scrisoareSemnal(v, f) {
  const d = f.peUrma[v.urma] || { n: 0, usi: new Set() };
  const usi = [...(d.usi || [])];
  return {
    subiect: "Cineva a încercat mai multe uși",
    html: pagina(
      "Cineva a încercat mai multe uși",
      "#A9611B",
      `<p style="font-size:17px;font-weight:600;color:#1F4D3A;margin:0 0 14px">` +
        `Nimeni n-a intrat. Îți scriu fiindcă tiparul nu seamănă cu o greșeală.</p>` +
      `<p>În ultimele ${ORE_VEGHE} ore, același vizitator a bătut la ` +
        `${cifra(usi.length)} uși diferite, cu ${cifra(nr(d.n))} coduri greșite în total:</p>` +
      `<ul style="margin:0;padding-left:20px">` +
        usi.map((u) => `<li>${escapeHtml(u.replace(/-/g, " "))}</li>`).join("") +
      `</ul>` +
      `<p>Toate au fost refuzate, iar zidul l-a blocat automat după douăzeci de încercări.</p>` +
      `<p style="color:#666;font-size:13px;text-transform:uppercase;letter-spacing:.08em;margin:20px 0 6px">De ce ți-o spun</p>` +
      `<p>Un om care și-a uitat codul încearcă la <i>o singură</i> ușă, de două-trei ori, și ` +
        `apoi sună la secretariat. Cine încearcă la mai multe uși care n-au nicio legătură ` +
        `între ele nu-și amintește ceva — caută ceva.</p>` +
      `<p style="color:#666;font-size:13px;text-transform:uppercase;letter-spacing:.08em;margin:20px 0 6px">Ce ai de făcut</p>` +
      `<p><b>Deocamdată nimic.</b> Nu s-a pierdut nimic și apărarea a lucrat cum trebuie. ` +
        `Dacă vezi același lucru și mâine, spune-mi: atunci merită strânse pragurile pentru ` +
        `câteva zile.</p>` +
      SEMNATURA,
    ),
  };
}

/** Raportul de luni: cum a arătat săptămâna. */
function scrisoareRaport(f, acum) {
  const usi = Object.entries(f.peUsa).sort((a, b) => b[1] - a[1]);
  const liniste = f.refuzuri === 0;
  return {
    subiect: liniste ? "Săptămâna trecută: liniște" : "Raportul săptămânal al paznicului",
    html: pagina(
      liniste ? "Nimic de semnalat" : "Raportul săptămânii",
      "#1F4D3A",
      `<p style="font-size:17px;font-weight:600;color:#1F4D3A;margin:0 0 14px">` +
        (liniste
          ? "Nimic de semnalat. Nu ai nimic de făcut."
          : "Nimeni n-a intrat. Mai jos, ce s-a văzut.") +
        `</p>` +
      `<p>Săptămâna trecută ${liniste
        ? "nu s-a apropiat nimeni de uși într-un fel care să semene cu o încercare de intrare"
        : "au fost câteva coduri greșite, toate în tiparul obișnuit al greșelilor de tastare"}. ` +
        `Îți scriu oricum, o dată pe săptămână, ca să știi că paznicul e treaz — un paznic care ` +
        `tace și când e stricat nu folosește la nimic.</p>` +
      (usi.length
        ? `<p style="color:#666;font-size:13px;text-transform:uppercase;letter-spacing:.08em;margin:20px 0 6px">Ce s-a văzut, totuși</p>` +
          `<table style="border-collapse:collapse;font-size:14px">` +
          `<tr style="color:#888;font-size:12px;text-transform:uppercase">` +
            `<th style="text-align:left;padding:4px 18px 4px 0">Ușa</th>` +
            `<th style="text-align:right;padding:4px 0">Coduri greșite</th></tr>` +
          usi.map(([u, n]) =>
            `<tr><td style="padding:4px 18px 4px 0;border-top:1px solid #eee">${escapeHtml(u.replace(/-/g, " "))}</td>` +
            `<td style="padding:4px 0;border-top:1px solid #eee;text-align:right">${cifra(nr(n))}</td></tr>`,
          ).join("") +
          `</table>` +
          `<p style="color:#888;font-size:13px">De la ${cifra(nr(f.urme.size))} vizitatori diferiți. ` +
          `Nicio adresă n-a fost blocată mai mult decât cele cinci minute obișnuite.</p>`
        : "") +
      `<p style="border-top:1px solid #ddd;padding-top:12px;margin-top:22px;color:#888;font-size:13px">` +
        `Paznicul de intruziune · Club Federal Chinologic Royal<br />` +
        `Următorul raport: peste o săptămână. Dacă nu ajunge, ceva s-a stricat la paznic.</p>`,
    ),
  };
}

// ——————————————————————— Curățenia ———————————————————————

/** Șterge memoria mai veche de termen. Listează TOATE însemnările și șterge după data din
 *  cheie (`paznic/AAAA-LL-ZZ-HH/…`) — așa o rulare de 04:00 RATATĂ nu lasă orfani permanenți.
 *  (Varianta veche ștergea o SINGURĂ zi pe rulare, deci o zi sărită rămânea pe veci.) */
async function curata(s, acum) {
  const limita = new Date(acum.getTime() - RETENTIE_ZILE * 24 * 3600e3).toISOString().slice(0, 10);
  let sterse = 0;
  try {
    const { blobs } = await s.list({ prefix: "paznic/" });
    for (const b of blobs) {
      const zi = b.key.slice("paznic/".length, "paznic/".length + 10); // AAAA-LL-ZZ
      if (/^\d{4}-\d{2}-\d{2}$/.test(zi) && zi <= limita) { await s.delete(b.key); sterse++; }
    }
  } catch (err) { console.error("Curățenia paznicului:", err); }
  return sterse;
}

// ——————————————————————— Veghea ———————————————————————

import { bateInima } from "./_comun/inima.mjs";
export default async () => {
  await bateInima("paznic-veghe"); // paznicul paznicilor: tăcerea peste prag sună alarma din GitHub Actions
  const acum = new Date();
  const s = magazie();

  const f = await strange(s, ORE_VEGHE, acum);
  const verdict = judeca(f);

  let veche = null;
  try { veche = await s.get(CHEIE_STARE, { type: "json" }); } catch (err) { console.error(err); }

  let trimis = null;
  if (meritaSunat(verdict, veche, acum)) {
    const scrisoare = verdict.stare === "alarma" ? scrisoareAlarma(verdict, f) : scrisoareSemnal(verdict, f);
    const ok = await trimite({ catre: ADRESA_ASOCIATIEI, ...scrisoare });
    trimis = ok ? verdict.stare : "eșuat";
    try {
      await s.setJSON(CHEIE_STARE, { stare: verdict.stare, usa: verdict.usa || null, la: acum.toISOString() });
    } catch (err) { console.error(err); }
  } else if (verdict.stare === "liniste" && veche) {
    // S-a liniștit: uităm, ca următorul val să sune din nou.
    try { await s.delete(CHEIE_STARE); } catch (err) { console.error(err); }
  }

  // ——— Raportul de luni, o singură dată ———
  let raport = null;
  if (eLuni(acum) && oraLocala(acum) === 8) {
    const azi = acum.toISOString().slice(0, 10);
    let ultimul = null;
    try { ultimul = await s.get(CHEIE_RAPORT, { type: "json" }); } catch (err) { console.error(err); }
    if (ultimul?.zi !== azi) {
      const saptamana = await strangeZile(s, 7, acum);
      const ok = await trimite({ catre: ADRESA_ASOCIATIEI, ...scrisoareRaport(saptamana, acum) });
      raport = ok ? "trimis" : "eșuat";
      try { await s.setJSON(CHEIE_RAPORT, { zi: azi, la: acum.toISOString() }); } catch (err) { console.error(err); }
    }
  }

  // ——— Curățenia, o dată pe zi, la ora la care nu e nimeni ———
  let sterse = 0;
  if (oraLocala(acum) === 4) sterse = await curata(s, acum);

  return json({
    ok: true,
    la: momentLocal(acum),
    verdict: verdict.stare,
    motiv: verdict.motiv,
    refuzuri: f.refuzuri,
    urme: f.urme.size,
    trimis,
    raport,
    sterse,
  });
};

// La fiecare jumătate de oră. Destul de des ca un val de câteva ore să fie prins din
// primele minute, destul de rar cât să nu coste nimic în restul anului.
export const config = { schedule: "*/30 * * * *" };
