// subscribe.mjs — abonarea la buletinul informativ al asociației, PASUL 1 din 2.
//
// Aici nu se mai abonează nimeni. Aici se CERE abonarea: se strânge bifa de acord, se
// verifică ritmul, se pune deoparte o cerere cu termen și se trimite un e-mail cu un link
// de confirmare. Adresa ajunge în lista de difuzare abia când proprietarul ei apasă acel
// link (vezi `buletin-confirma.mjs`).
//
// DE CE. Vechea versiune lua adresa din formular și o scria direct în lista Brevo. Trei
// urmări, toate rele: nicio bifă de acord (deci consimțământ discutabil), nicio dovadă că
// omul l-a dat, și — cel mai rău — oricine putea abona adresa altcuiva, care începea să
// primească mesaje pe care nu le ceruse. Vezi `_comun/buletin-acord.mjs` pentru regulă.
//
// POST (formular) { email, acord, redirect?, bot-field } -> 303 spre pagina de așteptare
import {
  magazie, TEXT_ACORD, VERSIUNE_ACORD, EMAIL_RE, normEmail,
  jetonNou, amprentaIp, cheieAsteptare, poateCere,
} from "./_comun/buletin-acord.mjs";
import { trimite, pagina, escapeHtml } from "./_comun/posta.mjs";

const SITE = "https://cfc-royal.ro";

export default async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  let params;
  try {
    params = new URLSearchParams(await req.text());
  } catch {
    params = new URLSearchParams();
  }

  const email = normEmail(params.get("email"));
  const acord = String(params.get("acord") || "").trim();
  const botField = params.get("bot-field") || ""; // honeypot anti-spam

  // Redirecționare DOAR către o cale internă. Fără filtru, `redirect` era o redirecționare
  // deschisă (open redirect): un link „de pe cfc-royal.ro" putea duce pe orice domeniu de
  // phishing. Acceptăm doar o cale care începe cu un singur „/" (respinge „//gazda",
  // „http:", „\\" și orice URL absolut); altfel, pagina de așteptare.
  // Curățăm întâi caracterele de control (CR/LF etc.), care altfel treceau de regex și
  // permiteau injecție în antetul Location; apoi plafonăm lungimea.
  const cerut = (params.get("redirect") || "").replace(/[\u0000-\u001f]/g, "").slice(0, 200);
  const caleOk = /^\/[^/\\]/.test(cerut) ? cerut : "/ro/newsletter-ok/";

  const inapoi = (motiv) => {
    const sep = caleOk.includes("?") ? "&" : "?";
    return new Response("", {
      status: 303,
      headers: { Location: motiv ? caleOk + sep + "e=" + encodeURIComponent(motiv) : caleOk },
    });
  };

  // Bot detectat (honeypot completat) — răspundem normal, dar nu facem nimic.
  if (botField) return inapoi();

  if (!EMAIL_RE.test(email)) return inapoi("adresa");

  // Bifa e obligatorie. Fără ea nu există consimțământ neechivoc, deci nu există temei.
  if (acord !== "da") return inapoi("acord");

  const s = magazie();
  const ip = amprentaIp(req);

  if (!(await poateCere(s, ip))) return inapoi("ritm");

  // Cererea, cu termen. Ține doar 48 de ore și se șterge la prima confirmare — deci
  // linkul nu poate fi refolosit, iar o adresă necontirmată nu rămâne nicăieri.
  const jeton = jetonNou();
  try {
    await s.setJSON(cheieAsteptare(jeton), {
      email,
      cerut: new Date().toISOString(),
      ip,
      text: TEXT_ACORD,
      versiune: VERSIUNE_ACORD,
    });
  } catch (err) {
    console.error("Cererea de abonare nu s-a putut păstra:", err);
    return inapoi("tehnic");
  }

  const link = `${SITE}/.netlify/functions/buletin-confirma?j=${jeton}`;
  await trimite({
    catre: email,
    subiect: "Confirmă abonarea la buletinul CFC-Royal",
    html: pagina(
      "Mai e un pas",
      "#1F4D3A",
      `<p>Cineva — sperăm că tu — a cerut ca buletinul informativ al Clubului Federal ` +
      `Chinologic Royal să ajungă la adresa <b>${escapeHtml(email)}</b>.</p>` +
      `<p>Ca să fim siguri că adresa îți aparține, te rugăm să confirmi:</p>` +
      `<p style="margin:22px 0"><a href="${link}" ` +
      `style="background:#1F4D3A;color:#fff;padding:12px 22px;border-radius:6px;` +
      `text-decoration:none;font-weight:600">Confirmă abonarea</a></p>` +
      `<p style="color:#666;font-size:13px">Ce ai bifat pe site: „${escapeHtml(TEXT_ACORD)}"</p>` +
      `<p style="color:#666;font-size:13px">Linkul e valabil 48 de ore. ` +
      `<b>Dacă nu tu ai cerut asta, nu apăsa nimic</b> — fără confirmare, adresa nu intră ` +
      `nicăieri și cererea se șterge singură.</p>`,
    ),
  });

  // Același răspuns și dacă e-mailul n-a plecat: pagina nu are voie să spună dacă o adresă
  // există sau nu la noi, iar omul are oricum ce face — să încerce din nou.
  return inapoi();
};
