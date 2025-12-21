// Archivo: src/lib/spanishAI.js
// Sistema de IA Local para Asistente de Español

/**
 * Base de Conocimiento de Español
 */
const spanishKnowledge = {
    // Gramática básica
    grammar: {
        articles: {
            definite: { el: 'masculino singular', la: 'femenino singular', los: 'masculino plural', las: 'femenino plural' },
            indefinite: { un: 'masculino singular', una: 'femenino singular', unos: 'masculino plural', unas: 'femenino plural' }
        },
        pronouns: {
            subject: ['yo', 'tú', 'él/ella/usted', 'nosotros/nosotras', 'vosotros/vosotras', 'ellos/ellas/ustedes'],
            object: ['me', 'te', 'lo/la/le', 'nos', 'os', 'los/las/les']
        },
        verbTenses: {
            present: 'Presente',
            preterite: 'Pretérito',
            imperfect: 'Imperfecto',
            future: 'Futuro',
            conditional: 'Condicional'
        }
    },

    // Vocabulario común
    vocabulary: {
        greetings: {
            'hola': 'olá',
            'buenos días': 'bom dia',
            'buenas tardes': 'boa tarde',
            'buenas noches': 'boa noite',
            'adiós': 'adeus',
            'hasta luego': 'até logo'
        },
        numbers: {
            'uno': '1', 'dos': '2', 'tres': '3', 'cuatro': '4', 'cinco': '5',
            'seis': '6', 'siete': '7', 'ocho': '8', 'nueve': '9', 'diez': '10'
        },
        colors: {
            'rojo': 'vermelho', 'azul': 'azul', 'verde': 'verde', 'amarillo': 'amarelo',
            'negro': 'preto', 'blanco': 'branco', 'gris': 'cinza'
        },
        family: {
            'padre': 'pai', 'madre': 'mãe', 'hijo': 'filho', 'hija': 'filha',
            'hermano': 'irmão', 'hermana': 'irmã', 'abuelo': 'avô', 'abuela': 'avó'
        }
    },

    // Conjugaciones verbales comunes
    verbs: {
        ser: {
            present: { yo: 'soy', tú: 'eres', él: 'es', nosotros: 'somos', vosotros: 'sois', ellos: 'son' },
            preterite: { yo: 'fui', tú: 'fuiste', él: 'fue', nosotros: 'fuimos', vosotros: 'fuisteis', ellos: 'fueron' }
        },
        estar: {
            present: { yo: 'estoy', tú: 'estás', él: 'está', nosotros: 'estamos', vosotros: 'estáis', ellos: 'están' }
        },
        hablar: {
            present: { yo: 'hablo', tú: 'hablas', él: 'habla', nosotros: 'hablamos', vosotros: 'habláis', ellos: 'hablan' }
        },
        tener: {
            present: { yo: 'tengo', tú: 'tienes', él: 'tiene', nosotros: 'tenemos', vosotros: 'tenéis', ellos: 'tienen' }
        }
    },

    // Frases comunes
    phrases: {
        '¿cómo estás?': 'como você está?',
        '¿qué tal?': 'como vai?',
        'me llamo': 'meu nome é',
        '¿cómo te llamas?': 'como você se chama?',
        'mucho gusto': 'muito prazer',
        'por favor': 'por favor',
        'gracias': 'obrigado/obrigada',
        'de nada': 'de nada',
        'lo siento': 'desculpe',
        'no entiendo': 'não entendo'
    },

    // Reglas gramaticales
    rules: {
        gender: 'En español, los sustantivos tienen género (masculino o femenino). Generalmente, palabras que terminan en -o son masculinas y las que terminan en -a son femeninas.',
        serVsEstar: 'SER se usa para características permanentes (soy brasileño). ESTAR se usa para estados temporales (estoy cansado).',
        accentuation: 'Las tildes en español indican dónde recae el acento de la palabra y pueden cambiar el significado.'
    }
};

/**
 * Patrones de detección de intención
 */
const intentPatterns = {
    greeting: /\b(hola|oi|olá|buenos días|bom dia|hey)\b/i,
    farewell: /\b(adiós|adeus|tchau|até logo|hasta luego)\b/i,
    howToSay: /\b(cómo se dice|como se diz|como fala|traduz|tradução)\b/i,
    conjugation: /\b(conjug|verbo|tiempo verbal)\b/i,
    grammar: /\b(gramática|regra|por que|porque|diferença)\b/i,
    practice: /\b(praticar|exercício|treinar|aprender)\b/i,
    help: /\b(ajuda|help|socorro|não entendo)\b/i,
    level: /\b(nível|nivel|básico|intermediário|avançado)\b/i
};

