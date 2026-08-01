/**
 * Generează „Regulamentul de organizare a expozițiilor” ca document Word.
 *
 * Cel mai urgent dintre cele patru care lipsesc. Astăzi o asociație afiliată organizează
 * sub numele Clubului și sub egida World Dog Federation, încasează taxele în contul ei, și
 * nu există nicio hârtie între ea și Club.
 *
 * Regulile tehnice NU sunt inventate: cerințele pentru ringuri și dotare sunt cele pe care
 * delegatul WDF le verifică oricum înainte de începere (regulamentul „Rolul delegatului
 * WDF”), iar stările prin care trece o expoziție sunt cele din managerul de expoziții
 * (pregătire → înscrieri deschise → catalog închis → în desfășurare → finalizată →
 * arhivată). Textul le dă formă de normă și adaugă ce lipsea cu totul: banii, aprobarea,
 * răspunderea.
 *
 *   node scripts/documente/regulament-organizare-expozitii.cjs "cale/catre/iesire.docx"
 */
const S = require("./_sablon.cjs");
const { px, al, lit, gol, capitol, articol, H, caseta, tabel, semnaturi, VERDE, ROSU, AURIU } = S;

const doc = S.actDeSedinta({
  titlu: "REGULAMENTUL DE ORGANIZARE",
  titlu2: "A EXPOZIȚIILOR CANINE",
  subtitlu: "Expoziții sub egida Clubului Federal · proiect supus dezbaterii Consiliului Director",
  subsolText: "PROIECT — Regulamentul de organizare a expozițiilor",
  cuprins: [
    px("sub egida Clubului Federal Chinologic – Royal și a World Dog Federation",
      { align: S.AlignmentType.CENTER, size: 17 }),
    gol(220),

    caseta([
      [{ text: "DOCUMENT DE LUCRU, pentru dezbaterea Consiliului Director.", bold: true }],
      ["Locurile marcate cu ⟨…⟩ sunt hotărâri pe care le are de luat Consiliul. Sunt strânse în Anexa C."],
      [{ text: "Art. 30 privește direct expoziția de la Iași", bold: true },
       ", anunțată și cu înscrierile deschise înainte de acest regulament. Fără el, ea rămâne singura expoziție a Clubului fără nicio hârtie între Club și organizator."],
    ], ROSU, "FAF2F2"),

    // ═══ I ═══
    capitol("Capitolul I. Dispoziții generale"),

    articol(1, "Obiect"),
    al(1, "Prezentul Regulament stabilește condițiile în care se organizează expozițiile canine sub egida Asociației Club Federal Chinologic – Royal, drepturile și obligațiile organizatorului, precum și raporturile dintre acesta și Club."),
    al(2, "El nu înlocuiește regulamentele tehnice de arbitraj ale World Dog Federation, publicate de Club, ci le însoțește: acelea spun cum se judecă, acesta spune cine organizează, cu ce, pe ce bani și cu ce răspundere."),

    articol(2, "Cine poate organiza"),
    al(1, "Pot organiza expoziții sub egida Clubului:"),
    lit("a", "Clubul Federal însuși;"),
    lit("b", "Membrii Colectivi ai Clubului, în condițiile Acordului-cadru de colaborare încheiat cu fiecare dintre ei."),
    al(2, [{ text: "Nicio altă persoană sau entitate", bold: true }, " nu poate folosi numele, sigla sau egida Clubului pentru o expoziție canină."]),
    al(3, "O expoziție organizată de un Membru Colectiv aflat în suspendare potrivit Acordului-cadru nu poate purta egida Clubului."),

    articol(3, "Ce este o expoziție sub egida Clubului"),
    al(1, "Expoziția organizată potrivit prezentului Regulament este recunoscută de Club, iar titlurile acordate în ea intră în evidențele Clubului și se transmit World Dog Federation pentru recunoaștere internațională."),
    al(2, "Expoziția care nu îndeplinește condițiile de aici nu produce titluri recunoscute, indiferent de cine a arbitrat."),

    // ═══ II ═══
    capitol("Capitolul II. Aprobarea și calendarul"),

    articol(4, "Cererea de aprobare"),
    al(1, ["Organizatorul depune cererea la Club cu cel puțin ", H("T1"), " înainte de data propusă."]),
    al(2, "Cererea cuprinde: tipul expoziției (C.A.C. sau C.A.C.I.B.), denumirea propusă, data și locul, arbitrii propuși cu specializările lor, numărul estimat de exemplare, contul în care se încasează taxele și persoana de contact."),
    al(3, ["Consiliul Director se pronunță în cel mult ", H("T2"), " de la depunerea cererii complete."]),

    articol(5, "Calendarul competițional"),
    al(1, "Expozițiile aprobate se înscriu în calendarul competițional publicat pe site-ul Clubului."),
    al(2, "Calendarul se urmărește astfel încât două expoziții sub egida Clubului să nu se suprapună fără temei; suprapunerea se poate încuviința când distanța geografică sau specializarea o justifică."),
    al(3, "Data și locul se pot schimba numai cu încuviințarea Consiliului Director. Schimbarea se anunță public de îndată, iar celor înscriși li se aplică drepturile din Condițiile de participare."),

    articol(6, "Convenția de organizare"),
    al(1, [{ text: "Pentru fiecare expoziție se încheie o convenție scrisă între Club și organizator", bold: true }, ", înainte de deschiderea înscrierilor."]),
    al(2, "Convenția cuprinde cel puțin:"),
    gol(60),
    tabel(["Ce se scrie în convenție", "De ce"], [
      ["Data, locul și tipul expoziției", "identificarea evenimentului"],
      ["Arbitrii și repartizarea lor pe grupe/rase", "ei nu se pot schimba fără încuviințare"],
      ["Delegatul WDF și medicul veterinar", "oficialii cu competențe proprii"],
      ["Taxele și contul în care se încasează", "banii ajung la organizator; trebuie scris"],
      ["Cine suportă cheltuielile", "arbitri, sală, premii, tipărituri"],
      [["Cotele datorate Clubului și WDF"], "singura sursă de venit a Clubului din expoziție"],
      ["Termenul de trimitere a catalogului și rezultatelor", "fără ele, titlurile nu se pot înscrie"],
      ["Persoana care răspunde de organizare", "un nume, nu o asociație"],
    ], [4600, 4760]),
    gol(140),
    al(3, "Convenția se semnează de președinții celor două asociații sau de împuterniciții lor."),

    // ═══ III ═══
    capitol("Capitolul III. Pregătirea expoziției"),

    articol(7, "Arbitrii"),
    al(1, "Arbitrii se propun de organizator și se aprobă de Club, prin Vicepreședintele Tehnic și de Arbitraj."),
    al(2, "Pot arbitra numai arbitrii înscriși în Colegiul de Arbitri al Clubului sau arbitri străini recunoscuți de World Dog Federation, în limitele specializărilor lor."),
    al(3, [{ text: "Un arbitru nu poate judeca mai mult de 80 de exemplare într-o zi.", bold: true }, " Depășirea se poate încuviința numai de delegatul WDF, în scris, pentru situații neprevăzute."]),
    al(4, [{ text: "Conflictul de interese.", bold: true }, " Arbitrul nu judecă exemplare aflate în proprietatea sa, a soțului/soției sau a rudelor până la gradul al doilea, nici exemplare crescute de canisa proprie."]),
    al(5, "Arbitrii aprobați nu se pot schimba fără încuviințarea delegatului WDF."),

    articol(8, "Oficialii expoziției"),
    al(1, "La fiecare expoziție sunt prezenți, cu competențe distincte:"),
    lit("a", [{ text: "arbitrul", bold: true }, " — evaluează exemplarele și pronunță calificativele, descalificarea și neevaluarea;"]),
    lit("b", [{ text: "delegatul WDF", bold: true }, " — verifică organizarea înainte de începere, supraveghează arbitrajul, intervine în cazurile prevăzute de regulamentul propriu și raportează Federației;"]),
    lit("c", [{ text: "medicul veterinar", bold: true }, " — starea de sănătate a exemplarelor și situațiile sanitare."]),
    al(2, "Competențele lor nu se suprapun și niciunul nu poate lua hotărârile celuilalt."),

    articol(9, "Ringurile și dotarea"),
    al(1, "Organizatorul asigură ringuri care îndeplinesc cerințele World Dog Federation, verificate de delegat înainte de începere:"),
    lit("a", "suprafață plană și nealunecoasă; nu sunt îngăduite suprafețele în pantă, pietrișul și zonele alunecoase;"),
    lit("b", "dimensiuni potrivite raselor judecate în ele;"),
    lit("c", "delimitare limpede și spațiu pentru mișcarea în triunghi, cerc și linie dreaptă."),
    al(2, "În fiecare ring se află, obligatoriu: cinometru, ruletă și cititor de microcip."),
    al(3, ["Organizatorul asigură ", H("N1"), " și apă pentru exemplare, precum și un spațiu umbrit sau acoperit, când expoziția se ține în aer liber."]),

    articol(10, "Permanența"),
    al(1, ["Organizatorul asigură o permanență (secretariatul expoziției), deschisă cu cel puțin ", H("T3"), " înainte de începerea arbitrajului și până la încheierea ringului de onoare."]),
    al(2, "La permanență se primesc contestațiile, se lămuresc erorile de catalog și se predau documentele."),

    articol(11, "Comitetul de organizare"),
    al(1, "Organizatorul numește un comitet de organizare, din cel puțin trei persoane, dintre care una răspunde de bunul mers al evenimentului."),
    al(2, "Comitetul soluționează contestațiile procedurale și dispune măsurile din Condițiile de participare."),

    articol(12, "Anunțul public și înscrierile"),
    al(1, "Expoziția se anunță public cu datele complete: tipul, data, locul, arbitrii, taxele, termenul de înscriere cu ora, contul în care se plătesc taxele."),
    al(2, [{ text: "Înscrierile se fac prin sistemul Clubului", bold: true }, ", care ține evidența, calculează taxele după grila în vigoare și păstrează dovada acceptării Condițiilor de participare."]),
    al(3, "Termenul de înscriere este un moment, nu o zi. După el nu se mai primesc înscrieri și nu se mai schimbă datele exemplarelor."),

    articol(13, "Catalogul"),
    al(1, "După închiderea înscrierilor, organizatorul întocmește catalogul, cu numerotarea exemplarelor pe grupe și rase."),
    al(2, [{ text: "Catalogul se îngheață înainte de începerea arbitrajului.", bold: true }, " Din acel moment, datele exemplarelor nu se mai schimbă; îndreptările se fac prin însemnare separată, cu arătarea motivului."]),
    al(3, "Numărul de catalog al unui exemplar respins sau retras se eliberează și se poate da altuia numai înainte de înghețare."),

    // ═══ IV ═══
    capitol("Capitolul IV. Banii"),

    articol(14, "Taxele"),
    al(1, "Taxele de participare sunt cele din lista de tarife în vigoare a Clubului. Organizatorul nu poate cere alte sume și nu poate acorda alte reduceri decât cele prevăzute acolo."),
    al(2, [{ text: "Taxele se încasează în contul organizatorului", bold: true }, ", arătat în anunț și în formularul de înscriere."]),
    al(3, "Sumele încasate și cele rămase de încasat se țin în evidența expoziției."),

    articol(15, "Cheltuielile"),
    px("Organizatorul suportă cheltuielile expoziției: onorariile și deplasarea arbitrilor și a delegatului, sala și amenajarea ringurilor, medicul veterinar, premiile, tipăriturile și celelalte cheltuieli de organizare, dacă prin convenție nu s-a stabilit altfel."),

    articol(16, "Cotele datorate Clubului și Federației"),
    al(1, ["Organizatorul datorează Clubului ", H("C1"), " pentru fiecare exemplar înscris și prezentat."]),
    al(2, ["Cota datorată World Dog Federation este ", H("C2"), " și se virează prin Club, odată cu transmiterea rezultatelor."]),
    al(3, ["Cotele se achită în termen de ", H("T4"), " de la încheierea expoziției, odată cu decontul."]),

    articol(17, "Decontul"),
    al(1, ["În termen de ", H("T4"), " de la încheierea expoziției, organizatorul trimite Clubului un decont cuprinzând: numărul exemplarelor înscrise și prezentate, taxele încasate, cotele datorate și dovada plății lor."]),
    al(2, "Clubul poate cere lămuriri. Neplata cotelor sau netrimiterea decontului atrage măsurile de la Art. 27."),

    articol(18, "Premiile"),
    al(1, "Organizatorul asigură premiile anunțate. Ele nu se pot micșora după deschiderea înscrierilor."),
    al(2, ["Se acordă cel puțin: ", H("P1"), "."]),

    // ═══ V ═══
    capitol("Capitolul V. În ziua expoziției"),

    articol(19, "Desfășurarea"),
    al(1, "Arbitrajul se desfășoară după procedurile World Dog Federation publicate de Club."),
    al(2, "Ordinea intrării în ring, orele de începere pe ringuri și programul ringului de onoare se anunță public și se afișează la permanență."),
    al(3, "Se ține la vedere o evidență a mersului expoziției, cu rasa aflată în judecare pe fiecare ring."),

    articol(20, "Prezența și absența"),
    al(1, "Prezența se marchează în evidența expoziției."),
    al(2, "Exemplarul absent nu primește calificativ, nu intră în ringul de onoare și nu este cuprins în statistici; taxa nu se restituie."),

    articol(21, "Ringul de onoare"),
    al(1, "Ringul de onoare se ține la ora anunțată, după încheierea judecării pe rase."),
    al(2, "Câștigătorii care trebuie să se prezinte în ringul de onoare potrivit regulamentelor WDF sunt așteptați acolo; neprezentarea fără temei duce la pierderea locului."),

    articol(22, "Contestațiile"),
    px("Contestațiile se depun și se soluționează potrivit Condițiilor de participare și procedurii WDF a contestațiilor. Se contestă numai procedura, nu evaluarea tehnică a arbitrului."),

    // ═══ VI ═══
    capitol("Capitolul VI. După expoziție"),

    articol(23, "Rezultatele"),
    al(1, ["Organizatorul trimite Clubului, în cel mult ", H("T5"), " de la încheiere: catalogul închis, rezultatele complete pe rase și clase, titlurile acordate și lista descalificărilor și a neevaluărilor, cu motivele lor."]),
    al(2, [{ text: "Titlurile nu se înscriu în evidențele Clubului și nu se transmit Federației înainte de primirea rezultatelor complete.", bold: true }]),
    al(3, "Rezultatele se publică pe site-ul Clubului."),

    articol(24, "Certificatele și diplomele"),
    al(1, "Certificatele de titlu (CAJC, CAC, CACIB) și diplomele se eliberează după modelele Clubului."),
    al(2, "Ele se pot elibera în ziua expoziției sau ulterior, dar numai pe baza rezultatelor consemnate."),

    articol(25, "Raportul delegatului"),
    px("Delegatul WDF întocmește raportul propriu și îl trimite Federației și Clubului. Organizatorul îi pune la dispoziție datele cerute."),

    articol(26, "Arhivarea"),
    al(1, "Organizatorul păstrează documentele expoziției — catalogul, fișele de ring, contestațiile și soluțiile lor, decontul — și le pune la dispoziția Clubului la cerere."),
    al(2, ["Termenul de păstrare este de ", H("T6"), "."]),

    // ═══ VII ═══
    capitol("Capitolul VII. Nerespectarea regulamentului"),

    articol(27, "Măsuri"),
    al(1, "Pentru nerespectarea prezentului Regulament, Consiliul Director poate dispune, în ordinea gravității:"),
    lit("a", "atenționarea scrisă a organizatorului;"),
    lit("b", "condiționarea aprobării unei expoziții viitoare de îndeplinirea obligațiilor restante;"),
    lit("c", "refuzul aprobării expozițiilor organizatorului, pe o durată determinată;"),
    lit("d", "măsurile prevăzute în Acordul-cadru de colaborare încheiat cu Membrul Colectiv, când fapta o justifică."),
    al(2, [{ text: "Retragerea egidei pentru o expoziție deja anunțată", bold: true }, " se poate dispune numai pentru fapte care fac cu neputință recunoașterea rezultatelor, și numai dacă ", H("E1"), "."]),
    al(3, "Măsurile se iau după ce organizatorului i s-a comunicat în scris fapta și i s-a dat un termen de răspuns; hotărârea se motivează și se comunică."),

    articol(28, "Titlurile deja acordate"),
    px("Titlurile acordate într-o expoziție ținută cu respectarea procedurilor de arbitraj rămân valabile chiar dacă organizatorul a încălcat obligații administrative față de Club. Neplata unei cote nu se răsfrânge asupra expozanților."),

    // ═══ VIII ═══
    capitol("Capitolul VIII. Dispoziții finale"),

    articol(29, "Ce se aplică în completare"),
    px("Regulamentele tehnice WDF publicate de Club, Condițiile de participare la expoziții, Acordul-cadru de colaborare, lista de tarife în vigoare, Codul Etic și Procedura disciplinară."),

    articol(30, "Expozițiile deja anunțate"),
    al(1, [{ text: "Expozițiile anunțate public înainte de intrarea în vigoare a prezentului Regulament se duc la capăt după el", bold: true }, ", în măsura în care aceasta nu schimbă condițiile anunțate celor deja înscriși."]),
    al(2, ["Pentru ele se încheie convenția de la Art. 6 în termen de ", H("T7"), " de la adoptarea prezentului Regulament, chiar dacă înscrierile sunt deja deschise."]),
    al(3, "Cotele de la Art. 16 se datorează pentru aceste expoziții numai dacă au fost prevăzute în convenție."),

    articol(31, "Intrarea în vigoare"),
    al(1, ["Prezentul Regulament a fost aprobat prin Hotărârea Consiliului Director nr. ", H("H"), " din ", H("D"), "."]),
    al(2, "Se publică pe cfc-royal.ro."),

    // ═══ Anexe ═══
    capitol("Anexa A. Drumul unei expoziții"),
    px("Stările sunt cele prin care trece expoziția în evidența Clubului. Fiecare trecere are un temei în acest Regulament."),
    gol(),
    tabel(["Starea", "Ce s-a întâmplat", "Articolul"], [
      ["Pregătire", "cererea aprobată, convenția semnată", "Art. 4, 6"],
      ["Înscrieri deschise", "anunțul public făcut, formularul deschis", "Art. 12"],
      ["Catalog închis", "termenul a trecut, catalogul înghețat", "Art. 13"],
      ["În desfășurare", "ziua expoziției", "Art. 19–22"],
      ["Finalizată", "rezultatele trimise Clubului", "Art. 23"],
      ["Arhivată", "decontul plătit, documentele păstrate", "Art. 17, 26"],
    ], [2200, 5200, 1960]),

    capitol("Anexa B. Ce verifică delegatul înainte de începere"),
    px("Lista e luată din regulamentul „Rolul delegatului WDF”, publicat de Club. Organizatorul o are ca listă de pregătire, ca să nu afle în dimineața expoziției ce îi lipsește."),
    gol(),
    tabel(["Ce se verifică", "Cerința"], [
      ["Structura ringurilor", "delimitare limpede, spațiu de mișcare"],
      ["Dimensiunea ringurilor", "potrivită raselor judecate"],
      ["Suprafața", "plană, nealunecoasă; fără pantă, pietriș sau zone alunecoase"],
      ["Cinometru", "în fiecare ring"],
      ["Ruletă", "în fiecare ring"],
      ["Cititor de microcip", "în fiecare ring"],
      ["Arbitrii desemnați", "sunt cei aprobați; schimbările cer încuviințarea delegatului"],
    ], [3400, 5960]),

    capitol("Anexa C. Ce are de hotărât Consiliul Director"),
    tabel(["Marcaj", "Ce se hotărăște", "Propunerea redactorului"], [
      [[H("T1")], "Cu cât înainte se cere aprobarea", "90 de zile"],
      [[H("T2")], "Termenul de pronunțare asupra cererii", "30 de zile"],
      [[H("T3")], "Cu cât înainte se deschide permanența", "o oră înainte de începerea arbitrajului"],
      [[H("N1")], "Ce mai asigură organizatorul în incintă", "apă, spațiu umbrit, coșuri de gunoi, punct sanitar"],
      [[H("C1")], "Cota datorată Clubului, per exemplar", "de stabilit — e singurul venit al Clubului din expoziție"],
      [[H("C2")], "Cota datorată World Dog Federation", "de lămurit cu Federația; se trece cifra ei"],
      [[H("T4")], "Termenul decontului și al plății cotelor", "30 de zile de la încheiere"],
      [[H("P1")], "Premiile minime obligatorii", "cocardă și diplomă pentru fiecare calificativ; cupă pentru BOB și BIS"],
      [[H("T5")], "Termenul de trimitere a rezultatelor", "10 zile de la încheiere"],
      [[H("T6")], "Cât se păstrează documentele expoziției", "5 ani"],
      [[H("E1")], "Când se poate retrage egida unei expoziții anunțate", "numai înainte de deschiderea înscrierilor, sau cu restituirea integrală a taxelor"],
      [[H("T7")], "Termenul convenției pentru expozițiile deja anunțate", "15 zile de la adoptare"],
      [[H("H"), " ", H("D")], "Numărul și data hotărârii", "—"],
    ], [1400, 3600, 4360]),
    gol(200),

    caseta([
      [{ text: "Două lucruri de lămurit înainte de adoptare:", bold: true }],
      [{ text: "1. Cota Clubului (⟨C1⟩) este singura decizie cu adevărat grea din document. ", bold: true },
       "Prea mare, descurajează asociațiile afiliate să organizeze. Zero, și Clubul poartă numele, standardele și răspunderea fără niciun venit. Cifra trebuie hotărâtă cunoscând cheltuielile reale ale unei expoziții — iar Iași, pe 5 septembrie, e prima ocazie de a le vedea."],
      [{ text: "2. Cota WDF (⟨C2⟩) nu o pot afla eu. ", bold: true },
       "Se lămurește cu Federația și se trece cifra exactă; până atunci articolul rămâne fără conținut."],
    ], AURIU, "FDF8EC"),
    gol(220),

    semnaturi(),
  ],
});

S.scrie(doc, process.argv[2]);
