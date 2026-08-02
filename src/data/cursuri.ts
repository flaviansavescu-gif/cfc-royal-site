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
      { text: "Ce condiție esențială trebuie să îndeplinească un câine pentru a putea primi CACIB?", optiuni: ["Să fi câștigat anterior un titlu de BOB la o expoziție națională", "Să fi obținut certificatul CAC, în cadrul unei expoziții internaționale recunoscute de WDF", "Să fi obținut calificativul 1 Excellent în clasa Young"] },
      { text: "Ce prevede regulamentul privind acordarea CACIB în absența unui play-off suplimentar între clase?", optiuni: ["Arbitrul alege liber orice câine cu calificativ Excellent din rasă", "CACIB nu se poate acorda deloc fără play-off", "Arbitrul este obligat să acorde CACIB subiectului căruia i-a acordat CAC"] },
      { text: "Ce reprezintă titlul JBOB și ce drept oferă câștigătorului?", optiuni: ["„Cel mai bun exemplar Junior al rasei” și asigură accesul în BIS Junior", "„Cel mai bun exemplar al rasei” și asigură accesul în BIS Adult", "O distincție onorifică pentru juniori, fără acces la nicio competiție ulterioară"] },
      { text: "Cum se stabilește JBOB Mascul în ring?", optiuni: ["Prin compararea tuturor masculilor din clasele Baby, Puppy, Very Young și Young", "Prin compararea câștigătorului clasei Very Young (mascul) cu câștigătorul clasei Young (mascul)", "Prin compararea câștigătorului clasei Young cu câștigătorul clasei Intermediare"] },
      { text: "Ce clase sunt implicate în competiția pentru titlul BOB?", optiuni: ["Toate clasele expoziției, inclusiv Very Young și Young", "Numai clasele Winner, Champion și Foreign Champions", "Clasele de adulți (Intermediară, Open, Working) și de campioni (Winner, Champion, Foreign Champions); juniorii nu concurează pentru BOB"] },
      { text: "Între ce câini se atribuie titlul BBR, conform Art. 12?", optiuni: ["Printr-o comparație directă în trei: câștigătorul Juniorilor (JBOB), câștigătorul Adulților și câștigătorul Campionilor", "Printr-un duel între BOB Mascul și BOB Femelă", "Printr-o comparație între toți câinii cu calificativul 1 Excellent din rasă"] },
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
      { text: "Ce sistem de apreciere se folosește în Ringul de Onoare?", optiuni: ["Calificative de la Excellent la Suficient", "Punctaje de la 1 la 100 acordate de arbitru", "Nu există calificative, doar clasament Top 5"] },
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
      { titlu: "Situații care impun DSQ (descalificare) sau N.J. (Not Judgeable)", url: REG + "situatii-care-impun-dsq-descalificare-sau-nj-not-judgable/" },
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
      { text: "Ce rol are delegatul WDF atunci când un arbitru acordă calificativul N.J. (Not Judgeable)?", optiuni: ["Transformă automat N.J. în descalificare (DSQ)", "Poate decide dacă se permite reluarea evaluării, de exemplu dacă problema a fost de moment (frică, panică, manipulare greșită de handler)", "Anulează calificativul N.J. și acordă el însuși o notă câinelui"] },
      { text: "Cum tratează delegatul WDF reclamațiile, conform Art. 36?", optiuni: ["Le primește doar verbal și le rezolvă exclusiv după încheierea expoziției", "Le redirecționează pe toate, fără verificări, către clubul organizator", "Le primește în scris, face verificările pe loc, ia o decizie imediată, iar cazurile mai complexe le transmite Comisiei Disciplinare WDF sau Biroului tehnic WDF"] },
      { text: "Ce atribuție are delegatul WDF în privința titlurilor precum CAJC, CAC, CACIB, BOB?", optiuni: ["Confirmă corectitudinea lor înainte ca secretariatul să le omologheze și le poate invalida dacă observă nereguli", "Le acordă direct câinilor, în locul arbitrilor", "Le omologhează definitiv, fără drept de invalidare ulterioară"] },
      { text: "Ce conține „Raportul Delegatului”, completat după expoziție și trimis la sediul WDF?", optiuni: ["Doar lista câștigătorilor și clasamentele finale ale expoziției", "Exclusiv situația financiară a evenimentului și numărul de înscrieri", "Incidente disciplinare, DSQ-uri, nereguli tehnice, observații despre arbitri, probleme organizatorice și recomandări"] },
    ],
  },

  // ——— Module din programa oficială (Modul Teoretic 2026). Se completează cu lecturi
  //     și teste pe măsură ce lectorii își publică cursurile. ———
  {
    slug: "modul-9",
    nr: 9,
    titlu: "Introducere în chinologie",
    obiectiv:
      "Importanța studiului chinologiei, situația chinologiei pe plan mondial și dezvoltarea ei în România; distincția dintre chinologie și chinofilie. (Cap. I din programă)",
    lecturi: [],
  },
  {
    slug: "modul-10",
    nr: 10,
    titlu: "Sistematica zootehnică: specia, domesticirea și rasele canine",
    obiectiv:
      "Specia ca unitate sistematică, domesticirea câinelui și noțiunile despre rasele canine: subdiviziuni, factorii de formare, caracterele de rasă, clasificarea raselor (standardele), aclimatizarea și degenerarea raselor. (Cap. II)",
    lecturi: [],
  },
  {
    slug: "modul-11",
    nr: 11,
    titlu: "Anatomie, morfologie și biomecanică canină",
    obiectiv:
      "Osteologia, sistemul muscular, regiunile corporale și zoometria; biomecanica și mișcarea câinelui — baza evaluării morfologice în ring. (Cap. III.1)",
    lecturi: [],
  },
  {
    slug: "modul-12",
    nr: 12,
    titlu: "Genetică, etologie, nutriție, reproducție și patologie canină",
    obiectiv:
      "Noțiuni elementare de ereditate și ameliorare genetică, etologia canină (aprecierea caracterului), nutriția și alimentația, reproducția și aspectele generale despre patologiile canine și ereditatea unor maladii. (Cap. III.2–3.6)",
    lecturi: [],
  },
  {
    slug: "modul-13",
    nr: 13,
    titlu: "Metodologia examinării în ring",
    obiectiv:
      "Interpretarea standardului de rasă, tehnicile de arbitraj chinologic, evaluarea tipicității, clasificarea defectelor și acordarea calificativelor și a titlurilor. (Cap. IV.2.1)",
    lecturi: [],
  },
  {
    slug: "modul-14",
    nr: 14,
    titlu: "Fișa de arbitraj și documentele expoziției",
    obiectiv:
      "Identificarea exemplarului, arbitrajul descriptiv (expoziții de frumusețe) și cel specific raselor utilitare, măsurătorile corporale (zoometria), completarea și validarea fișei, centralizarea rezultatelor și raportul arbitrului de ring. (Cap. IV.2.2)",
    lecturi: [],
  },
  {
    slug: "modul-15",
    nr: 15,
    titlu: "Managementul ringului expozițional",
    obiectiv:
      "Organigrama echipei manageriale, organizarea ringului central și a celorlalte ringuri, rolurile de arbitru, comisar și secretar, amenajarea ringurilor și instrumentarul zootehnic necesar. (Cap. IV.2.3)",
    lecturi: [],
  },
  {
    slug: "modul-16",
    nr: 16,
    titlu: "Handling și grooming expozițional",
    obiectiv:
      "Noțiuni generale despre handling-ul expozițional și despre grooming-ul canin — pregătirea și prezentarea câinelui în ring. (Cap. IV.2.4 și 4.4.5)",
    lecturi: [],
  },
  {
    slug: "modul-17",
    nr: 17,
    titlu: "Legislația care reglementează creșterea câinilor",
    obiectiv:
      "Aspecte de legislație relevante pentru creșterea câinilor și pentru activitatea arbitrului chinolog. (Cap. IV.4)",
    lecturi: [],
  },
];

