// quizData.js - Sistema de niveles y generación de ejercicios
import { VOCABULARY_BASICO, VOCABULARY_INTERMEDIO, VOCABULARY_AVANZADO } from './quizVocabulary';
import { VERBS, getVerbsByLevel } from './quizVerbs';
import { PHRASES, getPhrasesByLevel, getRandomPhrase } from './quizPhrases';

export const LEVELS = [
    { id: 1, name: 'Básico 1', key: 'basico1', requiredXp: 0, icon: '🌱', exerciseCount: 100 },
    { id: 2, name: 'Básico 2', key: 'basico2', requiredXp: 500, icon: '🌿', exerciseCount: 100 },
    { id: 3, name: 'Básico 3', key: 'basico3', requiredXp: 1000, icon: '🍀', exerciseCount: 100 },
    { id: 4, name: 'Intermediário 1', key: 'inter1', requiredXp: 1800, icon: '🌳', exerciseCount: 100 },
    { id: 5, name: 'Intermediário 2', key: 'inter2', requiredXp: 2800, icon: '🌲', exerciseCount: 100 },
    { id: 6, name: 'Intermediário 3', key: 'inter3', requiredXp: 4000, icon: '🏔️', exerciseCount: 100 },
    { id: 7, name: 'Avançado 1', key: 'avancado1', requiredXp: 5500, icon: '⭐', exerciseCount: 100 },
    { id: 8, name: 'Avançado 2', key: 'avancado2', requiredXp: 7500, icon: '🌟', exerciseCount: 100 },
    { id: 9, name: 'Avançado 3', key: 'avancado3', requiredXp: 10000, icon: '💫', exerciseCount: 100 },
    { id: 10, name: 'Fluente', key: 'fluente', requiredXp: 15000, icon: '👑', exerciseCount: 100 },
];

export const LEAGUES = [
    { name: 'Bronze', icon: '🥉', minXp: 0, color: 'from-amber-600 to-amber-700' },
    { name: 'Prata', icon: '🥈', minXp: 500, color: 'from-slate-400 to-slate-500' },
    { name: 'Ouro', icon: '🥇', minXp: 1500, color: 'from-yellow-400 to-amber-500' },
    { name: 'Platina', icon: '💎', minXp: 3000, color: 'from-cyan-400 to-blue-500' },
    { name: 'Diamante', icon: '💠', minXp: 5000, color: 'from-blue-500 to-indigo-600' },
    { name: 'Mestre', icon: '👑', minXp: 8000, color: 'from-purple-500 to-pink-500' },
    { name: 'Lenda', icon: '🏆', minXp: 12000, color: 'from-amber-400 to-red-500' },
];

// Obtener vocabulario por nivel
const getVocabularyByLevel = (levelId) => {
    const basico = Object.values(VOCABULARY_BASICO).flat();
    const intermedio = Object.values(VOCABULARY_INTERMEDIO).flat();
    const avancado = Object.values(VOCABULARY_AVANZADO).flat();

    if (levelId <= 3) return basico;
    if (levelId <= 6) return [...basico, ...intermedio];
    return [...basico, ...intermedio, ...avancado];
};

// Generar ejercicio de vocabulario
const generateVocabExercise = (vocab, difficulty) => {
    const word = vocab[Math.floor(Math.random() * vocab.length)];
    const wrongAnswers = vocab
        .filter(w => w.pt !== word.pt)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3);
    const options = [...wrongAnswers.map(w => w.pt), word.pt].sort(() => Math.random() - 0.5);

    return {
        type: 'vocabulary',
        category: '📚 Vocabulário',
        question: `O que significa "${word.es}" em português?`,
        options,
        correct: options.indexOf(word.pt),
        difficulty,
        hint: `Dica: A palavra começa com "${word.pt.charAt(0).toUpperCase()}"`,
    };
};

// Generar ejercicio de vocabulario inverso (PT -> ES)
const generateReverseVocabExercise = (vocab, difficulty) => {
    const word = vocab[Math.floor(Math.random() * vocab.length)];
    const wrongAnswers = vocab
        .filter(w => w.es !== word.es)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3);
    const options = [...wrongAnswers.map(w => w.es), word.es].sort(() => Math.random() - 0.5);

    return {
        type: 'vocabulary',
        category: '📚 Vocabulário',
        question: `Como se diz "${word.pt}" em espanhol?`,
        options,
        correct: options.indexOf(word.es),
        difficulty,
        hint: `Dica: A palavra começa com "${word.es.charAt(0).toUpperCase()}"`,
    };
};

