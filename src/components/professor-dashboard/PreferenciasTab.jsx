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
import { ChevronsUpDown, Check, History, Loader2, Calendar as CalendarIcon, Lock } from "lucide-react";
import { cn } from '@/lib/utils';
import { format, parseISO, addMonths, parse, getDay, add } from 'date-fns';
import { ptBR } from 'date-fns/locale';
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

const AssignedPackagesHistory = ({ professorId, onDelete }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    if (!professorId) return;
    setLoading(true);

    // 1. Fetch Logs (Atribuições de Pacotes)
    const { data: logs, error: logError } = await supabase
      .from('assigned_packages_log')
      .select(`
        id, student_id, package_id, observation, assigned_classes, assigned_at, status, 
        student:profiles!student_id(full_name),
        package:packages(name)
      `)
      .eq('professor_id', professorId)
      .order('assigned_at', { ascending: false });

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
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'assigned_packages_log', filter: `professor_id=eq.${professorId}` }, fetchHistory)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'assigned_packages_log', filter: `professor_id=eq.${professorId}` }, fetchHistory)
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
    <DialogContent className="max-w-5xl"> {/* Aumentado o max-w para caber as novas colunas */}
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
                  <TableCell>{log.package?.name || 'Pacote não encontrado'}</TableCell>
                  
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


