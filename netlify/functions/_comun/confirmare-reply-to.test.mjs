// confirmare-reply-to.test.mjs — confirmarea de înscriere pleacă de la cutia de buletin
// (newsletter@cfc-royal.ro, expeditor validat în Brevo), pe care n-o citește nimeni. Din
// 10.09.2026 poartă Reply-To către secretariat: când expozantul apasă „Răspunde" („am
// greșit clasa", „am plătit azi"), mesajul ajunge pe contact@cfc-royal.ro, nu în gol.
//   node --test netlify/functions/_comun/confirmare-reply-to.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const posta = readFileSync(new URL("./posta.mjs", import.meta.url), "utf8");
const inscriere = readFileSync(new URL("../inscriere-expo.mjs", import.meta.url), "utf8");

test("posta.mjs știe de Reply-To și îl pune în cererea Brevo", () => {
  assert.match(posta, /export async function trimite\(\{[^}]*raspundeLa[^}]*\}\)/);
  assert.ok(posta.includes("replyTo: { email: raspundeLa }"), "câmpul Brevo se numește replyTo");
});

test("confirmarea expozantului răspunde la secretariat", () => {
  const i = inscriere.indexOf("Înscriere primită —");
  assert.ok(i > 0, "e-mailul de confirmare există");
  const bloc = inscriere.slice(i, i + 600);
  assert.ok(bloc.includes('raspundeLa: "contact@cfc-royal.ro"'), "Reply-To pe confirmare");
});