/**
 * Motor de IA - Procesa la entrada y genera respuesta
 */
class SpanishAI {
    constructor() {
        this.context = [];
        this.userLevel = 'básico'; // básico, intermediário, avançado
    }

    /**
     * Procesa un mensaje del usuario
     */
    processMessage(userMessage) {
        const message = userMessage.toLowerCase().trim();

        // Detectar intención
        const intent = this.detectIntent(message);

        // Generar respuesta basada en la intención
        const response = this.generateResponse(intent, message);

        // Guardar en contexto
        this.context.push({ user: userMessage, ai: response, intent });
        if (this.context.length > 10) this.context.shift(); // Mantener solo últimos 10

        return response;
    }

    /**
     * Detecta la intención del usuario
     */
    detectIntent(message) {
        for (const [intent, pattern] of Object.entries(intentPatterns)) {
            if (pattern.test(message)) {
                return intent;
            }
        }

        // Intentos específicos
        if (this.isAskingTranslation(message)) return 'translation';
        if (this.isAskingConjugation(message)) return 'conjugation';
        if (this.isAskingGrammar(message)) return 'grammar';

        return 'general';
    }

    /**
     * Genera respuesta basada en la intención
     */
    generateResponse(intent, message) {
        switch (intent) {
            case 'greeting':
                return this.handleGreeting();

            case 'farewell':
                return this.handleFarewell();

            case 'howToSay':
            case 'translation':
                return this.handleTranslation(message);

            case 'conjugation':
                return this.handleConjugation(message);

            case 'grammar':
                return this.handleGrammar(message);

            case 'practice':
                return this.handlePractice();

            case 'help':
                return this.handleHelp();

            case 'level':
                return this.handleLevel(message);

            default:
                return this.handleGeneral(message);
        }
    }

    /**
     * Handlers para cada tipo de intención
     */
    handleGreeting() {
        const greetings = [
            '¡Hola! Soy tu asistente de español. ¿En qué puedo ayudarte hoy?',
            '¡Buenos días! Estoy aquí para ayudarte a aprender español. ¿Qué te gustaría practicar?',
            '¡Hola! ¿Listo para practicar español? Pregúntame lo que quieras.'
        ];
        return greetings[Math.floor(Math.random() * greetings.length)];
    }

    handleFarewell() {
        const farewells = [
            '¡Hasta luego! Sigue practicando tu español. 👋',
            '¡Adiós! Nos vemos pronto. ¡Buen estudio! 📚',
            '¡Hasta la próxima! Recuerda practicar todos los días. 🌟'
        ];
        return farewells[Math.floor(Math.random() * farewells.length)];
    }

    handleTranslation(message) {
        // Buscar en vocabulario
        for (const [category, words] of Object.entries(spanishKnowledge.vocabulary)) {
            for (const [spanish, portuguese] of Object.entries(words)) {
                if (message.includes(spanish.toLowerCase()) || message.includes(portuguese.toLowerCase())) {
                    return `📝 "${spanish}" en español significa "${portuguese}" en portugués.\n\n💡 Ejemplo: "El cielo es ${spanish}" = "O céu é ${portuguese}"`;
                }
            }
        }

        // Buscar en frases
        for (const [spanish, portuguese] of Object.entries(spanishKnowledge.phrases)) {
            if (message.includes(spanish.toLowerCase())) {
                return `💬 "${spanish}" se traduce como "${portuguese}".\n\n✨ ¡Es una frase muy útil!`;
            }
        }

        return '🤔 No encontré esa palabra en mi base de datos. ¿Podrías ser más específico? Por ejemplo: "¿Cómo se dice casa?" o "Traduce rojo"';
    }

    handleConjugation(message) {
        // Detectar verbo
        const verbs = Object.keys(spanishKnowledge.verbs);
        for (const verb of verbs) {
            if (message.includes(verb)) {
                const conjugations = spanishKnowledge.verbs[verb];
                let response = `📖 Conjugación del verbo "${verb.toUpperCase()}":\n\n`;

                if (conjugations.present) {
                    response += '**Presente:**\n';
                    for (const [pronoun, form] of Object.entries(conjugations.present)) {
                        response += `• ${pronoun}: ${form}\n`;
                    }
                }

                if (conjugations.preterite) {
                    response += '\n**Pretérito:**\n';
                    for (const [pronoun, form] of Object.entries(conjugations.preterite)) {
                        response += `• ${pronoun}: ${form}\n`;
                    }
                }

                return response;
            }
        }

        return '📚 Puedo ayudarte con los verbos: ser, estar, hablar, tener. ¿Cuál te gustaría conjugar?';
    }