// Generar ejercicio de traducción
const generateTranslationExercise = (phrases, difficulty) => {
    const phrase = phrases[Math.floor(Math.random() * phrases.length)];
    const direction = Math.random() > 0.5;

    if (direction) {
        const wrongAnswers = phrases
            .filter(p => p.es !== phrase.es)
            .sort(() => Math.random() - 0.5)
            .slice(0, 3);
        const options = [...wrongAnswers.map(p => p.es), phrase.es].sort(() => Math.random() - 0.5);

        return {
            type: 'translation',
            category: '🌐 Tradução',
            question: `Como se diz "${phrase.pt}" em espanhol?`,
            options,
            correct: options.indexOf(phrase.es),
            difficulty,
        };
    } else {
        const wrongAnswers = phrases
            .filter(p => p.pt !== phrase.pt)
            .sort(() => Math.random() - 0.5)
            .slice(0, 3);
        const options = [...wrongAnswers.map(p => p.pt), phrase.pt].sort(() => Math.random() - 0.5);

        return {
            type: 'translation',
            category: '🌐 Tradução',
            question: `Traduza: "${phrase.es}"`,
            options,
            correct: options.indexOf(phrase.pt),
            difficulty,
        };
    }
};

// Generar ejercicio de conjugación
const generateConjugationExercise = (verbs, difficulty) => {
    const verb = verbs[Math.floor(Math.random() * verbs.length)];
    const tenses = ['presente', 'pasado'];
    const tense = tenses[Math.floor(Math.random() * Math.min(difficulty, tenses.length))];
    const conjugations = verb[tense] || verb.presente;
    const pronouns = Object.keys(conjugations);
    const pronoun = pronouns[Math.floor(Math.random() * pronouns.length)];
    const correct = conjugations[pronoun];

    const allConjugations = [...new Set(Object.values(conjugations))];
    const wrongAnswers = allConjugations.filter(c => c !== correct);

    // Si no hay suficientes respuestas incorrectas, agregar de otros verbos
    if (wrongAnswers.length < 3) {
        const otherVerb = verbs[Math.floor(Math.random() * verbs.length)];
        const otherConjs = Object.values(otherVerb[tense] || otherVerb.presente);
        wrongAnswers.push(...otherConjs.filter(c => c !== correct && !wrongAnswers.includes(c)));
    }

    const options = [...wrongAnswers.slice(0, 3), correct].sort(() => Math.random() - 0.5);
    const tenseName = tense === 'presente' ? 'presente' : 'pretérito';

    return {
        type: 'conjugation',
        category: '📝 Conjugação',
        question: `Conjugue "${verb.infinitive.toUpperCase()}" para "${pronoun}" (${tenseName}):`,
        options,
        correct: options.indexOf(correct),
        difficulty,
        verbTranslation: verb.pt,
    };
};

// Generar ejercicio de escuchar
const generateListeningExercise = (phrases, difficulty) => {
    const phrase = phrases[Math.floor(Math.random() * phrases.length)];

    return {
        type: 'listening',
        category: '👂 Escutar',
        question: 'Escute e escreva o que ouviu em espanhol:',
        audioText: phrase.es,
        answer: phrase.es.toLowerCase().replace(/[¿?¡!.,]/g, '').trim(),
        translation: phrase.pt,
        difficulty,
    };
};

// Generar ejercicio de hablar
const generateSpeakingExercise = (phrases, difficulty) => {
    const phrase = phrases[Math.floor(Math.random() * phrases.length)];

    return {
        type: 'speaking',
        category: '🎤 Falar',
        question: 'Pronuncie a frase abaixo em espanhol:',
        textToSpeak: phrase.es,
        translation: phrase.pt,
        difficulty,
    };
};

