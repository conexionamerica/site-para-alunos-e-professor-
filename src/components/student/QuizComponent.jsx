import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CheckCircle2, XCircle, ArrowRight, RotateCcw, Sparkles, Trophy, Heart, Gift, Crown, Target, Zap, ShoppingCart, Volume2, Mic, MicOff, GraduationCap, Lock, Clock, CreditCard } from 'lucide-react';
import { LEVELS, LEAGUES, generateExercisesForLevel } from '@/lib/quizData';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const COOLDOWN_HOURS = 4;
const COOLDOWN_MS = COOLDOWN_HOURS * 60 * 60 * 1000;

// Links de pagamento reais MercadoPago
const PAYMENT_LINKS = {
    1: 'https://www.mercadopago.com.br/checkout/v1/payment/redirect/f3c6eaa5-b6df-49fa-9b56-57d35a5e4d10/payment-option-form/?source=link&preference-id=46454273-62ba8de1-a362-4b9a-9d2c-f6bd3cd45e3b&router-request-id=066b9b6b-b805-4661-842c-b61059937551&journey-id=51906597e61455698bf6fd1a7c61ec72&p=9966f0b5bace859e38fb16499917d57f',
    3: 'https://www.mercadopago.com.br/checkout/v1/payment/redirect/b1d0ad8a-97ec-4c76-8038-ecbbdb3fb033/payment-option-form/?source=link&preference-id=46454273-12632856-ac9e-41d7-9604-8e8f89a02cda&router-request-id=d0ec8cc4-d947-481d-bf99-a1b842b5977c&journey-id=246a4deb23a21d7de63c16769fbcbd81&p=9966f0b5bace859e38fb16499917d57f',
    5: 'https://www.mercadopago.com.br/checkout/v1/payment/redirect/7f1e1720-6e84-45bc-8023-cb921cffaf59/payment-option-form/?source=link&preference-id=46454273-697b4b3d-0e97-4de0-8a3e-004e0b106467&router-request-id=55ae5c3c-ce25-4846-a10f-d6c139a32bcb&journey-id=a5be44cb50d1405c1c14885eecdc40a9&p=9966f0b5bace859e38fb16499917d57f',
};

// Helper function to create user-specific localStorage keys
const getStorageKey = (userId, key) => `quiz_${userId}_${key}`;

