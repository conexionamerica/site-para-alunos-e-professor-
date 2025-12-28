// Archivo: src/components/professor-dashboard/AgendaTab.jsx
// Vista de Calendario Semanal - Sincronizado con dashboardData

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { format, parseISO, getDay, startOfWeek, endOfWeek, addDays, addWeeks, subWeeks, addMonths, subMonths, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2, ChevronLeft, ChevronRight, Grid3x3, List, RefreshCw, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
    const loading = dashboardData?.loading || false;
    const isSuperadmin = dashboardData?.isSuperadmin || false;
    const professors = dashboardData?.data?.professors || [];

    // SINCRONIZAÇÃO: Usar appointments do dashboardData como fonte única
    const allAppointments = dashboardData?.data?.appointments || [];

    const today = useMemo(() => getBrazilDate(), []);

    // Estados
    const [currentDate, setCurrentDate] = useState(today);
    const [viewMode, setViewMode] = useState('week');
    const [professorFilter, setProfessorFilter] = useState('all');
    // Usar hora local do navegador para mostrar a linha vermelha consistente com o relógio do usuário
    const [currentTime, setCurrentTime] = useState(() => {
        const now = new Date();
        return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    });

    // Ref para scroll automático à hora atual
    const currentTimeRef = useRef(null);
    const gridContainerRef = useRef(null);

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

    // Filtrar appointments para a semana atual (usando dados centralizados)
    const weekAppointments = useMemo(() => {
        const startStr = format(weekStart, 'yyyy-MM-dd');
        const endStr = format(weekEnd, 'yyyy-MM-dd');

        return allAppointments.filter(apt => {
            if (!apt.class_datetime) return false;
            const aptDateStr = apt.class_datetime.substring(0, 10);
            const status = apt.status;

            // Filtro de professor para superadmin
            if (isSuperadmin && professorFilter !== 'all' && apt.professor_id !== professorFilter) {
                return false;
            }

            return aptDateStr >= startStr &&
                aptDateStr <= endStr &&
                ['scheduled', 'completed', 'rescheduled', 'missed'].includes(status);
        });
    }, [allAppointments, weekStart, weekEnd, isSuperadmin, professorFilter]);

    // Atualizar hora atual a cada minuto
    useEffect(() => {
        const interval = setInterval(() => {
            const now = new Date();
            setCurrentTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
        }, 60000); // Atualiza a cada 1 minuto

        return () => clearInterval(interval);
    }, []);

    // Scroll automático para a hora atual ao carregar
    useEffect(() => {
        if (currentTimeRef.current && gridContainerRef.current && isSameWeekAsToday()) {
            setTimeout(() => {
                currentTimeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 500);
        }
    }, [viewMode]);

    // Verificar se a semana atual contém hoje
    const isSameWeekAsToday = () => {
        return weekDays.some(day => isSameDay(day, today));
    };

    // Calcular posição da linha de hora atual (em porcentagem dentro do slot de 15min)
    const getCurrentTimePosition = () => {
        const [hours, minutes] = currentTime.split(':').map(Number);
        const currentTotalMinutes = hours * 60 + minutes;
        const slotStartMinutes = 7 * 60; // 07:00
        const slotEndMinutes = 24 * 60; // 24:00

        if (currentTotalMinutes < slotStartMinutes || currentTotalMinutes > slotEndMinutes) {
            return null;
        }

        // Encontrar qual slot de 15 minutos estamos
        const minutesSinceStart = currentTotalMinutes - slotStartMinutes;
        const slotIndex = Math.floor(minutesSinceStart / 15);
        const minutesIntoSlot = minutesSinceStart % 15;
        const percentageIntoSlot = (minutesIntoSlot / 15) * 100;

        return { slotIndex, percentageIntoSlot };
    };

    // Navegación
    const goToPreviousWeek = () => setCurrentDate(subWeeks(currentDate, 1));
    const goToNextWeek = () => setCurrentDate(addWeeks(currentDate, 1));
    const goToPreviousMonth = () => setCurrentDate(subMonths(currentDate, 1));
    const goToNextMonth = () => setCurrentDate(addMonths(currentDate, 1));
    const goToToday = () => setCurrentDate(today);

    // Obtener appointments para un día y hora específicos
    const getAppointmentsForSlot = (day, timeSlot) => {
        return weekAppointments.filter(apt => {
            const aptDate = parseISO(apt.class_datetime);
            const aptTime = format(aptDate, 'HH:mm');
            return isSameDay(aptDate, day) && aptTime === timeSlot;
        });
    };

    // Calcular la altura del bloque de aula basado en la duración
    const getBlockHeight = (duration) => {
        const slots = Math.ceil(duration / 15);
        return `${slots * 60}px`;
    };

    // Renderizar bloque de aula
    const renderAppointmentBlock = (apt) => {
        const isSpanish = apt.student?.spanish_level;
        const bgColor = apt.status === 'completed' ? 'bg-green-100 border-green-300' :
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
        <div className="w-full px-4 lg:px-8">
            <div className="w-full bg-white rounded-lg shadow-sm">
                {/* Header */}
                <div className="p-4 border-b flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-4">
                        <h2 className="text-xl font-bold text-slate-800">Horários de Aula</h2>

                        {/* Filtro de professor para superadmin */}
                        {isSuperadmin && professors.length > 0 && (
                            <Select value={professorFilter} onValueChange={setProfessorFilter}>
                                <SelectTrigger className="w-[200px]">
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
                    </div>

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
                            {/* Header de días - DIA DE HOJE DESTACADO */}
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
                                                isToday ? "bg-orange-100 border-b-2 border-orange-500" : ""
                                            )}
                                        >
                                            <div className={cn(
                                                "text-sm font-medium",
                                                isToday ? "text-orange-700 font-bold" : "text-slate-700"
                                            )}>
                                                {daysOfWeekMapShort[getDay(day)]}
                                                {isToday && <span className="ml-1 text-xs bg-orange-500 text-white px-1.5 py-0.5 rounded">HOJE</span>}
                                            </div>
                                            <div className={cn(
                                                "text-xs mt-0.5",
                                                isToday ? "text-orange-600 font-bold" : "text-slate-500"
                                            )}>
                                                {format(day, 'dd/MM')}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Grid de horarios com linha de hora atual */}
                            <div ref={gridContainerRef} className="relative" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                                {loading ? (
                                    <div className="flex justify-center items-center h-64">
                                        <Loader2 className="h-8 w-8 animate-spin text-sky-600" />
                                    </div>
                                ) : (
                                    TIME_SLOTS.map((timeSlot, timeIdx) => {
                                        const timePosition = getCurrentTimePosition();
                                        const isCurrentTimeSlot = timePosition && timePosition.slotIndex === timeIdx;

                                        return (
                                            <div
                                                key={timeSlot}
                                                className="grid grid-cols-8 border-b hover:bg-slate-50 relative"
                                                style={{ minHeight: '60px', gridTemplateColumns: '80px repeat(7, 1fr)' }}
                                                ref={isCurrentTimeSlot ? currentTimeRef : null}
                                            >
                                                {/* LINHA VERMELHA DE HORA ATUAL */}
                                                {isCurrentTimeSlot && isSameWeekAsToday() && (
                                                    <div
                                                        className="absolute left-0 right-0 z-20 pointer-events-none"
                                                        style={{ top: `${timePosition.percentageIntoSlot}%` }}
                                                    >
                                                        <div className="flex items-center">
                                                            <div className="w-[80px] flex items-center justify-end pr-1">
                                                                <span className="text-[10px] text-red-600 font-bold bg-red-100 px-1 rounded">
                                                                    {currentTime}
                                                                </span>
                                                            </div>
                                                            <div className="flex-1 h-0.5 bg-red-500 relative">
                                                                <div className="absolute left-0 -top-1 w-2 h-2 bg-red-500 rounded-full"></div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

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
                                                                isToday && "bg-orange-50/50"
                                                            )}
                                                            style={{ minHeight: '60px' }}
                                                        >
                                                            {aptsForSlot.map(apt => renderAppointmentBlock(apt))}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Vista de Lista (alternativa) */}
                {viewMode === 'list' && (
                    <div className="p-4">
                        {loading ? (
                            <div className="flex justify-center items-center h-64">
                                <Loader2 className="h-8 w-8 animate-spin text-sky-600" />
                            </div>
                        ) : weekAppointments.length > 0 ? (
                            <div className="space-y-2">
                                {weekAppointments.map(apt => {
                                    const aptDate = parseISO(apt.class_datetime);
                                    const bgColor = apt.status === 'completed' ? 'bg-green-100 border-green-300' :
                                        apt.status === 'rescheduled' ? 'bg-blue-200 border-blue-400' :
                                            apt.status === 'missed' ? 'bg-red-100 border-red-300' :
                                                'bg-blue-50 border-blue-200';
                                    const textColor = apt.status === 'missed' ? 'text-red-800' : 'text-slate-800';

                                    return (
                                        <div key={apt.id} className={`p-4 border-2 rounded-lg hover:shadow-md transition-shadow ${bgColor}`}>
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <div className={`font-semibold ${textColor}`}>
                                                        {apt.student?.full_name || 'Sin nombre'}
                                                    </div>
                                                    <div className="text-sm text-slate-600">
                                                        {apt.student?.spanish_level ? 'Espanhol' : 'Inglês'}
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className={`text-sm font-medium ${textColor}`}>
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