/** Pragul de promovare a testelor (procent). */
export const PRAG_PROMOVARE = 70;

// =========================================================================
// SECURITATE — amprentele codurilor NU mai stau aici.
//
// Acest fișier ajunge în HTML-ul public al paginilor. Cât timp conținea
// SHA-256 al codurilor, oricine le putea citi de pe site și sparge offline un
// cod scurt, fără limită de încercări. Amprentele trăiesc acum exclusiv pe
// server, în `netlify/functions/_comun/roluri.mjs`, iar poarta de intrare
// (`acces-cursuri`) verifică fiecare cod acolo, cu limitare a încercărilor.
//
// Paginile se deschid pe baza ROLULUI primit de la server (care nu e secret):
//   "admin" · "lector" · "lector:<slug>" · "acces" (cod comun) · candidat.
// =========================================================================

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
  materiale: Material[];
  // Amprenta codului personal NU se află aici — vezi nota de securitate de mai sus.
}

export const LECTORI: Lector[] = [
  {
    slug: "flavian-savescu",
    nume: "Flavian-Sergiu Savescu",
    rol: "Președinte al Colegiului de Arbitri · WDF All Breed",
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
    materiale: [],
  },
  {
    slug: "georgeta-mihaela-chivu",
    nume: "Georgeta Mihaela Chivu",
    rol: "Arbitru WDF · All Breed",
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
    materiale: [],
  },
  {
    slug: "andreea-daniela-popescu",
    nume: "Andreea-Daniela Popescu",
    rol: "Arbitru WDF · Grupele 3, 5, 9",
    materiale: [],
  },
  {
    slug: "alexandru-paul-ciolac",
    nume: "Alexandru Paul Ciolac",
    rol: "Arbitru WDF · Grupele 2, 3, 4, 6, 8",
    // Fără versiunea .md pentru teleprompter: PDF-urile sunt pagini-imagine, textul nu se
    // poate scoate din ele. Dacă sosesc și fișierele-sursă (Word), se adaugă.
    materiale: [
      { titlu: "Suport de curs — Preambul (PDF)", url: "/cursuri-materiale/alexandru-paul-ciolac/suport-curs-01-preambul.pdf" },
      { titlu: "Suport de curs 1.1 — Capitolul I: Importanța studiului (PDF)", url: "/cursuri-materiale/alexandru-paul-ciolac/suport-curs-1-1-importanta-studiului.pdf" },
      { titlu: "Suport de curs 1.2 — Capitolul I: Chinologia în plan mondial (PDF)", url: "/cursuri-materiale/alexandru-paul-ciolac/suport-curs-1-2-chinologia-in-plan-mondial.pdf" },
    ],
  },
];

