
import { GoogleGenAI, Type } from '@google/genai';
import { FrayerModelData, StoryData, WordLevel, PracticeSettings, QuizQuestion, SessionRecord, QuestionType } from '../types';

if (!process.env.API_KEY) {
  console.warn("API_KEY environment variable not set. Using a placeholder. This will fail in production.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

// --- AUDIO HANDLING ---

let audioContext: AudioContext | null = null;

// Base64 decoding helper
function decodeBase64ToArray(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// PCM Audio Decoding helper
async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      // Convert Int16 to Float32 (-1.0 to 1.0)
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export const playTextAsSpeech = async (text: string): Promise<void> => {
  // 1. Initialize AudioContext on user interaction (singleton pattern)
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate: 24000 // Gemini TTS outputs 24kHz
    });
  }

  // Resume context if suspended (browser autoplay policy)
  if (audioContext.state === 'suspended') {
    await audioContext.resume();
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            // 'Fenrir' is deeper and often sounds more formal/authoritative, 
            // which can be perceived as less distinctly "Hollandic" than the higher pitched voices.
            prebuiltVoiceConfig: { voiceName: 'Fenrir' }
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!base64Audio) {
      throw new Error("Geen audiodata ontvangen van AI.");
    }

    const audioBytes = decodeBase64ToArray(base64Audio);
    const audioBuffer = await decodeAudioData(audioBytes, audioContext);

    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);
    source.start();

    // Return a promise that resolves when audio finishes
    return new Promise((resolve) => {
      source.onended = () => resolve();
    });

  } catch (error) {
    console.warn("Gemini TTS mislukt, fallback naar browser spraak.", error);
    throw error; // Re-throw to allow component to handle fallback
  }
};

// --- EXISTING LOGIC ---

// HELPER: Strip Markdown code blocks if present (common AI response issue)
const cleanJsonOutput = (text: string): string => {
  let cleaned = text.trim();
  // Remove ```json and ``` markers if they exist
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  return cleaned;
};

// HELPER: Robustly censor a word and its variations (plurals, conjugations) from text
const censorTargetWord = (text: string, targetWord: string): string => {
  if (!text || !targetWord) return text;

  // Escape special regex characters in the target word to prevent errors
  const safeWord = targetWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Create a regex that matches:
  // \b       -> Word boundary (start of word)
  // safeWord -> The target word
  // \w*      -> Any word characters immediately following (catches plural 's', 'en', conjugations like 't', etc.)
  const regex = new RegExp(`\\b${safeWord}\\w*`, 'gi');

  return text.replace(regex, '_______');
};

const getAiConfig = (aiModel: PracticeSettings['aiModel']) => {
  const model = 'gemini-flash-latest'; // Automatisch de nieuwste stabiele Flash versie
  const config: { thinkingConfig?: { thinkingBudget: number } } = {};

  if (aiModel === 'fast') {
    config.thinkingConfig = { thinkingBudget: 0 };
  }

  return { model, config };
};

type GenerationSettings = Pick<PracticeSettings, 'context' | 'difficulty' | 'aiModel'>;

const frayerModelSchema = {
  type: Type.OBJECT,
  properties: {
    definitie: { type: Type.STRING, description: 'Een eenvoudige definitie van het woord.' },
    voorbeelden: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          zin: { type: Type.STRING, description: 'De volledige voorbeeldzin.' },
          gebruiktWoord: { type: Type.STRING, description: 'De exacte vorm (vervoeging/verbuiging) van het basiswoord zoals het in de zin wordt gebruikt.' }
        },
        required: ['zin', 'gebruiktWoord']
      },
      description: 'Drie objecten, elk met een complete, informatieve zin en de exacte vorm van het woord dat in die zin wordt gebruikt.'
    },
    synoniemen: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Drie woorden met een vergelijkbare betekenis.' },
    antoniemen: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Drie woorden met een tegenovergestelde betekenis.' },
  },
  required: ['definitie', 'voorbeelden', 'synoniemen', 'antoniemen'],
};

const storySchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: 'Een pakkende, korte titel voor het verhaal.' },
    story: { type: Type.STRING, description: 'Het verhaal zelf, met de gevraagde woorden vetgedrukt (**woord**).' }
  },
  required: ['title', 'story']
};

const quizQuestionSchema = {
  type: Type.OBJECT,
  properties: {
    vraag: { type: Type.STRING, description: 'De quizvraag die de kennis van het woord test.' },
    opties: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Een array van exact 4 mogelijke antwoorden. Eén hiervan moet correct zijn.'
    },
    correctAntwoordIndex: { type: Type.NUMBER, description: 'De 0-gebaseerde index van het correcte antwoord in de "opties" array.' },
    woord: { type: Type.STRING, description: 'Het specifieke basiswoord uit de woordenlijst waarop deze vraag betrekking heeft.' }
  },
  required: ['vraag', 'opties', 'correctAntwoordIndex', 'woord']
};

const quizSchema = {
  type: Type.ARRAY,
  items: quizQuestionSchema,
  description: 'Een array van quizvragen, één voor elk opgegeven woord.'
};

const keyTermsSchema = {
  type: Type.OBJECT,
  properties: {
    termen: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Een lijst van de geïdentificeerde sleuteltermen.'
    }
  },
  required: ['termen']
};

const getContextInstruction = (context?: WordLevel | string, part: 'definitions' | 'story' | 'questions' = 'definitions'): string => {
  if (!context) return '';
  const relation = part === 'definitions' ? 'gerelateerd zijn aan' : 'zich afspelen in een context die relevant is voor';

  // Mapping van context-naam naar specifieke AI-instructie
  const subjectMap: Record<string, string> = {
    // New categories
    [WordLevel.Woordenschat2DF]: `algemene schooltaal en vakken in de 2e graad dubbele finaliteit (secundair onderwijs)`,
    [WordLevel.Woordenschat2AF]: `praktische taal en vakken in de 2e graad arbeidsfinaliteit (beroepsonderwijs)`,
    [WordLevel.AcademischNederlands]: `academisch taalgebruik en wetenschappelijke teksten`,
    [WordLevel.ProfessioneelNederlands]: `professioneel taalgebruik op de werkvloer, stage en sollicitaties`,

    // Specifieke Vakrichtingen (DF - 5e/6e jaar)
    'Applicatie- & Databeheer (APPDA)': 'programmeren, databanken, netwerken, softwareontwikkeling en IT-beheer',
    'Bedrijfsorganisatie (BORGA)': 'kantoorbeheer, administratie, boekhouding, HR-processen en zakelijke communicatie',
    'Elektromechanische technieken (EMTEC)': 'elektriciteit, mechanica, techniek, machines, onderhoud en automatisering',
    'Gezondheidszorg (GEZORG)': 'de zorgsector, verpleegkunde, het menselijk lichaam, hygiëne en de omgang met patiënten in een ziekenhuis- of woonzorgcontext',
    'Internationale Handel & Logistiek (INHAL)': 'internationale handel, import en export, logistieke processen, transportmodi, supply chain management en douane',
    'Opvoeden en Begeleiden (OPBEG)': 'pedagogisch handelen, ontwikkelingspsychologie, communicatieve vaardigheden en het begeleiden van diverse doelgroepen (zoals kinderen, jongeren en ouderen) in een opvoedkundige context',
    'Sportbegeleider (SPOBE)': 'sport, beweging, coaching, spelregels, anatomie, trainingsleer en lichamelijke opvoeding',
    'Wellness & Schoonheid (WESCH)': 'schoonheidszorg, wellness, lichaamsverzorging, gelaatsverzorging, massage, hygiëne en esthetiek',

    // Specifieke Vakrichtingen (AF - 5e/6e jaar)
    'Onthaal, Organisatie & Sales (ONOSA)': 'onthaal, verkoop, winkelbeheer, administratie en klantvriendelijkheid',
  };

  if (context in subjectMap) {
    return `De voorbeelden en ${part} moeten ${relation} ${subjectMap[context as keyof typeof subjectMap]}.`;
  }

  const knownWordLevels = Object.values(WordLevel) as string[];
  if (typeof context === 'string' && !knownWordLevels.includes(context)) {
    return `De voorbeelden en ${part} moeten ${relation} het schoolvak of de studierichting "${context}".`;
  }

  return '';
};

