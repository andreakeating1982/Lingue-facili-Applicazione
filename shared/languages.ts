/**
 * Configurazione multi-lingua di «LINGUE FACILI».
 *
 * L'app unifica le tre varianti della famiglia «Facile» (INGLESE FACILE,
 * FRANCESE FACILE, SPAGNOLO FACILE) in UNA sola applicazione: tutto ciò che
 * dipende dalla lingua del contenuto (titoli, istruzioni, feedback, pulsanti
 * VERO/FALSO, prompt AI, dizionari di riserva, OCR) vive qui.
 *
 * La UI per l'insegnante resta in italiano; cambia solo il CONTENUTO in
 * lingua straniera (stesso principio di ADATTARE.md).
 */
import type { ExerciseType } from "./exercise";

export type LangCode = "en" | "fr" | "es";

export const LANG_CODES: LangCode[] = ["en", "fr", "es"];

/** Etichette italiane del selettore lingua (seconda pagina). */
export const LANG_LABELS: Record<LangCode, { nome: string; flag: string }> = {
  en: { nome: "INGLESE", flag: "🇮🇪" },
  fr: { nome: "FRANCESE", flag: "🇫🇷" },
  es: { nome: "SPAGNOLO", flag: "🇪🇸" },
};

/** Colore d'accento storico (mantenuto per compatibilità con le schede vecchie). */
export const LANG_ACCENT: Record<LangCode, string> = {
  en: "#3949AB",
  fr: "#B8860B",
  es: "#B71C1C",
};

export interface TypeCardStrings {
  /** Nome della tipologia NELLA LINGUA STRANIERA. */
  en: string;
  /** Nome italiano (per l'insegnante). */
  it: string;
  /** Spiegazione rapida (italiano, può citare i pulsanti in lingua). */
  how: string;
}

export interface LangAiConfig {
  /** Nome inglese della lingua nei prompt («French», «Spanish»…). */
  teacherLang: string;
  /** Esempi di trasformazione minima nel CRITICAL RULE. */
  criticalExample: string;
  /** Esempi brevi di desinenze («-s/-éd/-ing») per il prompt. */
  endings: string;
  /** Sintagma completo («a suffix (-s, -ed, -ing, plural)») per il CRITICAL RULE. */
  endingsNoun: string;
  /** Suggerimento per le opzioni MC. */
  mcHint: string;
  /** Riga dei gruppi di soggetto. */
  subjectLine: string;
  /** Soggetti del gruppo "A" (per il fallback MC deterministico). */
  subjectA: string[];
  /** Esempi JSON (stringhe) per i prompt. */
  mcExample: string;
  tfExample: string;
  matchItExample: string;
  matchExample: string;
  reorderExample: string;
  rescueMcExample: string;
  rescueTfExample: string;
  rescueMatchExample: string;
  rescueMatchItExample: string;
  rescueReorderExample: string;
  /** Negazioni/interrogative per gli item TF. */
  tfNegation: string;
  /** Avverbi di frequenza per il riordino. */
  reorderAdverbs: string;
  /** Etichetta «X & Italian matching» nel controllo di adattabilità. */
  matchItLabel: string;
  /** Esempio di suffisso nel controllo di adattabilità. */
  suffixExample: string;
  /** Parole di servizio del fallback MC. */
  genericWords: string[];
  /** Mini-dizionario di riserva (parola → italiano) per matchIt. */
  dict: Array<[string, string]>;
  /** Dizionario di parole concrete per match: parola, italiano, emoji,
      descrizione IN INGLESE per il prompt dell'illustrazione. */
  matchDict: Array<[string, string, string, string]>;
  /** Strategia plurali per il recupero dal dizionario. */
  pluralKind: "en" | "fr" | "es";
}

export interface LangConfig {
  code: LangCode;
  /** Titolo visibile dell'app per questa lingua (es. «INGLESE FACILE»). */
  appTitle: string;
  /** Titolo in Title Case (PDF, nome file, piè di pagina). */
  appTitleCase: string;
  /** Complemento nel sottotitolo della prima pagina («D'INGLESE»). */
  subtitleSpan: string;
  /** Nome della lingua in minuscolo («inglese»). */
  linguaNome: string;
  /** aria-label del pulsante ENTRA. */
  ariaEntra: string;
  /** Prefisso del nome file PDF. */
  filePrefix: string;
  /** Codice Tesseract per l'OCR (modello in client/public/tessdata). */
  tessLang: string;
  /** Pulsanti VERO/FALSO nella lingua straniera. */
  tfTrue: string;
  tfFalse: string;
  /** Intestazione colonna lingua straniera nell'abbinamento. */
  colTarget: string;
  /** Pulsante di verifica del riordino. */
  checkBtn: string;
  /** Feedback immediato in lingua. */
  feedbackOK: string;
  feedbackKO: string;
  /** Titolo della pagina finale. */
  finishTitle: string;
  /** Hint del ritaglio foto. */
  cropHint: string;
  /** aria-label del box testo. */
  testoAria: string;
  /** Placeholder del box testo (con \n). */
  testoPlaceholder: string;
  /** Parte finale del messaggio «Servono almeno N caratteri …». */
  minCharsTail: string;
  /** Placeholder istruzioni personalizzate. */
  instrPlaceholder: string;
  /** Istruzione breve della tipologia, NELLA LINGUA STRANIERA (badge/PDF). */
  typeMeta: Record<ExerciseType, { en: string }>;
  /** Card della schermata di setup. */
  typeCards: Record<ExerciseType, TypeCardStrings>;
  /** Placeholder degli argomenti del focus. */
  focusPlaceholders: { grammatica: string; lessico: string; funzioni: string };
  /** Istruzioni standard del PDF (italiano, con le parole-chiave in lingua). */
  pdfInstructions: Record<ExerciseType, string>;
  /** Config AI + fallback deterministico. */
  ai: LangAiConfig;
}

