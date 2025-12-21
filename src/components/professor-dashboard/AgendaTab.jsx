// Archivo: src/components/professor-dashboard/AgendaTab.jsx
// Vista de Calendario Semanal - Inspirado en el diseño proporcionado

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { format, parseISO, getDay, startOfWeek, endOfWeek, addDays, addWeeks, subWeeks, startOfMonth, endOfMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2, ChevronLeft, ChevronRight, Grid3x3, List, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getBrazilDate } from '@/lib/dateUtils';

const daysOfWeekMapShort = {
    0: 'Domingo',
    1: 'Segunda',
    2: 'Terça',
    3: 'Quarta',
    4: 'Quinta',
    5: 'Sexta',
    6: 'Sábado'
};

// Horarios de 07:00 a 23:45 en intervalos de 15 minutos
const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 7; hour <= 23; hour++) {
        for (let minute = 0; minute < 60; minute += 15) {
            if (hour === 23 && minute > 45) break;
            slots.push(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
        }
    }
    return slots;
};

const TIME_SLOTS = generateTimeSlots();

const AgendaTab = ({ dashboardData }) => {
    const professorId = dashboardData?.professorId;
    const onUpdate = dashboardData?.onUpdate;

    const today = useMemo(() => getBrazilDate(), []);

    // Estados
    const [currentDate, setCurrentDate] = useState(today);
    const [viewMode, setViewMode] = useState('week'); // 'week' o 'list'
    const [appointments, setAppointments] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    // Calcular inicio y fin de la semana
    const weekStart = useMemo(() => startOfWeek(currentDate, { weekStartsOn: 0 }), [currentDate]);
    const weekEnd = useMemo(() => endOfWeek(currentDate, { weekStartsOn: 0 }), [currentDate]);

    // Generar array de días de la semana
    const weekDays = useMemo(() => {
        const days = [];
        for (let i = 0; i < 7; i++) {
            days.push(addDays(weekStart, i));
        }
        return days;
    }, [weekStart]);

    // Fetch appointments para la semana
    const fetchWeekAppointments = useCallback(async () => {
        if (!professorId) return;

        setIsLoading(true);

        try {
            const startStr = format(weekStart, 'yyyy-MM-dd');
            const endStr = format(weekEnd, 'yyyy-MM-dd');

            const { data, error } = await supabase
                .from('appointments')
                .select(`
                    id, class_datetime, status, duration_minutes,
                    student:profiles!student_id(full_name, spanish_level)
                `)
                .eq('professor_id', professorId)
                .gte('class_datetime', `${startStr}T00:00:00-03:00`)
                .lte('class_datetime', `${endStr}T23:59:59-03:00`)
                .in('status', ['scheduled', 'completed', 'rescheduled', 'missed'])
                .order('class_datetime', { ascending: true });

            if (error) throw error;

            setAppointments(data || []);
        } catch (error) {
            console.error('Error fetching appointments:', error);
            setAppointments([]);
        } finally {
            setIsLoading(false);
        }
    }, [professorId, weekStart, weekEnd]);

    useEffect(() => {
        fetchWeekAppointments();
    }, [fetchWeekAppointments]);

    // Navegación
    const goToPreviousWeek = () => setCurrentDate(subWeeks(currentDate, 1));
    const goToNextWeek = () => setCurrentDate(addWeeks(currentDate, 1));
    const goToPreviousMonth = () => setCurrentDate(subMonths(currentDate, 1));
    const goToNextMonth = () => setCurrentDate(addMonths(currentDate, 1));
    const goToToday = () => setCurrentDate(today);

    // Obtener appointments para un día y hora específicos
    const getAppointmentsForSlot = (day, timeSlot) => {
        return appointments.filter(apt => {
            const aptDate = parseISO(apt.class_datetime);
            const aptTime = format(aptDate, 'HH:mm');
            return isSameDay(aptDate, day) && aptTime === timeSlot;
        });
    };

    // Calcular la altura del bloque de aula basado en la duración
    const getBlockHeight = (duration) => {
        const slots = Math.ceil(duration / 15);
        return `${slots * 60}px`; // 60px por cada slot de 15 minutos
    };

    // Renderizar bloque de aula
    const renderAppointmentBlock = (apt) => {
        const isSpanish = apt.student?.spanish_level;
        const bgColor = apt.status === 'completed' ? 'bg-blue-100 border-blue-300' :
            apt.status === 'rescheduled' ? 'bg-blue-200 border-blue-400' :
                apt.status === 'missed' ? 'bg-red-100 border-red-300' :
                    'bg-blue-50 border-blue-200';

        return (
            <div
                key={apt.id}
                className={cn(
                    "absolute left-0 right-0 mx-1 p-2 rounded border text-xs overflow-hidden",
                    bgColor
                )}
                style={{
                    height: getBlockHeight(apt.duration_minutes || 30),
                    zIndex: 10
                }}
            >
                <div className="font-semibold truncate text-slate-800">
                    {apt.student?.full_name || 'Sin nombre'}
                </div>
                <div className="text-slate-600 text-[10px]">
                    {isSpanish ? 'Espanhol' : 'Inglês'}
                </div>
            </div>
        );
    };

    if (!professorId) {
        return (
            <div className="flex justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-sky-600" />
            </div>
        );
    }

    return (
        <div className="flex justify-center">
            <div className="w-full max-w-[1400px] bg-white rounded-lg shadow-sm">
                {/* Header */}
                <div className="p-4 border-b flex items-center justify-between flex-wrap gap-4">
                    <h2 className="text-xl font-bold text-slate-800">Horários de Aula</h2>

                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Navegación de mes */}
                        <div className="flex items-center gap-2 border rounded-lg px-2 py-1">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={goToPreviousMonth}
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <span className="text-sm font-medium min-w-[120px] text-center">
                                {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
                            </span>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={goToNextMonth}
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>

                        {/* Navegación de semana */}
                        <div className="flex items-center gap-2 border rounded-lg px-2 py-1">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={goToPreviousWeek}
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <span className="text-sm font-medium min-w-[200px] text-center">
                                {format(weekStart, 'dd', { locale: ptBR })} de {format(weekStart, 'MMMM', { locale: ptBR })} - {format(weekEnd, 'dd', { locale: ptBR })} de {format(weekEnd, 'MMMM yyyy', { locale: ptBR })}
                            </span>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={goToNextWeek}
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>

                        {/* Botón Actualizar */}
                        <Button
                            onClick={() => {
                                fetchWeekAppointments();
                                if (onUpdate) onUpdate();
                            }}
                            className="bg-blue-500 hover:bg-blue-600 text-white"
                            size="sm"
                        >
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Atualizar Horários
                        </Button>

                        {/* Toggle vista */}
                        <div className="flex border rounded-lg">
                            <Button
                                variant={viewMode === 'week' ? 'default' : 'ghost'}
                                size="icon"
                                className={cn("h-8 w-8", viewMode === 'week' && "bg-sky-600")}
                                onClick={() => setViewMode('week')}
                            >
                                <Grid3x3 className="h-4 w-4" />
                            </Button>
                            <Button
                                variant={viewMode === 'list' ? 'default' : 'ghost'}
                                size="icon"
                                className={cn("h-8 w-8", viewMode === 'list' && "bg-sky-600")}
                                onClick={() => setViewMode('list')}
                            >
                                <List className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Vista de Calendario Semanal */}
                {viewMode === 'week' && (
                    <div className="overflow-x-auto">
                        <div className="min-w-[1000px] mx-auto">
                            {/* Header de días */}
                            <div className="grid grid-cols-8 border-b bg-slate-50" style={{ gridTemplateColumns: '80px repeat(7, 1fr)' }}>
                                <div className="p-2 text-center text-sm font-medium text-slate-600 border-r">
                                    Horário
                                </div>
                                {weekDays.map((day, idx) => {
                                    const isToday = isSameDay(day, today);
                                    return (
                                        <div
                                            key={idx}
                                            className={cn(
                                                "p-2 text-center border-r last:border-r-0",
                                                isToday && "bg-sky-50"
                                            )}
                                        >
                                            <div className={cn(
                                                "text-sm font-medium",
                                                isToday ? "text-sky-600" : "text-slate-700"
                                            )}>
                                                {daysOfWeekMapShort[getDay(day)]}
                                            </div>
                                            <div className={cn(
                                                "text-xs",
                                                isToday ? "text-sky-500 font-semibold" : "text-slate-500"
                                            )}>
                                                {format(day, 'dd/MM')}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Grid de horarios */}
                            <div className="relative" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                                {isLoading ? (
                                    <div className="flex justify-center items-center h-64">
                                        <Loader2 className="h-8 w-8 animate-spin text-sky-600" />
                                    </div>
                                ) : (
                                    TIME_SLOTS.map((timeSlot, timeIdx) => (
                                        <div key={timeSlot} className="grid grid-cols-8 border-b hover:bg-slate-50" style={{ minHeight: '60px', gridTemplateColumns: '80px repeat(7, 1fr)' }}>
                                            {/* Columna de hora */}
                                            <div className="p-2 text-center text-xs text-slate-600 border-r bg-slate-50 font-medium">
                                                {timeSlot}
                                            </div>

                                            {/* Columnas de días */}
                                            {weekDays.map((day, dayIdx) => {
                                                const isToday = isSameDay(day, today);
                                                const aptsForSlot = getAppointmentsForSlot(day, timeSlot);

                                                return (
                                                    <div
                                                        key={dayIdx}
                                                        className={cn(
                                                            "relative border-r last:border-r-0",
                                                            isToday && "bg-sky-50/30"
                                                        )}
                                                        style={{ minHeight: '60px' }}
                                                    >
                                                        {aptsForSlot.map(apt => renderAppointmentBlock(apt))}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Vista de Lista (alternativa) */}
                {viewMode === 'list' && (
                    <div className="p-4">
                        {isLoading ? (
                            <div className="flex justify-center items-center h-64">
                                <Loader2 className="h-8 w-8 animate-spin text-sky-600" />
                            </div>
                        ) : appointments.length > 0 ? (
                            <div className="space-y-2">
                                {appointments.map(apt => {
                                    const aptDate = parseISO(apt.class_datetime);
                                    return (
                                        <div key={apt.id} className="p-4 border rounded-lg hover:bg-slate-50">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <div className="font-semibold text-slate-800">
                                                        {apt.student?.full_name || 'Sin nombre'}
                                                    </div>
                                                    <div className="text-sm text-slate-600">
                                                        {apt.student?.spanish_level ? 'Espanhol' : 'Inglês'}
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-sm font-medium text-slate-700">
                                                        {format(aptDate, 'dd/MM/yyyy')}
                                                    </div>
                                                    <div className="text-sm text-slate-600">
                                                        {format(aptDate, 'HH:mm')} ({apt.duration_minutes || 30} min)
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-center py-12 text-slate-500">
                                Nenhuma aula agendada para esta semana.
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AgendaTab;
