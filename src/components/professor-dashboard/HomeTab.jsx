// Arquivo: src/components/professor-dashboard/HomeTab.jsx
// Modificado para incluir painel de pendências para superusuários

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { format, formatDistanceToNowStrict, parseISO, getDay, add, parse, addHours, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getBrazilDate } from '@/lib/dateUtils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Check, X, Loader2, CalendarHeart, Clock, CalendarDays, AlertTriangle, Users, BookOpen, Package, Bell, Filter, UserX, Calendar, CheckCircle, XCircle, RefreshCw, History, Eye, EyeOff, ExternalLink, UserPlus, Search, FileText, Upload, Trash2, DollarSign, Megaphone, LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { TabsContent, Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { StudentRequestsList } from '@/components/professor/StudentRequestsList';
import { ScheduleRequestsPending } from '@/components/admin/ScheduleRequestsPending';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useFormPersistence } from '@/hooks/useFormPersistence';
import { useNotifications } from '@/hooks/useNotifications';
import { Archive } from 'lucide-react';

const daysOfWeekMap = { 0: 'Dom', 1: 'Seg', 2: 'Ter', 3: 'Qua', 4: 'Qui', 5: 'Sex', 6: 'Sáb' };
const daysOfWeek = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

// Horarios disponibles (07:00 a 23:00)
const TIME_OPTIONS = [];
for (let hour = 7; hour <= 23; hour++) {
  TIME_OPTIONS.push(`${String(hour).padStart(2, '0')}:00`);
  TIME_OPTIONS.push(`${String(hour).padStart(2, '0')}:30`);
}

