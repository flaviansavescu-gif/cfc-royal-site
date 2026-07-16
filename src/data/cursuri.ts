// =========================================================================
// cursuri.ts — datele platformei de cursuri a Școlii de Arbitraj (CFC-Royal).
// Platforma trăiește sub /cursuri/ (RO, protejată cu cod de acces).
// Întrebările de test NU conțin răspunsurile corecte — cheile de corectare
// stau exclusiv pe server, în netlify/functions/test-modul.js.
// =========================================================================

export interface Lectura {
  titlu: string;
  url: string; // pagină publică de pe site (regulamente/documente)
}

export interface Intrebare {
  text: string;
  optiuni: string[]; // fără marcarea răspunsului corect
}

export interface Modul {
  slug: string; // cursuri/<slug>/
  nr: number;
  titlu: string;
  obiectiv: string;
  lecturi: Lectura[];
  intrebari?: Intrebare[]; // prezent doar dacă testul e activ
}

const REG = "/ro/regulamente/";
const DOC = "/ro/documente/";

export const MODULE: Modul[] = [
  {
    slug: "modul-1",
    nr: 1,
    titlu: "Rolul, etica și conduita arbitrului",
    obiectiv:
      "Înțelegerea responsabilității arbitrului: imparțialitate, incompatibilități, cadouri și favoruri, conduita în arenă și comunicarea deciziilor.",
    lecturi: [
      { titlu: "Codul Etic — Capitolul V: Etica în arbitraj", url: DOC + "cod-etic/" },
      { titlu: "Comportamentul și etica în ring", url: REG + "comportamentul-si-etica-in-ring/" },
      { titlu: "Ce au voie și ce nu au voie să facă handlerii și expozanții", url: REG + "ce-au-voie-si-nu-au-voie-sa-faca-handlerii-si-expozantii/" },
      { titlu: "Regulamentul Colegiului de Arbitri", url: DOC + "regulamentul-colegiului-de-arbitri/" },
    ],
    intrebari: [
      {
        text: "Arbitrul evaluează câinii exclusiv pe baza:",
        optiuni: [
          "standardului de rasă, regulamentelor tehnice și observațiilor directe din arenă",
          "preferințelor personale și a reputației câinelui",
          "palmaresului obținut la expozițiile anterioare",
        ],
      },
      {
        text: "Înainte de judecată, arbitrului îi este interzis:",
        optiuni: [
          "să studieze standardele raselor pe care le va arbitra",
          "să consulte poziția altor arbitri sau a persoanelor interesate",
          "să verifice programul expoziției",
        ],
      },
      {
        text: "Comunicarea cu proprietarii sau handlerii pe durata competiției este permisă:",
        optiuni: [
          "liber, fără restricții",
          "doar în afara ringului",
          "doar în limita strictului necesar tehnic",
        ],
      },
      {
        text: "Un arbitru poate judeca un câine pe care l-a deținut sau crescut în ultimele 12 luni?",
        optiuni: [
          "Nu",
          "Da, dacă anunță organizatorul",
          "Da, dacă respectivul câine concurează în altă grupă",
        ],
      },
      {
        text: "Câinii rudelor arbitrului, până la gradul II inclusiv:",
        optiuni: [
          "pot fi judecați fără restricții",
          "nu pot fi judecați de acel arbitru",
          "pot fi judecați doar la expoziții naționale",
        ],
      },
      {
        text: "Practica „arbitrajului reciproc” — doi arbitri își judecă alternativ câinii, sistematic, în scop de avantaj reciproc — este:",
        optiuni: [
          "permisă, dacă este declarată în scris",
          "tolerată la expozițiile mici",
          "interzisă",
        ],
      },
      {
        text: "Arbitrul poate accepta de la organizator:",
        optiuni: [
          "orice cadou primit înainte de judecată",
          "cazarea, masa, transportul în condiții uzuale, onorariul contractual și obiecte simbolice de protocol",
          "sume suplimentare oferite de expozanți",
        ],
      },
      {
        text: "O ofertă care depășește cadrul admis trebuie:",
        optiuni: [
          "refuzată politicos și raportată în scris Vicepreședintelui Tehnic, în termen de 7 zile",
          "acceptată, dacă rămâne confidențială",
          "redirecționată către club",
        ],
      },
      {
        text: "În arenă, arbitrul examinează:",
        optiuni: [
          "mai atent câinii favoriți la titlu",
          "fiecare câine cu aceeași atenție și o durată rezonabilă, comparabilă",
          "doar câinii din clasele superioare",
        ],
      },
      {
        text: "Decizia arbitrului se comunică:",
        optiuni: [
          "clar, ferm, fără ezitări sau ambiguități",
          "doar la finalul expoziției",
          "numai în scris, prin secretariat",
        ],
      },
      {
        text: "După judecată, arbitrul:",
        optiuni: [
          "poate critica public, denigrator, deciziile altor arbitri",
          "nu comentează public deciziile altor arbitri într-un mod denigrator",
          "este obligat să justifice public fiecare calificativ acordat",
        ],
      },
      {
        text: "Acceptarea unei misiuni de arbitraj fără declararea unei incompatibilități cunoscute constituie:",
        optiuni: [
          "o simplă neglijență administrativă",
          "o practică acceptată în comunitate",
          "abatere etică gravă",
        ],
      },
    ],
  },
  {
    slug: "modul-2",
    nr: 2,
    titlu: "Structura expozițiilor și clasele de înscriere",
    obiectiv:
      "Cunoașterea claselor de vârstă și a condițiilor de eligibilitate pentru câinii tineri și adulți, inclusiv clasa Winner.",
    lecturi: [
      { titlu: "Contextul de arbitraj — clase eligibile pentru câinii tineri", url: REG + "contextul-de-arbitraj-clase-eligibile-pentru-cainii-tineri/" },
      { titlu: "Contextul de arbitraj — câine adult eligibil", url: REG + "contextul-de-arbitraj-caine-adult-eligibil/" },
      { titlu: "Ce înseamnă titlul „Clasa Winner” în WDF", url: REG + "ce-inseamna-titlul-clasa-winner-in-wdf/" },
    ],
    intrebari: [
      { text: "În sistemul WDF, clasa Very Young este destinată câinilor tineri cu vârsta cuprinsă între:", optiuni: ["9–12 luni", "6–9 luni", "12–18 luni"] },
      { text: "Care dintre următoarele titluri NU poate fi acordat câinilor din clasele Very Young și Young/Junior?", optiuni: ["CAJC", "JBOB", "CACIB"] },
      { text: "Care este titlul maxim absolut pe care îl poate obține un câine junior în WDF?", optiuni: ["BOB (Best of Breed)", "Best in Show Junior (BIS Junior)", "Best in Show (BIS) la adulți"] },
      { text: "Conform regulamentului, Clasa Intermediară este destinată câinilor adulți cu vârsta între:", optiuni: ["15–24 luni", "12–18 luni", "18–24 luni"] },
      { text: "Ce condiții trebuie să îndeplinească un câine pentru a putea concura în Clasa Working?", optiuni: ["Vârsta minimă de 15 luni, fără alte condiții", "Vârsta minimă de 18 luni și rezultate la probe", "Deținerea a 4 certificate CAC la activ"] },
      { text: "La clasarea în clasă, arbitrul clasează primii 3 câini cu condiția ca aceștia să aibă:", optiuni: ["Calificativul minim Good (G)", "Toți calificativul Excellent (EXC)", "Calificativul minim Very Good (VG)"] },
      { text: "În ce condiții se acordă titlul CACIB la o expoziție WDF?", optiuni: ["Numai dacă expoziția este internațională, prin compararea câinilor care au obținut CAC", "La orice expoziție, tuturor câștigătorilor de clasă", "Automat, câinelui care câștigă BOB"] },
      { text: "Pentru a putea fi înscris în clasa Winner, un câine adult trebuie să aibă:", optiuni: ["2 certificate CACIB de la 2 arbitri diferiți", "4 certificate CAC WDF de la cel puțin 3 arbitri diferiți", "4 certificate CAC obținute toate de la același arbitru"] },
      { text: "Ce reprezintă „Winner” în sistemul WDF?", optiuni: ["Un titlu de sine stătător, echivalent cu CAC sau CACIB", "Un titlu internațional acordat automat campionilor naționali", "O clasă oficială de concurs; „Winner” este câștigătorul acestei clase"] },
      { text: "Ce calificativ trebuie să primească un câine în ring pentru a fi declarat câștigătorul clasei Winner?", optiuni: ["Very Good (VG)", "1 Excellent", "Minim Good (G)"] },
    ],
  },
  {
    slug: "modul-3",
    nr: 3,
    titlu: "Titlurile WDF: CAJC, CAC, CACIB, JBOB, BOB, BBR",
    obiectiv:
      "Stăpânirea procedurilor oficiale de atribuire a titlurilor și a diferențelor dintre ele.",
    lecturi: [
      { titlu: "Procedura oficială de atribuire a titlului CAJC", url: REG + "procedura-oficiala-de-atribuire-a-titlului-cajc/" },
      { titlu: "Procedura oficială de atribuire a titlului CAC", url: REG + "procedura-oficiala-de-atribuire-a-titlului-cac/" },
      { titlu: "Procedura oficială de atribuire a titlului CACIB", url: REG + "procedura-oficiala-de-atribuire-a-titlului-cacib/" },
      { titlu: "Procedura oficială — JBOB (Best of Breed Junior)", url: REG + "procedura-oficiala-de-atribuire-a-titlului-jbob-best-of-breed-junior/" },
      { titlu: "Procedura oficială — BOB (Best of Breed)", url: REG + "procedura-oficiala-pentru-atribuirea-titlului-bob-best-of-breed/" },
      { titlu: "Procedura oficială — BBR (Best Breed Representative)", url: REG + "procedura-oficiala-pentru-atribuirea-titlului-bbr/" },
      { titlu: "Deosebirea concretă dintre BOB și BBR", url: REG + "deosebirea-concreta-dintre-bob-si-bbr/" },
      { titlu: "Titlurile oficiale de campion WDF", url: REG + "titlurile-oficiale-de-campion-wdf/" },
    ],
    intrebari: [
      { text: "În ce clase poate fi acordat titlul CAJC?", optiuni: ["Numai în clasele Very Young (9–12 luni) și Young (12–18 luni)", "În clasele Baby, Puppy, Very Young și Young", "În toate clasele de tineret și în clasa Intermediară"] },
      { text: "Care sunt condițiile pentru obținerea titlului de Campion Junior WDF?", optiuni: ["6 certificate CAJC de la minimum 4 arbitri diferiți", "4 certificate CAJC de la cel puțin 3 arbitri diferiți", "3 certificate CAJC de la același arbitru"] },
      { text: "Câte certificate CAC se acordă într-o rasă la o expoziție?", optiuni: ["Câte unul pentru fiecare varietate a rasei", "Un singur CAC pe rasă, indiferent de sex", "1 CAC la mascul și 1 CAC la femelă, indiferent de numărul varietăților rasei"] },
      { text: "Cum se desfășoară play-off-ul pentru CAC conform Articolului 9?", optiuni: ["Se compară câștigătorii claselor Intermediară + Deschisă + Lucru („cel mai bun adult”) și separat câștigătorii claselor Winner + Champion + Foreign Champions („cel mai bun campion”), apoi arbitrul decide între cei doi", "Toți câștigătorii celor șase clase intră simultan într-o singură comparație directă, iar primul clasat primește CAC", "CAC se acordă direct câștigătorului clasei Deschisă, fără nicio comparație suplimentară"] },
      { text: "Ce condiție esențială trebuie să îndeplinească un câine pentru a putea primi CACIB?", optiuni: ["Să fi câștigat anterior un titlu de BOB la o expoziție națională", "Să fi obținut certificatul CAC, în cadrul unei expoziții internaționale recunoscute de WDF", "Să fi obținut calificativul 1 Excelent în clasa Young"] },
      { text: "Ce prevede regulamentul privind acordarea CACIB în absența unui play-off suplimentar între clase?", optiuni: ["Arbitrul alege liber orice câine cu calificativ Excelent din rasă", "CACIB nu se poate acorda deloc fără play-off", "Arbitrul este obligat să acorde CACIB subiectului căruia i-a acordat CAC"] },
      { text: "Ce reprezintă titlul JBOB și ce drept oferă câștigătorului?", optiuni: ["„Cel mai bun exemplar Junior al rasei” și asigură accesul în BIS Junior", "„Cel mai bun exemplar al rasei” și asigură accesul în BIS Adult", "O distincție onorifică pentru juniori, fără acces la nicio competiție ulterioară"] },
      { text: "Cum se stabilește JBOB Mascul în ring?", optiuni: ["Prin compararea tuturor masculilor din clasele Baby, Puppy, Very Young și Young", "Prin compararea câștigătorului clasei Very Young (mascul) cu câștigătorul clasei Young (mascul)", "Prin compararea câștigătorului clasei Young cu câștigătorul clasei Intermediare"] },
      { text: "Ce clase sunt implicate în competiția pentru titlul BOB?", optiuni: ["Toate clasele expoziției, inclusiv Very Young și Young", "Numai clasele Winner, Champion și Foreign Champions", "Clasele de adulți (Intermediară, Open, Working) și de campioni (Winner, Champion, Foreign Champions); juniorii nu concurează pentru BOB"] },
      { text: "Între ce câini se atribuie titlul BBR, conform Art. 12?", optiuni: ["Printr-o comparație directă în trei: câștigătorul Juniorilor (JBOB), câștigătorul Adulților și câștigătorul Campionilor", "Printr-un duel între BOB Mascul și BOB Femelă", "Printr-o comparație între toți câinii cu calificativul 1 Excelent din rasă"] },
      { text: "Care este deosebirea esențială dintre BOB și BBR în privința accesului la Best in Show (BIS)?", optiuni: ["Ambele titluri califică automat pentru ringul BIS", "BOB asigură accesul la BIS și este obligatoriu, în timp ce BBR nu influențează calificarea la BIS și este opțional", "BBR califică la BIS, iar BOB este doar o distincție onorifică internă rasei"] },
      { text: "Care sunt condițiile pentru obținerea titlului de Campion Național WDF?", optiuni: ["4 certificate CAC de la 3 arbitri diferiți, toate în expoziții naționale", "6 certificate CACIB de la 4 arbitri diferiți", "6 certificate CAC de la minimum 4 arbitri diferiți, dintre care cel puțin 1 CAC obținut într-o expoziție internațională"] },
    ],
  },
  {
    slug: "modul-4",
    nr: 4,
    titlu: "Procedura completă de arbitraj",
    obiectiv:
      "Parcurgerea pașilor examinării: intrarea în ring, evaluarea individuală, clasarea și consemnarea calificativelor.",
    lecturi: [
      { titlu: "Procedura completă de arbitraj WDF", url: REG + "procedura-completa-de-arbitraj-wdf/" },
    ],
    intrebari: [
      { text: "Conform procedurii WDF, ce tipuri de suprafețe sunt interzise pentru ringul de arbitraj?", optiuni: ["Pietrișul, molozul și suprafețele înclinate", "Iarba tunsă și pământul", "Orice suprafață care nu este acoperită cu mochetă"] },
      { text: "Ce se întâmplă cu un câine care nu se prezintă la apel în ring?", optiuni: ["Este mutat automat la finalul clasei sale", "Pierde dreptul de a fi arbitrat", "Primește din oficiu calificativul NOT JUDGEABLE"] },
      { text: "Câți comisari de ring (ring marshals) pot fi desemnați în ring, conform procedurii?", optiuni: ["Exact 3, câte unul pentru fiecare sarcină", "Minimum 4, în funcție de numărul de câini", "1–2 comisari de ring"] },
      { text: "În ce ordine intră câinii în ring?", optiuni: ["În ordinea aleasă liber de arbitru la fața locului", "În ordinea stabilită de organizatori, strict respectată", "În ordine alfabetică, după numele câinelui"] },
      { text: "Ce calificative pot primi câinii din clasele Baby / Puppy?", optiuni: ["Doar Very Promising, Promising și Quite Promising", "Aceleași calificative ca adulții: Excellent, Very Good, Good", "Doar Excellent sau Not Judgeable"] },
      { text: "Ce condiție trebuie să îndeplinească un câine pentru a putea fi inclus în clasamentul primilor 3 ai clasei?", optiuni: ["Să fi obținut calificativul Excellent", "Să fi obținut cel puțin calificativul Good", "Să fi obținut cel puțin calificativul Very Good"] },
      { text: "În ce condiții poate fi acordat titlul CACIB?", optiuni: ["În orice expoziție, dacă câinele a obținut Excellent", "Doar în expoziții internaționale și doar dacă câinele a primit CAC", "Doar în expoziții naționale, la propunerea comisarului de ring"] },
      { text: "Ce poate modifica arbitrul după predarea documentelor la secretariat?", optiuni: ["Nimic: nici calificative, nici clasări, nici titluri CAJC / CAC / CACIB", "Doar calificativele, nu și clasările", "Orice, cu acordul scris al delegatului WDF"] },
      { text: "În care dintre următoarele situații se acordă calificativul „Not Judgeable”?", optiuni: ["Când câinele are un defect eliminatoriu prevăzut de standard", "Când câinele este sub vârsta minimă de participare", "Când câinele nu se lasă examinat, sare, fuge sau prezintă urme de intervenții"] },
      { text: "Cum procedează arbitrul dacă în timpul arbitrajului apar strigăte, apeluri duble sau comportament neregulamentar?", optiuni: ["Descalifică imediat câinii implicați", "Oprește arbitrajul și cere intervenția delegatului WDF", "Continuă arbitrajul și raportează incidentul la final"] },
    ],
  },
  {
    slug: "modul-5",
    nr: 5,
    titlu: "Ringul de onoare (Best in Show)",
    obiectiv:
      "Organizarea ringului de onoare, categoriile BIS și principiile de departajare.",
    lecturi: [
      { titlu: "Ringul de onoare — arbitraj avansat", url: REG + "ringul-de-onoare-arbitraj-avansat/" },
    ],
    intrebari: [
      { text: "Conform ordinii standard WDF, care este prima categorie care intră în Ringul de Onoare?", optiuni: ["BIS Junior", "BIS Puppies", "BIS Champions"] },
      { text: "Câți arbitri sunt desemnați pentru fiecare categorie din Ringul de Onoare?", optiuni: ["Un singur arbitru", "O echipă de trei arbitri", "Doi arbitri, unul principal și unul de rezervă"] },
      { text: "Ce sistem de apreciere se folosește în Ringul de Onoare?", optiuni: ["Calificative de la Excelent la Suficient", "Punctaje de la 1 la 100 acordate de arbitru", "Nu există calificative, doar clasament Top 5"] },
      { text: "Cum sunt poziționați câinii la alinierea în Ringul de Onoare?", optiuni: ["În două coloane paralele, față în față", "Pe un semicerc larg sau în linie frontală", "În ordine descrescătoare a taliei, în careu"] },
      { text: "Pentru câte exemplare poate cere arbitrul un ultim tur sincronizat la evaluarea finală?", optiuni: ["Pentru primele 6–7 exemplare", "Pentru primele 3 exemplare", "Pentru toate exemplarele din ring, obligatoriu"] },
      { text: "Prin ce se deosebește compararea directă din Ringul de Onoare față de ringul individual?", optiuni: ["În Ringul de Onoare se compară doar exemplare din aceeași rasă", "În Ringul de Onoare comparația se face exclusiv în statică", "În Ringul de Onoare arbitrii compară între rase"] },
      { text: "Care este succesiunea corectă a procedurii de clasare atunci când sunt mulți participanți?", optiuni: ["Top 5, apoi Top 3, apoi desemnarea câștigătorului", "Top 10, apoi Top 6, apoi clasamentul final Top 5", "Top 12, apoi Top 8, apoi clasamentul final Top 6"] },
      { text: "Care este criteriul principal de evaluare la BIS Couple (Perechi)?", optiuni: ["Omogenitatea perechii", "Talia cât mai mare a ambilor câini", "Numărul de titluri obținute anterior de pereche"] },
      { text: "Care este criteriul principal de evaluare la BIS Breeding Group (Loturi de reproducție)?", optiuni: ["Numărul de descendenți prezentați în lot", "Viteza și sincronizarea deplasării în ring", "Unitatea de tip și linie"] },
      { text: "Cui poate explica arbitrul deciziile luate în Ringul de Onoare?", optiuni: ["Handlerilor, la cererea acestora", "Doar organizatorilor, nu handlerilor", "Publicului, prin anunț la stația de sonorizare"] },
    ],
  },
  {
    slug: "modul-6",
    nr: 6,
    titlu: "Situații speciale: DSQ, N.J., abateri",
    obiectiv:
      "Recunoașterea situațiilor care impun descalificarea (DSQ) sau calificativul „nu se poate judeca” (N.J.) și procedura de constatare a abaterilor.",
    lecturi: [
      { titlu: "Situații care impun DSQ (descalificare) sau N.J. (Not Judgable)", url: REG + "situatii-care-impun-dsq-descalificare-sau-nj-not-judgable/" },
      { titlu: "Procedura de constatare a abaterilor", url: REG + "procedura-de-constatare-a-abaterilor/" },
    ],
    intrebari: [
      { text: "Un câine atacă arbitrul în timpul evaluării. Conform regulamentului, ce decizie trebuie să ia arbitrul?", optiuni: ["Acordă N.J. și permite câinelui să revină la următoarea expoziție", "Acordă DSQ imediat, fără negociere și fără reluarea evaluării", "Suspendă temporar evaluarea și o reia după ce câinele se calmează"] },
      { text: "Arbitrul suspectează o intervenție corectivă asupra câinelui, dar nu poate confirma 100% acest lucru. Ce decizie trebuie să ia?", optiuni: ["Acordă N.J., deoarece fără probe clare nu poate acorda DSQ", "Acordă DSQ preventiv și cheamă Delegatul WDF", "Continuă evaluarea normal și menționează suspiciunea doar în raportul final"] },
      { text: "Câinele se ferește, se trage înapoi și nu deschide gura, astfel încât arbitrul nu poate verifica dentiția. Ce decizie se impune?", optiuni: ["DSQ, deoarece refuzul examinării este un defect eliminatoriu", "Acordarea calificativului G (Good), cu mențiune în fișă", "N.J., deoarece câinele nu poate fi evaluat"] },
      { text: "Handlerul blochează dentiția și forțează poziționarea câinelui, făcând verificarea imposibilă. Care este consecința prevăzută?", optiuni: ["N.J. pentru câine, plus avertizare", "DSQ imediat pentru câine și anchetă disciplinară WDF", "Excluderea definitivă a handlerului de la toate expozițiile viitoare, decisă de arbitru"] },
      { text: "În procedura obligatorie pentru DSQ, cine preia fișa de arbitraj și carnetul de calificări?", optiuni: ["Arbitrul, care le păstrează până la finalul expoziției", "Organizatorul expoziției, care le arhivează local", "Delegatul WDF, care completează raportul oficial transmis la sediul WDF"] },
      { text: "Care este o diferență fundamentală între DSQ și N.J.?", optiuni: ["N.J. se raportează disciplinar, iar DSQ rămâne doar la nivelul expoziției", "N.J. nu implică penalizare disciplinară, în timp ce DSQ implică", "DSQ este o decizie temporară, iar N.J. este definitivă"] },
      { text: "Cine are autoritatea supremă în cadrul evenimentului expozițional și poate decide excluderea câinelui sau a participantului?", optiuni: ["Delegatul WDF", "Arbitrul (Expertul Judecător)", "Medicul veterinar al expoziției"] },
      { text: "Ce competență are medicul veterinar al expoziției în procedura de constatare a abaterilor?", optiuni: ["Poate declara DSQ sau N.J. pentru câinii cu probleme medicale", "Soluționează reclamațiile expozanților și dispune sancțiuni imediate", "Poate constata probleme medicale care impun excluderea și poate recomanda delegatului excluderea"] },
      { text: "Cine întocmește procesul verbal de abatere în situațiile grave (identitate neconformă, substanțe interzise, fraudă)?", optiuni: ["Arbitrul, imediat după terminarea judecății rasei", "Delegatul WDF, iar documentul include martori, dovezi și declarații", "Organizatorul expoziției, împreună cu handlerul implicat"] },
      { text: "Până când pot depune expozanții o reclamație conform procedurii oficiale (art. 36 WDF)?", optiuni: ["Înainte de finalizarea judecării rasei", "În termen de 30 de zile de la încheierea expoziției", "Oricând, până la publicarea rezultatelor oficiale pe site-ul WDF"] },
    ],
  },
  {
    slug: "modul-7",
    nr: 7,
    titlu: "Contestații și procedura disciplinară",
    obiectiv:
      "Dreptul la contestație, pașii de soluționare și cadrul disciplinar al Asociației.",
    lecturi: [
      { titlu: "Procedura oficială a contestațiilor WDF", url: REG + "procedura-oficiala-a-contestatiilor-wdf/" },
      { titlu: "Procedura disciplinară detaliată", url: DOC + "procedura-disciplinara/" },
    ],
    intrebari: [
      { text: "Conform Procedurii oficiale a contestațiilor WDF, cine poate formula o contestație la o expoziție?", optiuni: ["Orice persoană din public care a observat o neregulă în ring", "Expozantul/proprietarul câinelui sau handlerul, în numele proprietarului", "Doar arbitrul de ring, prin raport adresat Delegatului WDF"] },
      { text: "Până când poate fi contestată o situație din ring, conform regulamentului WDF?", optiuni: ["Doar înainte de finalizarea judecării rasei", "În termen de 24 de ore de la închiderea expoziției", "Oricând, până la omologarea calificativelor de către WDF"] },
      { text: "Care dintre următoarele NU poate fi contestată, în mod absolut, conform Procedurii WDF?", optiuni: ["O eroare procedurală, precum evaluarea câinelui într-o clasă greșită", "O neregulă administrativă, precum un număr de catalog greșit", "Calificativul acordat de arbitru (EXC, VG, G etc.) și ordinea clasamentului"] },
      { text: "Cum se depune corect o contestație la o expoziție WDF?", optiuni: ["Verbal, direct la arbitrul de ring, imediat după evaluare", "În scris, pe formularul oficial, la Secretariatul expoziției, care notifică imediat Delegatul WDF", "Prin e-mail transmis Comisiei Disciplinare WDF, în termen de 7 zile"] },
      { text: "Ce statut are decizia Delegatului WDF asupra unei contestații?", optiuni: ["Este finală pe durata expoziției", "Este provizorie și trebuie confirmată de arbitrul-șef al expoziției", "Poate fi răsturnată pe loc printr-un vot al expozanților din ring"] },
      { text: "Conform Procedurii disciplinare a Asociației, în ce termen se prescrie răspunderea disciplinară pentru abaterile grave?", optiuni: ["6 luni de la data săvârșirii faptei", "3 ani de la data săvârșirii faptei", "12 luni de la data săvârșirii faptei"] },
      { text: "Cum este constituită Comisia de Etică și Disciplină a Asociației?", optiuni: ["Este un organ permanent format din cinci membri, aleși de Adunarea Generală pe 4 ani", "Se constituie ad-hoc, pentru fiecare dosar, din trei membri, prin decizia Consiliului Director", "Este formată din toți membrii Consiliului Director, prezidată de Președinte"] },
      { text: "În ce categorie de abateri se încadrează, de regulă, încălcarea prevederilor privind bunăstarea animalului?", optiuni: ["Abateri foarte grave", "Abateri grave", "Abateri ușoare, dacă fapta este la prima abatere"] },
      { text: "În ce termen și la ce organ poate fi contestată decizia disciplinară a Consiliului Director?", optiuni: ["În 10 zile lucrătoare, la Comisia de Etică și Disciplină", "În 15 zile calendaristice, la Președintele Asociației", "În 30 de zile calendaristice de la comunicare, la Adunarea Generală"] },
      { text: "Care este termenul de finalizare a cercetării disciplinare, conform Procedurii Asociației?", optiuni: ["30 de zile calendaristice, fără posibilitate de prelungire", "60 de zile calendaristice de la înregistrarea sesizării, cu prelungire posibilă de maximum 30 de zile", "90 de zile lucrătoare, cu prelungire nelimitată aprobată de Comisie"] },
    ],
  },
  {
    slug: "modul-8",
    nr: 8,
    titlu: "Rolul delegatului WDF",
    obiectiv:
      "Autoritatea, atribuțiile și raportul delegatului WDF în cadrul evenimentului expozițional.",
    lecturi: [
      { titlu: "Rolul delegatului WDF", url: REG + "rolul-delegatului-wdf/" },
    ],
    intrebari: [
      { text: "Cine este delegatul WDF în cadrul unei expoziții recunoscute?", optiuni: ["Reprezentantul oficial al Federației Mondiale WDF, cu rol de supraveghere, control, validare, intervenție și raportare", "Un arbitru cu grad superior, care judecă finalele și poate modifica notele acordate de ceilalți arbitri", "Reprezentantul clubului organizator, responsabil de logistica și promovarea evenimentului"] },
      { text: "Care este limita autorității delegatului WDF în raport cu arbitrii?", optiuni: ["Poate schimba deciziile de specialitate ale arbitrilor dacă nu este de acord cu ele", "Nu influențează deciziile de specialitate ale arbitrilor, dar are autoritate superioară asupra procedurilor, disciplinei și deciziilor administrative", "Are autoritate doar asupra handlerilor, nu și asupra procedurilor administrative"] },
      { text: "Ce echipament obligatoriu verifică delegatul WDF înainte de începerea expoziției?", optiuni: ["Sistemul de sonorizare, panourile de afișaj și cronometrele electronice", "Trusa veterinară de urgență, cântarul și camerele de supraveghere", "Cinometrul, ruleta și cititorul de microchip"] },
      { text: "Conform sursei, ce condiție se aplică schimbării arbitrilor desemnați la o expoziție?", optiuni: ["Schimbările sunt permise liber, cu simpla anunțare a expozanților", "Nu sunt permise schimbări fără aprobarea delegatului", "Schimbările sunt permise doar cu acordul scris al tuturor expozanților din clasele afectate"] },
      { text: "Ce trebuie să facă delegatul WDF atunci când un arbitru decide descalificarea (DSQ) unui câine, conform Art. 16?", optiuni: ["Să fie chemat imediat în ring, să preia fișa de arbitraj și carnetul câinelui, să confirme procedura și să trimită documentele la WDF pentru analiză disciplinară", "Să anuleze descalificarea dacă apreciază că motivul arbitrului este exagerat", "Să aplice pe loc o suspendare de doi ani câinelui și handlerului implicat"] },
      { text: "Ce poate face delegatul WDF dacă descoperă date eronate privind un câine (ex. sex greșit, vârstă, varietate, mărime), conform Art. 6?", optiuni: ["Trebuie să excludă obligatoriu câinele din expoziție, fără excepții", "Poate doar să noteze eroarea în raport, fără a interveni în ziua expoziției", "Poate modifica pe loc clasa câinelui, evitând excluderea prin corectarea clasei, dacă este posibil"] },
      { text: "Ce rol are delegatul WDF atunci când un arbitru acordă calificativul N.J. (Not Judgable)?", optiuni: ["Transformă automat N.J. în descalificare (DSQ)", "Poate decide dacă se permite reluarea evaluării, de exemplu dacă problema a fost de moment (frică, panică, manipulare greșită de handler)", "Anulează calificativul N.J. și acordă el însuși o notă câinelui"] },
      { text: "Cum tratează delegatul WDF reclamațiile, conform Art. 36?", optiuni: ["Le primește doar verbal și le rezolvă exclusiv după încheierea expoziției", "Le redirecționează pe toate, fără verificări, către clubul organizator", "Le primește în scris, face verificările pe loc, ia o decizie imediată, iar cazurile mai complexe le transmite Comisiei Disciplinare WDF sau Biroului tehnic WDF"] },
      { text: "Ce atribuție are delegatul WDF în privința titlurilor precum CAJC, CAC, CACIB, BOB?", optiuni: ["Confirmă corectitudinea lor înainte ca secretariatul să le omologheze și le poate invalida dacă observă nereguli", "Le acordă direct câinilor, în locul arbitrilor", "Le omologhează definitiv, fără drept de invalidare ulterioară"] },
      { text: "Ce conține „Raportul Delegatului”, completat după expoziție și trimis la sediul WDF?", optiuni: ["Doar lista câștigătorilor și clasamentele finale ale expoziției", "Exclusiv situația financiară a evenimentului și numărul de înscrieri", "Incidente disciplinare, DSQ-uri, nereguli tehnice, observații despre arbitri, probleme organizatorice și recomandări"] },
    ],
  },
];

