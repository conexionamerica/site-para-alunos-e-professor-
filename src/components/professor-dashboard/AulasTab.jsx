import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/customSupabaseClient';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '../ui/table';
import { Button } from '../ui/button';
import { Calendar } from '../ui/calendar';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from '../ui/dialog';
import { format, parseISO, add, getDay, parse, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2 } from 'lucide-react';
import { useToast } from '../ui/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

// Array de todos os horários possíveis (intervalos de 15 minutos)
const ALL_TIMES = [];
for (let h = 0; h <= 23; h++) {
    for (let m = 0; m < 60; m += 15) {
        ALL_TIMES.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
}

// =============================================================================
// Componente RescheduleDialog (onde a correção foi aplicada)
// =============================================================================
const RescheduleDialog = ({ appointment, onRescheduleSuccess }) => {
    const { toast } = useToast();
    const [open, setOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState(null);
    const [selectedTime, setSelectedTime] = useState(null);
    const [availableTimes, setAvailableTimes] = useState([]);
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // FUNÇÃO CORRIGIDA: Filtra slots baseados na disponibilidade do professor e conflitos
    const fetchAvailableSlots = useCallback(async (date) => {
        if (!date || !appointment?.professor_id || !appointment?.duration_minutes) {
            // Se faltarem dados, exibe horários padrão (mas sem garantias de disponibilidade)
            setAvailableTimes(ALL_TIMES.filter(time => time >= '07:00' && time <= '23:30'));
            return;
        }

        setLoadingSlots(true);
        const dayString = format(date, 'yyyy-MM-dd');
        // getDay() retorna 0 (Domingo) a 6 (Sábado)
        const dayOfWeek = getDay(date);

        // 1. Busca slots de preferência ATIVOS do professor para o dia da semana
        const { data: preferredSlots, error: slotsError } = await supabase
            .from('class_slots')
            .select('start_time')
            .eq('professor_id', appointment.professor_id)
            .eq('day_of_week', dayOfWeek)
            .eq('status', 'active'); // Filtra apenas slots ativos (preferência)

        if (slotsError) {
            console.error('Erro ao buscar slots de preferência:', slotsError);
            setLoadingSlots(false);
            return;
        }

        // Mapeia para um Set de HH:mm para comparação rápida
        const preferredTimes = new Set(preferredSlots.map(s => s.start_time.substring(0, 5)));

        // 2. Busca aulas agendadas (e em estados de bloqueio) para o professor no dia
        const { data: appointmentsForDay, error: aptError } = await supabase
            .from('appointments')
            .select('class_datetime, duration_minutes, id')
            .eq('professor_id', appointment.professor_id)
            .in('status', ['scheduled', 'rescheduled', 'pending']) // Considera estes como ocupados
            .gte('class_datetime', `${dayString}T00:00:00Z`)
            .lte('class_datetime', `${dayString}T23:59:59Z`);

        if (aptError) {
            console.error('Erro ao buscar agendamentos para o dia:', aptError);
            setLoadingSlots(false);
            return;
        }

        const bookedSlots = new Set();
        const classDuration = appointment.duration_minutes;
        // Slots de 15 minutos necessários para a duração desta aula
        const slotsPerClass = Math.ceil(classDuration / 15);

        appointmentsForDay.forEach(apt => {
            // IGNORE A PRÓPRIA AULA que está sendo reagendada
            if (apt.id === appointment.id) return;

            const startTime = parseISO(apt.class_datetime);
            const aptDuration = apt.duration_minutes || classDuration;
            const occupiedSlotsCount = Math.ceil(aptDuration / 15);

            // Marca TODOS os slots de 15 minutos que a aula ocupará como reservados
            for (let i = 0; i < occupiedSlotsCount; i++) {
                // Calcula o HH:mm ocupado
                const occupiedTime = format(add(startTime, { minutes: i * 15 }), 'HH:mm');
                bookedSlots.add(occupiedTime);
            }
        });

        // 3. Combina Preferências e Conflitos para encontrar horários válidos
        const newAvailableTimes = ALL_TIMES.filter(time => {
            // Verifica o limite de horário global (pode ser ajustado)
            if (time < '07:00' || time > '23:30') return false;

            const startTimeObj = parse(time, 'HH:mm', date);
            
            // Não permite agendamento no passado
            if (isAfter(new Date(), startTimeObj)) return false;


            // Verifica se há slots consecutivos livres e preferenciais para a duração total da aula
            for (let i = 0; i < slotsPerClass; i++) {
                // Calcula o HH:mm do slot de 15 minutos 'i'
                const requiredSlotTime = format(add(startTimeObj, { minutes: i * 15 }), 'HH:mm');

                // Garante que o slot de término não ultrapasse o limite
                if (i * 15 >= classDuration) {
                    // Este break é uma otimização, mas a verificação real está abaixo
                    break;
                }
                
                // Se o slot necessário estiver fora do limite (depois de 23:30)
                if (requiredSlotTime > '23:30') {
                    return false;
                }

                // VERIFICAÇÃO 1: O slot de 15 minutos deve estar nas preferências ATIVAS do professor.
                if (!preferredTimes.has(requiredSlotTime)) {
                    return false;
                }

                // VERIFICAÇÃO 2: O slot de 15 minutos não deve estar reservado por OUTRA aula.
                if (bookedSlots.has(requiredSlotTime)) {
                    return false;
                }
            }
            // Se o loop terminou, todos os slots necessários para a duração da aula estão:
            // 1. Dentro das preferências ativas do professor.
            // 2. Não estão em conflito com outras aulas.
            return true;
        });

        setAvailableTimes(newAvailableTimes);
        setLoadingSlots(false);
    }, [appointment?.professor_id, appointment?.duration_minutes, appointment?.id]);

    useEffect(() => {
        if (open) {
            // Limpa a seleção ao abrir o diálogo
            setSelectedDate(null);
            setSelectedTime(null);
        }
    }, [open]);

    useEffect(() => {
        if (selectedDate) {
            fetchAvailableSlots(selectedDate);
            setSelectedTime(null); // Reseta a hora ao mudar o dia
        } else {
            setAvailableTimes([]);
        }
    }, [selectedDate, fetchAvailableSlots]);


    const handleReschedule = async () => {
        if (!selectedDate || !selectedTime) {
            toast({
                title: "Erro de Reagendamento",
                description: "Selecione uma data e um horário para reagendar a aula.",
                variant: "destructive",
            });
            return;
        }

        setIsSubmitting(true);
        try {
            // Combina a data selecionada com o horário (HH:mm)
            const rescheduleDateTimeString = `${format(selectedDate, 'yyyy-MM-dd')}T${selectedTime}:00-03:00`; // Considerando fuso horário -03:00

            const { error } = await supabase
                .from('appointments')
                .update({
                    class_datetime: rescheduleDateTimeString,
                    status: 'rescheduled', // O status pode ser 'rescheduled' ou 'pending_reschedule'
                    rescheduled_by: 'professor',
                })
                .eq('id', appointment.id);

            if (error) throw error;

            toast({
                title: "Sucesso!",
                description: `Aula reagendada para ${format(parseISO(rescheduleDateTimeString), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}.`,
            });
            setOpen(false);
            if (onRescheduleSuccess) {
                onRescheduleSuccess();
            }
        } catch (error) {
            toast({
                title: "Erro ao Reagendar",
                description: error.message || "Não foi possível reagendar a aula. Tente novamente.",
                variant: "destructive",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const footerText = useMemo(() => {
        if (!selectedDate) {
            return "Selecione uma data no calendário.";
        }
        if (loadingSlots) {
            return "Buscando horários disponíveis...";
        }
        if (availableTimes.length === 0) {
            return "Nenhum horário disponível nas preferências do professor para o dia selecionado.";
        }
        if (!selectedTime) {
            return "Selecione um horário disponível.";
        }
        return `Reagendar para ${format(selectedDate, 'dd/MM/yyyy', { locale: ptBR })} às ${selectedTime}`;
    }, [selectedDate, selectedTime, availableTimes.length, loadingSlots]);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-xs">
                    Reagendar
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Reagendar Aula com {appointment.aluno_nome}</DialogTitle>
                    <DialogDescription>
                        Selecione a nova data e horário para a aula de {appointment.subject}.
                        Duração: {appointment.duration_minutes} minutos.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col items-center border p-4 rounded-lg">
                        <h4 className="font-semibold mb-2">Selecione a Data</h4>
                        <Calendar
                            mode="single"
                            selected={selectedDate}
                            onSelect={setSelectedDate}
                            locale={ptBR}
                            // Restringe seleção ao futuro (após hoje)
                            disabled={(date) => isAfter(new Date(date.setHours(23, 59, 59, 999)), new Date()) === false}
                            className="rounded-md border shadow"
                        />
                    </div>
                    <div className="border p-4 rounded-lg">
                        <h4 className="font-semibold mb-2">Selecione o Horário</h4>
                        <div className="max-h-[350px] overflow-y-auto">
                            {loadingSlots ? (
                                <div className="flex justify-center items-center h-full min-h-[100px]">
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Carregando slots...
                                </div>
                            ) : availableTimes.length > 0 ? (
                                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                    {availableTimes.map((time) => (
                                        <Button
                                            key={time}
                                            variant={selectedTime === time ? "default" : "outline"}
                                            onClick={() => setSelectedTime(time)}
                                            size="sm"
                                        >
                                            {time}
                                        </Button>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-gray-500">
                                    {selectedDate ? "Nenhum horário disponível para o dia selecionado." : "Selecione uma data para ver os horários."}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
                <DialogFooter className="mt-4">
                    <p className="mr-auto text-sm text-gray-600">{footerText}</p>
                    <Button
                        onClick={handleReschedule}
                        disabled={!selectedDate || !selectedTime || isSubmitting}
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Reagendando...
                            </>
                        ) : (
                            "Confirmar Reagendamento"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

// =============================================================================
// Componente principal AulasTab
// =============================================================================
const AulasTab = ({ professorId }) => {
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();

    const fetchAppointments = useCallback(async () => {
        setLoading(true);
        try {
            // Busca as aulas agendadas (scheduled), reagendadas (rescheduled) e pendentes (pending)
            const { data, error } = await supabase
                .from('appointments')
                .select(`
                    id, 
                    class_datetime, 
                    status, 
                    subject, 
                    duration_minutes, 
                    aluno_id,
                    aluno_profile:aluno_id(full_name) 
                `)
                .eq('professor_id', professorId)
                .in('status', ['scheduled', 'rescheduled', 'pending', 'cancelled']) // Inclui canceladas para histórico, se necessário
                .order('class_datetime', { ascending: true });

            if (error) throw error;

            const formattedData = data.map(apt => ({
                ...apt,
                aluno_nome: apt.aluno_profile ? apt.aluno_profile.full_name : 'Aluno Desconhecido',
                class_datetime_obj: parseISO(apt.class_datetime),
            })).filter(apt => ['scheduled', 'rescheduled', 'pending'].includes(apt.status) && isAfter(add(apt.class_datetime_obj, { minutes: apt.duration_minutes }), new Date()));
            // Filtra para mostrar apenas aulas futuras e com status ativo/pendente

            setAppointments(formattedData);
        } catch (error) {
            toast({
                title: "Erro de Carregamento",
                description: "Não foi possível carregar as aulas. " + error.message,
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    }, [professorId, toast]);

    useEffect(() => {
        if (professorId) {
            fetchAppointments();
        }
    }, [professorId, fetchAppointments]);

    const handleCancel = async (appointmentId) => {
        if (!window.confirm("Tem certeza que deseja cancelar esta aula?")) return;

        try {
            const { error } = await supabase
                .from('appointments')
                .update({
                    status: 'cancelled',
                    cancellation_reason: 'Professor cancelou'
                })
                .eq('id', appointmentId);

            if (error) throw error;

            toast({
                title: "Sucesso!",
                description: "Aula cancelada com sucesso.",
            });
            fetchAppointments(); // Recarrega a lista
        } catch (error) {
            toast({
                title: "Erro ao Cancelar",
                description: error.message || "Não foi possível cancelar a aula.",
                variant: "destructive",
            });
        }
    };

    if (loading) {
        return <div className="p-4 flex justify-center"><Loader2 className="mr-2 h-6 w-6 animate-spin" /> Carregando aulas...</div>;
    }

    if (appointments.length === 0) {
        return <p className="p-4 text-center text-gray-500">Você não tem aulas agendadas, reagendadas ou pendentes no futuro.</p>;
    }

    return (
        <div className="space-y-4 p-4">
            <h3 className="text-xl font-semibold mb-4">Próximas Aulas</h3>
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Data e Hora</TableHead>
                            <TableHead>Aluno</TableHead>
                            <TableHead>Assunto</TableHead>
                            <TableHead>Duração</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {appointments.map((appointment) => (
                            <TableRow key={appointment.id}>
                                <TableCell className="font-medium">
                                    {format(appointment.class_datetime_obj, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                </TableCell>
                                <TableCell>{appointment.aluno_nome}</TableCell>
                                <TableCell>{appointment.subject}</TableCell>
                                <TableCell>{appointment.duration_minutes} min</TableCell>
                                <TableCell>
                                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                        appointment.status === 'scheduled' ? 'bg-green-100 text-green-800' :
                                        appointment.status === 'rescheduled' ? 'bg-yellow-100 text-yellow-800' :
                                        'bg-blue-100 text-blue-800'
                                    }`}>
                                        {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
                                    </span>
                                </TableCell>
                                <TableCell className="text-right flex justify-end space-x-2">
                                    {appointment.status !== 'cancelled' && (
                                        <>
                                            <RescheduleDialog 
                                                appointment={appointment} 
                                                onRescheduleSuccess={fetchAppointments} 
                                            />
                                            <Button 
                                                variant="destructive" 
                                                size="sm" 
                                                className="h-7 text-xs"
                                                onClick={() => handleCancel(appointment.id)}
                                            >
                                                Cancelar
                                            </Button>
                                        </>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
};

export default AulasTab;
