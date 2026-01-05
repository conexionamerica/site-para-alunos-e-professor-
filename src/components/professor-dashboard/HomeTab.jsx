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
import { Check, X, Loader2, CalendarHeart, Clock, CalendarDays, AlertTriangle, Users, BookOpen, Package, Bell, Filter, UserX, Calendar, CheckCircle, XCircle, RefreshCw, History, Eye, EyeOff, ExternalLink, UserPlus, Search, FileText, Upload } from 'lucide-react';
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

const HomeTab = ({ dashboardData }) => {
  const { toast } = useToast();
  const [updatingRequestId, setUpdatingRequestId] = useState(null);
  const [solicitudes, setSolicitudes] = useState([]);
  const [next24Hours, setNext24Hours] = useState([]);
  const [pendenciasFilter, setPendenciasFilter] = useState('all');
  const [pendenciasData, setPendenciasData] = useState({
    studentsWithoutProfessor: [],
    studentsWithAvailableClasses: [],
    packagesExpiringSoon: [],
    recentNotifications: []
  });
  const [loadingPendencias, setLoadingPendencias] = useState(false);
  const [historico, setHistorico] = useState([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);
  const [processingAction, setProcessingAction] = useState(null);

  // Estado para modal de vinculação de professor
  const [showVincularModal, setShowVincularModal] = useState(false);
  const [selectedStudentForVinculacao, setSelectedStudentForVinculacao] = useState(null);
  const [selectedProfessorId, setSelectedProfessorId] = useState('');
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
  useEffect(() => {
    if (!isSuperadmin) return;

    const loadPendencias = async () => {
      setLoadingPendencias(true);
      try {
        const today = getBrazilDate();
        const fiveDaysFromNow = add(today, { days: 5 });

        // 1. Alunos sem professor vinculado
        const studentsWithoutProf = students.filter(s =>
          s.is_active !== false && !s.assigned_professor_id
        );

        // 2. Alunos com aulas disponíveis (billing ativo com aulas restantes)
        const studentsWithClasses = [];
        for (const student of students.filter(s => s.is_active !== false)) {
          const studentBillings = allBillings.filter(b =>
            b.user_id === student.id &&
            new Date(b.end_date) >= today
          );

          if (studentBillings.length > 0) {
            // Contar aulas usadas vs total do pacote
            const studentAppointments = allAppointments.filter(apt =>
              apt.student_id === student.id &&
              ['completed', 'scheduled', 'rescheduled'].includes(apt.status)
            );

            // Para cada billing ativo, verificar se há aulas disponíveis
            for (const billing of studentBillings) {
              const packageClasses = billing.packages?.number_of_classes || 0;
              const usedClasses = studentAppointments.filter(apt =>
                new Date(apt.class_datetime) >= new Date(billing.purchase_date) &&
                new Date(apt.class_datetime) <= new Date(billing.end_date)
              ).length;

              const availableClasses = packageClasses - usedClasses;
              if (availableClasses > 0) {
                studentsWithClasses.push({
                  student,
                  billing,
                  availableClasses,
                  packageName: billing.packages?.name || 'Pacote'
                });
              }
            }
          }
        }

        // 3. Pacotes expirando em 5 dias
        const expiringPackages = [];
        for (const billing of allBillings) {
          const endDate = new Date(billing.end_date);
          const daysUntilExpiry = differenceInDays(endDate, today);

          if (daysUntilExpiry >= 0 && daysUntilExpiry <= 5) {
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

        // 4. Notificações recentes (últimas 48h) - Buscar do banco
        const twoDaysAgo = add(today, { days: -2 });

        // Buscar solicitações recentemente processadas (aceitas/rejeitadas)
        const { data: recentRequests, error: reqError } = await supabase
          .from('solicitudes_clase')
          .select(`
            *,
            profile:profiles!alumno_id(full_name),
            profesor:profiles!profesor_id(full_name)
          `)
          .in('status', ['Aceita', 'Rejeitada'])
          .gte('updated_at', twoDaysAgo.toISOString())
          .order('updated_at', { ascending: false })
          .limit(20);

        if (reqError) console.error('Erro ao buscar notificações:', reqError);

        // Buscar mudanças recentes nos slots de professores
        const { data: recentSlotChanges, error: slotError } = await supabase
          .from('class_slots')
          .select(`
            *,
            professor:profiles!professor_id(full_name)
          `)
          .gte('updated_at', twoDaysAgo.toISOString())
          .order('updated_at', { ascending: false })
          .limit(20);

        if (slotError) console.error('Erro ao buscar mudanças de horários:', slotError);

        // Formatar notificações
        const notifications = [];

        // Adicionar solicitações processadas
        (recentRequests || []).forEach(req => {
          notifications.push({
            id: `req-${req.solicitud_id}`,
            type: req.status === 'Aceita' ? 'accepted' : 'rejected',
            title: req.status === 'Aceita' ? 'Aluno aceito' : 'Solicitação rejeitada',
            message: `${req.profesor?.full_name || 'Professor'} ${req.status === 'Aceita' ? 'aceitou' : 'rejeitou'} ${req.profile?.full_name || 'aluno'}`,
            timestamp: req.updated_at,
            icon: req.status === 'Aceita' ? CheckCircle : XCircle
          });
        });

        // Agrupar mudanças de slots por professor
        const slotChangesByProfessor = {};
        (recentSlotChanges || []).forEach(slot => {
          const profId = slot.professor_id;
          if (!slotChangesByProfessor[profId]) {
            slotChangesByProfessor[profId] = {
              professorName: slot.professor?.full_name || 'Professor',
              changes: []
            };
          }
          slotChangesByProfessor[profId].changes.push(slot);
        });

        // Adicionar mudanças de horários como notificações
        Object.values(slotChangesByProfessor).forEach(({ professorName, changes }) => {
          const inactiveCount = changes.filter(c => c.status === 'inactive').length;
          const filledCount = changes.filter(c => c.status === 'filled').length;

          if (inactiveCount > 0 || filledCount > 0) {
            notifications.push({
              id: `slot-${professorName}-${changes[0]?.id}`,
              type: 'schedule_change',
              title: 'Alteração de horários',
              message: `${professorName} alterou ${changes.length} horário(s)`,
              details: inactiveCount > 0 ? `${inactiveCount} indisponibilizado(s)` : `${filledCount} ocupado(s)`,
              timestamp: changes[0]?.updated_at,
              icon: Calendar
            });
          }
        });

        // Ordenar notificações por data
        notifications.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        setPendenciasData({
          studentsWithoutProfessor: studentsWithoutProf,
          studentsWithAvailableClasses: studentsWithClasses,
          packagesExpiringSoon: expiringPackages.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry),
          recentNotifications: notifications.slice(0, 15)
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
    };

    loadPendencias();
  }, [isSuperadmin, students, allBillings, allAppointments, classSlots]);

  // Contar totais de pendências
  const pendenciasCounts = useMemo(() => ({
    withoutProfessor: pendenciasData.studentsWithoutProfessor.length,
    withClasses: pendenciasData.studentsWithAvailableClasses.length,
    expiring: pendenciasData.packagesExpiringSoon.length,
    notifications: pendenciasData.recentNotifications.length,
    historico: (historico?.length || 0) + (historyNotifications?.length || 0),
    total: pendenciasData.studentsWithoutProfessor.length +
      pendenciasData.studentsWithAvailableClasses.length +
      pendenciasData.packagesExpiringSoon.length +
      pendenciasData.recentNotifications.length
  }), [pendenciasData, historico, historyNotifications]);

  // Carregar histórico do localStorage
  useEffect(() => {
    if (!isSuperadmin) return;
    const saved = localStorage.getItem('pendencias_historico');
    if (saved) {
      try {
        setHistorico(JSON.parse(saved));
      } catch (e) {
        console.error('Erro ao carregar histórico:', e);
      }
    }
  }, [isSuperadmin]);

  // Salvar histórico no localStorage
  const saveHistorico = (newHistorico) => {
    setHistorico(newHistorico);
    localStorage.setItem('pendencias_historico', JSON.stringify(newHistorico));
  };

  // Ignorar uma pendência (mover para histórico)
  const handleIgnorarPendencia = (tipo, item, titulo, descricao) => {
    setProcessingAction(`ignore-${tipo}-${item.id || item.student?.id}`);

    const novaPendencia = {
      id: `${tipo}-${item.id || item.student?.id}-${Date.now()}`,
      tipo,
      titulo,
      descricao,
      dadosOriginais: item,
      acao: 'ignorada',
      criadoEm: getBrazilDate().toISOString()
    };

    const novoHistorico = [novaPendencia, ...historico];
    saveHistorico(novoHistorico);

    // Remover da lista de pendências atuais
    if (tipo === 'sem_professor') {
      setPendenciasData(prev => ({
        ...prev,
        studentsWithoutProfessor: prev.studentsWithoutProfessor.filter(s => s.id !== item.id)
      }));
    } else if (tipo === 'aulas_disponiveis') {
      setPendenciasData(prev => ({
        ...prev,
        studentsWithAvailableClasses: prev.studentsWithAvailableClasses.filter(s =>
          s.student.id !== item.student.id || s.billing.id !== item.billing.id
        )
      }));
    } else if (tipo === 'pacote_vencendo') {
      setPendenciasData(prev => ({
        ...prev,
        packagesExpiringSoon: prev.packagesExpiringSoon.filter(s =>
          s.student.id !== item.student.id || s.billing.id !== item.billing.id
        )
      }));
    } else if (tipo === 'notificacao') {
      setPendenciasData(prev => ({
        ...prev,
        recentNotifications: prev.recentNotifications.filter(n => n.id !== item.id)
      }));
    }

    toast({
      title: 'Pendência ignorada',
      description: 'Movida para o histórico.',
    });

    setProcessingAction(null);
  };

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

      (allSlots || []).forEach(slot => {
        const profId = slot.professor_id;
        const targetTime = preferredSchedule[slot.day_of_week]; // "HH:mm"

        // Verifica se o slot do professor bate com o horário desejado (ou é próximo ±1h)
        const targetHour = parseInt(targetTime.split(':')[0]);
        const slotHour = parseInt(slot.start_time.split(':')[0]);

        if (Math.abs(slotHour - targetHour) <= 1) {
          if (!professorMatches[profId]) {
            professorMatches[profId] = {
              professor: slot.professor,
              matchedDays: new Set(),
              matchedSlots: [],
              totalDaysRequested: preferredDays.length
            };
          }
          professorMatches[profId].matchedDays.add(slot.day_of_week);
          professorMatches[profId].matchedSlots.push(slot);
        }
      });

      // Calcular porcentagem e ordenar
      const matchResults = Object.values(professorMatches)
        .map(match => ({
          ...match,
          matchedDaysCount: match.matchedDays.size,
          matchPercentage: Math.round((match.matchedDays.size / match.totalDaysRequested) * 100)
        }))
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

      // Converter preferências para o formato do banco de dados (object { dayIndex: time })
      const preferredScheduleObj = {};
      studentPreferences.days.forEach(d => {
        preferredScheduleObj[d] = studentPreferences.time;
      });

      // 1. Apenas salvar as preferências no perfil do aluno. 
      // O assigned_professor_id permanece NULL aguardando aprovação do professor.
      const { data: updateData, error: updateError } = await supabase
        .from('profiles')
        .update({
          assigned_professor_id: null,
          preferred_schedule: preferredScheduleObj
        })
        .eq('id', selectedStudentForVinculacao.id)
        .select();

      if (updateError || !updateData || updateData.length === 0) {
        throw updateError || new Error('Falha ao salvar preferências do aluno.');
      }


      // 2. Criar notificação manual para o professor solicitando aceite do novo aluno
      const { error: notifError } = await supabase.from('notifications').insert({
        user_id: selectedProfessorId,
        type: 'new_student_assignment',
        title: 'Novo Aluno Vinculado a Você',
        description: `O aluno ${selectedStudentForVinculacao.full_name} foi vinculado a você. Aceite para confirmar.`,
        related_user_id: selectedStudentForVinculacao.id,
        metadata: {
          student_id: selectedStudentForVinculacao.id,
          student_name: selectedStudentForVinculacao.full_name,
          old_professor_id: selectedStudentForVinculacao.assigned_professor_id,
          old_professor_name: professors.find(p => p.id === selectedStudentForVinculacao.assigned_professor_id)?.full_name,
          preferred_schedule: preferredScheduleObj
        }
      });

      if (notifError) console.warn('Notification error (non-critical):', notifError);

      // 3. Remover o aluno da lista de pendências localmente
      setPendenciasData(prev => ({
        ...prev,
        studentsWithoutProfessor: prev.studentsWithoutProfessor.filter(
          s => s.id !== selectedStudentForVinculacao.id
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

      toast({
        title: 'Professor vinculado!',
        description: `${selectedStudentForVinculacao.full_name} foi vinculado(a) a ${selectedProf?.full_name || 'Professor'}.`,
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

    // 2. Cria as aulas recorrentes se a solicitação for aceita
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
  const handleOpenPdfModal = (aula) => {
    setSelectedAulaForPdf(aula);
    setPdfMaterialName('');
    setPdfFile(null);
    setShowPdfModal(true);
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

    setIsUploadingPdf(true);

    try {
      // Aqui você pode implementar o upload real para o Supabase Storage
      // Por enquanto, apenas simula o sucesso
      await new Promise(resolve => setTimeout(resolve, 1500));

      toast({
        title: 'Material enviado!',
        description: `"${pdfMaterialName}" foi adicionado com sucesso.`,
      });

      setShowPdfModal(false);
      setPdfMaterialName('');
      setPdfFile(null);
      setSelectedAulaForPdf(null);
    } catch (error) {
      console.error('Erro ao enviar PDF:', error);
      toast({
        title: 'Erro ao enviar',
        description: 'Ocorreu um erro ao enviar o material. Tente novamente.',
        variant: 'destructive'
      });
    } finally {
      setIsUploadingPdf(false);
    }
  };

  // ==========================================
  // RENDER: Painel de Pendências para Superusuário
  // ==========================================
  const renderPendenciasPanel = () => {
    if (!isSuperadmin) return null;

    return (
      <Card className="mb-6 border-l-4 border-purple-500">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-6 w-6 text-purple-600" />
              <div>
                <CardTitle className="text-lg">Painel de Pendências</CardTitle>
                <CardDescription>Central de alertas e ações pendentes</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-purple-700 border-purple-300 bg-purple-50">
                {pendenciasCounts.total} pendência(s)
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={onUpdate}
                disabled={loadingPendencias}
              >
                <RefreshCw className={cn("h-4 w-4", loadingPendencias && "animate-spin")} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Novo Componente: Solicitações de Agendamento Pendentes */}
          <div className="mb-6">
            <ScheduleRequestsPending adminId={professorId} />
          </div>

          <Tabs value={pendenciasFilter} onValueChange={setPendenciasFilter} className="w-full">
            <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6 gap-1">
              <TabsTrigger value="all" className="text-xs sm:text-sm">
                Todas
                <Badge variant="secondary" className="ml-1 text-xs">{pendenciasCounts.total}</Badge>
              </TabsTrigger>
              <TabsTrigger value="without_professor" className="text-xs sm:text-sm">
                <UserX className="h-3 w-3 mr-1 hidden sm:inline" />
                Sem Prof.
                {pendenciasCounts.withoutProfessor > 0 && (
                  <Badge variant="destructive" className="ml-1 text-xs">{pendenciasCounts.withoutProfessor}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="with_classes" className="text-xs sm:text-sm">
                <BookOpen className="h-3 w-3 mr-1 hidden sm:inline" />
                Aulas
                {pendenciasCounts.withClasses > 0 && (
                  <Badge className="ml-1 text-xs bg-blue-500">{pendenciasCounts.withClasses}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="expiring" className="text-xs sm:text-sm">
                <Package className="h-3 w-3 mr-1 hidden sm:inline" />
                Vencendo
                {pendenciasCounts.expiring > 0 && (
                  <Badge className="ml-1 text-xs bg-amber-500">{pendenciasCounts.expiring}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="notifications" className="text-xs sm:text-sm">
                <Bell className="h-3 w-3 mr-1 hidden sm:inline" />
                Avisos
                {pendenciasCounts.notifications > 0 && (
                  <Badge className="ml-1 text-xs bg-green-500">{pendenciasCounts.notifications}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="historico" className="text-xs sm:text-sm">
                <History className="h-3 w-3 mr-1 hidden sm:inline" />
                Histórico
                {pendenciasCounts.historico > 0 && (
                  <Badge className="ml-1 text-xs bg-slate-500">{pendenciasCounts.historico}</Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {loadingPendencias ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
              </div>
            ) : (
              <>
                {/* Alunos sem professor */}
                <TabsContent value="all" className="mt-0">
                  <div className="space-y-4">
                    {/* Seção: Sem Professor */}
                    {pendenciasData.studentsWithoutProfessor.length > 0 && (
                      <div className="border rounded-lg p-4 bg-red-50 border-red-200">
                        <h4 className="font-semibold text-red-800 flex items-center gap-2 mb-3">
                          <UserX className="h-4 w-4" />
                          Alunos sem Professor Vinculado
                        </h4>
                        <div className="space-y-2">
                          {pendenciasData.studentsWithoutProfessor.slice(0, 5).map(student => (
                            <div key={student.id} className="flex items-center justify-between p-2 bg-white rounded border">
                              <div className="flex items-center gap-2">
                                <Avatar className="h-8 w-8">
                                  <AvatarFallback className="bg-red-100 text-red-700">{student.full_name?.[0]}</AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="text-sm font-medium">{student.full_name}</p>
                                  {student.preferred_schedule && Object.keys(student.preferred_schedule).length > 0 ? (
                                    <div className="flex flex-wrap gap-1 mt-0.5">
                                      {Object.entries(student.preferred_schedule).map(([d, t]) => (
                                        <Badge key={d} variant="outline" className="text-[9px] py-0 px-1 h-4 bg-slate-50 border-slate-200 text-slate-500">
                                          {daysOfWeekMap[d]} {t}
                                        </Badge>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-[10px] text-slate-400 italic">Agenda não definida</p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-green-600 border-green-300 hover:bg-green-50 text-xs"
                                  onClick={() => handleOpenVincularModal(student)}
                                >
                                  <UserPlus className="h-3 w-3 mr-1" />
                                  Vincular
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-slate-500 hover:text-slate-700 text-xs"
                                  onClick={() => handleIgnorarPendencia('sem_professor', student, 'Aluno sem professor', student.full_name)}
                                  disabled={processingAction === `ignore-sem_professor-${student.id}`}
                                >
                                  <EyeOff className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          ))}
                          {pendenciasData.studentsWithoutProfessor.length > 5 && (
                            <p className="text-xs text-red-600 text-center mt-2">
                              +{pendenciasData.studentsWithoutProfessor.length - 5} aluno(s) mais...
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Seção: Com Aulas Disponíveis */}
                    {pendenciasData.studentsWithAvailableClasses.length > 0 && (
                      <div className="border rounded-lg p-4 bg-blue-50 border-blue-200">
                        <h4 className="font-semibold text-blue-800 flex items-center gap-2 mb-3">
                          <BookOpen className="h-4 w-4" />
                          Alunos com Aulas Disponíveis
                        </h4>
                        <div className="space-y-2">
                          {pendenciasData.studentsWithAvailableClasses.slice(0, 5).map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between p-2 bg-white rounded border">
                              <div className="flex items-center gap-2">
                                <Avatar className="h-8 w-8">
                                  <AvatarFallback className="bg-blue-100 text-blue-700">{item.student.full_name?.[0]}</AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="text-sm font-medium">{item.student.full_name}</p>
                                  <p className="text-xs text-slate-500">{item.packageName}</p>
                                </div>
                              </div>
                              <Badge className="bg-blue-500 text-xs">{item.availableClasses} aula(s)</Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Seção: Pacotes Vencendo */}
                    {pendenciasData.packagesExpiringSoon.length > 0 && (
                      <div className="border rounded-lg p-4 bg-amber-50 border-amber-200">
                        <h4 className="font-semibold text-amber-800 flex items-center gap-2 mb-3">
                          <Package className="h-4 w-4" />
                          Pacotes Expirando em 5 Dias
                        </h4>
                        <div className="space-y-2">
                          {pendenciasData.packagesExpiringSoon.slice(0, 5).map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between p-2 bg-white rounded border">
                              <div className="flex items-center gap-2">
                                <Avatar className="h-8 w-8">
                                  <AvatarFallback className="bg-amber-100 text-amber-700">{item.student.full_name?.[0]}</AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="text-sm font-medium">{item.student.full_name}</p>
                                  <p className="text-xs text-slate-500">{item.packageName}</p>
                                </div>
                              </div>
                              <Badge className={cn(
                                "text-xs",
                                item.daysUntilExpiry <= 1 ? "bg-red-500" :
                                  item.daysUntilExpiry <= 3 ? "bg-amber-500" : "bg-yellow-500"
                              )}>
                                {item.daysUntilExpiry === 0 ? 'Hoje!' :
                                  item.daysUntilExpiry === 1 ? 'Amanhã' :
                                    `${item.daysUntilExpiry} dias`}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Seção: Notificações */}
                    {pendenciasData.recentNotifications.length > 0 && (
                      <div className="border rounded-lg p-4 bg-green-50 border-green-200">
                        <h4 className="font-semibold text-green-800 flex items-center gap-2 mb-3">
                          <Bell className="h-4 w-4" />
                          Atividades Recentes (48h)
                        </h4>
                        <div className="space-y-2">
                          {pendenciasData.recentNotifications.slice(0, 5).map((notif, idx) => {
                            const NotifIcon = notif.icon || Bell;
                            return (
                              <div key={notif.id || idx} className="flex items-center gap-3 p-2 bg-white rounded border">
                                <div className={cn(
                                  "p-2 rounded-full",
                                  notif.type === 'accepted' ? "bg-green-100" :
                                    notif.type === 'rejected' ? "bg-red-100" : "bg-blue-100"
                                )}>
                                  <NotifIcon className={cn(
                                    "h-4 w-4",
                                    notif.type === 'accepted' ? "text-green-600" :
                                      notif.type === 'rejected' ? "text-red-600" : "text-blue-600"
                                  )} />
                                </div>
                                <div className="flex-1">
                                  <p className="text-sm font-medium">{notif.title}</p>
                                  <p className="text-xs text-slate-500">{notif.message}</p>
                                  {notif.details && (
                                    <p className="text-xs text-slate-400">{notif.details}</p>
                                  )}
                                </div>
                                <span className="text-xs text-slate-400">
                                  {notif.timestamp && formatDistanceToNowStrict(new Date(notif.timestamp), { locale: ptBR, addSuffix: true })}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Sem pendências */}
                    {pendenciasCounts.total === 0 && (
                      <div className="text-center py-8 text-slate-500">
                        <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-400" />
                        <p className="font-semibold">Tudo em ordem!</p>
                        <p className="text-sm">Não há pendências no momento.</p>
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* Tab: Sem Professor */}
                <TabsContent value="without_professor" className="mt-0">
                  <ScrollArea className="h-[300px]">
                    {pendenciasData.studentsWithoutProfessor.length > 0 ? (
                      <div className="space-y-2">
                        {pendenciasData.studentsWithoutProfessor.map(student => (
                          <div key={student.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200">
                            <div className="flex items-center gap-3">
                              <Avatar>
                                <AvatarFallback className="bg-red-200 text-red-800">{student.full_name?.[0]}</AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">{student.full_name}</p>
                                <p className="text-sm text-slate-500">
                                  Código: {student.student_code || 'N/A'} | Email: {student.real_email || student.email || 'N/A'}
                                </p>
                              </div>
                            </div>
                            <Badge variant="destructive">Sem Professor</Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-slate-500">
                        <Users className="h-12 w-12 mx-auto mb-2 text-green-400" />
                        <p>Todos os alunos têm professor vinculado.</p>
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>

                {/* Tab: Com Aulas */}
                <TabsContent value="with_classes" className="mt-0">
                  <ScrollArea className="h-[300px]">
                    {pendenciasData.studentsWithAvailableClasses.length > 0 ? (
                      <div className="space-y-2">
                        {pendenciasData.studentsWithAvailableClasses.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                            <div className="flex items-center gap-3">
                              <Avatar>
                                <AvatarFallback className="bg-blue-200 text-blue-800">{item.student.full_name?.[0]}</AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">{item.student.full_name}</p>
                                <p className="text-sm text-slate-500">{item.packageName}</p>
                              </div>
                            </div>
                            <Badge className="bg-blue-600">{item.availableClasses} aulas disponíveis</Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-slate-500">
                        <BookOpen className="h-12 w-12 mx-auto mb-2 text-slate-400" />
                        <p>Nenhum aluno com aulas disponíveis encontrado.</p>
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>

                {/* Tab: Vencendo */}
                <TabsContent value="expiring" className="mt-0">
                  <ScrollArea className="h-[300px]">
                    {pendenciasData.packagesExpiringSoon.length > 0 ? (
                      <div className="space-y-2">
                        {pendenciasData.packagesExpiringSoon.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-200">
                            <div className="flex items-center gap-3">
                              <Avatar>
                                <AvatarFallback className="bg-amber-200 text-amber-800">{item.student.full_name?.[0]}</AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">{item.student.full_name}</p>
                                <p className="text-sm text-slate-500">
                                  {item.packageName} - Vence em {format(new Date(item.billing.end_date), 'dd/MM/yyyy')}
                                </p>
                              </div>
                            </div>
                            <Badge className={cn(
                              item.daysUntilExpiry <= 1 ? "bg-red-500" :
                                item.daysUntilExpiry <= 3 ? "bg-amber-500" : "bg-yellow-500"
                            )}>
                              {item.daysUntilExpiry === 0 ? 'Vence Hoje!' :
                                item.daysUntilExpiry === 1 ? 'Vence Amanhã' :
                                  `${item.daysUntilExpiry} dias restantes`}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-slate-500">
                        <Package className="h-12 w-12 mx-auto mb-2 text-green-400" />
                        <p>Nenhum pacote próximo do vencimento.</p>
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>

                {/* Tab: Notificações */}
                <TabsContent value="notifications" className="mt-0">
                  <ScrollArea className="h-[300px]">
                    {pendenciasData.recentNotifications.length > 0 ? (
                      <div className="space-y-2">
                        {pendenciasData.recentNotifications.map((notif, idx) => {
                          const NotifIcon = notif.icon || Bell;
                          return (
                            <div key={notif.id || idx} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border">
                              <div className={cn(
                                "p-2 rounded-full",
                                notif.type === 'accepted' ? "bg-green-100" :
                                  notif.type === 'rejected' ? "bg-red-100" : "bg-blue-100"
                              )}>
                                <NotifIcon className={cn(
                                  "h-5 w-5",
                                  notif.type === 'accepted' ? "text-green-600" :
                                    notif.type === 'rejected' ? "text-red-600" : "text-blue-600"
                                )} />
                              </div>
                              <div className="flex-1">
                                <p className="font-medium">{notif.title}</p>
                                <p className="text-sm text-slate-600">{notif.message}</p>
                                {notif.details && (
                                  <p className="text-xs text-slate-400 mt-1">{notif.details}</p>
                                )}
                              </div>
                              <span className="text-xs text-slate-400 whitespace-nowrap">
                                {notif.timestamp && formatDistanceToNowStrict(new Date(notif.timestamp), { locale: ptBR, addSuffix: true })}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-slate-500">
                        <Bell className="h-12 w-12 mx-auto mb-2 text-slate-400" />
                        <p>Nenhuma atividade recente nas últimas 48 horas.</p>
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>

                {/* Tab: Histórico */}
                <TabsContent value="historico" className="mt-0">
                  <div className="flex justify-between items-center mb-4">
                    <p className="text-sm text-slate-500">Histórico de notificações e pendências ignoradas</p>
                    {historico.length > 0 && (
                      <Button variant="ghost" size="sm" onClick={handleLimparHistorico} className="text-red-500 hover:text-red-700">
                        Limpar ignorados
                      </Button>
                    )}
                  </div>
                  <ScrollArea className="h-[400px] pr-2">
                    <div className="space-y-4">
                      {/* Notificações Resolvidas do Banco */}
                      {historyNotifications.length > 0 && (
                        <div className="space-y-2">
                          <h5 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Notificações Processadas</h5>
                          {historyNotifications.map(notif => (
                            <div key={notif.id} className="p-3 border rounded-lg bg-white shadow-sm">
                              <div className="flex items-start justify-between mb-1">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-[10px] py-0 h-4">
                                    {notif.type === 'new_student_assignment' ? 'Novo Aluno' :
                                      notif.type === 'student_reallocation' ? 'Realocação' : 'Geral'}
                                  </Badge>
                                  <p className="font-semibold text-sm">{notif.title}</p>
                                </div>
                                <span className="text-[10px] text-slate-400">
                                  {format(new Date(notif.created_at), "dd/MM/yy HH:mm")}
                                </span>
                              </div>
                              <p className="text-xs text-slate-600 line-clamp-2">{notif.description || notif.content?.message}</p>
                              <div className="flex items-center justify-between mt-2">
                                <Badge variant={notif.status === 'accepted' ? 'default' : notif.status === 'rejected' ? 'destructive' : 'secondary'} className="text-[9px] py-0 px-1.5 h-4">
                                  {notif.status === 'accepted' ? 'Aceito' : notif.status === 'rejected' ? 'Rejeitado' : 'Lido'}
                                </Badge>
                                {notif.resolved_at && (
                                  <span className="text-[9px] text-slate-400 italic">
                                    Resolvido {formatDistanceToNowStrict(new Date(notif.resolved_at), { locale: ptBR, addSuffix: true })}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Pendências Ignoradas Localmente */}
                      {historico.length > 0 && (
                        <div className="space-y-2">
                          <h5 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Avisos Ignorados</h5>
                          {historico.map((item) => (
                            <div key={item.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                              <div className="flex items-center gap-3">
                                <div className="p-2 rounded-full bg-slate-200">
                                  <EyeOff className="h-4 w-4 text-slate-500" />
                                </div>
                                <div className="flex-1">
                                  <p className="font-medium text-sm text-slate-700">{item.titulo}</p>
                                  <p className="text-xs text-slate-500">{item.descricao}</p>
                                  <p className="text-[10px] text-slate-400 mt-1">
                                    Ignorado {formatDistanceToNowStrict(new Date(item.criadoEm), { locale: ptBR, addSuffix: true })}
                                  </p>
                                </div>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRestaurarPendencia(item)}
                                className="text-blue-600 border-blue-200 hover:bg-white text-xs h-7 px-2"
                              >
                                <Eye className="h-3 w-3 mr-1" />
                                Restaurar
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}

                      {historyNotifications.length === 0 && historico.length === 0 && !loadingHistoryNotifs && (
                        <div className="text-center py-12 text-slate-500">
                          <History className="h-12 w-12 mx-auto mb-2 text-slate-300" />
                          <p>Nenhuma notificação ou pendência no histórico.</p>
                        </div>
                      )}

                      {loadingHistoryNotifs && (
                        <div className="flex justify-center py-4">
                          <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
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
                {/* Info do Aluno */}
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-blue-100 text-blue-700">
                      {selectedStudentForVinculacao?.full_name?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{selectedStudentForVinculacao?.full_name}</p>
                    <p className="text-sm text-slate-500">
                      Código: {selectedStudentForVinculacao?.student_code || 'N/A'}
                    </p>
                  </div>
                </div>

                {/* PASO 1: Seleccionar Preferencias */}
                {matchingStep === 1 && (
                  <div className="space-y-4">
                    <div className="space-y-3">
                      <Label className="text-base font-semibold">Dias da Semana Preferidos</Label>
                      <div className="grid grid-cols-7 gap-2">
                        {daysOfWeek.map((day, idx) => (
                          <div
                            key={idx}
                            onClick={() => togglePreferenceDay(idx)}
                            className={cn(
                              "p-2 text-center rounded-lg cursor-pointer border-2 transition-all",
                              studentPreferences.days.includes(idx)
                                ? "bg-green-100 border-green-500 text-green-800"
                                : "bg-slate-50 border-slate-200 hover:border-slate-400"
                            )}
                          >
                            <span className="text-xs font-semibold">{day.substring(0, 3)}</span>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-slate-500">
                        {studentPreferences.days.length} dia(s) selecionado(s)
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="preferred-time">Horário Preferido</Label>
                      <Select
                        value={studentPreferences.time}
                        onValueChange={(time) => setStudentPreferences(prev => ({ ...prev, time }))}
                      >
                        <SelectTrigger id="preferred-time">
                          <Clock className="h-4 w-4 mr-2 text-slate-500" />
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                          {TIME_OPTIONS.map(time => (
                            <SelectItem key={time} value={time}>{time}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-slate-500">
                        Professores com horários próximos (±1 hora) também serão sugeridos
                      </p>
                    </div>
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
                                {apt.student?.spanish_level ? 'Espanhol' : 'Inglês'} - {apt.student?.spanish_level || 'Básico'}
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
                      {nextClass.student?.spanish_level ? 'Espanhol' : 'Inglês'}
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
                        <a href="https://meet.google.com/tmi-xwmg-kua" target="_blank" rel="noopener noreferrer">
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
          <DialogContent className="max-w-md">
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
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowPdfModal(false)}
                disabled={isUploadingPdf}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleUploadPdf}
                disabled={isUploadingPdf || !pdfMaterialName.trim() || !pdfFile}
                className="bg-sky-600 hover:bg-sky-700"
              >
                {isUploadingPdf ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Enviar Material
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default HomeTab;