const QuizComponent = () => {
    // Get the current user from auth context
    const { user } = useAuth();
    const userId = user?.id || 'anonymous';
    // Estados principais - inicializados con valores por defecto
    // Los datos del usuario se cargan en useEffect cuando el userId está disponible
    const [exercises, setExercises] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState(null);
    const [isAnswered, setIsAnswered] = useState(false);
    const [score, setScore] = useState({ correct: 0, incorrect: 0, xp: 0 });
    const [lives, setLives] = useState(3);
    const [extraLives, setExtraLives] = useState(0);
    const [streak, setStreak] = useState(0);
    const [totalXp, setTotalXp] = useState(0);
    const [currentLevel, setCurrentLevel] = useState('basico1');
    const [showResult, setShowResult] = useState(false);
    const [perfectLevels, setPerfectLevels] = useState(0);
    const [showBuyLives, setShowBuyLives] = useState(false);
    const [showReward, setShowReward] = useState(false);
    const [dailyGoal, setDailyGoal] = useState({ current: 30, target: 50 });
    const [dataLoaded, setDataLoaded] = useState(false);

    // Sistema de bloqueio
    const [isBlocked, setIsBlocked] = useState(false);
    const [blockEndTime, setBlockEndTime] = useState(null);
    const [timeRemaining, setTimeRemaining] = useState('');
    const [showConfirmPayment, setShowConfirmPayment] = useState(false);
    const [pendingPaymentQty, setPendingPaymentQty] = useState(0);

    // Estados para audio/voz
    const [userInput, setUserInput] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [speechResult, setSpeechResult] = useState(null);
    const recognitionRef = useRef(null);

    // Cargar datos del usuario desde localStorage cuando userId esté disponible
    useEffect(() => {
        if (!userId || userId === 'anonymous') return;

        // Cargar lives
        const savedLives = localStorage.getItem(getStorageKey(userId, 'lives'));
        if (savedLives) setLives(parseInt(savedLives));

        // Cargar extraLives
        const savedExtraLives = localStorage.getItem(getStorageKey(userId, 'extraLives'));
        if (savedExtraLives) setExtraLives(parseInt(savedExtraLives));

        // Cargar totalXp
        const savedXp = localStorage.getItem(getStorageKey(userId, 'totalXp'));
        if (savedXp) setTotalXp(parseInt(savedXp));

        // Cargar level
        const savedLevel = localStorage.getItem(getStorageKey(userId, 'level'));
        if (savedLevel) setCurrentLevel(savedLevel);

        // Cargar perfectLevels
        const savedPerfect = localStorage.getItem(getStorageKey(userId, 'perfectLevels'));
        if (savedPerfect) setPerfectLevels(parseInt(savedPerfect));

        // Cargar blockEndTime
        const savedBlock = localStorage.getItem(getStorageKey(userId, 'blockEndTime'));
        if (savedBlock) setBlockEndTime(parseInt(savedBlock));

        setDataLoaded(true);
    }, [userId]);

    // Liga e nível atual
    const currentLeague = LEAGUES.reduce((acc, league) => totalXp >= league.minXp ? league : acc, LEAGUES[0]);
    const levelInfo = LEVELS.find(l => l.id === parseInt(currentLevel.replace(/\D/g, '')) || 1) || LEVELS[0];

    // Salvar vidas no localStorage (solo si userId está disponible)
    useEffect(() => {
        if (!userId || userId === 'anonymous' || !dataLoaded) return;
        localStorage.setItem(getStorageKey(userId, 'lives'), lives.toString());
        localStorage.setItem(getStorageKey(userId, 'extraLives'), extraLives.toString());
    }, [lives, extraLives, userId, dataLoaded]);

    // Verificar si hay pago pendiente al cargar
    useEffect(() => {
        if (!userId || userId === 'anonymous') return;
        const pending = localStorage.getItem(getStorageKey(userId, 'pendingPayment'));
        if (pending) {
            try {
                const { qty, timestamp } = JSON.parse(pending);
                // Solo mostrar si el pago fue hace menos de 30 minutos
                if (Date.now() - timestamp < 30 * 60 * 1000) {
                    setPendingPaymentQty(qty);
                    setShowConfirmPayment(true);
                } else {
                    // Pago expirado
                    localStorage.removeItem(getStorageKey(userId, 'pendingPayment'));
                }
            } catch (e) {
                localStorage.removeItem(getStorageKey(userId, 'pendingPayment'));
            }
        }
    }, [userId]);

    // Verificar bloqueio ao carregar
    useEffect(() => {
        const checkBlock = () => {
            if (blockEndTime && Date.now() < blockEndTime) {
                setIsBlocked(true);
                const remaining = blockEndTime - Date.now();
                const hours = Math.floor(remaining / (1000 * 60 * 60));
                const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
                setTimeRemaining(`${hours}h ${minutes}m ${seconds}s`);
            } else if (blockEndTime && Date.now() >= blockEndTime) {
                // Tempo de espera acabou - restaurar vidas
                setIsBlocked(false);
                setBlockEndTime(null);
                if (userId && userId !== 'anonymous') {
                    localStorage.removeItem(getStorageKey(userId, 'blockEndTime'));
                }
                setLives(3);
                setExtraLives(0);
            }
        };

        checkBlock();
        const interval = setInterval(checkBlock, 1000);
        return () => clearInterval(interval);
    }, [blockEndTime, userId]);

    // Salvar progresso (solo si userId está disponible)
    useEffect(() => {
        if (!userId || userId === 'anonymous' || !dataLoaded) return;
        localStorage.setItem(getStorageKey(userId, 'totalXp'), totalXp.toString());
        localStorage.setItem(getStorageKey(userId, 'level'), currentLevel);
        localStorage.setItem(getStorageKey(userId, 'perfectLevels'), perfectLevels.toString());
    }, [totalXp, currentLevel, perfectLevels, userId, dataLoaded]);

    // Inicializar exercícios
    useEffect(() => {
        if (!isBlocked) {
            setExercises(generateExercisesForLevel(currentLevel, 10));
        }

        // Inicializar reconhecimento de voz
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
            recognitionRef.current = new SR();
            recognitionRef.current.lang = 'es-ES';
            recognitionRef.current.continuous = false;
        }
    }, [currentLevel, isBlocked]);

    const currentExercise = exercises[currentIndex];
    const progress = ((currentIndex) / exercises.length) * 100;
    const totalLives = lives + extraLives;

    // Funções de áudio
    const playAudio = (text) => {
        if ('speechSynthesis' in window) {
            setIsPlaying(true);
            const utt = new SpeechSynthesisUtterance(text);
            utt.lang = 'es-ES';
            utt.rate = 0.8;
            utt.onend = () => setIsPlaying(false);
            window.speechSynthesis.speak(utt);
        }
    };

    const startListening = () => {
        if (!recognitionRef.current) return;
        setIsListening(true);
        setSpeechResult(null);
        recognitionRef.current.start();

        recognitionRef.current.onresult = (e) => {
            const transcript = e.results[0][0].transcript.toLowerCase();
            const target = currentExercise.textToSpeak.toLowerCase().replace(/[¿?¡!]/g, '');
            const similarity = calcSimilarity(transcript, target);
            setSpeechResult({ transcript, similarity, isCorrect: similarity > 0.7 });
            setIsListening(false);
            setIsAnswered(true);

            if (similarity > 0.7) {
                setScore(p => ({ ...p, correct: p.correct + 1, xp: p.xp + 15 }));
                setStreak(p => p + 1);
            } else {
                setScore(p => ({ ...p, incorrect: p.incorrect + 1 }));
                loseLife();
            }
        };
        recognitionRef.current.onerror = () => setIsListening(false);
    };

    const calcSimilarity = (s1, s2) => {
        const a = s1.toLowerCase().replace(/[^a-záéíóúñ\s]/g, '').split(' ');
        const b = s2.toLowerCase().replace(/[^a-záéíóúñ\s]/g, '').split(' ');
        let m = 0;
        a.forEach(w => { if (b.includes(w)) m++; });
        return m / Math.max(a.length, b.length);
    };

    const loseLife = () => {
        if (extraLives > 0) setExtraLives(p => p - 1);
        else setLives(p => p - 1);
        setStreak(0);
    };

    const checkListeningAnswer = () => {
        const target = currentExercise.answer;
        const input = userInput.toLowerCase().replace(/[¿?¡!]/g, '').trim();
        const isCorrect = calcSimilarity(input, target) > 0.8;
        setIsAnswered(true);

        if (isCorrect) {
            setScore(p => ({ ...p, correct: p.correct + 1, xp: p.xp + 15 }));
            setStreak(p => p + 1);
        } else {
            setScore(p => ({ ...p, incorrect: p.incorrect + 1 }));
            loseLife();
        }
    };

    const handleSelectAnswer = (idx) => {
        if (isAnswered) return;
        setSelectedAnswer(idx);
        setIsAnswered(true);

        if (idx === currentExercise.correct) {
            const xp = 10 + (streak >= 3 ? 5 : 0) + (currentExercise.difficulty * 2);
            setScore(p => ({ ...p, correct: p.correct + 1, xp: p.xp + xp }));
            setStreak(p => p + 1);
            setDailyGoal(p => ({ ...p, current: Math.min(p.current + xp, p.target) }));
        } else {
            setScore(p => ({ ...p, incorrect: p.incorrect + 1 }));
            loseLife();
        }
    };

    const handleNext = () => {
        if (currentIndex < exercises.length - 1) {
            setCurrentIndex(p => p + 1);
            setSelectedAnswer(null);
            setIsAnswered(false);
            setUserInput('');
            setSpeechResult(null);
        } else {
            setTotalXp(p => p + score.xp);
            if (score.incorrect === 0) {
                setPerfectLevels(p => {
                    const n = p + 1;
                    if (n >= 5) setShowReward(true);
                    return n;
                });
            } else setPerfectLevels(0);
            setShowResult(true);
        }
    };

    const handleWait = () => {
        const endTime = Date.now() + COOLDOWN_MS;
        setBlockEndTime(endTime);
        if (userId && userId !== 'anonymous') {
            localStorage.setItem(getStorageKey(userId, 'blockEndTime'), endTime.toString());
        }
        setIsBlocked(true);
    };

    const handleBuyLife = (qty) => {
        // Guardar pago pendiente en localStorage
        if (userId && userId !== 'anonymous') {
            localStorage.setItem(getStorageKey(userId, 'pendingPayment'), JSON.stringify({
                qty,
                timestamp: Date.now()
            }));
        }

        // Abrir link de pago de MercadoPago
        const link = PAYMENT_LINKS[qty];
        window.location.href = link; // Redirigir en la misma ventana para que vuelva
    };

    // Confirmar pago después de volver de MercadoPago
    const handleConfirmPayment = () => {
        if (!userId || userId === 'anonymous') return;
        const pending = localStorage.getItem(getStorageKey(userId, 'pendingPayment'));
        if (pending) {
            const { qty } = JSON.parse(pending);
            setExtraLives(p => p + qty);
            setIsBlocked(false);
            setBlockEndTime(null);
            localStorage.removeItem(getStorageKey(userId, 'blockEndTime'));
            localStorage.removeItem(getStorageKey(userId, 'pendingPayment'));
            setShowConfirmPayment(false);
            setLives(prev => prev === 0 ? 3 : prev); // Restaurar si estaba en 0
        }
    };

    // Cancelar confirmación de pago
    const handleCancelPayment = () => {
        if (userId && userId !== 'anonymous') {
            localStorage.removeItem(getStorageKey(userId, 'pendingPayment'));
        }
        setShowConfirmPayment(false);
    };

    const handleRestart = () => {
        // Solo reiniciar si hay vidas disponibles
        if (lives + extraLives <= 0) return;

        setExercises(generateExercisesForLevel(currentLevel, 10));
        setCurrentIndex(0);
        setSelectedAnswer(null);
        setIsAnswered(false);
        setScore({ correct: 0, incorrect: 0, xp: 0 });
        // NO restaurar vidas - mantener las que tiene
        setStreak(0);
        setShowResult(false);
        setUserInput('');
        setSpeechResult(null);
    };

    // Modal de compra
    const BuyLivesModal = () => (
        <Dialog open={showBuyLives} onOpenChange={setShowBuyLives}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-center text-2xl font-black flex items-center justify-center gap-2">
                        <Heart className="h-6 w-6 text-red-500 fill-red-500" /> Comprar Vidas
                    </DialogTitle>
                    <DialogDescription className="text-center">Pagamento seguro via Pix ou Cartão - MercadoPago</DialogDescription>
                </DialogHeader>
                <div className="space-y-3 py-4">
                    {[{ qty: 1, price: 0.69 }, { qty: 3, price: 1.99, popular: true }, { qty: 5, price: 2.99 }].map((o) => (
                        <motion.button key={o.qty} whileHover={{ scale: 1.02 }} onClick={() => handleBuyLife(o.qty)}
                            className={`w-full p-4 rounded-xl border-2 flex items-center justify-between ${o.popular ? 'border-violet-500 bg-violet-50' : 'border-slate-200'}`}>
                            <div className="flex items-center gap-3">
                                {[...Array(o.qty)].map((_, i) => <Heart key={i} className="h-5 w-5 text-red-500 fill-red-500 -ml-1 first:ml-0" />)}
                                <span className="font-bold">{o.qty} {o.qty === 1 ? 'Vida' : 'Vidas'}</span>
                                {o.popular && <Badge className="bg-violet-500 text-white">Popular</Badge>}
                            </div>
                            <div className="flex items-center gap-2">
                                <CreditCard className="h-4 w-4 text-slate-400" />
                                <span className="bg-emerald-500 text-white px-3 py-1.5 rounded-lg font-bold">R$ {o.price.toFixed(2)}</span>
                            </div>
                        </motion.button>
                    ))}
                </div>
                <p className="text-xs text-center text-slate-500">Você será redirecionado para o MercadoPago</p>
            </DialogContent>
        </Dialog>
    );

    // Modal de confirmação de pagamento
    const ConfirmPaymentModal = () => (
        <Dialog open={showConfirmPayment} onOpenChange={setShowConfirmPayment}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-center text-2xl font-black flex items-center justify-center gap-2">
                        <CheckCircle2 className="h-6 w-6 text-emerald-500" /> Confirmar Pagamento
                    </DialogTitle>
                    <DialogDescription className="text-center">
                        Você realizou o pagamento de {pendingPaymentQty} {pendingPaymentQty === 1 ? 'vida' : 'vidas'}?
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 text-center">
                    <div className="flex justify-center mb-4">
                        {[...Array(pendingPaymentQty)].map((_, i) => (
                            <Heart key={i} className="h-10 w-10 text-red-500 fill-red-500 -ml-2 first:ml-0" />
                        ))}
                    </div>
                    <p className="text-slate-600 mb-6">
                        Se você completou o pagamento no MercadoPago, clique em "Sim, paguei!" para adicionar suas vidas.
                    </p>
                    <div className="space-y-3">
                        <Button onClick={handleConfirmPayment} className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 py-6">
                            <CheckCircle2 className="h-5 w-5 mr-2" /> Sim, paguei!
                        </Button>
                        <Button variant="outline" onClick={handleCancelPayment} className="w-full">
                            Não, ainda não paguei
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );

    // Modal de recompensa
    const RewardModal = () => (
        <Dialog open={showReward} onOpenChange={setShowReward}>
            <DialogContent className="sm:max-w-md text-center">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-7xl mx-auto">🎉</motion.div>
                <DialogHeader>
                    <DialogTitle className="text-2xl font-black text-center">5 Níveis Perfeitos!</DialogTitle>
                    <DialogDescription className="text-center text-lg">Você ganhou uma aula grátis!</DialogDescription>
                </DialogHeader>
                <div className="bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl p-6 text-white my-4">
                    <Gift className="h-12 w-12 mx-auto mb-3" />
                    <p className="text-3xl font-black">1 Aula Grátis</p>
                    <p className="text-amber-100 text-sm">30 min com professor nativo</p>
                </div>
                <Button onClick={() => { setShowReward(false); setPerfectLevels(0); }} className="w-full bg-gradient-to-r from-violet-500 to-purple-600">
                    Receber Recompensa!
                </Button>
            </DialogContent>
        </Dialog>
    );

    // Tela de carregando dados do usuário
    if (!dataLoaded && userId && userId !== 'anonymous') {
        return (
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-8 text-center">
                <div className="animate-pulse">
                    <div className="text-4xl mb-4">🎯</div>
                    <p className="text-slate-600">Carregando seu progresso...</p>
                </div>
            </div>
        );
    }

    // Tela de bloqueio
    if (isBlocked) {
        return (
            <>
                <BuyLivesModal />
                <ConfirmPaymentModal />
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-8 text-center">
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-6xl mb-4">
                        <Lock className="h-16 w-16 mx-auto text-slate-400" />
                    </motion.div>
                    <h2 className="text-2xl font-black mb-2">Quiz Bloqueado</h2>
                    <p className="text-slate-500 mb-4">Você escolheu esperar para recarregar suas vidas</p>

                    <div className="bg-slate-100 rounded-xl p-6 mb-6">
                        <Clock className="h-8 w-8 mx-auto text-violet-500 mb-2" />
                        <p className="text-3xl font-black text-violet-600">{timeRemaining}</p>
                        <p className="text-sm text-slate-500">para suas vidas recarregarem</p>
                    </div>

                    <p className="text-slate-600 mb-4">Ou compre vidas para continuar agora:</p>

                    <Button onClick={() => setShowBuyLives(true)} className="w-full bg-gradient-to-r from-red-500 to-pink-600 py-6">
                        <Heart className="h-5 w-5 mr-2 fill-white" /> Comprar Vidas - A partir de R$ 0,69
                    </Button>
                </div>
            </>
        );
    }

    // Tela de sem vidas
    if (totalLives <= 0 && !isBlocked) {
        return (
            <>
                <BuyLivesModal />
                <ConfirmPaymentModal />
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-8 text-center">
                    <div className="text-6xl mb-4">💔</div>
                    <h2 className="text-2xl font-black mb-2">Acabaram as vidas!</h2>
                    <p className="text-slate-500 mb-6">Escolha uma opção para continuar</p>

                    <div className="flex justify-center gap-4 mb-6">
                        <div className="text-center"><p className="text-3xl font-black text-emerald-600">{score.correct}</p><p className="text-sm">Acertos</p></div>
                        <div className="text-center"><p className="text-3xl font-black text-amber-600">{score.xp}</p><p className="text-sm">XP</p></div>
                    </div>

                    <div className="space-y-3">
                        <Button onClick={() => setShowBuyLives(true)} className="w-full bg-gradient-to-r from-red-500 to-pink-600 py-6">
                            <Heart className="h-5 w-5 mr-2 fill-white" /> Comprar Vidas - A partir de R$ 0,69
                        </Button>
                        <Button variant="outline" onClick={handleWait} className="w-full py-6">
                            <Clock className="h-5 w-5 mr-2" /> Esperar 4 horas (Vidas grátis)
                        </Button>
                    </div>
                </div>
            </>
        );
    }

    // Tela de resultado
    if (showResult) {
        const pct = Math.round((score.correct / exercises.length) * 100);
        return (
            <>
                <RewardModal />
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-8 text-center">
                    <div className="text-7xl mb-4">{pct >= 80 ? '🏆' : pct >= 60 ? '⭐' : '📚'}</div>
                    <h2 className="text-2xl font-black mb-2">{pct >= 80 ? 'Excelente!' : pct >= 60 ? 'Muito bem!' : 'Continue praticando!'}</h2>

                    {score.incorrect === 0 && (
                        <div className="bg-amber-100 rounded-xl p-4 mb-4 border border-amber-200">
                            <div className="flex items-center justify-center gap-2 mb-2"><Crown className="h-5 w-5 text-amber-600" /><span className="font-bold text-amber-800">Nível Perfeito!</span></div>
                            <div className="flex justify-center gap-1">{[...Array(5)].map((_, i) => <div key={i} className={`w-10 h-2 rounded-full ${i < perfectLevels ? 'bg-amber-500' : 'bg-amber-200'}`} />)}</div>
                            <p className="text-xs text-amber-600 mt-2">{perfectLevels}/5 para aula grátis</p>
                        </div>
                    )}

                    <div className="grid grid-cols-3 gap-4 mb-6">
                        <div className="bg-emerald-50 rounded-xl p-4"><p className="text-3xl font-black text-emerald-600">{score.correct}</p><p className="text-sm">Acertos</p></div>
                        <div className="bg-red-50 rounded-xl p-4"><p className="text-3xl font-black text-red-500">{score.incorrect}</p><p className="text-sm">Erros</p></div>
                        <div className="bg-amber-50 rounded-xl p-4"><p className="text-3xl font-black text-amber-600">+{score.xp}</p><p className="text-sm">XP</p></div>
                    </div>

                    <div className={`bg-gradient-to-r ${currentLeague.color} rounded-xl p-4 text-white mb-4`}>
                        <span className="text-3xl mr-2">{currentLeague.icon}</span><span className="font-bold">Liga {currentLeague.name} • {totalXp} XP Total</span>
                    </div>

                    <Button onClick={handleRestart} className="w-full bg-gradient-to-r from-violet-500 to-purple-600"><RotateCcw className="h-4 w-4 mr-2" /> Nova Lição</Button>
                </div>
            </>
        );
    }

    if (!currentExercise) return <div className="text-center p-8">Carregando...</div>;

    // Renderizar exercício
    const renderExercise = () => {
        if (currentExercise.type === 'listening') {
            return (
                <div className="space-y-4">
                    <div className="flex justify-center">
                        <Button onClick={() => playAudio(currentExercise.audioText)} disabled={isPlaying}
                            className={`rounded-full h-24 w-24 ${isPlaying ? 'bg-violet-400' : 'bg-gradient-to-br from-violet-500 to-purple-600'}`}>
                            <Volume2 className={`h-12 w-12 ${isPlaying ? 'animate-pulse' : ''}`} />
                        </Button>
                    </div>
                    <p className="text-center text-slate-500">Clique para ouvir e escreva</p>
                    <input type="text" value={userInput} onChange={(e) => setUserInput(e.target.value)} disabled={isAnswered}
                        placeholder="Digite aqui..." className="w-full px-4 py-3 rounded-xl border-2 text-center text-lg" />
                    {!isAnswered && <Button onClick={checkListeningAnswer} disabled={!userInput} className="w-full bg-gradient-to-r from-violet-500 to-purple-600">Verificar</Button>}
                    {isAnswered && (
                        <div className={`p-4 rounded-xl ${calcSimilarity(userInput.toLowerCase(), currentExercise.answer) > 0.8 ? 'bg-emerald-100' : 'bg-red-100'}`}>
                            <p className="font-bold">{calcSimilarity(userInput.toLowerCase(), currentExercise.answer) > 0.8 ? '✓ Certo!' : '✗ Errado'}</p>
                            <p className="text-sm">Resposta: <strong>{currentExercise.audioText}</strong></p>
                        </div>
                    )}
                </div>
            );
        }

        if (currentExercise.type === 'speaking') {
            return (
                <div className="space-y-4">
                    <div className="bg-violet-50 rounded-xl p-6 text-center border border-violet-200">
                        <p className="text-2xl font-bold text-slate-800 mb-2">"{currentExercise.textToSpeak}"</p>
                        <Button variant="ghost" onClick={() => playAudio(currentExercise.textToSpeak)} className="text-violet-600">
                            <Volume2 className="h-5 w-5 mr-2" /> Ouvir pronúncia
                        </Button>
                    </div>
                    <div className="flex justify-center">
                        <Button onClick={startListening} disabled={isListening || isAnswered}
                            className={`rounded-full h-24 w-24 ${isListening ? 'bg-red-500 animate-pulse' : 'bg-gradient-to-br from-rose-500 to-red-600'}`}>
                            {isListening ? <MicOff className="h-12 w-12" /> : <Mic className="h-12 w-12" />}
                        </Button>
                    </div>
                    <p className="text-center text-slate-500">{isListening ? 'Ouvindo... Fale!' : 'Clique e fale'}</p>
                    {speechResult && (
                        <div className={`p-4 rounded-xl ${speechResult.isCorrect ? 'bg-emerald-100' : 'bg-red-100'}`}>
                            <p className="font-bold">{speechResult.isCorrect ? '✓ Ótima pronúncia!' : '✗ Tente novamente'}</p>
                            <p className="text-sm">Você disse: "{speechResult.transcript}" • Precisão: {Math.round(speechResult.similarity * 100)}%</p>
                        </div>
                    )}
                </div>
            );
        }

        return (
            <div className="grid gap-3">
                {currentExercise.options.map((opt, idx) => {
                    let cls = "w-full text-left p-4 rounded-xl border-2 transition-all flex items-center gap-3";
                    if (isAnswered) {
                        if (idx === currentExercise.correct) cls += " border-emerald-500 bg-emerald-50";
                        else if (idx === selectedAnswer) cls += " border-red-500 bg-red-50";
                        else cls += " border-slate-200 opacity-50";
                    } else cls += " border-slate-200 hover:border-violet-400 cursor-pointer";
                    return (
                        <motion.button key={idx} whileHover={!isAnswered ? { scale: 1.01 } : {}} onClick={() => handleSelectAnswer(idx)} className={cls} disabled={isAnswered}>
                            <span className={`w-10 h-10 rounded-full font-bold flex items-center justify-center ${isAnswered && idx === currentExercise.correct ? 'bg-emerald-500 text-white' : isAnswered && idx === selectedAnswer ? 'bg-red-500 text-white' : 'bg-violet-100 text-violet-600'}`}>
                                {isAnswered && idx === currentExercise.correct ? <CheckCircle2 className="h-5 w-5" /> : isAnswered && idx === selectedAnswer ? <XCircle className="h-5 w-5" /> : String.fromCharCode(65 + idx)}
                            </span>
                            <span className="font-medium">{opt}</span>
                        </motion.button>
                    );
                })}
            </div>
        );
    };

    return (
        <>
            <BuyLivesModal />
            <ConfirmPaymentModal />
            <div className="space-y-4">
                {/* Prêmio */}
                <div className="bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 rounded-2xl p-4 text-white shadow-lg">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <GraduationCap className="h-6 w-6" />
                            <div><p className="font-bold text-sm">🎁 PRÊMIO: 1 Aula Grátis!</p><p className="text-xs text-amber-100">5 níveis perfeitos</p></div>
                        </div>
                        <div className="flex gap-1">{[...Array(5)].map((_, i) => <div key={i} className={`w-6 h-6 rounded-full flex items-center justify-center text-sm ${i < perfectLevels ? 'bg-white text-amber-500' : 'bg-white/30'}`}>{i < perfectLevels ? '✓' : i + 1}</div>)}</div>
                    </div>
                </div>

                {/* Nível atual */}
                <div className="bg-gradient-to-r from-violet-500 to-purple-600 rounded-xl p-3 text-white text-center">
                    <span className="text-2xl mr-2">{levelInfo?.icon || '🌱'}</span>
                    <span className="font-bold">{currentLevel.replace(/(\d+)/, ' $1').replace('basico', 'Básico').replace('intermediario', 'Intermediário')}</span>
                </div>

                {/* Stats */}
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border p-4">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-1">
                            {[...Array(3)].map((_, i) => <Heart key={i} className={`h-6 w-6 ${i < lives ? 'text-red-500 fill-red-500' : 'text-slate-200'}`} />)}
                            {extraLives > 0 && <Badge className="bg-red-100 text-red-600 ml-1">+{extraLives}</Badge>}
                            <Button variant="ghost" size="sm" onClick={() => setShowBuyLives(true)} className="ml-1 h-6 w-6 p-0"><ShoppingCart className="h-4 w-4" /></Button>
                        </div>
                        <div className="flex gap-2">
                            <Badge className="bg-gradient-to-r from-amber-400 to-orange-500 text-white border-0">🔥 {streak}</Badge>
                            <Badge className={`bg-gradient-to-r ${currentLeague.color} text-white border-0`}>{currentLeague.icon} {currentLeague.name}</Badge>
                        </div>
                        <div className="flex items-center gap-1"><Sparkles className="h-5 w-5 text-amber-500" /><span className="font-bold text-amber-600">+{score.xp}</span></div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-2 mb-3">
                        <div className="flex justify-between text-xs mb-1"><span><Target className="h-3 w-3 inline mr-1" />Meta Diária</span><span className="font-bold text-emerald-600">{dailyGoal.current}/{dailyGoal.target} XP</span></div>
                        <div className="bg-slate-200 rounded-full h-2"><div className="bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full h-2" style={{ width: `${(dailyGoal.current / dailyGoal.target) * 100}%` }} /></div>
                    </div>
                    <div className="bg-slate-200 rounded-full h-3"><motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} className="bg-gradient-to-r from-violet-500 to-purple-600 rounded-full h-3" /></div>
                    <p className="text-xs text-slate-500 mt-1 text-center">Exercício {currentIndex + 1} de {exercises.length}</p>
                </div>

                {/* Exercise */}
                <AnimatePresence mode="wait">
                    <motion.div key={currentIndex} initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}
                        className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border overflow-hidden">
                        <div className="bg-gradient-to-r from-violet-500 to-purple-600 px-6 py-3 flex items-center justify-between">
                            <span className="text-white font-medium">{currentExercise.category}</span>
                            <div className="flex gap-1">{[...Array(currentExercise.difficulty)].map((_, i) => <Zap key={i} className="h-4 w-4 text-yellow-300 fill-yellow-300" />)}</div>
                        </div>
                        <div className="p-6">
                            <h3 className="text-xl font-bold text-slate-800 mb-6">{currentExercise.question}</h3>
                            {renderExercise()}
                            {isAnswered && currentExercise.type !== 'listening' && currentExercise.type !== 'speaking' && (
                                <div className={`mt-6 p-4 rounded-xl ${selectedAnswer === currentExercise.correct ? 'bg-emerald-100' : 'bg-red-100'}`}>
                                    <p className="font-bold">{selectedAnswer === currentExercise.correct ? '✓ Certo! 🎉' : '✗ Errado'}</p>
                                    {selectedAnswer !== currentExercise.correct && <p className="text-sm">Resposta: <strong>{currentExercise.options[currentExercise.correct]}</strong></p>}
                                </div>
                            )}
                            {isAnswered && (
                                <Button onClick={handleNext} className="w-full mt-6 py-6 text-lg font-bold bg-gradient-to-r from-emerald-500 to-teal-600">
                                    {currentIndex < exercises.length - 1 ? <>Continuar <ArrowRight className="h-5 w-5 ml-2" /></> : <>Ver Resultados <Trophy className="h-5 w-5 ml-2" /></>}
                                </Button>
                            )}
                        </div>
                    </motion.div>
                </AnimatePresence>
            </div>
        </>
    );
};

export default QuizComponent;
