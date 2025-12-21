// Archivo: src/components/professor-dashboard/AgendaTab.jsx

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { format, parseISO, getDay, startOfWeek, endOfWeek, isSameDay, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2, Clock, CheckCircle2, UserX, Calendar as CalendarIcon, Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { getBrazilDate, getTodayBrazil } from '@/lib/dateUtils';

const daysOfWeekMap = {
    0: 'Domingo',
    1: 'Segunda',
    2: 'Terça',
    3: 'Quarta',
    4: 'Quinta',
    5: 'Sexta',
    6: 'Sábado'
};

// CORRECCIÓN: Ahora solo recibe 'dashboardData'
const AgendaTab = ({ dashboardData }) => {
    // Extrai professorId do objeto de dados
    const professorId = dashboardData?.professorId;

    const today = useMemo(() => getBrazilDate(), []);
    const todayDayOfWeek = useMemo(() => getDay(today), [today]); // 0 (Dom) a 6 (Sáb)

    // CORREÇÃO: Renomeado 'loading' para 'isLoadingTab' e inicializado com base no dashboardData
    const [isLoadingTab, setIsLoadingTab] = useState(false);
    const [appointments, setAppointments] = useState([]);
    const [selectedDate, setSelectedDate] = useState(today);
    // Inicia com o dia da semana atual selecionado visualmente
    const [selectedDayOfWeek, setSelectedDayOfWeek] = useState(todayDayOfWeek);
    const [loadingDay, setLoadingDay] = useState(false);

    // Controla o filtro principal
    const [quickFilter, setQuickFilter] = useState('TODAY');

    const fetchAppointments = useCallback(async (dateToFilter, dayFilter = null, currentQuickFilter) => {
        if (!professorId) return;

        setLoadingDay(true);

        let query = supabase
            .from('appointments')
            .select(`
                id, class_datetime, status, duration_minutes, 
                student:profiles!student_id(full_name, spanish_level)
            `)
            .eq('professor_id', professorId);

        let dateStringStart;
        let dateStringEnd;

        // 1. LÓGICA DE FILTROS RÁPIDOS
        if (currentQuickFilter === 'ALL') {
            // Busca todas as aulas
        } else if (currentQuickFilter === 'TODAY') {
            dateStringStart = format(today, 'yyyy-MM-dd');
            dateStringEnd = dateStringStart;
        } else if (currentQuickFilter === 'TOMORROW') {
            const tomorrow = addDays(today, 1);
            dateStringStart = format(tomorrow, 'yyyy-MM-dd');
            dateStringEnd = dateStringStart;
        } else if (dayFilter !== null) {
            // Lógica de filtro semanal por dia da semana
            const start = startOfWeek(dateToFilter, { weekStartsOn: 0 });
            const end = endOfWeek(dateToFilter, { weekStartsOn: 0 });

            query = query
                .gte('class_datetime', format(start, 'yyyy-MM-dd'))
                .lte('class_datetime', format(end, 'yyyy-MM-dd'));
        } else {
            // Filtro por data selecionada (do calendário)
            dateStringStart = format(dateToFilter, 'yyyy-MM-dd');
            dateStringEnd = dateStringStart;
        }

        // Aplica filtros de data para Hoje/Amanhã/Calendário Individual
        if (dateStringStart) {
            // CORRECCIÓN: Usar el offset de Brasil (UTC-3) para las comparaciones
            // En lugar de usar Z (UTC), usamos -03:00 para Brasil
            query = query
                .gte('class_datetime', `${dateStringStart}T00:00:00-03:00`)
                .lte('class_datetime', `${dateStringEnd}T23:59:59-03:00`);
        }


        const { data, error } = await query
            .order('class_datetime', { ascending: true });

        if (error) {
            console.error("Error fetching appointments:", error);
            setAppointments([]);
        } else {
            let filteredData = data || [];

            // FILTRAGEM FINAL POR DIA DA SEMANA (Apenas se o filtro semanal estiver ativo)
            if (dayFilter !== null && currentQuickFilter === null) {
                filteredData = filteredData.filter(apt => {
                    const aptDay = getDay(parseISO(apt.class_datetime));
                    return aptDay === dayFilter;
                });
            }

            setAppointments(filteredData);
        }
        setIsLoadingTab(false);
        setLoadingDay(false);
    }, [professorId, today]);

    useEffect(() => {
        // CORREÇÃO: Chama fetchAppointments apenas se professorId estiver disponível
        if (professorId) {
            fetchAppointments(selectedDate, selectedDayOfWeek, quickFilter);
        }
    }, [fetchAppointments, selectedDate, selectedDayOfWeek, quickFilter, professorId]);

    // Handler para os botões de filtro de dia da semana (Antiga lógica semanal)
    const handleDayFilter = (dayIndex) => {

        // 1. Desativa o filtro rápido, forçando o modo semanal
        setQuickFilter(null);

        if (selectedDayOfWeek === dayIndex) {
            // Clicou no dia já ativo (no modo semanal) -> Desativa o semanal e volta para o quick filter 'TODAY'
            setSelectedDayOfWeek(null);
            setSelectedDate(today);
            setQuickFilter('TODAY');
        } else {
            // Ativa o modo semanal no dia selecionado
            setSelectedDayOfWeek(dayIndex);

            const currentDayIndex = getDay(today);
            const diff = dayIndex - currentDayIndex;
            const newDate = new Date(today);
            newDate.setDate(today.getDate() + diff);
            setSelectedDate(newDate);
        }
    };

    // Handler para os novos filtros rápidos
    const handleQuickFilter = (filterType) => {

        // 1. Zera o filtro semanal
        setSelectedDayOfWeek(null);

        // 2. Define o filtro rápido
        setQuickFilter(filterType);

        // 3. Define a data base para os filtros
        if (filterType === 'TODAY') {
            setSelectedDate(today);
            setSelectedDayOfWeek(todayDayOfWeek); // Mantém o botão de hoje aceso
        } else if (filterType === 'TOMORROW') {
            setSelectedDate(addDays(today, 1));
        } else if (filterType === 'ALL') {
            setSelectedDate(today);
        }
    };


    const StatusBadge = ({ status }) => {
        switch (status) {
            case 'scheduled': return <Badge className="bg-sky-500 hover:bg-sky-600 text-white">Agendada</Badge>;
            case 'completed': return <Badge className="bg-green-500 hover:bg-green-600 text-white">Realizada</Badge>;
            case 'canceled': return <Badge variant="destructive">Cancelada</Badge>;
            case 'missed': return <Badge className="bg-orange-500 hover:bg-orange-600 text-white">Falta</Badge>;
            case 'rescheduled': return <Badge className="bg-purple-500 hover:bg-purple-600 text-white">Reagendada</Badge>;
            default: return <Badge variant="secondary">{status}</Badge>;
        }
    };

    const isCurrentWeekDay = (dayIndex) => {
        return todayDayOfWeek === dayIndex;
    }

    const displayDate = useMemo(() => {
        if (quickFilter === 'TODAY') return 'Aulas de Hoje';
        if (quickFilter === 'TOMORROW') return 'Aulas de Amanhã';
        if (quickFilter === 'ALL') return 'Todas as Aulas (Histórico Completo)';

        if (selectedDayOfWeek !== null) {
            return `${daysOfWeekMap[selectedDayOfWeek]}, Semana de ${format(startOfWeek(selectedDate, { weekStartsOn: 0 }), 'dd/MM/yyyy')}`;
        }

        return `${format(selectedDate, 'PPP', { locale: ptBR })}`;
    }, [quickFilter, selectedDate, selectedDayOfWeek]);

    // A navegação semanal só aparece se o quickFilter for null (modo de filtro semanal/individual)
    const showWeekNavigation = selectedDayOfWeek !== null && quickFilter === null;

    const navigateWeek = (direction) => {
        if (selectedDayOfWeek !== null) {
            const daysToMove = direction === 'next' ? 7 : -7;
            const newDate = new Date(selectedDate);
            newDate.setDate(selectedDate.getDate() + daysToMove);
            setSelectedDate(newDate);
            // Ao navegar na semana, desativa o filtro rápido (já está implícito pelo quickFilter === null)
        }
    };

    // CORRIGIDO: O calendário fica desabilitado APENAS se o filtro for 'ALL'.
    const isCalendarDisabled = quickFilter === 'ALL';

    // Renderização de carregamento mais robusta (usa o estado do tab e o ID do professor)
    // O dashboardData?.loading não está disponível neste componente, mas a verificação do ID é suficiente para evitar falhas.
    if (!professorId) {
        return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-sky-600" /></div>;
    }


    return (
        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm space-y-4 sm:space-y-6">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-800">Minha Agenda</h2>

            {/* FILTROS DE DIA DA SEMANA */}
            <div className="flex flex-wrap gap-2 items-center border-b pb-4">
                <Filter className="h-5 w-5 text-sky-600 mr-2 flex-shrink-0" />
                {Object.entries(daysOfWeekMap).map(([index, day]) => {
                    const dayIndex = parseInt(index);

                    // O botão está ativo se estiver selecionado NO MODO SEMANAL (quickFilter === null)
                    // OU se estiver no modo rápido 'TODAY' E for o dia atual
                    const isActive = (selectedDayOfWeek === dayIndex && quickFilter === null) || (quickFilter === 'TODAY' && isCurrentWeekDay(dayIndex));
                    const isToday = isCurrentWeekDay(dayIndex);

                    return (
                        <Button
                            key={dayIndex}
                            variant={isActive ? 'default' : 'outline'}
                            onClick={() => handleDayFilter(dayIndex)}
                            className={cn(
                                "h-8 sm:h-9 px-3 sm:px-4 py-1.5 sm:py-2 transition-colors text-xs sm:text-sm",
                                isActive ? "bg-sky-600 hover:bg-sky-700 text-white" : "text-slate-700 border-slate-300 hover:bg-slate-100"
                            )}
                        >
                            {day} {isToday && '(Hoje)'}
                        </Button>
                    );
                })}
                {selectedDayOfWeek !== null && quickFilter === null && (
                    <Button variant="ghost" size="icon" onClick={() => handleDayFilter(null)} className="ml-0 sm:ml-2">
                        <X className="h-5 w-5 text-red-500" />
                    </Button>
                )}
            </div>

            {/* BARRA DE NAVEGAÇÃO / FILTROS RÁPIDOS */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-50 p-3 rounded-lg border space-y-3 sm:space-y-0">
                <div className="flex flex-wrap items-center space-x-3 w-full sm:w-auto">

                    {/* BOTÃO DE CALENDÁRIO */}
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant={"outline"} disabled={isCalendarDisabled} className={cn(
                                "w-auto justify-start text-left font-semibold",
                            )}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {/* Exibe a data do dia selecionado */}
                                {format(selectedDate, 'PPP', { locale: ptBR })}
                                {isSameDay(selectedDate, today) && quickFilter !== 'TODAY' && quickFilter !== 'TOMORROW' && <span className="ml-2 text-sky-600">(Hoje)</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                            <Calendar
                                mode="single"
                                selected={selectedDate}
                                onSelect={(date) => {
                                    setSelectedDate(date);
                                    // Desativa filtros rápidos e semanais ao usar o calendário
                                    setSelectedDayOfWeek(null);
                                    setQuickFilter(null);
                                }}
                                initialFocus
                                locale={ptBR}
                            />
                        </PopoverContent>
                    </Popover>

                    {/* BOTÕES DE FILTRO RÁPIDO */}
                    <Button
                        variant={quickFilter === 'TODAY' ? 'default' : 'outline'}
                        onClick={() => handleQuickFilter('TODAY')}
                        className={cn(quickFilter === 'TODAY' && "bg-sky-600 hover:bg-sky-700")}
                    >
                        Hoje
                    </Button>
                    <Button
                        variant={quickFilter === 'TOMORROW' ? 'default' : 'outline'}
                        onClick={() => handleQuickFilter('TOMORROW')}
                        className={cn(quickFilter === 'TOMORROW' && "bg-sky-600 hover:bg-sky-700")}
                    >
                        Amanhã
                    </Button>
                    <Button
                        variant={quickFilter === 'ALL' ? 'default' : 'outline'}
                        onClick={() => handleQuickFilter('ALL')}
                        className={cn(quickFilter === 'ALL' && "bg-sky-600 hover:bg-sky-700")}
                    >
                        Todas
                    </Button>
                </div>

                {/* TÍTULO CENTRALIZADO */}
                <span className="font-semibold text-sky-700 w-full sm:w-auto mt-2 sm:mt-0 text-center sm:text-left">
                    {displayDate}
                </span>

                {/* NAVEGAÇÃO SEMANAL (Aparece apenas se o filtro semanal estiver ativo) */}
                <div className="flex items-center space-x-3 w-full sm:w-auto justify-between sm:justify-end">
                    {showWeekNavigation && (
                        <>
                            <Button onClick={() => navigateWeek('prev')} variant="outline" size="sm">Semana Anterior</Button>
                            <Button onClick={() => navigateWeek('next')} variant="outline" size="sm">Próxima Semana</Button>
                        </>
                    )}
                </div>
            </div>

            {/* TABELA DE AULAS */}
            <div className="border rounded-lg overflow-hidden">
                <Table>
                    <TableHeader className="bg-slate-100">
                        <TableRow>
                            <TableHead>Hora</TableHead>
                            <TableHead>Aluno</TableHead>
                            <TableHead>Matéria</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Duração</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {(isLoadingTab || loadingDay) ? (
                            <TableRow><TableCell colSpan="5" className="text-center p-8"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>
                        ) : appointments.length > 0 ? (
                            appointments.map(apt => (
                                <TableRow key={apt.id}>
                                    <TableCell className="font-medium">{format(parseISO(apt.class_datetime), 'HH:mm')}</TableCell>
                                    <TableCell>{apt.student?.full_name || 'N/A'}</TableCell>
                                    <TableCell>{apt.student?.spanish_level ? 'Espanhol' : 'Inglês'}</TableCell>
                                    <TableCell><StatusBadge status={apt.status} /></TableCell>
                                    <TableCell>{apt.duration_minutes || 30} min</TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow><TableCell colSpan="5" className="text-center p-8 text-slate-500">
                                {quickFilter === 'ALL' ? 'Nenhuma aula encontrada no histórico.' : `Nenhuma aula agendada para ${displayDate}.`}
                            </TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
};

export default AgendaTab;
