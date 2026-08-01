/**
 * Generează „Acord-cadru de colaborare — Membru Colectiv”, versiunea finală.
 *
 * Pornește de la proiectul primit și rezolvă cele 12 observații ale domnului
 * Mihail-Cosmin Neagu, plus patru lucruri găsite la citire (Art. 16 lipsă, lipsa unui
 * drept de contestație pentru Membrul Colectiv, obligații financiare stabilite
 * unilateral, absența oricărei mențiuni despre World Dog Federation).
 *
 * TREI SCHIMBĂRI DE FOND, nu de formă:
 *
 *   1. ACORDUL CONFERĂ CALITATEA. Proiectul spunea că nu o conferă, ci doar o exercită —
 *      dar fără acord nu ești Membru Colectiv, iar Statutul nu cuprinde o asemenea
 *      prevedere. Contradicția ținea tot documentul.
 *
 *   2. NIMIC NU SE SCHIMBĂ UNILATERAL. Regulamentele aplicabile sunt cele din Anexa 1, în
 *      versiunea de la semnare, fiecare cu numărul hotărârii. O modificare produce efecte
 *      față de Membrul Colectiv doar după comunicare și cu drept de denunțare. Un contract
 *      care se completează cu acte pe care numai o parte le poate schimba nu e un acord.
 *
 *   3. RECIPROCITATE. Membrul Colectiv are acum dreptul să conteste măsurile luate
 *      împotriva lui. Proiectul îi dădea doar dreptul de a-și spune părerea înainte.
 *
 *   node scripts/documente/acord-cadru-membru-colectiv.cjs "cale/catre/iesire.docx"
 */
const S = require("./_sablon.cjs");
const { px, al, lit, gol, capitol, articol, caseta, tabel, VERDE, AURIU, ROSU, GRI } = S;

/** Linia de completat, în corpul actului. */
const L = (n = 40) => ({ text: "_".repeat(n) });

let nr = 0;
const A = (titlu) => articol(++nr, titlu);

/**
 * Casetele care spun ce s-a schimbat și de ce.
 *
 * Cu steagul --curat nu apar. Un act care se semnează nu poartă comentarii de redactare: cine
 * îl primește spre semnare trebuie să vadă obligațiile, nu istoria lor. Varianta cu
 * casete e pentru Consiliu și pentru domnul Neagu, ca să poată verifica dintr-o privire
 * unde a ajuns fiecare observație.
 */
const CURAT = process.argv.includes("--curat");
const nota = (randuri, culoare, fond) => (CURAT ? null : caseta(randuri, culoare, fond));