/** Pragul de promovare a testelor (procent). */
export const PRAG_PROMOVARE = 70;

/** SHA-256 al codului de acces al CANDIDAȚILOR (codul în sine NU apare în cod). */
export const ACCES_HASH = "48493761ba33bce0e9919789a88582a482179869fa76dbbaa93be7d67dad5470";

/** SHA-256 al codului de ADMINISTRATOR (acces la toată platforma). */
export const ADMIN_HASH = "66c260e81fd07dae6c76578609d8e4982cb92bd510a7fde396069de586bd2bfb";

// =========================================================================
// LECTORI — fiecare are spațiul lui la /cursuri/lector/<slug>/, accesibil
// doar cu codul lui (sau cu codul de administrator). Materialele de curs
// se publică aici (un fișier PDF/pagină per material), pe măsură ce sosesc.
// =========================================================================

export interface Material {
  titlu: string;
  url: string; // ex. /cursuri-materiale/<lector>/<fisier>.pdf sau pagină internă
  data?: string; // ex. "3 iulie 2026"
  /** Versiunea text (Markdown) a cursului — folosită de teleprompter la „Încarcă un curs”. */
  md?: string;
}

export interface Lector {
  slug: string;
  nume: string;
  rol: string;
  hash: string; // SHA-256 al codului de acces personal
  materiale: Material[];
}

