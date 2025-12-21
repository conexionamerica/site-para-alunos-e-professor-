import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
import { FileText, Package, BookOpen, CalendarCheck, CalendarClock, CalendarPlus, Send, Loader2, Info, CheckCircle2, Clock3, Sparkles, RotateCcw } from 'lucide-react';
import NotificationsWidget from '@/components/NotificationsWidget';
import StudentMessagesWidget from '@/components/StudentMessagesWidget';

// IMPORTACIONES NECESSÁRIAS, AHORA CON DialogDescription
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


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
        <a href="https://meet.google.com/tmi-xwmg-kua" target="_blank" rel="noopener noreferrer">Iniciar Agora</a>
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

      const [appointmentsRes, activeBillingsRes, pastBillingsRes, assignedLogsRes, pendingReqRes, nextClassRes] = await Promise.all([
        supabase.from('appointments').select('*').eq('student_id', user.id).order('class_datetime', { ascending: false }),
        supabase.from('billing').select(`*, packages ( * )`).eq('user_id', user.id).gte('end_date', today.split('T')[0]).order('purchase_date', { ascending: false }),
        supabase.from('billing').select(`*, packages ( * )`).eq('user_id', user.id).lt('end_date', today.split('T')[0]).order('purchase_date', { ascending: false }),
        supabase.from('assigned_packages_log').select('assigned_classes, package_id, status').eq('student_id', user.id), // Fetch status here
        supabase.from('solicitudes_clase').select('solicitud_id, is_recurring').eq('alumno_id', user.id).eq('status', 'Pendiente').maybeSingle(),
        supabase.from('appointments').select(`*, student:profiles!student_id(full_name, spanish_level)`).eq('student_id', user.id).eq('status', 'scheduled').gte('class_datetime', today).order('class_datetime', { ascending: true }).limit(1).maybeSingle(),
      ]);

      const errors = [appointmentsRes.error, activeBillingsRes.error, pastBillingsRes.error, assignedLogsRes.error, pendingReqRes.error, nextClassRes.error].filter(Boolean).filter(e => e.code !== 'PGRST116');
      if (errors.length) throw new Error(errors.map(e => e.message).join(', '));

      const appointmentsData = appointmentsRes.data || [];
      setAppointments(appointmentsData);
      setNextClass(nextClassRes.data);

      const activeBillingsData = activeBillingsRes.data || [];
      const assignedLogsData = assignedLogsRes.data || [];
      setActiveBillings(activeBillingsData);
      setPastBillings(pastBillingsRes.data || []);

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
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [fetchData, user, professorId]);


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
            const startTimeObj = parse(startTime, 'HH:mm:ss', new Date());

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

        {/* Widget de Mensagens do Professor */}
        <StudentMessagesWidget />

        <Tabs defaultValue="agenda" className="w-full mt-8">
          <TabsList className="grid w-full grid-cols-3 bg-slate-200">
            <TabsTrigger value="faturas"><FileText className="mr-2 h-4 w-4 hidden sm:block" />Faturas</TabsTrigger>
            <TabsTrigger value="agenda"><Package className="mr-2 h-4 w-4 hidden sm:block" />Agenda</TabsTrigger>
            <TabsTrigger value="aulas"><BookOpen className="mr-2 h-4 w-4 hidden sm:block" />Aulas</TabsTrigger>
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard title="Aulas Disponíveis" value={classStats.available} icon={CalendarPlus} loading={loading} />
              <StatCard title="Aulas Pendentes" value={classStats.pending} icon={Clock3} loading={loading} />
              <StatCard title="Aulas Agendadas" value={classStats.scheduled} icon={CalendarClock} loading={loading} />
              <StatCard title="Aulas Realizadas" value={classStats.completed} icon={CalendarCheck} loading={loading} />
            </div>

            {/* BLOQUEO PARA AGENDAMIENTO PONTUAL */}
            {classStats.rescheduledCount > 0 && classStats.available > 0 && (
              <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-lg shadow-sm">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <RotateCcw className="h-6 w-6 text-yellow-600" />
                  Agendar Aula Pontual ({classStats.rescheduledCount} Crédito{classStats.rescheduledCount > 1 ? 's' : ''})
                </h2>
                <p className="text-slate-700 mb-4">
                  Você tem **{classStats.rescheduledCount} crédito(s)** disponível(is) de aulas reagendadas. Escolha uma data e horário específicos.
                </p>
                <Dialog open={isSingleScheduleOpen} onOpenChange={setIsSingleScheduleOpen}>
                  <DialogTrigger asChild>
                    <Button
                      variant="default"
                      className="bg-yellow-600 hover:bg-yellow-700 text-white"
                      disabled={classStats.pending > 0}
                    >
                      Agendar Aula Pontual
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle>Agendar Aula Pontual</DialogTitle>
                      <DialogDescription>Selecione a data e o horário.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <Calendar
                        mode="single"
                        selected={singleSelectedDate}
                        onSelect={(date) => {
                          setSingleSelectedDate(date);
                          setSingleSelectedTime(null);
                        }}
                        locale={ptBR}
                        className="rounded-md border shadow"
                      />
                      <Select onValueChange={setSingleSelectedTime} value={singleSelectedTime || ''}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um horário" />
                        </SelectTrigger>
                        <SelectContent>
                          {/* Horários a cada 30 minutos (início de cada hora) */}
                          {ALL_TIMES.filter((_, i) => i % 2 === 0).map(time => (
                            <SelectItem key={time} value={time.substring(0, 5) + ':00'}>
                              {time.substring(0, 5)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <DialogFooter>
                      <Button onClick={handleSingleScheduleSubmit} disabled={isSubmitting || !singleSelectedDate || !singleSelectedTime}>
                        {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando...</> : 'Enviar Pedido de Aula'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            )}
            {/* FIN DEL BLOQUEO PARA AGENDAMIENTO PONTUAL */}

            <div className="p-6 bg-white rounded-lg shadow-sm">
              <AnimatePresence mode="wait">
                {schedulingStep === 1 && (
                  <motion.div key="step1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <h2 className="text-xl font-bold mb-4">Agendar Minhas Aulas Semanais</h2>
                    <Alert><Info className="h-4 w-4" /><AlertTitle>Como funciona?</AlertTitle><AlertDescription>Escolha um horário fixo e os dias da semana para suas aulas. Esta seleção será enviada ao professor para aprovação e se repetirá durante a validade do seu pacote.</AlertDescription></Alert>
                    <div className="mt-6 flex justify-center">
                      <Button
                        onClick={handleStartScheduling}
                        disabled={loadingSlots || classStats.available <= 0 || classStats.pending > 0 || !latestActiveBilling}
                      >
                        {classStats.pending > 0 ? 'Aguardando Aprovação...' : (loadingSlots ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando...</> : 'Começar Agendamento')}
                      </Button>
                    </div>
                    {classStats.pending > 0 && (
                      <Alert className="mt-4 border-sky-400 bg-sky-50 text-sky-800 [&>svg]:text-sky-600">
                        <Clock3 className="h-4 w-4" />
                        <AlertTitle>Solicitação em Análise</AlertTitle>
                        <AlertDescription>Seu pedido de agendamento de **{classesPerWeek} aulas** está sendo analisado pelo professor. Você não poderá fazer um novo agendamento até que este seja aprovado ou rejeitado.</AlertDescription>
                      </Alert>
                    )}
                  </motion.div>
                )}
                {schedulingStep === 2 && (
                  <motion.div key="step2" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}>
                    <div className="flex justify-between items-center mb-4"><h2 className="text-xl font-bold">Passo 2: Escolha os dias e o horário</h2><Button variant="outline" onClick={() => { setSchedulingStep(1); setSelectedTime(null); setSelectedDays([]); }}>Voltar</Button></div>
                    {loadingSlots ? <div className="flex justify-center items-center h-48"><Loader2 className="w-8 h-8 animate-spin" /></div> : (
                      <div className="space-y-6">
                        <div>
                          <h3 className="font-semibold text-lg mb-2">1. Selecione {classesPerWeek} dias da semana</h3>
                          <div className="flex flex-wrap justify-center gap-2">
                            {Object.keys(daysOfWeekMap).map(dayIndex => {
                              const day = parseInt(dayIndex);
                              const isDayAvailableAtAnyTime = allAvailableSlots.some(slot => slot.day_of_week === day && slot.status === 'active');
                              return (
                                <Button key={day} variant={selectedDays.includes(day) ? 'default' : 'outline'} onClick={() => handleDaySelection(day)} disabled={!isDayAvailableAtAnyTime} className={cn("transition-all", selectedDays.includes(day) && "bg-sky-600 hover:bg-sky-700 ring-2 ring-sky-500 ring-offset-2", !isDayAvailableAtAnyTime && "bg-slate-100 text-slate-400 cursor-not-allowed")}>
                                  {daysOfWeekMap[day]}
                                </Button>
                              );
                            })}
                          </div>
                        </div>
                        {selectedDays.length > 0 && (
                          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                            <h3 className="font-semibold text-lg mb-2">2. Selecione um horário</h3>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-72 overflow-y-auto rounded-lg border p-3 bg-slate-50/50">
                              {availableTimesForSelectedDays.length > 0 ? (
                                availableTimesForSelectedDays.map(time => (
                                  <button
                                    key={time}
                                    onClick={() => setSelectedTime(time)}
                                    className={cn(
                                      "flex items-center justify-between p-2 rounded-md border text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                      selectedTime === time ? "bg-sky-600 text-white border-sky-700 shadow-md" : "bg-white hover:bg-slate-100"
                                    )}
                                  >
                                    <span className={cn(selectedTime === time ? "text-white" : "text-slate-700")}>{time.substring(0, 5)}</span>
                                    {selectedTime === time && <CheckCircle2 className="h-5 w-5 text-white" />}
                                  </button>
                                ))
                              ) : (
                                <p className="col-span-full text-center text-slate-500 py-8">Nenhum horário comum disponível para os dias selecionados.</p>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </div>
                    )}
                    <div className="mt-6 flex justify-end">
                      <Button onClick={handleSubmitRequest} disabled={isSubmitting || (selectedDays.length > 0 && selectedDays.length !== classesPerWeek) || !selectedTime}>
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                        Enviar Solicitação
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </TabsContent>
          <TabsContent value="aulas" className="mt-4 space-y-6 bg-white p-6 rounded-lg shadow-sm">
            <h2 className="text-xl font-bold mb-4">Histórico de Aulas</h2>
            <div className="border rounded-lg overflow-hidden"><Table><TableHeader className="bg-slate-50"><TableRow><TableHead>Data</TableHead><TableHead>Hora</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{loading ? <TableRow><TableCell colSpan="3" className="text-center">Carregando...</TableCell></TableRow> : appointments.length > 0 ? appointments.map(apt => (<TableRow key={apt.id}><TableCell>{format(parseISO(apt.class_datetime), 'PPP', { locale: ptBR })}</TableCell><TableCell>{format(parseISO(apt.class_datetime), 'HH:mm')}</TableCell><TableCell><StatusBadge status={apt.status} /></TableCell></TableRow>)) : <TableRow><TableCell colSpan="3" className="text-center p-8 text-slate-500">Nenhuma aula encontrada.</TableCell></TableRow>}</TableBody></Table></div>
            <div className="fixed bottom-6 right-24 z-50">
              <HelpWidget />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </motion.div>
  );
};

export default HomePage;
