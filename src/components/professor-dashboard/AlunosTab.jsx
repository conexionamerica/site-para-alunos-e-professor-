// Archivo: src/components/professor-dashboard/AlunosTab.jsx
// Versión con horarios individuales por día de la semana

import React, { useState, useMemo, useEffect } from 'react';
import { format, getDay, parseISO } from 'date-fns';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { useFormPersistence } from '@/hooks/useFormPersistence';
import { getBrazilDate } from '@/lib/dateUtils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Package, Loader2, MoreVertical, UserCheck, UserX, MessageSquare, Send, Calendar, Clock, Filter, RefreshCw } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

const daysOfWeekMap = {
    0: 'Dom',
    1: 'Seg',
    2: 'Ter',
    3: 'Qua',
    4: 'Qui',
    5: 'Sex',
    6: 'Sáb'
};

const daysOfWeekFull = {
    0: 'Domingo',
    1: 'Segunda',
    2: 'Terça',
    3: 'Quarta',
    4: 'Quinta',
    5: 'Sexta',
    6: 'Sábado'
};

// Horarios disponibles (07:00 a 23:45 en intervalos de 15 minutos)
const generateTimeOptions = () => {
    const times = [];
    for (let hour = 7; hour <= 23; hour++) {
        for (let minute = 0; minute < 60; minute += 15) {
            if (hour === 23 && minute > 45) break;
            times.push(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
        }
    }
    return times;
};

const TIME_OPTIONS = generateTimeOptions();

// Dialog para cambiar días y horarios de aulas (con horarios individuales por día)
const ChangeScheduleDialog = ({ student, isOpen, onClose, onUpdate, professorId, scheduledAppointments }) => {
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    // Estructura: { dayIndex: { enabled: boolean, time: string } }
    const [daySchedules, setDaySchedules] = useState({
        0: { enabled: false, time: '08:00' },
        1: { enabled: false, time: '08:00' },
        2: { enabled: false, time: '08:00' },
        3: { enabled: false, time: '08:00' },
        4: { enabled: false, time: '08:00' },
        5: { enabled: false, time: '08:00' },
        6: { enabled: false, time: '08:00' }
    });

    // Obtener días y horarios actuales del alumno
    useMemo(() => {
        if (scheduledAppointments && scheduledAppointments.length > 0) {
            const schedules = {};

            // Inicializar todos los días como deshabilitados
            for (let i = 0; i < 7; i++) {
                schedules[i] = { enabled: false, time: '08:00' };
            }

            // Agrupar appointments por día y obtener el horario más común para cada día
            scheduledAppointments.forEach(apt => {
                const aptDate = parseISO(apt.class_datetime);
                const dayOfWeek = getDay(aptDate);
                const time = format(aptDate, 'HH:mm');

                if (!schedules[dayOfWeek].enabled) {
                    schedules[dayOfWeek] = { enabled: true, time };
                }
            });

            setDaySchedules(schedules);
        }
    }, [scheduledAppointments]);

    const handleDayToggle = (dayIndex) => {
        setDaySchedules(prev => ({
            ...prev,
            [dayIndex]: {
                ...prev[dayIndex],
                enabled: !prev[dayIndex].enabled
            }
        }));
    };

    const handleTimeChange = (dayIndex, time) => {
        setDaySchedules(prev => ({
            ...prev,
            [dayIndex]: {
                ...prev[dayIndex],
                time
            }
        }));
    };

    const handleSubmit = async () => {
        // Validar que al menos un día esté seleccionado
        const enabledDays = Object.entries(daySchedules).filter(([_, schedule]) => schedule.enabled);

        if (enabledDays.length === 0) {
            toast({
                variant: 'destructive',
                title: 'Campos obrigatórios',
                description: 'Selecione pelo menos um dia da semana.'
            });
            return;
        }

        // Crear resumen para confirmación
        const scheduleText = enabledDays
            .map(([day, schedule]) => `${daysOfWeekFull[day]} às ${schedule.time}`)
            .join('\n');

        if (!window.confirm(
            `Tem certeza que deseja alterar o horário das aulas de ${student.full_name}?\n\n` +
            `Novos horários:\n${scheduleText}\n\n` +
            `Isso afetará ${scheduledAppointments.length} aulas agendadas.`
        )) {
            return;
        }

        setIsSubmitting(true);

        try {
            // 1. Agrupar aulas por semana
            const appointmentsByWeek = {};
            scheduledAppointments.forEach(apt => {
                const aptDate = parseISO(apt.class_datetime);
                const weekKey = format(aptDate, 'yyyy-ww');
                if (!appointmentsByWeek[weekKey]) {
                    appointmentsByWeek[weekKey] = [];
                }
                appointmentsByWeek[weekKey].push(apt);
            });

            // 2. Para cada semana, reorganizar las aulas según los nuevos días y horarios
            const updates = [];

            for (const [weekKey, weekAppointments] of Object.entries(appointmentsByWeek)) {
                // Ordenar por fecha
                weekAppointments.sort((a, b) =>
                    new Date(a.class_datetime) - new Date(b.class_datetime)
                );

                // Obtener la fecha de inicio de la semana
                const firstApt = weekAppointments[0];
                const firstDate = parseISO(firstApt.class_datetime);

                // Calcular el inicio de la semana (domingo)
                const dayOfWeek = getDay(firstDate);
                const weekStart = new Date(firstDate);
                weekStart.setDate(weekStart.getDate() - dayOfWeek);

                // Crear nuevas fechas para los días seleccionados con sus horarios específicos
                const newDates = [];
                enabledDays.forEach(([dayIndex, schedule]) => {
                    const newDate = new Date(weekStart);
                    newDate.setDate(newDate.getDate() + parseInt(dayIndex));

                    // Establecer el horario específico de este día
                    const [hours, minutes] = schedule.time.split(':').map(Number);
                    newDate.setHours(hours, minutes, 0, 0);

                    newDates.push(newDate);
                });

                // Ordenar las nuevas fechas cronológicamente
                newDates.sort((a, b) => a - b);

                // Asignar las nuevas fechas a los appointments
                weekAppointments.forEach((apt, index) => {
                    if (index < newDates.length) {
                        updates.push({
                            id: apt.id,
                            class_datetime: newDates[index].toISOString()
                        });
                    } else {
                        // Si hay más appointments que días seleccionados, cancelar los extras
                        updates.push({
                            id: apt.id,
                            status: 'cancelled'
                        });
                    }
                });
            }

            // 3. Ejecutar las actualizaciones
            for (const update of updates) {
                const { error } = await supabase
                    .from('appointments')
                    .update(update.status ? { status: update.status } : { class_datetime: update.class_datetime })
                    .eq('id', update.id);

                if (error) throw error;
            }

            // 4. Atualizar rotina no perfil (Requisito de Coerência)
            const newPrefs = {};
            enabledDays.forEach(([day, schedule]) => {
                newPrefs[day] = schedule.time;
            });
            await supabase.from('profiles').update({
                preferred_schedule: newPrefs
            }).eq('id', student.id);


            const updatedCount = updates.filter(u => !u.status).length;
            const cancelledCount = updates.filter(u => u.status).length;

            toast({
                title: 'Horários atualizados!',
                description: `${updatedCount} aulas reagendadas${cancelledCount > 0 ? ` e ${cancelledCount} canceladas` : ''}.`
            });

            onUpdate();
            onClose();
        } catch (error) {
            console.error('Error updating schedule:', error);
            toast({
                variant: 'destructive',
                title: 'Erro ao atualizar horários',
                description: error.message
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!student) return null;

    const enabledDays = Object.entries(daySchedules).filter(([_, schedule]) => schedule.enabled);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Alterar Dias e Horários</DialogTitle>
                    <DialogDescription>
                        Alterar os dias da semana e horários das aulas agendadas de {student.full_name}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Información actual */}
                    <div className="bg-slate-50 p-3 rounded-lg">
                        <p className="text-sm font-medium text-slate-700 mb-1">Aulas agendadas: {scheduledAppointments.length}</p>
                        <p className="text-xs text-slate-500">
                            Somente aulas com status "agendada" serão alteradas
                        </p>
                    </div>

                    {/* Selección de días con horarios individuales */}
                    <div className="space-y-3">
                        <Label className="text-base font-semibold">Dias da Semana e Horários</Label>
                        <div className="space-y-2">
                            {Object.entries(daysOfWeekFull).map(([dayIndex, dayName]) => {
                                const idx = parseInt(dayIndex);
                                const schedule = daySchedules[idx];

                                return (
                                    <div key={idx} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-slate-50">
                                        <Checkbox
                                            id={`day-${idx}`}
                                            checked={schedule.enabled}
                                            onCheckedChange={() => handleDayToggle(idx)}
                                        />
                                        <label
                                            htmlFor={`day-${idx}`}
                                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                                        >
                                            {dayName}
                                        </label>
                                        <Select
                                            value={schedule.time}
                                            onValueChange={(time) => handleTimeChange(idx, time)}
                                            disabled={!schedule.enabled}
                                        >
                                            <SelectTrigger className={`w-[120px] ${!schedule.enabled && 'opacity-50'}`}>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="max-h-60">
                                                {TIME_OPTIONS.map(time => (
                                                    <SelectItem key={time} value={time}>
                                                        {time}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Preview */}
                    {enabledDays.length > 0 && (
                        <div className="bg-blue-50 p-4 rounded-lg">
                            <p className="text-sm font-medium text-blue-900 mb-2">Novos horários:</p>
                            <div className="space-y-1">
                                {enabledDays.map(([day, schedule]) => (
                                    <p key={day} className="text-sm text-blue-700">
                                        • {daysOfWeekFull[day]} às {schedule.time}
                                    </p>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={isSubmitting || enabledDays.length === 0}
                        className="bg-sky-600 hover:bg-sky-700"
                    >
                        {isSubmitting ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</>
                        ) : (
                            'Salvar Alterações'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

// Dialog para alterar professor vinculado ao aluno
const ChangeProfessorDialog = ({ student, isOpen, onClose, onUpdate, professors, classSlots, currentProfessorId }) => {
    const { toast } = useToast();
    const [selectedProfessor, setSelectedProfessor] = useState(null);
    const [professorsWithMatch, setProfessorsWithMatch] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isCalculating, setIsCalculating] = useState(true);

    // Calcular compatibilidade quando o dialog abrir
    useEffect(() => {
        if (!isOpen || !student || !professors.length) return;

        setIsCalculating(true);

        const calculateMatches = () => {
            const studentSchedule = student.daySchedules || {};
            const studentDays = Object.keys(studentSchedule);

            if (studentDays.length === 0) {
                setProfessorsWithMatch([]);
                setIsCalculating(false);
                return;
            }

            const matches = professors
                .filter(prof => prof.id !== student.assigned_professor_id) // Excluir professor atual
                .map(professor => {
                    // Buscar slots ativos do professor
                    const professorSlots = (classSlots || []).filter(
                        slot => slot.professor_id === professor.id && slot.status === 'active'
                    );

                    let matchingSlots = 0;

                    // Verificar compatibilidade para cada dia do aluno
                    studentDays.forEach(dayIndex => {
                        const studentTime = studentSchedule[dayIndex]; // "HH:mm"
                        const hasMatch = professorSlots.some(
                            slot => {
                                const slotTimeClean = slot.start_time.substring(0, 5); // Pega apenas "HH:mm" de "HH:mm:ss"
                                return slot.day_of_week === parseInt(dayIndex) && slotTimeClean === studentTime;
                            }
                        );
                        if (hasMatch) matchingSlots++;
                    });

                    const matchPercentage = Math.round((matchingSlots / studentDays.length) * 100);

                    return {
                        professor,
                        matchPercentage,
                        matchingSlots,
                        totalSlots: studentDays.length
                    };
                })
                .filter(match => match.matchPercentage === 100) // ESTRITO: Apenas 100% compatível
                .sort((a, b) => b.matchPercentage - a.matchPercentage); // Ordenar por compatibilidade

            setProfessorsWithMatch(matches);
            setIsCalculating(false);
        };

        calculateMatches();
    }, [isOpen, student, professors, classSlots]);

    const handleChangeProfessor = async () => {
        if (!selectedProfessor || !student) return;

        const confirmation = window.confirm(
            `Tem certeza que deseja iniciar a transferência de ${student.full_name} para ${selectedProfessor.full_name}?\n\n` +
            `O aluno perderá o vínculo atual e o novo professor precisará APROVAR a transferência.\n\n` +
            `Isso afetará todas as aulas agendadas, remarcadas e com falta do aluno.`
        );

        if (!confirmation) return;

        setIsSubmitting(true);

        try {
            // Salvar dados do professor antigo para o histórico da solicitação
            const oldProfessorId = student.assigned_professor_id;
            const oldProfessorName = professors.find(p => p.id === oldProfessorId)?.full_name || 'Desconhecido';

            // 2. USAR RPC V4 PARA LIMPEZA TOTAL (Desvincular e Liberar Slots e Histórico)
            // Isso garante que os slots do professor antigo sejam liberados atomicamente
            const { error: rpcError } = await supabase.rpc('transfer_student_data', {
                p_student_id: student.id,
                p_professor_id: null // NULL = Desvincular e limpar
            });

            if (rpcError) throw rpcError;

            // 3. Atualizar perfil do aluno para definir o NOVO professor como PENDENTE
            const { error: profileError } = await supabase
                .from('profiles')
                .update({
                    // assigned_professor_id já é null pela RPC
                    pending_professor_id: selectedProfessor.id,
                    pending_professor_status: 'aguardando_aprovacao',
                    pending_professor_requested_at: new Date().toISOString()
                })
                .eq('id', student.id);

            if (profileError) throw profileError;

            // 4. Criar solicitação na tabela solicitudes_clase para o novo professor
            const solicitacaoData = {
                type: 'vinculacao',
                is_recurring: false,
                student_name: student.full_name,
                old_professor_id: oldProfessorId,
                old_professor_name: oldProfessorName,
                preferred_schedule: student.preferred_schedule || student.daySchedules,
                days: Object.keys(student.daySchedules || {}).map(Number),
                time: Object.values(student.daySchedules || {})[0] || '08:00'
            };

            const { error: solicitacaoError } = await supabase.from('solicitudes_clase').insert({
                alumno_id: student.id,
                profesor_id: selectedProfessor.id,
                horarios_propuestos: JSON.stringify(solicitacaoData),
                status: 'Pendiente',
                is_recurring: false
            });

            if (solicitacaoError) console.error('Error creating solicitation:', solicitacaoError);

            toast({
                title: 'Solicitação de transferência enviada!',
                description: `Aguardando aprovação de ${selectedProfessor.full_name}. A solicitação aparecerá na tela inicial do professor.`
            });

            onUpdate();
            onClose();
            setSelectedProfessor(null);
        } catch (error) {
            console.error('Error changing professor:', error);
            toast({
                variant: 'destructive',
                title: 'Erro ao alterar professor',
                description: error.message
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!student) return null;

    const handleUnbind = async () => {
        if (!student) return;

        const confirmUnbind = window.confirm(
            `Tem certeza que deseja DESVINCULAR ${student.full_name}?\n\n` +
            `O aluno ficará sem professor e os horários na agenda do professor antigo serão LIBERADOS imediatamente.`
        );

        if (!confirmUnbind) return;

        setIsSubmitting(true);
        try {
            const { error: rpcError } = await supabase.rpc('transfer_student_data', {
                p_student_id: student.id,
                p_professor_id: null // NULL desvincula e libera slots
            });

            if (rpcError) throw rpcError;

            toast({
                title: 'Aluno desvinculado!',
                description: 'Vínculo removido e horários liberados com sucesso.'
            });

            onUpdate();
            onClose();
        } catch (error) {
            console.error('Erro ao desvincular:', error);
            toast({
                variant: 'destructive',
                title: 'Erro ao desvincular',
                description: error.message
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const selectedMatch = professorsWithMatch.find(m => m.professor.id === selectedProfessor?.id);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Alterar Professor Vinculado</DialogTitle>
                    <DialogDescription>
                        Transferir {student.full_name} para outro professor compatível
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Horários do aluno */}
                    <div className="bg-slate-50 p-4 rounded-lg">
                        <h4 className="font-semibold text-sm text-slate-700 mb-2">Horários do Aluno:</h4>
                        <div className="flex flex-wrap gap-2">
                            {Object.entries(student.daySchedules || {}).map(([day, time]) => (
                                <Badge key={day} variant="outline" className="text-xs">
                                    {daysOfWeekMap[day]} - {time}
                                </Badge>
                            ))}
                            {Object.keys(student.daySchedules || {}).length === 0 && (
                                <span className="text-xs text-slate-500">Nenhum horário definido</span>
                            )}
                        </div>
                    </div>

                    {/* Lista de professores compatíveis */}
                    {isCalculating ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
                            <span className="ml-2 text-sm text-slate-600">Calculando compatibilidade...</span>
                        </div>
                    ) : professorsWithMatch.length === 0 ? (
                        <div className="text-center py-8 text-slate-500">
                            <UserX className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                            <p className="font-medium">Nenhum professor compatível encontrado</p>
                            <p className="text-sm mt-1">Os horários do aluno não coincidem com nenhum professor disponível</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <h4 className="font-semibold text-sm text-slate-700">Professores Disponíveis:</h4>
                            {professorsWithMatch.map(({ professor, matchPercentage, matchingSlots, totalSlots }) => {
                                const isFullMatch = matchPercentage === 100;
                                const isSelected = selectedProfessor?.id === professor.id;

                                return (
                                    <div
                                        key={professor.id}
                                        onClick={() => isFullMatch && setSelectedProfessor(professor)}
                                        className={`border p-3 rounded-lg transition-all ${isFullMatch ? 'cursor-pointer hover:bg-purple-50 hover:border-purple-300' : 'opacity-50 cursor-not-allowed'
                                            } ${isSelected ? 'border-purple-600 bg-purple-50' : ''
                                            }`}
                                    >
                                        <div className="flex justify-between items-start">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    {isSelected && <UserCheck className="h-4 w-4 text-purple-600" />}
                                                    <span className="font-medium text-slate-800">{professor.full_name}</span>
                                                </div>
                                                <p className="text-xs text-slate-500 mt-1">
                                                    {matchingSlots} de {totalSlots} horários compatíveis
                                                </p>
                                            </div>
                                            <Badge
                                                variant={isFullMatch ? 'default' : 'secondary'}
                                                className={isFullMatch ? 'bg-green-600' : ''}
                                            >
                                                {matchPercentage}%
                                            </Badge>
                                        </div>
                                        {!isFullMatch && (
                                            <p className="text-xs text-orange-600 mt-2">
                                                ⚠️ Compatibilidade parcial - não é possível transferir
                                            </p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {selectedMatch && (
                        <div className="bg-green-50 border border-green-200 p-3 rounded-lg">
                            <p className="text-sm text-green-800">
                                ✓ Professor <strong>{selectedMatch.professor.full_name}</strong> selecionado
                            </p>
                            <p className="text-xs text-green-700 mt-1">
                                Compatibilidade: {selectedMatch.matchPercentage}% ({selectedMatch.matchingSlots}/{selectedMatch.totalSlots} horários)
                            </p>
                        </div>
                    )}
                </div>

                <DialogFooter className="flex sm:justify-between items-center w-full">
                    <Button
                        type="button"
                        variant="ghost"
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={handleUnbind}
                        disabled={isSubmitting}
                    >
                        <UserX className="mr-2 h-4 w-4" />
                        Desvincular
                    </Button>

                    <div className="flex gap-2">
                        <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleChangeProfessor}
                            disabled={!selectedProfessor || isSubmitting}
                            className="bg-purple-600 hover:bg-purple-700"
                        >
                            {isSubmitting ? (
                                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processando...</>
                            ) : (
                                <><RefreshCw className="mr-2 h-4 w-4" /> Confirmar Alteração</>
                            )}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const AlunosTab = ({ dashboardData }) => {
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [isMessageDialogOpen, setIsMessageDialogOpen] = useState(false);
    const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
    const [isChangeProfessorDialogOpen, setIsChangeProfessorDialogOpen] = useState(false);
    const [messageDraft, setMessageDraft, clearMessageDraft] = useFormPersistence('student_message_form', {
        title: '',
        content: '',
        priority: 'normal'
    });
    const { title: messageTitle, content: messageContent, priority: messagePriority } = messageDraft;
    const setMessageField = (field, value) => setMessageDraft(prev => ({ ...prev, [field]: value }));
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Extrai de forma segura as propriedades
    const data = dashboardData?.data || {};
    const loading = dashboardData?.loading || false;
    const professorId = dashboardData?.professorId;
    const onUpdate = dashboardData?.onUpdate;
    const isSuperadmin = dashboardData?.isSuperadmin || false;
    const professors = data.professors || [];
    const can_manage_students = data.can_manage_students !== false;

    // Filtro global de professor (passado do ProfessorDashboardPage)
    const globalProfessorFilter = dashboardData?.globalProfessorFilter;

    // Estado para filtro de professor local (fallback para superadmin)
    const [professorFilter, setProfessorFilter] = useState('all');

    // Determinar o filtro efetivo de professor
    const effectiveProfessorFilter = globalProfessorFilter && globalProfessorFilter !== 'all'
        ? globalProfessorFilter
        : professorFilter;

    // Asignaciones seguras
    const students = data.students || [];
    const allBillings = data.allBillings || [];
    const allAppointments = data.appointments || [];
    const assignedLogs = data.assignedLogs || [];

    const studentsWithData = useMemo(() => {
        if (!students || !allBillings || !allAppointments || !assignedLogs) return [];

        return students.map(student => {
            const studentAppointments = allAppointments.filter(a => a.student_id === student.id);

            // Aulas agendadas (solo scheduled)
            const scheduledAppointments = studentAppointments.filter(a => a.status === 'scheduled');

            // Obtener días de la semana con sus horarios específicos
            const daySchedules = {};

            scheduledAppointments.forEach(apt => {
                const aptDate = parseISO(apt.class_datetime);
                const dayOfWeek = getDay(aptDate);
                const time = format(aptDate, 'HH:mm');

                if (!daySchedules[dayOfWeek]) {
                    daySchedules[dayOfWeek] = time;
                }
            });

            // Filtra logs ativos
            const studentLogs = assignedLogs.filter(l =>
                l.student_id === student.id && l.status !== 'Cancelado'
            );

            // Cálculo de classes totais
            const totalClasses = studentLogs.reduce((acc, log) => {
                return acc + (log.assigned_classes || 0);
            }, 0);

            // Clases usadas/agendadas
            const usedClasses = studentAppointments.filter(a =>
                ['scheduled', 'completed', 'missed'].includes(a.status)
            ).length;

            const availableClasses = totalClasses - usedClasses;
            const scheduledClasses = scheduledAppointments.length;

            return {
                ...student,
                availableClasses: Math.max(0, availableClasses),
                scheduledClasses, // Quantidade de aulas agendadas
                daySchedules: Object.keys(daySchedules).length > 0 ? daySchedules : (student.preferred_schedule || {}), // { dayIndex: time }
                scheduledAppointments
            };
        });
    }, [students, allBillings, allAppointments, assignedLogs]);

    const filteredStudents = studentsWithData.filter(s => {
        const matchesSearch = s.full_name?.toLowerCase().includes(searchTerm.toLowerCase());

        // Para professores normais: mostrar apenas alunos vinculados a ele
        if (!isSuperadmin) {
            return matchesSearch && s.assigned_professor_id === professorId;
        }

        // Superadmin com filtro ativo: filtrar por assigned_professor_id
        if (effectiveProfessorFilter !== 'all') {
            if (effectiveProfessorFilter === 'none') {
                return matchesSearch && !s.assigned_professor_id;
            }
            return matchesSearch && s.assigned_professor_id === effectiveProfessorFilter;
        }

        // Superadmin sem filtro: mostrar todos
        return matchesSearch;
    });

    // Debug
    useEffect(() => {
        console.log('AlunosTab Total Students:', students.length);
        console.log('AlunosTab Filtered Students:', filteredStudents.length);
        console.log('AlunosTab Filter:', effectiveProfessorFilter);
    }, [students.length, filteredStudents.length, effectiveProfessorFilter]);



    const handleOpenMessageDialog = (student) => {
        setSelectedStudent(student);
        setIsMessageDialogOpen(true);
    };

    const handleOpenScheduleDialog = (student) => {
        setSelectedStudent(student);
        setIsScheduleDialogOpen(true);
    };

    const handleOpenChangeProfessorDialog = (student) => {
        setSelectedStudent(student);
        setIsChangeProfessorDialogOpen(true);
    };

    const handleSendMessage = async () => {
        if (!messageTitle.trim() || !messageContent.trim()) {
            toast({
                variant: 'destructive',
                title: 'Campos obrigatórios',
                description: 'Preencha o título e a mensagem.'
            });
            return;
        }

        setIsSubmitting(true);

        try {
            const { error: messageError } = await supabase
                .from('student_messages')
                .insert({
                    professor_id: professorId,
                    student_id: selectedStudent.id,
                    title: messageTitle,
                    message: messageContent,
                    priority: messagePriority,
                });

            if (messageError) throw messageError;

            await supabase.from('notifications').insert({
                user_id: selectedStudent.id,
                type: 'professor_message',
                content: {
                    message: `Nova mensagem do professor: ${messageTitle}`,
                    priority: messagePriority
                }
            });

            toast({
                title: 'Mensagem enviada!',
                description: `Mensagem enviada para ${selectedStudent.full_name}.`
            });

            setIsMessageDialogOpen(false);
            clearMessageDraft();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Erro ao enviar mensagem',
                description: error.message
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="w-full">
            <div className="w-full px-4 lg:px-8">
                <div className="bg-white p-6 rounded-lg shadow-sm">
                    <h3 className="font-bold mb-4">Gerenciar Alunos ({filteredStudents.length})</h3>
                    <div className="flex justify-between items-center mb-4 gap-4 flex-wrap">
                        <div className="relative w-full max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                            <Input placeholder="Buscar por nome..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" />
                        </div>

                        {/* Filtro de professor para superadmin */}
                        {isSuperadmin && professors.length > 0 && (
                            <Select value={professorFilter} onValueChange={setProfessorFilter}>
                                <SelectTrigger className="w-[200px]">
                                    <Filter className="h-4 w-4 mr-2" />
                                    <SelectValue placeholder="Filtrar professor" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos os professores</SelectItem>
                                    <SelectItem value="none">Sem Professor Vinculado</SelectItem>
                                    {professors.map(prof => (
                                        <SelectItem key={prof.id} value={prof.id}>
                                            {prof.full_name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </div>
                    <div className="border rounded-lg overflow-hidden">
                        <Table>
                            <TableHeader className="bg-slate-50">
                                <TableRow>
                                    <TableHead>Código</TableHead>
                                    <TableHead>Nome</TableHead>
                                    <TableHead>Idade</TableHead>
                                    <TableHead>Nível</TableHead>
                                    <TableHead>Professor</TableHead>
                                    <TableHead>Dias de Aula</TableHead>
                                    <TableHead>Aulas Agendadas</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead>Membro Desde</TableHead>
                                    {can_manage_students && <TableHead className="text-right">Ações</TableHead>}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? <TableRow><TableCell colSpan={can_manage_students ? "10" : "9"} className="text-center"><Loader2 className="mx-auto my-4 h-6 w-6 animate-spin" /></TableCell></TableRow> :
                                    filteredStudents.length > 0 ? filteredStudents.map(student => (
                                        <TableRow key={student.id}>
                                            <TableCell className="font-mono text-sm text-slate-600">
                                                {student.student_code || '-'}
                                            </TableCell>
                                            <TableCell className="font-medium">
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-8 w-8"><AvatarImage src={student.avatar_url} /><AvatarFallback>{student.full_name?.[0] || 'A'}</AvatarFallback></Avatar>
                                                    {student.full_name}
                                                </div>
                                            </TableCell>
                                            <TableCell>{student.age || 'N/A'}</TableCell>
                                            <TableCell>{student.spanish_level || 'N/A'}</TableCell>
                                            <TableCell>
                                                {professors.find(p => p.id === student.assigned_professor_id)?.full_name || '—'}
                                            </TableCell>
                                            <TableCell>
                                                {Object.keys(student.daySchedules).length > 0 ? (
                                                    <div className="flex flex-col gap-1">
                                                        {Object.entries(student.daySchedules)
                                                            .sort(([a], [b]) => parseInt(a) - parseInt(b))
                                                            .map(([day, time]) => (
                                                                <div key={day} className="flex items-center gap-2">
                                                                    <Badge variant="outline" className="text-xs">
                                                                        {daysOfWeekMap[day]}
                                                                    </Badge>
                                                                    <span className="text-xs text-slate-600">
                                                                        <Clock className="inline h-3 w-3 mr-1" />
                                                                        {time}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-slate-400">Sem aulas</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2 font-semibold">
                                                    <Package className="h-4 w-4 text-sky-500" />
                                                    {student.scheduledClasses}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col gap-1 items-start">
                                                    {student.is_active !== false ? (
                                                        <Badge className="bg-green-100 text-green-800 hover:bg-green-200">Ativo</Badge>
                                                    ) : (
                                                        <Badge variant="destructive">Inativo</Badge>
                                                    )}
                                                    {student.pending_professor_status === 'rejeitado' && (
                                                        <Badge variant="outline" className="text-xs bg-red-50 text-red-600 border-red-200">
                                                            Rejeitado
                                                        </Badge>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>{format(new Date(student.created_at), 'dd/MM/yyyy')}</TableCell>
                                            {can_manage_students && (
                                                <TableCell className="text-right">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon">
                                                                <MoreVertical className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            {student.scheduledAppointments.length > 0 && (
                                                                <>
                                                                    <DropdownMenuItem onClick={() => handleOpenScheduleDialog(student)}>
                                                                        <Calendar className="mr-2 h-4 w-4 text-blue-600" />
                                                                        Alterar Dias/Horários
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuSeparator />
                                                                </>
                                                            )}

                                                            <DropdownMenuItem onClick={() => handleOpenChangeProfessorDialog(student)}>
                                                                <RefreshCw className="mr-2 h-4 w-4 text-purple-600" />
                                                                Alterar Professor Vinculado
                                                            </DropdownMenuItem>

                                                            <DropdownMenuSeparator />

                                                            <DropdownMenuItem onClick={() => handleOpenMessageDialog(student)}>
                                                                <MessageSquare className="mr-2 h-4 w-4 text-sky-600" />
                                                                Enviar Mensagem
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            )}
                                        </TableRow>
                                    )) : <TableRow><TableCell colSpan={can_manage_students ? "10" : "9"} className="text-center py-8 text-slate-500">Nenhum aluno encontrado.</TableCell></TableRow>}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Dialog de Mensaje */}
                    <Dialog open={isMessageDialogOpen} onOpenChange={setIsMessageDialogOpen}>
                        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle>Enviar Mensagem para {selectedStudent?.full_name}</DialogTitle>
                                <DialogDescription>
                                    A mensagem aparecerá no painel do aluno como um aviso importante.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label htmlFor="title">Título da Mensagem</Label>
                                    <Input
                                        id="title"
                                        placeholder="Ex: Tarefa da próxima aula"
                                        value={messageTitle}
                                        onChange={(e) => setMessageField('title', e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="message">Mensagem</Label>
                                    <Textarea
                                        id="message"
                                        placeholder="Digite sua mensagem..."
                                        value={messageContent}
                                        onChange={(e) => setMessageField('content', e.target.value)}
                                        rows={5}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="priority">Prioridade</Label>
                                    <Select value={messagePriority} onValueChange={(v) => setMessageField('priority', v)}>
                                        <SelectTrigger id="priority">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="normal">Normal</SelectItem>
                                            <SelectItem value="important">Importante</SelectItem>
                                            <SelectItem value="urgent">Urgente</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button
                                    onClick={handleSendMessage}
                                    disabled={isSubmitting}
                                    className="bg-sky-500 hover:bg-sky-600"
                                >
                                    {isSubmitting ? (
                                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando...</>
                                    ) : (
                                        <><Send className="mr-2 h-4 w-4" /> Enviar Mensagem</>
                                    )}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    {/* Dialog de Cambiar Horarios */}
                    <ChangeScheduleDialog
                        student={selectedStudent}
                        isOpen={isScheduleDialogOpen}
                        onClose={() => setIsScheduleDialogOpen(false)}
                        onUpdate={onUpdate}
                        professorId={professorId}
                        scheduledAppointments={selectedStudent?.scheduledAppointments || []}
                    />

                    {/* Dialog de Alterar Professor */}
                    <ChangeProfessorDialog
                        student={selectedStudent}
                        isOpen={isChangeProfessorDialogOpen}
                        onClose={() => setIsChangeProfessorDialogOpen(false)}
                        onUpdate={onUpdate}
                        professors={professors}
                        classSlots={data.allClassSlots || data.classSlots || []}
                        currentProfessorId={professorId}
                    />
                </div>
            </div>
        </div>
    );
};

export default AlunosTab;
