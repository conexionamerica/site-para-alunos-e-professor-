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

const daysOfWeekMap = {
    0: 'Domingo',
    1: 'Segunda',
    2: 'Terça',
    3: 'Quarta',
    4: 'Quinta',
    5: 'Sexta',
    6: 'Sábado'
};

const AgendaTab = ({ professorId }) => {
    const today = useMemo(() => new Date(), []);
    const todayDayOfWeek = useMemo(() => getDay(today), [today]); // 0 (Dom) a 6 (Sáb)

    const [loading, setLoading] = useState(true);
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
            query = query
                .gte('class_datetime', `${dateStringStart}T00:00:00Z`)
                .lte('class_datetime', `${dateStringEnd}T23:59:59Z`);
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
        setLoading(false);
        setLoadingDay(false);
    }, [professorId, today]);

    useEffect(() => {
        fetchAppointments(selectedDate, selectedDayOfWeek, quickFilter);
    }, [fetchAppointments, selectedDate, selectedDayOfWeek, quickFilter]);
    
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
        switch(status) {
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


    return (
        <div className="bg-white p-6 rounded-lg shadow-sm space-y-6">
            <h2 className="text-2xl font-bold text-slate-800">Minha Agenda</h2>
            
            {/* FILTROS DE DIA DA SEMANA */}
            <div className="flex flex-wrap gap-2 items-center border-b pb-4">
                <Filter className="h-5 w-5 text-sky-600 mr-2" />
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
                                "h-9 px-4 py-2 transition-colors",
                                isActive ? "bg-sky-600 hover:bg-sky-700 text-white" : "text-slate-700 border-slate-300 hover:bg-slate-100"
                            )}
                        >
                            {day} {isToday && '(Hoje)'}
                        </Button>
                    );
                })}
                 {selectedDayOfWeek !== null && quickFilter === null && (
                    <Button variant="ghost" size="icon" onClick={() => handleDayFilter(null)} className="ml-2">
                        <X className="h-5 w-5 text-red-500" />
                    </Button>
                )}
            </div>

            {/* BARRA DE NAVEGAÇÃO / FILTROS RÁPIDOS */}
            <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border">
                <div className="flex items-center space-x-3">
                    
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
                        Todas as Aulas
                    </Button>
                </div>
                
                {/* TÍTULO CENTRALIZADO */}
                <span className="font-semibold text-sky-700 ml-4">{displayDate}</span>
                
                {/* NAVEGAÇÃO SEMANAL (Aparece apenas se o filtro semanal estiver ativo) */}
                <div className="flex items-center space-x-3">
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
                        {(loading || loadingDay) ? (
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