const getDifficultyInstruction = (difficulty?: PracticeSettings['difficulty']): string => {
  if (difficulty === WordLevel.Beginner) return 'Gebruik zeer eenvoudige taal (CEFR A2-niveau).';
  if (difficulty === WordLevel.Intermediate) return 'Gebruik duidelijke en correcte taal (CEFR B1-niveau).';
  if (difficulty === WordLevel.Advanced) return 'Gebruik rijkere en meer formele taal (CEFR B2-niveau).';
  return 'Gebruik duidelijke en correcte taal (CEFR B1-niveau).'; // Default
};


const MAX_FRAYER_RETRIES = 3;

export const generateFrayerModel = async (word: string, settings: GenerationSettings): Promise<FrayerModelData> => {
  let lastError: Error | null = null;
  const BASE_DELAY_MS = 1000;

  const contextInstruction = getContextInstruction(settings.context);
  const difficultyInstruction = getDifficultyInstruction(settings.difficulty);
  const { model, config: aiCallConfig } = getAiConfig(settings.aiModel);

  for (let i = 0; i < MAX_FRAYER_RETRIES; i++) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: `Genereer een Frayer Model voor het Nederlandse woord "${word}". De doelgroep zijn NT2-leerders. ${difficultyInstruction} ${contextInstruction} Geef de definitie, 3 synoniemen, 3 antoniemen, en 3 voorbeeldobjecten. Elk voorbeeldobject moet een 'zin' bevatten (een complete, informatieve zin waarin het woord wordt gebruikt) en een 'gebruiktWoord' (de exacte, vervoegde of verbogen vorm van "${word}" die in die zin voorkomt). BELANGRIJKE REGEL: Als "${word}" een scheidbaar werkwoord is (bv. 'opbellen') en het in de zin gesplitst wordt gebruikt (bv. 'ik bel mijn oma op'), moet 'gebruiktWoord' BEIDE delen bevatten, gescheiden door een spatie (bv. 'bel op'). Dit is cruciaal voor de highlighting.`,
        config: {
          ...aiCallConfig,
          responseMimeType: 'application/json',
          responseSchema: frayerModelSchema,
        },
      });
      const jsonString = cleanJsonOutput(response.text);
      const data = JSON.parse(jsonString) as FrayerModelData;

      const hasValidExamples = data.voorbeelden &&
        data.voorbeelden.length > 0 &&
        data.voorbeelden.every(ex => ex.zin && ex.zin.trim() !== '' && ex.gebruiktWoord && ex.gebruiktWoord.trim() !== '');

      if (!hasValidExamples) {
        throw new Error("Het gegenereerde model bevat lege voorbeeldzinnen of missende woordvormen.");
      }

      return data; // Success!
    } catch (error) {
      console.error(`Fout bij het genereren van Frayer model (poging ${i + 1}/${MAX_FRAYER_RETRIES}):`, error);
      lastError = error instanceof Error ? error : new Error(String(error));

      if (i < MAX_FRAYER_RETRIES - 1) {
        const delay = BASE_DELAY_MS * Math.pow(2, i) + Math.random() * 100;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw new Error(`Kon het Frayer model niet genereren na ${MAX_FRAYER_RETRIES} pogingen. Fout: ${lastError?.message}`);
};

export const translateFrayerModel = async (model: FrayerModelData, language: string, settings: Pick<PracticeSettings, 'aiModel'>): Promise<FrayerModelData> => {
  try {
    const { model: aiModelName, config: aiCallConfig } = getAiConfig(settings.aiModel);
    const response = await ai.models.generateContent({
      model: aiModelName,
      contents: `Vertaal de waarden van dit JSON-object naar de taal "${language}". Behoud de JSON-structuur en de sleutelnamen. Vertaal de waarden voor 'definitie', 'synoniemen', 'antoniemen'. Vertaal voor elk object in de 'voorbeelden' array alleen de waarde van de 'zin' sleutel. Vertaal de waarde van 'gebruiktWoord' NIET. JSON: ${JSON.stringify(model)}`,
      config: {
        ...aiCallConfig,
        responseMimeType: 'application/json',
        responseSchema: frayerModelSchema,
      },
    });
    const jsonString = cleanJsonOutput(response.text);
    return JSON.parse(jsonString) as FrayerModelData;
  } catch (error) {
    console.error("Error translating Frayer model:", error);
    throw new Error("Kon het Frayer model niet vertalen.");
  }
};

export const generateQuizQuestions = async (
  models: FrayerModelData[],
  words: string[],
  settings: GenerationSettings
): Promise<QuizQuestion[]> => {
  let lastError: Error | null = null;
  const { model, config: aiCallConfig } = getAiConfig(settings.aiModel);
  const MAX_QUIZ_RETRIES = 3;

  const contextString = words.map((word, index) => {
    return `- ${word}: ${models[index].definitie}\nVoorbeeldzinnen: ${models[index].voorbeelden.map(v => v.zin).join('; ')}`;
  }).join('\n');

  let prompt: string;

  prompt = `Genereer een quiz met multiple-choice vragen in het Nederlands voor leerlingen in het secundair onderwijs (2e/3e graad). Je krijgt een lijst van woorden en hun Frayer Model data. Maak voor **elk woord** in de lijst precies één unieke en uitdagende vraag.

**Context:**
${contextString}

**Instructies voor de vragen:**
1.  **Variatie:** Creëer verschillende soorten vragen (definitie, synoniem, gatentekst, context).
2.  **Afleiders:** De foute antwoorden moeten plausibel zijn.
3.  **Uniek:** Zorg ervoor dat elke vraag uniek is.
4.  **Schema:** Volg het JSON-schema.
5.  **BELANGRIJK - Scheidbare werkwoorden:** Als je een gatentekst (invulvraag) maakt voor een scheidbaar werkwoord (bv. 'toelichten', 'opbellen', 'aanwijzen'):
    - Gebruik NIET de infinitief als antwoord
    - Gebruik in plaats daarvan het volledige werkwoord als één van de antwoordopties
    - Voorbeeld FOUT: "Hij wilde het probleem ___." met antwoord "toelichten"
    - Voorbeeld GOED: "Welk woord betekent 'uitleggen of verduidelijken'?" met antwoord "toelichten"
    - OF: Vermijd gatenteksten voor scheidbare werkwoorden en gebruik definitie- of synoniemvragen

Genereer een vraag voor elk van de volgende woorden: ${words.join(', ')}.`;

  for (let i = 0; i < MAX_QUIZ_RETRIES; i++) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          ...aiCallConfig,
          responseMimeType: 'application/json',
          responseSchema: quizSchema,
        },
      });

      const jsonString = cleanJsonOutput(response.text);
      const rawQuestions = JSON.parse(jsonString) as QuizQuestion[];

      if (!rawQuestions || rawQuestions.length !== words.length) {
        throw new Error("Ongeldige quizdata ontvangen van de AI.");
      }

      // Mix in Writing questions (approx 1 in 3)
      const processedQuestions = rawQuestions.map((q, index) => {
        // Every 3rd question is a writing question to test spelling
        if (index % 3 === 0) {
          const targetWord = words[index];
          const originalDef = models[index].definitie;

          // Explicitly censor the target word and variations (e.g. plurals) from the definition
          const censoredDef = censorTargetWord(originalDef, targetWord);

          return {
            ...q,
            type: QuestionType.Writing,
            vraag: `Typ het woord dat past bij deze definitie: "${censoredDef}"`,
            opties: [], // No options for writing
            correctAntwoordIndex: -1,
            woord: targetWord // Keep the target word
          };
        }
        return { ...q, type: QuestionType.MultipleChoice };
      });

      return processedQuestions;
    } catch (error) {
      console.error(`Fout bij het genereren van de quiz (poging ${i + 1}/${MAX_QUIZ_RETRIES}):`, error);
      lastError = error instanceof Error ? error : new Error(String(error));
      if (i < MAX_QUIZ_RETRIES - 1) {
        const delay = 1000 * Math.pow(2, i) + Math.random() * 100;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw new Error(`Kon de quiz niet genereren na ${MAX_QUIZ_RETRIES} pogingen. Fout: ${lastError?.message}`);
};

export const generateFeedbackForError = async (
  question: string,
  userAnswer: string,
  correctAnswer: string,
  settings: Pick<PracticeSettings, 'aiModel'>
): Promise<string> => {
  try {
    const { model, config: aiCallConfig } = getAiConfig(settings.aiModel);
    const response = await ai.models.generateContent({
      model,
      contents: `Een leerling gaf het foute antwoord op een quizvraag. Geef kort (max 2 zinnen) en bemoedigend feedback waarom het fout is en wat het verschil is met het juiste antwoord.
            
            Vraag: ${question}
            Fout antwoord van leerling: ${userAnswer}
            Juist antwoord: ${correctAnswer}
            
            Richt je tot de leerling.`,
      config: { ...aiCallConfig }
    });
    return response.text.trim();
  } catch (e) {
    return "Het antwoord was helaas niet correct. Kijk goed naar de definitie!";
  }
};


export const generateStory = async (words: string[], theme: string, settings: Pick<PracticeSettings, 'context' | 'difficulty' | 'aiModel'>): Promise<StoryData> => {
  try {
    const contextInstruction = getContextInstruction(settings.context, 'story');
    const difficultyInstruction = getDifficultyInstruction(settings.difficulty);
    const { model, config: aiCallConfig } = getAiConfig(settings.aiModel);

    const response = await ai.models.generateContent({
      model,
      contents: `Je bent een AI-assistent voor een leraar Nederlands, gespecialiseerd in NT2-leerlingen (14-15 jaar). Schrijf een verhaal over "${theme}".
- **Woorden:** ${words.join(', ')}
- **Niveau:** ${difficultyInstruction}
- **Context:** ${contextInstruction}

**Regels:**
1. Plot moet logisch zijn.
2. Integreer alle woorden natuurlijk en grammaticaal correct (juiste vervoeging!).
3. Markeer de woorden met **dubbele asterisken** (bv. **woord**).
4. Gebruik alinea labels (Alinea 1:, etc.).

Geef antwoord als JSON met "title" en "story".`,
      config: {
        ...aiCallConfig,
        responseMimeType: 'application/json',
        responseSchema: storySchema,
      }
    });
    const jsonString = cleanJsonOutput(response.text);
    return JSON.parse(jsonString) as StoryData;
  } catch (error) {
    console.error("Error generating story:", error);
    throw new Error("Kon het verhaal niet genereren.");
  }
};

export const generateFunnyTheme = async (words: string[], settings: GenerationSettings): Promise<string> => {
  try {
    const { model, config: aiCallConfig } = getAiConfig(settings.aiModel);
    const context = settings.context;
    let prompt: string;
    const basePrompt = `Bedenk een humoristisch en herkenbaar thema voor een kort verhaal voor jongeren van 14-15 jaar. Het verhaal zal de woorden '${words.join(', ')}' bevatten. Geef alleen het thema terug als een korte zin.`;

    // (Context logic omitted for brevity, remains similar but cleaner)
    if (context) {
      prompt = `${basePrompt} Context: ${context}.`;
    } else {
      prompt = basePrompt;
    }

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: { ...aiCallConfig }
    });
    const text = response.text;
    if (!text || text.trim() === '') throw new Error("Leeg antwoord");
    return text.trim();
  } catch (error) {
    console.error("Error generating theme:", error);
    throw new Error("Kon geen thema bedenken.");
  }
};

