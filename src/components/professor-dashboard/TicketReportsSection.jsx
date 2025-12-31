// Arquivo: src/components/professor-dashboard/TicketReportsSection.jsx
// Dashboard de relatórios e estatísticas de tickets (Admin only)

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, Clock, CheckCircle, AlertTriangle, Calendar } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const TicketReportsSection = () => {
    const [stats, setStats] = useState(null);
    const [byType, setByType] = useState([]);
    const [byPriority, setByPriority] = useState([]);
    const [trend, setTrend] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadReports();
    }, []);

    const loadReports = async () => {
        setLoading(true);
        try {
            // Overall stats
            const { data: statsData } = await supabase
                .from('ticket_stats')
                .select('*')
                .single();

            // By type
            const { data: typeData } = await supabase
                .from('tickets_by_type')
                .select('*');

            // By priority
            const { data: priorityData } = await supabase
                .from('tickets_by_priority')
                .select('*');

            // Daily trend (last 7 days)
            const { data: trendData } = await supabase
                .from('daily_ticket_trend')
                .select('*')
                .limit(7);

            setStats(statsData);
            setByType(typeData || []);
            setByPriority(priorityData || []);
            setTrend(trendData || []);
        } catch (error) {
            console.error('Error loading reports:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
            </div>
        );
    }

    const TICKET_TYPES = {
        transfer_student: { label: 'Transferência de Aluno', icon: '👥' },
        temporary_replacement: { label: 'Substituição Temporária', icon: '🔄' },
        system_question: { label: 'Queixa sobre o Sistema', icon: '💬' },
        reschedule_class: { label: 'Reagendar Aula', icon: '📅' },
        change_student_schedule: { label: 'Mudança de Horário', icon: '⏰' },
        schedule_unavailability: { label: 'Indisponibilidade', icon: '🚫' },
        confirm_student_info: { label: 'Confirmar Informações', icon: '✓' }
    };

    const PRIORITIES = {
        low: { label: 'Baixa', color: 'bg-green-100 text-green-800', icon: '⬇️' },
        medium: { label: 'Média', color: 'bg-yellow-100 text-yellow-800', icon: '➡️' },
        high: { label: 'Alta', color: 'bg-orange-100 text-orange-800', icon: '⬆️' },
        urgent: { label: 'Urgente', color: 'bg-red-100 text-red-800', icon: '🔥' }
    };

    return (
        <div className="space-y-6 p-6 bg-slate-50 rounded-lg">
            <div>
                <h3 className="text-xl font-bold text-slate-800 mb-1">Relatórios e Estatísticas</h3>
                <p className="text-sm text-slate-500">Dados dos últimos 30 dias</p>
            </div>

            {/* Overall Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-slate-600">Total de Tickets</p>
                                <p className="text-3xl font-bold text-slate-900">{stats?.total_tickets || 0}</p>
                            </div>
                            <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center">
                                <TrendingUp className="h-6 w-6 text-purple-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-slate-600">Tickets Encerrados</p>
                                <p className="text-3xl font-bold text-green-600">{stats?.closed_count || 0}</p>
                                <p className="text-xs text-slate-500 mt-1">
                                    {stats?.resolution_rate_percent || 0}% taxa de resolução
                                </p>
                            </div>
                            <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                                <CheckCircle className="h-6 w-6 text-green-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-slate-600">Tempo Médio</p>
                                <p className="text-3xl font-bold text-blue-600">
                                    {stats?.avg_resolution_hours ? `${Math.round(stats.avg_resolution_hours)}h` : '-'}
                                </p>
                                <p className="text-xs text-slate-500 mt-1">Tempo de resolução</p>
                            </div>
                            <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                                <Clock className="h-6 w-6 text-blue-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-slate-600">Violações de SLA</p>
                                <p className="text-3xl font-bold text-red-600">{stats?.sla_violations || 0}</p>
                                <p className="text-xs text-slate-500 mt-1">Tickets sem resposta no prazo</p>
                            </div>
                            <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center">
                                <AlertTriangle className="h-6 w-6 text-red-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Status Breakdown */}
            <Card>
                <CardHeader>
                    <CardTitle>Distribuição por Status</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                            <p className="text-2xl font-bold text-yellow-700">{stats?.pending_count || 0}</p>
                            <p className="text-sm text-yellow-600 font-medium mt-1">Pendentes</p>
                        </div>
                        <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
                            <p className="text-2xl font-bold text-blue-700">{stats?.open_count || 0}</p>
                            <p className="text-sm text-blue-600 font-medium mt-1">Abertas</p>
                        </div>
                        <div className="text-center p-4 bg-orange-50 rounded-lg border border-orange-200">
                            <p className="text-2xl font-bold text-orange-700">{stats?.awaiting_user_count || 0}</p>
                            <p className="text-sm text-orange-600 font-medium mt-1">Aguardando</p>
                        </div>
                        <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                            <p className="text-2xl font-bold text-green-700">{stats?.closed_count || 0}</p>
                            <p className="text-sm text-green-600 font-medium mt-1">Encerradas</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* By Type */}
                <Card>
                    <CardHeader>
                        <CardTitle>Tickets por Tipo</CardTitle>
                        <CardDescription>Distribuição e taxa de resolução</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {byType.map(item => {
                                const typeInfo = TICKET_TYPES[item.type] || { label: item.type, icon: '📄' };
                                const percentage = (item.ticket_count / (stats?.total_tickets || 1)) * 100;

                                return (
                                    <div key={item.type} className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-medium flex items-center gap-2">
                                                <span>{typeInfo.icon}</span>
                                                <span>{typeInfo.label}</span>
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <Badge variant="outline" className="text-xs">{item.ticket_count}</Badge>
                                                <span className="text-xs text-slate-500">{item.resolution_rate}%</span>
                                            </div>
                                        </div>
                                        <div className="w-full bg-slate-200 rounded-full h-2">
                                            <div
                                                className="bg-purple-600 h-2 rounded-full transition-all"
                                                style={{ width: `${percentage}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                            {byType.length === 0 && (
                                <p className="text-center text-slate-500 py-4">Nenhum ticket registrado</p>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* By Priority */}
                <Card>
                    <CardHeader>
                        <CardTitle>Tickets por Prioridade</CardTitle>
                        <CardDescription>Tempo médio e violações de SLA</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {byPriority.map(item => {
                                const priorityInfo = PRIORITIES[item.priority] || { label: item.priority, color: 'bg-slate-100', icon: '•' };

                                return (
                                    <div key={item.priority} className={`p-3 rounded-lg ${priorityInfo.color}`}>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="font-medium flex items-center gap-2">
                                                <span>{priorityInfo.icon}</span>
                                                <span>{priorityInfo.label}</span>
                                            </span>
                                            <Badge variant="secondary">{item.ticket_count}</Badge>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                            <div>
                                                <p className="text-slate-600">Resolvidos</p>
                                                <p className="font-semibold">{item.closed_count}</p>
                                            </div>
                                            <div>
                                                <p className="text-slate-600">SLA violado</p>
                                                <p className="font-semibold text-red-600">{item.sla_violations || 0}</p>
                                            </div>
                                        </div>
                                        {item.avg_resolution_hours && (
                                            <p className="text-xs mt-2 text-slate-600">
                                                Tempo médio: <span className="font-semibold">{Math.round(item.avg_resolution_hours)}h</span>
                                            </p>
                                        )}
                                    </div>
                                );
                            })}
                            {byPriority.length === 0 && (
                                <p className="text-center text-slate-500 py-4">Nenhum ticket registrado</p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Daily Trend */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        Tendência Diária (Últimos 7 dias)
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        {trend.map(day => (
                            <div key={day.date} className="flex items-center gap-4 p-2 hover:bg-slate-50 rounded">
                                <div className="w-24 text-sm font-medium text-slate-600">
                                    {format(parseISO(day.date), 'dd/MM', { locale: ptBR })}
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 bg-slate-200 rounded-full h-6 relative overflow-hidden">
                                            <div
                                                className="bg-purple-500 h-6 rounded-full flex items-center justify-end pr-2"
                                                style={{ width: `${(day.tickets_created / Math.max(...trend.map(t => t.tickets_created))) * 100}%` }}
                                            >
                                                <span className="text-white text-xs font-semibold">{day.tickets_created}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    {day.urgent_count > 0 && (
                                        <Badge className="bg-red-500 text-white text-xs">
                                            🔥 {day.urgent_count}
                                        </Badge>
                                    )}
                                    {day.high_count > 0 && (
                                        <Badge className="bg-orange-500 text-white text-xs">
                                            ⬆️ {day.high_count}
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        ))}
                        {trend.length === 0 && (
                            <p className="text-center text-slate-500 py-4">Nenhum ticket nos últimos 7 dias</p>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default TicketReportsSection;
