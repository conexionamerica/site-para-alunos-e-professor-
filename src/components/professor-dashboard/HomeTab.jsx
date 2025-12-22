// Arquivo: src/components/professor-dashboard/HomeTab.jsx

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { format, formatDistanceToNowStrict, parseISO, getDay, add, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Check, X, Loader2, CalendarHeart, Clock, CalendarDays, isAfter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { TabsContent } from "@/components/ui/tabs";


const daysOfWeekMap = { 0: 'Dom', 1: 'Seg', 2: 'Ter', 3: 'Qua', 4: 'Qui', 5: 'Sex', 6: 'Sáb' };


// CORREÇÃO: O componente agora recebe props de dados agregados: 
// professorId: ID do professor.
// data: Objeto contendo coleções (scheduleRequests, nextClass).
// loading: Status de carregamento.
// onUpdate: Callback para forçar a atualização dos dados no pai.
const HomeTab = ({ dashboardData }) => {
  const { toast } = useToast();
  const [updatingRequestId, setUpdatingRequestId] = useState(null);
  const [solicitudes, setSolicitudes] = useState([]);

  // Extração segura das propriedades
  const professorId = dashboardData?.professorId;
  const data = dashboardData?.data || {};
  const loading = dashboardData?.loading || false;
  const onUpdate = dashboardData?.onUpdate;

  // Extrair as coleções de dados - Agora busca TODAS as próximas aulas
  const upcomingClasses = data.upcomingClasses || [];
  const nextClass = upcomingClasses.length > 0 ? upcomingClasses[0] : null;

  // CORREÇÃO: Sincroniza as solicitações do pai, mas agora com a verificação de array
  useEffect(() => {
    if (Array.isArray(data?.scheduleRequests)) {
      setSolicitudes(data.scheduleRequests);
    } else {
      setSolicitudes([]); // Garante que seja um array vazio se o dado for nulo/inválido
    }
  }, [data?.scheduleRequests]);

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
      // CORREÇÃO DE VALIDAÇÃO: Certifica-se que o campo é uma string JSON válida
      if (typeof request.horarios_propuestos !== 'string' || !request.horarios_propuestos) {
        toast({ variant: 'destructive', title: 'Erro de Agendamento', description: 'Formato de horário inválido.' });
        setUpdatingRequestId(null);
        // Não reverte o status da solicitação, pois o problema é nos dados.
        return;
      }

      try {
        const proposedSchedule = JSON.parse(request.horarios_propuestos);
        const studentId = request.alumno_id;

        const { data: billingData, error: billingError } = await supabase
          .from('billing').select('end_date, packages(number_of_classes, class_duration_minutes)')
          .eq('user_id', studentId)
          .gte('end_date', new Date().toISOString())
          .order('purchase_date', { ascending: false }).limit(1).single();

        if (billingError || !billingData) throw new Error("Fatura ativa do aluno não encontrada.");

        const endDate = parseISO(billingData.end_date);
        const totalClassesInPackage = billingData.packages.number_of_classes;
        const classDuration = billingData.packages.class_duration_minutes;
        const slotsPerClass = Math.ceil(classDuration / 15);

        // CORREÇÃO: Busca todos os slots, incluindo o status para a lógica de agendamento.
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
            // CORREÇÃO: Usar a data atual para garantir o fuso horário correto no parse
            const startTimeObj = parse(startTime, 'HH:mm:ss', currentDate);

            const requiredSlots = [];
            let canBook = true;
            // Verifica todos os slots de 15 minutos necessários para a duração total da aula.
            for (let i = 0; i < slotsPerClass; i++) {
              const slotTime = format(add(startTimeObj, { minutes: i * 15 }), 'HH:mm:ss');
              const matchingSlot = allSlots.find(s => s.day_of_week === dayOfWeek && s.start_time === slotTime);

              // Se valida que o slot esteja 'active' e não 'filled' (ocupado) ou 'inactive'.
              if (!matchingSlot || matchingSlot.status !== 'active') {
                canBook = false;
                break;
              }
              requiredSlots.push(matchingSlot);
            }

            if (canBook) {
              const primarySlot = requiredSlots[0];
              const [hour, minute] = startTime.split(':').map(Number);
              // CORREÇÃO: Constrói o classDateTime no fuso horário do servidor/ISO
              const classDateTime = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), hour, minute, 0);

              appointmentInserts.push({
                student_id: studentId,
                professor_id: professorId,
                class_datetime: classDateTime.toISOString(),
                class_slot_id: primarySlot.id,
                status: 'scheduled',
                duration_minutes: classDuration,
              });

              // Adiciona TODOS os IDs dos slots (de início e subsequentes) para marcar como 'filled'
              requiredSlots.forEach(slot => slotIdsToUpdate.add(slot.id));
              classesScheduled++;
            }
          }
          currentDate = add(currentDate, { days: 1 });
        }

        if (appointmentInserts.length > 0) {
          // Insere as aulas agendadas (com onConflict para evitar duplicidade de horários)
          const { error: insertError } = await supabase.from('appointments').insert(appointmentInserts, { onConflict: 'class_slot_id, class_datetime' });
          if (insertError) throw new Error(`Falha ao criar aulas: ${insertError.message}`);

          // Bloqueia TODOS os slots que fazem parte da duração da aula
          if (slotIdsToUpdate.size > 0) {
            const { error: updateSlotsError } = await supabase.from('class_slots').update({ status: 'filled' }).in('id', Array.from(slotIdsToUpdate));
            if (updateSlotsError) throw new Error(`Falha ao bloquear horários: ${updateSlotsError.message}`);
          }

          toast({ variant: 'default', title: 'Solicitação Aceita!', description: `${appointmentInserts.length} aulas agendadas e ${slotIdsToUpdate.size} horários bloqueados.` });
        } else {
          toast({ variant: 'warning', title: 'Aulas não agendadas', description: 'Nenhum horário correspondente foi encontrado para criar as aulas.' });
        }
      } catch (e) {
        // Reverte o status da solicitação se houver erro no processamento
        await supabase.from('solicitudes_clase').update({ status: 'Pendiente' }).eq('solicitud_id', solicitudId);
        toast({ variant: 'destructive', title: `Erro ao processar agendamento`, description: e.message });
      }
    }
    // NOVA LÓGICA: Processamento de Solicitações Pontuais (is_recurring: false)
    else if (newStatus === 'Aceita' && !request.is_recurring) {
      try {
        const proposedSchedule = JSON.parse(request.horarios_propuestos);
        const studentId = request.alumno_id;

        // Buscar billing ativo para obter duração da classe
        const { data: billingData, error: billingError } = await supabase
          .from('billing')
          .select('packages(class_duration_minutes)')
          .eq('user_id', studentId)
          .gte('end_date', new Date().toISOString())
          .order('purchase_date', { ascending: false })
          .limit(1)
          .single();

        if (billingError || !billingData) {
          throw new Error('Fatura ativa do aluno não encontrada.');
        }

        const classDuration = billingData.packages?.class_duration_minutes || 30;

        // Parsear data e hora da solicitação pontual
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

        // Criar appointment único
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
        // Reverte o status se houver erro
        await supabase.from('solicitudes_clase').update({ status: 'Pendiente' }).eq('solicitud_id', solicitudId);
        toast({ variant: 'destructive', title: 'Erro ao processar aula pontual', description: e.message });
      }
    } else if (newStatus === 'Rejeitada') {
      toast({ variant: 'destructive', title: 'Solicitação Rejeitada' });
    }

    // 3. Chama o onUpdate do componente pai para recarregar os dados
    if (onUpdate) onUpdate(solicitudId);
    setUpdatingRequestId(null);
  };

  const renderHorarios = (horariosJson) => {
    try {
      // CORREÇÃO: Trata JSON como string e valida antes de parsear
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

  return (
    // CORREÇÃO DE LAYOUT: Aplica padding horizontal aqui para alinhar com o cabeçalho.
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-8 px-4 lg:px-8">
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
        {/* Card da Próxima Aula (destaque) */}
        <div className="bg-white rounded-lg border-l-4 border-sky-500 shadow-sm p-4">
          <h3 className="text-lg font-bold mb-2">Próxima Aula</h3>
          {loading ? (
            <p>Carregando...</p>
          ) : nextClass ? (
            <>
              <p className="text-xs text-slate-500">Começa {formatDistanceToNowStrict(new Date(nextClass.class_datetime), { locale: ptBR, addSuffix: true })}</p>
              <p className="text-sm font-medium mt-1">{format(new Date(nextClass.class_datetime), "EEEE, dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}</p>
              <p className="text-sm mt-2"><strong>Aluno:</strong> {nextClass.student?.full_name}</p>
              <p className="text-sm"><strong>Nível:</strong> {nextClass.student?.spanish_level || 'Não definido'}</p>
              <Button asChild className="w-full mt-4 bg-sky-600 hover:bg-sky-700"><a href="https://meet.google.com/tmi-xwmg-kua" target="_blank" rel="noopener noreferrer">Iniciar Aula</a></Button>
            </>
          ) : (
            <p className="text-slate-500 text-sm">Nenhuma aula agendada.</p>
          )}
        </div>

        {/* Card de Todas as Próximas Aulas Agendadas */}
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
  );
};

export default HomeTab;