export const evaluateComprehension = async (story: string, summary: string, settings: Pick<PracticeSettings, 'aiModel'>): Promise<string> => {
  // (Implementation kept, ensuring clean text retrieval)
  try {
    const { model, config: aiCallConfig } = getAiConfig(settings.aiModel);
    const response = await ai.models.generateContent({
      model,
      config: { ...aiCallConfig, systemInstruction: "Je bent een behulpzame leraar. Begin positief. Gebruik headers: ### Oordeel, ### Analyse, ### Concrete tips." },
      contents: `Evalueer de samenvatting van de student.\nVERHAAL: ${story}\nSAMENVATTING: ${summary}`
    });
    return response.text;
  } catch (e) { throw new Error("Evaluatie mislukt"); }
};

export const evaluateReadingAnswer = async (story: string, question: string, answer: string, settings: Pick<PracticeSettings, 'aiModel'>): Promise<string> => {
  try {
    const { model, config: aiCallConfig } = getAiConfig(settings.aiModel);
    const response = await ai.models.generateContent({
      model,
      config: { ...aiCallConfig, systemInstruction: "Je bent een behulpzame leraar. Begin positief. Gebruik headers: ### Oordeel, ### Analyse, ### Concrete tips." },
      contents: `Evalueer het antwoord.\nVERHAAL: ${story}\nVRAAG: ${question}\nANTWOORD: ${answer}`
    });
    return response.text;
  } catch (e) { throw new Error("Evaluatie mislukt"); }
};

