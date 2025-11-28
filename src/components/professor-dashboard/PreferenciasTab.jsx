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
import { format, parseISO, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Input } from '@/components/ui/input'; 
import { Calendar } from "@/components/ui/calendar";
import { Badge } from '@/components/ui/badge';

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
    // Selecionamos todos os campos necessários, incluindo status
    const { data, error } = await supabase
      .from('assigned_packages_log')
      .select(`
        id, student_id, package_id, observation, assigned_classes, assigned_at, status, 
        student:profiles!student_id(full_name),
        package:packages(name)
      `)
      .eq('professor_id', professorId)
      .order('assigned_at', { ascending: false });

    if (error) {
      console.error("Error fetching history:", error);
    } else {
      setHistory(data || []);
    }
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
    // Usa 'Cancelado' no código, mas exibe 'Desfeito' para o usuário
    const isCanceled = status === 'Cancelado'; 
    // Usa 'missed' e 'completed' para evitar que sejam marcados como 'Ativo' se o status for outro.
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
    
  return (
    <DialogContent className="max-w-3xl">
      <DialogHeader>
        <DialogTitle>Histórico de Pacotes Incluídos</DialogTitle>
      </DialogHeader>
      <div className="max-h-[60vh] overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Aluno</TableHead>
              <TableHead>Pacote</TableHead>
              <TableHead>Aulas</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan="6" className="text-center">
                  <Loader2 className="mx-auto my-4 h-6 w-6 animate-spin" />
                </TableCell>
              </TableRow>
            ) : history.length > 0 ? (
              history.map(log => (
                // Adiciona a classe de opacidade para o status Desfeito
                <TableRow key={log.id} className={log.status === 'Cancelado' ? 'opacity-60 bg-slate-50' : ''}>
                  <TableCell>{log.student?.full_name || 'Aluno não encontrado'}</TableCell>
                  <TableCell>{log.package?.name || 'Pacote não encontrado'}</TableCell>
                  <TableCell>{log.assigned_classes}</TableCell>
                  <TableCell>{format(parseISO(log.assigned_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</TableCell>
                  <TableCell>
                    <StatusBadge status={log.status} />
                  </TableCell>
                  <TableCell>
                    {/* Renderizar o botão 'Desfazer' APENAS se o status for 'Ativo' ou similar */}
                    {log.status === 'Ativo' || log.status === 'rescheduled_credit' ? (
                      <Button variant="destructive" size="sm" onClick={() => handleDeleteWrapper(log)}>
                        Desfazer
                      </Button>
                    ) : (
                      // CORREÇÃO VISUAL: Renderiza o status permanente como um Badge
                      <Badge variant="destructive" className="bg-red-100 text-red-700 hover:bg-red-100 cursor-default">
                        DESFEITO
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan="6" className="text-center py-8 text-slate-500">
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
  const [customClassCount, setCustomClassCount] = useState('');
  const [observation, setObservation] = useState('');
  const [isSubmittingPackage, setIsSubmittingPackage] = useState(false);
  const [purchaseDate, setPurchaseDate] = useState(new Date());
  // NOVO: Estado para a Data de Fim/Validade
  const [endDate, setEndDate] = useState(addMonths(new Date(), 1));

  const selectedStudent = students.find(s => s.id === selectedStudentId); // Usa students extraído
  // CORREÇÃO: Verifica packages antes de tentar encontrar o pacote.
  const isCustomPackageSelected = packages.find(p => p.id === parseInt(selectedPackage))?.name === 'Personalizado';


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
    if (!selectedStudentId || !selectedPackage || !purchaseDate || !endDate) {
      toast({ variant: 'destructive', title: 'Campos obrigatórios', description: 'Selecione aluno, pacote e datas de validade.' });
      return;
    }
    
    // CORREÇÃO: Usa 'packages' extraído
    const selectedPackageData = packages.find(p => p.id === parseInt(selectedPackage));
    const isCustomPackage = selectedPackageData?.name === 'Personalizado';
    
    if (isCustomPackage && (!customClassCount || parseInt(customClassCount) <= 0)) {
      toast({ variant: 'destructive', title: 'Aulas inválidas', description: 'Insira uma quantidade de aulas válida para o pacote Personalizado.' });
      return;
    }
    if (!selectedPackageData) {
      toast({ variant: 'destructive', title: 'Pacote não encontrado' });
      setIsSubmittingPackage(false);
      return;
    }
    // CORREÇÃO: Verifica se professorId existe
    if (!professorId) {
        toast({ variant: 'destructive', title: 'Erro de Autenticação', description: 'ID do Professor não está disponível.' });
        setIsSubmittingPackage(false);
        return;
    }

    setIsSubmittingPackage(true);
    
    // VARIÁVEIS DE ATRIBUIÇÃO E FATURA
    let priceToRegister = selectedPackageData.price;
    let classesToRegister = selectedPackageData.number_of_classes;

    if (isCustomPackage) {
        priceToRegister = 0;
        classesToRegister = parseInt(customClassCount, 10);
    } else {
        classesToRegister = selectedPackageData.number_of_classes;
        priceToRegister = selectedPackageData.price;
    }
    
    const { error: billingError } = await supabase.from('billing').insert({
      user_id: selectedStudentId,
      package_id: selectedPackageData.id,
      amount_paid: priceToRegister,
      purchase_date: format(purchaseDate, 'yyyy-MM-dd'),
      end_date: format(endDate, 'yyyy-MM-dd'), // CORRIGIDO: Usa a data de fim selecionada
    });

    if (billingError) {
      toast({ variant: 'destructive', title: 'Erro ao incluir fatura', description: billingError.message });
      setIsSubmittingPackage(false);
      return;
    }

    const { error: logError } = await supabase.from('assigned_packages_log').insert({
      professor_id: professorId, // Usa professorId extraído
      student_id: selectedStudentId,
      package_id: selectedPackageData.id,
      observation: observation,
      assigned_classes: classesToRegister,
      status: 'Ativo'
    });
    
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
      toast({ variant: 'default', title: 'Pacote incluído!', description: `Pacote "${selectedPackageData.name}" (${classesToRegister} aulas) foi incluído para ${selectedStudent.full_name}.` });
      setSelectedStudentId(null);
      setSelectedPackage(null);
      setCustomClassCount('');
      setObservation('');
      setPurchaseDate(new Date());
      setEndDate(addMonths(new Date(), 1)); // Resetar a data de fim para o padrão
      if (onUpdate) onUpdate();
    }
    setIsSubmittingPackage(false);
  };
  
  // Atualiza a data de fim ao alterar a data de início (padrão de 1 mês)
  useEffect(() => {
      setEndDate(addMonths(purchaseDate, 1));
  }, [purchaseDate]);


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
                {selectedStudent ? selectedStudent.full_name : "Selecione um aluno..."}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
              <Command>
                <CommandInput placeholder="Buscar aluno..." />
                <CommandList>
                  <CommandEmpty>Nenhum aluno encontrado.</CommandEmpty>
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
                {/* CORREÇÃO: Usa packages extraído */}
                {packages.map((pkg) => (
                  <SelectItem key={pkg.id} value={pkg.id.toString()}>{pkg.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Data de Início (Purchase Date) */}
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
            
            {/* Data de Fim (End Date) */}
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
            
          </div>

          {isCustomPackageSelected && (
            <Input
              type="number"
              placeholder="Insira a quantidade de aulas (Ex: 10)"
              value={customClassCount}
              onChange={(e) => setCustomClassCount(e.target.value)}
              required
              min="1"
              className="mt-2"
            />
          )}

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