/* ==================================================================== */
/* INGLESE FACILE                                                        */
/* ==================================================================== */
const EN: LangConfig = {
  code: "en",
  appTitle: "INGLESE FACILE",
  appTitleCase: "Inglese Facile",
  subtitleSpan: "D'INGLESE",
  linguaNome: "inglese",
  ariaEntra: "Entra nell'app Inglese Facile",
  filePrefix: "Inglese-Facile",
  tessLang: "eng",
  tfTrue: "TRUE",
  tfFalse: "FALSE",
  colTarget: "ENGLISH",
  checkBtn: "CHECK",
  feedbackOK: "Correct! Well done!",
  feedbackKO: "Incorrect: try again!",
  finishTitle: "YOU FINISHED! GREAT JOB!",
  cropHint: "Includi testo e immagini utili. Trascina i bordi o gli angoli bianchi.",
  testoAria: "Testo inglese dell'esercizio",
  testoPlaceholder:
    "Scrivi o incolla qui l'esercizio o il testo in inglese…\n\nPuoi anche TRASCINARE qui un file di testo, un'immagine o un PDF (oppure incollare uno screenshot con Ctrl+V).",
  minCharsTail: "di testo inglese",
  instrPlaceholder:
    "Scrivi le istruzioni nella lingua che preferisci. Se le lasci vuote, l'app usa le istruzioni standard in inglese.",
  typeMeta: {
    mc: { en: "Circle the correct option" },
    tf: { en: "True or False?" },
    match: { en: "Match image and word" },
    matchIt: { en: "Match English and Italian" },
    reorder: { en: "Put the words in order" },
  },
  typeCards: {
    mc: { en: "Multiple choice", it: "Scelta multipla", how: "Leggi la frase e premi la risposta giusta" },
    tf: { en: "True or False", it: "Vero o falso", how: "Premi TRUE se è giusto, FALSE se è sbagliato" },
    match: { en: "Match word & image", it: "Abbina parola e immagine", how: "Trascina (o tocca) la parola sull'immagine giusta" },
    matchIt: { en: "Match English & Italian", it: "Abbina inglese e italiano", how: "Abbina ogni parola o frase inglese alla sua traduzione italiana" },
    reorder: { en: "Word order", it: "Riordina le parole", how: "Metti le parole nel giusto ordine" },
  },
  focusPlaceholders: {
    grammatica: "es. present simple, past simple, plurali, aggettivi possessivi…",
    lessico: "es. la famiglia, il cibo, gli animali, la scuola…",
    funzioni: "es. presentarsi, chiedere l'ora, esprimere i gusti…",
  },
  pdfInstructions: {
    mc: "Cerchia una risposta corretta per ogni domanda.",
    tf: "Segna TRUE se la frase è corretta, FALSE se contiene un errore.",
    match: "Abbina ogni immagine (A-F) alla parola inglese corretta: scrivi la lettera e la traduzione.",
    matchIt: "Abbina ogni parola o frase inglese (1-6) alla sua traduzione italiana (A-F): scrivi la lettera nel riquadro.",
    reorder:
      "Riordina le parole e scrivi la frase corretta.",
  },
  ai: {
    teacherLang: "English",
    criticalExample:
      "(e.g. add don't/doesn't, or turn it into a question like Do you...? / Does she...? / Did they...?)",
    endings: "-s/-ed/-ing",
    endingsNoun: "a suffix (-s, -ed, -ing, plural)",
    mcHint: `(e.g. do/does/don't/doesn't/is/are/am, or a missing content word)`,
    subjectLine: `"A" = I / you / we / they or plural subjects; "B" = he / she / it or singular subjects.`,
    subjectA: ["i", "you", "we", "they"],
    mcExample: `{"items":[{"source":"She doesn't speak French at home.","segments":[{"t":"text","v":"___ "},{"t":"subject","v":"She","group":"B"},{"t":"text","v":" speak French."}],"options":["don't","doesn't","isn't"],"correct":"doesn't"}]}`,
    tfExample: `{"items":[{"sentence":"You mustn't smoke in here - it's forbidden.","highlight":"mustn't","isTrue":true}]}`,
    matchItExample: `{"pairs":[{"en":"security checkpoint","it":"controllo di sicurezza"}]}`,
    matchExample: `{"pairs":[{"word":"security checkpoint","it":"controllo di sicurezza","emoji":"🛂","imagePrompt":"an airport metal detector archway with a security officer"}]}`,
    reorderExample: `{"items":[{"chips":[{"t":"She","role":"subject"},{"t":"always","role":"adverb"},{"t":"goes","role":"verb"},{"t":"to","role":"other"},{"t":"the","role":"other"},{"t":"gym.","role":"other"}],"answer":"She always goes to the gym."}]}`,
    rescueMcExample: `{"items":[{"source":"My sister speaks French.","segments":[{"t":"text","v":""},{"t":"blank"},{"t":"text","v":"."}],"options":["French","English","music"],"correct":"French"}]}`,
    rescueTfExample: `{"items":[{"sentence":"My sister speaks French.","highlight":"French","isTrue":true}]}`,
    rescueMatchExample: `{"pairs":[{"word":"checkpoint","it":"controllo","emoji":"🛂","imagePrompt":"an airport checkpoint"}]}`,
    rescueMatchItExample: `{"pairs":[{"en":"checkpoint","it":"controllo"}]}`,
    rescueReorderExample: `{"items":[{"chips":[{"t":"My","role":"subject"},{"t":"sister","role":"other"},{"t":"speaks","role":"other"},{"t":"French.","role":"other"}],"answer":"My sister speaks French."}]}`,
    tfNegation: `add don't/doesn't/isn't/aren't/not, or turn it into a question like Do you...? / Does she...? / Did they...?`,
    reorderAdverbs: "always, never, usually, often, sometimes",
    matchItLabel: "English & Italian matching",
    suffixExample: "such as -s/-ed/-ing",
    genericWords: ["the", "is", "are", "was", "were", "has", "have", "can", "will", "in", "on", "at", "and", "but", "with"],
    pluralKind: "en",
    dict: [
      ["ice cream", "gelato"], ["get up", "alzarsi"], ["wake up", "svegliarsi"],
      ["go to bed", "andare a letto"], ["play football", "giocare a calcio"],
      ["watch tv", "guardare la tv"], ["listen to music", "ascoltare musica"],
      ["do homework", "fare i compiti"], ["security checkpoint", "controllo di sicurezza"],
      ["airport", "aeroporto"], ["family", "famiglia"], ["mother", "mamma"],
      ["father", "papà"], ["sister", "sorella"], ["brother", "fratello"],
      ["parents", "genitori"], ["grandmother", "nonna"], ["grandfather", "nonno"],
      ["teacher", "insegnante"], ["student", "studente"], ["friend", "amico"],
      ["friends", "amici"], ["name", "nome"], ["house", "casa"], ["home", "casa"],
      ["school", "scuola"], ["class", "classe"], ["book", "libro"], ["pen", "penna"],
      ["pencil", "matita"], ["desk", "banco"], ["window", "finestra"], ["door", "porta"],
      ["table", "tavolo"], ["chair", "sedia"], ["bed", "letto"], ["kitchen", "cucina"],
      ["garden", "giardino"], ["park", "parco"], ["street", "strada"], ["city", "città"],
      ["dog", "cane"], ["cat", "gatto"], ["bird", "uccello"], ["horse", "cavallo"],
      ["apple", "mela"], ["bread", "pane"], ["water", "acqua"], ["milk", "latte"],
      ["pizza", "pizza"], ["cake", "torta"], ["breakfast", "colazione"], ["lunch", "pranzo"],
      ["dinner", "cena"], ["morning", "mattina"], ["afternoon", "pomeriggio"],
      ["evening", "sera"], ["night", "notte"], ["day", "giorno"], ["week", "settimana"],
      ["month", "mese"], ["year", "anno"], ["today", "oggi"], ["tomorrow", "domani"],
      ["yesterday", "ieri"], ["monday", "lunedì"], ["tuesday", "martedì"],
      ["wednesday", "mercoledì"], ["thursday", "giovedì"], ["friday", "venerdì"],
      ["saturday", "sabato"], ["sunday", "domenica"], ["red", "rosso"], ["blue", "blu"],
      ["green", "verde"], ["yellow", "giallo"], ["white", "bianco"], ["black", "nero"],
      ["play", "giocare"], ["eat", "mangiare"], ["drink", "bere"], ["read", "leggere"],
      ["write", "scrivere"], ["run", "correre"], ["walk", "camminare"], ["swim", "nuotare"],
      ["sleep", "dormire"], ["work", "lavorare"], ["study", "studiare"], ["speak", "parlare"],
      ["talk", "parlare"], ["sing", "cantare"], ["dance", "ballare"], ["cook", "cucinare"],
      ["hand", "mano"], ["head", "testa"], ["eye", "occhio"], ["hair", "capelli"],
      ["sun", "sole"], ["rain", "pioggia"], ["snow", "neve"], ["wind", "vento"],
      ["car", "auto"], ["bus", "autobus"], ["train", "treno"], ["bike", "bici"],
      ["plane", "aereo"], ["money", "soldi"], ["sport", "sport"], ["football", "calcio"],
      ["music", "musica"], ["game", "gioco"], ["photo", "foto"], ["phone", "telefono"],
      ["computer", "computer"], ["holiday", "vacanza"], ["party", "festa"],
      ["birthday", "compleanno"], ["present", "regalo"], ["smile", "sorriso"],
      ["station", "stazione"], ["hospital", "ospedale"], ["shop", "negozio"],
      ["church", "chiesa"], ["cinema", "cinema"], ["gym", "palestra"],
      ["umbrella", "ombrello"], ["baby", "bambino"], ["ball", "palla"],
      ["star", "stella"], ["tree", "albero"], ["flower", "fiore"],
      ["hat", "cappello"], ["shoe", "scarpa"], ["bag", "borsa"],
      ["glasses", "occhiali"], ["key", "chiave"], ["clock", "orologio"],
      ["river", "fiume"], ["sea", "mare"], ["juice", "succo"], ["fish", "pesce"],
      ["moon", "luna"], ["cloud", "nuvola"], ["box", "scatola"], ["road", "strada"],
    ],
    matchDict: [
      ["brother", "fratello", "👦", "boy"], ["sister", "sorella", "👧", "girl"], ["baby", "bambino", "👶", "baby"],
      ["cat", "gatto", "🐱", "cat"], ["dog", "cane", "🐶", "dog"], ["bird", "uccello", "🐦", "bird"],
      ["horse", "cavallo", "🐴", "horse"], ["fish", "pesce", "🐟", "fish"], ["umbrella", "ombrello", "☂️", "umbrella"],
      ["apple", "mela", "🍎", "apple"], ["banana", "banana", "🍌", "banana"], ["bread", "pane", "🍞", "bread"],
      ["cake", "torta", "🍰", "cake"], ["water", "acqua", "💧", "glass of water"], ["milk", "latte", "🥛", "glass of milk"],
      ["juice", "succo", "🧃", "juice box"], ["house", "casa", "🏠", "house"], ["school", "scuola", "🏫", "school building"],
      ["tree", "albero", "🌳", "tree"], ["flower", "fiore", "🌸", "flower"], ["sun", "sole", "☀️", "sun"],
      ["moon", "luna", "🌙", "moon"], ["cloud", "nuvola", "☁️", "cloud"], ["car", "auto", "🚗", "car"],
      ["bus", "autobus", "🚌", "bus"], ["train", "treno", "🚆", "train"], ["plane", "aereo", "✈️", "airplane"],
      ["bike", "bici", "🚲", "bicycle"], ["book", "libro", "📖", "open book"], ["pen", "penna", "🖊️", "pen"],
      ["pencil", "matita", "✏️", "pencil"], ["ball", "palla", "⚽", "football"], ["money", "soldi", "💰", "money bag"],
      ["phone", "telefono", "📱", "mobile phone"], ["clock", "orologio", "🕐", "clock"], ["key", "chiave", "🔑", "key"],
      ["chair", "sedia", "🪑", "chair"], ["hat", "cappello", "🎩", "hat"], ["shoe", "scarpa", "👟", "shoe"],
      ["bag", "borsa", "👜", "handbag"], ["glasses", "occhiali", "👓", "glasses"], ["star", "stella", "⭐", "star"],
      ["garden", "giardino", "🌻", "garden with sunflowers"], ["kitchen", "cucina", "🍳", "kitchen with a pan"],
      ["bed", "letto", "🛏️", "bed"], ["door", "porta", "🚪", "door"], ["window", "finestra", "🪟", "window"],
      ["river", "fiume", "🏞️", "river landscape"], ["sea", "mare", "🌊", "sea wave"], ["box", "scatola", "📦", "cardboard box"],
      ["airport", "aeroporto", "🛫", "airport departure"], ["luggage", "bagaglio", "🧳", "suitcase"],
      ["seat", "posto", "💺", "seat"], ["passport", "passaporto", "🛂", "passport"],
      ["ticket", "biglietto", "🎟️", "ticket"], ["film", "film", "🎬", "film clapperboard"],
      ["television", "televisione", "📺", "television"], ["park", "parco", "🌳", "public park"],
      ["family", "famiglia", "👨‍👩‍👧‍👦", "family"], ["friends", "amici", "👭", "two friends"],
      ["holiday", "vacanza", "🏖️", "beach holiday"], ["party", "festa", "🎉", "party"],
    ],
  },
};