export const generateDidacticAnalysis = async (session: SessionRecord, studentName: string): Promise<string> => {
  if (!session.timingData) throw new Error("Geen timingdata.");
  const { model, config: aiCallConfig } = getAiConfig(session.settings.aiModel || 'fast');
  const prompt = `Analyseer de resultaten van leerling ${studentName}. Gebruik headers: ### Samenvatting, ### Analyse van leertempo en tijd, ### Inzichten in leergedrag, ### Concrete tips voor de leerkracht.\nData: ${JSON.stringify(session.quizResults)}`;
  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: { ...aiCallConfig }
  });
  return response.text;
};

export const extractKeyTerms = async (text: string, settings: GenerationSettings): Promise<string[]> => {
  try {
    const { model, config: aiCallConfig } = getAiConfig(settings.aiModel);

    // Limit text length to avoid token limits and excessive processing
    const truncatedText = text.slice(0, 25000);

    const response = await ai.models.generateContent({
      model,
      contents: `Analyseer de volgende tekst en extraheer de belangrijkste schooltaalwoorden of vakspecifieke termen (maximaal 100). Vermijd alledaagse woorden. Geef alleen de lijst terug.\n\nTEKST:\n${truncatedText}`,
      config: {
        ...aiCallConfig,
        responseMimeType: 'application/json',
        responseSchema: keyTermsSchema,
      }
    });

    const jsonString = cleanJsonOutput(response.text);
    const data = JSON.parse(jsonString) as { termen: string[] };

    const uniqueTerms = Array.from(new Set(data.termen.map(term => term.toLowerCase().trim())));
    uniqueTerms.sort((a, b) => a.localeCompare(b));

    return uniqueTerms;
  } catch (error) {
    console.error("Error extracting key terms:", error);
    throw new Error("Kon de sleuteltermen niet uit de tekst halen.");
  }
};
