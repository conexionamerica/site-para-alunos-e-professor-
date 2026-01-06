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
import { FileText, Package, BookOpen, CalendarCheck, CalendarClock, CalendarPlus, Send, Loader2, Info, CheckCircle2, Clock3, Sparkles, RotateCcw, Bot, Download, ExternalLink } from 'lucide-react';
import NotificationsWidget from '@/components/NotificationsWidget';
import StudentMessagesWidget from '@/components/StudentMessagesWidget';
import { PlanExpiringBanner } from '@/components/student/PlanExpiringBanner';

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
      <div className="bg-white rounded-lg border-l-4 border-slate-300 shadow-sm p-4 h-full flex flex-col justify-center">
        <h3 className="text-lg font-bold mb-2">Próxima Aula</h3>
        <p className="text-slate-500 text-sm">Você não tem nenhuma aula agendada no futuro.</p>
      </div>
    );
  }

  const { class_datetime, student } = nextClass;

  return (
    <div className="bg-white rounded-lg border-l-4 border-sky-500 shadow-sm p-4 h-full flex flex-col">
      <h3 className="text-lg font-bold mb-1">Próxima Aula</h3>
      <p className="text-xs text-slate-500 mb-2">Começa {formatDistanceToNowStrict(new Date(class_datetime), { locale: ptBR, addSuffix: true })}</p>
      <div className="flex-grow">
        <p className="text-lg font-bold mt-1">{student?.spanish_level ? 'Espanhol' : 'Inglês'}</p>
        <p className="text-sm"><strong>Nível:</strong> {student?.spanish_level || 'Não definido'}</p>
      </div>
      <Button asChild className="w-full mt-3 bg-sky-600 hover:bg-sky-700">
        <a href={nextClass.professor?.meeting_link || "https://meet.google.com/tmi-xwmg-kua"} target="_blank" rel="noopener noreferrer">Iniciar Agora</a>
      </Button>
    </div>
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

const HomePage = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [activeBillings, setActiveBillings] = useState([]);
  const [pastBillings, setPastBillings] = useState([]);
  const [classStats, setClassStats] = useState({ available: 0, scheduled: 0, completed: 0, pending: 0, rescheduledCount: 0 });
  const [appointments, setAppointments] = useState([]);
  const [nextClass, setNextClass] = useState(null);
  const [professorId, setProfessorId] = useState(null);

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

  const chatEndRef = React.useRef(null);
  const scrollToBottom = () => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(scrollToBottom, [chatMessages]);

  const latestActiveBilling = activeBillings[0];
  const classesPerWeek = latestActiveBilling?.packages?.classes_per_week || 0;
  const classDuration = latestActiveBilling?.packages?.class_duration_minutes || 30;
  const slotsPerClass = Math.ceil(classDuration / 15);


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
        supabase.from('assigned_packages_log').select('assigned_classes, package_id, status').eq('student_id', user.id),
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
        pending: pendingClassesCount,
        rescheduledCount: rescheduledClassesCount,
      });

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

  const StatCard = ({ title, value, icon: Icon, loading: statLoading }) => (
    <div className="bg-white p-4 rounded-lg shadow-sm flex items-center space-x-4">
      <div className="bg-sky-100 p-3 rounded-full"><Icon className="w-6 h-6 text-sky-600" /></div>
      <div><p className="text-slate-500 text-sm">{title}</p>{statLoading ? <div className="h-7 w-12 bg-slate-200 rounded-md animate-pulse mt-1" /> : <p className="text-2xl font-bold text-slate-800">{value}</p>}</div>
    </div>
  );

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


  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <div>
        <div className="flex flex-col sm:flex-row justify-between items-start mb-6">
          <div className='flex-1 mb-4 sm:mb-0'>
            <h1 className="text-2xl font-bold text-slate-800">Painel do Aluno</h1>
            <p className="text-lg text-slate-600">Bem-vindo(a) de volta, <span className="font-semibold text-sky-600">{profile?.full_name || user?.email}</span>!</p>
          </div>
          <div className="flex items-center gap-4">
            <NextClassWidget nextClass={nextClass} />
          </div>
        </div>

        {/* Banner de Plano Expirando */}
        <PlanExpiringBanner userId={user?.id} />

        {/* Widget de Mensagens do Professor */}
        <StudentMessagesWidget />

        <Tabs defaultValue="agenda" className="w-full mt-8">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 bg-slate-200">
            {/* Abas dinâmicas baseadas em permissões */}
            {(() => {
              const allowedTabs = roleSettings?.permissions?.tabs || ['dashboard', 'clases', 'chat', 'desempenho', 'faturas'];
              const tabsDef = [
                { id: 'agenda', value: 'agenda', permission: 'dashboard', icon: Package, label: 'Agenda' },
                { id: 'aulas', value: 'aulas', permission: 'clases', icon: BookOpen, label: 'Aulas' },
                { id: 'conversas', value: 'conversas', permission: 'chat', icon: MessageIcon, label: 'Conversas' },
                { id: 'desempenho', value: 'desempenho', permission: 'desempenho', icon: BarChart3, label: 'Desempenho' },
                { id: 'faturas', value: 'faturas', permission: 'faturas', icon: FileText, label: 'Faturas' },
              ];

              return tabsDef.filter(t => allowedTabs.includes(t.permission)).map(tab => (
                <TabsTrigger key={tab.id} value={tab.value}>
                  <tab.icon className="mr-2 h-4 w-4 hidden sm:block" />
                  {tab.label}
                </TabsTrigger>
              ));
            })()}
          </TabsList>

          <TabsContent value="faturas" className="mt-4 space-y-6">
            <Alert className="border-sky-400 bg-sky-50 text-sky-900 [&>svg]:text-sky-600">
              <Sparkles className="h-4 w-4" />
              <AlertTitle className="font-bold">Dica de Ouro!</AlertTitle>
              <AlertDescription>
                Sabia que você pode reagendar aulas perdidas? Converse com seu professor e aproveite ao máximo seu pacote, sempre dentro dos 30 dias de validade. Flexibilidade é a chave para o sucesso!
              </AlertDescription>
            </Alert>
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h2 className="text-xl font-bold mb-4">Contratos Ativos</h2>
              {loading ? <p>Carregando...</p> : activeBillings.length > 0 ? activeBillings.map(billing => (
                <div key={billing.id} className="p-4 border rounded-lg bg-sky-50 border-sky-200 mb-4">
                  <p className="text-lg font-semibold">{billing.packages?.name} ({billing.packages?.number_of_classes} aulas/mês)</p>
                  <p className="text-sm text-slate-600">Preço: <span className="font-semibold">R$ {billing.amount_paid}</span></p>
                  <p className="text-sm text-slate-600">Comprado em: {format(parseISO(billing.purchase_date), 'PPP', { locale: ptBR })} | Válido até: <span className="font-semibold">{format(parseISO(billing.end_date), 'PPP', { locale: ptBR })}</span></p>
                </div>
              )) : <p className="text-slate-500">Nenhum contrato ativo.</p>}
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h2 className="text-xl font-bold mb-4">Histórico de Faturas</h2>
              <div className="border rounded-lg overflow-hidden">{loading ? <p className="p-4">Carregando...</p> : pastBillings.length > 0 ? <Table><TableHeader className="bg-slate-50"><TableRow><TableHead>Pacote</TableHead><TableHead>Data da Compra</TableHead><TableHead>Data de Expiração</TableHead></TableRow></TableHeader><TableBody>{pastBillings.map(b => (<TableRow key={b.id}><TableCell>{b.packages.name}</TableCell><TableCell>{format(parseISO(b.purchase_date), 'PPP', { locale: ptBR })}</TableCell><TableCell>{format(parseISO(b.end_date), 'PPP', { locale: ptBR })}</TableCell></TableRow>))}</TableBody></Table> : <p className="p-8 text-center text-slate-500">Nenhum histórico encontrado.</p>}</div>
            </div>

          </TabsContent>

          <TabsContent value="agenda" className="mt-4 space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {/* Card Aulas Disponíveis OCULTO conforme solicitação */}
              {/* <StatCard title="Aulas Disponíveis" value={classStats.available} icon={CalendarPlus} loading={loading} /> */}
              <StatCard title="Aulas Pendentes" value={classStats.pending} icon={Clock3} loading={loading} />
              <StatCard title="Aulas Agendadas" value={classStats.scheduled} icon={CalendarClock} loading={loading} />
              <StatCard title="Aulas Realizadas" value={classStats.completed} icon={CalendarCheck} loading={loading} />
            </div>

            {/* BLOCO DE AGENDAMENTO PONTUAL OCULTO conforme solicitação */}
            {/* A funcionalidade de agendamento pontual foi removida da interface do aluno */}

            {/* BLOCO DE AGENDAMENTO SEMANAL OCULTO conforme solicitação */}
            {/* A funcionalidade de agendamento semanal foi removida da interface do aluno */}
          </TabsContent>
          <TabsContent value="aulas" className="mt-4 space-y-6 bg-white p-6 rounded-lg shadow-sm">
            <h2 className="text-xl font-bold mb-4">Minhas Aulas</h2>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Hora</TableHead>
                    <TableHead>Duração</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Material</TableHead>
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
          </TabsContent>

          <TabsContent value="conversas" className="mt-4">
            <div className="bg-white rounded-lg shadow-sm flex flex-col h-[600px] border overflow-hidden">
              <header className="p-4 border-b bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-sky-100 flex items-center justify-center text-sky-600">
                    <User className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-bold">Chat com Professor</h3>
                    <p className="text-xs text-slate-500">Tire suas dúvidas em tempo real</p>
                  </div>
                </div>
              </header>

              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
                {chatLoading ? (
                  <div className="flex justify-center items-center h-full"><Loader2 className="w-8 h-8 animate-spin text-sky-600" /></div>
                ) : chatMessages.length > 0 ? (
                  chatMessages.map((msg, idx) => {
                    const isMe = msg.remitente_id === user.id;
                    return (
                      <div key={msg.mensaje_id || idx} className={cn("flex", isMe ? "justify-end" : "justify-start")}>
                        <div className={cn("max-w-[80%] rounded-2xl px-4 py-2 shadow-sm", isMe ? "bg-sky-600 text-white rounded-tr-none" : "bg-white text-slate-800 rounded-tl-none border")}>
                          <p className="text-sm">{msg.contenido}</p>
                          <p className={cn("text-[10px] mt-1 text-right", isMe ? "text-sky-100" : "text-slate-400")}>
                            {format(parseISO(msg.enviado_en), 'HH:mm')}
                          </p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400">
                    <MessageCircle className="h-12 w-12 mb-2 opacity-20" />
                    <p>Inicie uma conversa com seu professor!</p>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <form onSubmit={handleSendMessage} className="p-4 border-t bg-white flex gap-2">
                <input
                  value={newChatMessage}
                  onChange={(e) => setNewChatMessage(e.target.value)}
                  placeholder="Escreva sua mensagem..."
                  className="flex-1 bg-slate-100 border-none rounded-full px-4 py-2 text-sm focus:ring-2 focus:ring-sky-500 outline-none"
                  disabled={isSendingMessage}
                />
                <Button type="submit" size="icon" className="rounded-full bg-sky-600 h-10 w-10 shrink-0" disabled={isSendingMessage || !newChatMessage.trim()}>
                  {isSendingMessage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </form>
            </div>
          </TabsContent>

          <TabsContent value="desempenho" className="mt-4 space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h2 className="text-xl font-bold mb-6">Meu Desempenho</h2>
              {!performanceStats ? (
                <div className="text-center py-12 text-slate-500">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>Ainda não há avaliações disponíveis para gerar seu dashboard.</p>
                  <p className="text-sm">As notas aparecerão aqui após suas aulas serem avaliadas pelo professor.</p>
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
          </TabsContent>
        </Tabs>

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