const doc = S.actDeSedinta({
  proiect: false,
  titlu: "ACORD-CADRU DE COLABORARE",
  subtitlu: "privind exercitarea calității de Membru Colectiv",
  subsolText: "Acord-cadru de colaborare · Membru Colectiv CFCR",
  cuprins: [
    px("privind exercitarea calității de Membru Colectiv al Asociației Club Federal Chinologic – ROYAL",
      { align: S.AlignmentType.CENTER, size: 21 }),
    gol(60),
    px([{ text: "Nr. de înregistrare: ", bold: true }, L(18), "   din   ", L(18)],
      { align: S.AlignmentType.CENTER, size: 19 }),
    gol(240),

    // ═══ Părțile ═══
    capitol("I. Părțile"),

    A("Asociația Club Federal Chinologic – ROYAL"),
    px("Asociația Club Federal Chinologic – ROYAL, denumită în continuare CFCR, persoană juridică de drept privat fără scop patrimonial, constituită potrivit Ordonanței Guvernului nr. 26/2000 privind asociațiile și fundațiile, cu modificările și completările ulterioare, identificată prin C.I.F. 48828041, cu sediul în municipiul Râmnicu Vâlcea, str. Mihai Eminescu nr. 43, bl. C11, sc. A, ap. 33, județul Vâlcea, reprezentată legal prin domnul Alexandru Paul Ciolac, Președinte,"),
    px("și", { align: S.AlignmentType.CENTER }),

    A("Membrul Colectiv"),
    px(["Asociația ", L(52), ", persoană juridică de drept privat fără scop patrimonial, constituită potrivit legislației române, identificată prin C.I.F. ", L(20), ", cu sediul în ", L(40), ", reprezentată legal prin ", L(36), ", în calitate de ", L(24), ", denumită în continuare Membrul Colectiv,"]),
    gol(80),
    px("au convenit încheierea prezentului acord-cadru de colaborare."),

    // ═══ II ═══
    capitol("II. Natura juridică a acordului"),

    A("Obiectul"),
    px("Prezentul acord stabilește cadrul general de colaborare dintre CFCR și Membrul Colectiv, precum și drepturile și obligațiile reciproce care decurg din calitatea de Membru Colectiv al CFCR."),

    A("Dobândirea și încetarea calității de Membru Colectiv"),
    al(1, [{ text: "Calitatea de Membru Colectiv al CFCR se dobândește la data semnării prezentului acord de către ambele părți", bold: true }, " și se exercită în condițiile stabilite prin el."]),
    al(2, "Calitatea încetează la data încetării prezentului acord, potrivit Capitolului IX."),
    al(3, "CFCR ține și publică registrul Membrilor Colectivi, cuprinzând: denumirea, codul de identificare fiscală, sediul, reprezentantul legal, data dobândirii calității și, după caz, data încetării acesteia."),
    nota([[{ text: "Observațiile 1 și 3 (M.-C. Neagu). ", bold: true },
      { text: "Proiectul spunea că această calitate se dobândește „potrivit Statutului”, iar acordul „nu o conferă”. Statutul CFCR nu cuprinde o asemenea prevedere, iar în fapt fără acord nu există calitatea de Membru Colectiv. Textul de mai sus înlătură contradicția.", italics: true }]], AURIU, "FDF8EC"),

    A("Autonomia părților"),
    al(1, "Fiecare parte își păstrează integral personalitatea juridică, patrimoniul propriu, organele de conducere, autonomia decizională și răspunderea pentru propriile activități."),
    al(2, "Prezentul acord nu creează raporturi de subordonare, de reprezentare sau de control între părți și nu afectează independența juridică și organizatorică a acestora."),
    al(3, "Membrii Membrului Colectiv nu dobândesc, prin efectul prezentului acord, calitatea de membri ai CFCR."),
    al(4, "Niciuna dintre părți nu poate angaja răspunderea celeilalte față de terți și nu răspunde pentru obligațiile asumate de aceasta."),

    A("Principiile colaborării"),
    px("Colaborarea se întemeiază pe: legalitate, autonomie organizațională, bună-credință, transparență, cooperare instituțională, respect reciproc, protejarea intereselor legitime ale membrilor și proprietarilor de câini, promovarea și dezvoltarea responsabilă a chinologiei."),

    // ═══ III ═══
    capitol("III. Obiectul colaborării"),

    A("Domeniile de colaborare"),
    px("Colaborarea dintre părți privește:"),
    lit("a", "utilizarea serviciilor Registrului Genealogic administrat de CFCR;"),
    lit("b", "emiterea documentelor genealogice și a celorlalte documente specifice sistemului chinologic administrat de CFCR;"),
    lit("c", "organizarea și desfășurarea expozițiilor chinologice sub egida CFCR;"),
    lit("d", "organizarea examenelor, evaluărilor și a altor activități chinologice;"),
    lit("e", "utilizarea platformelor informatice puse la dispoziție de CFCR;"),
    lit("f", "participarea la programe comune de promovare, educație și dezvoltare instituțională."),

    A("Anexele acordului"),
    al(1, "Fac parte integrantă din prezentul acord următoarele anexe, semnate de ambele părți odată cu acesta:"),
    lit("a", [{ text: "Anexa 1 — Regulamentele CFCR aplicabile", bold: true }, ", fiecare cu titlul, numărul și data hotărârii Consiliului Director prin care a fost adoptat;"]),
    lit("b", [{ text: "Anexa 2 — Serviciile și condițiile financiare", bold: true }, ": serviciile puse la dispoziție, tarifele aplicabile și termenele de plată;"]),
    lit("c", [{ text: "Anexa 3 — Regulile de utilizare a denumirii și siglei CFCR", bold: true }, ";"]),
    lit("d", [{ text: "Anexa 4 — Persoanele de contact", bold: true }, " ale fiecărei părți și datele lor."]),
    al(2, [{ text: "Nicio altă anexă, procedură, protocol sau act adițional nu produce efecte între părți dacă nu a fost semnat de amândouă.", bold: true }]),
    al(3, "Anexele se modifică prin act adițional semnat de ambele părți, cu excepția Anexei 4, care se actualizează prin comunicare scrisă."),
    nota([[{ text: "Observația 9. ", bold: true },
      { text: "Proiectul spunea că aspectele operaționale „pot fi detaliate prin anexe, proceduri, acte adiționale sau protocoale”. Anexele sunt acum enumerate, fiecare cu ce cuprinde, iar ce nu e semnat de amândouă părțile nu produce efecte.", italics: true }]], AURIU, "FDF8EC"),

    // ═══ IV ═══
    capitol("IV. Drepturile și obligațiile CFCR"),

    A("Drepturile CFCR"),
    px("CFCR are dreptul:"),
    lit("a", "să solicite Membrului Colectiv respectarea prezentului acord și a regulamentelor din Anexa 1;"),
    lit("b", "să verifice modul de îndeplinire a obligațiilor asumate, în limitele prezentului acord și cu respectarea autonomiei Membrului Colectiv;"),
    lit("c", ["să solicite documentele și informațiile ", { text: "strict necesare", bold: true }, " desfășurării activităților care fac obiectul acordului, arătând în scris temeiul și scopul solicitării;"]),
    lit("d", "să administreze serviciile și platformele puse la dispoziția Membrilor Colectivi;"),
    lit("e", "să limiteze sau să suspende accesul la servicii, în cazurile și după procedura de la Art. 12;"),
    lit("f", "să denunțe acordul în condițiile Capitolului IX."),

    A("Solicitarea de documente"),
    al(1, "Solicitarea prevăzută la Art. 10 lit. c) se formulează în scris și arată documentele cerute, temeiul și scopul."),
    al(2, "Membrul Colectiv transmite documentele în cel mult 15 zile lucrătoare de la primirea solicitării. Când documentele nu se află în posesia sa, comunică aceasta în același termen."),
    al(3, "Netransmiterea nejustificată, după o a doua solicitare scrisă, atrage măsura de limitare prevăzută la Art. 12."),
    nota([[{ text: "Observația 11. ", bold: true },
      { text: "„În ce sens? Cum se întâmplă asta practic?” — dreptul avea nevoie de o procedură: ce se cere, în ce formă, în cât timp, ce urmează la refuz.", italics: true }]], AURIU, "FDF8EC"),

    A("Limitarea și suspendarea accesului la servicii"),
    al(1, [{ text: "Limitarea", bold: true }, " accesului la anumite servicii se poate dispune pentru:"]),
    lit("a", "neplata obligațiilor financiare din Anexa 2, la mai mult de 30 de zile de la scadență;"),
    lit("b", "netransmiterea documentelor, în situația de la Art. 11 alin. (3);"),
    lit("c", "transmiterea repetată de date incomplete sau inexacte."),
    al(2, [{ text: "Suspendarea", bold: true }, " colaborării se poate dispune pentru:"]),
    lit("a", "transmiterea către CFCR a unui document falsificat ori a unor date neadevărate privind identitatea unui exemplar;"),
    lit("b", "utilizarea denumirii sau siglei CFCR cu încălcarea Art. 21;"),
    lit("c", "neplata obligațiilor financiare la mai mult de 90 de zile de la scadență;"),
    lit("d", "menținerea, mai mult de 60 de zile, a situației care a determinat limitarea."),
    al(3, "Măsura se comunică în scris, motivat, cu arătarea faptei și a termenului în care poate fi remediată, după ce Membrului Colectiv i s-a dat prilejul să își prezinte punctul de vedere."),
    al(4, "Măsura încetează de drept la înlăturarea motivului care a determinat-o."),
    al(5, "Măsura poate fi contestată potrivit Art. 15."),
    nota([[{ text: "Observația 14. ", bold: true },
      { text: "„Trebuie detaliat cu privire la situațiile care vor conduce la suspendare și situațiile care vor conduce la limitare.” Cele două măsuri au acum temeiuri proprii, ordonate după gravitate.", italics: true }]], AURIU, "FDF8EC"),

    A("Obligațiile CFCR"),
    px("CFCR se obligă:"),
    lit("a", "să asigure accesul la serviciile și activitățile prevăzute în acord, în condiții egale și nediscriminatorii;"),
    lit("b", "să administreze Registrul Genealogic și celelalte servicii cu respectarea propriilor regulamente și a principiilor transparenței, imparțialității și bunei-credințe;"),
    lit("c", "să emită documentele aflate în competența sa, în condițiile regulamentelor din Anexa 1;"),
    lit("d", "să comunice modificările regulamentelor, potrivit Art. 14;"),
    lit("e", "să răspundă solicitărilor Membrului Colectiv în cel mult 30 de zile;"),
    lit("f", "să trateze cu imparțialitate toate organizațiile care dețin calitatea de Membru Colectiv;"),
    lit("g", "să păstreze confidențialitatea informațiilor primite, potrivit Capitolului VII."),

    A("Modificarea regulamentelor aplicabile"),
    al(1, [{ text: "Regulamentele aplicabile sunt cele din Anexa 1, în versiunea în vigoare la data semnării", bold: true }, ", identificate prin numărul și data hotărârii de adoptare."]),
    al(2, "CFCR poate modifica aceste regulamente potrivit competențelor sale. Modificările produc efecte față de Membrul Colectiv numai după comunicarea lor în scris și numai de la data arătată în comunicare, care nu poate fi mai devreme de 30 de zile de la comunicare."),
    al(3, [{ text: "Dacă nu acceptă modificarea, Membrul Colectiv poate denunța prezentul acord", bold: true }, " în termen de 30 de zile de la comunicare, fără preaviz și fără despăgubiri. Denunțarea nu îl scutește de obligațiile scadente."]),
    al(4, "Modificările impuse de lege sau de World Dog Federation produc efecte de la data intrării lor în vigoare, cu informarea de îndată a Membrului Colectiv."),
    nota([[{ text: "Observațiile 12 și 24. ", bold: true },
      { text: "„Nu are cum să adopte ulterior… se poate ridica suspiciunea că CFCR a modificat un regulament cu care membrul nu este de acord.” Regulamentele sunt acum ale unei versiuni anume, iar o schimbare nu se impune tăcut: se comunică, are termen, și dă drept de ieșire. Toate cele 32 de regulamente CFCR au fost adoptate la 1 august 2026, prin hotărârile 139–170, deci pot fi arătate în Anexa 1 fără echivoc.", italics: true }]], AURIU, "FDF8EC"),

    // ═══ V ═══
    capitol("V. Drepturile și obligațiile Membrului Colectiv"),

    A("Drepturile Membrului Colectiv"),
    px("Membrul Colectiv are dreptul:"),
    lit("a", "să beneficieze de serviciile prevăzute în prezentul acord și în Anexa 2;"),
    lit("b", "să participe la activitățile organizate de CFCR, în condițiile regulamentelor din Anexa 1;"),
    lit("c", "să utilizeze documentele, platformele și serviciile puse la dispoziție, în limitele acordului;"),
    lit("d", "să formuleze propuneri și observații privind dezvoltarea colaborării;"),
    lit("e", "să fie informat cu privire la modificările regulamentelor care îi sunt aplicabile, potrivit Art. 14;"),
    lit("f", "să beneficieze de sprijin administrativ și instituțional din partea CFCR;"),
    lit("g", [{ text: "să conteste măsurile luate de CFCR în temeiul prezentului acord", bold: true }, ", potrivit Art. 15."]),

    A("Contestarea măsurilor"),
    al(1, "Membrul Colectiv poate contesta, în scris, orice măsură luată de CFCR în temeiul prezentului acord, în termen de 15 zile de la comunicarea acesteia."),
    al(2, "Contestația se soluționează de Consiliul Director al CFCR în cel mult 30 de zile, prin hotărâre motivată, comunicată în scris."),
    al(3, "Contestația nu suspendă executarea măsurii, afară de cazul în care CFCR dispune altfel."),
    al(4, "Soluționarea contestației nu împiedică accesul la procedurile prevăzute în Capitolul VIII."),
    nota([[{ text: "Adăugat la redactare. ", bold: true },
      { text: "Proiectul dădea CFCR dreptul de a suspenda, iar Membrului Colectiv doar dreptul de a-și spune părerea înainte de măsură. După măsură nu avea nimic. Într-un acord între organizații autonome, dreptul de a contesta e perechea firească a dreptului de a sancționa.", italics: true }]], VERDE, "F6FAF7"),

    A("Obligațiile Membrului Colectiv"),
    px("Membrul Colectiv se obligă:"),
    lit("a", "să respecte prezentul acord și regulamentele din Anexa 1;"),
    lit("b", "să desfășoare activitățile care fac obiectul acordului cu respectarea legislației aplicabile și a eticii chinologice;"),
    lit("c", "să furnizeze informații și documente complete, reale și actualizate;"),
    lit("d", "să utilizeze documentele și serviciile primite numai în scopurile pentru care au fost emise;"),
    lit("e", "să nu aducă atingere imaginii, reputației sau intereselor legitime ale CFCR;"),
    lit("f", "să comunice, în cel mult 15 zile, orice modificare a datelor sale de identificare, a sediului sau a reprezentării legale;"),
    lit("g", ["să achite obligațiile financiare ", { text: "prevăzute în Anexa 2", bold: true }, ", la termenele stabilite acolo."]),
    nota([[{ text: "Litera g), rescrisă. ", bold: true },
      { text: "Proiectul obliga Membrul Colectiv la sume stabilite prin „hotărârile organelor competente ale CFCR” — adică sume pe care CFCR le putea schimba singur, după semnare. Acum sunt cele din Anexa 2, iar Anexa 2 se schimbă doar prin act adițional.", italics: true }]], AURIU, "FDF8EC"),

    A("Răspunderea"),
    al(1, "Membrul Colectiv răspunde pentru legalitatea și autenticitatea documentelor pe care le transmite către CFCR, precum și pentru activitatea desfășurată în nume propriu."),
    al(2, "Membrul Colectiv își păstrează libertatea de organizare și administrare a propriilor activități, cu respectarea obligațiilor asumate prin prezentul acord."),

    // ═══ VI ═══
    capitol("VI. Organizarea colaborării"),

    A("Persoanele de contact"),
    al(1, "Fiecare parte desemnează, prin Anexa 4, persoana responsabilă cu coordonarea relației instituționale."),
    al(2, "Schimbarea persoanei desemnate produce efecte de la data comunicării în scris și nu cere act adițional."),

    A("Comunicările"),
    al(1, "Comunicările dintre părți se fac în format electronic, prin corespondență scrisă, prin platformele administrate de CFCR sau prin orice alt mijloc care permite confirmarea transmiterii și a primirii."),
    al(2, "Comunicările privind limitarea, suspendarea, denunțarea sau contestarea se fac în scris, cu confirmare de primire."),

    A("Documentele transmise"),
    px("Documentele și informațiile transmise între părți se prezumă autentice și complete până la proba contrară, fiecare parte răspunzând pentru exactitatea celor comunicate de ea."),

    // ═══ VII ═══
    capitol("VII. Identitatea instituțională"),

    A("Utilizarea denumirii și siglei"),
    al(1, "Membrul Colectiv poate folosi denumirea și sigla CFCR numai pentru a arăta relația instituțională dintre părți și numai potrivit Anexei 3."),
    al(2, "Membrul Colectiv se poate prezenta drept „Membru Colectiv al Asociației Club Federal Chinologic – ROYAL”."),

    A("Ce nu este îngăduit"),
    px("Membrului Colectiv îi este interzis:"),
    lit("a", "să folosească sigla CFCR ca element principal al propriei identități vizuale ori într-o formă modificată, colorată sau recompusă;"),
    lit("b", "să se prezinte drept filială, sucursală, structură teritorială sau reprezentant al CFCR;"),
    lit("c", "să folosească denumirea sau sigla CFCR pentru evenimente, servicii ori documente care nu fac obiectul prezentului acord;"),
    lit("d", "să emită documente care, prin formă sau conținut, pot părea a proveni de la CFCR;"),
    lit("e", "să folosească denumirea, sigla sau calitatea de Membru Colectiv după încetarea prezentului acord."),
    nota([[{ text: "Observația 22. ", bold: true },
      { text: "„Prevederi cu caracter prea general, care pot crea probleme în practică.” Interdicțiile formulate prin urmări posibile („poate afecta imaginea”) au fost înlocuite cu fapte concrete, care se pot constata.", italics: true }]], AURIU, "FDF8EC"),

    A("Încetarea dreptului de utilizare"),
    px("La încetarea acordului, Membrul Colectiv retrage, în cel mult 30 de zile, denumirea, sigla și mențiunea calității de Membru Colectiv din toate materialele aflate sub controlul său."),

    // ═══ VIII ═══
    capitol("VIII. Confidențialitatea"),

    A("Obligația de confidențialitate"),
    al(1, "Părțile păstrează confidențialitatea informațiilor și documentelor obținute în executarea prezentului acord, în măsura în care acestea nu sunt destinate publicității."),
    al(2, "Obligația privește: documentele interne, informațiile administrative și financiare, bazele de date, informațiile privind membrii, crescătorii, proprietarii de câini și colaboratorii."),
    al(3, "Obligația nu privește informațiile care erau publice, cele pe care partea le deținea deja în mod legal, și nici cele a căror comunicare este cerută de lege sau de o autoritate competentă."),

    A("Durata obligației"),
    px([{ text: "Obligația de confidențialitate rămâne în vigoare 5 ani de la încetarea prezentului acord.", bold: true }, " Datele cu caracter personal urmează regimul prevăzut de legislația aplicabilă și de politica de confidențialitate a fiecărei părți."]),
    nota([[{ text: "Observația 23. ", bold: true },
      { text: "„Cât anume? Obligația nu poate rămâne la nesfârșit.” S-a stabilit un termen. Datele personale au regimul lor, care nu se confundă cu confidențialitatea contractuală.", italics: true }]], AURIU, "FDF8EC"),

    // ═══ IX ═══
    capitol("IX. Neînțelegeri, suspendare, încetare"),

    A("Soluționarea neînțelegerilor"),
    al(1, "Orice neînțelegere se soluționează cu prioritate pe cale amiabilă, prin dialog instituțional."),
    al(2, "Dacă soluționarea amiabilă nu e cu putință, părțile pot recurge la conciliere sau la altă procedură convenită."),
    al(3, "Numai după parcurgerea acestor demersuri, litigiile se soluționează de instanțele judecătorești competente, potrivit legislației române."),

    A("Suspendarea executării"),
    px("Executarea prezentului acord poate fi suspendată prin acordul părților, în cazul imposibilității temporare de executare, ori în cazurile prevăzute la Art. 12."),

    A("Încetarea"),
    al(1, "Prezentul acord încetează:"),
    lit("a", "prin acordul scris al părților;"),
    lit("b", "prin denunțare unilaterală, cu preaviz de 30 de zile calendaristice;"),
    lit("c", "prin denunțare fără preaviz, în cazurile de la Art. 14 alin. (3) și Art. 26 alin. (3);"),
    lit("d", "prin dizolvarea ori încetarea existenței uneia dintre părți;"),
    lit("e", "în alte cazuri prevăzute de lege."),
    al(2, "Încetarea acordului atrage încetarea calității de Membru Colectiv."),
    al(3, "Încetarea nu exonerează părțile de obligațiile scadente anterior și nici de cele care, prin natura lor, continuă să producă efecte."),
    al(4, [{ text: "Documentele emise în perioada de valabilitate a acordului rămân valabile.", bold: true }, " Certificatele, titlurile și înregistrările genealogice dobândite nu se desființează prin încetarea prezentului acord."]),

    // ═══ X ═══
    capitol("X. Dispoziții finale"),

    A("Legătura cu World Dog Federation"),
    al(1, "Serviciile care fac obiectul prezentului acord se întemeiază pe calitatea CFCR de membru al World Dog Federation."),
    al(2, "CFCR comunică de îndată Membrului Colectiv orice schimbare a acestei calități care poate afecta recunoașterea documentelor sau a titlurilor."),
    al(3, "Pierderea de către CFCR a calității de membru al World Dog Federation dă dreptul Membrului Colectiv să denunțe prezentul acord fără preaviz."),
    nota([[{ text: "Adăugat la redactare. ", bold: true },
      { text: "Proiectul nu pomenea World Dog Federation nicăieri, deși toată valoarea colaborării — registrul, titlurile, expozițiile — trece prin recunoașterea ei.", italics: true }]], VERDE, "F6FAF7"),

    A("Întinderea înțelegerii"),
    al(1, [{ text: "Prezentul acord, împreună cu anexele sale, cuprinde întreaga înțelegere a părților", bold: true }, " cu privire la obiectul său."]),
    al(2, "Acordul se completează exclusiv cu dispozițiile legislației române aplicabile."),
    nota([[{ text: "Observațiile 1 și 24. ", bold: true },
      { text: "„CFCR nu are acte normative, ca de altfel nicio persoană de drept privat.” · „Acordul trebuie să fie complet și să se completeze doar cu prevederile actelor normative în vigoare.” Completarea cu actele interne ale uneia dintre părți ar fi însemnat că acea parte poate schimba singură obligațiile celeilalte.", italics: true }]], AURIU, "FDF8EC"),

    A("Modificarea acordului"),
    px("Orice modificare se face prin act adițional semnat de ambele părți, cu excepția actualizării datelor de identificare și a persoanelor de contact, care se comunică în scris."),

    A("Nulitatea parțială"),
    px([{ text: "Dacă una sau mai multe clauze sunt declarate nule ori anulate prin hotărâre judecătorească definitivă", bold: true }, ", sau sunt înlăturate prin acordul scris al părților, celelalte dispoziții își păstrează valabilitatea, în măsura în care scopul acordului mai poate fi realizat. Părțile vor înlocui clauza înlăturată cu una valabilă, cât mai apropiată de intenția lor inițială."]),
    nota([[{ text: "Observația 26. ", bold: true },
      { text: "„Prin ce modalitate și de către cine?” — s-a arătat cine constată nulitatea și ce urmează după.", italics: true }]], AURIU, "FDF8EC"),

    A("Intrarea în vigoare"),
    al(1, "Prezentul acord intră în vigoare la data semnării de către ambele părți."),
    al(2, "Acordul a fost aprobat prin Hotărârea Consiliului Director al CFCR nr. ⟨H⟩ din ⟨D⟩."),
    gol(200),

    px(["Încheiat astăzi, ", L(24), ", în două exemplare originale, câte unul pentru fiecare parte."]),
    gol(320),

    tabel(["Asociația Club Federal Chinologic – ROYAL", "Membrul Colectiv"], [
      [[{ text: "CIOLAC ALEXANDRU PAUL", bold: true }], [{ text: "____________________________________", bold: true }]],
      ["Președinte", "Reprezentant legal"],
      ["", ""],
      ["Semnătura și ștampila", "Semnătura și ștampila"],
    ], [4680, 4680]),
  ].filter(Boolean),
});

S.scrie(doc, process.argv[2]);
