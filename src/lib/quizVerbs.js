// quizVerbs.js - Base de verbos con conjugaciones completas

export const VERBS = {
    // VERBOS REGULARES -AR (30+)
    regulares_ar: [
        { infinitive: 'hablar', pt: 'falar', presente: { yo: 'hablo', tú: 'hablas', él: 'habla', nosotros: 'hablamos', vosotros: 'habláis', ellos: 'hablan' }, pasado: { yo: 'hablé', tú: 'hablaste', él: 'habló', nosotros: 'hablamos', ellos: 'hablaron' } },
        { infinitive: 'trabajar', pt: 'trabalhar', presente: { yo: 'trabajo', tú: 'trabajas', él: 'trabaja', nosotros: 'trabajamos', vosotros: 'trabajáis', ellos: 'trabajan' }, pasado: { yo: 'trabajé', tú: 'trabajaste', él: 'trabajó', nosotros: 'trabajamos', ellos: 'trabajaron' } },
        { infinitive: 'estudiar', pt: 'estudar', presente: { yo: 'estudio', tú: 'estudias', él: 'estudia', nosotros: 'estudiamos', vosotros: 'estudiáis', ellos: 'estudian' }, pasado: { yo: 'estudié', tú: 'estudiaste', él: 'estudió', nosotros: 'estudiamos', ellos: 'estudiaron' } },
        { infinitive: 'comprar', pt: 'comprar', presente: { yo: 'compro', tú: 'compras', él: 'compra', nosotros: 'compramos', vosotros: 'compráis', ellos: 'compran' }, pasado: { yo: 'compré', tú: 'compraste', él: 'compró', nosotros: 'compramos', ellos: 'compraron' } },
        { infinitive: 'caminar', pt: 'andar', presente: { yo: 'camino', tú: 'caminas', él: 'camina', nosotros: 'caminamos', vosotros: 'camináis', ellos: 'caminan' }, pasado: { yo: 'caminé', tú: 'caminaste', él: 'caminó', nosotros: 'caminamos', ellos: 'caminaron' } },
        { infinitive: 'bailar', pt: 'dançar', presente: { yo: 'bailo', tú: 'bailas', él: 'baila', nosotros: 'bailamos', vosotros: 'bailáis', ellos: 'bailan' }, pasado: { yo: 'bailé', tú: 'bailaste', él: 'bailó', nosotros: 'bailamos', ellos: 'bailaron' } },
        { infinitive: 'cantar', pt: 'cantar', presente: { yo: 'canto', tú: 'cantas', él: 'canta', nosotros: 'cantamos', vosotros: 'cantáis', ellos: 'cantan' }, pasado: { yo: 'canté', tú: 'cantaste', él: 'cantó', nosotros: 'cantamos', ellos: 'cantaron' } },
        { infinitive: 'cocinar', pt: 'cozinhar', presente: { yo: 'cocino', tú: 'cocinas', él: 'cocina', nosotros: 'cocinamos', vosotros: 'cocináis', ellos: 'cocinan' }, pasado: { yo: 'cociné', tú: 'cocinaste', él: 'cocinó', nosotros: 'cocinamos', ellos: 'cocinaron' } },
        { infinitive: 'descansar', pt: 'descansar', presente: { yo: 'descanso', tú: 'descansas', él: 'descansa', nosotros: 'descansamos', vosotros: 'descansáis', ellos: 'descansan' }, pasado: { yo: 'descansé', tú: 'descansaste', él: 'descansó', nosotros: 'descansamos', ellos: 'descansaron' } },
        { infinitive: 'escuchar', pt: 'escutar', presente: { yo: 'escucho', tú: 'escuchas', él: 'escucha', nosotros: 'escuchamos', vosotros: 'escucháis', ellos: 'escuchan' }, pasado: { yo: 'escuché', tú: 'escuchaste', él: 'escuchó', nosotros: 'escuchamos', ellos: 'escucharon' } },
        { infinitive: 'llamar', pt: 'chamar', presente: { yo: 'llamo', tú: 'llamas', él: 'llama', nosotros: 'llamamos', vosotros: 'llamáis', ellos: 'llaman' }, pasado: { yo: 'llamé', tú: 'llamaste', él: 'llamó', nosotros: 'llamamos', ellos: 'llamaron' } },
        { infinitive: 'llevar', pt: 'levar', presente: { yo: 'llevo', tú: 'llevas', él: 'lleva', nosotros: 'llevamos', vosotros: 'lleváis', ellos: 'llevan' }, pasado: { yo: 'llevé', tú: 'llevaste', él: 'llevó', nosotros: 'llevamos', ellos: 'llevaron' } },
        { infinitive: 'mirar', pt: 'olhar', presente: { yo: 'miro', tú: 'miras', él: 'mira', nosotros: 'miramos', vosotros: 'miráis', ellos: 'miran' }, pasado: { yo: 'miré', tú: 'miraste', él: 'miró', nosotros: 'miramos', ellos: 'miraron' } },
        { infinitive: 'pagar', pt: 'pagar', presente: { yo: 'pago', tú: 'pagas', él: 'paga', nosotros: 'pagamos', vosotros: 'pagáis', ellos: 'pagan' }, pasado: { yo: 'pagué', tú: 'pagaste', él: 'pagó', nosotros: 'pagamos', ellos: 'pagaron' } },
        { infinitive: 'pasar', pt: 'passar', presente: { yo: 'paso', tú: 'pasas', él: 'pasa', nosotros: 'pasamos', vosotros: 'pasáis', ellos: 'pasan' }, pasado: { yo: 'pasé', tú: 'pasaste', él: 'pasó', nosotros: 'pasamos', ellos: 'pasaron' } },
        { infinitive: 'preguntar', pt: 'perguntar', presente: { yo: 'pregunto', tú: 'preguntas', él: 'pregunta', nosotros: 'preguntamos', vosotros: 'preguntáis', ellos: 'preguntan' }, pasado: { yo: 'pregunté', tú: 'preguntaste', él: 'preguntó', nosotros: 'preguntamos', ellos: 'preguntaron' } },
        { infinitive: 'terminar', pt: 'terminar', presente: { yo: 'termino', tú: 'terminas', él: 'termina', nosotros: 'terminamos', vosotros: 'termináis', ellos: 'terminan' }, pasado: { yo: 'terminé', tú: 'terminaste', él: 'terminó', nosotros: 'terminamos', ellos: 'terminaron' } },
        { infinitive: 'tomar', pt: 'tomar', presente: { yo: 'tomo', tú: 'tomas', él: 'toma', nosotros: 'tomamos', vosotros: 'tomáis', ellos: 'toman' }, pasado: { yo: 'tomé', tú: 'tomaste', él: 'tomó', nosotros: 'tomamos', ellos: 'tomaron' } },
        { infinitive: 'usar', pt: 'usar', presente: { yo: 'uso', tú: 'usas', él: 'usa', nosotros: 'usamos', vosotros: 'usáis', ellos: 'usan' }, pasado: { yo: 'usé', tú: 'usaste', él: 'usó', nosotros: 'usamos', ellos: 'usaron' } },
        { infinitive: 'viajar', pt: 'viajar', presente: { yo: 'viajo', tú: 'viajas', él: 'viaja', nosotros: 'viajamos', vosotros: 'viajáis', ellos: 'viajan' }, pasado: { yo: 'viajé', tú: 'viajaste', él: 'viajó', nosotros: 'viajamos', ellos: 'viajaron' } },
    ],

    // VERBOS REGULARES -ER (20+)
    regulares_er: [
        { infinitive: 'comer', pt: 'comer', presente: { yo: 'como', tú: 'comes', él: 'come', nosotros: 'comemos', vosotros: 'coméis', ellos: 'comen' }, pasado: { yo: 'comí', tú: 'comiste', él: 'comió', nosotros: 'comimos', ellos: 'comieron' } },
        { infinitive: 'beber', pt: 'beber', presente: { yo: 'bebo', tú: 'bebes', él: 'bebe', nosotros: 'bebemos', vosotros: 'bebéis', ellos: 'beben' }, pasado: { yo: 'bebí', tú: 'bebiste', él: 'bebió', nosotros: 'bebimos', ellos: 'bebieron' } },
        { infinitive: 'leer', pt: 'ler', presente: { yo: 'leo', tú: 'lees', él: 'lee', nosotros: 'leemos', vosotros: 'leéis', ellos: 'leen' }, pasado: { yo: 'leí', tú: 'leíste', él: 'leyó', nosotros: 'leímos', ellos: 'leyeron' } },
        { infinitive: 'correr', pt: 'correr', presente: { yo: 'corro', tú: 'corres', él: 'corre', nosotros: 'corremos', vosotros: 'corréis', ellos: 'corren' }, pasado: { yo: 'corrí', tú: 'corriste', él: 'corrió', nosotros: 'corrimos', ellos: 'corrieron' } },
        { infinitive: 'aprender', pt: 'aprender', presente: { yo: 'aprendo', tú: 'aprendes', él: 'aprende', nosotros: 'aprendemos', vosotros: 'aprendéis', ellos: 'aprenden' }, pasado: { yo: 'aprendí', tú: 'aprendiste', él: 'aprendió', nosotros: 'aprendimos', ellos: 'aprendieron' } },
        { infinitive: 'comprender', pt: 'compreender', presente: { yo: 'comprendo', tú: 'comprendes', él: 'comprende', nosotros: 'comprendemos', vosotros: 'comprendéis', ellos: 'comprenden' }, pasado: { yo: 'comprendí', tú: 'comprendiste', él: 'comprendió', nosotros: 'comprendimos', ellos: 'comprendieron' } },
        { infinitive: 'vender', pt: 'vender', presente: { yo: 'vendo', tú: 'vendes', él: 'vende', nosotros: 'vendemos', vosotros: 'vendéis', ellos: 'venden' }, pasado: { yo: 'vendí', tú: 'vendiste', él: 'vendió', nosotros: 'vendimos', ellos: 'vendieron' } },
        { infinitive: 'responder', pt: 'responder', presente: { yo: 'respondo', tú: 'respondes', él: 'responde', nosotros: 'respondemos', vosotros: 'respondéis', ellos: 'responden' }, pasado: { yo: 'respondí', tú: 'respondiste', él: 'respondió', nosotros: 'respondimos', ellos: 'respondieron' } },
        { infinitive: 'creer', pt: 'crer', presente: { yo: 'creo', tú: 'crees', él: 'cree', nosotros: 'creemos', vosotros: 'creéis', ellos: 'creen' }, pasado: { yo: 'creí', tú: 'creíste', él: 'creyó', nosotros: 'creímos', ellos: 'creyeron' } },
        { infinitive: 'deber', pt: 'dever', presente: { yo: 'debo', tú: 'debes', él: 'debe', nosotros: 'debemos', vosotros: 'debéis', ellos: 'deben' }, pasado: { yo: 'debí', tú: 'debiste', él: 'debió', nosotros: 'debimos', ellos: 'debieron' } },
    ],

    // VERBOS REGULARES -IR (20+)
    regulares_ir: [
        { infinitive: 'vivir', pt: 'viver', presente: { yo: 'vivo', tú: 'vives', él: 'vive', nosotros: 'vivimos', vosotros: 'vivís', ellos: 'viven' }, pasado: { yo: 'viví', tú: 'viviste', él: 'vivió', nosotros: 'vivimos', ellos: 'vivieron' } },
        { infinitive: 'escribir', pt: 'escrever', presente: { yo: 'escribo', tú: 'escribes', él: 'escribe', nosotros: 'escribimos', vosotros: 'escribís', ellos: 'escriben' }, pasado: { yo: 'escribí', tú: 'escribiste', él: 'escribió', nosotros: 'escribimos', ellos: 'escribieron' } },
        { infinitive: 'abrir', pt: 'abrir', presente: { yo: 'abro', tú: 'abres', él: 'abre', nosotros: 'abrimos', vosotros: 'abrís', ellos: 'abren' }, pasado: { yo: 'abrí', tú: 'abriste', él: 'abrió', nosotros: 'abrimos', ellos: 'abrieron' } },
        { infinitive: 'recibir', pt: 'receber', presente: { yo: 'recibo', tú: 'recibes', él: 'recibe', nosotros: 'recibimos', vosotros: 'recibís', ellos: 'reciben' }, pasado: { yo: 'recibí', tú: 'recibiste', él: 'recibió', nosotros: 'recibimos', ellos: 'recibieron' } },
        { infinitive: 'subir', pt: 'subir', presente: { yo: 'subo', tú: 'subes', él: 'sube', nosotros: 'subimos', vosotros: 'subís', ellos: 'suben' }, pasado: { yo: 'subí', tú: 'subiste', él: 'subió', nosotros: 'subimos', ellos: 'subieron' } },
        { infinitive: 'decidir', pt: 'decidir', presente: { yo: 'decido', tú: 'decides', él: 'decide', nosotros: 'decidimos', vosotros: 'decidís', ellos: 'deciden' }, pasado: { yo: 'decidí', tú: 'decidiste', él: 'decidió', nosotros: 'decidimos', ellos: 'decidieron' } },
        { infinitive: 'partir', pt: 'partir', presente: { yo: 'parto', tú: 'partes', él: 'parte', nosotros: 'partimos', vosotros: 'partís', ellos: 'parten' }, pasado: { yo: 'partí', tú: 'partiste', él: 'partió', nosotros: 'partimos', ellos: 'partieron' } },
        { infinitive: 'asistir', pt: 'assistir', presente: { yo: 'asisto', tú: 'asistes', él: 'asiste', nosotros: 'asistimos', vosotros: 'asistís', ellos: 'asisten' }, pasado: { yo: 'asistí', tú: 'asististe', él: 'asistió', nosotros: 'asistimos', ellos: 'asistieron' } },
        { infinitive: 'permitir', pt: 'permitir', presente: { yo: 'permito', tú: 'permites', él: 'permite', nosotros: 'permitimos', vosotros: 'permitís', ellos: 'permiten' }, pasado: { yo: 'permití', tú: 'permitiste', él: 'permitió', nosotros: 'permitimos', ellos: 'permitieron' } },
        { infinitive: 'compartir', pt: 'compartilhar', presente: { yo: 'comparto', tú: 'compartes', él: 'comparte', nosotros: 'compartimos', vosotros: 'compartís', ellos: 'comparten' }, pasado: { yo: 'compartí', tú: 'compartiste', él: 'compartió', nosotros: 'compartimos', ellos: 'compartieron' } },
    ],

    // VERBOS IRREGULARES (30+)
    irregulares: [
        { infinitive: 'ser', pt: 'ser', presente: { yo: 'soy', tú: 'eres', él: 'es', nosotros: 'somos', vosotros: 'sois', ellos: 'son' }, pasado: { yo: 'fui', tú: 'fuiste', él: 'fue', nosotros: 'fuimos', ellos: 'fueron' } },
        { infinitive: 'estar', pt: 'estar', presente: { yo: 'estoy', tú: 'estás', él: 'está', nosotros: 'estamos', vosotros: 'estáis', ellos: 'están' }, pasado: { yo: 'estuve', tú: 'estuviste', él: 'estuvo', nosotros: 'estuvimos', ellos: 'estuvieron' } },
        { infinitive: 'tener', pt: 'ter', presente: { yo: 'tengo', tú: 'tienes', él: 'tiene', nosotros: 'tenemos', vosotros: 'tenéis', ellos: 'tienen' }, pasado: { yo: 'tuve', tú: 'tuviste', él: 'tuvo', nosotros: 'tuvimos', ellos: 'tuvieron' } },
        { infinitive: 'hacer', pt: 'fazer', presente: { yo: 'hago', tú: 'haces', él: 'hace', nosotros: 'hacemos', vosotros: 'hacéis', ellos: 'hacen' }, pasado: { yo: 'hice', tú: 'hiciste', él: 'hizo', nosotros: 'hicimos', ellos: 'hicieron' } },
        { infinitive: 'ir', pt: 'ir', presente: { yo: 'voy', tú: 'vas', él: 'va', nosotros: 'vamos', vosotros: 'vais', ellos: 'van' }, pasado: { yo: 'fui', tú: 'fuiste', él: 'fue', nosotros: 'fuimos', ellos: 'fueron' } },
        { infinitive: 'poder', pt: 'poder', presente: { yo: 'puedo', tú: 'puedes', él: 'puede', nosotros: 'podemos', vosotros: 'podéis', ellos: 'pueden' }, pasado: { yo: 'pude', tú: 'pudiste', él: 'pudo', nosotros: 'pudimos', ellos: 'pudieron' } },
        { infinitive: 'querer', pt: 'querer', presente: { yo: 'quiero', tú: 'quieres', él: 'quiere', nosotros: 'queremos', vosotros: 'queréis', ellos: 'quieren' }, pasado: { yo: 'quise', tú: 'quisiste', él: 'quiso', nosotros: 'quisimos', ellos: 'quisieron' } },
        { infinitive: 'saber', pt: 'saber', presente: { yo: 'sé', tú: 'sabes', él: 'sabe', nosotros: 'sabemos', vosotros: 'sabéis', ellos: 'saben' }, pasado: { yo: 'supe', tú: 'supiste', él: 'supo', nosotros: 'supimos', ellos: 'supieron' } },
        { infinitive: 'decir', pt: 'dizer', presente: { yo: 'digo', tú: 'dices', él: 'dice', nosotros: 'decimos', vosotros: 'decís', ellos: 'dicen' }, pasado: { yo: 'dije', tú: 'dijiste', él: 'dijo', nosotros: 'dijimos', ellos: 'dijeron' } },
        { infinitive: 'venir', pt: 'vir', presente: { yo: 'vengo', tú: 'vienes', él: 'viene', nosotros: 'venimos', vosotros: 'venís', ellos: 'vienen' }, pasado: { yo: 'vine', tú: 'viniste', él: 'vino', nosotros: 'vinimos', ellos: 'vinieron' } },
        { infinitive: 'ver', pt: 'ver', presente: { yo: 'veo', tú: 'ves', él: 've', nosotros: 'vemos', vosotros: 'veis', ellos: 'ven' }, pasado: { yo: 'vi', tú: 'viste', él: 'vio', nosotros: 'vimos', ellos: 'vieron' } },
        { infinitive: 'dar', pt: 'dar', presente: { yo: 'doy', tú: 'das', él: 'da', nosotros: 'damos', vosotros: 'dais', ellos: 'dan' }, pasado: { yo: 'di', tú: 'diste', él: 'dio', nosotros: 'dimos', ellos: 'dieron' } },
        { infinitive: 'poner', pt: 'colocar', presente: { yo: 'pongo', tú: 'pones', él: 'pone', nosotros: 'ponemos', vosotros: 'ponéis', ellos: 'ponen' }, pasado: { yo: 'puse', tú: 'pusiste', él: 'puso', nosotros: 'pusimos', ellos: 'pusieron' } },
        { infinitive: 'salir', pt: 'sair', presente: { yo: 'salgo', tú: 'sales', él: 'sale', nosotros: 'salimos', vosotros: 'salís', ellos: 'salen' }, pasado: { yo: 'salí', tú: 'saliste', él: 'salió', nosotros: 'salimos', ellos: 'salieron' } },
        { infinitive: 'conocer', pt: 'conhecer', presente: { yo: 'conozco', tú: 'conoces', él: 'conoce', nosotros: 'conocemos', vosotros: 'conocéis', ellos: 'conocen' }, pasado: { yo: 'conocí', tú: 'conociste', él: 'conoció', nosotros: 'conocimos', ellos: 'conocieron' } },
        { infinitive: 'pensar', pt: 'pensar', presente: { yo: 'pienso', tú: 'piensas', él: 'piensa', nosotros: 'pensamos', vosotros: 'pensáis', ellos: 'piensan' }, pasado: { yo: 'pensé', tú: 'pensaste', él: 'pensó', nosotros: 'pensamos', ellos: 'pensaron' } },
        { infinitive: 'dormir', pt: 'dormir', presente: { yo: 'duermo', tú: 'duermes', él: 'duerme', nosotros: 'dormimos', vosotros: 'dormís', ellos: 'duermen' }, pasado: { yo: 'dormí', tú: 'dormiste', él: 'durmió', nosotros: 'dormimos', ellos: 'durmieron' } },
        { infinitive: 'pedir', pt: 'pedir', presente: { yo: 'pido', tú: 'pides', él: 'pide', nosotros: 'pedimos', vosotros: 'pedís', ellos: 'piden' }, pasado: { yo: 'pedí', tú: 'pediste', él: 'pidió', nosotros: 'pedimos', ellos: 'pidieron' } },
        { infinitive: 'sentir', pt: 'sentir', presente: { yo: 'siento', tú: 'sientes', él: 'siente', nosotros: 'sentimos', vosotros: 'sentís', ellos: 'sienten' }, pasado: { yo: 'sentí', tú: 'sentiste', él: 'sintió', nosotros: 'sentimos', ellos: 'sintieron' } },
        { infinitive: 'traer', pt: 'trazer', presente: { yo: 'traigo', tú: 'traes', él: 'trae', nosotros: 'traemos', vosotros: 'traéis', ellos: 'traen' }, pasado: { yo: 'traje', tú: 'trajiste', él: 'trajo', nosotros: 'trajimos', ellos: 'trajeron' } },
        { infinitive: 'oír', pt: 'ouvir', presente: { yo: 'oigo', tú: 'oyes', él: 'oye', nosotros: 'oímos', vosotros: 'oís', ellos: 'oyen' }, pasado: { yo: 'oí', tú: 'oíste', él: 'oyó', nosotros: 'oímos', ellos: 'oyeron' } },
        { infinitive: 'seguir', pt: 'seguir', presente: { yo: 'sigo', tú: 'sigues', él: 'sigue', nosotros: 'seguimos', vosotros: 'seguís', ellos: 'siguen' }, pasado: { yo: 'seguí', tú: 'seguiste', él: 'siguió', nosotros: 'seguimos', ellos: 'siguieron' } },
        { infinitive: 'encontrar', pt: 'encontrar', presente: { yo: 'encuentro', tú: 'encuentras', él: 'encuentra', nosotros: 'encontramos', vosotros: 'encontráis', ellos: 'encuentran' }, pasado: { yo: 'encontré', tú: 'encontraste', él: 'encontró', nosotros: 'encontramos', ellos: 'encontraron' } },
        { infinitive: 'empezar', pt: 'começar', presente: { yo: 'empiezo', tú: 'empiezas', él: 'empieza', nosotros: 'empezamos', vosotros: 'empezáis', ellos: 'empiezan' }, pasado: { yo: 'empecé', tú: 'empezaste', él: 'empezó', nosotros: 'empezamos', ellos: 'empezaron' } },
        { infinitive: 'cerrar', pt: 'fechar', presente: { yo: 'cierro', tú: 'cierras', él: 'cierra', nosotros: 'cerramos', vosotros: 'cerráis', ellos: 'cierran' }, pasado: { yo: 'cerré', tú: 'cerraste', él: 'cerró', nosotros: 'cerramos', ellos: 'cerraron' } },
        { infinitive: 'perder', pt: 'perder', presente: { yo: 'pierdo', tú: 'pierdes', él: 'pierde', nosotros: 'perdemos', vosotros: 'perdéis', ellos: 'pierden' }, pasado: { yo: 'perdí', tú: 'perdiste', él: 'perdió', nosotros: 'perdimos', ellos: 'perdieron' } },
        { infinitive: 'jugar', pt: 'jogar', presente: { yo: 'juego', tú: 'juegas', él: 'juega', nosotros: 'jugamos', vosotros: 'jugáis', ellos: 'juegan' }, pasado: { yo: 'jugué', tú: 'jugaste', él: 'jugó', nosotros: 'jugamos', ellos: 'jugaron' } },
        { infinitive: 'construir', pt: 'construir', presente: { yo: 'construyo', tú: 'construyes', él: 'construye', nosotros: 'construimos', vosotros: 'construís', ellos: 'construyen' }, pasado: { yo: 'construí', tú: 'construiste', él: 'construyó', nosotros: 'construimos', ellos: 'construyeron' } },
        { infinitive: 'morir', pt: 'morrer', presente: { yo: 'muero', tú: 'mueres', él: 'muere', nosotros: 'morimos', vosotros: 'morís', ellos: 'mueren' }, pasado: { yo: 'morí', tú: 'moriste', él: 'murió', nosotros: 'morimos', ellos: 'murieron' } },
    ],
};

// Función para obtener todos los verbos
export const getAllVerbs = () => {
    return [
        ...VERBS.regulares_ar,
        ...VERBS.regulares_er,
        ...VERBS.regulares_ir,
        ...VERBS.irregulares,
    ];
};

// Función para obtener verbos por nivel
export const getVerbsByLevel = (level) => {
    if (level <= 2) return [...VERBS.regulares_ar.slice(0, 10), ...VERBS.irregulares.slice(0, 5)];
    if (level <= 4) return [...VERBS.regulares_ar, ...VERBS.regulares_er, ...VERBS.irregulares.slice(0, 15)];
    return getAllVerbs();
};
