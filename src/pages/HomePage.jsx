import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { add, format, parseISO, getDay, parse, isFuture, formatDistanceToNowStrict } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getBrazilDate, getTodayBrazil } from '@/lib/dateUtils';

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
// Se incluyen los iconos necesarios para la nueva funcionalidad
import { FileText, Package, BookOpen, CalendarCheck, CalendarClock, CalendarPlus, Send, Loader2, Info, CheckCircle2, Clock3, Sparkles, RotateCcw, Bot, Download, ExternalLink, Volume2, Mic, Ticket, AlertCircle, Clock } from 'lucide-react';
import NotificationsWidget from '@/components/NotificationsWidget';
import StudentMessagesWidget from '@/components/StudentMessagesWidget';
import { PlanExpiringBanner } from '@/components/student/PlanExpiringBanner';
import { DaysRemainingWidget } from '@/components/student/DaysRemainingWidget';
import { StudentTicketsTab } from '@/components/student/StudentTicketsTab';
import { expandedVocabulary } from '@/data/expandedVocabulary';
import { getDailyPhrase } from '@/data/dailyPhrases';


// IMPORTACIONES NECESSÁRIAS, AHORA CON DialogDescription
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquare as MessageIcon, BarChart3, Star, MessageCircle, ChevronRight, User, TrendingUp, TrendingDown, Minus, Calendar as CalendarIcon } from 'lucide-react';


const daysOfWeekMap = { 0: 'Dom', 1: 'Seg', 2: 'Ter', 3: 'Qua', 4: 'Qui', 5: 'Sex', 6: 'Sáb' };

const ALL_TIMES = Array.from({ length: 68 }, (_, i) => {
  const totalMinutes = 7 * 60 + i * 15;
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
});


const NextClassWidget = ({ nextClass }) => {
  if (!nextClass) {
    return (
      <div className="bg-gradient-to-br from-slate-100 to-slate-200 rounded-xl p-5 shadow-sm border border-slate-200">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-slate-300/50 rounded-lg">
            <CalendarClock className="h-5 w-5 text-slate-500" />
          </div>
          <h3 className="text-base font-bold text-slate-600">Próxima Aula</h3>
        </div>
        <p className="text-slate-500 text-sm">Nenhuma aula agendada.</p>
      </div>
    );
  }

  const { class_datetime, student } = nextClass;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-gradient-to-br from-sky-500 via-sky-600 to-blue-700 rounded-xl p-5 shadow-lg shadow-sky-200 text-white min-w-[320px]"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
            <CalendarCheck className="h-5 w-5 text-white" />
          </div>
          <span className="text-sky-100 text-sm font-medium">Próxima Aula</span>
        </div>
        <Badge className="bg-white/20 text-white border-0 text-xs">
          {formatDistanceToNowStrict(new Date(class_datetime), { locale: ptBR, addSuffix: true })}
        </Badge>
      </div>

      <div className="mb-4">
        <p className="text-3xl font-black">
          {format(new Date(class_datetime), 'dd MMM', { locale: ptBR })} | {format(new Date(class_datetime), 'HH:mm')}
        </p>
        <p className="text-sky-100 text-sm mt-1">
          Nível {student?.spanish_level || 'Intermediário'}
        </p>
        <p className="text-white/90 text-xs mt-0.5">
          Professor: {nextClass.professor?.full_name || nextClass.professor?.name || 'Não atribuído'}
        </p>
      </div>

      <Button asChild className="w-full bg-white text-sky-700 hover:bg-sky-50 font-bold shadow-md">
        <a href={nextClass.professor?.meeting_link || "https://meet.google.com/tmi-xwmg-kua"} target="_blank" rel="noopener noreferrer">
          <ExternalLink className="h-4 w-4 mr-2" />
          Entrar na Aula
        </a>
      </Button>
    </motion.div>
  );
};

export const HelpWidget = () => (
  <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
    <a href="https://wa.me/555198541835" target="_blank" rel="noopener noreferrer">
      <Button size="icon" className="rounded-full h-14 w-14 bg-green-500 hover:bg-green-600 shadow-lg">
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-message-circle"><path d="M10.3 14.7l-1.8-1.8a.9.9 0 0 0-1.3 0l-.8.8a.9.9 0 0 0 0 1.3l2.5 2.5c.4.4 1 .4 1.4 0l5.8-5.8a.9.9 0 0 0 0-1.3l-.8-.8a.9.9 0 0 0-1.3 0l-4 4zM21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" fill="white"></path><path d="M21.9 12.8c0 2-1 3.8-2.6 5.1-1.4 1.1-3.1 1.7-4.9 1.7h-.1c-3.4 0-6.4-2.1-7.5-5.1-.3-1 .1-2 .8-2.8.7-.8 1.9-1.1 2.9-1.1h.1c.5 0 1 .1 1.4.3.4.1.8.4 1.1.7l.7.7c.3.3.4.7.4 1.1 0 .4-.1.8-.4 1.1l-1.3 1.3c-.3.3-.8-.4-1.1-.4.4 0 .8.1 1.1.4l.7.7c.3.3.7.4 1.1.4Z" fill="white" strokeWidth="0"></path></svg>
      </Button>
    </a>
  </motion.div>
)

