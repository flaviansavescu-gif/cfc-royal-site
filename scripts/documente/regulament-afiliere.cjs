/**
 * Generează „Regulamentul de afiliere a asociațiilor” ca document Word.
 *
 * Astăzi Clubul are cinci organisme afiliate și niciun document care să spună cum se
 * afiliază cineva, ce datorează după și cum se desface legătura. Pagina „Despre” vorbește
 * de o rețea națională de asociații afiliate ca de un obiectiv — dar un obiectiv nu leagă
 * pe nimeni de nimic.
 *
 * Datele cerute la Art. 6 sunt exact cele ținute astăzi pe fișa fiecărei asociații de pe
 * site (`src/content/organizatii-afiliate/`) și în registrul de organizatori al
 * managerului de expoziții. Regulamentul nu inventează o evidență nouă: îi dă temei celei
 * care există.
 *
 *   node scripts/documente/regulament-afiliere.cjs "cale/catre/iesire.docx"
 */
const S = require("./_sablon.cjs");
const { px, al, lit, gol, capitol, articol, H, caseta, tabel, semnaturi, AURIU, ROSU } = S;

const doc = S.actDeSedinta({
  titlu: "REGULAMENTUL DE AFILIERE",
  titlu2: "A ASOCIAȚIILOR CHINOLOGICE",
  subtitlu: "Rețeaua asociațiilor afiliate · proiect supus dezbaterii Consiliului Director",
  subsolText: "PROIECT — Regulamentul de afiliere a asociațiilor",
  cuprins: [
    px("aliniat la standardele World Dog Federation", { align: S.AlignmentType.CENTER, size: 17 }),
    gol(220),

    caseta([
      [{ text: "DOCUMENT DE LUCRU, pentru dezbaterea Consiliului Director.", bold: true }],
      ["Locurile marcate cu ⟨…⟩ sunt hotărâri pe care le are de luat Consiliul, nu omisiuni. Sunt strânse în Anexa B."],
      [{ text: "Un articol are urmări imediate", bold: true },
       ": Art. 11 alin. (2) dă temei convenției scrise pentru fiecare expoziție, până când se adoptă regulamentul de organizare a expozițiilor. E singurul mijloc prin care expoziția de la Iași, din 5 septembrie, are o hârtie între Club și organizator."],
    ], ROSU, "FAF2F2"),

    // ═══ I ═══
    capitol("Capitolul I. Dispoziții generale"),

    articol(1, "Obiect"),
    al(1, "Prezentul Regulament stabilește condițiile și procedura prin care o asociație chinologică se afiliază Asociației Club Federal Chinologic – Royal, drepturile și obligațiile care decurg din afiliere, precum și cazurile de suspendare și de retragere a acesteia."),
    al(2, "Afilierea este legătura instituțională prin care o asociație cu personalitate juridică proprie își desfășoară activitatea chinologică după standardele, regulamentele și nomenclatorul Clubului Federal."),

    articol(2, "Ce nu este afilierea"),
    al(1, [{ text: "Afilierea nu este fuziune, absorbție sau subordonare patrimonială.", bold: true }, " Asociația afiliată rămâne persoană juridică distinctă, cu patrimoniul, organele de conducere și răspunderea ei."]),
    al(2, "Clubul Federal nu răspunde pentru obligațiile asumate de o asociație afiliată față de terți, iar asociația afiliată nu poate angaja Clubul Federal fără mandat scris."),
    al(3, "Membrii unei asociații afiliate nu devin, prin aceasta, membri ai Clubului Federal."),

    articol(3, "Cadru normativ"),
    px("Statutul și Regulamentul intern de funcționare al Clubului Federal, standardele World Dog Federation, Codul Etic, Procedura disciplinară și celelalte regulamente adoptate de Consiliul Director."),

    // ═══ II ═══
    capitol("Capitolul II. Cine se poate afilia"),

    articol(4, "Condiții"),
    al(1, "Se poate afilia asociația care îndeplinește, cumulativ:"),
    lit("a", "este persoană juridică legal constituită, cu cod de identificare fiscală valabil;"),
    lit("b", "are în obiectul de activitate creșterea, evidența, formarea sau promovarea câinilor de rasă;"),
    lit("c", "are organe de conducere alese și în funcție, cu mandate neexpirate;"),
    lit("d", "acceptă expres standardele World Dog Federation, Statutul, regulamentele și Codul Etic ale Clubului Federal;"),
    lit("e", ["nu este afiliată, la data cererii, unei structuri chinologice internaționale concurente și se obligă să nu se afilieze pe durata afilierii, potrivit Art. 10 alin. (2)."]),
    al(2, ["Asociațiile cu sediul în afara României ", H("S1"), "."]),

    articol(5, "Cine hotărăște"),
    px("Afilierea se hotărăște de Consiliul Director, prin hotărâre motivată. Respingerea cererii se motivează în scris și se comunică; ea nu împiedică o cerere nouă, după înlăturarea motivului."),

    // ═══ III ═══
    capitol("Capitolul III. Procedura de afiliere"),

    articol(6, "Cererea și actele"),
    al(1, "Cererea se depune de reprezentantul legal al asociației și cuprinde:"),
    gol(60),
    tabel(["Ce se depune", "De ce"], [
      ["Hotărârea organului statutar propriu de a se afilia", "afilierea e un act al asociației, nu al președintelui ei"],
      ["Statutul și actul constitutiv, în copie", "se verifică obiectul de activitate și organele de conducere"],
      ["Certificatul de înregistrare fiscală (CUI)", "identificarea persoanei juridice"],
      ["Numele și datele de contact ale președintelui", "corespondența oficială"],
      ["Sediul, județul, localitatea, telefonul, e-mailul", "fișa publică de pe site"],
      ["Contul bancar (IBAN)", "încasările proprii, la expozițiile pe care le organizează"],
      ["Sigla asociației, în format electronic", "fișa publică și materialele comune"],
    ], [4200, 5160]),
    gol(140),
    al(2, [{ text: "Datele de la alin. (1) sunt cele ținute în evidența Clubului", bold: true }, " și publicate pe fișa asociației de pe site. Ele se țin la zi potrivit Art. 10 alin. (4)."]),

    articol(7, "Verificarea și termenul"),
    al(1, "Cererea se verifică de secretariat, care poate cere lămuriri sau acte în completare."),
    al(2, ["Consiliul Director se pronunță în cel mult ", H("T1"), " de la depunerea cererii complete."]),
    al(3, "Hotărârea se comunică în scris asociației solicitante."),

    articol(8, "Registrul asociațiilor afiliate"),
    al(1, "Clubul Federal ține Registrul asociațiilor afiliate, care cuprinde: denumirea, codul de identificare fiscală, sediul, președintele, datele de contact, data afilierii, numărul hotărârii și, după caz, data suspendării sau a retragerii."),
    al(2, [{ text: "Registrul este public", bold: true }, " și se publică pe site. Fișa fiecărei asociații afiliate arată datele de la Art. 6 alin. (1), fără actele depuse."]),

    // ═══ IV ═══
    capitol("Capitolul IV. Drepturile asociației afiliate"),

    articol(9, "Drepturi"),
    al(1, "Asociația afiliată are dreptul:"),
    lit("a", ["să se prezinte ca ", { text: "afiliată Clubului Federal Chinologic – Royal", italics: true }, " și să folosească această mențiune pe materialele proprii;"]),
    lit("b", "să folosească sigla Clubului Federal în condițiile stabilite de Consiliul Director, alături de sigla proprie, fără a o înlocui;"),
    lit("c", "să organizeze expoziții canine sub egida Clubului Federal, potrivit Art. 11;"),
    lit("d", "să propună arbitri, delegați și candidați la formele de pregătire ale Colegiului de Arbitri;"),
    lit("e", "ca membrii ei să aibă acces la Registrul Genealogic și la Școala de Arbitraj, în condițiile regulamentelor lor;"),
    lit("f", "să aibă fișă proprie pe site-ul Clubului Federal;"),
    lit("g", ["să fie ", H("S2"), " în Adunarea Generală a Clubului Federal."]),

    // ═══ V ═══
    capitol("Capitolul V. Obligațiile asociației afiliate"),

    articol(10, "Obligații"),
    al(1, "Asociația afiliată respectă Statutul, regulamentele, nomenclatorul de rase și Codul Etic ale Clubului Federal, precum și standardele World Dog Federation."),
    al(2, [{ text: "Exclusivitatea World Dog Federation.", bold: true }, " Pe durata afilierii, asociația nu se afiliază și nu participă instituțional la structuri chinologice internaționale concurente și nu organizează evenimente sub egida acestora. Participarea individuală a membrilor ei la evenimentele altor structuri nu intră sub această interdicție."]),
    al(3, "Asociația nu poate afilia, la rândul ei, alte asociații sub egida Clubului Federal."),
    al(4, ["Asociația comunică în scris orice schimbare a denumirii, sediului, codului fiscal, președintelui, contului bancar sau datelor de contact, în cel mult ", H("T2"), " zile de la producerea ei."]),
    al(5, ["Asociația trimite un raport anual de activitate, până la ", H("T3"), ", cuprinzând expozițiile organizate, membrii, cuiburile înregistrate și arbitrii proprii."]),
    al(6, "Asociația păstrează la zi datele de pe fișa publică și răspunde de corectitudinea lor."),

    articol(11, "Organizarea expozițiilor"),
    al(1, "Dreptul de la Art. 9 lit. c) se exercită în condițiile regulamentului adoptat de Consiliul Director pentru organizarea expozițiilor sub egida Clubului Federal."),
    al(2, [{ text: "Până la adoptarea acelui regulament", bold: true }, ", fiecare expoziție se organizează pe baza unei ", { text: "convenții scrise", bold: true }, " între Clubul Federal și asociația organizatoare, încheiată înainte de deschiderea înscrierilor, care prevede cel puțin: data și locul, arbitrii și delegatul, taxele și contul în care se încasează, cine suportă cheltuielile, termenul de trimitere a catalogului și a rezultatelor și cotele datorate Clubului Federal și World Dog Federation."]),
    al(3, "Rezultatele expozițiilor organizate sub egida Clubului Federal se trimit Clubului pentru înscrierea în evidențele proprii și pentru recunoașterea internațională a titlurilor."),

    articol(12, "Cotizația"),
    al(1, ["Asociația afiliată plătește o cotizație anuală de ", H("C1"), ", până la data de ", H("T4"), " a fiecărui an."]),
    al(2, "Pentru anul afilierii, cotizația se datorează proporțional cu lunile rămase până la sfârșitul anului."),
    al(3, ["Neplata cotizației mai mult de ", H("T5"), " de la scadență atrage suspendarea potrivit Art. 13."]),

    // ═══ VI ═══
    capitol("Capitolul VI. Suspendarea și retragerea afilierii"),

    articol(13, "Suspendarea"),
    al(1, "Consiliul Director poate suspenda afilierea pentru:"),
    lit("a", "neplata cotizației, în cazul de la Art. 12 alin. (3);"),
    lit("b", "netrimiterea raportului anual sau a rezultatelor expozițiilor organizate;"),
    lit("c", "necomunicarea schimbărilor de la Art. 10 alin. (4), după o atenționare scrisă rămasă fără urmare;"),
    lit("d", "încălcarea regulamentelor Clubului Federal sau a Codului Etic, până la lămurirea situației."),
    al(2, ["Suspendarea se dispune pe o durată determinată, de cel mult ", H("T6"), ", și încetează de drept la înlăturarea motivului."]),
    al(3, [{ text: "Pe durata suspendării", bold: true }, ", asociația nu poate organiza expoziții sub egida Clubului Federal și nu poate folosi mențiunea de afiliere în materiale noi. Fișa ei de pe site arată starea de suspendare."]),

    articol(14, "Retragerea afilierii"),
    al(1, "Consiliul Director poate retrage afilierea pentru:"),
    lit("a", "încălcarea exclusivității de la Art. 10 alin. (2);"),
    lit("b", "fapte grave împotriva bunăstării animalelor sau fraudă în evidențele genealogice;"),
    lit("c", "folosirea însemnelor Clubului Federal peste limitele îngăduite, după atenționare scrisă;"),
    lit("d", "menținerea, peste durata maximă, a motivului care a dus la suspendare;"),
    lit("e", "pierderea personalității juridice sau încetarea activității."),
    al(2, "Asociația se poate retrage oricând, prin hotărârea propriului organ statutar, comunicată în scris. Retragerea nu stinge obligațiile scadente."),

    articol(15, "Procedura"),
    al(1, ["Suspendarea și retragerea se dispun numai după ce asociației i s-a comunicat în scris fapta constatată și i s-a dat un termen de cel puțin ", H("T7"), " zile ca să răspundă."]),
    al(2, "Hotărârea se motivează în scris și se comunică."),
    al(3, ["Împotriva ei se poate face plângere la Consiliul Director, o singură dată, în termen de ", H("T8"), " zile. Plângerea nu suspendă executarea."]),

    articol(16, "Efectele retragerii"),
    al(1, "De la data retragerii, asociația încetează să folosească mențiunea de afiliere, sigla Clubului Federal și orice materiale care ar putea induce ideea legăturii instituționale."),
    al(2, "Fișa ei se scoate din registrul public, iar în registru se însemnează data și numărul hotărârii."),
    al(3, [{ text: "Expozițiile deja anunțate, cu înscrieri deschise", bold: true }, ", ", H("E1"), "."]),
    al(4, [{ text: "Actele eliberate rămân valabile.", bold: true }, " Certificatele de origine, titlurile și rezultatele dobândite în perioada afilierii nu se desființează prin retragerea acesteia."]),

    // ═══ VII ═══
    capitol("Capitolul VII. Dispoziții finale"),

    articol(17, "Asociațiile afiliate la data intrării în vigoare"),
    al(1, "Asociațiile afiliate înainte de adoptarea prezentului Regulament își păstrează calitatea."),
    al(2, ["Ele depun actele de la Art. 6 alin. (1) și își regularizează situația în termen de ", H("T9"), " de la comunicarea prezentului Regulament."]),

    articol(18, "Intrarea în vigoare"),
    al(1, ["Prezentul Regulament a fost aprobat prin Hotărârea Consiliului Director nr. ", H("H"), " din ", H("D"), " și ratificat de Adunarea Generală în data de ", H("D2"), "."]),
    al(2, "Se publică pe cfc-royal.ro, împreună cu registrul asociațiilor afiliate."),

    // ═══ Anexe ═══
    capitol("Anexa A. Asociațiile afiliate la data redactării"),
    px("Datele sunt cele publicate astăzi pe fișele de pe site. Coloana din dreapta se completează cu numărul și data hotărârii prin care s-a hotărât afilierea — astăzi nu se cunoaște niciuna."),
    gol(),
    tabel(["Nr.", "Asociația", "Județ", "Hotărârea de afiliere"], [
      ["1", [{ text: "Asociația Chinologică Profesională „Carpații”", bold: true }], "Iași", ""],
      ["2", [{ text: "Asociația Chinologică din județul Caraș-Severin", bold: true }], "Caraș-Severin", ""],
      ["3", [{ text: "Asociația „Străjerii Munților”", bold: true }], "—", ""],
      ["4", [{ text: "Asociația Club Federal Chinologic – Buzău", bold: true }], "Buzău", ""],
    ], [700, 5100, 1800, 1760]),

    capitol("Anexa B. Ce are de hotărât Consiliul Director"),
    tabel(["Marcaj", "Ce se hotărăște", "Propunerea redactorului"], [
      [[H("S1")], "Dacă se pot afilia asociații din alte țări", "da, cu aceleași condiții, dacă nu sunt afiliate unei structuri concurente"],
      [[H("S2")], "Dacă asociațiile afiliate sunt reprezentate în Adunarea Generală", "chestiune statutară — de lămurit cu Statutul înainte de a scrie ceva aici"],
      [[H("T1")], "Termenul de pronunțare asupra cererii", "60 de zile de la dosarul complet"],
      [[H("T2")], "Termenul de comunicare a schimbărilor", "15 zile"],
      [[H("T3")], "Termenul raportului anual", "31 ianuarie, pentru anul încheiat"],
      [[H("C1"), " ", H("T4")], "Cuantumul cotizației și scadența", "de stabilit; scadența 31 martie"],
      [[H("T5")], "Răgazul de la scadență până la suspendare", "90 de zile"],
      [[H("T6")], "Durata maximă a suspendării", "12 luni"],
      [[H("T7"), " ", H("T8")], "Termen de răspuns / de plângere", "15 zile / 15 zile"],
      [[H("E1")], "Ce se întâmplă cu expozițiile anunțate, la retragerea afilierii", "se duc la capăt sub egida Clubului, care preia organizarea, sau se anulează cu restituirea integrală a taxelor"],
      [[H("T9")], "Termenul de regularizare pentru cele deja afiliate", "90 de zile"],
      [[H("H"), " ", H("D"), " ", H("D2")], "Numărul, data hotărârii și data ratificării", "—"],
    ], [1500, 3600, 4260]),
    gol(200),

    px([{ text: "Două lucruri de lămurit înainte de adoptare:", bold: true, color: S.VERDE }]),
    px([{ text: "1. Reprezentarea în Adunarea Generală ", bold: true },
      "(⟨S2⟩) ține de Statut, nu de acest regulament. Dacă Statutul nu o prevede, articolul trebuie scos, nu completat — un regulament nu poate crea drepturi statutare."], { indent: { left: 300 }, after: 90 }),
    px([{ text: "2. Sigla Clubului. ", bold: true },
      "Art. 9 lit. b) trimite la condițiile stabilite de Consiliu. Ele nu există încă scrise nicăieri; până atunci, litera rămâne fără conținut."], { indent: { left: 300 }, after: 200 }),

    semnaturi(),
  ],
});

S.scrie(doc, process.argv[2]);