const HomeTab = ({ dashboardData, setActiveTab }) => {
  const { toast } = useToast();
  const [updatingRequestId, setUpdatingRequestId] = useState(null);
  const [solicitudes, setSolicitudes] = useState([]);
  const [next24Hours, setNext24Hours] = useState([]);
  const [pendenciasFilter, setPendenciasFilter] = useState('all');
  const [pendenciasData, setPendenciasData] = useState({
    studentsWithoutProfessor: [],
    studentsWithAvailableClasses: [],
    packagesExpiringSoon: [],
    recentNotifications: [],
    classHistory: [],
    systemWarnings: [],
    historicoNotifications: []
  });
  const [loadingPendencias, setLoadingPendencias] = useState(false);
  const [historico, setHistorico] = useState([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);
  const [processingAction, setProcessingAction] = useState(null);

  // Estado para modal de vinculação de professor
  const [showVincularModal, setShowVincularModal] = useState(false);
  const [selectedStudentForVinculacao, setSelectedStudentForVinculacao] = useState(null);
  const [selectedProfessorId, setSelectedProfessorId] = useState('');
  const [showEarningsModal, setShowEarningsModal] = useState(false);

  // Lógica de cálculo para My Earnings
  const appointments = dashboardData?.data?.appointments || [];
  const BASE_RATE = 6.11; // R$ 6.11 por cada 30 minutos

  const earningsStats = useMemo(() => {
    const completedClasses = appointments.filter(apt => apt.status === 'completed');
    const totalMinutes = completedClasses.reduce((sum, apt) => sum + (apt.duration_minutes || 30), 0);
    const totalUnits = totalMinutes / 30;
    const totalEarnings = totalUnits * BASE_RATE;

    const studentStats = {};
    completedClasses.forEach(apt => {
      const studentId = apt.student_id;
      const studentName = apt.student?.full_name || 'Aluno N/A';
      const duration = apt.duration_minutes || 30;

      if (!studentStats[studentId]) {
        studentStats[studentId] = {
          name: studentName,
          typicalDuration: duration,
          totalMinutes: 0,
          units: 0,
          earnings: 0,
          sessions: 0
        };
      }
      studentStats[studentId].totalMinutes += duration;
      studentStats[studentId].sessions += 1;
    });

    const groupedList = Object.values(studentStats).map(student => {
      const units = student.totalMinutes / 30;
      return {
        ...student,
        units: units,
        earnings: units * BASE_RATE
      };
    });

    return { totalEarnings, totalMinutes, totalUnits, groupedList };
  }, [appointments]);

  const formatTimeFull = (minutes) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${String(m).padStart(2, '0')}m`;
  };
  const [professorAvailability, setProfessorAvailability] = useState(null);
  const [isVinculando, setIsVinculando] = useState(false);

  // Estados para matching inteligente
  const [matchingStep, setMatchingStep] = useState(1); // 1: selecionar preferencias, 2: ver resultados
  const [studentPreferences, setStudentPreferences, clearStudentPreferences] = useFormPersistence('vincular_student_prefs', {
    days: [], // [0-6] días seleccionados
    time: '08:00' // horario preferido
  });
  const [matchedProfessors, setMatchedProfessors] = useState([]);
  const [isSearchingMatches, setIsSearchingMatches] = useState(false);

  // Estados para modal de upload de PDF
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [selectedAulaForPdf, setSelectedAulaForPdf] = useState(null);
  const [pdfMaterialName, setPdfMaterialName] = useState('');
  const [pdfFile, setPdfFile] = useState(null);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const [existingMaterials, setExistingMaterials] = useState([]);
  const [loadingMaterials, setLoadingMaterials] = useState(false);

  // Extração segura das propriedades
  const professorId = dashboardData?.professorId;
  const data = dashboardData?.data || {};
  const loading = dashboardData?.loading || false;
  const onUpdate = dashboardData?.onUpdate;
  const isSuperadmin = dashboardData?.isSuperadmin || false;

  // NOVO: Verificar qual visão deve ser exibida
  const showPainelView = dashboardData?.showPainelView || false;
  const showHomeView = dashboardData?.showHomeView || !isSuperadmin;

  // SINCRONIZAÇÃO: Usar appointments do dashboardData como fonte única
  const allAppointments = data?.appointments || [];
  const allProfiles = data?.allProfiles || [];
  const students = data?.students || [];
  const professors = data?.professors || [];
  const allBillings = data?.allBillings || [];
  const classSlots = data?.classSlots || [];

  // Buscar histórico de notificações (resolvidas/arquivadas) para o painel de pendências
  const { notifications: historyNotifications, loading: loadingHistoryNotifs } = useNotifications(professorId, {
    status: ['read', 'accepted', 'rejected', 'archived']
  });

  // CORREÇÃO: Calcular nextClass a partir dos appointments centralizados
  const nextClass = useMemo(() => {
    if (!allAppointments || allAppointments.length === 0) return null;
    const now = getBrazilDate();
    const futureClasses = allAppointments.filter(apt => {
      if (!apt.class_datetime) return false;
      const aptDate = new Date(apt.class_datetime);
      const status = apt.status;
      return aptDate >= now && ['scheduled', 'rescheduled'].includes(status);
    }).sort((a, b) => new Date(a.class_datetime) - new Date(b.class_datetime));
    return futureClasses.length > 0 ? futureClasses[0] : null;
  }, [allAppointments]);

  // CORREÇÃO: Calcular upcomingClasses a partir dos appointments centralizados
  const upcomingClasses = useMemo(() => {
    if (!allAppointments || allAppointments.length === 0) return [];
    const now = getBrazilDate();
    return allAppointments.filter(apt => {
      if (!apt.class_datetime) return false;
      const aptDate = new Date(apt.class_datetime);
      const status = apt.status;
      return aptDate >= now && ['scheduled', 'rescheduled'].includes(status);
    }).sort((a, b) => new Date(a.class_datetime) - new Date(b.class_datetime));
  }, [allAppointments]);

  // CORREÇÃO: Sincroniza as solicitações do pai
  useEffect(() => {
    if (Array.isArray(data?.scheduleRequests)) {
      setSolicitudes(data.scheduleRequests);
    } else {
      setSolicitudes([]);
    }
  }, [data?.scheduleRequests]);

  // SINCRONIZAÇÃO: Calcular as próximas 24 horas
  useEffect(() => {
    if (!allAppointments || allAppointments.length === 0) {
      setNext24Hours([]);
      return;
    }
    const now = getBrazilDate();
    const next24 = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const filtered = allAppointments.filter(apt => {
      if (!apt.class_datetime) return false;
      const aptDate = new Date(apt.class_datetime);
      const status = apt.status;
      return aptDate >= now && aptDate <= next24 && ['scheduled', 'rescheduled'].includes(status);
    }).sort((a, b) => new Date(a.class_datetime) - new Date(b.class_datetime));
    setNext24Hours(filtered);
  }, [allAppointments]);

  // ==========================================
  // NOVA LÓGICA: Carregar pendências para superusuário
  // ==========================================
  // ==========================================
  // NOVA LÓGICA: Carregar pendências para superusuário
  // ==========================================
  const loadPendencias = useCallback(async () => {
    if (!isSuperadmin) return;
    setLoadingPendencias(true);
    try {
      const today = getBrazilDate();

      // 1. Alunos sem professor vinculado
      const studentsWithoutProf = students.filter(s =>
        s.is_active !== false && !s.assigned_professor_id
      );

      // 2. ABA AULAS: Histórico Geral de Aulas (limitado a 50 ou 100 mais recentes)
      // Buscamos appointments com status 'completed', 'missed', 'rescheduled'
      const { data: classHistoryData, error: classHistError } = await supabase
        .from('appointments')
        .select(`
            *,
            student:profiles!student_id(full_name),
            professor:profiles!professor_id(full_name)
          `)
        .in('status', ['completed', 'missed', 'rescheduled'])
        .order('class_datetime', { ascending: false })
        .limit(50);

      if (classHistError) console.error("Erro classHistory:", classHistError);

      // 3. ABA AVISOS: Erros do Sistema (tabela admin_notifications)
      const { data: systemWarningsData, error: warnError } = await supabase
        .from('admin_notifications')
        .select('*')
        .in('type', ['error', 'alert', 'system_failure'])
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (warnError) console.error("Erro warnings:", warnError);

      // 4. ABA VENCENDO: Pacotes expirando em 5 dias (Excluir os já "Vistos")
      // Primeiro buscamos os IDs de notificações 'expiry_seen' para filtrar
      const { data: seenExpiryNotifs } = await supabase
        .from('admin_notifications')
        .select('details')
        .eq('type', 'expiry_seen');

      const seenBillingIds = new Set();
      seenExpiryNotifs?.forEach(n => {
        if (n.details?.billing_id) seenBillingIds.add(n.details.billing_id);
      });

      const expiringPackages = [];
      for (const billing of allBillings) {
        const endDate = new Date(billing.end_date);
        const daysUntilExpiry = differenceInDays(endDate, today);

        if (daysUntilExpiry >= 0 && daysUntilExpiry <= 5) {
          // Se já foi marcado como visto, ignora
          if (seenBillingIds.has(billing.id)) continue;

          const student = students.find(s => s.id === billing.user_id);
          if (student && student.is_active !== false) {
            expiringPackages.push({
              student,
              billing,
              daysUntilExpiry,
              packageName: billing.packages?.name || 'Pacote'
            });
          }
        }
      }

      // 5. ABA HISTÓRICO: Busca geral de notificações resolvidas/vistas
      // Inclui: assignment_resolved, expiry_seen, warning_seen, etc.
      const { data: historyData, error: histError } = await supabase
        .from('admin_notifications')
        .select('*')
        .in('status', ['seen', 'resolved', 'archived'])
        .order('resolved_at', { ascending: false, nullsFirst: false }) // ou created_at desc
        .limit(50);

      if (histError) console.error("Erro history:", histError);

      setPendenciasData({
        studentsWithoutProfessor: studentsWithoutProf,
        classHistory: classHistoryData || [],
        systemWarnings: systemWarningsData || [],
        packagesExpiringSoon: expiringPackages.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry),
        historicoNotifications: historyData || []
      });

    } catch (error) {
      console.error('Erro ao carregar pendências:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar pendências',
        description: error.message
      });
    } finally {
      setLoadingPendencias(false);
    }
  }, [isSuperadmin, students, allBillings, allAppointments, classSlots, toast]);

  useEffect(() => {
    loadPendencias();
  }, [loadPendencias]);

  // Contar totais de pendências
  const pendenciasCounts = useMemo(() => ({
    withoutProfessor: pendenciasData.studentsWithoutProfessor.length,
    // withClasses: agora é Histórico (Aulas), não conta como pendência ativa "a resolver", mas pode exibir total
    classHistory: pendenciasData.classHistory?.length || 0,
    expiring: pendenciasData.packagesExpiringSoon.length,
    warnings: pendenciasData.systemWarnings?.length || 0,
    historico: pendenciasData.historicoNotifications?.length || 0,
    total: pendenciasData.studentsWithoutProfessor.length +
      pendenciasData.packagesExpiringSoon.length +
      (pendenciasData.systemWarnings?.length || 0)
  }), [pendenciasData]);

  // Handle Mark as Seen / Resolve
  const handleMarkAsSeen = async (type, item) => {
    setProcessingAction(`seen-${type}-${item.id || item.billing?.id}`);
    try {
      if (type === 'expiring') {
        // Insert notification as 'seen'
        const { error } = await supabase.from('admin_notifications').insert({
          type: 'expiry_seen',
          title: 'Alerta de Vencimento Visto',
          message: `Pacote de ${item.student.full_name} vencendo em ${item.daysUntilExpiry} dias.`,
          details: { billing_id: item.billing.id, student_id: item.student.id },
          student_id: item.student.id,
          status: 'seen',
          resolved_at: new Date().toISOString()
        });
        if (error) throw error;

        setPendenciasData(prev => ({
          ...prev,
          packagesExpiringSoon: prev.packagesExpiringSoon.filter(p => p.billing.id !== item.billing.id)
        }));
      } else if (type === 'warning') {
        // Update existing notification
        const { error } = await supabase.from('admin_notifications')
          .update({ status: 'seen', resolved_at: new Date().toISOString() })
          .eq('id', item.id);
        if (error) throw error;

        setPendenciasData(prev => ({
          ...prev,
          systemWarnings: prev.systemWarnings.filter(w => w.id !== item.id)
        }));
      }

      toast({ title: 'Marcado como visto', description: 'Item movido para o Histórico.' });
      // Opcional: recarregar pendências ou injetar no histórico local
      // loadPendencias();
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Erro ao marcar como visto' });
    } finally {
      setProcessingAction(null);
    }
  };

  // Funções legadas removidas (handleRestaurar, handleLimpar) pois agora usamos banco.


  // Restaurar uma pendência do histórico
  const handleRestaurarPendencia = (pendencia) => {
    const novoHistorico = historico.filter(h => h.id !== pendencia.id);
    saveHistorico(novoHistorico);

    toast({
      title: 'Pendência restaurada',
      description: 'A pendência reaparecerá na próxima atualização.',
    });

    onUpdate?.();
  };

  // Limpar todo o histórico
  const handleLimparHistorico = () => {
    saveHistorico([]);
    toast({
      title: 'Histórico limpo',
      description: 'Todas as pendências ignoradas foram removidas.',
    });
  };

  // Abrir modal para vincular professor a um aluno
  const handleOpenVincularModal = (student) => {
    // Tenta carregar preferências do perfil do aluno
    let profilePrefs = student.preferred_schedule || {};

    // Se o perfil não tem agenda definida, deduzimos dos agendamentos (igual AlunosTab)
    // Isso garante que pendências geradas sem professor apareçam como base para o match
    const studentApts = allAppointments.filter(apt =>
      apt.student_id === student.id &&
      ['scheduled', 'rescheduled', 'pending'].includes(apt.status) &&
      new Date(apt.class_datetime) >= getBrazilDate()
    );

    if (studentApts.length > 0) {
      const deducedPrefs = { ...profilePrefs };
      studentApts.forEach(apt => {
        const aptDate = parseISO(apt.class_datetime);
        const dayOfWeek = getDay(aptDate);
        const time = format(aptDate, 'HH:mm');
        if (!deducedPrefs[dayOfWeek]) {
          deducedPrefs[dayOfWeek] = time;
        }
      });
      profilePrefs = deducedPrefs;
    }

    const updatedStudent = { ...student, preferred_schedule: profilePrefs };
    setSelectedStudentForVinculacao(updatedStudent);
    setSelectedProfessorId('');
    setProfessorAvailability(null);
    setMatchingStep(1);

    const daysFromProfile = Object.keys(profilePrefs).map(Number).sort((a, b) => a - b);
    const firstDay = daysFromProfile[0];
    const initialTime = firstDay !== undefined ? profilePrefs[firstDay] : '08:00';

    setStudentPreferences({
      days: daysFromProfile,
      time: initialTime
    });
    setMatchedProfessors([]);
    setShowVincularModal(true);
  };


  // Buscar professores compatíveis com as preferências do aluno
  const handleSearchCompatibleProfessors = async () => {
    let preferredSchedule = {};

    // Usamos prioritariamente os dias selecionados no Step 1 do modal
    studentPreferences.days.forEach(d => {
      // Se o aluno já tiver um horário específico para este dia no perfil/agendamentos, usamos ele.
      // Caso contrário, usamos o horário selecionado no dropdown do modal.
      if (selectedStudentForVinculacao?.preferred_schedule && selectedStudentForVinculacao.preferred_schedule[d]) {
        preferredSchedule[d] = selectedStudentForVinculacao.preferred_schedule[d];
      } else {
        preferredSchedule[d] = studentPreferences.time;
      }
    });

    const preferredDays = Object.keys(preferredSchedule).map(Number);

    if (preferredDays.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Sem preferências',
        description: 'Defina os dias/horários preferidos do aluno no perfil ou selecione os dias abaixo.'
      });
      return;
    }

    setIsSearchingMatches(true);

    try {
      // Buscar slots de todos os professores nos dias de interesse
      const { data: allSlots, error } = await supabase
        .from('class_slots')
        .select('*, professor:professor_id(id, full_name)')
        .eq('status', 'active')
        .in('day_of_week', preferredDays);

      if (error) throw error;

      // Agrupar por professor e calcular compatibilidade real por dia/hora
      const professorMatches = {};
      const professorIds = [...new Set((allSlots || []).map(s => s.professor_id))];

      // BUSCAR APPOINTMENTS EXISTENTES (Próximos 7 dias) para verificar conflitos reais
      const today = getBrazilDate();
      const nextWeek = add(today, { days: 7 });

      const { data: busyApps } = await supabase
        .from('appointments')
        .select('professor_id, class_datetime, duration_minutes')
        .in('professor_id', professorIds)
        .gte('class_datetime', today.toISOString())
        .lte('class_datetime', nextWeek.toISOString())
        .neq('status', 'cancelled');

      const busyAppointments = busyApps || [];

      (allSlots || []).forEach(slot => {
        const profId = slot.professor_id;
        const targetTime = preferredSchedule[slot.day_of_week]; // "HH:mm"

        // VERIFICAÇÃO DE EXATIDÃO ROBUSTA (Comparação numérica de horas/minutos)
        const [slotH, slotM] = slot.start_time.split(':').map(Number);
        const [targetH, targetM] = targetTime.split(':').map(Number);

        if (slotH === targetH && slotM === targetM) {
          // VERIFICAÇÃO DE CONFLITO COM AGENDA REAL
          // Calcula a data específica desse slot na próxima semana para checar colisão
          const slotDayIndex = slot.day_of_week;
          const currentDayIndex = getDay(today);
          let daysUntilSlot = slotDayIndex - currentDayIndex;
          if (daysUntilSlot < 0) daysUntilSlot += 7;

          // Data exata do slot nesta semana (para referência, mas validação será por Dia da Semana + Minutos)
          const slotDate = add(today, { days: daysUntilSlot });

          // Verificar se existe appointment colidindo (Lógica Simplificada: Dia da Semana + Intervalo de Minutos)
          // Isso evita erros de timezone/data específica ao criar objetos Date manuais
          const hasConflict = busyAppointments.some(apt => {
            if (apt.professor_id !== profId) return false;

            const aptDate = parseISO(apt.class_datetime);
            const aptDayIndex = getDay(aptDate); // 0-6

            // Se não é no mesmo dia da semana, não há conflito
            if (aptDayIndex !== slotDayIndex) return false;

            // Converter tudo para minutos usando o fuso horário correto (Brasília)
            // Isso evita que o navegador em UTC ou outro fuso calcule as horas erradas (ex: 14:00 virando 17:00 ou 11:00)
            const brazilTimeStr = aptDate.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour12: false });
            const [aptH, aptM] = brazilTimeStr.split(':').map(Number);

            const aptStartMinutes = aptH * 60 + aptM;
            const aptDuration = apt.duration_minutes || 30;
            const aptEndMinutes = aptStartMinutes + aptDuration;

            const slotStartMinutes = slotH * 60 + slotM;
            const slotEndMinutes = slotStartMinutes + 30; // Assumindo 30min slot

            // Interseção de horários simples
            return (slotStartMinutes < aptEndMinutes && slotEndMinutes > aptStartMinutes);
          });

          if (!hasConflict) {
            if (!professorMatches[profId]) {
              professorMatches[profId] = {
                professor: slot.professor,
                matchedDays: new Set(),
                matchedSlots: [],
                totalDaysRequested: preferredDays.length
              };
            }
            // Só adiciona se ainda não tiver adicionado este dia (para evitar duplicidade se tiver 2 slots próximos)
            if (!professorMatches[profId].matchedDays.has(slot.day_of_week)) {
              professorMatches[profId].matchedDays.add(slot.day_of_week);
              professorMatches[profId].matchedSlots.push(slot);
            }
          }
        }
      });

      // Calcular porcentagem e ordenar
      const matchResults = Object.values(professorMatches)
        .map(match => ({
          ...match,
          matchedDaysCount: match.matchedDays.size,
          matchPercentage: Math.round((match.matchedDays.size / match.totalDaysRequested) * 100)
        }))
        .filter(match => match.matchPercentage > 0) // MOSTRAR TODOS QUE TÊM ALGUMA DISPONIBILIDADE (> 0%)
        .sort((a, b) => b.matchPercentage - a.matchPercentage);

      setMatchedProfessors(matchResults);
      setMatchingStep(2);

      if (matchResults.length === 0) {
        toast({
          variant: 'destructive',
          title: 'Nenhum professor disponível',
          description: `Nenhum professor possui horários próximos aos desejados.`
        });
      }

    } catch (error) {
      console.error('Erro ao buscar professores:', error);
      toast({ variant: 'destructive', title: 'Erro ao buscar', description: error.message });
    } finally {
      setIsSearchingMatches(false);
    }
  };


  // Toggle día de preferencia
  const togglePreferenceDay = (dayIndex) => {
    setStudentPreferences(prev => ({
      ...prev,
      days: prev.days.includes(dayIndex)
        ? prev.days.filter(d => d !== dayIndex)
        : [...prev.days, dayIndex].sort((a, b) => a - b)
    }));
  };

  // Verificar disponibilidade do professor selecionado e carregar agenda
  const checkProfessorAvailabilityForModal = async (profId) => {
    if (!profId) {
      setProfessorAvailability(null);
      return;
    }

    try {
      const { data: slots, error } = await supabase
        .from('class_slots')
        .select('*')
        .eq('professor_id', profId)
        .order('day_of_week', { ascending: true })
        .order('start_time', { ascending: true });

      if (error) throw error;

      const allSlots = slots || [];
      const activeSlots = allSlots.filter(s => s.status === 'active');
      const filledSlots = allSlots.filter(s => s.status === 'filled');

      // Organizar slots por día da semana
      const slotsByDay = {};
      daysOfWeek.forEach((day, index) => {
        slotsByDay[index] = {
          name: day,
          active: activeSlots.filter(s => s.day_of_week === index),
          filled: filledSlots.filter(s => s.day_of_week === index),
          total: allSlots.filter(s => s.day_of_week === index)
        };
      });

      const daysCovered = [...new Set(activeSlots.map(s => s.day_of_week))];
      const dayNames = daysCovered.map(d => daysOfWeek[d]).join(', ');

      setProfessorAvailability({
        totalSlots: activeSlots.length,
        filledSlots: filledSlots.length,
        daysCovered: dayNames,
        hasAvailability: activeSlots.length > 0,
        slotsByDay
      });
    } catch (error) {
      console.error('Erro ao verificar disponibilidade:', error);
      setProfessorAvailability(null);
    }
  };

  // Efeito para verificar disponibilidade quando professor é selecionado
  useEffect(() => {
    if (selectedProfessorId) {
      checkProfessorAvailabilityForModal(selectedProfessorId);
    }
  }, [selectedProfessorId]);

  // Enviar solicitud de vinculación al profesor (el profesor debe aceptar)
  const handleVincularProfessor = async () => {
    if (!selectedStudentForVinculacao || !selectedProfessorId) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Selecione um professor para vincular.'
      });
      return;
    }

    setIsVinculando(true);

    try {
      // Buscar dados do professor
      const selectedProf = professors.find(p => p.id === selectedProfessorId);
      const oldProfessorId = selectedStudentForVinculacao.assigned_professor_id;
      const oldProfessorName = professors.find(p => p.id === oldProfessorId)?.full_name;

      // Converter preferências para o formato do banco de dados (object { dayIndex: time })
      const preferredScheduleObj = {};
      studentPreferences.days.forEach(d => {
        preferredScheduleObj[d] = studentPreferences.time;
      });

      // 1. Atualizar o perfil do aluno: 
      //    - Remove o vínculo atual (assigned_professor_id = NULL)
      //    - Define o professor pendente de aprovação
      //    - Salva as preferências de horário
      const { data: updateData, error: updateError } = await supabase
        .from('profiles')
        .update({
          assigned_professor_id: null, // Remove vínculo atual
          pending_professor_id: selectedProfessorId, // Professor aguardando aprovação
          pending_professor_status: 'aguardando_aprovacao',
          pending_professor_requested_at: new Date().toISOString(),
          preferred_schedule: preferredScheduleObj
        })
        .eq('id', selectedStudentForVinculacao.id)
        .select();

      if (updateError || !updateData || updateData.length === 0) {
        throw updateError || new Error('Falha ao atualizar perfil do aluno.');
      }

      // 2. Criar solicitação na tabela solicitudes_clase (usando a mesma estrutura existente)
      //    Tipo: 'vinculacao' será identificado no campo horarios_propuestos
      const solicitacaoData = {
        type: 'vinculacao', // Tipo especial para identificar solicitação de vinculação
        is_recurring: false,
        student_name: selectedStudentForVinculacao.full_name,
        old_professor_id: oldProfessorId,
        old_professor_name: oldProfessorName,
        preferred_schedule: preferredScheduleObj,
        days: studentPreferences.days,
        time: studentPreferences.time
      };

      const { error: solicitacaoError } = await supabase.from('solicitudes_clase').insert({
        alumno_id: selectedStudentForVinculacao.id,
        profesor_id: selectedProfessorId,
        horarios_propuestos: JSON.stringify(solicitacaoData),
        status: 'Pendiente',
        is_recurring: false
      });

      if (solicitacaoError) throw solicitacaoError;

      // 3. Atualizar a lista de pendências para refletir o novo status
      setPendenciasData(prev => ({
        ...prev,
        studentsWithoutProfessor: prev.studentsWithoutProfessor.map(s =>
          s.id === selectedStudentForVinculacao.id
            ? { ...s, pending_professor_id: selectedProfessorId, pending_professor_status: 'aguardando_aprovacao' }
            : s
        )
      }));

      // 4. Fechar modal e mostrar confirmação
      setShowVincularModal(false);
      setSelectedStudentForVinculacao(null);
      setSelectedProfessorId('');
      setProfessorAvailability(null);
      setMatchingStep(1);
      clearStudentPreferences();
      setMatchedProfessors([]);

      // Log para histórico (Admin Notifications)
      await supabase.from('admin_notifications').insert({
        type: 'assignment_resolved',
        message: `Vínculo solicitado: ${selectedStudentForVinculacao.full_name} -> ${selectedProf?.full_name}`,
        student_id: selectedStudentForVinculacao.id,
        professor_id: selectedProfessorId,
        status: 'resolved',
        created_at: new Date(),
        resolved_at: new Date()
      });

      toast({
        title: 'Solicitação enviada!',
        description: `Aguardando aprovação de ${selectedProf?.full_name || 'Professor'}. A solicitação aparecerá na tela inicial do professor.`,
      });

      onUpdate?.();

    } catch (error) {
      console.error('Erro ao enviar solicitação:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao enviar solicitação',
        description: error.message
      });
    } finally {
      setIsVinculando(false);
    }
  };



  const handleUpdateRequestStatus = async (solicitudId, newStatus) => {
    setUpdatingRequestId(solicitudId);
    const request = solicitudes.find(req => req.solicitud_id === solicitudId);

    if (!request) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Solicitação não encontrada.' });
      setUpdatingRequestId(null);
      return;
    }

    // Verificar se é uma solicitação de vinculação
    let solicitacaoData = null;
    try {
      solicitacaoData = JSON.parse(request.horarios_propuestos);
    } catch (e) {
      // Não é JSON válido, continua normalmente
    }

    const isVinculacaoRequest = solicitacaoData?.type === 'vinculacao';

    // 1. Atualiza o status da solicitação
    const { error: updateError } = await supabase
      .from('solicitudes_clase')
      .update({ status: newStatus })
      .eq('solicitud_id', solicitudId);

    if (updateError) {
      toast({ variant: 'destructive', title: 'Erro ao atualizar', description: updateError.message });
      setUpdatingRequestId(null);
      return;
    }

    // TRATAMENTO ESPECIAL PARA SOLICITAÇÃO DE VINCULAÇÃO
    if (isVinculacaoRequest) {
      const studentId = request.alumno_id;

      if (newStatus === 'Aceita') {
        try {
          // Aprovar: Formalizar o vínculo com o professor
          const { error: vinculoError } = await supabase
            .from('profiles')
            .update({
              assigned_professor_id: professorId, // Vincula ao professor que aprovou
              pending_professor_id: null, // Limpa o professor pendente
              pending_professor_status: null,
              pending_professor_requested_at: null
            })
            .eq('id', studentId);
          if (vinculoError) throw vinculoError;

          // USAR RPC PARA TRANSFERÊNCIA SEGURA DE DADOS (APPOINTMENTS, LOGS, PROFILE)
          // RPC v2 retorna contadores
          const { data: rpcResult, error: rpcError } = await supabase.rpc('transfer_student_data', {
            p_student_id: studentId,
            p_professor_id: professorId
          });

          if (rpcError) {
            console.error("Erro na RPC transfer_student_data:", rpcError);
            throw new Error("Falha ao transferir aulas e dados do aluno. Verifique se a função RPC existe.");
          }

          const counts = rpcResult || { appointments: 0, logs: 0, blocked_slots: 0, released_slots: 0 };

          // Log history
          await supabase.from('admin_notifications').insert({
            type: 'assignment_resolved',
            message: `Vinculação aprovada: ${request.profile?.full_name}`,
            student_id: studentId,
            professor_id: professorId,
            status: 'resolved',
            created_at: new Date(),
            resolved_at: new Date()
          });

          toast({
            variant: 'default',
            title: 'Vinculação Aprovada!',
            description: `${request.profile?.full_name || 'Aluno'} vinculado. (Aulas: ${counts.appointments}, Liberados: ${counts.released_slots}, Bloqueados: ${counts.blocked_slots})`
          });
        } catch (e) {
          // Reverter status da solicitação
          await supabase.from('solicitudes_clase').update({ status: 'Pendiente' }).eq('solicitud_id', solicitudId);
          toast({ variant: 'destructive', title: 'Erro ao vincular', description: e.message });
        }
      } else if (newStatus === 'Rejeitada') {
        try {
          // Rejeitar: Limpar os campos pendentes e manter aluno sem professor
          const { error: rejectError } = await supabase
            .from('profiles')
            .update({
              assigned_professor_id: null, // Aluno fica sem professor
              pending_professor_id: null, // Limpa o professor pendente
              pending_professor_status: 'rejeitado',
              pending_professor_requested_at: null
            })
            .eq('id', studentId);

          if (rejectError) throw rejectError;

          toast({
            variant: 'destructive',
            title: 'Vinculação Rejeitada',
            description: `${request.profile?.full_name || 'Aluno'} continua sem professor vinculado e reaparecerá nas pendências.`
          });
        } catch (e) {
          toast({ variant: 'destructive', title: 'Erro ao rejeitar', description: e.message });
        }
      }

      if (onUpdate) onUpdate(solicitudId);
      setUpdatingRequestId(null);
      return;
    }

    // TRATAMENTO ESPECIAL PARA SOLICITAÇÃO DE ATRIBUIÇÃO DE AULAS
    const isAtribuicaoAulasRequest = solicitacaoData?.type === 'atribuicao_aulas';
    if (isAtribuicaoAulasRequest) {
      const studentId = request.alumno_id;

      if (newStatus === 'Aceita') {
        try {
          // Extrair dados do pacote armazenados na solicitação
          const pkgData = solicitacaoData;

          // 1. Criar BILLING
          const { error: billErr } = await supabase.from('billing').insert({
            user_id: studentId,
            package_id: pkgData.package_id,
            amount_paid: pkgData.price,
            purchase_date: pkgData.start_date,
            end_date: pkgData.end_date,
            custom_package_name: pkgData.is_recurring ? pkgData.package_name : null
          });
          if (billErr) throw billErr;

          // 2. Criar LOG
          const { error: logErr } = await supabase.from('assigned_packages_log').insert({
            professor_id: professorId,
            student_id: studentId,
            package_id: pkgData.package_id,
            observation: pkgData.observation || '',
            assigned_classes: pkgData.classes_count,
            custom_package_name: pkgData.is_recurring ? pkgData.package_name : null,
            status: 'Ativo'
          });
          if (logErr) throw logErr;

          // 3. Criar APPOINTMENTS
          if (pkgData.is_recurring && pkgData.days && pkgData.days.length > 0) {
            const appointmentInserts = [];
            const startDate = parseISO(pkgData.start_date);
            const endDate = parseISO(pkgData.end_date);
            let currentDate = getBrazilDate() > startDate ? getBrazilDate() : startDate;
            let classesScheduled = 0;
            const classDuration = pkgData.duration_minutes || 30;

            while (classesScheduled < pkgData.classes_count && currentDate <= endDate) {
              const dayIdx = getDay(currentDate);

              if (pkgData.days.includes(dayIdx)) {
                const startTime = pkgData.day_times?.[dayIdx] || pkgData.time || '08:00';
                const [hour, minute] = startTime.split(':').map(Number);
                const classDateTime = new Date(
                  currentDate.getFullYear(),
                  currentDate.getMonth(),
                  currentDate.getDate(),
                  hour, minute, 0
                );

                appointmentInserts.push({
                  student_id: studentId,
                  professor_id: professorId,
                  class_datetime: classDateTime.toISOString(),
                  class_slot_id: null,
                  status: 'scheduled',
                  duration_minutes: classDuration
                });
                classesScheduled++;
              }
              currentDate = add(currentDate, { days: 1 });
            }

            if (appointmentInserts.length > 0) {
              const { error: aptErr } = await supabase.from('appointments').insert(appointmentInserts);
              if (aptErr) throw aptErr;
            }
          }

          // 4. Atualizar perfil do aluno
          await supabase.from('profiles').update({
            assigned_professor_id: professorId,
            pending_professor_id: null,
            pending_professor_status: null,
            pending_professor_requested_at: null,
            preferred_schedule: pkgData.day_times || {}
          }).eq('id', studentId);

          toast({
            variant: 'default',
            title: 'Aulas Aprovadas!',
            description: `Pacote "${pkgData.package_name}" criado com ${pkgData.classes_count} aulas para ${request.profile?.full_name || 'Aluno'}.`
          });
        } catch (e) {
          await supabase.from('solicitudes_clase').update({ status: 'Pendiente' }).eq('solicitud_id', solicitudId);
          toast({ variant: 'destructive', title: 'Erro ao aprovar aulas', description: e.message });
        }
      } else if (newStatus === 'Rejeitada') {
        try {
          await supabase.from('profiles').update({
            pending_professor_id: null,
            pending_professor_status: 'rejeitado',
            pending_professor_requested_at: null
          }).eq('id', studentId);

          toast({
            variant: 'destructive',
            title: 'Aulas Rejeitadas',
            description: `${request.profile?.full_name || 'Aluno'} não terá aulas criadas. Reaparecerá nas pendências.`
          });
        } catch (e) {
          toast({ variant: 'destructive', title: 'Erro ao rejeitar', description: e.message });
        }
      }

      if (onUpdate) onUpdate(solicitudId);
      setUpdatingRequestId(null);
      return;
    }

    // 2. Cria as aulas recorrentes se a solicitação for aceita (fluxo normal)
    if (newStatus === 'Aceita' && request.is_recurring) {
      if (typeof request.horarios_propuestos !== 'string' || !request.horarios_propuestos) {
        toast({ variant: 'destructive', title: 'Erro de Agendamento', description: 'Formato de horário inválido.' });
        setUpdatingRequestId(null);
        return;
      }

      try {
        const proposedSchedule = JSON.parse(request.horarios_propuestos);
        const studentId = request.alumno_id;

        const { data: billingData, error: billingError } = await supabase
          .from('billing').select('end_date, packages(number_of_classes, class_duration_minutes)')
          .eq('user_id', studentId)
          .gte('end_date', getBrazilDate().toISOString())
          .order('purchase_date', { ascending: false }).limit(1).single();

        if (billingError || !billingData) throw new Error("Fatura ativa do aluno não encontrada.");

        const endDate = parseISO(billingData.end_date);
        const totalClassesInPackage = billingData.packages.number_of_classes;
        const classDuration = billingData.packages.class_duration_minutes;
        const slotsPerClass = Math.ceil(classDuration / 15);

        const { data: allSlots, error: slotsError } = await supabase.from('class_slots').select('id, day_of_week, start_time, status').eq('professor_id', professorId);
        if (slotsError) throw slotsError;

        const appointmentInserts = [];
        const slotIdsToUpdate = new Set();
        let currentDate = getBrazilDate();
        let classesScheduled = 0;

        while (currentDate <= endDate && classesScheduled < totalClassesInPackage) {
          const dayOfWeek = getDay(currentDate);

          if (proposedSchedule.days.includes(dayOfWeek)) {
            const startTime = proposedSchedule.time;
            const startTimeObj = parse(startTime, 'HH:mm:ss', currentDate);

            const requiredSlots = [];
            let canBook = true;
            for (let i = 0; i < slotsPerClass; i++) {
              const slotTime = format(add(startTimeObj, { minutes: i * 15 }), 'HH:mm:ss');
              const matchingSlot = allSlots.find(s => s.day_of_week === dayOfWeek && s.start_time === slotTime);

              if (!matchingSlot || matchingSlot.status !== 'active') {
                canBook = false;
                break;
              }
              requiredSlots.push(matchingSlot);
            }

            if (canBook) {
              const primarySlot = requiredSlots[0];
              const [hour, minute] = startTime.split(':').map(Number);
              const classDateTime = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), hour, minute, 0);

              appointmentInserts.push({
                student_id: studentId,
                professor_id: professorId,
                class_datetime: classDateTime.toISOString(),
                class_slot_id: primarySlot.id,
                status: 'scheduled',
                duration_minutes: classDuration,
              });

              requiredSlots.forEach(slot => slotIdsToUpdate.add(slot.id));
              classesScheduled++;
            }
          }
          currentDate = add(currentDate, { days: 1 });
        }

        if (appointmentInserts.length > 0) {
          const { error: insertError } = await supabase.from('appointments').insert(appointmentInserts, { onConflict: 'class_slot_id, class_datetime' });
          if (insertError) throw new Error(`Falha ao criar aulas: ${insertError.message}`);

          if (slotIdsToUpdate.size > 0) {
            const { error: updateSlotsError } = await supabase.from('class_slots').update({ status: 'filled' }).in('id', Array.from(slotIdsToUpdate));
            if (updateSlotsError) throw new Error(`Falha ao bloquear horários: ${updateSlotsError.message}`);
          }

          toast({ variant: 'default', title: 'Solicitação Aceita!', description: `${appointmentInserts.length} aulas agendadas e ${slotIdsToUpdate.size} horários bloqueados.` });
        } else {
          toast({ variant: 'warning', title: 'Aulas não agendadas', description: 'Nenhum horário correspondente foi encontrado para criar as aulas.' });
        }
      } catch (e) {
        await supabase.from('solicitudes_clase').update({ status: 'Pendiente' }).eq('solicitud_id', solicitudId);
        toast({ variant: 'destructive', title: `Erro ao processar agendamento`, description: e.message });
      }
    }
    else if (newStatus === 'Aceita' && !request.is_recurring) {
      try {
        const proposedSchedule = JSON.parse(request.horarios_propuestos);
        const studentId = request.alumno_id;

        const { data: billingData, error: billingError } = await supabase
          .from('billing')
          .select('packages(class_duration_minutes)')
          .eq('user_id', studentId)
          .gte('end_date', getBrazilDate().toISOString())
          .order('purchase_date', { ascending: false })
          .limit(1)
          .single();

        if (billingError || !billingData) {
          throw new Error('Fatura ativa do aluno não encontrada.');
        }

        const classDuration = billingData.packages?.class_duration_minutes || 30;

        const classDate = parseISO(proposedSchedule.date);
        const [hour, minute] = proposedSchedule.time.split(':').map(Number);
        const classDateTime = new Date(
          classDate.getFullYear(),
          classDate.getMonth(),
          classDate.getDate(),
          hour,
          minute,
          0
        );

        const { error: insertError } = await supabase
          .from('appointments')
          .insert({
            student_id: studentId,
            professor_id: professorId,
            class_datetime: classDateTime.toISOString(),
            status: 'scheduled',
            duration_minutes: classDuration,
          });

        if (insertError) throw new Error(`Falha ao criar aula: ${insertError.message}`);

        toast({
          variant: 'default',
          title: 'Aula Pontual Agendada!',
          description: `Aula agendada para ${format(classDate, 'dd/MM/yyyy')} às ${proposedSchedule.time.substring(0, 5)}.`
        });
      } catch (e) {
        await supabase.from('solicitudes_clase').update({ status: 'Pendiente' }).eq('solicitud_id', solicitudId);
        toast({ variant: 'destructive', title: 'Erro ao processar aula pontual', description: e.message });
      }
    } else if (newStatus === 'Rejeitada') {
      toast({ variant: 'destructive', title: 'Solicitação Rejeitada' });
    }

    if (onUpdate) onUpdate(solicitudId);
    setUpdatingRequestId(null);
  };

  const renderHorarios = (horariosJson) => {
    try {
      if (!horariosJson || typeof horariosJson !== 'string' || !horariosJson.startsWith('{')) return <p className="text-sm text-slate-500">Detalhes não disponíveis</p>;

      const schedule = JSON.parse(horariosJson);

      // Verificar se é uma solicitação de vinculação
      if (schedule.type === 'vinculacao') {
        return (
          <div className="mt-2 p-2 bg-purple-50 rounded-md border border-purple-200">
            <div className="flex items-center gap-2 text-sm text-purple-700">
              <UserPlus className="w-4 h-4" />
              <span className="font-semibold">Solicitação de Vinculação</span>
            </div>
            {schedule.old_professor_name && (
              <p className="text-xs text-purple-600 mt-1">
                Anteriormente com: {schedule.old_professor_name}
              </p>
            )}
            {schedule.days && schedule.days.length > 0 && (
              <div className="flex items-center gap-4 text-xs text-slate-600 mt-1">
                <span>Horários: {schedule.days.map(d => daysOfWeekMap[d]).join(', ')} às {schedule.time}</span>
              </div>
            )}
          </div>
        );
      }

      // Verificar se é uma solicitação de atribuição de aulas
      if (schedule.type === 'atribuicao_aulas') {
        return (
          <div className="mt-2 p-2 bg-green-50 rounded-md border border-green-200">
            <div className="flex items-center gap-2 text-sm text-green-700">
              <BookOpen className="w-4 h-4" />
              <span className="font-semibold">Solicitação de Aulas</span>
            </div>
            <div className="text-xs text-green-600 mt-1 space-y-0.5">
              <p><strong>Pacote:</strong> {schedule.package_name}</p>
              <p><strong>Aulas:</strong> {schedule.classes_count} | <strong>Valor:</strong> R$ {schedule.price?.toFixed(2)}</p>
              {schedule.days && schedule.days.length > 0 && (
                <p><strong>Dias:</strong> {schedule.days.map(d => daysOfWeekMap[d]).join(', ')}</p>
              )}
            </div>
          </div>
        );
      }

      if (!schedule.is_recurring) return <p className="text-sm text-slate-500">Aula individual</p>;

      return (
        <div className="flex items-center gap-4 text-sm text-slate-700 mt-2">
          <div className="flex items-center gap-1">
            <Clock className="w-4 h-4 text-sky-600" />
            <span className="font-semibold">{schedule.time.substring(0, 5)}</span>
          </div>
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-sky-600" />
            <span className="font-semibold">{schedule.days.map(d => daysOfWeekMap[d]).join(', ')}</span>
          </div>
        </div>
      );
    } catch (e) {
      return <p className="text-xs text-red-500">Erro ao ler detalhes</p>;
    }
  };

  // ==========================================
  // FUNCIONES PARA MODAL DE PDF
  // ==========================================
  const handleOpenPdfModal = async (aula) => {
    setSelectedAulaForPdf(aula);
    setPdfMaterialName('');
    setPdfFile(null);
    setShowPdfModal(true);

    // Cargar materiales existentes para esta aula
    setLoadingMaterials(true);
    try {
      const { data: materials } = await supabase
        .from('class_materials')
        .select('*')
        .eq('appointment_id', aula.id)
        .order('created_at', { ascending: false });

      setExistingMaterials(materials || []);
    } catch (error) {
      console.error('Erro ao carregar materiais:', error);
    } finally {
      setLoadingMaterials(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        toast({
          title: 'Arquivo inválido',
          description: 'Por favor, selecione um arquivo PDF.',
          variant: 'destructive'
        });
        return;
      }
      setPdfFile(file);
    }
  };

  const handleUploadPdf = async () => {
    if (!pdfMaterialName.trim()) {
      toast({
        title: 'Nome obrigatório',
        description: 'Por favor, insira o nome do material.',
        variant: 'destructive'
      });
      return;
    }

    if (!pdfFile) {
      toast({
        title: 'Arquivo obrigatório',
        description: 'Por favor, selecione um arquivo PDF.',
        variant: 'destructive'
      });
      return;
    }

    if (!selectedAulaForPdf?.id || !selectedAulaForPdf?.student_id) {
      toast({
        title: 'Erro',
        description: 'Informações da aula não encontradas.',
        variant: 'destructive'
      });
      return;
    }

    setIsUploadingPdf(true);

    try {
      // Obtener el usuario autenticado actual
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        throw new Error('Usuário não autenticado');
      }

      // Gerar nome único para o arquivo
      const fileExt = pdfFile.name.split('.').pop();
      const fileName = `${selectedAulaForPdf.id}_${Date.now()}.${fileExt}`;
      const filePath = `class-materials/${currentUser.id}/${fileName}`;

      // 1. Upload do arquivo para Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('class-materials')
        .upload(filePath, pdfFile, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        throw new Error(`Erro no upload: ${uploadError.message}`);
      }

      // 2. Obter URL pública do arquivo
      const { data: urlData } = supabase.storage
        .from('class-materials')
        .getPublicUrl(filePath);

      const fileUrl = urlData?.publicUrl;

      // 3. Salvar registro na tabela class_materials
      // Usamos currentUser.id como professor_id para que coincida con auth.uid() en RLS
      const { error: dbError } = await supabase
        .from('class_materials')
        .insert({
          appointment_id: selectedAulaForPdf.id,
          student_id: selectedAulaForPdf.student_id,
          professor_id: currentUser.id,
          material_name: pdfMaterialName.trim(),
          file_name: pdfFile.name,
          file_url: fileUrl,
          file_size_bytes: pdfFile.size
        });

      if (dbError) {
        // Se falhou ao salvar no banco, deletar o arquivo do storage
        await supabase.storage.from('class-materials').remove([filePath]);
        throw new Error(`Erro ao salvar: ${dbError.message}`);
      }

      toast({
        title: 'Material enviado!',
        description: `"${pdfMaterialName}" foi adicionado com sucesso para ${selectedAulaForPdf.student?.full_name || 'o aluno'}.`,
      });

      // Recarregar os materiais para mostrar no histórico do modal
      const { data: updatedMaterials } = await supabase
        .from('class_materials')
        .select('*')
        .eq('appointment_id', selectedAulaForPdf.id)
        .order('created_at', { ascending: false });

      setExistingMaterials(updatedMaterials || []);

      // Não fechamos o modal imediatamente para o professor ver que foi adicionado ao histórico
      setPdfMaterialName('');
      setPdfFile(null);

      // Atualizar dados se necessário (painel principal)
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Erro ao enviar PDF:', error);
      toast({
        title: 'Erro ao enviar',
        description: error.message || 'Ocorreu um erro ao enviar o material. Tente novamente.',
        variant: 'destructive'
      });
    } finally {
      setIsUploadingPdf(false);
    }
  };

  // ==========================================
  // RENDER: Painel de Pendências para Superusuário
  // ==========================================
  // ==========================================
  // RENDER: Painel de Pendências para Superusuário
  // ==========================================
  const renderPendenciasPanel = () => {
    if (!isSuperadmin) return null;

    // Seções de dados
    const withoutProfessor = pendenciasData.studentsWithoutProfessor || [];
    const classHistory = pendenciasData.classHistory || [];
    const expiring = pendenciasData.packagesExpiringSoon || [];
    const warnings = pendenciasData.systemWarnings || [];

    // Notifications history
    const historyData = [...(pendenciasData.historicoNotifications || []), ...historico];

    // Helper counts
    const getCount = (arr) => arr ? arr.length : 0;

    return (
      <Card className="mb-6 border-l-4 border-purple-500 shadow-sm">
        <CardHeader className="pb-3 bg-slate-50/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <LayoutGrid className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <CardTitle className="text-lg text-slate-800">Painel Administrativo</CardTitle>
                <CardDescription>Central de controle e monitoramento</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-purple-700 border-purple-300 bg-purple-50">
                {getCount(withoutProfessor) + getCount(expiring) + getCount(warnings)} pendência(s)
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                onClick={loadPendencias}
                disabled={loadingPendencias}
                className={cn("h-8 w-8 hover:bg-purple-100 text-purple-600", loadingPendencias && "animate-spin")}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0 px-0">
          <Tabs defaultValue="sem_prof" className="w-full">
            <div className="px-6 border-b bg-white sticky top-0 z-10">
              <TabsList className="w-full justify-start h-12 bg-transparent p-0 gap-6">
                <TabsTrigger
                  value="sem_prof"
                  className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-purple-600 rounded-none h-full px-0 pb-0 text-slate-500 data-[state=active]:text-purple-700"
                >
                  <div className="flex items-center gap-2 pb-2">
                    <UserX className="h-4 w-4" />
                    <span>Sem Prof</span>
                    {getCount(withoutProfessor) > 0 && (
                      <Badge variant="secondary" className="bg-red-100 text-red-700 h-5 px-1.5 min-w-[1.25rem] text-[10px] flex justify-center items-center">
                        {getCount(withoutProfessor)}
                      </Badge>
                    )}
                  </div>
                </TabsTrigger>

                <TabsTrigger
                  value="aulas"
                  className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-purple-600 rounded-none h-full px-0 pb-0 text-slate-500 data-[state=active]:text-purple-700"
                >
                  <div className="flex items-center gap-2 pb-2">
                    <History className="h-4 w-4" />
                    <span>Aulas</span>
                  </div>
                </TabsTrigger>

                <TabsTrigger
                  value="vencendo"
                  className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-purple-600 rounded-none h-full px-0 pb-0 text-slate-500 data-[state=active]:text-purple-700"
                >
                  <div className="flex items-center gap-2 pb-2">
                    <Clock className="h-4 w-4" />
                    <span>Vencendo</span>
                    {getCount(expiring) > 0 && (
                      <Badge variant="secondary" className="bg-amber-100 text-amber-700 h-5 px-1.5 min-w-[1.25rem] text-[10px] flex justify-center items-center">
                        {getCount(expiring)}
                      </Badge>
                    )}
                  </div>
                </TabsTrigger>

                <TabsTrigger
                  value="avisos"
                  className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-purple-600 rounded-none h-full px-0 pb-0 text-slate-500 data-[state=active]:text-purple-700"
                >
                  <div className="flex items-center gap-2 pb-2">
                    <AlertTriangle className="h-4 w-4" />
                    <span>Avisos</span>
                    {getCount(warnings) > 0 && (
                      <Badge variant="secondary" className="bg-orange-100 text-orange-700 h-5 px-1.5 min-w-[1.25rem] text-[10px] flex justify-center items-center">
                        {getCount(warnings)}
                      </Badge>
                    )}
                  </div>
                </TabsTrigger>

                <TabsTrigger
                  value="historico"
                  className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-purple-600 rounded-none h-full px-0 pb-0 text-slate-500 data-[state=active]:text-purple-700 ml-auto"
                >
                  <div className="flex items-center gap-2 pb-2">
                    <Archive className="h-4 w-4" />
                    <span>Histórico</span>
                  </div>
                </TabsTrigger>
              </TabsList>
            </div>

            {loadingPendencias ? (
              <div className="flex justify-center items-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
                <span className="ml-3 text-sm text-slate-500">Atualizando painel...</span>
              </div>
            ) : (
              <>
                {/* === TAB: SEM PROF === */}
                <TabsContent value="sem_prof" className="p-0">
                  <ScrollArea className="h-[300px] w-full">
                    <div className="p-6">
                      {withoutProfessor.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center text-slate-500">
                          <CheckCircle className="h-12 w-12 text-green-100 text-green-500 mb-2" />
                          <p>Tudo certo! Todos os alunos têm professor.</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {withoutProfessor.map(student => (
                            <div key={student.id} className="flex items-center justify-between p-4 bg-white rounded-lg border shadow-sm hover:shadow-md transition-shadow">
                              <div className="flex items-center gap-4">
                                <Avatar className="h-10 w-10 border">
                                  <AvatarFallback className="bg-purple-100 text-purple-700 font-bold">
                                    {student.full_name?.[0]}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-semibold text-slate-800">{student.full_name}</p>
                                  <p className="text-sm text-slate-500">Aguardando vinculação</p>
                                </div>
                              </div>
                              <Button
                                size="sm"
                                className="bg-purple-600 hover:bg-purple-700 text-white"
                                onClick={() => handleOpenVincularModal(student)}
                              >
                                <UserPlus className="h-4 w-4 mr-2" />
                                Vincular
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>

                {/* === TAB: AULAS === */}
                <TabsContent value="aulas" className="p-0">
                  <ScrollArea className="h-[300px] w-full">
                    <div className="p-6">
                      {/* Simply showing recent history */}
                      {classHistory.length === 0 ? (
                        <div className="text-center py-8 text-slate-500">Nenhuma aula recente registrada.</div>
                      ) : (
                        <div className="space-y-3">
                          {classHistory.map(aula => (
                            <div key={aula.id} className="flex items-center justify-between p-3 border rounded-lg text-sm">
                              <div className="flex items-center gap-3">
                                <div className={cn("p-1.5 rounded-full",
                                  aula.status === 'completed' ? "bg-green-100 text-green-600" :
                                    aula.status === 'missed' ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-600"
                                )}>
                                  {aula.status === 'completed' ? <Check className="h-4 w-4" /> :
                                    aula.status === 'missed' ? <X className="h-4 w-4" /> : <Calendar className="h-4 w-4" />}
                                </div>
                                <div>
                                  <p className="font-medium text-slate-700">{aula.student?.full_name}</p>
                                  <p className="text-xs text-slate-500">
                                    {format(new Date(aula.class_datetime), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                                  </p>
                                </div>
                              </div>
                              <Badge variant="outline" className="capitalize">{aula.status}</Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>

                {/* === TAB: VENCENDO === */}
                <TabsContent value="vencendo" className="p-0">
                  <ScrollArea className="h-[300px] w-full">
                    <div className="p-6">
                      {expiring.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center text-slate-500">
                          <CheckCircle className="h-10 w-10 text-slate-200 mb-2" />
                          <p>Nenhum pacote vencendo em breve.</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {expiring.map(pkg => (
                            <div key={pkg.id} className="flex items-center justify-between p-4 bg-amber-50/50 border border-amber-100 rounded-lg">
                              <div className="flex items-center gap-3">
                                <Package className="h-8 w-8 text-amber-500 opacity-80" />
                                <div>
                                  <p className="font-medium text-slate-800">{pkg.custom_package_name || pkg.package_def?.name || 'Pacote'}</p>
                                  <p className="text-sm text-slate-600">Aluno: {pkg.student?.full_name}</p>
                                  <p className="text-xs text-amber-600 font-medium mt-0.5">
                                    Vence {formatDistanceToNowStrict(new Date(pkg.expiration_date), { locale: ptBR, addSuffix: true })}
                                  </p>
                                </div>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleMarkAsSeen({
                                  type: 'package_expiration',
                                  message: `Pacote expirando visto: ${pkg.student?.full_name}`,
                                  details: { package_id: pkg.id },
                                  student_id: pkg.student_id
                                })}
                                disabled={processingAction}
                                className="text-amber-700 border-amber-200 hover:bg-amber-100"
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                Marcar Visto
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>

                {/* === TAB: AVISOS === */}
                <TabsContent value="avisos" className="p-0">
                  <ScrollArea className="h-[300px] w-full">
                    <div className="p-6">
                      {warnings.length === 0 ? (
                        <div className="text-center py-8 text-slate-500">Nenhum aviso do sistema.</div>
                      ) : (
                        <div className="space-y-3">
                          {warnings.map(warning => (
                            <div key={warning.id} className="flex items-center justify-between p-4 bg-red-50/50 border border-red-100 rounded-lg">
                              <div className="flex items-center gap-3">
                                <AlertTriangle className="h-5 w-5 text-red-500" />
                                <div>
                                  <p className="font-medium text-slate-800">{warning.message}</p>
                                  <p className="text-xs text-slate-500">
                                    {formatDistanceToNowStrict(new Date(warning.created_at), { locale: ptBR, addSuffix: true })}
                                  </p>
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleMarkAsSeen(warning)}
                                disabled={processingAction}
                                className="text-red-600 hover:bg-red-100"
                              >
                                Resolvido
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>

                {/* === TAB: HISTORICO === */}
                <TabsContent value="historico" className="p-0">
                  <ScrollArea className="h-[300px] w-full">
                    <div className="p-6">
                      {historyData.length === 0 ? (
                        <div className="text-center py-8 text-slate-500">
                          <History className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                          <p>Histórico vazio.</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {historyData.map((item, idx) => (
                            <div key={item.id || idx} className="flex items-center justify-between p-3 bg-slate-50 rounded border border-slate-100 opacity-75 grayscale-[0.5] hover:opacity-100 transition-opacity">
                              <div className="flex items-center gap-3">
                                <div className="p-1.5 bg-slate-200 rounded-full">
                                  <Check className="h-3 w-3 text-slate-600" />
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-slate-700">{item.message || item.titulo || 'Item resolvido'}</p>
                                  <p className="text-xs text-slate-500">
                                    Resolvido {item.resolved_at ? format(new Date(item.resolved_at), "dd/MM HH:mm") : 'Recentemente'}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>
              </>
            )}
          </Tabs>
        </CardContent>
      </Card>
    );
  };

  // Se for visão do Painel (apenas pendências para superusuário)
  if (showPainelView && isSuperadmin) {
    return (
      <div className="w-full">
        <div className="w-full px-4 lg:px-8">
          {/* Painel de Pendências para Superusuário */}
          {renderPendenciasPanel()}

          {/* Modal de Vinculação de Professor com Matching Inteligente */}
          <Dialog open={showVincularModal} onOpenChange={setShowVincularModal}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5 text-green-600" />
                  Vincular Professor ao Aluno
                  <Badge variant="outline" className="ml-2">
                    Passo {matchingStep} de 2
                  </Badge>
                </DialogTitle>
                <DialogDescription>
                  {matchingStep === 1
                    ? 'Informe as preferências de horário do aluno para encontrar professores compatíveis'
                    : 'Selecione um professor da lista de compatíveis'}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                {/* Info completa do Aluno */}
                <div className="p-4 bg-slate-50 rounded-lg border space-y-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-blue-100 text-blue-700 text-lg font-bold">
                        {selectedStudentForVinculacao?.full_name?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold text-lg">{selectedStudentForVinculacao?.full_name}</p>
                      <p className="text-sm text-slate-500">
                        Código: {selectedStudentForVinculacao?.student_code || 'N/A'}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                    <div>
                      <p className="text-xs text-slate-500">Idioma</p>
                      <p className="font-medium text-slate-800">Español</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Nível</p>
                      <p className="font-medium text-slate-800">{selectedStudentForVinculacao?.spanish_level || 'A definir'}</p>
                    </div>
                    {selectedStudentForVinculacao?.phone && (
                      <div>
                        <p className="text-xs text-slate-500">Telefone</p>
                        <p className="font-medium text-slate-800">{selectedStudentForVinculacao?.phone}</p>
                      </div>
                    )}
                    {selectedStudentForVinculacao?.email && (
                      <div>
                        <p className="text-xs text-slate-500">E-mail</p>
                        <p className="font-medium text-slate-800">{selectedStudentForVinculacao?.email}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* PASO 1: Mensaje informativo (sin selección de días/horarios) */}
                {matchingStep === 1 && (
                  <div className="text-center py-4 text-slate-600">
                    <p className="text-sm">
                      Clique em "Buscar Professores" para ver os professores disponíveis para este aluno.
                    </p>
                  </div>
                )}

                {/* PASO 2: Ver Profesores Compatibles */}
                {matchingStep === 2 && (
                  <div className="space-y-4">
                    {/* Resumo da Agenda Desejada */}
                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-sm text-blue-800 font-semibold mb-2">Agenda Desejada pelo Aluno:</p>
                      <div className="flex flex-wrap gap-2">
                        {studentPreferences.days.length > 0 ? (
                          studentPreferences.days.map(d => (
                            <Badge key={d} variant="outline" className="bg-white border-blue-300 text-blue-700">
                              {daysOfWeekMap[d]} às {selectedStudentForVinculacao?.preferred_schedule?.[d] || studentPreferences.time}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-slate-500 italic">Nenhuma preferência definida</span>
                        )}
                      </div>
                    </div>


                    {/* Lista de profesores compatibles */}
                    <div className="space-y-2">
                      <Label className="text-base font-semibold">
                        Professores Compatíveis ({matchedProfessors.length})
                      </Label>

                      {matchedProfessors.length > 0 ? (
                        <ScrollArea className="h-[250px]">
                          <div className="space-y-2 pr-4">
                            {matchedProfessors.map((match, idx) => (
                              <div
                                key={match.professor?.id || idx}
                                onClick={() => {
                                  setSelectedProfessorId(match.professor?.id);
                                }}
                                className={cn(
                                  "p-3 rounded-lg border-2 cursor-pointer transition-all",
                                  selectedProfessorId === match.professor?.id
                                    ? "bg-green-50 border-green-500"
                                    : "bg-white border-slate-200 hover:border-slate-400"
                                )}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <Avatar className="h-10 w-10">
                                      <AvatarFallback className={cn(
                                        match.matchPercentage === 100 ? "bg-green-500 text-white" :
                                          match.matchPercentage >= 50 ? "bg-yellow-500 text-white" :
                                            "bg-slate-500 text-white"
                                      )}>
                                        {match.professor?.full_name?.[0]}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div>
                                      <p className="font-medium">{match.professor?.full_name}</p>
                                      <p className="text-xs text-slate-500">
                                        {match.matchedDaysCount} de {match.totalDaysRequested} dias disponíveis
                                      </p>
                                    </div>
                                  </div>
                                  <Badge className={cn(
                                    "text-sm",
                                    match.matchPercentage === 100 ? "bg-green-500" :
                                      match.matchPercentage >= 50 ? "bg-yellow-500" :
                                        "bg-orange-500"
                                  )}>
                                    {match.matchPercentage}% match
                                  </Badge>
                                </div>

                                {/* Horarios que coinciden */}
                                <div className="mt-2 flex flex-wrap gap-1">
                                  {match.matchedSlots.slice(0, 6).map((slot, sIdx) => (
                                    <Badge key={sIdx} variant="outline" className="text-xs bg-green-50">
                                      {daysOfWeekMap[slot.day_of_week]} {slot.start_time?.substring(0, 5)}
                                    </Badge>
                                  ))}
                                  {match.matchedSlots.length > 6 && (
                                    <Badge variant="outline" className="text-xs">
                                      +{match.matchedSlots.length - 6}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      ) : (
                        <Alert variant="destructive">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertTitle>Nenhum professor encontrado</AlertTitle>
                          <AlertDescription>
                            Tente ajustar os dias ou horário de preferência.
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>

                    {/* Agenda do Professor Selecionado */}
                    {selectedProfessorId && professorAvailability && (
                      <Alert className="bg-green-50 border-green-200">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <AlertDescription className="text-green-800">
                          <strong>{professors.find(p => p.id === selectedProfessorId)?.full_name}</strong> -
                          Disponível: {professorAvailability.daysCovered}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2">
                {matchingStep === 1 ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => setShowVincularModal(false)}
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={handleSearchCompatibleProfessors}
                      disabled={studentPreferences.days.length === 0 || isSearchingMatches}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {isSearchingMatches ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Buscando...
                        </>
                      ) : (
                        <>
                          <Search className="h-4 w-4 mr-2" />
                          Buscar Professores
                        </>
                      )}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => setMatchingStep(1)}
                    >
                      Voltar
                    </Button>
                    <Button
                      onClick={handleVincularProfessor}
                      disabled={!selectedProfessorId || isVinculando}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {isVinculando ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Vinculando...
                        </>
                      ) : (
                        <>
                          <UserPlus className="h-4 w-4 mr-2" />
                          Vincular Professor
                        </>
                      )}
                    </Button>
                  </>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    );
  }

  // Visão normal (Início) - para professores ou superadmin na aba Início
  // Calcular estatísticas do mês
  const monthStats = useMemo(() => {
    const now = getBrazilDate();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const monthAppointments = allAppointments.filter(apt => {
      const aptDate = new Date(apt.class_datetime);
      return aptDate >= startOfMonth && aptDate <= endOfMonth;
    });

    const completed = monthAppointments.filter(a => a.status === 'completed').length;
    const missed = monthAppointments.filter(a => a.status === 'missed').length;
    const scheduled = monthAppointments.filter(a => ['scheduled', 'rescheduled'].includes(a.status)).length;
    const total = monthAppointments.length || 1; // Evitar divisão por zero

    return {
      total,
      completed,
      missed,
      scheduled,
      completedPercent: Math.round((completed / total) * 100),
      missedPercent: Math.round((missed / total) * 100),
      scheduledPercent: Math.round((scheduled / total) * 100)
    };
  }, [allAppointments]);

  return (
    <div className="w-full">
      <div className="w-full px-4 lg:px-8">
        {/* Grid principal: 2 colunas em desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* ===== COLUNA ESQUERDA ===== */}
          <div className="space-y-6">

            {/* PAINEL ADMINISTRATIVO (Novo) - Apenas Superadmin */}
            {renderPendenciasPanel()}

            {/* Card: Solicitações Pendentes */}
            <Card className="shadow-sm h-[400px] flex flex-col border-l-4 border-l-sky-500">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-bold text-slate-800">Solicitações Pendentes</CardTitle>
                  <Badge className={cn(
                    "px-3 py-1 text-sm font-semibold",
                    solicitudes.length > 0
                      ? "bg-sky-500 text-white"
                      : "bg-slate-100 text-slate-600"
                  )}>
                    {solicitudes.length} pendentes
                  </Badge>
                </div>
                <CardDescription>Solicitações de aulas aguardando sua aprovação</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto">
                {loading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                  </div>
                ) : solicitudes.length > 0 ? (
                  <div className="space-y-3">
                    {solicitudes.map(req => (
                      <div key={req.solicitud_id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={req.profile?.avatar_url} />
                            <AvatarFallback className="bg-blue-100 text-blue-700">
                              {req.profile?.full_name?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-semibold text-slate-800">{req.profile?.full_name}</p>
                            {renderHorarios(req.horarios_propuestos)}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-green-600 border-green-600 hover:bg-green-50"
                            onClick={() => handleUpdateRequestStatus(req.solicitud_id, 'Aceita')}
                            disabled={updatingRequestId === req.solicitud_id}
                          >
                            {updatingRequestId === req.solicitud_id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 border-red-600 hover:bg-red-50"
                            onClick={() => handleUpdateRequestStatus(req.solicitud_id, 'Rejeitada')}
                            disabled={updatingRequestId === req.solicitud_id}
                          >
                            {updatingRequestId === req.solicitud_id ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-10">
                    <CalendarHeart className="w-16 h-16 mx-auto mb-3 text-slate-300" />
                    <p className="text-slate-500">Não há solicitações pendentes no momento</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Card: Aulas em seguida */}
            <Card className="shadow-sm h-[400px] flex flex-col border-l-4 border-l-sky-500">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-bold text-slate-800">Aulas em seguida</CardTitle>
                <CardDescription>Próximas aulas agendadas</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto">
                {loading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                  </div>
                ) : upcomingClasses.length > 0 ? (
                  <div className="space-y-4">
                    {upcomingClasses.slice(0, 5).map((apt) => {
                      const aptDate = parseISO(apt.class_datetime);
                      const dayName = format(aptDate, "EEEE, d 'de' MMMM", { locale: ptBR });
                      const timeStart = format(aptDate, "HH:mm");
                      const timeEnd = format(new Date(aptDate.getTime() + (apt.duration_minutes || 30) * 60000), "HH:mm");

                      return (
                        <div key={apt.id} className="p-4 border rounded-lg bg-white hover:shadow-md transition-shadow">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="font-bold text-sky-700">
                                Español - {apt.student?.spanish_level || 'Básico'}
                              </p>
                              <p className="text-sm text-slate-600 mt-1">
                                <span className="font-medium">Aluno:</span> {apt.student?.full_name || 'N/A'}
                              </p>
                              <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                                <span className="flex items-center gap-1">
                                  <CalendarDays className="w-3 h-3" />
                                  {dayName}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {timeStart} - {timeEnd}
                                </span>
                              </div>
                            </div>
                            <Badge className="bg-sky-100 text-sky-700 border-sky-200">
                              Efetiva
                            </Badge>
                          </div>
                          <div className="mt-3 pt-3 border-t flex justify-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-slate-500 hover:text-slate-700"
                              onClick={() => handleOpenPdfModal(apt)}
                            >
                              <FileText className="w-4 h-4 mr-1" />
                              Adicionar Material PDF
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-10">
                    <CalendarDays className="w-16 h-16 mx-auto mb-3 text-slate-300" />
                    <p className="text-slate-500">Nenhuma aula agendada no momento</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ===== COLUNA DIREITA ===== */}
          <div className="space-y-6">

            {/* Card: Próxima Aula */}
            <Card className="shadow-sm h-[400px] flex flex-col border-l-4 border-l-sky-500">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-bold text-slate-800">Próxima Aula</CardTitle>
                    {nextClass && (
                      <p className="text-sm text-slate-500 mt-1">
                        Começa {formatDistanceToNowStrict(new Date(nextClass.class_datetime), { locale: ptBR, addSuffix: true })}
                      </p>
                    )}
                  </div>
                  {nextClass && (
                    <Badge className="bg-sky-100 text-sky-700 border-sky-200">
                      Efetiva
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto">
                {loading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                  </div>
                ) : nextClass ? (
                  <div className="space-y-4">
                    <h3 className="text-xl font-bold text-sky-700">
                      Español - {nextClass.student?.spanish_level || 'Básico'}
                    </h3>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-xs text-slate-400 uppercase font-semibold">Aluno</p>
                        <p className="font-semibold text-slate-800 uppercase">{nextClass.student?.full_name || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 uppercase font-semibold">Duração</p>
                        <p className="font-semibold text-slate-800">{nextClass.duration_minutes || 45}m</p>
                      </div>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-slate-600">
                        <CalendarDays className="w-4 h-4 text-slate-400" />
                        {format(new Date(nextClass.class_datetime), "EEEE, d 'de' MMMM", { locale: ptBR })}
                      </div>
                      <div className="flex items-center gap-2 text-slate-600">
                        <Clock className="w-4 h-4 text-slate-400" />
                        {format(new Date(nextClass.class_datetime), "HH'h'mm")} - {format(new Date(new Date(nextClass.class_datetime).getTime() + (nextClass.duration_minutes || 45) * 60000), "HH'h'mm")}
                      </div>
                      <div className="flex items-center gap-2 text-slate-600">
                        <span className="text-xs uppercase font-semibold text-slate-400">Nível:</span>
                        <span>{nextClass.student?.spanish_level || 'Intermediário'}</span>
                      </div>
                    </div>

                    <div className="flex gap-3 pt-4">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => handleOpenPdfModal(nextClass)}
                      >
                        <FileText className="w-4 h-4 mr-2" />
                        PDF Aulas
                      </Button>
                      <Button asChild className="flex-1 bg-emerald-500 hover:bg-emerald-600">
                        <a href={dashboardData?.meeting_link || "https://meet.google.com/tmi-xwmg-kua"} target="_blank" rel="noopener noreferrer">
                          Iniciar Aula
                        </a>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <CalendarDays className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                    <p className="text-slate-500">Nenhuma aula agendada</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Card: Aulas no mês */}
            <Card className="shadow-sm h-[400px] flex flex-col border-l-4 border-l-sky-500">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-bold text-slate-800">Aulas no mês</CardTitle>
                <CardDescription>Total por status referente a todas as aulas do professor</CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                <div className="space-y-4">
                  {/* Completas */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-500" />
                        <span className="text-slate-600">{monthStats.completed}/{monthStats.total} Completas</span>
                      </div>
                      <span className="font-semibold text-slate-700">{monthStats.completedPercent}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div
                        className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${monthStats.completedPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Falta Aluno */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <UserX className="w-4 h-4 text-orange-500" />
                        <span className="text-slate-600">{monthStats.missed}/{monthStats.total} Falta Aluno</span>
                      </div>
                      <span className="font-semibold text-slate-700">{monthStats.missedPercent}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div
                        className="bg-orange-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${monthStats.missedPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Agendadas */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-sky-500" />
                        <span className="text-slate-600">{monthStats.scheduled}/{monthStats.total} Aulas Agendadas</span>
                      </div>
                      <span className="font-semibold text-slate-700">{monthStats.scheduledPercent}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div
                        className="bg-sky-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${monthStats.scheduledPercent}%` }}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ===== SEÇÃO: ATALHOS RÁPIDOS ===== */}
        <div className="mt-10">
          <h2 className="text-xl font-bold text-slate-800 mb-6">Atalhos Rápidos</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* My Earnings */}
            <Card
              className="hover:shadow-md transition-all cursor-pointer group border-slate-200"
              onClick={() => setShowEarningsModal(true)}
            >
              <CardContent className="p-6 flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <DollarSign className="w-6 h-6 text-emerald-600" />
                </div>
                <h3 className="font-bold text-slate-800 mb-1">My Earnings</h3>
                <p className="text-xs text-slate-500">Detalhes de ganhos por aulas agendadas</p>
              </CardContent>
            </Card>

            {/* Serviços */}
            <Card
              className="hover:shadow-md transition-all cursor-pointer group border-slate-200"
              onClick={() => setActiveTab && setActiveTab('servicos')}
            >
              <CardContent className="p-6 flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full bg-sky-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <LayoutGrid className="w-6 h-6 text-sky-600" />
                </div>
                <h3 className="font-bold text-slate-800 mb-1">Serviços</h3>
                <p className="text-xs text-slate-500">Acessar ferramentas e serviços disponíveis</p>
              </CardContent>
            </Card>

            {/* Avisos */}
            <Card
              className="hover:shadow-md transition-all cursor-pointer group border-slate-200"
              onClick={() => setActiveTab && setActiveTab('avisos')}
            >
              <CardContent className="p-6 flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Megaphone className="w-6 h-6 text-rose-600" />
                </div>
                <h3 className="font-bold text-slate-800 mb-1">Avisos</h3>
                <p className="text-xs text-slate-500">Ver comunicados e notícias importantes</p>
              </CardContent>
            </Card>

            {/* Agenda (Unificando com a foto) */}
            <Card
              className="hover:shadow-md transition-all cursor-pointer group border-slate-200"
              onClick={() => setActiveTab && setActiveTab('agenda')}
            >
              <CardContent className="p-6 flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full bg-sky-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Calendar className="w-6 h-6 text-sky-600" />
                </div>
                <h3 className="font-bold text-slate-800 mb-1">Agenda</h3>
                <p className="text-xs text-slate-500">Visualize sua escala de aulas agendadas</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Modal de Vinculação de Professor */}
        <Dialog open={showVincularModal} onOpenChange={setShowVincularModal}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-green-600" />
                Vincular Professor ao Aluno
                <Badge variant="outline" className="ml-2">
                  Passo {matchingStep} de 2
                </Badge>
              </DialogTitle>
            </DialogHeader>
          </DialogContent>
        </Dialog>

        {/* Modal de Upload de PDF */}
        <Dialog open={showPdfModal} onOpenChange={setShowPdfModal}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-sky-600" />
                Adicionar Material PDF
              </DialogTitle>
              <DialogDescription>
                {selectedAulaForPdf?.student?.full_name && (
                  <span>Material para aula com <strong>{selectedAulaForPdf.student.full_name}</strong></span>
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Nome do Material */}
              <div className="space-y-2">
                <Label htmlFor="pdf-name">Nome do Material *</Label>
                <Input
                  id="pdf-name"
                  placeholder="Ex: Exercícios Capítulo 5"
                  value={pdfMaterialName}
                  onChange={(e) => setPdfMaterialName(e.target.value)}
                />
              </div>

              {/* Upload de Arquivo */}
              <div className="space-y-2">
                <Label htmlFor="pdf-file">Arquivo PDF *</Label>
                <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-sky-400 transition-colors">
                  <input
                    type="file"
                    id="pdf-file"
                    accept=".pdf,application/pdf"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <label htmlFor="pdf-file" className="cursor-pointer">
                    <Upload className="w-10 h-10 mx-auto mb-2 text-slate-400" />
                    <p className="text-sm text-slate-600">
                      Clique para selecionar ou arraste o arquivo
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Apenas arquivos PDF
                    </p>
                  </label>
                </div>

                {/* Preview do arquivo selecionado */}
                {pdfFile && (
                  <div className="flex items-center gap-2 p-3 bg-sky-50 rounded-lg border border-sky-200">
                    <FileText className="w-5 h-5 text-sky-600" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{pdfFile.name}</p>
                      <p className="text-xs text-slate-500">{(pdfFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setPdfFile(null)}
                      className="text-slate-400 hover:text-red-500"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Histórico de Materiais */}
              <div className="pt-4 border-t">
                <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <History className="w-4 h-4" />
                  Materiais já enviados nesta aula
                </h4>

                {loadingMaterials ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
                  </div>
                ) : existingMaterials.length > 0 ? (
                  <div className="space-y-2 max-h-[180px] overflow-y-auto pr-2 custom-scrollbar">
                    {existingMaterials.map((material) => (
                      <div key={material.id} className="flex items-center gap-3 p-2 rounded-md bg-slate-50 border border-slate-100 group">
                        <div className="p-1.5 bg-white rounded border border-slate-200">
                          <FileText className="w-4 h-4 text-slate-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-slate-700 truncate" title={material.material_name}>
                            {material.material_name}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate">
                            {material.file_name}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-slate-400 hover:text-sky-600"
                            asChild
                          >
                            <a href={material.file_url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={async () => {
                              if (window.confirm('Excluir este material?')) {
                                try {
                                  // 1. Remover do Storage (opcional, mas recomendado)
                                  const filePath = material.file_url.split('/public/class-materials/')[1];
                                  if (filePath) {
                                    await supabase.storage.from('class-materials').remove([filePath]);
                                  }

                                  // 2. Remover do Banco
                                  const { error } = await supabase
                                    .from('class_materials')
                                    .delete()
                                    .eq('id', material.id);

                                  if (error) throw error;

                                  // 3. Atualizar UI
                                  setExistingMaterials(prev => prev.filter(m => m.id !== material.id));
                                  toast({ title: 'Material removido' });
                                } catch (err) {
                                  console.error(err);
                                  toast({ title: 'Erro ao remover', variant: 'destructive' });
                                }
                              }
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-center py-4 text-slate-400 bg-slate-50 rounded-md border border-dashed">
                    Nenhum material enviado para esta aula.
                  </p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button onClick={() => setShowPdfModal(false)}>Fechar</Button>
              <Button
                onClick={handleUploadPdf}
                className="bg-sky-600 hover:bg-sky-700"
                disabled={isUploadingPdf || !pdfMaterialName.trim() || !pdfFile}
              >
                {isUploadingPdf ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando...</>
                ) : (
                  <><Upload className="mr-2 h-4 w-4" /> Enviar Material</>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal My Earnings (Novo) */}
        <Dialog open={showEarningsModal} onOpenChange={setShowEarningsModal}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-2xl font-bold text-slate-800">
                <DollarSign className="h-6 w-6 text-emerald-600" />
                MY EARNINGS
              </DialogTitle>
              <DialogDescription>
                Detalhamento de ganhos baseados em aulas completadas (Taxa: R$ {BASE_RATE.toFixed(2)} / 30 min)
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Cuadrados de Resumen */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="bg-emerald-600 text-white border-none shadow-sm">
                  <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                    <p className="text-xs font-semibold opacity-80 uppercase mb-1">Ganhos Totais</p>
                    <h3 className="text-2xl font-bold">R$ {earningsStats.totalEarnings.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
                  </CardContent>
                </Card>

                <Card className="bg-sky-600 text-white border-none shadow-sm">
                  <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                    <p className="text-xs font-semibold opacity-80 uppercase mb-1">Tempo em Aula</p>
                    <h3 className="text-2xl font-bold">{formatTimeFull(earningsStats.totalMinutes)}</h3>
                  </CardContent>
                </Card>

                <Card className="bg-purple-600 text-white border-none shadow-sm">
                  <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                    <p className="text-xs font-semibold opacity-80 uppercase mb-1">Aulas Completadas</p>
                    <h3 className="text-2xl font-bold">{earningsStats.totalUnits.toFixed(1)}</h3>
                  </CardContent>
                </Card>
              </div>

              {/* Tabla de Historial */}
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="text-xs font-bold uppercase">Aluno</TableHead>
                      <TableHead className="text-xs font-bold uppercase">Duração</TableHead>
                      <TableHead className="text-xs font-bold uppercase">Tempo Total</TableHead>
                      <TableHead className="text-xs font-bold uppercase">Qtd (30m)</TableHead>
                      <TableHead className="text-xs font-bold uppercase">Unitário</TableHead>
                      <TableHead className="text-xs font-bold uppercase text-right">Valor Estimado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {earningsStats.groupedList.length > 0 ? (
                      earningsStats.groupedList.map((student, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium text-slate-700">{student.name}</TableCell>
                          <TableCell>{student.typicalDuration} min</TableCell>
                          <TableCell>{formatTimeFull(student.totalMinutes)}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{student.units.toFixed(1)}</Badge>
                          </TableCell>
                          <TableCell className="text-slate-500">R$ {BASE_RATE.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-bold text-emerald-600">
                            R$ {student.earnings.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-slate-400">
                          Nenhuma aula concluída encontrada.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEarningsModal(false)}>Fechar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default HomeTab;