/* ==================================================================== */
/* FRANCESE FACILE                                                       */
/* ==================================================================== */
const FR: LangConfig = {
  code: "fr",
  appTitle: "FRANCESE FACILE",
  appTitleCase: "Francese Facile",
  subtitleSpan: "DI FRANCESE",
  linguaNome: "francese",
  ariaEntra: "Entra nell'app Francese Facile",
  filePrefix: "Francese-Facile",
  tessLang: "fra",
  tfTrue: "VRAI",
  tfFalse: "FAUX",
  colTarget: "FRANÇAIS",
  checkBtn: "VÉRIFIE",
  feedbackOK: "Correct ! Bravo !",
  feedbackKO: "Incorrect : essaie encore !",
  finishTitle: "TU AS FINI ! EXCELLENT TRAVAIL !",
  cropHint: "Includi testo e immagini utili. Trascina i bordi o gli angoli bianchi.",
  testoAria: "Testo francese dell'esercizio",
  testoPlaceholder:
    "Scrivi o incolla qui l'esercizio o il testo in francese…\n\nPuoi anche TRASCINARE qui un file di testo, un'immagine o un PDF (oppure incollare uno screenshot con Ctrl+V).",
  minCharsTail: "di testo francese",
  instrPlaceholder:
    "Scrivi le istruzioni nella lingua che preferisci. Se le lasci vuote, l'app usa le istruzioni standard in francese.",
  typeMeta: {
    mc: { en: "Entoure la bonne option" },
    tf: { en: "Vrai ou faux ?" },
    match: { en: "Relie l'image et le mot" },
    matchIt: { en: "Relie le français et l'italien" },
    reorder: { en: "Remets les mots dans l'ordre" },
  },
  typeCards: {
    mc: { en: "Choix multiple", it: "Scelta multipla", how: "Leggi la frase e premi la risposta giusta" },
    tf: { en: "Vrai ou Faux", it: "Vero o falso", how: "Premi VRAI se è giusto, FAUX se è sbagliato" },
    match: { en: "Relie mot et image", it: "Abbina parola e immagine", how: "Trascina (o tocca) la parola sull'immagine giusta" },
    matchIt: { en: "Relie français & italien", it: "Abbina francese e italiano", how: "Abbina ogni parola o frase francese alla sua traduzione italiana" },
    reorder: { en: "Ordre des mots", it: "Riordina le parole", how: "Metti le parole nel giusto ordine" },
  },
  focusPlaceholders: {
    grammatica: "es. présent, passé composé, accord du participe passé, possessifs…",
    lessico: "es. la famiglia, il cibo, gli animali, la scuola…",
    funzioni: "es. presentarsi, chiedere l'ora, esprimere i gusti…",
  },
  pdfInstructions: {
    mc: "Cerchia una risposta corretta per ogni domanda.",
    tf: "Segna VRAI se la frase è corretta, FAUX se contiene un errore.",
    match: "Abbina ogni immagine (A-F) alla parola francese corretta: scrivi la lettera e la traduzione.",
    matchIt: "Abbina ogni parola o frase francese (1-6) alla sua traduzione italiana (A-F): scrivi la lettera nel riquadro.",
    reorder:
      "Riordina le parole e scrivi la frase corretta.",
  },
  ai: {
    teacherLang: "French",
    criticalExample:
      "(e.g. add ne... pas, or turn it into a question like Est-ce que... ? / As-tu... ? / A-t-il... ?)",
    endings: "-s/-é/-er",
    endingsNoun: "an ending (-s, -é, -er, plural)",
    mcHint: `(e.g. être/avoir/est/sont/parle/parles, a negation like ne... pas, or a missing content word)`,
    subjectLine: `"A" = je / tu / nous / vous or plural subjects; "B" = il / elle / on or singular subjects.`,
    subjectA: ["je", "tu", "nous", "vous"],
    mcExample: `{"items":[{"source":"Elle ne parle pas anglais à la maison.","segments":[{"t":"text","v":"___ "},{"t":"subject","v":"Elle","group":"B"},{"t":"text","v":" pas anglais à la maison."}],"options":["parle","parles","parler"],"correct":"parle"}]}`,
    tfExample: `{"items":[{"sentence":"Tu ne dois pas fumer ici - c'est interdit.","highlight":"fumer","isTrue":true}]}`,
    matchItExample: `{"pairs":[{"en":"la grand-mère","it":"la nonna"}]}`,
    matchExample: `{"pairs":[{"word":"la gare","it":"la stazione","emoji":"🚉","imagePrompt":"a small train station with a clock and two platforms"}]}`,
    reorderExample: `{"items":[{"chips":[{"t":"Elle","role":"subject"},{"t":"va","role":"verb"},{"t":"toujours","role":"adverb"},{"t":"à","role":"other"},{"t":"la","role":"other"},{"t":"piscine.","role":"other"}],"answer":"Elle va toujours à la piscine."}]}`,
    rescueMcExample: `{"items":[{"source":"Ma sœur parle français.","segments":[{"t":"text","v":""},{"t":"blank"},{"t":"text","v":"."}],"options":["français","anglais","musique"],"correct":"français"}]}`,
    rescueTfExample: `{"items":[{"sentence":"Ma sœur parle français.","highlight":"français","isTrue":true}]}`,
    rescueMatchExample: `{"pairs":[{"word":"la gare","it":"la stazione","emoji":"🚉","imagePrompt":"a small train station"}]}`,
    rescueMatchItExample: `{"pairs":[{"en":"la gare","it":"la stazione"}]}`,
    rescueReorderExample: `{"items":[{"chips":[{"t":"Ma","role":"subject"},{"t":"sœur","role":"other"},{"t":"parle","role":"other"},{"t":"français.","role":"other"}],"answer":"Ma sœur parle français."}]}`,
    tfNegation: `add ne... pas / plus / jamais, or turn it into a question like Est-ce que... ? / As-tu... ? / A-t-elle... ?`,
    reorderAdverbs: "toujours, jamais, souvent, parfois, d'habitude",
    matchItLabel: "French & Italian matching",
    suffixExample: "such as -s/-é/-er",
    genericWords: ["le", "la", "est", "sont", "était", "a", "ont", "peut", "va", "dans", "sur", "à", "et", "mais", "avec"],
    pluralKind: "fr",
    dict: [
      ["petit déjeuner", "colazione"], ["grand-mère", "nonna"], ["grand-père", "nonno"],
      ["gare routière", "stazione degli autobus"], ["salle de classe", "aula"],
      ["après-midi", "pomeriggio"], ["aujourd'hui", "oggi"], ["tout de suite", "subito"],
      ["tout le monde", "tutti"], ["week-end", "fine settimana"],
      ["famille", "famiglia"], ["mère", "mamma"], ["père", "papà"],
      ["sœur", "sorella"], ["frère", "fratello"], ["parents", "genitori"],
      ["enfant", "bambino"], ["oncle", "zio"], ["tante", "zia"], ["cousin", "cugino"],
      ["ami", "amico"], ["amis", "amici"], ["professeur", "insegnante"],
      ["maître", "maestro"], ["maîtresse", "maestra"], ["élève", "alunno"],
      ["voisin", "vicino"], ["prénom", "nome"], ["maison", "casa"], ["école", "scuola"],
      ["classe", "classe"], ["livre", "libro"], ["cahier", "quaderno"],
      ["stylo", "penna"], ["crayon", "matita"], ["gomme", "gomma"], ["sac", "zaino"],
      ["bureau", "scrivania"], ["fenêtre", "finestra"], ["porte", "porta"],
      ["table", "tavolo"], ["chaise", "sedia"], ["lit", "letto"], ["cuisine", "cucina"],
      ["chambre", "camera"], ["jardin", "giardino"], ["parc", "parco"],
      ["rue", "strada"], ["route", "strada"], ["ville", "città"], ["place", "piazza"],
      ["chien", "cane"], ["chat", "gatto"], ["oiseau", "uccello"], ["cheval", "cavallo"],
      ["poisson", "pesce"], ["vache", "mucca"], ["lapin", "coniglio"], ["souris", "topo"],
      ["pomme", "mela"], ["pain", "pane"], ["eau", "acqua"], ["lait", "latte"],
      ["gâteau", "torta"], ["fromage", "formaggio"], ["viande", "carne"],
      ["légume", "verdura"], ["fruits", "frutta"], ["glace", "gelato"], ["jus", "succo"],
      ["repas", "pasto"], ["soupe", "minestra"],
      ["déjeuner", "pranzo"], ["dîner", "cena"], ["matin", "mattina"],
      ["soir", "sera"], ["nuit", "notte"], ["jour", "giorno"], ["semaine", "settimana"],
      ["mois", "mese"], ["an", "anno"], ["demain", "domani"], ["hier", "ieri"],
      ["lundi", "lunedì"], ["mardi", "martedì"], ["mercredi", "mercoledì"],
      ["jeudi", "giovedì"], ["vendredi", "venerdì"], ["samedi", "sabato"],
      ["dimanche", "domenica"], ["rouge", "rosso"], ["bleu", "blu"],
      ["vert", "verde"], ["jaune", "giallo"], ["blanc", "bianco"], ["noir", "nero"],
      ["jouer", "giocare"], ["manger", "mangiare"], ["boire", "bere"], ["lire", "leggere"],
      ["écrire", "scrivere"], ["courir", "correre"], ["marcher", "camminare"],
      ["nager", "nuotare"], ["dormir", "dormire"], ["travailler", "lavorare"],
      ["étudier", "studiare"], ["parler", "parlare"], ["chanter", "cantare"],
      ["danser", "ballare"], ["cuisiner", "cucinare"], ["aimer", "amare"],
      ["aller", "andare"], ["regarder", "guardare"], ["écouter", "ascoltare"],
      ["main", "mano"], ["tête", "testa"], ["œil", "occhio"], ["cheveux", "capelli"],
      ["bouche", "bocca"], ["soleil", "sole"], ["pluie", "pioggia"], ["neige", "neve"],
      ["vent", "vento"], ["mer", "mare"], ["rivière", "fiume"], ["montagne", "montagna"],
      ["arbre", "albero"], ["fleur", "fiore"], ["étoile", "stella"], ["lune", "luna"],
      ["nuage", "nuvola"], ["voiture", "auto"], ["bus", "autobus"], ["train", "treno"],
      ["vélo", "bici"], ["avion", "aereo"], ["bateau", "barca"], ["argent", "soldi"],
      ["sport", "sport"], ["football", "calcio"], ["musique", "musica"], ["jeu", "gioco"],
      ["photo", "foto"], ["téléphone", "telefono"], ["ordinateur", "computer"],
      ["vacances", "vacanze"], ["fête", "festa"], ["anniversaire", "compleanno"],
      ["cadeau", "regalo"], ["sourire", "sorriso"], ["parapluie", "ombrello"],
      ["ballon", "palla"], ["clé", "chiave"], ["horloge", "orologio"],
      ["lunettes", "occhiali"], ["chapeau", "cappello"], ["chaussure", "scarpa"],
      ["boîte", "scatola"], ["station", "stazione"], ["hôpital", "ospedale"],
      ["magasin", "negozio"], ["église", "chiesa"], ["cinéma", "cinema"],
      ["gym", "palestra"], ["bébé", "bambino"],
    ],
    matchDict: [
      ["frère", "fratello", "👦", "boy"], ["sœur", "sorella", "👧", "girl"], ["bébé", "bambino", "👶", "baby"],
      ["chat", "gatto", "🐱", "cat"], ["chien", "cane", "🐶", "dog"], ["oiseau", "uccello", "🐦", "bird"],
      ["cheval", "cavallo", "🐴", "horse"], ["poisson", "pesce", "🐟", "fish"], ["vache", "mucca", "🐮", "cow"],
      ["lapin", "coniglio", "🐰", "rabbit"], ["parapluie", "ombrello", "☂️", "umbrella"],
      ["pomme", "mela", "🍎", "apple"], ["banane", "banana", "🍌", "banana"], ["pain", "pane", "🍞", "bread"],
      ["gâteau", "torta", "🍰", "cake"], ["eau", "acqua", "💧", "glass of water"], ["lait", "latte", "🥛", "glass of milk"],
      ["jus", "succo", "🧃", "juice box"], ["maison", "casa", "🏠", "house"], ["école", "scuola", "🏫", "school building"],
      ["arbre", "albero", "🌳", "tree"], ["fleur", "fiore", "🌸", "flower"], ["soleil", "sole", "☀️", "sun"],
      ["lune", "luna", "🌙", "moon"], ["nuage", "nuvola", "☁️", "cloud"], ["voiture", "auto", "🚗", "car"],
      ["bus", "autobus", "🚌", "bus"], ["train", "treno", "🚆", "train"], ["avion", "aereo", "✈️", "airplane"],
      ["vélo", "bici", "🚲", "bicycle"], ["livre", "libro", "📖", "open book"], ["stylo", "penna", "🖊️", "pen"],
      ["crayon", "matita", "✏️", "pencil"], ["ballon", "palla", "⚽", "football"], ["argent", "soldi", "💰", "money bag"],
      ["téléphone", "telefono", "📱", "mobile phone"], ["horloge", "orologio", "🕐", "clock"], ["clé", "chiave", "🔑", "key"],
      ["chaise", "sedia", "🪑", "chair"], ["chapeau", "cappello", "🎩", "hat"], ["chaussure", "scarpa", "👟", "shoe"],
      ["sac", "borsa", "👜", "handbag"], ["lunettes", "occhiali", "👓", "glasses"], ["étoile", "stella", "⭐", "star"],
      ["jardin", "giardino", "🌻", "garden with sunflowers"], ["cuisine", "cucina", "🍳", "kitchen with a pan"],
      ["lit", "letto", "🛏️", "bed"], ["porte", "porta", "🚪", "door"], ["fenêtre", "finestra", "🪟", "window"],
      ["rivière", "fiume", "🏞️", "river landscape"], ["mer", "mare", "🌊", "sea wave"], ["boîte", "scatola", "📦", "cardboard box"],
      ["aéroport", "aeroporto", "🛫", "airport departure"], ["valise", "bagaglio", "🧳", "suitcase"],
      ["siège", "posto", "💺", "seat"], ["passeport", "passaporto", "🛂", "passport"],
      ["billet", "biglietto", "🎟️", "ticket"], ["film", "film", "🎬", "film clapperboard"],
      ["télévision", "televisione", "📺", "television"],
      ["famille", "famiglia", "👨‍👩‍👧‍👦", "family"], ["amis", "amici", "👭", "two friends"],
      ["vacances", "vacanze", "🏖️", "beach holiday"], ["fête", "festa", "🎉", "party"],
    ],
  },
};

