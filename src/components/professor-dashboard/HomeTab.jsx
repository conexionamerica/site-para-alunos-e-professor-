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
import { Check, X, Loader2, CalendarHeart, Clock, CalendarDays, AlertTriangle, Users, BookOpen, Package, Bell, Filter, UserX, Calendar, CheckCircle, XCircle, RefreshCw, History, Eye, EyeOff, ExternalLink, UserPlus, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { TabsContent, Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

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
  const [studentPreferences, setStudentPreferences] = useState({
    days: [], // [0-6] días seleccionados
    time: '08:00' // horario preferido
  });
  const [matchedProfessors, setMatchedProfessors] = useState([]);
  const [isSearchingMatches, setIsSearchingMatches] = useState(false);

  // Extração segura das propriedades
  const professorId = dashboardData?.professorId;
  const data = dashboardData?.data || {};
  const loading = dashboardData?.loading || false;
  const onUpdate = dashboardData?.onUpdate;
  const isSuperadmin = dashboardData?.isSuperadmin || false;

  // SINCRONIZAÇÃO: Usar appointments do dashboardData como fonte única
  const allAppointments = data?.appointments || [];
  const allProfiles = data?.allProfiles || [];
  const students = data?.students || [];
  const professors = data?.professors || [];
  const allBillings = data?.allBillings || [];
  const classSlots = data?.classSlots || [];

  // CORREÇÃO: Calcular nextClass a partir dos appointments centralizados
  const nextClass = useMemo(() => {
    if (!allAppointments || allAppointments.length === 0) return null;
    const now = new Date();
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
    const now = new Date();
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
    const now = new Date();
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
    historico: historico.length,
    total: pendenciasData.studentsWithoutProfessor.length +
      pendenciasData.studentsWithAvailableClasses.length +
      pendenciasData.packagesExpiringSoon.length +
      pendenciasData.recentNotifications.length
  }), [pendenciasData, historico]);

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
      criadoEm: new Date().toISOString()
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
    setSelectedStudentForVinculacao(student);
    setSelectedProfessorId('');
    setProfessorAvailability(null);
    setMatchingStep(1);
    setStudentPreferences({ days: [], time: '08:00' });
    setMatchedProfessors([]);
    setShowVincularModal(true);
  };

  // Buscar profesores compatibles con las preferencias del alumno
  const handleSearchCompatibleProfessors = async () => {
    if (studentPreferences.days.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Selecione pelo menos um dia',
        description: 'Escolha os dias da semana que o aluno prefere.'
      });
      return;
    }

    setIsSearchingMatches(true);

    try {
      // Buscar todos los slots de todos los profesores
      const { data: allSlots, error } = await supabase
        .from('class_slots')
        .select('*, professor:professor_id(id, full_name)')
        .eq('status', 'active')
        .in('day_of_week', studentPreferences.days);

      if (error) throw error;

      // Filtrar por horario (con tolerancia de 1 hora)
      const preferredHour = parseInt(studentPreferences.time.split(':')[0]);
      const relevantSlots = (allSlots || []).filter(slot => {
        const slotHour = parseInt(slot.start_time?.split(':')[0] || '0');
        return Math.abs(slotHour - preferredHour) <= 1;
      });

      // Agrupar por professor y calcular compatibilidad
      const professorMatches = {};

      relevantSlots.forEach(slot => {
        const profId = slot.professor_id;
        if (!professorMatches[profId]) {
          professorMatches[profId] = {
            professor: slot.professor,
            matchedDays: new Set(),
            matchedSlots: [],
            totalDaysRequested: studentPreferences.days.length
          };
        }
        professorMatches[profId].matchedDays.add(slot.day_of_week);
        professorMatches[profId].matchedSlots.push(slot);
      });

      // Calcular porcentaje de match y ordenar
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
          description: `Nenhum professor possui horários disponíveis nos dias e horário selecionados.`
        });
      }

    } catch (error) {
      console.error('Erro ao buscar professores:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao buscar',
        description: error.message
      });
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

      console.log('=== VINCULANDO PROFESSOR ===');
      console.log('Student ID:', selectedStudentForVinculacao.id);
      console.log('Student Name:', selectedStudentForVinculacao.full_name);
      console.log('Professor ID:', selectedProfessorId);
      console.log('Professor Name:', selectedProf?.full_name);

      // Crear los horarios propuestos basados en las preferencias seleccionadas
      const horariosPropuestos = studentPreferences.days.map(dayIndex => ({
        day: daysOfWeek[dayIndex],
        day_index: dayIndex,
        time: studentPreferences.time
      }));

      // 1. Actualizar el assigned_professor_id del estudiante usando RPC para mayor seguridad
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('admin_link_professor', {
          p_student_id: selectedStudentForVinculacao.id,
          p_professor_id: selectedProfessorId
        });

      console.log('RPC Result:', rpcData);

      if (rpcError || (rpcData && rpcData.success === false)) {
        console.error('RPC ERROR:', rpcError || rpcData?.error);

        // Fallback: Intentar update normal si RPC no existe o falla
        console.log('Tentando fallback com update normal...');
        const { data: updateData, error: updateError } = await supabase
          .from('profiles')
          .update({ assigned_professor_id: selectedProfessorId })
          .eq('id', selectedStudentForVinculacao.id)
          .select();

        if (updateError || !updateData || updateData.length === 0) {
          throw updateError || new Error('Falha ao vincular professor via RPC e Update.');
        }
      }

      console.log('Vinculação concluída com sucesso!');

      // 2. Crear notificación para el profesor
      const { error: notifError } = await supabase.from('notifications').insert({
        user_id: selectedProfessorId,
        type: 'new_student_assigned',
        content: {
          message: `Novo aluno atribuído: ${selectedStudentForVinculacao.full_name}`,
          student_id: selectedStudentForVinculacao.id,
          student_name: selectedStudentForVinculacao.full_name,
          horarios_propuestos: horariosPropuestos
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
      setStudentPreferences({ days: [], time: '08:00' });
      setMatchedProfessors([]);

      toast({
        title: 'Professor vinculado!',
        description: `${selectedStudentForVinculacao.full_name} foi vinculado(a) a ${selectedProf?.full_name || 'Professor'}.`,
      });

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
        let currentDate = new Date();
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
          <Tabs value={pendenciasFilter} onValueChange={setPendenciasFilter} className="w-full">
            <TabsList className="grid w-full grid-cols-6 mb-4">
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
                                  <p className="text-xs text-slate-500">Código: {student.student_code || 'N/A'}</p>
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
                    <p className="text-sm text-slate-500">Pendências ignoradas anteriormente</p>
                    {historico.length > 0 && (
                      <Button variant="ghost" size="sm" onClick={handleLimparHistorico} className="text-red-500 hover:text-red-700">
                        Limpar tudo
                      </Button>
                    )}
                  </div>
                  <ScrollArea className="h-[300px]">
                    {historico.length > 0 ? (
                      <div className="space-y-2">
                        {historico.map((item) => (
                          <div key={item.id} className="flex items-center justify-between p-3 bg-slate-100 rounded-lg border border-slate-200">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-full bg-slate-200">
                                <EyeOff className="h-4 w-4 text-slate-500" />
                              </div>
                              <div className="flex-1">
                                <p className="font-medium text-slate-700">{item.titulo}</p>
                                <p className="text-sm text-slate-500">{item.descricao}</p>
                                <p className="text-xs text-slate-400 mt-1">
                                  Ignorado {formatDistanceToNowStrict(new Date(item.criadoEm), { locale: ptBR, addSuffix: true })}
                                </p>
                              </div>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRestaurarPendencia(item)}
                              className="text-blue-600 border-blue-300 hover:bg-blue-50"
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              Restaurar
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-slate-500">
                        <History className="h-12 w-12 mx-auto mb-2 text-slate-400" />
                        <p>Nenhuma pendência ignorada.</p>
                        <p className="text-sm text-slate-400">Quando você ignorar um aviso, ele aparecerá aqui.</p>
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>
              </>
            )}
          </Tabs>
        </CardContent>
      </Card>
    );
  };

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
                  {/* Resumen de búsqueda */}
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-sm text-blue-800">
                      <strong>Busca:</strong> {studentPreferences.days.map(d => daysOfWeekMap[d]).join(', ')} às {studentPreferences.time}
                    </p>
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

        {/* Sección de Aulas - Solo para Profesores (no para Superadmin) */}
        {!isSuperadmin && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-8">
            <div className="lg:col-span-2 bg-white p-4 sm:p-6 rounded-lg shadow-sm">
              <h3 className="font-bold mb-4">Solicitações de Agendamento ({solicitudes.length})</h3>
              {loading ? <div className="flex justify-center p-4"><Loader2 className="w-6 h-6 animate-spin" /></div> :
                solicitudes.length > 0 ? (
                  <div className="space-y-4">
                    {solicitudes.map(req => (
                      <div key={req.solicitud_id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-slate-50 rounded-lg border">
                        <div className="flex items-center gap-4 mb-3 sm:mb-0">
                          <Avatar><AvatarImage src={req.profile?.avatar_url} /><AvatarFallback>{req.profile?.full_name?.[0]}</AvatarFallback></Avatar>
                          <div>
                            <p className="font-semibold">{req.profile?.full_name}</p>
                            {renderHorarios(req.horarios_propuestos)}
                          </div>
                        </div>
                        <div className="flex gap-2 mt-3 sm:mt-0 self-end sm:self-center">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-green-600 border-green-600 hover:bg-green-50 hover:text-green-700"
                            onClick={() => handleUpdateRequestStatus(req.solicitud_id, 'Aceita')}
                            disabled={updatingRequestId === req.solicitud_id}
                          >
                            {updatingRequestId === req.solicitud_id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 border-red-600 hover:bg-red-50 hover:text-red-700"
                            onClick={() => handleUpdateRequestStatus(req.solicitud_id, 'Rejeitada')}
                            disabled={updatingRequestId === req.solicitud_id}
                          >
                            {updatingRequestId === req.solicitud_id ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) :
                  <div className="text-center py-10 text-slate-500">
                    <CalendarHeart className="w-12 h-12 mx-auto mb-2 text-slate-400" />
                    <p className="font-semibold">Nenhuma solicitação pendente.</p>
                    <p className="text-sm">Quando um aluno solicitar uma aula, aparecerá aqui.</p>
                  </div>}
            </div>
            <div className="space-y-4 lg:space-y-8">
              <div className="bg-white rounded-lg border-l-4 border-sky-500 shadow-sm p-4">
                <h3 className="text-lg font-bold mb-2">Próxima Aula</h3>
                {loading ? (
                  <p>Carregando...</p>
                ) : nextClass ? (
                  <>
                    <p className="text-xs text-slate-500">Começa {formatDistanceToNowStrict(new Date(nextClass.class_datetime), { locale: ptBR, addSuffix: true })}</p>
                    <h3 className="text-lg font-bold mt-1">{nextClass.student?.spanish_level ? 'Espanhol' : 'Inglês'}</h3>
                    <p className="text-sm mt-2"><strong>Aluno:</strong> {nextClass.student?.full_name || 'Não definido'}</p>
                    <p className="text-sm"><strong>Nível:</strong> {nextClass.student?.spanish_level || 'Não definido'}</p>
                    <p className="text-sm"><strong>Professor:</strong> {nextClass.professor?.full_name || (data.professors?.find(p => p.id === nextClass.professor_id)?.full_name) || 'Não definido'}</p>
                    <Button asChild className="w-full mt-4 bg-sky-600 hover:bg-sky-700"><a href="https://meet.google.com/tmi-xwmg-kua" target="_blank" rel="noopener noreferrer">Iniciar Aula</a></Button>
                  </>
                ) : (
                  <p className="text-slate-500 text-sm">Nenhuma aula agendada.</p>
                )}
              </div>

              {/* Novo Card: Próximas 24 Horas */}
              <div className="bg-white rounded-lg border-l-4 border-blue-500 shadow-sm p-4">
                <h3 className="text-lg font-bold mb-3">Próximas 24 Horas</h3>
                {loading ? (
                  <p className="text-sm text-slate-500">Carregando...</p>
                ) : next24Hours.length > 0 ? (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {next24Hours.map(apt => {
                      const aptDate = parseISO(apt.class_datetime);
                      return (
                        <div key={apt.id} className="flex justify-between items-center p-2 border rounded hover:bg-slate-50">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-slate-800">
                              {apt.student?.full_name || 'Aluno'}
                            </p>
                            <p className="text-xs text-slate-500">
                              {format(aptDate, "dd/MM 'às' HH:mm", { locale: ptBR })}
                            </p>
                          </div>
                          <div className="text-xs text-slate-600">
                            {apt.duration_minutes || 30} min
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-slate-500 text-sm">Nenhuma aula nas próximas 24 horas.</p>
                )}
              </div>

              {/* Card de Todas as Aulas Agendadas */}
              <div className="bg-white rounded-lg border-l-4 border-emerald-500 shadow-sm p-4">
                <h3 className="text-lg font-bold mb-2">Todas as Aulas Agendadas ({upcomingClasses.length})</h3>
                {loading ? (
                  <p>Carregando...</p>
                ) : upcomingClasses.length > 0 ? (
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {upcomingClasses.map((classItem, index) => (
                      <div
                        key={classItem.id}
                        className={cn(
                          "p-3 rounded-lg border transition-all",
                          index === 0 ? "bg-sky-50 border-sky-200" : "bg-slate-50 border-slate-200"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="text-xs text-slate-500">
                              {formatDistanceToNowStrict(new Date(classItem.class_datetime), { locale: ptBR, addSuffix: true })}
                            </p>
                            <p className="text-sm font-medium">
                              {format(new Date(classItem.class_datetime), "EEE, dd/MM 'às' HH:mm", { locale: ptBR })}
                            </p>
                            <p className="text-xs text-slate-600 mt-1">
                              <strong>Aluno:</strong> {classItem.student?.full_name || 'N/A'}
                            </p>
                          </div>
                          {index === 0 && (
                            <span className="text-xs bg-sky-500 text-white px-2 py-1 rounded-full font-medium">
                              Próxima
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-slate-500">
                    <CalendarDays className="w-10 h-10 mx-auto mb-2 text-slate-400" />
                    <p className="text-sm">Nenhuma aula agendada no momento.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HomeTab;
