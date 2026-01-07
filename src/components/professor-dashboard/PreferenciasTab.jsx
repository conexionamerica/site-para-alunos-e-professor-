// Archivo: src/components/professor-dashboard/PreferenciasTab.jsx

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Switch } from "@/components/ui/switch";
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronsUpDown, Check, History, Loader2, Calendar as CalendarIcon, Lock, AlertTriangle, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from '@/lib/utils';
import { format, parseISO, addMonths, parse, getDay, add, differenceInDays, eachDayOfInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getBrazilDate } from '@/lib/dateUtils';
import { useFormPersistence } from '@/hooks/useFormPersistence';
import { Input } from '@/components/ui/input';
import { Calendar } from "@/components/ui/calendar";
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { Label } from '@/components/ui/label';


const ALL_TIMES = Array.from({ length: 68 }, (_, i) => {
  const totalMinutes = 7 * 60 + i * 15;
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
});

const AssignedPackagesHistory = ({ professorId, onDelete, isSuperadmin }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    // 1. Fetch Logs (Atribuições de Pacotes)
    let query = supabase
      .from('assigned_packages_log')
      .select(`
        id, student_id, package_id, observation, assigned_classes, assigned_at, status, custom_package_name,
        student:profiles!student_id(full_name),
        package:packages(name)
      `);

    if (professorId && professorId !== 'all') {
      query = query.eq('professor_id', professorId);
    } else if (!isSuperadmin) {
      // Se não for admin e não tiver ID, não mostra nada
      setLoading(false);
      return;
    }

    const { data: logs, error: logError } = await query.order('assigned_at', { ascending: false });

    if (logError) {
      console.error("Error fetching logs:", logError);
      setLoading(false);
      return;
    }

    // 2. Fetch Billing (para Datas e Preço Pago)
    const studentIds = [...new Set(logs.map(log => log.student_id))];
    const { data: billings, error: billingError } = await supabase
      .from('billing')
      // CORREÇÃO: Incluído amount_paid na busca
      .select(`id, user_id, package_id, purchase_date, end_date, amount_paid`)
      .in('user_id', studentIds);

    if (billingError) {
      console.error("Error fetching billings:", billingError);
    }

    // 3. Merge Logs com Datas de Billing
    const mergedHistory = logs.map(log => {
      const matchingBilling = (billings || [])
        .filter(b =>
          b.user_id === log.student_id &&
          b.package_id === log.package_id &&
          // A fatura deve ter sido comprada antes ou no momento da atribuição
          (new Date(b.purchase_date) <= new Date(log.assigned_at))
        )
        // Ordem decrescente de purchase_date para pegar a fatura mais relevante/recente
        .sort((a, b) => new Date(b.purchase_date) - new Date(a.purchase_date))[0];

      return {
        ...log,
        start_date: matchingBilling?.purchase_date || null,
        end_date: matchingBilling?.end_date || null,
        total_classes_sent: log.assigned_classes,
        amount_paid: matchingBilling?.amount_paid || 0, // Incluído o preço pago
      };
    });

    setHistory(mergedHistory || []);
    setLoading(false);
  }, [professorId]);

  useEffect(() => {
    fetchHistory();
    // Realtime listener
    const channel = supabase.channel('assigned-packages-history')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'assigned_packages_log'
      }, fetchHistory)
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [fetchHistory, professorId]);

  const handleDeleteWrapper = async (log) => {
    // 1. Otimização: Atualizar o estado local imediatamente
    setHistory(prevHistory => prevHistory.map(item =>
      item.id === log.id
        ? { ...item, status: 'Cancelado' } // <--- Esta linha atualiza o estado
        : item
    ));

    // 2. Chama a ação principal no pai (que atualiza o DB e o Dashboard principal)
    await onDelete(log);
  };

  const StatusBadge = ({ status }) => {
    const isCanceled = status === 'Cancelado';
    const isSpecial = status === 'missed' || status === 'completed' || status === 'rescheduled_credit';

    let variant = 'default';
    if (isCanceled) variant = 'destructive';
    if (isSpecial) variant = 'secondary';

    let label = status;
    if (isCanceled) label = 'Desfeito';
    if (status === 'missed') label = 'Falta';
    if (status === 'completed') label = 'Concluído';
    if (status === 'rescheduled_credit') label = 'Crédito Ativo';

    return (
      <Badge variant={variant}>
        {label}
      </Badge>
    );
  };

  const formatCurrency = (value) => {
    // Garante que valores nulos ou indefinidos sejam tratados como zero
    const numericValue = value || 0;
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(numericValue);
  };

  return (
    <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto"> {/* Aumentado o max-w para caber as novas colunas */}
      <DialogHeader>
        <DialogTitle>Histórico de Pacotes Incluídos</DialogTitle>
      </DialogHeader>
      <div className="max-h-[60vh] overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Aluno</TableHead>
              <TableHead>Pacote</TableHead>
              <TableHead>Aulas Total</TableHead>
              <TableHead>Preço Pago</TableHead> {/* NOVA COLUNA */}
              <TableHead>Data Início</TableHead>
              <TableHead>Data Fim</TableHead>
              <TableHead>Data Atribuição</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan="9" className="text-center">
                  <Loader2 className="mx-auto my-4 h-6 w-6 animate-spin" />
                </TableCell>
              </TableRow>
            ) : history.length > 0 ? (
              history.map(log => (
                <TableRow key={log.id} className={log.status === 'Cancelado' ? 'opacity-60 bg-slate-50' : ''}>
                  <TableCell>{log.student?.full_name || 'N/A'}</TableCell>
                  <TableCell>
                    {log.custom_package_name ? (
                      <div className="flex flex-col">
                        <span className="font-semibold text-sky-700">{log.custom_package_name}</span>
                        <span className="text-xs text-slate-400">{log.package?.name}</span>
                      </div>
                    ) : (
                      log.package?.name || 'Pacote não encontrado'
                    )}
                  </TableCell>

                  {/* DADOS DE AULAS/PREÇO */}
                  <TableCell>{log.total_classes_sent || 'N/A'}</TableCell>
                  <TableCell>{formatCurrency(log.amount_paid)}</TableCell> {/* EXIBIÇÃO DO PREÇO */}

                  {/* DADOS DE DATAS */}
                  {/* Verifica se as datas existem antes de formatar. */}
                  <TableCell>{log.start_date ? format(parseISO(log.start_date), 'dd/MM/yyyy') : 'N/A'}</TableCell>
                  <TableCell>{log.end_date ? format(parseISO(log.end_date), 'dd/MM/yyyy') : 'N/A'}</TableCell>

                  <TableCell>{format(parseISO(log.assigned_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</TableCell>
                  <TableCell>
                    <StatusBadge status={log.status} />
                  </TableCell>
                  <TableCell>
                    {log.status === 'Ativo' || log.status === 'rescheduled_credit' ? (
                      <Button variant="destructive" size="sm" onClick={() => handleDeleteWrapper(log)}>
                        Desfazer
                      </Button>
                    ) : (
                      <Badge variant="destructive" className="bg-red-100 text-red-700 hover:bg-red-100 cursor-default">
                        DESFEITO
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan="9" className="text-center py-8 text-slate-500">
                  Nenhum registro encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </DialogContent>
  );
};


const PreferenciasTab = ({ dashboardData, hideForm = false, hideTable = false }) => {
  const { toast } = useToast();
  const daysOfWeek = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

  // Extração segura das propriedades
  const data = dashboardData?.data || {};
  const loading = dashboardData?.loading || false;
  // CORREÇÃO: Aceitar professorId da prop (dashboardData) pois o AdminTab
  // passa explicitamente o professor selecionado por lá.
  const professorIdFromProps = dashboardData?.professorId;
  const professors = data.professors || [];
  const students = data.students || [];
  const packages = data.packages || [];
  const classSlots = data.classSlots || [];
  const onUpdate = dashboardData?.onUpdate; // Para forçar a recarga no pai
  const isSuperadmin = dashboardData?.isSuperadmin || false;

  // Estado para o professor selecionado.
  // Se vier uma prop definida (ex: do AdminTab), usa ela. Se não, usa null (aguarda seleção).
  const [localProfessorId, setLocalProfessorId] = useState(professorIdFromProps || null);

  // Efeito para sincronizar quando a prop muda (ex: AdminTab muda o filtro)
  useEffect(() => {
    if (professorIdFromProps && professorIdFromProps !== 'all') {
      setLocalProfessorId(professorIdFromProps);
    } else if (professorIdFromProps === 'all' || (professorIdFromProps === null && isSuperadmin)) {
      // Se a prop virar 'all' ou null explícito e for admin, limpa.
      setLocalProfessorId(null);
    }
  }, [professorIdFromProps, isSuperadmin]);

  // ID do professor que será usado efetivamente nas ações
  const effectiveProfessorId = localProfessorId;

  const [slots, setSlots] = useState([]);
  const [isSavingSlots, setIsSavingSlots] = useState(false);

  const [popoverOpen, setPopoverOpen] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [selectedPackage, setSelectedPackage] = useState(null);

  // ESTADOS PARA O PACOTE PADRÃO 'PERSONALIZADO' (agora usado para a nova função)
  const [customClassCount, setCustomClassCount] = useState('');
  const [observation, setObservation] = useState('');

  // NOVOS ESTADOS PARA DETALHES DO AGENDAMENTO (usaremos para 'Personalizado')
  const [pckPersonalData, setPckPersonalData, clearPckPersonalData] = useFormPersistence('package_assignment_form', {
    packageName: '', // (1) Nome do Pacote
    totalClasses: '',
    duration: '30', // Default duration
    dayTimes: {}, // (2) { dayIndex: 'HH:mm' }
    days: [],
    price: '',
    startDate: getBrazilDate(), // NOVA: Data de Início do Customizado
    endDate: addMonths(getBrazilDate(), 1), // Default validity
  });
  // Usamos 'custom' para compatibilidade com o fluxo original que só precisava de customClassCount.
  // Agora, usaremos pckPersonalData para a maioria dos inputs.
  const { packageName, totalClasses, duration, dayTimes, days, price, endDate: pckEndDate, startDate: pckStartDate } = pckPersonalData;

  const handlePckPersonalChange = (field, value) => {
    setPckPersonalData(prev => ({ ...prev, [field]: value }));
  };
  const handleDayTogglePckPersonal = (dayIndex) => {
    setPckPersonalData(prev => {
      const isRemoving = prev.days.includes(dayIndex);
      const newDays = isRemoving
        ? prev.days.filter(d => d !== dayIndex)
        : [...prev.days, dayIndex].sort((a, b) => a - b);

      const newDayTimes = { ...prev.dayTimes };
      if (isRemoving) {
        delete newDayTimes[dayIndex];
      } else {
        newDayTimes[dayIndex] = '08:00'; // Default time for new day
      }

      return { ...prev, days: newDays, dayTimes: newDayTimes };
    });
  };

  const handleDayTimeChange = (dayIndex, time) => {
    setPckPersonalData(prev => ({
      ...prev,
      dayTimes: { ...prev.dayTimes, [dayIndex]: time }
    }));
  };
  // FIM DOS NOVOS ESTADOS

  const [isSubmittingPackage, setIsSubmittingPackage] = useState(false);
  const [liberatingSlot, setLiberatingSlot] = useState(null); // Para mostrar loading en el slot que se está liberando
  const [futureAppointments, setFutureAppointments] = useState([]);
  const [slotOccupancy, setSlotOccupancy] = useState({});
  const [purchaseDate, setPurchaseDate] = useState(getBrazilDate());
  // Estado para a Data de Fim/Validade (Usado por pacotes padrão e Personalizado)
  const [endDate, setEndDate] = useState(addMonths(getBrazilDate(), 1));

  const selectedStudent = students.find(s => s.id === selectedStudentId); // Usa students extraído

  // Determina o pacote selecionado e se é customizado/pckpersonal
  const selectedPackageData = packages.find(p => p.id === parseInt(selectedPackage));

  // CORREÇÃO: Usar isCustomPackageSelected (o nome 'Personalizado') para mostrar o bloco de agendamento flexível
  // Ou se as instruções dizem que o pacote personalizado será o ÚNICO, podemos forçar isso.
  const isCustomPackageSelected = selectedPackageData?.name === 'Personalizado' || selectedPackage === 'custom-choice';

  // Sincronizar selectedPackage com 'Personalizado' se não estiver definido e estiver carregado
  useEffect(() => {
    if (!selectedPackage && packages.length > 0) {
      const personalPkg = packages.find(p => p.name === 'Personalizado');
      if (personalPkg) {
        setSelectedPackage(personalPkg.id.toString());
      }
    }
  }, [packages, selectedPackage]);

  // A lógica do agendamento automático será ativada se for o pacote 'Personalizado'
  const isAutomaticScheduling = isCustomPackageSelected;

  // === CÁLCULO DE AULAS POSSÍVEIS NO PERÍODO ===
  // Calcula quantas aulas podem ser criadas com base nos dias selecionados e no intervalo de datas
  const scheduleValidation = useMemo(() => {
    if (!isAutomaticScheduling || days.length === 0) {
      return { possibleClasses: 0, requestedClasses: 0, isValid: true, daysInPeriod: 0 };
    }

    const requestedClasses = parseInt(totalClasses, 10) || 0;
    const startDate = pckStartDate instanceof Date ? pckStartDate : new Date(pckStartDate);
    const endDateVal = pckEndDate instanceof Date ? pckEndDate : new Date(pckEndDate);

    // Validar datas
    if (isNaN(startDate.getTime()) || isNaN(endDateVal.getTime()) || startDate > endDateVal) {
      return { possibleClasses: 0, requestedClasses, isValid: false, error: 'Datas inválidas', daysInPeriod: 0 };
    }

    // Contar quantas ocorrências de cada dia selecionado existem no período
    let possibleClasses = 0;
    const allDaysInPeriod = eachDayOfInterval({ start: startDate, end: endDateVal });

    allDaysInPeriod.forEach(date => {
      const dayOfWeek = getDay(date);
      if (days.includes(dayOfWeek)) {
        possibleClasses++;
      }
    });

    const daysInPeriod = differenceInDays(endDateVal, startDate) + 1;

    return {
      possibleClasses,
      requestedClasses,
      daysInPeriod,
      isValid: requestedClasses <= possibleClasses,
      exceeds: requestedClasses > possibleClasses,
      shortage: requestedClasses - possibleClasses
    };
  }, [isAutomaticScheduling, days, totalClasses, pckStartDate, pckEndDate]);


  // CORREÇÃO FINAL: Carregar slots do professor selecionado
  useEffect(() => {
    // 1. Limpar estado anterior imediatamente para evitar contaminação entre professores
    setSlots([]);

    if (!Array.isArray(classSlots)) return;
    if (!effectiveProfessorId) return; // Sem professor, não carrega nada

    // 2. Converter ID para String para comparação segura (evita '5' !== 5)
    const targetProfIdStr = String(effectiveProfessorId);

    // 3. Filtrar APENAS os slots do professor selecionado
    const filteredClassSlots = classSlots.filter(s =>
      String(s.professor_id) === targetProfIdStr
    );

    // 4. Criar mapa para merge eficiente
    const existingSlotsMap = new Map();
    filteredClassSlots.forEach(slot => {
      const startTime = slot.start_time.length === 5 ? `${slot.start_time}:00` : slot.start_time;
      existingSlotsMap.set(`${slot.day_of_week}-${startTime}`, slot);
    });

    // 5. Gerar grade completa (7 dias x todos os horários)
    const mergedSlots = [];
    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
      ALL_TIMES.forEach(time => {
        const key = `${dayIndex}-${time}`;
        const existing = existingSlotsMap.get(key);

        if (existing) {
          mergedSlots.push({ ...existing }); // Clone para evitar mutação
        } else {
          // Novo slot (ainda não existe no banco)
          mergedSlots.push({
            professor_id: effectiveProfessorId,
            day_of_week: dayIndex,
            start_time: time,
            status: 'inactive',
          });
        }
      });
    }

    setSlots(mergedSlots);
  }, [classSlots, effectiveProfessorId, loading]);
  // Buscar appointments futuros para marcar slots ocupados
  useEffect(() => {
    const fetchFutureAppointments = async () => {
      if (!effectiveProfessorId) {
        setFutureAppointments([]);
        setSlotOccupancy({});
        return;
      }

      const { data, error } = await supabase
        .from('appointments')
        .select(`
          id, class_datetime, duration_minutes, status,
          student:profiles!student_id(full_name)
        `)
        .eq('professor_id', effectiveProfessorId)
        .gte('class_datetime', getBrazilDate().toISOString())
        .in('status', ['scheduled', 'pending', 'rescheduled']);

      if (error) {
        console.error('Error fetching future appointments:', error);
        return;
      }

      setFutureAppointments(data || []);

      // Mapear appointments para slots
      const occupancy = {};
      (data || []).forEach(apt => {
        const aptDate = parseISO(apt.class_datetime);
        const dayOfWeek = getDay(aptDate);
        const time = format(aptDate, 'HH:mm:ss');
        const duration = apt.duration_minutes || 30;
        const slotsNeeded = Math.ceil(duration / 15);

        // Marcar slot inicial e consecutivos
        for (let i = 0; i < slotsNeeded; i++) {
          const slotTime = add(aptDate, { minutes: i * 15 });
          const slotTimeStr = format(slotTime, 'HH:mm:ss');
          const slotKey = `${dayOfWeek}-${slotTimeStr}`;

          occupancy[slotKey] = {
            appointmentId: apt.id,
            studentName: apt.student?.full_name,
            isFirstSlot: i === 0,
            status: apt.status
          };
        }
      });

      setSlotOccupancy(occupancy);
    };

    // Limpar ocupação anterior enquanto carrega a nova
    setSlotOccupancy({});
    fetchFutureAppointments();
  }, [effectiveProfessorId, loading]);

  const handleSlotToggle = (dayIndex, time) => {
    setSlots(currentSlots =>
      currentSlots.map(slot => {
        if (slot.day_of_week === dayIndex && slot.start_time === time) {
          const newStatus = slot.status === 'active' ? 'inactive' : 'active';
          return slot.status === 'filled' ? slot : { ...slot, status: newStatus };
        }
        return slot;
      })
    );
  };

  const handleDayToggle = (dayIndex, shouldBeActive) => {
    setSlots(currentSlots =>
      currentSlots.map(slot => {
        if (slot.day_of_week === dayIndex && slot.status !== 'filled') {
          return { ...slot, status: shouldBeActive ? 'active' : 'inactive' };
        }
        return slot;
      })
    );
  };

  const handleSaveChanges = async () => {
    // CORREÇÃO: Verificar se há professor selecionado antes de salvar
    if (!effectiveProfessorId) {
      toast({
        variant: 'destructive',
        title: 'Professor não selecionado',
        description: 'Selecione um professor antes de salvar as alterações.'
      });
      return;
    }

    setIsSavingSlots(true);

    // CORREÇÃO: Converter para String para garantir comparação segura (evita problema de '5' !== 5)
    const targetProfIdStr = String(effectiveProfessorId);

    // 1. Tentar filtrar slots que JÁ pertencem ao professor (comparação segura)
    let slotsToUpsert = slots
      .filter(s => String(s.professor_id) === targetProfIdStr)
      .map(s => {
        // Remove campos desnecessários
        const { id, created_at, ...rest } = s;
        // Normaliza o ID para o valor efetivo (preserva o tipo original se possível, senão usa o do scope)
        return { ...rest, professor_id: effectiveProfessorId };
      });

    // 2. Se o filtro retornou vazio, pode ser que estamos salvando pela PRIMEIRA vez
    // (slots foram criados na memória com ID null ou indefinido)
    // Nesse caso, assumimos que TODOS os slots da tela pertencem a este professor
    if (slotsToUpsert.length === 0 && slots.length > 0) {
      // Dupla verificação: Só faz isso se os slots NÃO tiverem ID de outro professor
      const hasOtherProfessorData = slots.some(s => s.professor_id && String(s.professor_id) !== targetProfIdStr);

      if (!hasOtherProfessorData) {
        slotsToUpsert = slots.map(s => {
          const { id, created_at, ...rest } = s;
          return { ...rest, professor_id: effectiveProfessorId };
        });
      } else {
        console.warn("Tentativa de salvar slots misturados abortada por segurança.");
        toast({
          variant: 'destructive',
          title: 'Erro de integridade',
          description: 'Os dados parecerem pertencer a outro professor. Recarregue a página.'
        });
        setIsSavingSlots(false);
        return;
      }
    }

    try {
      const { error } = await supabase.from('class_slots').upsert(slotsToUpsert, {
        onConflict: 'professor_id, day_of_week, start_time'
      });

      if (error) throw error;
      toast({ variant: 'default', title: 'Sucesso!', description: 'Suas preferências de horário foram salvas.' });

      // Chama onUpdate para recarregar os dados no Dashboard principal
      if (onUpdate) onUpdate();

    } catch (error) {
      console.error("Error saving slots:", error);
      toast({ variant: 'destructive', title: 'Erro ao salvar', description: `Não foi possível salvar as alterações: ${error.message}` });
    } finally {
      setIsSavingSlots(false);
    }
  };

  // Función para liberar un horario ocupado
  const handleLiberateSlot = async (slot, occupation) => {
    const slotKey = `${slot.day_of_week}-${slot.start_time}`;

    try {
      // Se há occupation (appointment agendado)
      if (occupation?.appointmentId) {
        const studentName = occupation.studentName || 'Aluno desconhecido';

        // Confirmar com o usuário
        if (!window.confirm(
          `Este horário está ocupado por: ${studentName}\n\n` +
          `Ao liberar este horário:\n` +
          `• O agendamento será CANCELADO\n` +
          `• O horário ficará DISPONÍVEL\n\n` +
          `Deseja continuar?`
        )) {
          return;
        }

        setLiberatingSlot(slotKey);

        // Cancelar o appointment
        const { error: cancelError } = await supabase
          .from('appointments')
          .update({ status: 'cancelled' })
          .eq('id', occupation.appointmentId);

        if (cancelError) throw cancelError;

        toast({
          title: 'Horário liberado!',
          description: `O horário foi liberado. Agendamento de ${studentName} foi cancelado.`
        });

      } else {
        // Liberar slot filled (pacote personalizado)
        if (!window.confirm(
          `Deseja liberar este horário?\n\n` +
          `O horário ficará disponível para novos agendamentos.`
        )) {
          return;
        }

        setLiberatingSlot(slotKey);

        const { error: updateError } = await supabase
          .from('class_slots')
          .update({ status: 'active' })
          .eq('id', slot.id);

        if (updateError) throw updateError;

        toast({
          title: 'Horário liberado!',
          description: 'O horário foi liberado com sucesso.'
        });
      }

      // Recarregar dados
      if (onUpdate) onUpdate();

    } catch (error) {
      console.error('Error liberating slot:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao liberar horário',
        description: error.message
      });
    } finally {
      setLiberatingSlot(null);
    }
  };

  // Funções de exclusão e reversão (esta função DEVE fazer o update no banco de dados)
  const handleDeleteLog = useCallback(async (log) => {
    // 1. Extração de dados expandida incluindo datas mapeadas do histórico
    const { id: logId, student_id: studentId, package_id: packageId, professor_id: logProfessorId, start_date: startDate, end_date: endDate } = log;

    const targetProfessorId = logProfessorId;

    if (!window.confirm("ATENÇÃO: Você está prestes a desfazer a inclusão de um pacote. Isso irá:\n\n1. Marcar o registro como CANCELADO (Permanecerá no histórico).\n2. REMOVER a fatura ativa correspondente.\n3. EXCLUIR TODAS AS AULAS associadas ao pacote (tanto do aluno quanto do professor).\n4. LIBERAR OS HORÁRIOS dos professores.\n\nConfirma a operação?")) {
      return;
    }

    try {
      // Step 1: Mark as Cancelado (Log)
      const { error: updateError } = await supabase
        .from('assigned_packages_log')
        .update({ status: 'Cancelado' })
        .eq('id', logId);

      if (updateError) throw updateError;

      let billingRemoved = false;
      let slotsRevertedCount = 0;
      let deletedAptsCount = 0;

      // DATA START: Use log start_date (vindo do billing) ou hoje como fallback
      const refStartDate = startDate ? parseISO(startDate) : getBrazilDate();
      // DATA END: Use log end_date (vindo do billing)
      const refEndDate = endDate ? parseISO(endDate) : null;

      // Step 2: Identificar e Deletar Appointments (Aulas)
      // Buscamos aulas do aluno neste período para garantir limpeza total
      let aptQuery = supabase
        .from('appointments')
        .select('id, class_slot_id')
        .eq('student_id', studentId)
        .gte('class_datetime', format(refStartDate, "yyyy-MM-dd'T'00:00:00"));

      if (refEndDate) {
        // Se temos data fim, limitamos (formato ISO para fim do dia)
        aptQuery = aptQuery.lte('class_datetime', format(refEndDate, "yyyy-MM-dd'T'23:59:59"));
      }

      // Se o log tem professor, filtramos. Se não, deletamos qualquer aula nesse período (seguro para pacotes recém criados)
      if (targetProfessorId) {
        aptQuery = aptQuery.eq('professor_id', targetProfessorId);
      }

      const { data: apptsToDelete, error: apptFetchError } = await aptQuery;

      if (apptFetchError) throw apptFetchError;

      if (apptsToDelete && apptsToDelete.length > 0) {
        const apptIds = apptsToDelete.map(a => a.id);
        const slotIdsToFree = apptsToDelete.map(a => a.class_slot_id).filter(Boolean);

        // A. Deletar Aulas
        const { error: delApptError, count } = await supabase
          .from('appointments')
          .delete({ count: 'exact' })
          .in('id', apptIds);

        if (delApptError) throw delApptError;
        deletedAptsCount = count;

        // B. Liberar Slots (Se houver IDs de slots vinculados, volta para 'active')
        if (slotIdsToFree.length > 0) {
          const uniqueSlotIds = [...new Set(slotIdsToFree)];
          // Cuidado: só liberar se não houver outra aula lá?
          // Como deletamos a aula em A, o slot deve ficar livre.
          const { error: slotError, count: slotCount } = await supabase
            .from('class_slots')
            .update({ status: 'active' }, { count: 'exact' })
            .in('id', uniqueSlotIds);

          if (!slotError) slotsRevertedCount = slotCount;
        }
      }

      // Step 3: Deletar Fatura (Billing)
      // O histórico já mapeou a fatura correta em 'start_date' (que é o purchase_date)
      if (startDate) {
        const { error: billError } = await supabase
          .from('billing')
          .delete()
          .eq('user_id', studentId)
          .eq('package_id', packageId)
          .eq('purchase_date', startDate); // Match exato com o log visualizado

        if (!billError) billingRemoved = true;
      } else {
        // Fallback se não tivermos data exata: deletar último billing ativo desse pacote
        const { data: fallbackBilling } = await supabase
          .from('billing')
          .select('id')
          .eq('user_id', studentId)
          .eq('package_id', packageId)
          .order('purchase_date', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (fallbackBilling) {
          const { error: fbError } = await supabase.from('billing').delete().eq('id', fallbackBilling.id);
          if (!fbError) billingRemoved = true;
        }
      }

      // Step 4: Limpar Solicitações Recorrentes (Legado)
      // Mantemos por segurança caso tenha sido criado via solicitação
      try {
        const { error: reqDeleteError } = await supabase
          .from('solicitudes_clase')
          .delete()
          .eq('alumno_id', studentId)
          .eq('is_recurring', true)
          .eq('status', 'Aceita')
          .gte('updated_at', format(refStartDate, "yyyy-MM-dd'T'00:00:00")); // Criadas a partir do início do pacote

        if (reqDeleteError) console.warn("Erro ao limpar solicitações:", reqDeleteError);
      } catch (e) {
        console.warn("Ignorando erro limpeza solicitação:", e);
      }

      // Mensagem de sucesso detalhada
      let message = 'Pacote desfeito com sucesso.';
      if (billingRemoved) message += ' Fatura removida.';
      if (deletedAptsCount > 0) message += ` ${deletedAptsCount} aulas removidas (Professor notificável).`;
      if (slotsRevertedCount > 0) message += ` ${slotsRevertedCount} horários liberados.`;

      toast({ variant: 'default', title: 'Operação Completa', description: message });

      if (onUpdate) onUpdate();

    } catch (error) {
      console.error("Error in handleDeleteLog:", error);
      toast({
        variant: 'destructive',
        title: 'Erro ao desfazer pacote',
        description: `Ocorreu um erro: ${error.message}`
      });
    }
  }, [effectiveProfessorId, toast, onUpdate]);

  const handleAssignPackage = async (e) => {
    e.preventDefault();

    if (!selectedStudentId || !selectedPackage) {
      toast({ variant: 'destructive', title: 'Campos obrigatórios', description: 'Selecione aluno e pacote.' });
      return;
    }

    if (!selectedPackageData) {
      toast({ variant: 'destructive', title: 'Pacote não encontrado' });
      return;
    }

    // Permitir continuar se for superadmin mesmo sem professor (será gerada pendência)
    // REMOVIDO: effectiveProfessorId é sempre null, então sempre será pendência.
    // if (!effectiveProfessorId && !isSuperadmin) {
    //   toast({ variant: 'destructive', title: 'Cuidado', description: 'Selecione um professor ou use o perfil de administrador para gerar pendências.' });
    //   return;
    // }

    // VALIDAÇÃO ESPECÍFICA PARA PERSONALIZADO
    if (isAutomaticScheduling) {
      if (!totalClasses || !duration || days.length === 0 || !price || !packageName) {
        toast({
          variant: 'destructive',
          title: 'Campos obrigatórios',
          description: 'Preencha Nome do Pacote, Aulas, Preço e selecione os dias/horários.'
        });
        return;
      }

      // NOVA VALIDAÇÃO: Verificar se o período comporta o número de aulas
      if (scheduleValidation.exceeds) {
        toast({
          variant: 'destructive',
          title: 'Período insuficiente',
          description: `O período selecionado comporta apenas ${scheduleValidation.possibleClasses} aulas, mas você solicitou ${scheduleValidation.requestedClasses}. Aumente o período ou reduza o número de aulas.`
        });
        return;
      }
    }

    setIsSubmittingPackage(true);

    try {
      const classesToRegister = isAutomaticScheduling ? parseInt(totalClasses, 10) : selectedPackageData.number_of_classes;
      const priceToRegister = isAutomaticScheduling ? parseFloat(price) : selectedPackageData.price;

      // CORREÇÃO: Garantir que as datas sejam objetos Date válidos
      const rawStartDate = isAutomaticScheduling ? pckStartDate : purchaseDate;
      const rawEndDate = isAutomaticScheduling ? pckEndDate : endDate;
      const finalStartDate = rawStartDate instanceof Date ? rawStartDate : new Date(rawStartDate);
      const finalEndDate = rawEndDate instanceof Date ? rawEndDate : new Date(rawEndDate);

      // Validar se as datas são válidas
      if (isNaN(finalStartDate.getTime()) || isNaN(finalEndDate.getTime())) {
        throw new Error('Datas inválidas. Verifique a data de início e fim.');
      }

      const classDurationMinutes = isAutomaticScheduling ? parseInt(duration, 10) : 30;
      const slotsPerClass = Math.ceil(classDurationMinutes / 15);

      // --- 1. VALIDAÇÃO DE DISPONIBILIDADE E GERAÇÃO DE AGENDAMENTOS ---
      let appointmentInserts = [];
      let conflictsCount = 0;

      if (isAutomaticScheduling) {
        let allSlots = [];
        let existingAppts = [];

        // Fetch dados do professor apenas se um professor for selecionado
        // REMOVIDO: effectiveProfessorId é sempre null, então não busca slots do professor.
        // if (effectiveProfessorId) {
        //   const { data: slots, error: slotsError } = await supabase
        //     .from('class_slots')
        //     .select('*')
        //     .eq('professor_id', effectiveProfessorId);

        //   if (slotsError) throw new Error("Erro ao buscar horários do professor.");
        //   allSlots = slots || [];

        //   const { data: appts } = await supabase
        //     .from('appointments')
        //     .select('class_datetime, duration_minutes')
        //     .eq('professor_id', effectiveProfessorId)
        //     .gte('class_datetime', finalStartDate.toISOString())
        //     .in('status', ['scheduled', 'rescheduled']);
        //   existingAppts = appts || [];
        // }

        // GERAR AGENDAMENTOS
        let currentDate = new Date(finalStartDate);
        let classesScheduled = 0;

        while (classesScheduled < classesToRegister && currentDate <= finalEndDate) {
          const dayIdx = getDay(currentDate);

          if (days.includes(dayIdx)) {
            const startTime = dayTimes[dayIdx];
            const startTimeFull = `${startTime}:00`;
            const startTimeObj = parse(startTimeFull, 'HH:mm:ss', currentDate);

            const newSlotStart = startTimeObj;
            const newSlotEnd = add(newSlotStart, { minutes: classDurationMinutes });

            let hasConflict = false;
            let isInactive = false;

            // REMOVIDO: Lógica de verificação de slots do professor, pois effectiveProfessorId é sempre null.
            // if (effectiveProfessorId) {
            //   // Verifica se horários escolhidos estão ativos
            //   for (let i = 0; i < slotsPerClass; i++) {
            //     const slotTimeObj = parse(startTimeFull, 'HH:mm:ss', new Date());
            //     const slotTime = format(add(slotTimeObj, { minutes: i * 15 }), 'HH:mm:ss');
            //     const matchingSlot = allSlots.find(s => s.day_of_week === dayIdx && s.start_time === slotTime);
            //     if (!matchingSlot || matchingSlot.status !== 'active') {
            //       isInactive = true;
            //       break;
            //     }
            //   }

            //   // Verifica conflito com aulas já existentes
            //   hasConflict = existingAppts.some(apt => {
            //     const aptStart = parseISO(apt.class_datetime);
            //     const aptEnd = add(aptStart, { minutes: apt.duration_minutes || 30 });
            //     return (newSlotStart < aptEnd && newSlotEnd > aptStart);
            //   });
            // }

            // Se houver conflito ou estiver inativo, incrementamos contador
            // REMOVIDO: A lógica de conflito/inativo para professor, pois não há professor.
            // if (hasConflict || isInactive) {
            //   conflictsCount++;
            //   // Se o usuário optar por gerar pendência, criamos sem professor
            //   appointmentInserts.push({
            //     student_id: selectedStudentId,
            //     professor_id: null, // Pendência
            //     class_datetime: newSlotStart.toISOString(),
            //     class_slot_id: null,
            //     status: 'scheduled',
            //     duration_minutes: classDurationMinutes,
            //   });
            // } else {
            // Tudo OK, cria com o professor (ou sem, se nenhum foi selecionado)
            // const primarySlot = effectiveProfessorId
            //   ? allSlots.find(s => s.day_of_week === dayIdx && s.start_time === startTimeFull)
            //   : null;

            appointmentInserts.push({
              student_id: selectedStudentId,
              professor_id: null, // Sempre null para pendência
              class_datetime: newSlotStart.toISOString(),
              class_slot_id: null, // Não há slot específico sem professor
              status: 'scheduled',
              duration_minutes: classDurationMinutes,
            });
            // }
            classesScheduled++;
          }
          currentDate = add(currentDate, { days: 1 });
        }

        // --- SINALIZAÇÃO DE CONFLITOS ---
        // REMOVIDO: Lógica de sinalização de conflitos, pois não há professor para verificar.
        // if (effectiveProfessorId && conflictsCount > 0) {
        //   if (!window.confirm(`Sinalização de Agenda: O professor selecionado possui ${conflictsCount} conflitos de horário ou horários inativos para este pacote.\n\nDeseja gerar essas ${conflictsCount} aulas como PENDÊNCIAS (sem professor atribuído)?`)) {
        //     setIsSubmittingPackage(false);
        //     return;
        //   }
        // }

        if (appointmentInserts.length === 0) {
          throw new Error("Não foi possível agendar nenhuma aula no período selecionado. Verifique os dias escolhidos.");
        }
      }

      // --- 2. VERIFICAR SE PRECISA APROVAÇÃO DO PROFESSOR ---
      // Se há professor selecionado, criar SOLICITAÇÃO para aprovação
      // Se não há professor, criar pacote diretamente (como pendência)
      // REMOVIDO: O fluxo de solicitação de aprovação do professor.
      // if (effectiveProfessorId) {
      //   // CRIAR SOLICITAÇÃO DE AULAS PARA O PROFESSOR APROVAR
      //   const solicitacaoData = {
      //     type: 'atribuicao_aulas', // Tipo especial para atribuição de aulas/pacotes
      //     is_recurring: isAutomaticScheduling,
      //     student_name: students.find(s => s.id === selectedStudentId)?.full_name || 'Aluno',
      //     package_id: selectedPackageData.id,
      //     package_name: isAutomaticScheduling ? packageName : selectedPackageData.name,
      //     classes_count: classesToRegister,
      //     price: priceToRegister,
      //     start_date: format(finalStartDate, 'yyyy-MM-dd'),
      //     end_date: format(finalEndDate, 'yyyy-MM-dd'),
      //     duration_minutes: classDurationMinutes,
      //     days: days,
      //     day_times: dayTimes,
      //     observation: observation,
      //     time: dayTimes[days[0]] || '08:00'
      //   };

      //   const { error: solicitacaoError } = await supabase.from('solicitudes_clase').insert({
      //     alumno_id: selectedStudentId,
      //     profesor_id: effectiveProfessorId,
      //     horarios_propuestos: JSON.stringify(solicitacaoData),
      //     status: 'Pendiente',
      //     is_recurring: isAutomaticScheduling
      //   });

      //   if (solicitacaoError) throw solicitacaoError;

      //   // Atualizar perfil do aluno com professor pendente
      //   await supabase.from('profiles').update({
      //     pending_professor_id: effectiveProfessorId,
      //     pending_professor_status: 'aguardando_aprovacao',
      //     pending_professor_requested_at: new Date().toISOString()
      //   }).eq('id', selectedStudentId);

      //   const professorName = professors.find(p => p.id === effectiveProfessorId)?.full_name || 'Professor';

      //   toast({
      //     title: 'Solicitação Enviada!',
      //     description: `Aguardando aprovação de ${professorName}. O pacote será criado após a aprovação.`
      //   });

      //   // Limpar campos
      //   setSelectedStudentId(null);
      //   setObservation('');
      //   clearPckPersonalData();

      //   if (onUpdate) onUpdate();
      //   return; // Sair da função - não criar nada mais
      // }

      // --- FLUXO SEM PROFESSOR (PENDÊNCIA - CRIAR DIRETAMENTE) ---

      // FATURA
      const { error: billErr } = await supabase.from('billing').insert({
        user_id: selectedStudentId,
        package_id: selectedPackageData.id,
        amount_paid: priceToRegister,
        purchase_date: format(finalStartDate, 'yyyy-MM-dd'),
        end_date: format(finalEndDate, 'yyyy-MM-dd'),
        custom_package_name: isAutomaticScheduling ? packageName : null
      });
      if (billErr) throw billErr;

      // LOG
      const { error: logErr } = await supabase.from('assigned_packages_log').insert({
        professor_id: null, // Sem professor
        student_id: selectedStudentId,
        package_id: selectedPackageData.id,
        observation: observation,
        assigned_classes: classesToRegister,
        custom_package_name: isAutomaticScheduling ? packageName : null,
        status: 'Ativo'
      });
      if (logErr) throw logErr;

      // AULAS (sem professor - como pendência)
      if (appointmentInserts.length > 0) {
        const { error: aptErr } = await supabase.from('appointments').insert(appointmentInserts);
        if (aptErr) throw aptErr;
      }

      // ATUALIZAR ROTINA NO PERFIL
      if (isAutomaticScheduling) {
        await supabase.from('profiles').update({
          preferred_schedule: dayTimes
        }).eq('id', selectedStudentId);
      }

      // --- 3. FINALIZAÇÃO ---
      toast({
        title: 'Pacote Criado (Pendência)',
        description: `Pacote "${isAutomaticScheduling ? packageName : selectedPackageData.name}" criado com ${appointmentInserts.length} aulas. ATENÇÃO: Aluno sem professor vinculado.`
      });

      // Limpar campos
      setSelectedStudentId(null);
      setObservation('');
      clearPckPersonalData();

      if (onUpdate) onUpdate();

    } catch (error) {
      console.error("Erro na atribuição:", error);
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    } finally {
      setIsSubmittingPackage(false);
    }
  };

  // Atualiza a data de fim ao alterar a data de início (padrão de 1 mês)
  useEffect(() => {
    // Apenas para pacotes que NÃO usam agendamento automático
    if (!isAutomaticScheduling) {
      setEndDate(addMonths(purchaseDate, 1));
    }
  }, [purchaseDate, isAutomaticScheduling]);


  return (
    <div className="w-full">
      <div className="w-full space-y-8">
        {!hideForm && (
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-bold text-slate-800">Incluir Aulas para Aluno</h3>
                <p className="text-sm text-slate-500">Atribua pacotes de aulas e agende horários automaticamente</p>
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" disabled={!effectiveProfessorId && !isSuperadmin}>
                    <History className="mr-2 h-4 w-4" /> Ver Histórico
                  </Button>
                </DialogTrigger>
                {/* Passa a função onDelete que será responsável por fazer a atualização no Supabase */}
                <AssignedPackagesHistory
                  professorId={effectiveProfessorId}
                  onDelete={handleDeleteLog}
                  isSuperadmin={isSuperadmin}
                />
              </Dialog>
            </div>

            <form onSubmit={handleAssignPackage} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Seleção de Professor (visível APENAS para Superadmin) */}
                {/* Agora usando o estado local, totalmente desconectado do filtro global */}
                {isSuperadmin && (
                  <div className="space-y-2">
                    <Label>Professor (Filtro Local da Aba)</Label>
                    <Select value={effectiveProfessorId || 'none'} onValueChange={(v) => setLocalProfessorId(v === 'none' ? null : v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o professor" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Selecione um professor...</SelectItem>
                        {professors.map(prof => (
                          <SelectItem key={prof.id} value={prof.id}>{prof.full_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Seleção de Aluno */}
                <div className="space-y-2">
                  <Label>Aluno</Label>
                  <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" aria-expanded={popoverOpen} className="w-full justify-between font-normal">
                        {selectedStudent ? selectedStudent.full_name : "Selecione o aluno..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                      <Command>
                        <CommandInput placeholder="Buscar alumno..." />
                        <CommandList>
                          <CommandEmpty>Nenhum alumno encontrado.</CommandEmpty>
                          <CommandGroup>
                            {/* CORREÇÃO: Usa students extraído */}
                            {students.map((student) => (
                              <CommandItem
                                key={student.id}
                                value={student.full_name}
                                onSelect={() => {
                                  setSelectedStudentId(student.id);
                                  setPopoverOpen(false);
                                }}
                              >
                                <Check className={cn("mr-2 h-4 w-4", selectedStudentId === student.id ? "opacity-100" : "opacity-0")} />
                                {student.full_name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Select onValueChange={(value) => { setSelectedPackage(value); setCustomClassCount(''); }} value={selectedPackage || ''}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um pacote" />
                  </SelectTrigger>
                  <SelectContent>
                    {packages.map((pkg) => (
                      <SelectItem key={pkg.id} value={pkg.id.toString()}>{pkg.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Data de Início (Purchase Date) - Visível apenas para pacotes NÃO automáticos */}
                {!isAutomaticScheduling && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !purchaseDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {purchaseDate ? format(purchaseDate, "PPP", { locale: ptBR }) : <span>Data de Início</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={purchaseDate}
                        onSelect={setPurchaseDate}
                        initialFocus
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                )}

                {/* Data de Fim (End Date) - OCULTA se for Pacote Personalizado */}
                {!isAutomaticScheduling && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !endDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {endDate ? format(endDate, "PPP", { locale: ptBR }) : <span>Data de Fim</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={endDate}
                        onSelect={setEndDate}
                        initialFocus
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                )}

              </div>

              {/* --- NOVO BLOCO PCKPERSONAL (AGORA 'PERSONALIZADO') --- */}
              {isAutomaticScheduling ? (
                <motion.div
                  key="pck-personal-details" // Key is crucial for motion.div to work on unmount/mount
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-4 overflow-hidden p-4 border border-sky-300 rounded-lg bg-sky-50"
                >
                  <div className="grid grid-cols-1 gap-4">
                    {/* Nome do Pacote Personalizado (Requisito 1) */}
                    <div className="space-y-2">
                      <Label htmlFor="pck-name">Nome do Pacote (Exibido nas Faturas)</Label>
                      <Input
                        id="pck-name"
                        placeholder="Ex: Espanhol Iniciante Intensivo"
                        value={packageName || ''}
                        onChange={(e) => handlePckPersonalChange('packageName', e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Preço Pago */}
                    <div className="space-y-2">
                      <Label htmlFor="pck-price">Preço Pago (R$)</Label>
                      <Input
                        id="pck-price"
                        type="number"
                        placeholder="Ex: 500.00"
                        value={price || ''}
                        onChange={(e) => handlePckPersonalChange('price', e.target.value)}
                        required
                        min="0"
                      />
                    </div>
                    {/* Total de Aulas */}
                    <div className="space-y-2">
                      <Label htmlFor="pck-total-classes">Total de Aulas</Label>
                      <Input
                        id="pck-total-classes"
                        type="number"
                        placeholder="Ex: 12"
                        value={totalClasses || ''}
                        onChange={(e) => handlePckPersonalChange('totalClasses', e.target.value)}
                        required
                        min="1"
                      />
                    </div>
                  </div>

                  {/* Duração e Horário */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* Data de Início do Personalizado */}
                    <div className="space-y-2">
                      <Label htmlFor="pck-start-date">Data de Início</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant={"outline"}
                            className={cn("w-full justify-start text-left font-normal")}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {format(pckStartDate, "PPP", { locale: ptBR })}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={pckStartDate}
                            onSelect={(date) => handlePckPersonalChange('startDate', date)}
                            initialFocus
                            locale={ptBR}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    {/* Validade do Pacote */}
                    <div className="space-y-2">
                      <Label>Validade (Término)</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant={"outline"}
                            className={cn("w-full justify-start text-left font-normal")}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {format(pckEndDate, "PPP", { locale: ptBR })}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={pckEndDate}
                            onSelect={(date) => handlePckPersonalChange('endDate', date)}
                            initialFocus
                            locale={ptBR}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    {/* Duração da Aula */}
                    <div className="space-y-2">
                      <Label htmlFor="pck-duration">Duração de cada Aula (Minutos)</Label>
                      <Select onValueChange={(v) => handlePckPersonalChange('duration', v)} value={duration} required>
                        <SelectTrigger id="pck-duration">
                          <SelectValue placeholder="Duração" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="30">30 Minutos</SelectItem>
                          <SelectItem value="45">45 Minutos</SelectItem>
                          <SelectItem value="60">60 Minutos</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Dias e Horários Flexíveis (Requisito 2) */}
                  <div className="space-y-4 pt-2">
                    <Label className="text-sky-800 font-bold">Configuração da Agenda Semanal</Label>

                    <div className="space-y-3">
                      <p className="text-sm text-slate-600">Selecione os dias e o horário específico para cada um:</p>
                      <div className="flex flex-wrap gap-2">
                        {daysOfWeek.map((day, index) => (
                          <Button
                            key={index}
                            type="button"
                            variant={days.includes(index) ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => handleDayTogglePckPersonal(index)}
                            className={cn(days.includes(index) ? "bg-sky-600" : "")}
                          >
                            {day.substring(0, 3)}
                          </Button>
                        ))}
                      </div>
                    </div>

                    {days.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 border-t pt-4">
                        {days.map(dayIdx => (
                          <div key={dayIdx} className="flex items-center gap-3 p-2 bg-white rounded border border-sky-200">
                            <Badge className="w-12 justify-center bg-sky-100 text-sky-700 hover:bg-sky-100">{daysOfWeek[dayIdx].substring(0, 3)}</Badge>
                            <Select
                              value={dayTimes[dayIdx] || '08:00'}
                              onValueChange={(t) => handleDayTimeChange(dayIdx, t)}
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="max-h-60">
                                {ALL_TIMES.filter((_, i) => i % 2 === 0).map(t => (
                                  <SelectItem key={t.substring(0, 5)} value={t.substring(0, 5)}>{t.substring(0, 5)}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        ))}
                      </div>
                    )}

                    {days.length === 0 && <p className="text-red-500 text-sm">Selecione pelo menos um dia para agendar as aulas.</p>}

                    {/* === ALERTA DE VALIDAÇÃO DE PERÍODO === */}
                    {days.length > 0 && totalClasses && (
                      <div className="mt-4">
                        {scheduleValidation.exceeds ? (
                          <Alert variant="destructive" className="border-red-300 bg-red-50">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle className="text-red-800">Período Insuficiente</AlertTitle>
                            <AlertDescription className="text-red-700">
                              <p>
                                O período selecionado (<strong>{scheduleValidation.daysInPeriod} dias</strong>) comporta apenas <strong>{scheduleValidation.possibleClasses} aulas</strong> nos dias escolhidos.
                              </p>
                              <p className="mt-1">
                                Você solicitou <strong>{scheduleValidation.requestedClasses} aulas</strong>.
                                Faltam <strong>{scheduleValidation.shortage} aulas</strong>.
                              </p>
                              <p className="mt-2 text-sm font-medium">
                                💡 Aumente a data de validade ou reduza o número de aulas.
                              </p>
                            </AlertDescription>
                          </Alert>
                        ) : scheduleValidation.possibleClasses > 0 && (
                          <Alert className="border-green-300 bg-green-50">
                            <Info className="h-4 w-4 text-green-600" />
                            <AlertTitle className="text-green-800">Validação OK</AlertTitle>
                            <AlertDescription className="text-green-700">
                              O período de <strong>{scheduleValidation.daysInPeriod} dias</strong> comporta até <strong>{scheduleValidation.possibleClasses} aulas</strong> nos dias selecionados.
                              Serão agendadas <strong>{scheduleValidation.requestedClasses} aulas</strong>.
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              ) : null}
              {/* --- FIM DO NOVO BLOCO PCKPERSONAL --- */}

              <Textarea placeholder="Observação (motivo da inclusão)" value={observation} onChange={(e) => setObservation(e.target.value)} />

              <Button
                type="submit"
                className="w-full bg-sky-600 hover:bg-sky-700"
                disabled={isSubmittingPackage || (isAutomaticScheduling && scheduleValidation.exceeds)}
              >
                {isSubmittingPackage ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Incluindo...</> : 'Incluir Pacote'}
              </Button>
            </form>
          </div>
        )}

        {!hideTable && (
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-xl font-bold">Preferências de Horários</h3>
                <p className="text-sm text-slate-600 mt-1">Ative ou desative os horários de aula para o ciclo semanal.</p>
              </div>
              <Button onClick={handleSaveChanges} disabled={isSavingSlots}>
                {isSavingSlots ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</> : 'Salvar Alterações'}
              </Button>
            </div>
            <div className="space-y-6 mt-6">
              {!effectiveProfessorId ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-500 border-2 border-dashed rounded-lg">
                  <CalendarIcon className="h-12 w-12 mb-4 opacity-20" />
                  <p className="text-lg font-medium">Selecione um professor acima</p>
                  <p className="text-sm">Para configurar a agenda de preferências, escolha um professor no menu suspenso.</p>
                </div>
              ) : daysOfWeek.map((day, index) => {
                const daySlots = slots?.filter(s => s.day_of_week === index);
                const areAllActive = daySlots?.filter(s => s.status !== 'filled').every(s => s.status === 'active');
                return (
                  <div key={day}>
                    <div className="flex justify-between items-center mb-3 border-b pb-2">
                      <h4 className="font-semibold text-lg">{day}</h4>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-500">
                          {areAllActive ? 'Desativar todos' : 'Ativar todos'}
                        </span>
                        <Switch
                          checked={areAllActive}
                          onCheckedChange={(checked) => handleDayToggle(index, checked)}
                          aria-label={`Ativar/desativar todos os horários de ${day}`}
                        />
                      </div>
                    </div>
                    {loading ? ( // CORREÇÃO: Usa o 'loading' do dashboardData
                      <Loader2 className="h-6 w-6 animate-spin" />
                    ) : (
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
                        {daySlots?.map(slot => {
                          const slotKey = `${slot.day_of_week}-${slot.start_time}`;
                          const occupation = slotOccupancy[slotKey];
                          const isFilled = slot.status === 'filled';
                          const isOccupied = !!occupation;
                          const isActive = slot.status === 'active';
                          const isInactive = slot.status === 'inactive';

                          return (
                            <div
                              key={slot.start_time}
                              className={cn(
                                "flex flex-col gap-1 p-2 rounded-md border",
                                isOccupied ? "bg-sky-100 border-sky-300" :
                                  isFilled ? "bg-sky-100 border-sky-300" :
                                    isInactive ? "bg-slate-200 border-slate-300" :
                                      "bg-white border-slate-200"
                              )}
                            >
                              <div className="flex items-center justify-between">
                                <span className={cn(
                                  "text-sm font-medium",
                                  (isOccupied || isFilled) ? "text-sky-700" :
                                    isInactive ? "text-slate-500" :
                                      "text-slate-700"
                                )}>
                                  {slot.start_time.substring(0, 5)}
                                </span>

                                {!isOccupied && !isFilled && (
                                  <Switch
                                    checked={isActive}
                                    onCheckedChange={() => handleSlotToggle(slot.day_of_week, slot.start_time)}
                                    aria-label={`Ativar/desativar ${slot.start_time}`}
                                    className="h-4 w-7"
                                  />
                                )}
                              </div>

                              {(isOccupied || isFilled) && (
                                <>
                                  <div className="text-xs text-sky-700 font-medium truncate">
                                    {occupation?.studentName || "Ocupado"}
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-2 text-xs hover:bg-red-100 hover:text-red-700"
                                    onClick={() => handleLiberateSlot(slot, occupation)}
                                    disabled={liberatingSlot === slotKey}
                                    title="Clique para liberar este horário"
                                  >
                                    {liberatingSlot === slotKey ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      'Liberar'
                                    )}
                                  </Button>
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PreferenciasTab;