/* ==================================================================== */
/* SPAGNOLO FACILE                                                       */
/* ==================================================================== */
const ES: LangConfig = {
  code: "es",
  appTitle: "SPAGNOLO FACILE",
  appTitleCase: "Spagnolo Facile",
  subtitleSpan: "DI SPAGNOLO",
  linguaNome: "spagnolo",
  ariaEntra: "Entra nell'app Spagnolo Facile",
  filePrefix: "Spagnolo-Facile",
  tessLang: "spa",
  tfTrue: "VERDADERO",
  tfFalse: "FALSO",
  colTarget: "ESPAÑOL",
  checkBtn: "COMPRUEBA",
  feedbackOK: "¡Correcto! ¡Bien hecho!",
  feedbackKO: "¡Incorrecto! ¡Inténtalo de nuevo!",
  finishTitle: "¡HAS TERMINADO! ¡BUEN TRABAJO!",
  cropHint: "Includi testo e immagini utili. Trascina i bordi o gli angoli bianchi.",
  testoAria: "Testo spagnolo dell'esercizio",
  testoPlaceholder:
    "Scrivi o incolla qui l'esercizio o il testo in spagnolo…\n\nPuoi anche TRASCINARE qui un file di testo, un'immagine o un PDF (oppure incollare uno screenshot con Ctrl+V).",
  minCharsTail: "di testo spagnolo",
  instrPlaceholder:
    "Scrivi le istruzioni nella lingua che preferisci. Se le lasci vuote, l'app usa le istruzioni standard in spagnolo.",
  typeMeta: {
    mc: { en: "Rodea la opción correcta" },
    tf: { en: "¿Verdadero o falso?" },
    match: { en: "Une la imagen y la palabra" },
    matchIt: { en: "Une el español y el italiano" },
    reorder: { en: "Ordena las palabras" },
  },
  typeCards: {
    mc: { en: "Elección múltiple", it: "Scelta multipla", how: "Leggi la frase e premi la risposta giusta" },
    tf: { en: "Verdadero o Falso", it: "Vero o falso", how: "Premi VERDADERO se è giusto, FALSO se è sbagliato" },
    match: { en: "Une palabra e imagen", it: "Abbina parola e immagine", how: "Trascina (o tocca) la parola sull'immagine giusta" },
    matchIt: { en: "Une español & italiano", it: "Abbina spagnolo e italiano", how: "Abbina ogni parola o frase spagnola alla sua traduzione italiana" },
    reorder: { en: "Orden de palabras", it: "Riordina le parole", how: "Metti le parole nel giusto ordine" },
  },
  focusPlaceholders: {
    grammatica: "es. presente, pretérito indefinido, ser/estar, posesivos…",
    lessico: "es. la famiglia, il cibo, gli animali, la scuola…",
    funzioni: "es. presentarsi, chiedere l'ora, esprimere i gusti…",
  },
  pdfInstructions: {
    mc: "Cerchia una risposta corretta per ogni domanda.",
    tf: "Segna VERDADERO se la frase è corretta, FALSO se contiene un errore.",
    match: "Abbina ogni immagine (A-F) alla parola spagnola corretta: scrivi la lettera e la traduzione.",
    matchIt: "Abbina ogni parola o frase spagnola (1-6) alla sua traduzione italiana (A-F): scrivi la lettera nel riquadro.",
    reorder:
      "Riordina le parole e scrivi la frase corretta.",
  },
  ai: {
    teacherLang: "Spanish",
    criticalExample:
      "(e.g. add no/nunca, or turn it into a question like ¿Trabajas...? / ¿Va ella...? / ¿Están ustedes...?)",
    endings: "-o/-a/-ar/-er/-ir",
    endingsNoun: "an ending (-o/-a, -ar/-er/-ir, plural)",
    mcHint: `(e.g. ser/estar/es/son/habla/hablas, a negation like no... nada, or a missing content word)`,
    subjectLine: `"A" = yo / tú / nosotros / vosotros or plural subjects; "B" = él / ella / usted or singular subjects.`,
    subjectA: ["yo", "tu", "nosotros", "vosotros"],
    mcExample: `{"items":[{"source":"Ella no habla inglés en casa.","segments":[{"t":"text","v":"___ "},{"t":"subject","v":"Ella","group":"B"},{"t":"text","v":" inglés en casa."}],"options":["habla","hablas","hablar"],"correct":"habla"}]}`,
    tfExample: `{"items":[{"sentence":"No debes fumar aquí - está prohibido.","highlight":"fumar","isTrue":true}]}`,
    matchItExample: `{"pairs":[{"en":"el abuelo","it":"il nonno"}]}`,
    matchExample: `{"pairs":[{"word":"la estación","it":"la stazione","emoji":"🚉","imagePrompt":"a small train station with a clock and two platforms"}]}`,
    reorderExample: `{"items":[{"chips":[{"t":"Ella","role":"subject"},{"t":"siempre","role":"adverb"},{"t":"va","role":"other"},{"t":"a","role":"other"},{"t":"la","role":"other"},{"t":"piscina.","role":"other"}],"answer":"Ella siempre va a la piscina."}]}`,
    rescueMcExample: `{"items":[{"source":"Mi hermana habla francés.","segments":[{"t":"text","v":""},{"t":"blank"},{"t":"text","v":"."}],"options":["francés","inglés","música"],"correct":"francés"}]}`,
    rescueTfExample: `{"items":[{"sentence":"Mi hermana habla francés.","highlight":"francés","isTrue":true}]}`,
    rescueMatchExample: `{"pairs":[{"word":"la estación","it":"la stazione","emoji":"🚉","imagePrompt":"a small train station"}]}`,
    rescueMatchItExample: `{"pairs":[{"en":"la estación","it":"la stazione"}]}`,
    rescueReorderExample: `{"items":[{"chips":[{"t":"Mi","role":"subject"},{"t":"hermana","role":"other"},{"t":"habla","role":"other"},{"t":"francés.","role":"other"}],"answer":"Mi hermana habla francés."}]}`,
    tfNegation: `add no / nunca / jamás, or turn it into a question like ¿Trabajas...? / ¿Va ella...? / ¿Están ustedes...?`,
    reorderAdverbs: "siempre, nunca, a menudo, a veces, normalmente",
    matchItLabel: "Spanish & Italian matching",
    suffixExample: "such as -o/-a/-ar/-er/-ir",
    genericWords: ["el", "la", "los", "las", "es", "son", "era", "un", "una", "y", "pero", "con", "en", "de", "que", "porque", "muy"],
    pluralKind: "es",
    dict: [
      ["abuelo", "nonno"], ["abuela", "nonna"], ["familia", "famiglia"], ["madre", "mamma"],
      ["padre", "papà"], ["hermana", "sorella"], ["hermano", "fratello"], ["padres", "genitori"],
      ["niño", "bambino"], ["tío", "zio"], ["tía", "zia"], ["primo", "cugino"],
      ["amigo", "amico"], ["amigos", "amici"], ["profesor", "insegnante"],
      ["maestro", "maestro"], ["alumno", "alunno"], ["vecino", "vicino"],
      ["nombre", "nome"], ["casa", "casa"], ["escuela", "scuola"], ["clase", "classe"],
      ["libro", "libro"], ["cuaderno", "quaderno"], ["bolígrafo", "penna"],
      ["lápiz", "matita"], ["goma", "gomma"], ["mochila", "zaino"],
      ["escritorio", "scrivania"], ["ventana", "finestra"], ["puerta", "porta"],
      ["mesa", "tavolo"], ["silla", "sedia"], ["cama", "letto"], ["cocina", "cucina"],
      ["habitación", "camera"], ["jardín", "giardino"], ["parque", "parco"],
      ["calle", "strada"], ["ciudad", "città"], ["plaza", "piazza"],
      ["perro", "cane"], ["gato", "gatto"], ["pájaro", "uccello"], ["caballo", "cavallo"],
      ["pez", "pesce"], ["vaca", "mucca"], ["conejo", "coniglio"], ["ratón", "topo"],
      ["manzana", "mela"], ["pan", "pane"], ["agua", "acqua"], ["leche", "latte"],
      ["tarta", "torta"], ["queso", "formaggio"], ["carne", "carne"],
      ["verdura", "verdura"], ["fruta", "frutta"], ["helado", "gelato"], ["zumo", "succo"],
      ["sopa", "minestra"], ["desayuno", "colazione"], ["comida", "pranzo"], ["cena", "cena"],
      ["mañana", "mattina"], ["tarde", "pomeriggio"], ["noche", "notte"],
      ["día", "giorno"], ["semana", "settimana"], ["mes", "mese"], ["año", "anno"],
      ["hoy", "oggi"], ["ayer", "ieri"], ["lunes", "lunedì"], ["martes", "martedì"],
      ["miércoles", "mercoledì"], ["jueves", "giovedì"], ["viernes", "venerdì"],
      ["sábado", "sabato"], ["domingo", "domenica"], ["rojo", "rosso"], ["azul", "blu"],
      ["verde", "verde"], ["amarillo", "giallo"], ["blanco", "bianco"], ["negro", "nero"],
      ["jugar", "giocare"], ["comer", "mangiare"], ["beber", "bere"], ["leer", "leggere"],
      ["escribir", "scrivere"], ["correr", "correre"], ["andar", "camminare"],
      ["nadar", "nuotare"], ["dormir", "dormire"], ["trabajar", "lavorare"],
      ["estudiar", "studiare"], ["hablar", "parlare"], ["cantar", "cantare"],
      ["bailar", "ballare"], ["cocinar", "cucinare"], ["querer", "amare"],
      ["ir", "andare"], ["mirar", "guardare"], ["escuchar", "ascoltare"],
      ["mano", "mano"], ["cabeza", "testa"], ["ojo", "occhio"], ["pelo", "capelli"],
      ["boca", "bocca"], ["sol", "sole"], ["lluvia", "pioggia"], ["nieve", "neve"],
      ["viento", "vento"], ["mar", "mare"], ["río", "fiume"], ["montaña", "montagna"],
      ["árbol", "albero"], ["flor", "fiore"], ["estrella", "stella"], ["luna", "luna"],
      ["nube", "nuvola"], ["coche", "auto"], ["autobús", "autobus"], ["tren", "treno"],
      ["bicicleta", "bici"], ["avión", "aereo"], ["barco", "barca"], ["dinero", "soldi"],
      ["deporte", "sport"], ["fútbol", "calcio"], ["música", "musica"], ["juego", "gioco"],
      ["foto", "foto"], ["teléfono", "telefono"], ["ordenador", "computer"],
      ["vacaciones", "vacanze"], ["fiesta", "festa"], ["cumpleaños", "compleanno"],
      ["regalo", "regalo"], ["sonrisa", "sorriso"], ["paraguas", "ombrello"],
      ["pelota", "palla"], ["llave", "chiave"], ["reloj", "orologio"],
      ["gafas", "occhiali"], ["sombrero", "cappello"], ["zapato", "scarpa"],
      ["caja", "scatola"], ["estación", "stazione"], ["hospital", "ospedale"],
      ["tienda", "negozio"], ["iglesia", "chiesa"], ["cine", "cinema"],
      ["gimnasio", "palestra"], ["bebé", "bambino"],
    ],
    matchDict: [
      ["hermano", "fratello", "👦", "boy"], ["hermana", "sorella", "👧", "girl"], ["bebé", "bambino", "👶", "baby"],
      ["gato", "gatto", "🐱", "cat"], ["perro", "cane", "🐶", "dog"], ["pájaro", "uccello", "🐦", "bird"],
      ["caballo", "cavallo", "🐴", "horse"], ["pez", "pesce", "🐟", "fish"], ["vaca", "mucca", "🐮", "cow"],
      ["conejo", "coniglio", "🐰", "rabbit"], ["paraguas", "ombrello", "☂️", "umbrella"],
      ["manzana", "mela", "🍎", "apple"], ["plátano", "banana", "🍌", "banana"], ["pan", "pane", "🍞", "bread"],
      ["tarta", "torta", "🍰", "cake"], ["agua", "acqua", "💧", "glass of water"], ["leche", "latte", "🥛", "glass of milk"],
      ["zumo", "succo", "🧃", "juice box"], ["casa", "casa", "🏠", "house"], ["escuela", "scuola", "🏫", "school building"],
      ["árbol", "albero", "🌳", "tree"], ["flor", "fiore", "🌸", "flower"], ["sol", "sole", "☀️", "sun"],
      ["luna", "luna", "🌙", "moon"], ["nube", "nuvola", "☁️", "cloud"], ["coche", "auto", "🚗", "car"],
      ["autobús", "autobus", "🚌", "bus"], ["tren", "treno", "🚆", "train"], ["avión", "aereo", "✈️", "airplane"],
      ["bicicleta", "bici", "🚲", "bicycle"], ["libro", "libro", "📖", "open book"], ["bolígrafo", "penna", "🖊️", "pen"],
      ["lápiz", "matita", "✏️", "pencil"], ["pelota", "palla", "⚽", "football"], ["dinero", "soldi", "💰", "money bag"],
      ["teléfono", "telefono", "📱", "mobile phone"], ["reloj", "orologio", "🕐", "clock"], ["llave", "chiave", "🔑", "key"],
      ["silla", "sedia", "🪑", "chair"], ["sombrero", "cappello", "🎩", "hat"], ["zapato", "scarpa", "👟", "shoe"],
      ["bolso", "borsa", "👜", "handbag"], ["gafas", "occhiali", "👓", "glasses"], ["estrella", "stella", "⭐", "star"],
      ["jardín", "giardino", "🌻", "garden with sunflowers"], ["cocina", "cucina", "🍳", "kitchen with a pan"],
      ["cama", "letto", "🛏️", "bed"], ["puerta", "porta", "🚪", "door"], ["ventana", "finestra", "🪟", "window"],
      ["río", "fiume", "🏞️", "river landscape"], ["mar", "mare", "🌊", "sea wave"], ["caja", "scatola", "📦", "cardboard box"],
      ["aeropuerto", "aeroporto", "🛫", "airport departure"], ["maleta", "bagaglio", "🧳", "suitcase"],
      ["asiento", "posto", "💺", "seat"], ["pasaporte", "passaporto", "🛂", "passport"],
      ["billete", "biglietto", "🎟️", "ticket"], ["película", "film", "🎬", "film clapperboard"],
      ["televisión", "televisione", "📺", "television"],
      ["familia", "famiglia", "👨‍👩‍👧‍👦", "family"], ["amigos", "amici", "👭", "two friends"],
      ["vacaciones", "vacanze", "🏖️", "beach holiday"], ["fiesta", "festa", "🎉", "party"],
    ],
  },
};

export const LANGS: Record<LangCode, LangConfig> = { en: EN, fr: FR, es: ES };

/** Config lingua sicura: codici non validi tornano all'inglese. */
export function langConfig(lang: string | null | undefined): LangConfig {
  return lang === "fr" || lang === "es" ? LANGS[lang] : LANGS.en;
}