// Generar ejercicio de completar
const generateCompleteExercise = (phrases, vocab, difficulty) => {
    const phrase = phrases[Math.floor(Math.random() * phrases.length)];
    const words = phrase.es.split(' ').filter(w => w.length > 2);

    if (words.length < 2) return generateVocabExercise(vocab, difficulty);

    const wordIndex = Math.floor(Math.random() * words.length);
    const correctWord = words[wordIndex].replace(/[¿?¡!.,]/g, '');
    const displayPhrase = phrase.es.replace(correctWord, '___');

    const wrongWords = vocab
        .map(v => v.es)
        .filter(w => w.toLowerCase() !== correctWord.toLowerCase())
        .sort(() => Math.random() - 0.5)
        .slice(0, 3);

    const options = [...wrongWords, correctWord].sort(() => Math.random() - 0.5);

    return {
        type: 'complete',
        category: '✏️ Completar',
        question: `Complete a frase: "${displayPhrase}"`,
        options,
        correct: options.indexOf(correctWord),
        fullPhrase: phrase.es,
        translation: phrase.pt,
        difficulty,
    };
};

// Generar ejercicio de ordenar palabras
const generateOrderExercise = (phrases, difficulty) => {
    const phrase = phrases[Math.floor(Math.random() * phrases.length)];
    const words = phrase.es.split(' ');

    if (words.length < 3 || words.length > 8) {
        return generateTranslationExercise(phrases, difficulty);
    }

    const shuffled = [...words].sort(() => Math.random() - 0.5);

    return {
        type: 'order',
        category: '🔀 Ordenar',
        question: `Ordene as palavras para formar uma frase:`,
        words: shuffled,
        correctOrder: words.join(' '),
        translation: phrase.pt,
        difficulty,
    };
};

// Función principal para generar ejercicios
export const generateExercisesForLevel = (levelKey, count = 10) => {
    const levelInfo = LEVELS.find(l => l.key === levelKey) || LEVELS[0];
    const levelId = levelInfo.id;

    const vocab = getVocabularyByLevel(levelId);
    const verbs = getVerbsByLevel(levelId);
    const phrases = getPhrasesByLevel(levelId);

    const exercises = [];
    const types = ['vocabulary', 'reverseVocab', 'translation', 'conjugation', 'listening', 'speaking', 'complete'];

    // Distribuir tipos de ejercicio según el nivel
    const typeWeights = {
        vocabulary: levelId <= 3 ? 25 : 15,
        reverseVocab: levelId <= 3 ? 20 : 15,
        translation: 20,
        conjugation: levelId >= 2 ? 15 : 5,
        listening: levelId >= 2 ? 10 : 5,
        speaking: levelId >= 3 ? 10 : 5,
        complete: 10,
    };

    const weightedTypes = [];
    Object.entries(typeWeights).forEach(([type, weight]) => {
        for (let i = 0; i < weight; i++) weightedTypes.push(type);
    });

    for (let i = 0; i < count; i++) {
        const type = weightedTypes[Math.floor(Math.random() * weightedTypes.length)];
        const difficulty = Math.min(Math.ceil(levelId / 3), 3);

        let exercise;
        switch (type) {
            case 'vocabulary':
                exercise = generateVocabExercise(vocab, difficulty);
                break;
            case 'reverseVocab':
                exercise = generateReverseVocabExercise(vocab, difficulty);
                break;
            case 'translation':
                exercise = generateTranslationExercise(phrases, difficulty);
                break;
            case 'conjugation':
                exercise = generateConjugationExercise(verbs, difficulty);
                break;
            case 'listening':
                exercise = generateListeningExercise(phrases, difficulty);
                break;
            case 'speaking':
                exercise = generateSpeakingExercise(phrases, difficulty);
                break;
            case 'complete':
                exercise = generateCompleteExercise(phrases, vocab, difficulty);
                break;
            default:
                exercise = generateVocabExercise(vocab, difficulty);
        }

        exercises.push(exercise);
    }

    return exercises;
};

// Estadísticas totales
export const STATS = {
    totalWords: Object.values(VOCABULARY_BASICO).flat().length +
        Object.values(VOCABULARY_INTERMEDIO).flat().length +
        Object.values(VOCABULARY_AVANZADO).flat().length,
    totalVerbs: Object.values(VERBS).flat().length,
    totalPhrases: Object.values(PHRASES).flat().length,
    totalLevels: LEVELS.length,
    exercisesPerLevel: 100,
    get totalExercises() { return this.totalLevels * this.exercisesPerLevel; },
};

export { VOCABULARY_BASICO, VOCABULARY_INTERMEDIO, VOCABULARY_AVANZADO };
export { VERBS };
export { PHRASES };
