/**
 * Generează „Regulamentul Registrului Genealogic” ca document Word.
 *
 * DE CE STĂ SCRIPTUL ÎN DEPOZIT, NU DOCUMENTUL. Textul se schimbă (Consiliul amendează
 * articole, se completează locurile de hotărât). Ținut ca .docx, ar fi un fișier binar în
 * care nu se vede ce s-a schimbat de la o versiune la alta. Ținut aici, fiecare virgulă
 * mutată se vede în istoricul depozitului, iar Word-ul se face din nou într-o clipă.
 *
 * Regulile din text NU sunt inventate: sunt cele pe care le aplică astăzi programul
 * registrului. Acolo unde propun ALTCEVA decât face codul, e scris pe față în comentariu
 * și semnalat în raport.
 *
 *   node scripts/documente/regulament-registru-genealogic.cjs "cale/catre/iesire.docx"
 */
const S = require("./_sablon.cjs");
const { px, al, lit, gol, capitol, articol, H, caseta, tabel, semnaturi, VERDE, AURIU, ROSU, GRI } = S;

const doc = S.actDeSedinta({
  titlu: "REGULAMENTUL",
  titlu2: "REGISTRULUI GENEALOGIC",
  subtitlu: "Registrul Genealogic · proiect supus dezbaterii Consiliului Director",
  subsolText: "PROIECT — Regulamentul Registrului Genealogic",
  cuprins: [
    px("aliniat la standardele World Dog Federation", { align: S.AlignmentType.CENTER, size: 17 }),
    gol(220),

      caseta([
        [{ text: "DOCUMENT DE LUCRU, pentru dezbaterea Consiliului Director.", bold: true }],
        ["Locurile marcate cu \u27E8…\u27E9 sunt hotărâri pe care le are de luat Consiliul, nu omisiuni. Sunt strânse în Anexa B."],
        [{ text: "Regulile din text nu sunt inventate", bold: true }, ": sunt cele după care funcționează astăzi registrul. Textul le dă formă de normă. Un singur articol propune ALTCEVA decât se face acum — Art. 22 alin. (1) — și e însemnat ca atare."],
      ], ROSU, "FAF2F2"),

      // ═══ Capitolul I ═══
      capitol("Capitolul I. Dispoziții generale"),

      articol(1, "Obiect"),
      al(1, "Prezentul Regulament stabilește organizarea și funcționarea Registrului Genealogic al Asociației Club Federal Chinologic – Royal, condițiile de înregistrare a cuiburilor și de eliberare a certificatelor de origine."),
      al(2, "Registrul Genealogic este evidența oficială a exemplarelor înregistrate de Asociație, ținută pe suport electronic, cu asigurarea trasabilității fiecărei operațiuni."),

      articol(2, "Cadru normativ"),
      px("Standardele World Dog Federation, Statutul și Regulamentul intern de funcționare al Asociației, Regulamentul de înregistrare a caniselor și de rezervare a afixului, Codul Etic și Procedura disciplinară."),

      articol(3, "Definiții"),
      lit("a", [{ text: "Declarația de montă și fătare (DMF)", bold: true }, " — actul prin care crescătorul aduce la cunoștința Asociației monta și fătarea unui cuib;"]),
      lit("b", [{ text: "ascendența", bold: true }, " — cele 30 de poziții pe patru generații ale unui exemplar: 2 părinți, 4 bunici, 8 străbunici și 16 stră-străbunici;"]),
      lit("c", [{ text: "certificat de origine (pedigree)", bold: true }, " — actul eliberat de Asociație pentru un exemplar înregistrat;"]),
      lit("d", [{ text: "poziție cunoscută", bold: true }, " — poziția de ascendență pentru care se cunosc atât numele exemplarului, cât și numărul lui de înregistrare;"]),
      lit("e", [{ text: "registratura", bold: true }, " — structura care verifică dosarele, stabilește ascendența și pregătește eliberarea actelor."]),

      // ═══ Capitolul II ═══
      capitol("Capitolul II. Declarația de montă și fătare"),

      articol(4, "Cine depune și în ce termen"),
      al(1, "Declarația se depune de crescătorul titular al afixului, membru al Asociației, pentru fiecare cuib fătat."),
      al(2, [{ text: "Termenul de depunere este de 90 de zile de la data fătării.", bold: true }, " Declarația depusă după acest termen se primește numai cu aprobarea Consiliului Director, la cererea motivată a crescătorului."]),
      al(3, "Un cuib poate cuprinde cel mult 24 de pui declarați."),

      articol(5, "Piesele dosarului"),
      al(1, "Dosarul cuprinde:"),
      lit("a", "declarația completată, cu datele părinților, ale cuibului și ale puilor;"),
      lit("b", "certificatul de origine al masculului;"),
      lit("c", "certificatul de origine al femelei;"),
      lit("d", "dovada dreptului de montă al femelei;"),
      lit("e", "dovada plății tarifului."),
      al(2, "Piesele se depun în copie digitală lizibilă. Registratura poate cere lămuriri sau documentul în original."),
      al(3, "Identificarea exemplarelor se face prin microcip cu 15 cifre (ISO) sau, pentru exemplarele mai vechi, prin cip cu 10 cifre."),

      articol(6, "Confirmarea montei"),
      al(1, "Monta se confirmă de proprietarul masculului, printr-o solicitare trimisă pe adresa de e-mail declarată."),
      al(2, [{ text: "Solicitarea este valabilă 60 de zile.", bold: true }, " Ea se poate retrimite, iar adresa se poate îndrepta dacă a fost greșită."]),
      al(3, "Când confirmarea pe această cale nu e cu putință, registratura poate primi, în locul ei, dovada semnată pe hârtie a montei, care se depune la dosar."),
      al(4, "Fără confirmare sau fără dovada de la alin. (3), certificatele nu se eliberează."),

      articol(7, "Numărul de înregistrare al declarației"),
      al(1, "Fiecare declarație primește, la depunere, un număr unic de forma CFCR-DMF-⟨an⟩-⟨0001⟩, în ordinea depunerii, pe fiecare an calendaristic."),
      al(2, [{ text: "Numărul nu se reciclează niciodată.", bold: true }, " Singura excepție este ultimul număr dat în anul în curs, care poate fi luat înapoi dacă declarația se șterge înainte de a se fi construit ceva peste el."]),

      // ═══ Capitolul III ═══
      capitol("Capitolul III. Ascendența"),

      articol(8, "Stabilirea ascendenței"),
      al(1, "Ascendența se stabilește de registratură, pe patru generații, din certificatele de origine ale părinților depuse la dosar."),
      al(2, "Părinții se preiau din declarație; celelalte 28 de poziții se transcriu din actele lor de origine."),
      al(3, "O poziție necunoscută se lasă necompletată. Nu se completează nicio poziție din presupuneri, din asemănarea numelor sau din alte surse decât actele de origine."),

      articol(9, "Citirea automată a documentelor"),
      al(1, "Registratura se poate ajuta de citirea automată a certificatelor de origine ale părinților."),
      al(2, [{ text: "Citirea propune; hotărăște omul.", bold: true }, " Nicio valoare citită automat nu intră în registru fără verificarea și hotărârea registratorului."]),
      al(3, "Valorile pe care citirea le semnalează drept nesigure se verifică obligatoriu pe documentul original."),
      al(4, "Fiecare citire se consemnează în jurnalul de audit, cu dosarul, autorul și momentul."),

      // ═══ Capitolul IV ═══
      capitol("Capitolul IV. Tipurile de certificat"),

      articol(10, "Cele trei tipuri"),
      al(1, "Tipul certificatului nu se alege: se constată din ascendență, după numărul de poziții cunoscute."),
      gol(),
      tabel(["Tip", "Când se acordă", "Ce înseamnă"], [
        [[{ text: "A", bold: true, color: VERDE }], "toate cele 30 de poziții sunt cunoscute", "ascendență cunoscută în întregime"],
        [[{ text: "B", bold: true, color: AURIU }], "cel puțin una, dar nu toate", "ascendență cunoscută parțial"],
        [[{ text: "C", bold: true, color: GRI }], "nicio poziție cunoscută", "certificat de tipicitate de rasă"],
      ], [900, 4000, 4460]),
      gol(160),
      al(2, [{ text: "O poziție cu nume, dar fără număr de înregistrare, contează ca necunoscută.", bold: true }, " Numărul e cel care face poziția verificabilă de altcineva; numele singur nu se poate urmări în nicio evidență."]),

      articol(11, "Tipicitatea este alt traseu"),
      al(1, "Certificatul de tipicitate (Tip C) se acordă în urma evaluării exemplarului într-o expoziție, după conformitatea cu standardul rasei, fără declarație de montă și fătare."),
      al(2, [{ text: "Un pui provenit dintr-o declarație de montă și fătare nu poate primi niciodată certificat de tipicitate.", bold: true }, " Declarația însăși numește tatăl și mama; prin urmare puii sunt cel puțin Tip B, chiar dacă numerele de înregistrare ale părinților nu sunt încă trecute."]),
      al(3, "Un exemplar fără certificat de origine nu poate fi înregistrat pe altă cale decât cea a tipicității; reînscrierea lui urmează același traseu."),

      // ═══ Capitolul V ═══
      capitol("Capitolul V. Eliberarea certificatelor"),

      articol(12, "Numărul de cuib WDF"),
      al(1, "Fiecare cuib primește un număr unic de înregistrare în evidența World Dog Federation, atribuit o singură dată și nemodificabil."),
      al(2, [{ text: "Numerotarea continuă de la 76", bold: true }, ", ultimul cuib înregistrat pe hârtie înainte de registrul electronic."]),

      articol(13, "Seria certificatului"),
      al(1, "Fiecare certificat primește o serie unică de forma CFCR-P-⟨an⟩-⟨0001⟩, în ordinea eliberării, pe fiecare an calendaristic."),
      al(2, "Numărul individual WDF al exemplarului se atribuie de World Dog Federation și se trece în registru când este primit."),

      articol(14, "Înghețarea ascendenței"),
      al(1, [{ text: "Ascendența se îngheață în certificat la data eliberării.", bold: true }, " Dacă dosarul se îndreaptă mai târziu, actul aflat în mâna omului rămâne ce a fost înmânat, până la îndreptarea lui potrivit Art. 21."]),
      al(2, "Certificatul cuprinde tipul, seria, data eliberării, datele exemplarului, crescătorul, ascendența cunoscută și lista pozițiilor lipsă."),

      articol(15, "Termenul de eliberare"),
      px([{ text: "Certificatele se eliberează în cel mult ", }, H("T1"), " de la depunerea dosarului complet și confirmarea montei."]),

      articol(16, "Tarifele"),
      px("Tarifele sunt cele din lista în vigoare a Asociației, aprobată de Consiliul Director și publicată pe site."),

      // ═══ Capitolul VI ═══
      capitol("Capitolul VI. Îndreptarea și anularea"),

      articol(17, "Îndreptarea textului ascendenței"),
      al(1, "Când se constată o greșeală de transcriere într-un certificat eliberat, textul ascendenței se poate îndrepta."),
      al(2, [{ text: "Îndreptarea nu poate schimba tipul certificatului și nici numărul pozițiilor cunoscute.", bold: true }, " Dacă îndreptarea ar schimba clasa actului, nu este o îndreptare, ci o reemitere, și se face potrivit Art. 18."]),
      al(3, "Îndreptarea se face pentru tot cuibul deodată sau pentru niciun exemplar din el; actele unui cuib împart aceeași ascendență."),
      al(4, "Îndreptarea se consemnează în jurnal, cu arătarea fiecărui câmp schimbat, de la ce la ce."),

      articol(18, "Reemiterea"),
      al(1, "Când se constată că ascendența a fost stabilită greșit într-un mod care schimbă tipul certificatului, actul se reemite."),
      al(2, "Actul dinainte se anulează potrivit Art. 19, iar cel nou se eliberează cu serie nouă, cu arătarea actului pe care îl înlocuiește."),

      articol(19, "Anularea unui certificat"),
      al(1, "Un certificat eliberat se anulează când se constată că a fost obținut prin declararea de date neadevărate, când ascendența s-a dovedit alta, sau în celelalte cazuri prevăzute de regulamentele Asociației."),
      al(2, [{ text: "Certificatul nu se șterge și nu se rescrie.", bold: true }, " Un act eliberat există: e tipărit, e în mâna cuiva, poate fi arătat oricând. El se marchează anulat, cu motivul, data și autorul hotărârii."]),
      al(3, "Verificarea publică a actului — inclusiv prin codul QR de pe el — arată pe loc că actul este anulat."),

      articol(20, "Cine hotărăște anularea"),
      al(1, [{ text: "Anularea se hotărăște de Consiliul Director", bold: true }, ", la propunerea motivată a registraturii, și se operează în registru de administrator."]),
      al(2, ["Măsura se ia numai după ce deținătorului actului i s-a comunicat în scris fapta constatată și i s-a dat un termen de cel puțin ", H("T2"), " zile ca să răspundă."]),
      al(3, ["Hotărârea se motivează în scris și se comunică deținătorului. Împotriva ei se poate face plângere la Consiliul Director, o singură dată, în termen de ", H("T3"), " zile."]),
      caseta([[{ text: "Singurul articol care propune altceva decât se face astăzi. ", bold: true },
        { text: "Programul îngăduie astăzi anularea de către administrator, singur. Tehnic e bine păzit — cere motiv scris și lasă urmă în jurnal — dar un act aflat în mâna unui om nu se desființează prin apăsarea unui buton. Programul rămâne neschimbat: administratorul doar nu apasă înainte de hotărâre.", italics: true }]], AURIU, "FDF8EC"),

      articol(21, "Efectele anulării"),
      al(1, ["Titlurile și rezultatele obținute de exemplar pe baza actului anulat ", H("E1"), "."]),
      al(2, "Descendenții exemplarului nu își pierd actele; ascendența lor se îndreaptă potrivit Art. 17, iar unde îndreptarea ar schimba clasa actului se face reemiterea."),

      // ═══ Capitolul VII ═══
      capitol("Capitolul VII. Publicitate, evidență, păstrare"),

      articol(22, "Ce este public"),
      al(1, "Oricine poate verifica un certificat după seria lui sau prin codul QR de pe act."),
      al(2, [{ text: "Verificarea publică arată numai datele exemplarului", bold: true }, " — nume, rasă, sex, data nașterii, microcip, tipul și seria actului, numărul WDF și dacă actul e anulat. ", { text: "Numele și adresa proprietarului nu se arată", bold: true }, "."]),

      articol(23, "Jurnalul de audit"),
      al(1, "Fiecare faptă a registrului — depunerea, respingerea, atribuirea numărului WDF, eliberarea, îndreptarea, anularea, citirea automată a documentelor — se consemnează în jurnal, cu autorul, obiectul și momentul."),
      al(2, [{ text: "Urma se scrie înaintea faptei.", bold: true }, " Dacă urma nu se poate consemna, fapta nu se săvârșește."]),

      articol(24, "Păstrarea și copiile de siguranță"),
      al(1, "Registrul se păstrează pe durată nedeterminată: un certificat eliberat produce efecte cât trăiește exemplarul și după, prin descendenții lui."),
      al(2, ["Piesele depuse la dosar se păstrează ", H("T4"), " de la eliberarea actelor."]),
      al(3, "Se fac copii de siguranță periodice, cifrate, păstrate separat de sistemul care ține registrul."),

      // ═══ Capitolul VIII ═══
      capitol("Capitolul VIII. Dispoziții finale"),

      articol(25, "Actele eliberate pe hârtie"),
      al(1, "Certificatele eliberate înainte de intrarea în funcțiune a registrului electronic rămân valabile."),
      al(2, "Aducerea lor în registrul electronic se face pe baza dosarelor de hârtie, cu însemnarea că provin din arhivă, și nu schimbă nimic din ce a fost eliberat."),

      articol(26, "Intrarea în vigoare"),
      al(1, ["Prezentul Regulament a fost aprobat prin Hotărârea Consiliului Director nr. ", H("H"), " din ", H("D"), " și ratificat de Adunarea Generală în data de ", H("D2"), "."]),
      al(2, "Se publică pe cfc-royal.ro."),

      // ═══ Anexe ═══
      capitol("Anexa A. Cele 30 de poziții ale ascendenței"),
      px("Codul fiecărei poziții e drumul de la exemplar în sus: T = tatăl, M = mama. Astfel „TM” e mama tatălui, iar „TMT” e tatăl mamei tatălui."),
      gol(),
      tabel(["Generația", "Câte", "Coduri"], [
        ["I — părinții", "2", "T, M"],
        ["II — bunicii", "4", "TT, TM, MT, MM"],
        ["III — străbunicii", "8", "TTT, TTM, TMT, TMM, MTT, MTM, MMT, MMM"],
        ["IV — stră-străbunicii", "16", "TTTT … MMMM"],
      ], [2600, 900, 5860]),

      capitol("Anexa B. Ce are de hotărât Consiliul Director"),
      tabel(["Marcaj", "Ce se hotărăște", "Propunerea redactorului"], [
        [[H("T1")], "Termenul de eliberare a certificatelor", "30 de zile de la dosarul complet"],
        [[H("T2"), " ", H("T3")], "Termen de răspuns / de plângere, la anulare", "10 zile / 15 zile"],
        [[H("E1")], "Ce se întâmplă cu titlurile obținute cu un act anulat", "se retrag, dacă anularea s-a făcut pentru date neadevărate; se păstrează, dacă a fost o greșeală a registraturii"],
        [[H("T4")], "Cât se păstrează piesele depuse la dosar", "10 ani"],
        [[H("H"), " ", H("D"), " ", H("D2")], "Numărul, data hotărârii și data ratificării", "—"],
      ], [1500, 3500, 4360]),
      gol(200),

      px([{ text: "Un lucru de lămurit înainte de adoptare: ", bold: true },
        "Art. 4 alin. (2) spune că declarația depusă peste 90 de zile se primește cu aprobarea Consiliului Director. Astăzi programul nu oprește o declarație întârziată. Dacă rămâne așa în regulament, trebuie adăugată oprirea; dacă nu, articolul trebuie scris altfel."],
        { after: 200 }),
      semnaturi(),
  ],
});

S.scrie(doc, process.argv[2]);