    handleGrammar(message) {
        if (message.includes('ser') || message.includes('estar')) {
            return `📖 **Diferencia entre SER y ESTAR:**\n\n${spanishKnowledge.rules.serVsEstar}\n\n**Ejemplos:**\n• Soy profesor (permanente)\n• Estoy cansado (temporal)`;
        }

        if (message.includes('género') || message.includes('masculino') || message.includes('femenino')) {
            return `📖 **Género en Español:**\n\n${spanishKnowledge.rules.gender}\n\n**Ejemplos:**\n• el libro (masculino)\n• la mesa (femenino)`;
        }

        return '📚 Puedo explicarte sobre:\n• Diferencia entre SER y ESTAR\n• Género de sustantivos\n• Artículos (el, la, los, las)\n• Pronombres\n\n¿Qué te gustaría aprender?';
    }

    handlePractice() {
        const exercises = [
            '✍️ **Ejercicio:** Traduce al español:\n1. Bom dia\n2. Como você está?\n3. Meu nome é João\n\n¡Intenta responder!',
            '🎯 **Práctica:** Completa con SER o ESTAR:\n1. Yo ___ brasileño\n2. Ella ___ cansada\n3. Nosotros ___ en casa',
            '📝 **Desafío:** Conjuga el verbo HABLAR en presente:\nYo ___\nTú ___\nÉl/Ella ___'
        ];
        return exercises[Math.floor(Math.random() * exercises.length)];
    }

    handleHelp() {
        return `🤖 **¿Cómo puedo ayudarte?**\n\nPuedo ayudarte con:\n\n📝 **Traducción:** "¿Cómo se dice casa?"\n📖 **Conjugación:** "Conjuga el verbo ser"\n📚 **Gramática:** "Diferencia entre ser y estar"\n✍️ **Práctica:** "Quiero practicar"\n🎯 **Nivel:** "Cambiar a nivel intermedio"\n\n¡Pregúntame lo que necesites!`;
    }

    handleLevel(message) {
        if (message.includes('básico')) {
            this.userLevel = 'básico';
            return '✅ Nivel cambiado a BÁSICO. Empezaremos con lo fundamental.';
        }
        if (message.includes('intermediário') || message.includes('intermedio')) {
            this.userLevel = 'intermediário';
            return '✅ Nivel cambiado a INTERMEDIÁRIO. ¡Vamos a profundizar más!';
        }
        if (message.includes('avançado') || message.includes('avanzado')) {
            this.userLevel = 'avançado';
            return '✅ Nivel cambiado a AVANÇADO. ¡Preparado para el desafío!';
        }
        return `📊 Tu nivel actual es: ${this.userLevel.toUpperCase()}\n\nPuedes cambiarlo diciendo:\n• "Cambiar a básico"\n• "Cambiar a intermediário"\n• "Cambiar a avançado"`;
    }

    handleGeneral(message) {
        // Respuestas generales inteligentes
        const responses = [
            '🤔 Interesante pregunta. ¿Podrías ser más específico? Puedo ayudarte con traducción, gramática, conjugación o práctica.',
            '💭 No estoy seguro de entender. ¿Quieres que te ayude con vocabulario, gramática o ejercicios?',
            '🌟 ¡Buena pregunta! Intenta preguntar sobre: traducción de palabras, conjugación de verbos, o reglas gramaticales.'
        ];
        return responses[Math.floor(Math.random() * responses.length)];
    }

    /**
     * Métodos auxiliares
     */
    isAskingTranslation(message) {
        return message.includes('traduz') || message.includes('significa') ||
            message.includes('como se dice') || message.includes('como fala');
    }

    isAskingConjugation(message) {
        return message.includes('conjug') || message.includes('verbo') ||
            message.includes('tiempo');
    }

    isAskingGrammar(message) {
        return message.includes('gramática') || message.includes('regra') ||
            message.includes('diferença') || message.includes('por que');
    }

    /**
     * Obtener sugerencias de seguimiento
     */
    getSuggestions() {
        const suggestions = [
            '¿Cómo se dice "casa"?',
            'Conjuga el verbo ser',
            'Diferencia entre ser y estar',
            'Quiero practicar',
            'Números en español',
            'Colores en español'
        ];
        return suggestions.sort(() => 0.5 - Math.random()).slice(0, 3);
    }
}

// Exportar instancia singleton
export const spanishAI = new SpanishAI();
export default spanishAI;
