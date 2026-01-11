// Arquivo: src/components/professor-dashboard/AulasTab.jsx

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { format, parseISO, parse, isValid, getDay, add, isAfter, addDays } from 'date-fns';
import { getBrazilDate } from '@/lib/dateUtils';
import { ptBR } from 'date-fns/locale';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreVertical, Loader2, Star, Calendar, Clock, RotateCcw, UserX, Calendar as CalendarIcon, Filter, FileText, Upload, X, ExternalLink, Trash2, History } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as UICalendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from '@/lib/utils';
import { useFormPersistence } from '@/hooks/useFormPersistence';
import { Label } from '@/components/ui/label';


const ALL_TIMES = Array.from({ length: 68 }, (_, i) => {
    const totalMinutes = 7 * 60 + i * 15;
    const hour = Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
});

const StarRating = ({ rating, setRating }) => {
    return (
        <div className="flex items-center">
            {[1, 2, 3, 4, 5].map((star) => (
                <Star
                    key={star}
                    className={`h-6 w-6 cursor-pointer ${rating >= star ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
                    onClick={() => setRating && setRating(star)}
                />
            ))}
        </div>
    );
};


const FeedbackDialog = ({ appointment, isOpen, onClose, onFeedbackSent }) => {
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Usar persistência para o rascunho de feedback
    const [feedbackDraft, setFeedbackDraft, clearFeedbackDraft, setFeedbackField] = useFormPersistence('feedback_draft', {
        ratings: { fala: 0, leitura: 0, escrita: 0, compreensao: 0, audicao: 0, gramatica: 0, pronuncia: 0, vocabulario: 0 },
        comment: ''
    });

    const handleSetRating = (category, value) => {
        setFeedbackField('ratings', { ...feedbackDraft.ratings, [category]: value });
    };

    const resetForm = () => {
        clearFeedbackDraft();
    }

    const handleSubmit = async () => {
        const ratings = feedbackDraft.ratings;
        const comment = feedbackDraft.comment;

        if (Object.values(ratings).some(r => r === 0)) {
            toast({ variant: 'destructive', title: 'Avaliação incompleta', description: 'Por favor, preencha todas as estrelas.' });
            return;
        }
        setIsSubmitting(true);
        try {
            const { data: feedbackData, error: feedbackError } = await supabase
                .from('class_feedback').insert([{
                    appointment_id: appointment.id,
                    professor_id: appointment.professor_id,
                    student_id: appointment.student_id,
                    comment: comment, ...ratings
                }]).select().single();
            if (feedbackError) throw feedbackError;

            const { error: appointmentError } = await supabase
                .from('appointments').update({ status: 'completed', feedback_id: feedbackData.id }).eq('id', appointment.id);
            if (appointmentError) throw appointmentError;

            // DÉBITO: Registrar o débito de -1 aula na assigned_packages_log para consumo do crédito.
            const { error: debitError } = await supabase.from('assigned_packages_log').insert({
                professor_id: appointment.professorId,
                student_id: appointment.student_id,
                package_id: appointment.customPackageId, // ID do pacote 'Personalizado'
                assigned_classes: -1, // Débito de 1 aula
                status: 'completed',
                observation: `Débito de aula concluída: ${format(parseISO(appointment.class_datetime), 'dd/MM/yyyy HH:mm')}`
            });
            if (debitError) console.error("Error creating debit log:", debitError);

            const { error: notificationError } = await supabase.from('notifications').insert({
                user_id: appointment.student_id,
                type: 'class_feedback',
                content: {
                    message: `Sua aula de ${appointment.student?.spanish_level ? 'Espanhol' : 'Inglês'} foi avaliada.`,
                    subject: appointment.student?.spanish_level ? 'Espanhol' : 'Inglês',
                    appointmentId: appointment.id,
                    ratings: ratings,
                    comment: comment
                },
            });
            if (notificationError) console.error("Error creating feedback notification:", notificationError);

            toast({ variant: 'default', title: 'Feedback enviado!', description: 'O aluno foi notificado sobre a avaliação.' });
            resetForm();
            onFeedbackSent();
            onClose();

        } catch (error) {
            toast({ variant: 'destructive', title: 'Erro ao enviar feedback', description: error.message });
        } finally { setIsSubmitting(false); }
    };

    if (!appointment) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Avaliar Aluno</DialogTitle>
                    <DialogDescription className="flex items-center gap-4 pt-2">
                        <Avatar>
                            <AvatarImage src={appointment.student?.avatar_url} />
                            <AvatarFallback>{appointment.student?.full_name?.[0]}</AvatarFallback>
                        </Avatar>
                        <div>
                            <p className="font-bold">{appointment.student?.full_name}</p>
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                <Calendar className="h-3 w-3" /> {format(parseISO(appointment.class_datetime), 'dd/MM/yyyy')}
                                <Clock className="h-3 w-3" /> {format(parseISO(appointment.class_datetime), 'HH:mm')}
                            </div>
                        </div>
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 py-4 max-h-[50vh] overflow-y-auto pr-2">
                    {Object.keys(feedbackDraft.ratings).map(category => (
                        <div key={category} className="flex justify-between items-center">
                            <p className="capitalize text-sm font-medium">{category.replace('_', ' ')}</p>
                            <StarRating rating={feedbackDraft.ratings[category]} setRating={(value) => handleSetRating(category, value)} />
                        </div>
                    ))}
                    <Textarea placeholder="Adicione um comentário sobre o desempenho do Aluno..." value={feedbackDraft.comment} onChange={(e) => setFeedbackField('comment', e.target.value)} className="mt-4" />
                </div>
                <DialogFooter>
                    {/* Botão Salvar com estilo azul */}
                    <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-sky-600 hover:bg-sky-700 text-white">
                        {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</> : 'Salvar'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};


const RescheduleDialog = ({ appointment, isOpen, onClose, onReschedule }) => {
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Usar persistência para o rascunho de reagendamento
    const [rescheduleDraft, setRescheduleDraft, clearRescheduleDraft, setRescheduleField] = useFormPersistence('reschedule_draft', {
        newDate: null,
        newTime: '',
        observation: ''
    });

    // Usa useMemo para evitar recriação do objeto Date a cada render
    const newDateString = rescheduleDraft.newDate; // String ou null
    const newDate = useMemo(() => {
        return newDateString ? new Date(newDateString) : null;
    }, [newDateString]);

    const newTime = rescheduleDraft.newTime;
    const observation = rescheduleDraft.observation;
    // Filtro inicial de 07:00 a 23:30 (todos os horários no intervalo de trabalho)
    const [availableTimes, setAvailableTimes] = useState(ALL_TIMES.filter(time => time >= '07:00' && time <= '23:30'));
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);

    const originalStart = appointment?.class_datetime ? parseISO(appointment.class_datetime) : null;
    const originalEnd = originalStart && appointment.duration_minutes ? format(new Date(originalStart.getTime() + appointment.duration_minutes * 60000), 'HH:mm') : 'N/A';
    const originalTimeRange = originalStart ? `${format(originalStart, 'HH:mm')} - ${originalEnd}` : 'N/A';


    // CORREÇÃO DE LÓGICA: Função para buscar slots disponíveis
    const fetchAvailableSlots = useCallback(async (date) => {
        // CORREÇÃO: Usamos appointment.professorId, que é passado pelo componente pai
        if (!date || !appointment?.professorId || !appointment?.duration_minutes) {
            setAvailableTimes(ALL_TIMES.filter(time => time >= '07:00' && time <= '23:30'));
            return;
        }

        setLoadingSlots(true);
        const dayString = format(date, 'yyyy-MM-dd');
        const dayOfWeek = getDay(date); // 0 (Dom) a 6 (Sáb)

        // 1. Busca slots de preferência ATIVOS do professor
        const { data: preferredSlots, error: slotsError } = await supabase
            .from('class_slots')
            .select('start_time')
            // CORREÇÃO: Usa professorId da prop estendida
            .eq('professor_id', appointment.professorId)
            .eq('day_of_week', dayOfWeek)
            .eq('status', 'active'); // Filtra apenas slots ativos (preferência)

        if (slotsError) {
            console.error("Error fetching preferred slots:", slotsError);
            setLoadingSlots(false);
            setAvailableTimes(ALL_TIMES.filter(time => time >= '07:00' && time <= '23:30'));
            return;
        }

        // Mapeia para HH:mm para comparação rápida
        const preferredTimes = new Set(preferredSlots.map(s => s.start_time.substring(0, 5)));

        // 2. Busca aulas agendadas para o professor no dia selecionado
        const { data: appointmentsForDay, error: aptError } = await supabase
            .from('appointments')
            .select('class_datetime, duration_minutes, id')
            // CORREÇÃO: Usa professorId da prop estendida
            .eq('professor_id', appointment.professorId)
            .in('status', ['scheduled', 'rescheduled', 'pending'])
            .gte('class_datetime', `${dayString}T00:00:00-03:00`)
            .lte('class_datetime', `${dayString}T23:59:59-03:00`);

        if (aptError) {
            console.error("Error fetching day appointments:", aptError);
            setLoadingSlots(false);
            setAvailableTimes(ALL_TIMES.filter(time => time >= '07:00' && time <= '23:30'));
            return;
        }

        const bookedSlots = new Set();
        const classDuration = appointment.duration_minutes;
        const slotsPerClass = Math.ceil(classDuration / 15);

        appointmentsForDay.forEach(apt => {
            // Ignora a própria aula para reagendamento
            if (apt.id === appointment.id) return;

            const startTime = parseISO(apt.class_datetime);
            const aptDuration = apt.duration_minutes || classDuration;
            const occupiedSlotsCount = Math.ceil(aptDuration / 15);

            for (let i = 0; i < occupiedSlotsCount; i++) {
                const occupiedTime = format(new Date(startTime.getTime() + i * 15 * 60000), 'HH:mm');
                bookedSlots.add(occupiedTime);
            }
        });

        // 3. Combina Preferências e Conflitos
        const newAvailableTimes = ALL_TIMES.filter(time => {
            // Verifica o limite de horário global (07:00 a 23:30)
            if (time < '07:00' || time > '23:30') return false;

            const startTimeObj = parse(time, 'HH:mm', date);

            // Não permite agendamento no passado
            if (isAfter(getBrazilDate(), startTimeObj)) return false;

            // Verifica se há slots consecutivos livres e preferenciais para a duração total da aula
            for (let i = 0; i < slotsPerClass; i++) {
                const requiredSlotTime = format(add(startTimeObj, { minutes: i * 15 * 60000 }), 'HH:mm');

                // Se o slot necessário estiver fora do limite (depois de 23:30)
                if (requiredSlotTime > '23:30') {
                    return false;
                }

                // Se o slot necessário estiver reservado por outra aula
                if (bookedSlots.has(requiredSlotTime)) {
                    return false;
                }

                // CORREÇÃO ESSENCIAL: Todos os slots de 15 minutos que a aula OCUPE 
                // DEVEM estar marcados como 'active' nas preferências do professor para aquele dia.
                if (!preferredTimes.has(requiredSlotTime)) {
                    return false;
                }
            }
            return true;
        });

        setAvailableTimes(newAvailableTimes);
        setLoadingSlots(false);
    }, [appointment?.professorId, appointment?.duration_minutes, appointment?.id]);
    // FIM DA CORREÇÃO DE LÓGICA

    // Efeito para recarregar slots quando a data muda
    // Usa newDateString (primitivo) como dependência para evitar loop
    useEffect(() => {
        if (newDate && isValid(newDate)) {
            fetchAvailableSlots(newDate);
            setRescheduleField('newTime', '');
        } else {
            // Se nenhuma data válida for selecionada, mostra a lista filtrada de 07:00 a 23:30
            setAvailableTimes(ALL_TIMES.filter(time => time >= '07:00' && time <= '23:30'));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [newDateString, fetchAvailableSlots]);


    const handleSubmit = async () => {
        if (!newDate || !newTime) {
            toast({ variant: 'destructive', title: 'Campos obrigatórios', description: 'Selecione uma nova data e um novo horário.' });
            return;
        }

        setIsSubmitting(true);

        try {
            // 1. Constrói o novo datetime corretamente usando a zona horária local
            const [hour, minute] = newTime.split(':').map(Number);
            const classDateTime = new Date(
                newDate.getFullYear(),
                newDate.getMonth(),
                newDate.getDate(),
                hour,
                minute,
                0
            );

            if (!isValid(classDateTime)) {
                throw new Error("A data e hora selecionadas são inválidas.");
            }

            const newDateTimeStr = classDateTime.toISOString();

            // 2. Atualiza a aula existente com a nova data e status 'scheduled'
            const { error: updateError } = await supabase
                .from('appointments')
                .update({
                    class_datetime: newDateTimeStr,
                    status: 'scheduled',
                })
                .eq('id', appointment.id);

            if (updateError) throw updateError;

            // 3. Adiciona CRÉDITO de +1 aula na assigned_packages_log para anular a aula original
            const { error: creditError } = await supabase
                .from('assigned_packages_log')
                .insert({
                    professor_id: appointment.professorId,
                    student_id: appointment.student_id,
                    package_id: appointment.customPackageId,
                    assigned_classes: 1, // Creditar 1 aula (para compensar a aula original)
                    status: 'rescheduled_credit',
                    observation: `Crédito devolvido pela remarcação (Prof.) da aula original em ${format(parseISO(appointment.class_datetime), 'dd/MM/yyyy')}. Novo horário: ${format(newDate, 'dd/MM/yyyy')} ${newTime}. Motivo: ${observation}`
                });

            if (creditError) console.error("Error creating credit log:", creditError);

            // 4. Notificação para o aluno
            await supabase.from('notifications').insert({
                user_id: appointment.student_id,
                type: 'class_rescheduled',
                content: {
                    message: `Sua aula foi reagendada pelo professor para ${format(newDate, 'dd/MM/yyyy')} às ${newTime}.`,
                    newDateTime: newDateTimeStr,
                    oldDateTime: appointment.class_datetime,
                },
            });


            toast({
                variant: 'default',
                title: 'Aula Reagendada!',
                description: `Aula de ${appointment.student.full_name} reagendada para ${format(newDate, 'dd/MM/yyyy')} às ${newTime}.`
            });
            clearRescheduleDraft();
            onReschedule();
            onClose();

        } catch (error) {
            toast({ variant: 'destructive', title: 'Erro ao salvar reagendamento', description: error.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!appointment) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Reagendar Aula</DialogTitle>
                    <DialogDescription className="pt-2">
                        <div className="flex items-center gap-4">
                            <Avatar><AvatarImage src={appointment.student?.avatar_url} /><AvatarFallback>{appointment.student?.full_name?.[0]}</AvatarFallback></Avatar>
                            <div>
                                <p className="font-bold text-slate-800">{appointment.student?.full_name}</p>
                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                    <Calendar className="h-3 w-3" /> {format(parseISO(appointment.class_datetime), 'dd/MM/yyyy')}
                                    <Clock className="h-3 w-3" /> {originalTimeRange}
                                </div>
                            </div>
                        </div>
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    {/* Título de seção com estilo azul */}
                    <h4 className="text-sm font-semibold text-sky-600 flex items-center">Nova Data</h4>
                    <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                        <PopoverTrigger asChild>
                            <Button variant={"outline"} className='w-full justify-start text-left font-normal'>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {newDate ? format(newDate, "dd/MM/yyyy", { locale: ptBR }) : <span>dd/mm/aaaa</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                            <UICalendar
                                mode="single"
                                selected={newDate}
                                onSelect={(date) => {
                                    setRescheduleField('newDate', date ? date.toISOString() : null);
                                    setIsCalendarOpen(false);
                                }}
                                initialFocus
                                locale={ptBR}
                                disabled={(date) => date < new Date()}
                            />
                        </PopoverContent>
                    </Popover>

                    {/* Título de seção com estilo azul */}
                    <h4 className="text-sm font-semibold text-sky-600 flex items-center">Novo Horário</h4>
                    <Select onValueChange={(v) => setRescheduleField('newTime', v)} value={newTime} disabled={loadingSlots || !newDate}>
                        <SelectTrigger className='w-full'>
                            <SelectValue placeholder={loadingSlots ? "Carregando horários..." : "Selecione um horário disponível..."} />
                        </SelectTrigger>
                        <SelectContent className='max-h-60 overflow-y-auto'>
                            {availableTimes.length > 0 ? (
                                availableTimes.map(time => (
                                    <SelectItem key={time} value={time}>{time}</SelectItem>
                                ))
                            ) : (
                                <div className="p-2 text-center text-slate-500">
                                    {newDate ? 'Nenhum horário disponível nas preferências.' : 'Selecione uma data primeiro.'}
                                </div>
                            )}
                        </SelectContent>
                    </Select>

                    {/* Título de seção com estilo azul */}
                    <h4 className="text-sm font-semibold text-sky-600 mt-6">Descrição</h4>
                    <Textarea
                        placeholder="Descreva o motivo do reagendamento..."
                        value={observation}
                        onChange={(e) => setRescheduleField('observation', e.target.value)}
                    />
                </div>
                <DialogFooter>
                    {/* Botão Salvar com estilo azul */}
                    <Button onClick={handleSubmit} disabled={isSubmitting || !newDate || !newTime} className="bg-sky-600 hover:bg-sky-700">
                        {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvar</> : 'Salvar'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};


// CORRECCIÓN PRINCIPAL: Agora só recebe 'dashboardData'
const AulasTab = ({ dashboardData }) => {
    const { toast } = useToast();
    const [nameFilter, setNameFilter] = useState("");
    const [dateFilter, setDateFilter] = useState(null); // For calendar picker
    const [quickDateFilter, setQuickDateFilter] = useState("TODAS"); // HOJE, AMANHA, TODAS
    const [statusFilter, setStatusFilter] = useState("all"); // Status filter - 'all' para todos
    const [selectedAppointment, setSelectedAppointment] = useState(null);
    const [isFeedbackDialogOpen, setIsFeedbackDialogOpen] = useState(false);
    const [isRescheduleDialogOpen, setIsRescheduleDialogOpen] = useState(false);

    // Modal de filtros avanzados
    const [isFiltersModalOpen, setIsFiltersModalOpen] = useState(false);
    const [startDateFilter, setStartDateFilter] = useState(""); // Data de Inicio
    const [endDateFilter, setEndDateFilter] = useState(""); // Data Fim

    // Paginação
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    // Filtro de mês: Automático para professores, manual para admins
    const [selectedMonth, setSelectedMonth] = useState(() => {
        const now = getBrazilDate();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });

    // Gerar lista de meses para o Admin (Todo o ano atual 2026)
    const availableMonths = useMemo(() => {
        const months = [];
        const now = getBrazilDate();
        const currentYear = now.getFullYear();
        for (let i = 0; i < 12; i++) {
            const date = new Date(currentYear, i, 1);
            const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            const label = format(date, "MMMM 'de' yyyy", { locale: ptBR });
            months.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
        }
        return months;
    }, []);

    // Extracción segura das propriedades a partir de dashboardData
    const data = dashboardData?.data || {};
    const loading = dashboardData?.loading || false;
    const professorId = dashboardData?.professorId;
    const onUpdate = dashboardData?.onUpdate; // Obtém onUpdate do objeto
    const isSuperadmin = dashboardData?.isSuperadmin || false;
    const professors = data.professors || [];
    const appointments = data.appointments || [];
    const packages = data.packages || [];
    const can_manage_classes = data.can_manage_classes !== false; // Padrão true

    // Filtro global de professor (passado do ProfessorDashboardPage)
    const globalProfessorFilter = dashboardData?.globalProfessorFilter;

    // Estado para filtro de professor local (fallback para superadmin)
    const [professorFilter, setProfessorFilter] = useState('all');

    // Determinar o filtro efetivo de professor
    const effectiveProfessorFilter = globalProfessorFilter && globalProfessorFilter !== 'all'
        ? globalProfessorFilter
        : professorFilter;

    // Estado para mostrar agenda del profesor seleccionado
    const [selectedProfessorAgenda, setSelectedProfessorAgenda] = useState(null);
    const [loadingAgenda, setLoadingAgenda] = useState(false);

    // Estados para modal de upload de PDF
    const [showPdfModal, setShowPdfModal] = useState(false);
    const [selectedAulaForPdf, setSelectedAulaForPdf] = useState(null);
    const [pdfMaterialName, setPdfMaterialName] = useState('');
    const [pdfFile, setPdfFile] = useState(null);
    const [isUploadingPdf, setIsUploadingPdf] = useState(false);
    const [existingMaterials, setExistingMaterials] = useState([]);
    const [loadingMaterials, setLoadingMaterials] = useState(false);

    // Cargar agenda cuando se selecciona un profesor
    useEffect(() => {
        const loadProfessorAgenda = async () => {
            if (!isSuperadmin || professorFilter === 'all') {
                setSelectedProfessorAgenda(null);
                return;
            }

            setLoadingAgenda(true);
            try {
                const { data: slots, error } = await supabase
                    .from('class_slots')
                    .select('*')
                    .eq('professor_id', professorFilter)
                    .in('status', ['active', 'filled']);

                if (error) throw error;

                // Organizar por día
                const daysOfWeekNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
                const slotsByDay = {};

                for (let i = 0; i < 7; i++) {
                    slotsByDay[i] = {
                        name: daysOfWeekNames[i],
                        active: [],
                        filled: []
                    };
                }

                (slots || []).forEach(slot => {
                    const day = slot.day_of_week;
                    if (slotsByDay[day]) {
                        if (slot.status === 'active') {
                            slotsByDay[day].active.push(slot);
                        } else if (slot.status === 'filled') {
                            slotsByDay[day].filled.push(slot);
                        }
                    }
                });

                // Ordenar slots por hora
                Object.keys(slotsByDay).forEach(day => {
                    slotsByDay[day].active.sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
                    slotsByDay[day].filled.sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
                });

                const prof = professors.find(p => p.id === professorFilter);
                setSelectedProfessorAgenda({
                    professor: prof,
                    slotsByDay,
                    totalActive: (slots || []).filter(s => s.status === 'active').length,
                    totalFilled: (slots || []).filter(s => s.status === 'filled').length
                });

            } catch (error) {
                console.error('Error loading professor agenda:', error);
            } finally {
                setLoadingAgenda(false);
            }
        };

        loadProfessorAgenda();
    }, [professorFilter, isSuperadmin, professors]);

    // Status options para o filtro
    const statusOptions = [
        { value: 'all', label: 'Todos os status' },
        { value: 'scheduled', label: 'Agendada' },
        { value: 'completed', label: 'Concluída' },
        { value: 'missed', label: 'Faltou' },
        { value: 'canceled', label: 'Cancelada' },
        { value: 'refunded', label: 'Reembolsada' },
    ];

    const handleUpdate = () => {
        if (onUpdate) onUpdate(); // Executa o onUpdate se existir
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
                await supabase.storage.from('class-materials').remove([filePath]);
                throw new Error(`Erro ao salvar: ${dbError.message}`);
            }

            toast({
                title: 'Material enviado!',
                description: `"${pdfMaterialName}" foi adicionado com sucesso.`,
            });

            // Recarregar os materiais
            const { data: updatedMaterials } = await supabase
                .from('class_materials')
                .select('*')
                .eq('appointment_id', selectedAulaForPdf.id)
                .order('created_at', { ascending: false });

            setExistingMaterials(updatedMaterials || []);
            setPdfMaterialName('');
            setPdfFile(null);

            if (onUpdate) onUpdate();
        } catch (error) {
            console.error('Erro ao enviar PDF:', error);
            toast({
                title: 'Erro ao enviar',
                description: error.message || 'Ocorreu um erro ao enviar o material.',
                variant: 'destructive'
            });
        } finally {
            setIsUploadingPdf(false);
        }
    };

    // 1. OBTENÇÃO DO ID DO PACOTE 'PERSONALIZADO'
    const customPackageId = useMemo(() => {
        return packages.find(p => p.name === 'Personalizado')?.id;
    }, [packages]);

    // Função para obter a data de hoje no formato yyyy-MM-dd
    const getTodayStr = () => format(getBrazilDate(), 'yyyy-MM-dd');

    // Função para obter a data de amanhã no formato yyyy-MM-dd
    const getTomorrowStr = () => format(addDays(getBrazilDate(), 1), 'yyyy-MM-dd');

    // Handler para limpar todos os filtros
    const handleClearFilters = () => {
        setNameFilter("");
        setDateFilter(null);
        setQuickDateFilter("TODAS");
        setStatusFilter("all");
        setStartDateFilter("");
        setEndDateFilter("");
        setProfessorFilter('all');
        setSelectedProfessorAgenda(null);
        setCurrentPage(1);
    };

    // Handler para aplicar filtros do modal
    const handleApplyDateRangeFilter = () => {
        // Al aplicar filtro de rango, desactivar los filtros rápidos
        if (startDateFilter || endDateFilter) {
            setQuickDateFilter("TODAS");
        }
        setIsFiltersModalOpen(false);
        setCurrentPage(1);
    };

    // Handler para filtro rápido de data
    const handleQuickDateFilter = (filter) => {
        setQuickDateFilter(filter);
        setDateFilter(null); // Limpa o date picker quando usa filtro rápido
        setCurrentPage(1);
    };

    const handleMarkAsMissed = async (appointment) => {
        // CORREÇÃO: Verifica se o aluno existe antes de acessar full_name
        if (!window.confirm(`Tem certeza que deseja marcar a aula de ${appointment.student?.full_name || 'este aluno'} como FALTA? Esta ação não pode ser desfeita e consumirá um crédito do aluno.`)) return;

        // 1. Atualiza o status da aula
        const { error } = await supabase.from('appointments').update({ status: 'missed' }).eq('id', appointment.id);
        if (error) {
            toast({ variant: 'destructive', title: 'Erro ao marcar falta', description: error.message });
            return;
        }

        // 2. Registra o débito da falta na assigned_packages_log para consumo do crédito.
        const { error: debitError } = await supabase.from('assigned_packages_log').insert({
            professor_id: professorId, // Usa o professorId do dashboardData
            student_id: appointment.student_id,
            package_id: customPackageId, // Usa o ID do pacote 'Personalizado'
            assigned_classes: -1,
            status: 'missed',
            observation: `Débito de falta: ${format(parseISO(appointment.class_datetime), 'dd/MM/yyyy HH:mm')}`
        });
        if (debitError) console.error("Error creating debit log for missed class:", debitError);

        // 3. Envia a notificação
        await supabase.from('notifications').insert({
            user_id: appointment.student_id,
            type: 'class_missed',
            content: { message: `Sua aula de ${format(parseISO(appointment.class_datetime), 'dd/MM/yyyy')} foi marcada como falta.` }
        });

        toast({ variant: 'default', title: 'Aula marcada como falta!' });
        handleUpdate();
    };

    const handleOpenReschedule = (appointment) => {
        // Adiciona o customPackageId e professorId ao objeto appointment (necessário para o Dialog)
        // IMPORTANTE: Usa o professor_id DA AULA, não o do usuário logado
        setSelectedAppointment({
            ...appointment,
            customPackageId,
            professorId: appointment.professor_id // Usa o professor da aula, não o logado
        });
        setIsRescheduleDialogOpen(true);
    }

    // Filtra appointments usando os novos filtros
    const filteredAppointments = useMemo(() => {
        // Calcular límites del mes seleccionado/actual
        const [year, month] = selectedMonth.split('-').map(Number);
        const startOfMonth = new Date(year, month - 1, 1);
        const endOfMonth = new Date(year, month, 0, 23, 59, 59);

        return (appointments || []).filter(apt => {
            // NUEVO: Filtro por mes (prioritario)
            let monthMatch = true;
            if (apt.class_datetime) {
                const aptDate = new Date(apt.class_datetime);
                monthMatch = aptDate >= startOfMonth && aptDate <= endOfMonth;
            } else {
                monthMatch = false;
            }

            // Filtro por nome
            const nameMatch = !nameFilter || apt.student?.full_name?.toLowerCase().includes(nameFilter.toLowerCase());

            // Filtro por data (rango de fechas, date picker ou filtro rápido) - dentro del mes
            let dateMatch = true;

            // Prioridad: 1. Rango de fechas, 2. Filtro rápido
            if (startDateFilter || endDateFilter) {
                // Filtro por rango de fechas
                if (apt.class_datetime) {
                    const aptDate = format(parseISO(apt.class_datetime), 'yyyy-MM-dd');
                    if (startDateFilter && endDateFilter) {
                        dateMatch = aptDate >= startDateFilter && aptDate <= endDateFilter;
                    } else if (startDateFilter) {
                        dateMatch = aptDate >= startDateFilter;
                    } else if (endDateFilter) {
                        dateMatch = aptDate <= endDateFilter;
                    }
                } else {
                    dateMatch = false;
                }
            } else if (dateFilter) {
                dateMatch = apt.class_datetime && format(parseISO(apt.class_datetime), 'yyyy-MM-dd') === format(new Date(dateFilter), 'yyyy-MM-dd');
            } else if (quickDateFilter === 'HOJE') {
                dateMatch = apt.class_datetime && format(parseISO(apt.class_datetime), 'yyyy-MM-dd') === getTodayStr();
            } else if (quickDateFilter === 'AMANHA') {
                dateMatch = apt.class_datetime && format(parseISO(apt.class_datetime), 'yyyy-MM-dd') === getTomorrowStr();
            }
            // TODAS não filtra por data (dentro do mês)

            // Filtro por status
            let statusMatch = true;
            if (statusFilter && statusFilter !== 'all') {
                statusMatch = apt.status === statusFilter ||
                    (statusFilter === 'canceled' && (apt.status === 'canceled' || apt.status === 'cancelled'));
            }

            // Filtro de professor
            let professorMatch = true;
            if (!isSuperadmin) {
                // Professores normais veem apenas suas próprias aulas
                professorMatch = apt.professor_id === professorId;
            } else if (effectiveProfessorFilter !== 'all') {
                // Superadmin com filtro ativo
                professorMatch = apt.professor_id === effectiveProfessorFilter;
            }

            return monthMatch && nameMatch && dateMatch && statusMatch && professorMatch;
        }).sort((a, b) => new Date(a.class_datetime) - new Date(b.class_datetime));
    }, [appointments, nameFilter, dateFilter, quickDateFilter, statusFilter, startDateFilter, endDateFilter, isSuperadmin, professorId, effectiveProfessorFilter, selectedMonth]);

    // Paginação
    const totalPages = Math.ceil(filteredAppointments.length / itemsPerPage);
    const paginatedAppointments = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return filteredAppointments.slice(startIndex, startIndex + itemsPerPage);
    }, [filteredAppointments, currentPage, itemsPerPage]);

    // Atualiza página quando filtros mudam
    useEffect(() => {
        setCurrentPage(1);
    }, [nameFilter, dateFilter, quickDateFilter, statusFilter]);

    const openFeedbackDialog = (appointment) => {
        // Passa o customPackageId e professorId para o FeedbackDialog 
        setSelectedAppointment({ ...appointment, customPackageId, professorId });
        setIsFeedbackDialogOpen(true);
    }

    const StatusBadge = ({ status }) => {
        switch (status) {
            case 'scheduled': return <Badge className="bg-sky-500 hover:bg-sky-600 text-white">Agendada</Badge>;
            case 'completed': return <Badge className="bg-green-500 hover:bg-green-600 text-white">Concluída</Badge>;
            case 'canceled':
            case 'cancelled': return <Badge variant="destructive">Cancelada</Badge>;
            case 'missed': return <Badge className="bg-orange-500 hover:bg-orange-600 text-white">Faltou</Badge>;
            case 'rescheduled': return <Badge className="bg-purple-500 hover:bg-purple-600 text-white">Reagendada</Badge>;
            case 'refunded': return <Badge className="bg-pink-500 hover:bg-pink-600 text-white">Reembolsada</Badge>;
            default: return <Badge variant="secondary">{status}</Badge>;
        }
    };

    return (
        // LAYOUT FULL-WIDTH: Padding horizontal para alinhar ao cabeçalho
        <div className="w-full px-4 lg:px-8 bg-white p-6 rounded-lg shadow-sm">
            {/* Header */}
            <div className="mb-6">
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">
                            Aulas
                            <span className="ml-2 text-lg font-normal text-slate-500">
                                ({filteredAppointments.length} {filteredAppointments.length === 1 ? 'aula' : 'aulas'})
                            </span>
                        </h2>
                        <p className="text-sm text-slate-500">
                            {isSuperadmin
                                ? `Visualizando todas as aulas de todos os professores e alunos`
                                : 'Por aqui é possível visualizar todas as suas aulas.'
                            }
                        </p>
                    </div>

                    {/* Badges de contagem por status - visível para superadmin */}
                    {isSuperadmin && (
                        <div className="flex flex-wrap gap-2">
                            <Badge className="bg-sky-500 text-white">
                                Agendadas: {appointments.filter(a => a.status === 'scheduled').length}
                            </Badge>
                            <Badge className="bg-green-500 text-white">
                                Concluídas: {appointments.filter(a => a.status === 'completed').length}
                            </Badge>
                            <Badge className="bg-orange-500 text-white">
                                Faltas: {appointments.filter(a => a.status === 'missed').length}
                            </Badge>
                            <Badge variant="destructive">
                                Canceladas: {appointments.filter(a => ['canceled', 'cancelled'].includes(a.status)).length}
                            </Badge>
                        </div>
                    )}
                </div>
            </div>

            {/* Barra de Filtros */}
            <div className="flex flex-wrap items-center gap-3 mb-6">
                {/* Barra de Pesquisa */}
                <div className="relative flex-1 min-w-[200px] max-w-[300px]">
                    <svg
                        className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <Input
                        placeholder="Pesquisar por Aluno"
                        value={nameFilter}
                        onChange={e => setNameFilter(e.target.value)}
                        className="pl-10 border-slate-300 focus:border-sky-500 focus:ring-sky-500"
                    />
                </div>

                {/* Filtro de Mes - Solo para Administrador */}
                {isSuperadmin && (
                    <div className="flex items-center gap-2">
                        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                            <SelectTrigger className="w-[180px] h-10 border-slate-300">
                                <CalendarIcon className="w-4 h-4 mr-2 text-sky-500" />
                                <SelectValue placeholder="Selecione o mês" />
                            </SelectTrigger>
                            <SelectContent>
                                {availableMonths.map(m => (
                                    <SelectItem key={m.value} value={m.value}>
                                        {m.value === `${getBrazilDate().getFullYear()}-${String(getBrazilDate().getMonth() + 1).padStart(2, '0')}`
                                            ? `📅 ${m.label} (Atual)`
                                            : m.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {selectedMonth !== `${getBrazilDate().getFullYear()}-${String(getBrazilDate().getMonth() + 1).padStart(2, '0')}` && (
                            <Badge variant="outline" className="h-10 px-3 bg-amber-50 text-amber-700 border-amber-200 uppercase font-bold text-[10px]">
                                Histórico
                            </Badge>
                        )}
                    </div>
                )}

                {/* Botões de Filtro Rápido de Data */}
                <div className="flex items-center border rounded-lg overflow-hidden">
                    <Button
                        variant={quickDateFilter === 'HOJE' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => handleQuickDateFilter('HOJE')}
                        className={cn(
                            "rounded-none border-r px-4 h-10",
                            quickDateFilter === 'HOJE'
                                ? "bg-sky-500 hover:bg-sky-600 text-white"
                                : "text-slate-600 hover:bg-slate-100"
                        )}
                    >
                        Hoje
                    </Button>
                    <Button
                        variant={quickDateFilter === 'AMANHA' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => handleQuickDateFilter('AMANHA')}
                        className={cn(
                            "rounded-none border-r px-4 h-10",
                            quickDateFilter === 'AMANHA'
                                ? "bg-sky-500 hover:bg-sky-600 text-white"
                                : "text-slate-600 hover:bg-slate-100"
                        )}
                    >
                        Amanhã
                    </Button>
                    <Button
                        variant={quickDateFilter === 'TODAS' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => handleQuickDateFilter('TODAS')}
                        className={cn(
                            "rounded-none px-4 h-10",
                            quickDateFilter === 'TODAS'
                                ? "bg-sky-500 hover:bg-sky-600 text-white"
                                : "text-slate-600 hover:bg-slate-100"
                        )}
                    >
                        Todas
                    </Button>
                </div>

                {/* Dropdown de Status */}
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[220px] border-slate-300">
                        <SelectValue placeholder="Selecione o status da aula" />
                    </SelectTrigger>
                    <SelectContent>
                        {statusOptions.map(option => (
                            <SelectItem key={option.value} value={option.value}>
                                {option.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {/* Filtro de professor para superadmin */}
                {isSuperadmin && professors.length > 0 && (
                    <Select value={professorFilter} onValueChange={setProfessorFilter}>
                        <SelectTrigger className="w-[200px] border-slate-300">
                            <Filter className="h-4 w-4 mr-2" />
                            <SelectValue placeholder="Filtrar professor" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos os professores</SelectItem>
                            {professors.map(prof => (
                                <SelectItem key={prof.id} value={prof.id}>
                                    {prof.full_name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}

                {/* Botão Filtros (abre modal) */}
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsFiltersModalOpen(true)}
                    className="flex items-center gap-2 h-10 px-4 border-slate-300 text-slate-600 hover:bg-slate-100"
                >
                    <svg
                        className="h-4 w-4"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                    </svg>
                    Filtros
                </Button>
            </div>

            {/* Agenda del Profesor Seleccionado - Solo para Superadmin */}
            {
                isSuperadmin && selectedProfessorAgenda && (
                    <div className="mb-6 p-4 bg-slate-50 rounded-lg border">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                                <CalendarIcon className="h-5 w-5 text-sky-600" />
                                Agenda de {selectedProfessorAgenda.professor?.full_name}
                            </h3>
                            <div className="flex gap-2">
                                <Badge className="bg-green-500 text-white">
                                    {selectedProfessorAgenda.totalActive} disponível(is)
                                </Badge>
                                <Badge className="bg-blue-500 text-white">
                                    {selectedProfessorAgenda.totalFilled} ocupado(s)
                                </Badge>
                            </div>
                        </div>

                        {loadingAgenda ? (
                            <div className="flex justify-center py-4">
                                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                            </div>
                        ) : (
                            <div className="grid grid-cols-7 gap-2">
                                {Object.entries(selectedProfessorAgenda.slotsByDay).map(([dayIndex, dayData]) => (
                                    <div key={dayIndex} className="text-center">
                                        <p className="text-xs font-semibold mb-2 text-slate-700 bg-slate-200 rounded py-1">
                                            {dayData.name}
                                        </p>
                                        <div className="space-y-1 max-h-40 overflow-y-auto">
                                            {dayData.active.length > 0 ? (
                                                dayData.active.map((slot, idx) => (
                                                    <div
                                                        key={`active-${idx}`}
                                                        className="text-[10px] px-1 py-0.5 bg-green-100 text-green-700 rounded truncate"
                                                        title={`Disponível: ${slot.start_time?.substring(0, 5)}`}
                                                    >
                                                        {slot.start_time?.substring(0, 5)}
                                                    </div>
                                                ))
                                            ) : null}
                                            {dayData.filled.length > 0 ? (
                                                dayData.filled.map((slot, idx) => (
                                                    <div
                                                        key={`filled-${idx}`}
                                                        className="text-[10px] px-1 py-0.5 bg-blue-100 text-blue-600 rounded truncate"
                                                        title={`Ocupado: ${slot.start_time?.substring(0, 5)}`}
                                                    >
                                                        {slot.start_time?.substring(0, 5)} ✓
                                                    </div>
                                                ))
                                            ) : null}
                                            {dayData.active.length === 0 && dayData.filled.length === 0 && (
                                                <div className="text-[10px] text-slate-400 py-1">-</div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="mt-3 flex gap-4 text-xs text-slate-500">
                            <span className="flex items-center gap-1">
                                <div className="w-3 h-3 bg-green-100 rounded"></div> Disponível
                            </span>
                            <span className="flex items-center gap-1">
                                <div className="w-3 h-3 bg-blue-100 rounded"></div> Ocupado
                            </span>
                        </div>
                    </div>
                )
            }
            <Dialog open={isFiltersModalOpen} onOpenChange={setIsFiltersModalOpen}>
                <DialogContent className="sm:max-w-[450px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Filtros</DialogTitle>
                        <DialogDescription>
                            Filtros tabela de aulas
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-sky-600">Data de Inicio</label>
                                <Input
                                    type="date"
                                    value={startDateFilter}
                                    onChange={(e) => setStartDateFilter(e.target.value)}
                                    className="border-slate-300"
                                    placeholder="dd/mm/aaaa"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-sky-600">Data Fim</label>
                                <Input
                                    type="date"
                                    value={endDateFilter}
                                    onChange={(e) => setEndDateFilter(e.target.value)}
                                    className="border-slate-300"
                                    placeholder="dd/mm/aaaa"
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setStartDateFilter("");
                                setEndDateFilter("");
                            }}
                            className="mr-2"
                        >
                            Limpar
                        </Button>
                        <Button
                            onClick={handleApplyDateRangeFilter}
                            className="bg-sky-600 hover:bg-sky-700 text-white"
                        >
                            Filtrar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Tabla de Aulas */}
            <div className="border rounded-lg overflow-hidden">
                <Table>
                    <TableHeader className="bg-slate-50">
                        <TableRow>
                            <TableHead className="w-[120px]">Código</TableHead>
                            <TableHead>Aluno</TableHead>
                            <TableHead>Matéria</TableHead>
                            <TableHead>Tipo de aula</TableHead>
                            <TableHead>Data</TableHead>
                            <TableHead>Horário</TableHead>
                            <TableHead>Status</TableHead>
                            {can_manage_classes && <TableHead className="text-right">Ações</TableHead>}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={can_manage_classes ? "8" : "7"} className="text-center p-8">
                                    <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                                </TableCell>
                            </TableRow>
                        ) : paginatedAppointments.length > 0 ? (
                            paginatedAppointments.map(apt => {
                                // Calcular horario de fin basado en duration_minutes
                                const startTime = apt.class_datetime ? parseISO(apt.class_datetime) : null;
                                const endTime = startTime && apt.duration_minutes
                                    ? new Date(startTime.getTime() + apt.duration_minutes * 60000)
                                    : null;
                                const timeRange = startTime && endTime
                                    ? `${format(startTime, 'HH\'h\'mm')} - ${format(endTime, 'HH\'h\'mm')}`
                                    : 'N/A';

                                return (
                                    <TableRow key={apt.id}>
                                        <TableCell>
                                            <span className="font-mono text-xs text-sky-700 bg-sky-50 px-2 py-1 rounded">
                                                {apt.class_code || `#${apt.id}`}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <Avatar className="h-8 w-8">
                                                    <AvatarImage src={apt.student?.avatar_url} />
                                                    <AvatarFallback className="bg-pink-100 text-pink-600 text-xs">
                                                        {apt.student?.full_name?.[0] || 'A'}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <p className="text-xs text-slate-400">{apt.student?.student_code || 'N/A'}</p>
                                                    <p className="font-medium text-slate-800">{apt.student?.full_name || 'N/A'}</p>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-slate-600">
                                            {apt.student?.spanish_level ? 'Espanhol' : 'Inglês'}
                                        </TableCell>
                                        <TableCell className="text-slate-600">Efetiva</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1 text-slate-600">
                                                <CalendarIcon className="h-4 w-4 text-slate-400" />
                                                {apt.class_datetime ? format(parseISO(apt.class_datetime), 'dd/MM/yyyy') : 'N/A'}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1 text-slate-600">
                                                <Clock className="h-4 w-4 text-slate-400" />
                                                {timeRange}
                                            </div>
                                        </TableCell>
                                        <TableCell><StatusBadge status={apt.status} /></TableCell>
                                        {can_manage_classes && (
                                            <TableCell className="text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon">
                                                            <MoreVertical className="w-4 h-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent>
                                                        <DropdownMenuItem
                                                            onClick={() => handleOpenPdfModal(apt)}
                                                        >
                                                            <FileText className="mr-2 h-4 w-4" /> PDF Aulas
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            onClick={() => openFeedbackDialog(apt)}
                                                            disabled={!['scheduled', 'rescheduled'].includes(apt.status)}
                                                        >
                                                            <Star className="mr-2 h-4 w-4" /> Marcar como Concluída
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            onClick={() => handleOpenReschedule(apt)}
                                                            disabled={!['scheduled', 'missed', 'canceled', 'cancelled'].includes(apt.status)}
                                                        >
                                                            <RotateCcw className="mr-2 h-4 w-4" /> Reagendar
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            onClick={() => handleMarkAsMissed(apt)}
                                                            disabled={!['scheduled'].includes(apt.status)}
                                                            className="text-orange-600 focus:text-orange-700 focus:bg-orange-50"
                                                        >
                                                            <UserX className="mr-2 h-4 w-4" /> Marcar Falta
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        )}
                                    </TableRow>
                                );
                            })
                        ) : (
                            <TableRow>
                                <TableCell colSpan={can_manage_classes ? "7" : "6"} className="text-center p-8 text-slate-500">
                                    Nenhuma aula encontrada com o filtro atual.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Barra de Paginação */}
            <div className="flex items-center justify-between mt-4 text-sm text-slate-600">
                <div className="flex items-center gap-2">
                    <span>Total: {filteredAppointments.length}</span>
                </div>
                <div className="flex items-center gap-4">
                    {/* Selector de items por página */}
                    <div className="flex items-center gap-2">
                        <span>por página:</span>
                        <Select value={String(itemsPerPage)} onValueChange={(val) => setItemsPerPage(Number(val))}>
                            <SelectTrigger className="w-[70px] h-8 border-slate-300">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="5">5</SelectItem>
                                <SelectItem value="10">10</SelectItem>
                                <SelectItem value="20">20</SelectItem>
                                <SelectItem value="50">50</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Indicador de página */}
                    <span className="min-w-[80px] text-center">
                        {filteredAppointments.length > 0
                            ? `${(currentPage - 1) * itemsPerPage + 1} - ${Math.min(currentPage * itemsPerPage, filteredAppointments.length)}`
                            : '0 - 0'
                        }
                    </span>

                    {/* Controles de navegación */}
                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setCurrentPage(1)}
                            disabled={currentPage === 1}
                        >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                            </svg>
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                        >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            disabled={currentPage >= totalPages}
                        >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setCurrentPage(totalPages)}
                            disabled={currentPage >= totalPages}
                        >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                            </svg>
                        </Button>
                    </div>
                </div>
            </div>

            <FeedbackDialog
                appointment={selectedAppointment}
                isOpen={isFeedbackDialogOpen}
                onClose={() => setIsFeedbackDialogOpen(false)}
                onFeedbackSent={handleUpdate}
            />
            {/* Diálogo de Reagendamento */}
            {
                selectedAppointment && (
                    <RescheduleDialog
                        appointment={selectedAppointment}
                        isOpen={isRescheduleDialogOpen}
                        onClose={() => setIsRescheduleDialogOpen(false)}
                        onReschedule={handleUpdate}
                    />
                )
            }

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
                                <div className="space-y-2 max-h-[180px] overflow-y-auto pr-2">
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
                                                                const filePath = material.file_url.split('/public/class-materials/')[1];
                                                                if (filePath) {
                                                                    await supabase.storage.from('class-materials').remove([filePath]);
                                                                }
                                                                const { error } = await supabase
                                                                    .from('class_materials')
                                                                    .delete()
                                                                    .eq('id', material.id);
                                                                if (error) throw error;
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
        </div >
    );
};

export default AulasTab;