// =========================================================================
// MANUALUL DE STUDIU INDIVIDUAL — material COMUN (candidați + lectori).
//
// Paginile manualului NU se află în `public/`: acolo ar fi accesibile oricui le-ar
// ghici adresa, fiindcă poarta de rol nu apără fișierele statice. Ele stau în
// `material-studiu/` (inclus doar în pachetul funcției) și se servesc prin
// `netlify/functions/material-protejat.mjs`, filigranate pe server cu numele
// cititorului. Aici păstrăm doar datele publice: titlu, cuprins, întrebări.
//
// Ca la module, întrebările NU conțin răspunsul corect — cheia stă pe server,
// în `netlify/functions/test-modul.mjs`, sub cheia „manual-studiu”.
// =========================================================================

export interface ModulManual {
  nr: number;
  titlu: string;
  start: number;
  sfarsit: number;
}

export const MANUAL = {
  slug: "manual-studiu",
  titlu: "Noțiuni de bază în arbitrajul chinologic",
  descriere:
    "Manual vizual pentru studiu individual — 128 de pagini, 8 module, conform regulamentelor WDF și CFC-Royal. " +
    "Se parcurge de trei ori: întâi integral, apoi doar rubricile „De reținut”, iar la final Modulul 8 (sinteze și autoevaluare).",
  pagini: 128,
  module: [
    { nr: 1, titlu: "Introducere", start: 2, sfarsit: 8 },
    { nr: 2, titlu: "Anatomia câinelui", start: 9, sfarsit: 39 },
    { nr: 3, titlu: "Exteriorul câinelui", start: 40, sfarsit: 81 },
    { nr: 4, titlu: "Dentiția", start: 82, sfarsit: 89 },
    { nr: 5, titlu: "Expoziția canină", start: 90, sfarsit: 102 },
    { nr: 6, titlu: "Metodica de arbitraj", start: 103, sfarsit: 115 },
    { nr: 7, titlu: "Etică și deontologie", start: 116, sfarsit: 121 },
    { nr: 8, titlu: "Sinteze și autoevaluare", start: 122, sfarsit: 128 },
  ] as ModulManual[],
  intrebari: [
    {
      text: "Principiul care stă la baza întregului material este:",
      optiuni: [
        "se premiază câinele la care se găsesc cele mai puține abateri",
        "se premiază cel mai bun câine în ansamblu, nu cel cu cele mai puține defecte",
        "se premiază câinele cu cea mai bună mișcare, indiferent de tipicitate",
      ],
    },
    {
      text: "Cele trei unghiuri de analiză a exemplarului sunt:",
      optiuni: [
        "frontal și lateral, cel dorsal fiind opțional",
        "cele alese de arbitru, în funcție de rasă",
        "frontal, lateral și dorsal, parcurse în aceeași ordine la fiecare câine",
      ],
    },
    {
      text: "Formula vertebrală a câinelui (cervicale · toracice · lombare · sacrale · caudale) este:",
      optiuni: ["7 · 13 · 7 · 3 · 18–22", "7 · 12 · 6 · 4 · 15–20", "5 · 13 · 7 · 3 · 20–24"],
    },
    {
      text: "Baza anatomică a greabănului — punctul până la care se măsoară talia — este dată de:",
      optiuni: [
        "primele două vertebre cervicale (atlasul și axisul)",
        "marginea superioară a scapulei",
        "apofizele spinale ale vertebrelor toracice",
      ],
    },
    {
      text: "Cele 13 perechi de coaste ale câinelui se împart în:",
      optiuni: [
        "9 perechi sternale și 4 asternale",
        "8 perechi sternale și 5 asternale",
        "10 perechi sternale și 3 asternale",
      ],
    },
    {
      text: "Diferența dintre monorhidie și criptorhidie este:",
      optiuni: [
        "monorhidie — niciun testicul coborât; criptorhidie — unul singur coborât",
        "monorhidie — un singur testicul coborât; criptorhidie — niciunul coborât",
        "sunt două denumiri pentru aceeași anomalie",
      ],
    },
    {
      text: "Dentiția definitivă a câinelui numără:",
      optiuni: [
        "42 de dinți: 12 incisivi, 4 canini, 16 premolari, 10 molari",
        "42 de dinți: 12 incisivi, 4 canini, 14 premolari, 12 molari",
        "44 de dinți: 12 incisivi, 4 canini, 16 premolari, 12 molari",
      ],
    },
    {
      text: "Carnasierii sunt:",
      optiuni: [
        "cei patru canini",
        "primul premolar superior și ultimul molar inferior",
        "ultimul premolar superior (P4) și primul molar inferior (M1)",
      ],
    },
    {
      text: "Clasa Veterani se deschide de la vârsta de:",
      optiuni: ["8 ani", "10 ani", "7 ani"],
    },
    {
      text: "Pe lângă apropierea de standard, calificativul „Excelent” presupune:",
      optiuni: [
        "absența oricărui defect, oricât de mic",
        "cea mai bună mișcare din clasă, restul fiind secundar",
        "condiție perfectă, ansamblu armonios, temperament echilibrat și caracterele tipice ale sexului",
      ],
    },
    {
      text: "Clasamentul I–IV dintr-o clasă se face:",
      optiuni: [
        "între toți câinii prezentați în clasă, indiferent de calificativ",
        "numai între câinii care au obținut cel puțin calificativul „Foarte bun”",
        "doar dacă arbitrul consideră necesar",
      ],
    },
    {
      text: "Când într-o clasă sunt mai multe exemplare cu „Excelent”, arbitrul:",
      optiuni: [
        "este obligat să stabilească ierarhia de la I la IV",
        "poate lăsa clasa neierarhizată",
        "acordă titlul primului câine intrat în ring",
      ],
    },
    {
      text: "Motivul descalificării unui exemplar:",
      optiuni: [
        "se comunică doar verbal expozantului",
        "se consemnează obligatoriu pe raport",
        "nu se consemnează, pentru a nu prejudicia expozantul",
      ],
    },
    {
      text: "Primul pas în grila de decizie a calificativului este:",
      optiuni: [
        "verificarea existenței unui defect eliminatoriu sau a unui motiv de descalificare",
        "aprecierea mișcării în triunghi",
        "stabilirea tipului constituțional",
      ],
    },
    {
      text: "Brahicefalia extremă este tratată în material ca:",
      optiuni: [
        "caracter de tipicitate care se recompensează",
        "detaliu estetic, fără consecințe",
        "exagerare dăunătoare, penalizată pentru urmările asupra respirației",
      ],
    },
  ] as Intrebare[],
};