// Widget de Vocabulario Diario - MEJORADO con vocabulario expandido
const DailyVocabularyWidget = () => {
  // Obtener palabra del día basada en el día del año para variedad
  const getDayOfYear = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const diff = now - start;
    const oneDay = 1000 * 60 * 60 * 24;
    return Math.floor(diff / oneDay);
  };

  // Usar el día del año para seleccionar una palabra consistente cada día
  const dayOfYear = getDayOfYear();
  const vocabulary = expandedVocabulary;
  const todayWord = vocabulary[dayOfYear % vocabulary.length];

  const [showTranslation, setShowTranslation] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 rounded-2xl p-5 text-white shadow-lg mb-6"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-lg">Palabra del Día</h3>
            <p className="text-orange-100 text-xs">Aprende algo nuevo cada día</p>
          </div>
        </div>
        <Badge className="bg-white/20 text-white border-0 text-xs">
          {todayWord.type}
        </Badge>
      </div>

      <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 mb-4">
        <p className="text-4xl font-black mb-1">{todayWord.word}</p>
        <p className="text-orange-100 text-sm font-mono">/{todayWord.pronunciation}/</p>
      </div>

      <div className="space-y-3">
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
          <p className="text-xs text-orange-200 mb-1">Ejemplo:</p>
          <p className="text-sm italic">"{todayWord.example}"</p>
        </div>

        <button
          onClick={() => setShowTranslation(!showTranslation)}
          className="w-full bg-white/20 hover:bg-white/30 transition-colors rounded-lg py-2 px-4 text-sm font-medium flex items-center justify-center gap-2"
        >
          {showTranslation ? (
            <>🇧🇷 {todayWord.translation}</>
          ) : (
            <>👁️ Ver tradução</>
          )}
        </button>
      </div>
    </motion.div>
  );
};
const HomePage = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [activeBillings, setActiveBillings] = useState([]);
  const [pastBillings, setPastBillings] = useState([]);
  const [classStats, setClassStats] = useState({ available: 0, scheduled: 0, completed: 0, missed: 0, pending: 0, rescheduledCount: 0 });
  const [appointments, setAppointments] = useState([]);
  const [nextClass, setNextClass] = useState(null);
  const [professorId, setProfessorId] = useState(null);
  const [assignedLogs, setAssignedLogs] = useState([]);
  const [isScrolled, setIsScrolled] = useState(false);

  const [schedulingStep, setSchedulingStep] = useState(1);
  const [allAvailableSlots, setAllAvailableSlots] = useState([]);
  const [availableTimesForSelectedDays, setAvailableTimesForSelectedDays] = useState([]);
  const [selectedTime, setSelectedTime] = useState(null);
  const [selectedDays, setSelectedDays] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // ESTADOS PARA AGENDAMENTO PUNTUAL
  const [isSingleScheduleOpen, setIsSingleScheduleOpen] = useState(false);
  const [singleSelectedDate, setSingleSelectedDate] = useState(null);
  const [singleSelectedTime, setSingleSelectedTime] = useState(null);

  // NOVOS ESTADOS PARA DASHBOARD E CHAT
  const [feedbacks, setFeedbacks] = useState([]);
  const [chat, setChat] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [newChatMessage, setNewChatMessage] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [roleSettings, setRoleSettings] = useState(null);
  const [classMaterials, setClassMaterials] = useState([]);
  const [sharedMaterials, setSharedMaterials] = useState([]);

  const chatEndRef = React.useRef(null);
  const scrollToBottom = () => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(scrollToBottom, [chatMessages]);

  const latestActiveBilling = activeBillings[0];
  const classesPerWeek = latestActiveBilling?.packages?.classes_per_week || 0;
  const classDuration = latestActiveBilling?.packages?.class_duration_minutes || 30;
  const slotsPerClass = Math.ceil(classDuration / 15);

  const daysRemaining = useMemo(() => {
    if (!activeBillings || activeBillings.length === 0) return null;
    const endDate = parseISO(activeBillings[0].end_date);
    const today = new Date();
    const days = differenceInDays(endDate, today);
    return Math.max(0, days);
  }, [activeBillings]);


  const fetchData = useCallback(async () => {
    if (!user || !profile?.age) return;
    setLoading(true);
    try {
      const today = getBrazilDate().toISOString();
      const { data: profData, error: profError } = await supabase.from('profiles').select('id').eq('role', 'professor').limit(1).single();
      if (profError && profError.code !== 'PGRST116') throw profError;
      const currentProfessorId = profData?.id;
      if (!currentProfessorId) { setLoading(false); return; }
      setProfessorId(currentProfessorId);

      const [appointmentsRes, activeBillingsRes, pastBillingsRes, assignedLogsRes, pendingReqRes, feedbacksRes, chatRes, roleSettingsRes] = await Promise.all([
        supabase.from('appointments').select('*').eq('student_id', user.id).order('class_datetime', { ascending: true }),
        supabase.from('billing').select(`*, packages ( * )`).eq('user_id', user.id).gte('end_date', today.split('T')[0]).order('purchase_date', { ascending: false }),
        supabase.from('billing').select(`*, packages ( * )`).eq('user_id', user.id).lt('end_date', today.split('T')[0]).order('purchase_date', { ascending: false }),
        supabase.from('assigned_packages_log').select('assigned_classes, package_id, status, custom_package_name, assigned_at').eq('student_id', user.id).order('assigned_at', { ascending: false }),
        supabase.from('solicitudes_clase').select('solicitud_id, is_recurring').eq('alumno_id', user.id).eq('status', 'Pendiente').maybeSingle(),
        supabase.from('class_feedback').select(`*, appointment:appointments!fk_appointment(class_datetime)`).eq('student_id', user.id).order('created_at', { ascending: false }),
        supabase.from('chats').select('*').eq('alumno_id', user.id).maybeSingle(),
        supabase.from('role_settings').select('*').eq('role', 'student').maybeSingle(),
      ]);

      // Fetch next class without meeting_link first to be safe
      let nextClassData = null;
      try {
        const { data: ncData, error: ncError } = await supabase
          .from('appointments')
          .select(`*, student:profiles!student_id(full_name, spanish_level), professor:profiles!professor_id(full_name, meeting_link)`)
          .eq('student_id', user.id)
          .in('status', ['scheduled', 'rescheduled'])
          .gte('class_datetime', today)
          .order('class_datetime', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (ncError) {
          const { data: ncDataFallback } = await supabase
            .from('appointments')
            .select(`*, student:profiles!student_id(full_name, spanish_level), professor:profiles!professor_id(full_name)`)
            .eq('student_id', user.id)
            .in('status', ['scheduled', 'rescheduled'])
            .gte('class_datetime', today)
            .order('class_datetime', { ascending: true })
            .limit(1)
            .maybeSingle();
          nextClassData = ncDataFallback;
        } else {
          nextClassData = ncData;
        }
      } catch (e) {
        console.warn("Erro ao buscar próxima aula com link:", e);
      }

      const errors = [appointmentsRes.error, activeBillingsRes.error, pastBillingsRes.error, assignedLogsRes.error, pendingReqRes.error].filter(Boolean).filter(e => e.code !== 'PGRST116');
      if (errors.length) throw new Error(errors.map(e => e.message).join(', '));

      const appointmentsData = appointmentsRes.data || [];
      setAppointments(appointmentsData);
      setNextClass(nextClassData);

      const activeBillingsData = activeBillingsRes.data || [];
      const assignedLogsData = assignedLogsRes.data || [];
      setActiveBillings(activeBillingsData);
      setAssignedLogs(assignedLogsData);
      setPastBillings(pastBillingsRes.data || []);
      setFeedbacks(feedbacksRes.data || []);
      setRoleSettings(roleSettingsRes?.data || null);

      // Cargar materiales PDF asociados às aulas do aluno
      const { data: materialsData } = await supabase
        .from('class_materials')
        .select('*')
        .eq('student_id', user.id)
        .order('created_at', { ascending: false });

      setClassMaterials(materialsData || []);

      if (chatRes.data) {
        setChat(chatRes.data);
        fetchChatMessages(chatRes.data.chat_id);
      } else if (professorId) {
        // Se não existir chat, tenta encontrar/criar? 
        // Por agora, apenas se existir no banco.
      }

      const latestBilling = activeBillingsData[0]; // The most recent active billing
      const currentClassesPerWeek = latestBilling?.packages?.classes_per_week || 0;

      const pendingRequest = pendingReqRes.data || null;

      // Passo 1: Calcular o total de classes a partir do Log (Fonte de verdade para créditos e débitos)
      const totalClassesFromLog = assignedLogsData
        .filter(l => l.status !== 'Cancelado')
        .reduce((sum, log) => sum + (log.assigned_classes || 0), 0);

      let totalClasses = totalClassesFromLog;

      // Passo 2: FALLBACK/CORREÇÃO para pacotes com log ausente (ex: Personalizado)
      // Se a soma do log for zero (indicando que a entrada inicial está faltando) E houver uma fatura ativa, 
      // usamos o 'number_of_classes' da fatura como crédito inicial.
      if (totalClassesFromLog === 0 && latestBilling) {
        // Isso cobre o cenário em que o pacote "Personalizado" é adicionado sem a entrada inicial no Log.
        totalClasses = latestBilling.packages?.number_of_classes || 0;
      }

      const usedClasses = appointmentsData.filter(a => ['completed', 'missed'].includes(a.status)).length;
      const scheduledClassesCount = appointmentsData.filter(a => a.status === 'scheduled' && isFuture(parseISO(a.class_datetime))).length;
      const rescheduledClassesCount = appointmentsData.filter(a => a.status === 'rescheduled').length;

      let pendingClassesCount = 0;
      if (pendingRequest && pendingRequest.is_recurring) {
        pendingClassesCount = currentClassesPerWeek;
      }

      const netUsedClasses = usedClasses + scheduledClassesCount + pendingClassesCount;
      const available = Math.max(0, totalClasses - netUsedClasses + rescheduledClassesCount);

      setClassStats({
        available,
        scheduled: scheduledClassesCount,
        completed: appointmentsData.filter(a => a.status === 'completed').length,
        missed: appointmentsData.filter(a => a.status === 'missed').length,
        pending: pendingClassesCount,
        rescheduledCount: rescheduledClassesCount,
      });

      // Fetch shared materials from professor
      const { data: sharedMaterialsData, error: materialsError } = await supabase
        .from('shared_materials')
        .select('*')
        .or(`student_id.eq.${user.id},and(student_id.is.null,professor_id.eq.${currentProfessorId})`)
        .order('created_at', { ascending: false });

      if (!materialsError) {
        setSharedMaterials(sharedMaterialsData || []);
      }

    } catch (error) {
      toast({ variant: "destructive", title: "Erro ao carregar dados", description: `(${error.message})` });
    } finally { setLoading(false); }
  }, [user, profile, toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!user || !professorId) return;
    const channel = supabase.channel('student-dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments', filter: `student_id=eq.${user.id}` }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'billing', filter: `user_id=eq.${user.id}` }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'solicitudes_clase', filter: `alumno_id=eq.${user.id}` }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assigned_packages_log', filter: `student_id=eq.${user.id}` }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'class_slots', filter: `professor_id=eq.${professorId}` }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'role_settings', filter: `role=eq.student` }, fetchData)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [fetchData, user, professorId]);

  const fetchChatMessages = async (chatId) => {
    setChatLoading(true);
    const { data, error } = await supabase
      .from('mensajes')
      .select('*')
      .eq('chat_id', chatId)
      .order('enviado_en', { ascending: true });

    if (!error) setChatMessages(data || []);
    setChatLoading(false);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newChatMessage.trim() || !chat) return;

    setIsSendingMessage(true);
    const tempMessage = {
      mensaje_id: `temp-${Date.now()}`,
      remitente_id: user.id,
      contenido: newChatMessage,
      enviado_en: getBrazilDate().toISOString()
    };
    setChatMessages(prev => [...prev, tempMessage]);
    const messageToSend = newChatMessage;
    setNewChatMessage('');

    const { error } = await supabase.from('mensajes').insert({
      chat_id: chat.chat_id,
      remitente_id: user.id,
      contenido: messageToSend
    });

    if (error) {
      toast({ variant: 'destructive', title: 'Erro ao enviar', description: error.message });
      setChatMessages(prev => prev.filter(m => m.mensaje_id !== tempMessage.mensaje_id));
      setNewChatMessage(messageToSend);
    }
    setIsSendingMessage(false);
  };

  const performanceStats = useMemo(() => {
    if (feedbacks.length === 0) return null;
    const dimensions = ['fala', 'leitura', 'escrita', 'compreensao', 'audicao', 'gramatica', 'pronuncia', 'vocabulario'];

    // Calcular somas gerais
    const sumsAll = {};
    dimensions.forEach(d => sumsAll[d] = 0);

    feedbacks.forEach(f => {
      dimensions.forEach(d => {
        sumsAll[d] += (f[d] || 0);
      });
    });

    // Filtrar feedbacks dos últimos 30 dias
    const thirtyDaysAgo = getBrazilDate();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentFeedbacks = feedbacks.filter(f => {
      const feedbackDate = f.appointment?.class_datetime
        ? new Date(f.appointment.class_datetime)
        : new Date(f.created_at);
      return feedbackDate >= thirtyDaysAgo;
    });

    // Calcular somas dos últimos 30 dias
    const sumsRecent = {};
    dimensions.forEach(d => sumsRecent[d] = 0);

    recentFeedbacks.forEach(f => {
      dimensions.forEach(d => {
        sumsRecent[d] += (f[d] || 0);
      });
    });

    // Criar estatísticas por dimensão
    const stats = dimensions.map(d => ({
      name: d.charAt(0).toUpperCase() + d.slice(1).replace('_', ' '),
      key: d,
      average: (sumsAll[d] / feedbacks.length).toFixed(1),
      recentAverage: recentFeedbacks.length > 0 ? (sumsRecent[d] / recentFeedbacks.length).toFixed(1) : null
    }));

    // Calcular média geral (todas as dimensões, todo o histórico)
    const overallAverage = stats.reduce((acc, curr) => acc + parseFloat(curr.average), 0) / stats.length;
    const overallAveragePercent = ((overallAverage / 5) * 100).toFixed(0);

    // Calcular média dos últimos 30 dias
    let recentAveragePercent = null;
    let trendPercent = null;
    let trendDirection = null;

    if (recentFeedbacks.length > 0) {
      const recentOverallAverage = stats.reduce((acc, curr) => acc + parseFloat(curr.recentAverage || 0), 0) / stats.length;
      recentAveragePercent = ((recentOverallAverage / 5) * 100).toFixed(0);

      // Calcular diferença entre média recente e geral
      const difference = parseFloat(recentAveragePercent) - parseFloat(overallAveragePercent);
      trendPercent = Math.abs(difference).toFixed(0);
      trendDirection = difference >= 0 ? 'up' : 'down';
    }

    return {
      dimensions: stats,
      overallAveragePercent,
      recentAveragePercent,
      trendPercent,
      trendDirection,
      totalFeedbacks: feedbacks.length,
      recentFeedbacksCount: recentFeedbacks.length
    };
  }, [feedbacks]);


  // FUNÇÃO MODIFICADA: Agora se chama para agendamento pontual se houver créditos reagendados
  const handleStartScheduling = async () => {
    // Se há 1 crédito de reagendamento e é a única aula disponível, usa o fluxo pontual.
    if (classStats.available === 1 && classStats.rescheduledCount > 0) {
      setIsSingleScheduleOpen(true);
      return;
    }

    if (classesPerWeek <= 0) {
      toast({ variant: 'destructive', title: 'Aulas semanais não definidas', description: 'Seu pacote ativo não tem uma frequência de aulas semanais.' });
      return;
    }
    if (classStats.pending > 0) {
      toast({ variant: 'info', title: 'Solicitação Pendente', description: 'Você já tem um pedido de agendamento em análise. Aguarde a aprovação do professor.' });
      return;
    }

    setLoadingSlots(true);
    const { data: slotsData, error } = await supabase.from('class_slots').select('*').eq('professor_id', professorId).in('status', ['active', 'filled']);
    if (error) { toast({ variant: 'destructive', title: 'Erro ao buscar horários' }); setLoadingSlots(false); return; }

    setAllAvailableSlots(slotsData);
    setLoadingSlots(false);
    setSchedulingStep(2);
  };

  const handleDaySelection = (day) => {
    setSelectedDays(prev => {
      const newSelectedDays = prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day];

      if (newSelectedDays.length > classesPerWeek) {
        toast({ variant: 'info', title: 'Limite semanal atingido', description: `Você só pode selecionar ${classesPerWeek} dias por semana.` });
        return prev;
      }
      setSelectedTime(null);
      return newSelectedDays;
    });
  };

  useEffect(() => {
    if (selectedDays.length > 0) {
      const activeSlots = allAvailableSlots.filter(slot => slot.status === 'active');
      const availableTimes = new Set();

      activeSlots.forEach(slot => {
        const startTime = slot.start_time;

        const isStartSlotAvailableAcrossDays = selectedDays.every(day =>
          activeSlots.some(s => s.day_of_week === day && s.start_time === startTime)
        );

        if (isStartSlotAvailableAcrossDays) {
          const isBlockContinuouslyAvailable = selectedDays.every(day => {
            const startTimeObj = parse(startTime, 'HH:mm:ss', getBrazilDate());

            for (let i = 0; i < slotsPerClass; i++) {
              const currentSlotTime = format(add(startTimeObj, { minutes: i * 15 }), 'HH:mm:ss');
              const isSlotActive = activeSlots.some(s => s.day_of_week === day && s.start_time === currentSlotTime);
              if (!isSlotActive) return false;
            }
            return true;
          });

          if (isBlockContinuouslyAvailable) {
            availableTimes.add(startTime);
          }
        }
      });

      setAvailableTimesForSelectedDays(Array.from(availableTimes).sort());
    } else {
      setAvailableTimesForSelectedDays([]);
    }
  }, [selectedDays, allAvailableSlots, slotsPerClass]);

  const handleSubmitRequest = async () => {
    if (selectedDays.length !== classesPerWeek || !selectedTime) {
      toast({ variant: 'destructive', title: 'Seleção incompleta', description: `Por favor, selecione ${classesPerWeek} dias e um horário.` });
      return;
    }
    if (classStats.available < classesPerWeek) {
      toast({ variant: 'destructive', title: 'Aulas insuficientes', description: `Você não tem aulas disponíveis para agendar ${classesPerWeek} aulas.` });
      return;
    }
    if (classStats.pending > 0) {
      toast({ variant: 'info', title: 'Solicitação Pendente', description: 'Você já tem um pedido de agendamento em análise. Aguarde a aprovação do professor.' });
      return;
    }

    setIsSubmitting(true);

    const horarios_propuestos = { is_recurring: true, time: selectedTime, days: selectedDays };

    const { error } = await supabase.from('solicitudes_clase').insert({
      alumno_id: user.id,
      profesor_id: professorId,
      horarios_propuestos: JSON.stringify(horarios_propuestos),
      status: 'Pendiente',
      is_recurring: true,
    });

    if (error) {
      toast({ variant: 'destructive', title: 'Erro ao enviar solicitação', description: error.message });
    } else {
      toast({ variant: 'default', title: 'Solicitação enviada!', description: 'O professor foi notificado. Acompanhe o status em Minhas Aulas.' });
      setSchedulingStep(1);
      setSelectedTime(null);
      setSelectedDays([]);
      fetchData();
    }
    setIsSubmitting(false);
  };

  const StatCard = ({ title, value, icon: Icon, loading: statLoading, color = 'sky' }) => {
    const colorClasses = {
      sky: 'from-sky-500 to-sky-600 shadow-sky-200',
      amber: 'from-amber-500 to-amber-600 shadow-amber-200',
      emerald: 'from-emerald-500 to-emerald-600 shadow-emerald-200',
      violet: 'from-violet-500 to-violet-600 shadow-violet-200'
    };
    return (
      <motion.div
        whileHover={{ scale: 1.02, y: -2 }}
        className={`bg-gradient-to-br ${colorClasses[color] || colorClasses.sky} p-5 rounded-xl shadow-lg text-white`}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-white/80 text-sm font-medium">{title}</span>
          <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
            <Icon className="w-5 h-5 text-white" />
          </div>
        </div>
        {statLoading ? (
          <div className="h-10 w-16 bg-white/30 rounded-md animate-pulse" />
        ) : (
          <p className="text-4xl font-black">{value}</p>
        )}
      </motion.div>
    );
  };

  const StatusBadge = ({ status }) => {
    const statusMap = { scheduled: { label: "Agendada", className: "bg-blue-100 text-blue-800" }, completed: { label: "Realizada", className: "bg-green-100 text-green-800" }, canceled: { label: "Cancelada", className: "bg-red-100 text-red-800" }, missed: { label: "Falta", className: "bg-orange-100 text-orange-800" }, rescheduled: { label: "Reagendada", className: "bg-purple-100 text-purple-800" } };
    const { label, className } = statusMap[status] || { label: status };
    return <Badge variant="outline" className={cn("font-semibold", className)}>{label}</Badge>;
  };

  // FUNÇÃO MODIFICADA: Envio de solicitação de classe pontual com consumo de crédito
  const handleSingleScheduleSubmit = async () => {
    if (!singleSelectedDate || !singleSelectedTime) {
      toast({ variant: 'destructive', title: 'Seleção incompleta', description: 'Por favor, selecione uma data e um horário.' });
      return;
    }

    // VERIFICAÇÃO DE CRÉDITO
    if (classStats.available < 1 || classStats.rescheduledCount < 1) {
      toast({ variant: 'destructive', title: 'Crédito insuficiente', description: 'Você não tem créditos de aula reagendada disponíveis.' });
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Encontrar o ID do pacote de reagendamento para CONSUMO
      // Busca pelo pacote 'reagenda ahora' ou 'Personalizado'
      const reschedulePackage = activeBillings.find(b => b.packages?.name === 'reagenda ahora') ||
        activeBillings.find(b => b.packages?.name === 'Personalizado');

      // CORREÇÃO: Lança o erro se o pacote não for encontrado.
      if (!reschedulePackage) {
        throw new Error('Pacote de reagendamento não encontrado. Certifique-se de que "reagenda ahora" ou "Personalizado" exista na tabela de pacotes.');
      }

      // 2. CRIA A SOLICITAÇÃO DE AGENDAMENTO PONTUAL (is_recurring: false)
      const { error: reqError } = await supabase.from('solicitudes_clase').insert({
        alumno_id: user.id,
        profesor_id: professorId,
        horarios_propuestos: JSON.stringify({ is_recurring: false, time: singleSelectedTime, date: format(singleSelectedDate, 'yyyy-MM-dd') }),
        status: 'Pendiente',
        is_recurring: false,
      });

      if (reqError) throw reqError;

      // 3. REGISTRA O CONSUMO DO CRÉDITO (-1 aula) na tabela assigned_packages_log.
      const { error: consumeError } = await supabase
        .from('assigned_packages_log')
        .insert({
          professor_id: professorId,
          student_id: user.id,
          package_id: reschedulePackage.package_id,
          assigned_classes: -1, // CONSUMO IMEDIATO
          status: 'approved',
          observation: `Crédito consumido pelo pedido de aula pontual em ${format(singleSelectedDate, 'dd/MM/yyyy')}.`
        });

      if (consumeError) throw consumeError;


      toast({ variant: 'default', title: 'Solicitação enviada!', description: `Pedido de aula pontual em ${format(singleSelectedDate, 'dd/MM/yyyy')} às ${singleSelectedTime} enviado. O crédito foi debitado.` });

      setIsSingleScheduleOpen(false);
      setSingleSelectedDate(null);
      setSingleSelectedTime(null);
      fetchData();

    } catch (error) {
      // O erro do pacote é capturado aqui e exibido
      toast({ variant: 'destructive', title: 'Erro ao enviar solicitação', description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Detectar scroll para header compacto
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 100);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Frases motivacionales - Usando sistema de 360 frases (una para cada día del año)
  const todayPhrase = getDailyPhrase();


  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50">

        {/* Header - Se esconde al hacer scroll */}
        <div className="bg-white/80 backdrop-blur-sm border-b border-slate-100 mb-6">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 py-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                  {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                </span>
                <span className="px-2 py-0.5 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[10px] font-bold rounded-full flex items-center gap-1">
                  🔥 {classStats.completed || 0} aulas
                </span>
              </div>
              <motion.h1
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-2xl lg:text-3xl font-black text-slate-800"
              >
                Olá, <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-500 to-blue-600">{profile?.full_name?.split(' ')[0] || 'Aluno'}</span>! 👋
              </motion.h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-slate-500 mt-1"
              >
                {todayPhrase}
              </motion.p>
            </div>
            {/* Stats + Próxima Aula */}
            <div className="flex items-center gap-2">
              <div className="hidden min-[1200px]:flex items-center gap-2">
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className="bg-gradient-to-br from-sky-500 to-blue-600 rounded-xl px-5 py-4 text-white shadow-lg shadow-sky-200 min-w-[100px] text-center"
                >
                  <p className="text-3xl font-black">{classStats.scheduled || 0}</p>
                  <p className="text-[10px] text-sky-100 uppercase font-bold">Agendadas</p>
                </motion.div>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl px-5 py-4 text-white shadow-lg shadow-emerald-200 min-w-[100px] text-center"
                >
                  <p className="text-3xl font-black">{classStats.completed || 0}</p>
                  <p className="text-[10px] text-emerald-100 uppercase font-bold">Realizadas</p>
                </motion.div>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className="bg-gradient-to-br from-red-500 to-rose-600 rounded-xl px-5 py-4 text-white shadow-lg shadow-red-200 min-w-[100px] text-center"
                >
                  <p className="text-3xl font-black">{classStats.missed || 0}</p>
                  <p className="text-[10px] text-red-100 uppercase font-bold">Faltas</p>
                </motion.div>
                {daysRemaining !== null && (
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl px-5 py-4 text-white shadow-lg shadow-amber-200 min-w-[100px] text-center"
                  >
                    <p className="text-3xl font-black">{daysRemaining}</p>
                    <p className="text-[10px] text-amber-100 uppercase font-bold">Dias Restantes</p>
                  </motion.div>
                )}
              </div>
              <NextClassWidget nextClass={nextClass} />
            </div>
          </div>
        </div>

        {/* Quick Stats Row - Solo en móvil + IA Assistant */}
        <div className="grid grid-cols-2 lg:grid-cols-2 gap-3 mb-6">
          {/* Stats para móvil (ocultos en desktop porque ya están en el header) */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="bg-gradient-to-br from-sky-500 to-blue-600 rounded-xl p-4 text-white shadow-lg h-full flex flex-col justify-center"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-black leading-none">{classStats.scheduled || 0}</p>
                <p className="text-[10px] text-sky-100 font-bold uppercase mt-1">Agendadas</p>
              </div>
              <CalendarClock className="h-6 w-6 text-white/30" />
            </div>
          </motion.div>
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl p-4 text-white shadow-lg h-full flex flex-col justify-center"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-black leading-none">{classStats.completed || 0}</p>
                <p className="text-[10px] text-emerald-100 font-bold uppercase mt-1">Realizadas</p>
              </div>
              <CalendarCheck className="h-6 w-6 text-white/30" />
            </div>
          </motion.div>
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="bg-gradient-to-br from-red-500 to-rose-600 rounded-xl p-4 text-white shadow-lg h-full flex flex-col justify-center"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-black leading-none">{classStats.missed || 0}</p>
                <p className="text-[10px] text-red-100 font-bold uppercase mt-1">Faltas</p>
              </div>
              <AlertCircle className="h-6 w-6 text-white/30" />
            </div>
          </motion.div>
          {daysRemaining !== null && (
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl p-4 text-white shadow-lg h-full flex flex-col justify-center"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-black leading-none">{daysRemaining}</p>
                  <p className="text-[10px] text-amber-100 font-bold uppercase mt-1">DIAS</p>
                </div>
                <Clock className="h-6 w-6 text-white/30" />
              </div>
            </motion.div>
          )}
          {/* IA Assistant - siempre visible */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="col-span-2 lg:col-span-2 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl p-4 shadow-lg text-white"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <Bot className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="font-bold">Asistente IA de Español</p>
                  <p className="text-xs text-violet-100">Practica conversación, gramática y más</p>
                </div>
              </div>
              <Button
                onClick={() => navigate('/spanish-assistant')}
                className="bg-white text-violet-600 hover:bg-violet-50 font-bold"
              >
                Praticar agora →
              </Button>
            </div>
          </motion.div>
        </div>

        {/* Banner de Plano Expirando */}
        <PlanExpiringBanner userId={user?.id} />

        {/* Widget de Mensagens do Professor */}
        <StudentMessagesWidget />

        {/* Navegación por tabs moderna */}
        <Tabs defaultValue="agenda" className="w-full mt-6">
          {/* Tabs mejoradas con wrap para mobile y scroll indicators */}
          <div className="relative">
            {/* Indicador de scroll izquierdo (solo mobile) */}
            <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none lg:hidden" />

            {/* Indicador de scroll derecho (solo mobile) - ELIMINADO en favor de grid */}

            <TabsList className="w-full flex flex-wrap lg:flex-nowrap justify-start gap-2 bg-white/80 backdrop-blur-sm p-2 rounded-xl shadow-sm border border-slate-100 overflow-x-auto lg:overflow-visible scrollbar-hide">
              {/* Abas dinâmicas baseadas em permissões */}
              {(() => {
                const allowedTabs = roleSettings?.permissions?.tabs || ['dashboard', 'clases', 'chat', 'desempenho', 'faturas'];
                const tabsDef = [
                  { id: 'agenda', value: 'agenda', permission: 'dashboard', icon: Package, label: 'Inicio', color: 'sky', shortLabel: 'Inicio', bg: 'bg-sky-50', text: 'text-sky-600' },
                  { id: 'aulas', value: 'aulas', permission: 'clases', icon: BookOpen, label: 'Aulas', color: 'violet', shortLabel: 'Aulas', bg: 'bg-violet-50', text: 'text-violet-600' },
                  { id: 'recursos', value: 'recursos', permission: 'dashboard', icon: FileText, label: 'Recursos', color: 'blue', shortLabel: 'Recursos', bg: 'bg-blue-50', text: 'text-blue-600' },
                  { id: 'quiz', value: 'quiz', permission: 'dashboard', icon: CheckCircle2, label: 'Quiz', color: 'emerald', shortLabel: 'Quiz', bg: 'bg-emerald-50', text: 'text-emerald-600' },
                  { id: 'logros', value: 'logros', permission: 'dashboard', icon: Star, label: 'Logros', color: 'amber', shortLabel: 'Logros', bg: 'bg-amber-50', text: 'text-amber-600' },
                  { id: 'tickets', value: 'tickets', permission: 'dashboard', icon: Ticket, label: 'Tickets', color: 'rose', shortLabel: 'Tickets', bg: 'bg-rose-50', text: 'text-rose-600' },
                  { id: 'conversas', value: 'conversas', permission: 'chat', icon: MessageIcon, label: 'Chat', color: 'emerald', shortLabel: 'Chat', bg: 'bg-emerald-50', text: 'text-emerald-600' },
                  { id: 'desempenho', value: 'desempenho', permission: 'desempenho', icon: BarChart3, label: 'Notas', color: 'amber', shortLabel: 'Notas', bg: 'bg-amber-50', text: 'text-amber-600' },
                  { id: 'faturas', value: 'faturas', permission: 'faturas', icon: FileText, label: 'Faturas', color: 'slate', shortLabel: 'Faturas', bg: 'bg-slate-50', text: 'text-slate-600' },
                ];

                return tabsDef.filter(t => allowedTabs.includes(t.permission)).map(tab => (
                  <TabsTrigger
                    key={tab.id}
                    value={tab.value}
                    className={cn(
                      "flex-shrink-0 min-w-fit lg:px-6 lg:py-4 lg:text-lg rounded-xl transition-all whitespace-nowrap font-bold shadow-sm",
                      "data-[state=active]:bg-gradient-to-r data-[state=active]:from-sky-500 data-[state=active]:to-blue-600 data-[state=active]:text-white data-[state=active]:shadow-xl active:scale-95",
                      "flex flex-col lg:flex-row items-center justify-center gap-1.5 lg:gap-3",
                      "w-[calc(25%-6px)] md:w-[calc(20%-8px)] lg:w-auto", // 4 colunas no mobile para não ficar muito apertado mas mostrar tudo
                      tab.bg, tab.text,
                      "data-[state=active]:bg-none"
                    )}
                  >
                    <tab.icon className="h-5 w-5 lg:h-6 lg:w-6 flex-shrink-0" />
                    <span className="text-[10px] lg:text-base">{tab.label}</span>
                  </TabsTrigger>
                ));
              })()}
            </TabsList>
          </div>

          <TabsContent value="faturas" className="mt-4 space-y-6">
            <Alert className="border-sky-400 bg-sky-50 text-sky-900 [&>svg]:text-sky-600">
              <Sparkles className="h-4 w-4" />
              <AlertTitle className="font-bold">Dica de Ouro!</AlertTitle>
              <AlertDescription>
                Sabia que você pode reagendar aulas perdidas? Converse com seu professor e aproveite ao máximo seu pacote, sempre dentro dos 30 dias de validade. Flexibilidade é a chave para o sucesso!
              </AlertDescription>
            </Alert>

            {/* Contratos Ativos - Diseño moderno */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-6 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 rounded-lg">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-800">Contratos Ativos</h2>
                    <p className="text-sm text-slate-500">Seus pacotes de aulas ativos</p>
                  </div>
                </div>
              </div>
              <div className="p-6">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 text-sky-500 animate-spin" />
                  </div>
                ) : activeBillings.length > 0 ? (
                  <div className="grid gap-4">
                    {activeBillings.map(billing => {
                      const billingDate = new Date(billing.purchase_date).getTime();
                      const matchLog = assignedLogs
                        .filter(l => l.package_id == billing.package_id && l.status !== 'Cancelado')
                        .sort((a, b) => {
                          const diffA = Math.abs(new Date(a.assigned_at).getTime() - billingDate);
                          const diffB = Math.abs(new Date(b.assigned_at).getTime() - billingDate);
                          return diffA - diffB;
                        })[0];
                      const displayName = billing.custom_package_name || matchLog?.custom_package_name || billing.packages?.name;
                      const displayClasses = matchLog?.assigned_classes || billing.packages?.number_of_classes;

                      return (
                        <motion.div
                          key={billing.id}
                          whileHover={{ scale: 1.01 }}
                          className="p-5 rounded-xl bg-gradient-to-br from-sky-50 to-blue-50 border border-sky-100 shadow-sm"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="text-lg font-bold text-slate-800">{displayName}</h3>
                              <Badge className="mt-1 bg-sky-100 text-sky-700 border-sky-200">{displayClasses} aulas</Badge>
                            </div>
                            <div className="text-right">
                              <p className="text-2xl font-black text-emerald-600">R$ {billing.amount_paid}</p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between mt-4 pt-4 border-t border-sky-100">
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                              <CalendarIcon className="h-4 w-4" />
                              <span>Validade: <strong>{format(parseISO(billing.end_date), 'dd/MM/yyyy')}</strong></span>
                            </div>
                            <span className="text-xs text-slate-400">Adquirido em {format(parseISO(billing.purchase_date), 'dd/MM/yyyy')}</span>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-center text-slate-500 py-8">Nenhum contrato ativo.</p>
                )}
              </div>
            </div>

            {/* Histórico - Diseño moderno */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-6 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-100 rounded-lg">
                    <FileText className="h-5 w-5 text-slate-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-800">Histórico de Faturas</h2>
                    <p className="text-sm text-slate-500">Pacotes anteriores</p>
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 text-sky-500 animate-spin" />
                  </div>
                ) : pastBillings.length > 0 ? (
                  <Table>
                    <TableHeader className="bg-slate-50/50">
                      <TableRow>
                        <TableHead className="font-semibold">Pacote</TableHead>
                        <TableHead className="font-semibold">Data da Compra</TableHead>
                        <TableHead className="font-semibold">Data de Expiração</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pastBillings.map(b => (
                        <TableRow key={b.id} className="hover:bg-slate-50/50">
                          <TableCell className="font-medium">{b.packages.name}</TableCell>
                          <TableCell>{format(parseISO(b.purchase_date), 'PPP', { locale: ptBR })}</TableCell>
                          <TableCell>{format(parseISO(b.end_date), 'PPP', { locale: ptBR })}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="p-8 text-center text-slate-500">Nenhum histórico encontrado.</p>
                )}
              </div>
            </div>

          </TabsContent>

          <TabsContent value="agenda" className="mt-4 space-y-6">
            {/* Cards de estadísticas OCULTOS - Ya están en el header */}
            {/* 
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard title="Aulas Pendentes" value={classStats.pending} icon={Clock3} loading={loading} color="amber" />
              <StatCard title="Aulas Agendadas" value={classStats.scheduled} icon={CalendarClock} loading={loading} color="sky" />
              <StatCard title="Aulas Realizadas" value={classStats.completed} icon={CalendarCheck} loading={loading} color="emerald" />
            </div>
            */}

            {/* BLOCO DE AGENDAMENTO PONTUAL OCULTO conforme solicitação */}
            {/* A funcionalidade de agendamento pontual foi removida da interface do aluno */}

            {/* BLOCO DE AGENDAMENTO SEMANAL OCULTO conforme solicitação */}
            {/* A funcionalidade de agendamento semanal fue removida da interface do aluno */}

            {/* Grid de dos columnas: Próximas Aulas + Vocabulario */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Próximas Aulas - Columna izquierda */}
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-100 overflow-hidden h-fit">
                <div className="p-5 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-sky-100 rounded-lg">
                      <CalendarClock className="h-5 w-5 text-sky-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800">Próximas Aulas</h3>
                      <p className="text-xs text-slate-500">Suas aulas agendadas</p>
                    </div>
                  </div>
                </div>
                <div className="divide-y divide-slate-100">
                  {loading ? (
                    <div className="p-8 flex justify-center">
                      <Loader2 className="h-6 w-6 text-sky-500 animate-spin" />
                    </div>
                  ) : appointments.filter(a => a.status === 'scheduled').slice(0, 4).length > 0 ? (
                    appointments.filter(a => a.status === 'scheduled').slice(0, 4).map((apt, idx) => (
                      <motion.div
                        key={apt.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className="text-center min-w-[50px]">
                            <p className="text-2xl font-black text-sky-600">{format(parseISO(apt.class_datetime), 'dd')}</p>
                            <p className="text-xs text-slate-500 uppercase">{format(parseISO(apt.class_datetime), 'MMM', { locale: ptBR })}</p>
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800">{format(parseISO(apt.class_datetime), 'EEEE', { locale: ptBR })}</p>
                            <p className="text-sm text-slate-500">{format(parseISO(apt.class_datetime), 'HH:mm')} - {apt.duration_minutes || 30} min</p>
                          </div>
                        </div>
                        <Badge className="bg-sky-100 text-sky-700 border-sky-200">Agendada</Badge>
                      </motion.div>
                    ))
                  ) : (
                    <div className="p-8 text-center">
                      <CalendarClock className="h-10 w-10 text-slate-200 mx-auto mb-2" />
                      <p className="text-slate-500">Nenhuma aula agendada</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Vocabulario del Día - Columna derecha */}
              <DailyVocabularyWidget />
            </div>
          </TabsContent>

          {/* NUEVA PESTAÑA: RECURSOS */}
          <TabsContent value="recursos" className="mt-4 space-y-6">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-6 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-sky-100 rounded-lg">
                    <FileText className="h-5 w-5 text-sky-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-800">Biblioteca de Recursos</h2>
                    <p className="text-sm text-slate-500">Materiais de estudo do seu professor</p>
                  </div>
                </div>
              </div>
              <div className="p-6">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
                  </div>
                ) : sharedMaterials.length > 0 ? (
                  <div className="grid gap-4">
                    {sharedMaterials.map((material, idx) => {
                      const fileExtension = material.file_url.split('.').pop().toUpperCase();
                      const displayType = material.file_type || fileExtension;

                      return (
                        <motion.a
                          key={material.id}
                          href={material.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          className="flex items-center justify-between p-4 rounded-xl border border-slate-100 hover:border-sky-200 hover:bg-sky-50/50 transition-all cursor-pointer group"
                        >
                          <div className="flex items-center gap-4 flex-1">
                            <div className={cn(
                              "p-3 rounded-xl",
                              displayType === 'PDF' ? 'bg-red-100' :
                                displayType.includes('MP3') || displayType.includes('AUDIO') ? 'bg-purple-100' :
                                  displayType.includes('MP4') || displayType.includes('VIDEO') ? 'bg-blue-100' :
                                    'bg-sky-100'
                            )}>
                              <FileText className={cn(
                                "h-6 w-6",
                                displayType === 'PDF' ? 'text-red-600' :
                                  displayType.includes('MP3') || displayType.includes('AUDIO') ? 'text-purple-600' :
                                    displayType.includes('MP4') || displayType.includes('VIDEO') ? 'text-blue-600' :
                                      'text-sky-600'
                              )} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-slate-800 group-hover:text-sky-600 transition-colors truncate">
                                {material.material_name}
                              </p>
                              {material.description && (
                                <p className="text-xs text-slate-500 mt-0.5 truncate">{material.description}</p>
                              )}
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <Badge variant="outline" className="text-xs">{displayType}</Badge>
                                {material.file_size_bytes && (
                                  <span className="text-xs text-slate-400">
                                    {(material.file_size_bytes / 1024 / 1024).toFixed(1)} MB
                                  </span>
                                )}
                                {material.category && (
                                  <Badge className="text-xs bg-slate-100 text-slate-600">{material.category}</Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                            onClick={(e) => {
                              e.preventDefault();
                              window.open(material.file_url, '_blank');
                            }}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </motion.a>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="p-4 bg-slate-100 rounded-full inline-block mb-4">
                      <FileText className="h-10 w-10 text-slate-300" />
                    </div>
                    <p className="font-medium text-slate-600 mb-2">Nenhum recurso disponível</p>
                    <p className="text-sm text-slate-400">
                      Seu professor ainda não compartilhou materiais de estudo
                    </p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* PESTAÑA QUIZ - Acceso a página dedicada */}
          <TabsContent value="quiz" className="mt-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-gradient-to-br from-violet-500 via-purple-600 to-indigo-700 rounded-2xl p-8 text-white shadow-xl text-center"
            >
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="text-7xl mb-6"
              >
                🎯
              </motion.div>
              <h2 className="text-3xl font-black mb-3">¡Practica tu Español!</h2>
              <p className="text-violet-100 mb-6 max-w-md mx-auto">
                Ejercicios interactivos estilo Duolingo: traducción, conjugación, vocabulario y más.
                ¡Gana XP y mantén tu racha!
              </p>

              <div className="flex items-center justify-center gap-6 mb-8">
                <div className="text-center">
                  <p className="text-2xl font-black">❤️ 3</p>
                  <p className="text-xs text-violet-200">Vidas</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-black">⭐ +10</p>
                  <p className="text-xs text-violet-200">XP por acierto</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-black">🔥 Racha</p>
                  <p className="text-xs text-violet-200">Bonus</p>
                </div>
              </div>

              <Button
                onClick={() => navigate('/quiz')}
                size="lg"
                className="bg-white text-violet-700 hover:bg-violet-50 font-bold text-lg px-8 py-6 shadow-lg"
              >
                <Sparkles className="h-5 w-5 mr-2" />
                Comenzar Lección
              </Button>

              <p className="text-xs text-violet-200 mt-4">
                10 ejercicios aleatorios por lección
              </p>
            </motion.div>
          </TabsContent>

          {/* NUEVA PESTAÑA: LOGROS (GAMIFICACIÓN) */}
          <TabsContent value="logros" className="mt-4 space-y-6">
            <div className="bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 rounded-2xl p-6 text-white shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                    <Star className="h-8 w-8 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black">Nível {Math.floor((classStats.completed || 0) / 5) + 1}</h2>
                    <p className="text-orange-100">Estudante {(classStats.completed || 0) >= 20 ? 'Avançado' : (classStats.completed || 0) >= 10 ? 'Intermediário' : 'Iniciante'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-4xl font-black">{((classStats.completed || 0) * 50) + (classStats.scheduled || 0) * 10}</p>
                  <p className="text-orange-100 text-sm">Pontos XP</p>
                </div>
              </div>
              <div className="bg-white/20 rounded-full h-3 mb-2">
                <div
                  className="bg-white rounded-full h-3 transition-all duration-500"
                  style={{ width: `${((classStats.completed || 0) % 5) * 20}%` }}
                />
              </div>
              <p className="text-xs text-orange-100">{5 - ((classStats.completed || 0) % 5)} aulas para o próximo nível</p>
            </div>

            {/* Badges */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-100 p-6">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Star className="h-5 w-5 text-amber-500" />
                Suas Conquistas
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { name: 'Primeira Aula', icon: '🎉', earned: (classStats.completed || 0) >= 1, desc: 'Completou sua primeira aula' },
                  { name: '5 Aulas', icon: '⭐', earned: (classStats.completed || 0) >= 5, desc: 'Completou 5 aulas' },
                  { name: '10 Aulas', icon: '🏆', earned: (classStats.completed || 0) >= 10, desc: 'Completou 10 aulas' },
                  { name: 'Dedicado', icon: '🔥', earned: (classStats.completed || 0) >= 15, desc: '15 aulas completadas' },
                  { name: 'Nota Alta', icon: '💯', earned: (performanceStats?.overallAveragePercent || 0) >= 80, desc: 'Média acima de 80%' },
                  { name: 'Conversador', icon: '💬', earned: (chatMessages?.length || 0) >= 5, desc: 'Enviou 5 mensagens no chat' },
                  { name: 'IA Master', icon: '🤖', earned: (chatMessages?.length || 0) >= 10, desc: 'Usou bastante o assistente IA' },
                  { name: 'Estudioso', icon: '📚', earned: (sharedMaterials?.length || 0) >= 3, desc: 'Recebeu 3 ou mais recursos' },
                ].map((badge, idx) => (
                  <motion.div
                    key={idx}
                    whileHover={{ scale: 1.05 }}
                    className={cn(
                      "text-center p-4 rounded-xl border-2 transition-all",
                      badge.earned
                        ? "bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200 shadow-sm"
                        : "bg-slate-50 border-slate-200 opacity-50"
                    )}
                  >
                    <span className="text-3xl">{badge.icon}</span>
                    <p className={cn("font-semibold mt-2 text-sm", badge.earned ? "text-slate-800" : "text-slate-400")}>{badge.name}</p>
                    <p className="text-xs text-slate-400 mt-1">{badge.desc}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* PESTAÑA DE TICKETS */}
          <TabsContent value="tickets" className="mt-4">
            <StudentTicketsTab />
          </TabsContent>

          <TabsContent value="aulas" className="mt-4">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-6 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-violet-100 rounded-lg">
                    <BookOpen className="h-5 w-5 text-violet-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-800">Minhas Aulas</h2>
                    <p className="text-sm text-slate-500">Histórico completo de suas aulas</p>
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50/50">
                    <TableRow>
                      <TableHead className="font-semibold">Data</TableHead>
                      <TableHead className="font-semibold">Hora</TableHead>
                      <TableHead className="font-semibold">Duração</TableHead>
                      <TableHead className="font-semibold">Status</TableHead>
                      <TableHead className="font-semibold">Material</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow><TableCell colSpan="5" className="text-center">Carregando...</TableCell></TableRow>
                    ) : appointments.length > 0 ? (
                      appointments.map(apt => {
                        // Buscar materiales para esta aula
                        const aptMaterials = classMaterials.filter(m => m.appointment_id === apt.id);

                        return (
                          <TableRow key={apt.id}>
                            <TableCell className="font-medium">{format(parseISO(apt.class_datetime), 'PPP', { locale: ptBR })}</TableCell>
                            <TableCell>{format(parseISO(apt.class_datetime), 'HH:mm')}</TableCell>
                            <TableCell>{apt.duration_minutes || 30} min</TableCell>
                            <TableCell><StatusBadge status={apt.status} /></TableCell>
                            <TableCell>
                              {aptMaterials.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {aptMaterials.map(material => (
                                    <a
                                      key={material.id}
                                      href={material.file_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-sky-100 text-sky-700 rounded-md hover:bg-sky-200 transition-colors"
                                      title={`Baixar: ${material.material_name}`}
                                    >
                                      <FileText className="w-3 h-3" />
                                      <span className="max-w-[100px] truncate">{material.material_name}</span>
                                      <Download className="w-3 h-3" />
                                    </a>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-xs text-slate-400">-</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow><TableCell colSpan="5" className="text-center p-8 text-slate-500">Nenhuma aula encontrada.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="conversas" className="mt-4">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-100 flex flex-col h-[600px] overflow-hidden">
              <header className="p-5 border-b border-slate-100 bg-gradient-to-r from-emerald-500 to-teal-600">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white">
                    <User className="h-6 w-6" />
                  </div>
                  <div className="text-white">
                    <h3 className="font-bold text-lg">Chat com Professor</h3>
                    <p className="text-emerald-100 text-sm">Tire suas dúvidas em tempo real</p>
                  </div>
                </div>
              </header>

              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-slate-50 to-white">
                {chatLoading ? (
                  <div className="flex justify-center items-center h-full">
                    <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
                  </div>
                ) : chatMessages.length > 0 ? (
                  chatMessages.map((msg, idx) => {
                    const isMe = msg.remitente_id === user.id;
                    return (
                      <motion.div
                        key={msg.mensaje_id || idx}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn("flex", isMe ? "justify-end" : "justify-start")}
                      >
                        <div className={cn(
                          "max-w-[80%] rounded-2xl px-4 py-3 shadow-sm",
                          isMe
                            ? "bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-tr-sm"
                            : "bg-white text-slate-800 rounded-tl-sm border border-slate-100"
                        )}>
                          <p className="text-sm">{msg.contenido}</p>
                          <p className={cn("text-[10px] mt-1 text-right", isMe ? "text-emerald-100" : "text-slate-400")}>
                            {format(parseISO(msg.enviado_en), 'HH:mm')}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400">
                    <div className="p-4 bg-slate-100 rounded-full mb-4">
                      <MessageCircle className="h-10 w-10 text-slate-300" />
                    </div>
                    <p className="font-medium">Inicie uma conversa!</p>
                    <p className="text-sm text-slate-400">Envie uma mensagem para seu professor</p>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-100 bg-white flex gap-3">
                <input
                  value={newChatMessage}
                  onChange={(e) => setNewChatMessage(e.target.value)}
                  placeholder="Escreva sua mensagem..."
                  className="flex-1 bg-slate-100 border-none rounded-full px-5 py-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  disabled={isSendingMessage}
                />
                <Button
                  type="submit"
                  size="icon"
                  className="rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 h-12 w-12 shrink-0 shadow-lg shadow-emerald-200 hover:shadow-emerald-300"
                  disabled={isSendingMessage || !newChatMessage.trim()}
                >
                  {isSendingMessage ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                </Button>
              </form>
            </div>
          </TabsContent>

          <TabsContent value="desempenho" className="mt-4">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-6 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 rounded-lg">
                    <BarChart3 className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-800">Meu Desempenho</h2>
                    <p className="text-sm text-slate-500">Acompanhe sua evolução no aprendizado</p>
                  </div>
                </div>
              </div>
              <div className="p-6">
                {!performanceStats ? (
                  <div className="text-center py-12">
                    <div className="p-4 bg-slate-100 rounded-full inline-block mb-4">
                      <BarChart3 className="h-10 w-10 text-slate-300" />
                    </div>
                    <p className="font-medium text-slate-600">Ainda não há avaliações</p>
                    <p className="text-sm text-slate-400 mt-1">As notas aparecerão aqui após suas aulas serem avaliadas</p>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {/* Três Indicadores KPI */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Indicador 1: Média Geral */}
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0 }}
                        className="bg-gradient-to-br from-sky-500 to-sky-600 p-6 rounded-xl text-white shadow-lg"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sky-100 text-sm font-medium">Média Geral</span>
                          <div className="p-2 bg-white/20 rounded-lg">
                            <Star className="h-5 w-5 text-white" />
                          </div>
                        </div>
                        <p className="text-4xl font-black">{performanceStats.overallAveragePercent}%</p>
                        <p className="text-sky-100 text-xs mt-1">Baseado em {performanceStats.totalFeedbacks} avaliações</p>
                      </motion.div>

                      {/* Indicador 2: Média 30 Dias */}
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                        className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-6 rounded-xl text-white shadow-lg"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-emerald-100 text-sm font-medium">Últimos 30 Dias</span>
                          <div className="p-2 bg-white/20 rounded-lg">
                            <CalendarIcon className="h-5 w-5 text-white" />
                          </div>
                        </div>
                        <p className="text-4xl font-black">
                          {performanceStats.recentAveragePercent ? `${performanceStats.recentAveragePercent}%` : 'N/A'}
                        </p>
                        <p className="text-emerald-100 text-xs mt-1">
                          {performanceStats.recentFeedbacksCount > 0
                            ? `${performanceStats.recentFeedbacksCount} avaliações recentes`
                            : 'Sem avaliações neste período'
                          }
                        </p>
                      </motion.div>

                      {/* Indicador 3: Tendência */}
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                        className={cn(
                          "p-6 rounded-xl text-white shadow-lg",
                          performanceStats.trendDirection === 'up'
                            ? "bg-gradient-to-br from-green-500 to-green-600"
                            : performanceStats.trendDirection === 'down'
                              ? "bg-gradient-to-br from-orange-500 to-orange-600"
                              : "bg-gradient-to-br from-slate-500 to-slate-600"
                        )}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className={cn(
                            "text-sm font-medium",
                            performanceStats.trendDirection === 'up' ? "text-green-100"
                              : performanceStats.trendDirection === 'down' ? "text-orange-100"
                                : "text-slate-100"
                          )}>Tendência</span>
                          <div className="p-2 bg-white/20 rounded-lg">
                            {performanceStats.trendDirection === 'up' ? (
                              <TrendingUp className="h-5 w-5 text-white" />
                            ) : performanceStats.trendDirection === 'down' ? (
                              <TrendingDown className="h-5 w-5 text-white" />
                            ) : (
                              <Minus className="h-5 w-5 text-white" />
                            )}
                          </div>
                        </div>
                        <p className="text-4xl font-black flex items-center gap-2">
                          {performanceStats.trendPercent ? (
                            <>
                              {performanceStats.trendDirection === 'up' ? '+' : performanceStats.trendDirection === 'down' ? '-' : ''}
                              {performanceStats.trendPercent}%
                            </>
                          ) : 'N/A'}
                        </p>
                        <p className={cn(
                          "text-xs mt-1",
                          performanceStats.trendDirection === 'up' ? "text-green-100"
                            : performanceStats.trendDirection === 'down' ? "text-orange-100"
                              : "text-slate-100"
                        )}>
                          {performanceStats.trendDirection === 'up'
                            ? 'Você está evoluindo!'
                            : performanceStats.trendDirection === 'down'
                              ? 'Hora de focar mais!'
                              : 'Sem dados suficientes'
                          }
                        </p>
                      </motion.div>
                    </div>

                    {/* Gráfico de Barras Verticais */}
                    <div className="bg-slate-50 p-6 rounded-xl border border-slate-100">
                      <h3 className="text-lg font-bold mb-6 text-slate-800">Desempenho por Competência</h3>
                      <div className="flex items-end justify-between gap-2 h-64 px-4">
                        {performanceStats.dimensions.map((stat, index) => {
                          const heightPercent = (parseFloat(stat.average) / 5) * 100;
                          const getBarColor = (percent) => {
                            if (percent >= 80) return 'from-emerald-400 to-emerald-600';
                            if (percent >= 60) return 'from-sky-400 to-sky-600';
                            if (percent >= 40) return 'from-yellow-400 to-yellow-600';
                            return 'from-orange-400 to-orange-600';
                          };
                          return (
                            <div key={stat.key} className="flex flex-col items-center flex-1 group">
                              <div className="relative w-full flex flex-col items-center">
                                {/* Valor acima da barra */}
                                <motion.span
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  transition={{ delay: 0.5 + index * 0.1 }}
                                  className="text-xs font-bold text-slate-700 mb-1"
                                >
                                  {stat.average}
                                </motion.span>
                                {/* Container da barra */}
                                <div className="w-full h-48 bg-slate-200 rounded-t-lg overflow-hidden flex items-end">
                                  <motion.div
                                    initial={{ height: 0 }}
                                    animate={{ height: `${heightPercent}%` }}
                                    transition={{ duration: 1, delay: index * 0.1, ease: "easeOut" }}
                                    className={cn(
                                      "w-full rounded-t-lg bg-gradient-to-t shadow-inner",
                                      getBarColor(heightPercent)
                                    )}
                                  />
                                </div>
                              </div>
                              {/* Label abaixo */}
                              <span className="text-[10px] font-medium text-slate-600 mt-2 text-center leading-tight">
                                {stat.name}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      {/* Legenda */}
                      <div className="flex justify-center gap-6 mt-6 pt-4 border-t border-slate-200">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600" />
                          <span className="text-xs text-slate-600">Excelente (≥80%)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-gradient-to-r from-sky-400 to-sky-600" />
                          <span className="text-xs text-slate-600">Bom (60-79%)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-gradient-to-r from-yellow-400 to-yellow-600" />
                          <span className="text-xs text-slate-600">Regular (40-59%)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-gradient-to-r from-orange-400 to-orange-600" />
                          <span className="text-xs text-slate-600">A melhorar (&lt;40%)</span>
                        </div>
                      </div>
                    </div>

                    {/* Histórico de Feedbacks */}
                    <div className="pt-6 border-t">
                      <h3 className="text-lg font-bold mb-4">Comentários e Feedbacks do Professor</h3>
                      <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                        {feedbacks.length === 0 ? (
                          <p className="text-center text-slate-500 py-8">Nenhum feedback encontrado.</p>
                        ) : (
                          feedbacks.map((f) => {
                            const dimensions = ['fala', 'leitura', 'escrita', 'compreensao', 'audicao', 'gramatica', 'pronuncia', 'vocabulario'];
                            const avgScore = dimensions.reduce((sum, d) => sum + (f[d] || 0), 0) / dimensions.length;
                            const avgPercent = ((avgScore / 5) * 100).toFixed(0);

                            return (
                              <motion.div
                                key={f.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="p-5 rounded-xl bg-white border-2 border-slate-100 hover:border-sky-200 hover:shadow-md transition-all"
                              >
                                <div className="flex justify-between items-start mb-3">
                                  <div className="flex items-center gap-3">
                                    <div className="p-2 bg-sky-100 rounded-lg">
                                      <CalendarIcon className="h-4 w-4 text-sky-600" />
                                    </div>
                                    <div>
                                      <span className="text-sm font-bold text-slate-800">
                                        {f.appointment?.class_datetime ? format(parseISO(f.appointment.class_datetime), 'PPP', { locale: ptBR }) : 'Aula'}
                                      </span>
                                      <p className="text-xs text-slate-500">
                                        {f.appointment?.class_datetime ? format(parseISO(f.appointment.class_datetime), 'HH:mm') : ''}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <div className="flex gap-0.5">
                                      {[1, 2, 3, 4, 5].map(s => (
                                        <Star key={s} className={cn("h-4 w-4", s <= Math.round(avgScore) ? "text-yellow-400 fill-yellow-400" : "text-slate-200")} />
                                      ))}
                                    </div>
                                    <Badge variant="outline" className={cn(
                                      "text-xs font-bold",
                                      parseInt(avgPercent) >= 80 ? "border-emerald-300 bg-emerald-50 text-emerald-700" :
                                        parseInt(avgPercent) >= 60 ? "border-sky-300 bg-sky-50 text-sky-700" :
                                          parseInt(avgPercent) >= 40 ? "border-yellow-300 bg-yellow-50 text-yellow-700" :
                                            "border-orange-300 bg-orange-50 text-orange-700"
                                    )}>
                                      {avgPercent}%
                                    </Badge>
                                  </div>
                                </div>

                                {/* Comentário do professor */}
                                <div className="bg-slate-50 p-4 rounded-lg mb-4">
                                  <p className="text-sm text-slate-700 italic leading-relaxed">
                                    "{f.comment || 'Sem comentário adicional do professor.'}"
                                  </p>
                                </div>

                                {/* Notas por competência */}
                                <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
                                  {dimensions.map(d => (
                                    <div key={d} className="text-center p-2 bg-white border rounded-lg">
                                      <p className="text-[10px] text-slate-500 font-medium truncate">
                                        {d.charAt(0).toUpperCase() + d.slice(1)}
                                      </p>
                                      <p className={cn(
                                        "text-sm font-bold mt-1",
                                        f[d] >= 4 ? "text-emerald-600" :
                                          f[d] >= 3 ? "text-sky-600" :
                                            f[d] >= 2 ? "text-yellow-600" :
                                              "text-orange-600"
                                      )}>
                                        {f[d]}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </motion.div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Sección de Acceso Rápido - Al final */}
        <div className="mt-6 mb-20 bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-5 w-5 text-sky-500" />
            <h3 className="font-bold text-slate-800">Acesso Rápido</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <motion.button
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/spanish-assistant')}
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-100 hover:border-violet-200 transition-colors"
            >
              <div className="p-3 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl text-white shadow-lg shadow-violet-200">
                <Bot className="h-6 w-6" />
              </div>
              <span className="text-sm font-medium text-slate-700">IA Assistant</span>
              <span className="text-xs text-slate-400">Praticar</span>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.98 }}
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 hover:border-emerald-200 transition-colors"
            >
              <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl text-white shadow-lg shadow-emerald-200">
                <MessageIcon className="h-6 w-6" />
              </div>
              <span className="text-sm font-medium text-slate-700">Chat</span>
              <span className="text-xs text-slate-400">Professor</span>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.98 }}
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-gradient-to-br from-sky-50 to-blue-50 border border-sky-100 hover:border-sky-200 transition-colors"
            >
              <div className="p-3 bg-gradient-to-br from-sky-500 to-blue-600 rounded-xl text-white shadow-lg shadow-sky-200">
                <FileText className="h-6 w-6" />
              </div>
              <span className="text-sm font-medium text-slate-700">Materiais</span>
              <span className="text-xs text-slate-400">Em breve</span>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.98 }}
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100 hover:border-amber-200 transition-colors"
            >
              <div className="p-3 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl text-white shadow-lg shadow-amber-200">
                <BarChart3 className="h-6 w-6" />
              </div>
              <span className="text-sm font-medium text-slate-700">Desempenho</span>
              <span className="text-xs text-slate-400">Ver notas</span>
            </motion.button>
          </div>
        </div>

        {/* Botões Flutuantes Globais */}
        <div className="fixed bottom-6 right-24 z-50 flex gap-3">
          <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
            <Button
              size="icon"
              onClick={() => navigate('/spanish-assistant')}
              className="rounded-full h-14 w-14 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg"
              title="Asistente de Español IA"
            >
              <Bot className="h-7 w-7" />
            </Button>
          </motion.div>
          <HelpWidget />
        </div>
      </div>
    </motion.div>
  );
};

export default HomePage;