const PreferenciasTab = ({ dashboardData }) => {
  const { toast } = useToast();
  const daysOfWeek = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

  // Extração segura das propriedades
  const data = dashboardData?.data || {};
  const loading = dashboardData?.loading || false;
  const professorId = dashboardData?.professorId;
  const students = data.students || [];
  const packages = data.packages || [];
  const classSlots = data.classSlots || [];
  const onUpdate = dashboardData?.onUpdate; // Para forçar a recarga no pai
    
  const [slots, setSlots] = useState([]);
  const [isSavingSlots, setIsSavingSlots] = useState(false);

  const [popoverOpen, setPopoverOpen] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [selectedPackage, setSelectedPackage] = useState(null);
  
  // ESTADOS PARA O PACOTE PADRÃO 'PERSONALIZADO' (agora usado para a nova função)
  const [customClassCount, setCustomClassCount] = useState('');
  const [observation, setObservation] = useState('');
  
  // NOVOS ESTADOS PARA DETALHES DO AGENDAMENTO (usaremos para 'Personalizado')
  const [pckPersonalData, setPckPersonalData] = useState({
    totalClasses: '',
    duration: '30', // Default duration
    time: ALL_TIMES[0].substring(0, 5), 
    days: [],
    price: '',
    startDate: new Date(), // NOVA: Data de Início do Customizado
    endDate: addMonths(new Date(), 1), // Default validity
  });
  // Usamos 'custom' para compatibilidade com o fluxo original que só precisava de customClassCount.
  // Agora, usaremos pckPersonalData para a maioria dos inputs.
  const { totalClasses, duration, time, days, price, endDate: pckEndDate, startDate: pckStartDate } = pckPersonalData;
  
  const handlePckPersonalChange = (field, value) => {
    setPckPersonalData(prev => ({ ...prev, [field]: value }));
  };
  const handleDayTogglePckPersonal = (dayIndex) => {
    handlePckPersonalChange('days', 
        days.includes(dayIndex) 
            ? days.filter(d => d !== dayIndex) 
            : [...days, dayIndex]
    );
  };
  // FIM DOS NOVOS ESTADOS

  const [isSubmittingPackage, setIsSubmittingPackage] = useState(false);
  const [purchaseDate, setPurchaseDate] = useState(new Date());
  // Estado para a Data de Fim/Validade (Usado por pacotes padrão e Personalizado)
  const [endDate, setEndDate] = useState(addMonths(new Date(), 1));

  const selectedStudent = students.find(s => s.id === selectedStudentId); // Usa students extraído
  
  // Determina o pacote selecionado e se é customizado/pckpersonal
  const selectedPackageData = packages.find(p => p.id === parseInt(selectedPackage));
  
  // CORREÇÃO: Usar isCustomPackageSelected (o nome 'Personalizado') para mostrar o bloco de agendamento flexível
  const isCustomPackageSelected = selectedPackageData?.name === 'Personalizado'; 
  
  // A lógica do agendamento automático será ativada se for o pacote 'Personalizado'
  const isAutomaticScheduling = isCustomPackageSelected; 
  


  // CORREÇÃO: Usa 'classSlots' extraído do dashboardData
  useEffect(() => {
    if (!Array.isArray(classSlots)) return;

    const existingSlotsMap = new Map();
    classSlots.forEach(slot => {
      // Garante que o formato seja HH:mm:ss
      const startTime = slot.start_time.length === 5 ? `${slot.start_time}:00` : slot.start_time;
      existingSlotsMap.set(`${slot.day_of_week}-${startTime}`, slot);
    });

    const mergedSlots = [];
    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
      ALL_TIMES.forEach(time => {
        const key = `${dayIndex}-${time}`;
        const existing = existingSlotsMap.get(key);

        if (existing) {
          mergedSlots.push(existing);
        } else {
          mergedSlots.push({
            professor_id: professorId,
            day_of_week: dayIndex,
            start_time: time,
            status: 'inactive',
          });
        }
      });
    }

    setSlots(mergedSlots);
  }, [classSlots, professorId, loading]); // Depende de classSlots e loading

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
    setIsSavingSlots(true);

    const slotsToUpsert = slots.map(s => {
      // Remove campos desnecessários ou que causam conflito
      const { id, created_at, ...rest } = s; 
      return { ...rest, professor_id: professorId };
    });

    try {
      // CORREÇÃO: Verifica se professorId existe antes de chamar a API
      if (!professorId) throw new Error("ID do Professor não está disponível.");
      
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

  // Funções de exclusão e reversão (esta função DEVE fazer o update no banco de dados)
  const handleDeleteLog = useCallback(async (log) => {
    const { id: logId, student_id: studentId, package_id: packageId } = log;
    
    if (!window.confirm("ATENÇÃO: Você está prestes a desfazer a inclusão de um pacote. Isso irá:\n\n1. Marcar o registro como CANCELADO (Permanecerá no histórico).\n2. CANCELAR a fatura ativa mais recente.\n3. EXCLUIR TODAS AS AULAS FUTURAS agendadas.\n4. LIBERAR OS HORÁRIOS RECORRENTES (slots).\n\nConfirma a operação?")) {
      return;
    }

    try {
      // Step 1: Mark as Cancelado
      const { error: updateError } = await supabase
        .from('assigned_packages_log')
        .update({ status: 'Cancelado' }) 
        .eq('id', logId);
      
      if (updateError) throw updateError;
      
      // ... Resto da lógica de exclusão no Supabase (omitida para brevidade, mas está no arquivo original) ...

      let billingRemoved = false;
      let slotsReverted = false;

      // Step 2: Delete billing
      const { data: latestBilling, error: billingFetchError } = await supabase
        .from('billing')
        .select('id')
        .eq('user_id', studentId)
        .eq('package_id', packageId)
        .gte('end_date', format(new Date(), 'yyyy-MM-dd'))
        .order('purchase_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (billingFetchError && billingFetchError.code !== 'PGRST116') throw billingFetchError;
      
      if (latestBilling) {
        const { error: billingDeleteError } = await supabase
          .from('billing')
          .delete()
          .eq('id', latestBilling.id);
        if (billingDeleteError) throw billingDeleteError;
        billingRemoved = true;
      }

      // Step 3: Delete future appointments
      const { count: deletedAptsCount, error: aptDeleteError } = await supabase
        .from('appointments')
        .delete({ count: 'exact' })
        .eq('student_id', studentId)
        .gte('class_datetime', new Date().toISOString())
        .in('status', ['scheduled', 'pending', 'rescheduled']);
      
      if (aptDeleteError) throw aptDeleteError;

      // Step 4: Revert slots
      const { data: recurringReq, error: reqFetchError } = await supabase
        .from('solicitudes_clase')
        .select('solicitud_id, horarios_propuestos, is_recurring')
        .eq('alumno_id', studentId)
        .in('status', ['Aceita', 'Aprovada', 'Pendiente'])
        .eq('is_recurring', true)
        .order('solicitud_id', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (reqFetchError && reqFetchError.code !== 'PGRST116') throw reqFetchError;

      if (recurringReq) {
        try {
          const horarios = JSON.parse(recurringReq.horarios_propuestos);
          if (horarios && horarios.days && horarios.time) {
            const { data: slotsToRevert, error: slotsFetchError } = await supabase
              .from('class_slots')
              .select('id')
              .eq('professor_id', professorId) // Usa professorId extraído
              .in('day_of_week', horarios.days)
              .gte('start_time', horarios.time)
              .eq('status', 'filled');
            
            if (slotsFetchError) throw slotsFetchError;
            
            if (slotsToRevert && slotsToRevert.length > 0) {
              const slotIds = slotsToRevert.map(s => s.id);
              const { error: slotUpdateError, count: revertedSlotsCount } = await supabase
                .from('class_slots')
                .update({ status: 'active' }, { count: 'exact' })
                .in('id', slotIds);
              
              if (slotUpdateError) throw slotUpdateError;
              slotsReverted = revertedSlotsCount > 0;
            }
          }
          
          const { error: reqDeleteError } = await supabase
            .from('solicitudes_clase')
            .delete()
            .eq('solicitud_id', recurringReq.solicitud_id);
          
          if (reqDeleteError) console.warn("Erro ao deletar solicitação:", reqDeleteError);
        } catch (e) {
          console.warn("Could not parse or revert slots:", e);
        }
      }

      let message = 'Operação concluída. O registro foi marcado como CANCELADO.';
      if (billingRemoved) message += ' A fatura ativa foi removida.';
      if (deletedAptsCount > 0) message += ` ${deletedAptsCount} aulas futuras foram excluídas.`;
      if (slotsReverted) message += ' Os horários recorrentes foram liberados.';


      toast({ variant: 'default', title: 'Pacote Cancelado!', description: message });

      // Chama onUpdate para recarregar o histórico e a lista de alunos
      if (onUpdate) onUpdate();

    } catch (error) {
      console.error("Error in handleDeleteLog:", error);
      toast({ 
        variant: 'destructive', 
        title: 'Erro ao desfazer pacote', 
        description: `Ocorreu um erro: ${error.message}` 
      });
    }
  }, [professorId, toast, onUpdate]);

  const handleAssignPackage = async (e) => {
    e.preventDefault();
    
    // --- VARIÁVEIS COMUNS ---
    if (!selectedStudentId || !selectedPackage) {
      toast({ variant: 'destructive', title: 'Campos obrigatórios', description: 'Selecione aluno e pacote.' });
      return;
    }
    
    // --- VALIDAÇÃO PCKPERSONAL (AGORA USADO POR 'PERSONALIZADO') ---
    if (isAutomaticScheduling) {
        if (!totalClasses || !duration || !time || days.length === 0 || !price || !pckEndDate || !pckStartDate) {
            toast({ variant: 'destructive', title: 'Campos do Pacote Personalizado obrigatórios', description: 'Por favor, preencha todos os detalhes do agendamento (aulas, duração, horário, dias, preço, data de início e validade).' });
            setIsSubmittingPackage(false);
            return;
        }
    }
    // --- VALIDAÇÃO GERAL ---
    else if (!endDate || !purchaseDate) {
        toast({ variant: 'destructive', title: 'Campos obrigatórios', description: 'Selecione a data de início e de validade.' });
        return;
    }


    if (!selectedPackageData) {
      toast({ variant: 'destructive', title: 'Pacote não encontrado' });
      setIsSubmittingPackage(false);
      return;
    }
    if (!professorId) {
        toast({ variant: 'destructive', title: 'Erro de Autenticação', description: 'ID do Professor não está disponível.' });
        setIsSubmittingPackage(false);
        return;
    }

    setIsSubmittingPackage(true);
    
    // VARIÁVEIS DE ATRIBUIÇÃO E FATURA
    let priceToRegister = 0;
    let classesToRegister = 0;
    let finalEndDate = endDate;
    let finalPurchaseDate = purchaseDate; // Usado para data_início/purchase_date

    if (isAutomaticScheduling) {
        priceToRegister = parseFloat(price);
        classesToRegister = parseInt(totalClasses, 10);
        finalEndDate = pckEndDate;
        finalPurchaseDate = pckStartDate; // Usa a data de início do bloco personalizado
    } else {
        classesToRegister = selectedPackageData.number_of_classes;
        priceToRegister = selectedPackageData.price;
    }
    
    // --- 1. CRIAÇÃO DA FATURA (BILLING) ---
    const { error: billingError } = await supabase.from('billing').insert({
      user_id: selectedStudentId,
      package_id: selectedPackageData.id,
      amount_paid: priceToRegister,
      purchase_date: format(finalPurchaseDate, 'yyyy-MM-dd'),
      end_date: format(finalEndDate, 'yyyy-MM-dd'),
    });

    if (billingError) {
      toast({ variant: 'destructive', title: 'Erro ao incluir fatura', description: billingError.message });
      setIsSubmittingPackage(false);
      return;
    }
    
    // --- 2. REGISTRO NO LOG (assigned_packages_log) ---
    const { error: logError } = await supabase.from('assigned_packages_log').insert({
      professor_id: professorId,
      student_id: selectedStudentId,
      package_id: selectedPackageData.id,
      observation: observation,
      assigned_classes: classesToRegister,
      status: 'Ativo'
    });
    
    // --- 3. AGENDAMENTO AUTOMÁTICO (SE FOR PACOTE DE AGENDAMENTO AUTOMÁTICO) ---
    if (isAutomaticScheduling && !billingError) {
        try {
            const totalClassesToSchedule = classesToRegister;
            const classDurationMinutes = parseInt(duration, 10);
            const slotsPerClass = Math.ceil(classDurationMinutes / 15);
            const studentId = selectedStudentId;

            // Fetch all active class slots for the professor (used for ID lookup)
            const { data: allSlots, error: slotsError } = await supabase
                .from('class_slots')
                .select('id, day_of_week, start_time, status')
                .eq('professor_id', professorId);

            if (slotsError) throw slotsError;

            const appointmentInserts = [];
            let currentDate = new Date(finalPurchaseDate); 
            let classesScheduled = 0;
            
            // Fetch existing appointments to prevent dynamic conflicts
            const { data: existingAppointments, error: aptError } = await supabase
                .from('appointments')
                .select('class_datetime, duration_minutes')
                .eq('professor_id', professorId)
                .gte('class_datetime', format(new Date(), 'yyyy-MM-dd'))
                .in('status', ['scheduled', 'rescheduled']);
            
            if (aptError) console.error("Error checking for appointments:", aptError);


            // INÍCIO DO LOOP DE AGENDAMENTO CORRIGIDO
            while (classesScheduled < totalClassesToSchedule && currentDate <= finalEndDate) {
                const dayOfWeek = getDay(currentDate);

                if (days.includes(dayOfWeek)) {
                    const startTime = time; 
                    const startTimeFull = `${startTime}:00`; 
                    const startTimeObj = parse(startTimeFull, 'HH:mm:ss', currentDate);

                    let canBook = true;
                    
                    for (let i = 0; i < slotsPerClass; i++) {
                        const slotTime = format(add(startTimeObj, { minutes: i * 15 }), 'HH:mm:ss');
                        
                        // Check 1: Slot must exist in the professor's configured general slots (just for ID reference)
                        const matchingSlotInProfPrefs = allSlots.find(s => 
                            s.day_of_week === dayOfWeek && s.start_time === slotTime
                        );

                        // If the slot is not defined in the professor's preferences AT ALL, we cannot book it.
                        // For custom packages, we allow booking even if status is inactive, but it MUST exist.
                        if (!matchingSlotInProfPrefs) {
                            canBook = false;
                            break;
                        }

                        // Check 2: Dynamic conflict against actual booked appointments
                        const newSlotStart = add(currentDate, { hours: startTimeObj.getHours(), minutes: startTimeObj.getMinutes() + i * 15 });
                        
                        if ((existingAppointments || []).some(apt => {
                            const aptStart = parseISO(apt.class_datetime);
                            const aptEnd = add(aptStart, { minutes: apt.duration_minutes || 30 });
                            
                            // Check if new slot time overlaps with existing appointment
                            return newSlotStart >= aptStart && newSlotStart < aptEnd;
                        })) {
                            canBook = false;
                            break;
                        }
                    }

                    if (canBook) {
                        const [hour, minute] = startTime.split(':').map(Number);
                        const classDateTime = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), hour, minute, 0); 
                        
                        // Find the primary slot ID for the INSERT:
                        const primarySlot = allSlots.find(s => 
                            s.day_of_week === dayOfWeek && s.start_time === startTimeFull
                        );


                        appointmentInserts.push({
                            student_id: studentId,
                            professor_id: professorId,
                            class_datetime: classDateTime.toISOString(),
                            class_slot_id: primarySlot.id, // Use the starting slot ID
                            status: 'scheduled',
                            duration_minutes: classDurationMinutes,
                        });
                        
                        classesScheduled++;
                    }
                }
                
                // AVANÇA PARA O PRÓXIMO DIA
                currentDate = add(currentDate, { days: 1 });
            }
            // FIM DO LOOP DE AGENDAMENTO CORRIGIDO

            if (appointmentInserts.length > 0) {
                // Insere as aulas agendadas (sem lock permanente nos slots)
                const { error: insertError } = await supabase.from('appointments').insert(appointmentInserts);
                if (insertError) throw new Error(`Falha ao criar aulas agendadas. Se houver conflitos de horário, parte do agendamento pode ter sido ignorada. Detalhes: ${insertError.message}`);
                
                toast({ variant: 'info', title: 'Agendamento Automático!', description: `${appointmentInserts.length} aulas foram agendadas.` });
            } else {
                 toast({ variant: 'warning', title: 'Agendamento Falhou', description: 'Nenhum horário disponível encontrado dentro do período para este pacote.' });
            }

        } catch (e) {
            toast({ variant: 'destructive', title: 'Erro de Agendamento Automático', description: e.message });
        }
    }
    
    // --- 4. NOTIFICAÇÃO E LIMPEZA ---
    await supabase.from('notifications').insert({
      user_id: selectedStudentId,
      type: 'new_package',
      content: { 
        message: `Você recebeu um novo pacote: ${selectedPackageData.name}`,
        packageName: selectedPackageData.name,
        classCount: classesToRegister
      },
    });

    if (logError) {
      toast({ variant: 'destructive', title: 'Erro ao registrar', description: `Pacote atribuído, mas falha ao registrar no histórico: ${logError.message}` });
    } else {
      toast({ variant: 'default', title: 'Paquete incluído!', description: `Paquete "${selectedPackageData.name}" (${classesToRegister} aulas) fue incluido para ${selectedStudent.full_name}.` });
      
      // Limpar estados
      setSelectedStudentId(null);
      setSelectedPackage(null);
      setCustomClassCount('');
      setObservation('');
      setPurchaseDate(new Date());
      setEndDate(addMonths(new Date(), 1));
      setPckPersonalData({ totalClasses: '', duration: '30', time: ALL_TIMES[0].substring(0, 5), days: [], price: '', startDate: new Date(), endDate: addMonths(new Date(), 1) });
      
      if (onUpdate) onUpdate();
    }
    setIsSubmittingPackage(false);
  };
  
  // Atualiza a data de fim ao alterar a data de início (padrão de 1 mês)
  useEffect(() => {
    // Apenas para pacotes que NÃO usam agendamento automático
    if (!isAutomaticScheduling) {
        setEndDate(addMonths(purchaseDate, 1));
    }
  }, [purchaseDate, isAutomaticScheduling]);


  return (
    <div className="space-y-8">
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold">Incluir Aulas para Aluno</h3>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline"><History className="mr-2 h-4 w-4" /> Ver Histórico</Button>
            </DialogTrigger>
            {/* Passa a função onDelete que será responsável por fazer a atualização no Supabase */}
            <AssignedPackagesHistory professorId={professorId} onDelete={handleDeleteLog} />
          </Dialog>
        </div>
        <form onSubmit={handleAssignPackage} className="space-y-4 max-w-2xl">
          <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" role="combobox" aria-expanded={popoverOpen} className="w-full justify-between">
                {selectedStudent ? selectedStudent.full_name : "Selecione um alumno..."}
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
                  <h4 className="text-lg font-semibold text-sky-800">Detalhes do Pacote Personalizado</h4>

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
                      {/* Duração da Aula */}
                      <div className="space-y-2">
                          <Label htmlFor="pck-duration">Duração (Minutos)</Label>
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

                  <div className="grid grid-cols-2 gap-4">
                      {/* Horário de Início */}
                      <div className="space-y-2">
                          <Label htmlFor="pck-time">Horário de Início Fixo</Label>
                          <Select onValueChange={(v) => handlePckPersonalChange('time', v)} value={time} required>
                              <SelectTrigger id="pck-time">
                                  <SelectValue placeholder="Horário (Ex: 10:00)" />
                              </SelectTrigger>
                              <SelectContent>
                                  {ALL_TIMES.filter((_, i) => i % 2 === 0).map(t => (
                                      <SelectItem key={t.substring(0, 5)} value={t.substring(0, 5)}>{t.substring(0, 5)}</SelectItem>
                                  ))}
                              </SelectContent>
                          </Select>
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

                  {/* Dias da Semana */}
                  <div className="space-y-2">
                      <Label>Dias da Semana Fixos</Label>
                      <div className="flex flex-wrap gap-2">
                          {daysOfWeek.map((day, index) => (
                              <Button
                                  key={index}
                                  type="button"
                                  variant={days.includes(index) ? 'default' : 'outline'}
                                  size="sm"
                                  onClick={() => handleDayTogglePckPersonal(index)}
                              >
                                  {day.substring(0, 3)}
                              </Button>
                          ))}
                      </div>
                      {days.length === 0 && <p className="text-red-500 text-sm">Selecione pelo menos um dia.</p>}
                  </div>
              </motion.div>
          ) : null}
          {/* --- FIM DO NOVO BLOCO PCKPERSONAL --- */}
          
          <Textarea placeholder="Observação (motivo da inclusão)" value={observation} onChange={(e) => setObservation(e.target.value)} />

          <Button type="submit" className="w-full bg-sky-600 hover:bg-sky-700" disabled={isSubmittingPackage}>
            {isSubmittingPackage ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Incluindo...</> : 'Incluir Pacote'}
          </Button>
        </form>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm">
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
          {daysOfWeek.map((day, index) => {
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
                      const isFilled = slot.status === 'filled';
                      const isActive = slot.status === 'active';
                      return (
                        <div
                          key={slot.start_time}
                          className={cn(
                            "flex items-center justify-between gap-2 p-2 rounded-md border",
                            isFilled ? "bg-slate-200" : (isActive ? "bg-sky-50" : "bg-slate-50")
                          )}
                        >
                          <span className={cn("text-sm font-medium", isFilled ? "text-slate-500" : "text-slate-700")}>
                            {slot.start_time.substring(0, 5)}
                          </span>
                          {isFilled ? (
                            <Lock className="h-4 w-4 text-slate-500" title="Horário agendado" />
                          ) : (
                            <Switch
                              checked={isActive}
                              onCheckedChange={() => handleSlotToggle(slot.day_of_week, slot.start_time)}
                              aria-label={`Ativar/desativar ${slot.start_time}`}
                            />
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
    </div>
  );
};

export default PreferenciasTab;