// =========================================================================
// FORMAREA CONTINUĂ a arbitrilor autorizați — modulul anual de actualizare.
//
// O dată pe an, arbitrii (inclusiv lectorii) parcurg materialul de actualizare și
// susțin mini-testul (10 întrebări, prag 70%). Promovarea = formarea îndeplinită pe
// anul respectiv; evidența stă pe server (funcția formare-arbitri), per arbitru și an.
// Ca peste tot: întrebările NU conțin răspunsul corect — cheia stă doar pe server.
//
// La schimbarea anului: se actualizează `an`, lecturile și întrebările de aici, plus
// cheia „formare-<an>” din netlify/functions/formare-arbitri.mjs.
// =========================================================================

export const FORMARE = {
  an: 2026,
  titlu: "Actualizarea anuală 2026 — regulamentele WDF în practică",
  descriere:
    "Modulul anual de formare continuă al Colegiului de Arbitri: reîmprospătarea regulilor cu " +
    "consecință directă în ring. Parcurge lecturile, apoi susține mini-testul (10 întrebări, prag 70%). " +
    "Promovarea se înregistrează în evidența Colegiului pentru anul în curs.",
  lecturi: [
    { titlu: "Regulamentul de expoziție WDF (integral)", url: "/ro/regulamente/" },
    { titlu: "Titlurile oficiale de campion WDF", url: "/ro/regulamente/titlurile-oficiale-de-campion-wdf/" },
    { titlu: "Comportamentul și etica în ring", url: "/ro/regulamente/comportamentul-si-etica-in-ring/" },
    { titlu: "Manualul de studiu individual — Modulul 6 (Metodica) și 7 (Etica)", url: "/cursuri/manual/" },
  ],
  intrebari: [
    {
      text: "Numărul maxim de exemplare pe care un arbitru le poate judeca într-o zi este:",
      optiuni: ["100", "80", "60"],
    },
    {
      text: "Un arbitru poate judeca un câine pe care l-a deținut sau crescut în ultimele 12 luni?",
      optiuni: ["Da, dacă anunță organizatorul", "Da, în clasele de dezvoltare", "Nu"],
    },
    {
      text: "Certificatul CAC se acordă exclusiv în clasele:",
      optiuni: [
        "Intermediară, Deschisă, Working, Winner, Champion, Foreign Champion",
        "Young, Intermediară și Deschisă",
        "tuturor claselor, inclusiv Baby și Puppy",
      ],
    },
    {
      text: "CACIB se poate acorda:",
      optiuni: [
        "în orice expoziție națională",
        "doar în expoziții internaționale, câinilor care au primit CAC",
        "doar la World Cup WDF",
      ],
    },
    {
      text: "Motivul descalificării sau al acordării N.J.:",
      optiuni: [
        "se consemnează obligatoriu pe raport",
        "se comunică doar verbal expozantului",
        "se consemnează doar la cererea expozantului",
      ],
    },
    {
      text: "Exagerările dăunătoare (brahicefalie extremă, piele în exces, unghiuri exagerate):",
      optiuni: [
        "se recompensează dacă țin de tipicitatea rasei",
        "se ignoră — sunt problema crescătorului",
        "se penalizează: sănătatea și funcționalitatea primează asupra spectaculosului",
      ],
    },
    {
      text: "Clasamentul I–IV într-o clasă se stabilește:",
      optiuni: [
        "numai între câinii cu cel puțin „Foarte bun”; la mai multe Excelente, ierarhizarea e obligatorie",
        "între toți câinii prezentați, indiferent de calificativ",
        "doar dacă expozanții o solicită",
      ],
    },
    {
      text: "Comunicarea arbitrului cu expozanții pe durata arbitrajului:",
      optiuni: [
        "e liberă, în pauzele dintre clase",
        "se limitează la strictul necesar tehnic al muncii în ring",
        "e permisă doar cu handlerii profesioniști",
      ],
    },
    {
      text: "Clasa Veterani se deschide de la vârsta de:",
      optiuni: ["10 ani", "8 ani", "12 ani"],
    },
    {
      text: "Critica descriptivă a fiecărui exemplar:",
      optiuni: [
        "e opțională la expozițiile naționale",
        "se redactează doar pentru câinii cu „Excelent”",
        "justifică calificativul și consemnează atât calitățile, cât și abaterile, cu gravitatea lor",
      ],
    },
  ] as Intrebare[],
};
