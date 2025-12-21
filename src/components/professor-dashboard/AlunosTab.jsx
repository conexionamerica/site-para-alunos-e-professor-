// Archivo: src/components/professor-dashboard/AlunosTab.jsx
// Versión con horarios individuales por día de la semana

import React, { useState, useMemo } from 'react';
import { format, getDay, parseISO } from 'date-fns';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
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
import { Search, Package, Loader2, MoreVertical, UserCheck, UserX, MessageSquare, Send, Calendar, Clock } from 'lucide-react';
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

const AlunosTab = ({ dashboardData }) => {
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [isMessageDialogOpen, setIsMessageDialogOpen] = useState(false);
    const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
    const [messageTitle, setMessageTitle] = useState('');
    const [messageContent, setMessageContent] = useState('');
    const [messagePriority, setMessagePriority] = useState('normal');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Extrai de forma segura as propriedades
    const data = dashboardData?.data || {};
    const loading = dashboardData?.loading || false;
    const professorId = dashboardData?.professorId;
    const onUpdate = dashboardData?.onUpdate;

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

            return {
                ...student,
                availableClasses: Math.max(0, availableClasses),
                daySchedules, // { dayIndex: time }
                scheduledAppointments
            };
        });
    }, [students, allBillings, allAppointments, assignedLogs]);

    const filteredStudents = studentsWithData.filter(s =>
        s.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Función para activar/inactivar alumno
    const handleToggleActive = async (student) => {
        const isCurrentlyActive = student.is_active !== false;
        const newStatus = !isCurrentlyActive;
        const action = newStatus ? 'ativar' : 'inativar';

        if (!window.confirm(`Tem certeza que deseja ${action} o aluno ${student.full_name}?`)) {
            return;
        }

        try {
            const { error: profileError } = await supabase
                .from('profiles')
                .update({ is_active: newStatus })
                .eq('id', student.id);

            if (profileError) throw profileError;

            if (!newStatus) {
                const { data: futureAppointments, error: apptError } = await supabase
                    .from('appointments')
                    .select('class_slot_id, duration_minutes, class_datetime')
                    .eq('student_id', student.id)
                    .gte('class_datetime', getBrazilDate().toISOString())
                    .in('status', ['scheduled', 'pending', 'rescheduled']);

                if (apptError) {
                    console.error('Error fetching appointments:', apptError);
                } else if (futureAppointments && futureAppointments.length > 0) {
                    const slotIdsToFree = new Set();

                    for (const apt of futureAppointments) {
                        if (apt.class_slot_id) {
                            slotIdsToFree.add(apt.class_slot_id);

                            const slotsNeeded = Math.ceil((apt.duration_minutes || 30) / 15);
                            if (slotsNeeded > 1) {
                                const { data: consecutiveSlots } = await supabase
                                    .from('class_slots')
                                    .select('id, day_of_week, start_time')
                                    .eq('professor_id', professorId)
                                    .eq('status', 'filled');

                                consecutiveSlots?.forEach(slot => slotIdsToFree.add(slot.id));
                            }
                        }
                    }

                    if (slotIdsToFree.size > 0) {
                        const { error: updateSlotsError } = await supabase
                            .from('class_slots')
                            .update({ status: 'active' })
                            .in('id', Array.from(slotIdsToFree));

                        if (updateSlotsError) {
                            console.error('Error liberating slots:', updateSlotsError);
                            toast({
                                variant: 'warning',
                                title: 'Aviso',
                                description: 'Aluno inativado, mas alguns horários podem não ter sido liberados.'
                            });
                        } else {
                            toast({
                                title: 'Sucesso!',
                                description: `Aluno inativado e ${slotIdsToFree.size} horário(s) liberado(s) com sucesso.`
                            });
                        }
                    }

                    await supabase
                        .from('appointments')
                        .update({ status: 'cancelled' })
                        .eq('student_id', student.id)
                        .gte('class_datetime', getBrazilDate().toISOString())
                        .in('status', ['scheduled', 'pending', 'rescheduled']);
                }
            } else {
                toast({
                    title: 'Sucesso!',
                    description: `Aluno ativado com sucesso.`
                });
            }

            if (onUpdate) onUpdate();

        } catch (error) {
            console.error('Error toggling student status:', error);
            toast({
                variant: 'destructive',
                title: 'Erro',
                description: `Não foi possível ${action} o aluno: ${error.message}`
            });
        }
    };

    const handleOpenMessageDialog = (student) => {
        setSelectedStudent(student);
        setIsMessageDialogOpen(true);
    };

    const handleOpenScheduleDialog = (student) => {
        setSelectedStudent(student);
        setIsScheduleDialogOpen(true);
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
            setMessageTitle('');
            setMessageContent('');
            setMessagePriority('normal');
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
        <div className="bg-white p-6 rounded-lg shadow-sm">
            <h3 className="font-bold mb-4">Gerenciar Alunos ({students.length})</h3>
            <div className="flex justify-between items-center mb-4">
                <div className="relative w-full max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <Input placeholder="Buscar por nome..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" />
                </div>
            </div>
            <div className="border rounded-lg overflow-hidden">
                <Table>
                    <TableHeader className="bg-slate-50">
                        <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>Idade</TableHead>
                            <TableHead>Nível</TableHead>
                            <TableHead>Dias de Aula</TableHead>
                            <TableHead>Aulas Disponíveis</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead>Membro Desde</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? <TableRow><TableCell colSpan="8" className="text-center"><Loader2 className="mx-auto my-4 h-6 w-6 animate-spin" /></TableCell></TableRow> :
                            filteredStudents.length > 0 ? filteredStudents.map(student => (
                                <TableRow key={student.id}>
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-8 w-8"><AvatarImage src={student.avatar_url} /><AvatarFallback>{student.full_name?.[0] || 'A'}</AvatarFallback></Avatar>
                                            {student.full_name}
                                        </div>
                                    </TableCell>
                                    <TableCell>{student.age || 'N/A'}</TableCell>
                                    <TableCell>{student.spanish_level || 'N/A'}</TableCell>
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
                                            {student.availableClasses}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {student.is_active !== false ? (
                                            <Badge className="bg-green-100 text-green-800 hover:bg-green-200">Ativo</Badge>
                                        ) : (
                                            <Badge variant="destructive">Inativo</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell>{format(new Date(student.created_at), 'dd/MM/yyyy')}</TableCell>
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
                                                <DropdownMenuItem onClick={() => handleToggleActive(student)}>
                                                    {student.is_active !== false ? (
                                                        <><UserX className="mr-2 h-4 w-4 text-orange-600" /> Inativar Aluno</>
                                                    ) : (
                                                        <><UserCheck className="mr-2 h-4 w-4 text-green-600" /> Ativar Aluno</>
                                                    )}
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem onClick={() => handleOpenMessageDialog(student)}>
                                                    <MessageSquare className="mr-2 h-4 w-4 text-sky-600" />
                                                    Enviar Mensagem
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            )) : <TableRow><TableCell colSpan="8" className="text-center py-8 text-slate-500">Nenhum aluno encontrado.</TableCell></TableRow>}
                    </TableBody>
                </Table>
            </div>

            {/* Dialog de Mensaje */}
            <Dialog open={isMessageDialogOpen} onOpenChange={setIsMessageDialogOpen}>
                <DialogContent className="sm:max-w-[500px]">
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
                                onChange={(e) => setMessageTitle(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="message">Mensagem</Label>
                            <Textarea
                                id="message"
                                placeholder="Digite sua mensagem..."
                                value={messageContent}
                                onChange={(e) => setMessageContent(e.target.value)}
                                rows={5}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="priority">Prioridade</Label>
                            <Select value={messagePriority} onValueChange={setMessagePriority}>
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
        </div>
    );
};

export default AlunosTab;