export const LECTORI: Lector[] = [
  {
    slug: "flavian-savescu",
    nume: "Flavian-Sergiu Savescu",
    rol: "Președinte al Colegiului de Arbitri · WDF All Breed",
    hash: "71a012c1d53cdf7fc5b94202c736827245baa8cc3d629e674e8a6074266c8c14",
    materiale: [
      { titlu: "Suport de curs 4.1 — Regulamente WDF și standarde (PDF)", url: "/cursuri-materiale/flavian-savescu/suport-curs-4-1-regulamente-wdf-si-standarde.pdf", md: "/cursuri-materiale/flavian-savescu/suport-curs-4-1-regulamente-wdf-si-standarde.md" },
      { titlu: "Suport de curs 4.3 — Codul Etic al arbitrului (PDF)", url: "/cursuri-materiale/flavian-savescu/suport-curs-4-3-cod-etic-arbitru.pdf", md: "/cursuri-materiale/flavian-savescu/suport-curs-4-3-cod-etic-arbitru.md" },
      { titlu: "Orarul cursurilor 4.1 și 4.3 (PDF)", url: "/cursuri-materiale/flavian-savescu/orar-curs-4-1-si-4-3.pdf" },
    ],
  },
  {
    slug: "mihail-cosmin-neagu",
    nume: "Mihail Cosmin Neagu",
    rol: "Arbitru WDF · All Breed",
    hash: "21048e2893df687a5195519e5d665440c99a6060e11044fb2509b886ca0cc8b9",
    materiale: [],
  },
  {
    slug: "georgeta-mihaela-chivu",
    nume: "Georgeta Mihaela Chivu",
    rol: "Arbitru WDF · All Breed",
    hash: "ddd1b278ddf55141d8f2bca8857160b38cc64024e3f5b4368cbebee329442817",
    materiale: [
      { titlu: "Suport de curs 4.2.4 — Handling expozițional (PDF)", url: "/cursuri-materiale/georgeta-mihaela-chivu/suport-curs-4-2-4-handling-expozitional.pdf", md: "/cursuri-materiale/georgeta-mihaela-chivu/suport-curs-4-2-4-handling-expozitional.md" },
      { titlu: "Suport de curs 4.4.5 — Grooming canin (PDF)", url: "/cursuri-materiale/georgeta-mihaela-chivu/suport-curs-4-4-5-grooming-canin.pdf", md: "/cursuri-materiale/georgeta-mihaela-chivu/suport-curs-4-4-5-grooming-canin.md" },
      { titlu: "Orarul cursurilor 4.2.4 și 4.4.5 (PDF)", url: "/cursuri-materiale/georgeta-mihaela-chivu/orar-curs-4-2-4-si-4-4-5.pdf" },
    ],
  },
  {
    slug: "mihail-sorin-iacob",
    nume: "Mihail Sorin Iacob",
    rol: "Arbitru WDF · All Breed",
    hash: "d3c043092f13a97d4d83dd0df96be08162ec7e26ea7241dc1da685c8d89e1b18",
    materiale: [],
  },
  {
    slug: "andreea-daniela-popescu",
    nume: "Andreea-Daniela Popescu",
    rol: "Arbitru WDF · Grupele 3, 5, 9",
    hash: "3a7948f0609b92e2a9a46075b909600eec39244f36bc2477c32f9bbc1484f697",
    materiale: [],
  },
  {
    slug: "alexandru-paul-ciolac",
    nume: "Alexandru Paul Ciolac",
    rol: "Arbitru WDF · Grupele 2, 3, 4, 6, 8",
    hash: "eb393a27cbaf6fd51833e060e8a421912f17b1b12ea8c499e2084305397cc1d7",
    materiale: [],
  },
];
