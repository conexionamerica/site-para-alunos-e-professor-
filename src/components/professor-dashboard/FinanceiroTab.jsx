import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DollarSign, Clock, BookOpen, User, TrendingUp } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';

const FinanceiroTab = ({ dashboardData }) => {
    // Extração segura dos dados
    const appointments = dashboardData?.data?.appointments || [];
    const BASE_RATE = 6.11; // R$ 6.11 por cada 30 minutos

    // Lógica de cálculo
    const stats = useMemo(() => {
        // Filtrar apenas aulas concluídas
        const completedClasses = appointments.filter(apt => apt.status === 'completed');

        // Total de minutos
        const totalMinutes = completedClasses.reduce((sum, apt) => sum + (apt.duration_minutes || 30), 0);

        // Quantidade de aulas (unidades de 30 min)
        const totalUnits = totalMinutes / 30;

        // Ganhos totais
        const totalEarnings = totalUnits * BASE_RATE;

        // Agrupar por Aluno
        const studentStats = {};
        completedClasses.forEach(apt => {
            const studentId = apt.student_id;
            const studentName = apt.student?.full_name || 'Aluno N/A';
            const duration = apt.duration_minutes || 30;

            if (!studentStats[studentId]) {
                studentStats[studentId] = {
                    name: studentName,
                    typicalDuration: duration,
                    totalMinutes: 0,
                    units: 0,
                    earnings: 0,
                    sessions: 0
                };
            }

            studentStats[studentId].totalMinutes += duration;
            studentStats[studentId].sessions += 1;
        });

        // Calcular valores finais por aluno
        const groupedList = Object.values(studentStats).map(student => {
            const units = student.totalMinutes / 30;
            return {
                ...student,
                units: units,
                earnings: units * BASE_RATE
            };
        });

        return {
            totalEarnings,
            totalMinutes,
            totalUnits,
            groupedList,
            completedCount: completedClasses.length
        };
    }, [appointments]);

    // Formatar tempo (Minutos -> HH:mm)
    const formatTime = (minutes) => {
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return `${h}h ${String(m).padStart(2, '0')}m`;
    };

    return (
        <div className="px-4 lg:px-8 space-y-8 py-6">
            {/* Cabeçalho */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-emerald-100 rounded-xl text-emerald-600">
                        <DollarSign className="h-8 w-8" />
                    </div>
                    <div>
                        <h2 className="text-3xl font-bold text-slate-800 uppercase tracking-tight">My Earnings</h2>
                        <p className="text-slate-500 font-medium">Controle de rendimentos e produtividade</p>
                    </div>
                </div>
                <Badge variant="outline" className="text-sm py-1.5 px-4 bg-white border-slate-200 text-slate-600 shadow-sm self-start md:self-center">
                    Taxa Base: R$ {BASE_RATE.toFixed(2)} / 30 min
                </Badge>
            </div>

            {/* Grid de Cards de Resumo */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                {/* Ganhos Totais */}
                <Card className="border-none shadow-md bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium opacity-90 uppercase">Total de Ganhos</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between">
                            <div className="text-3xl font-bold">R$ {stats.totalEarnings.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                            <div className="p-2 bg-white/20 rounded-lg">
                                <TrendingUp className="h-6 w-6" />
                            </div>
                        </div>
                        <p className="text-xs mt-2 opacity-80">Ganhos estimados acumulados</p>
                    </CardContent>
                </Card>

                {/* Tempo Total */}
                <Card className="border-none shadow-md bg-white border-l-4 border-l-sky-500">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500 uppercase">Tempo em Aula</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between">
                            <div className="text-3xl font-bold text-slate-800">{formatTime(stats.totalMinutes)}</div>
                            <div className="p-2 bg-sky-50 rounded-lg text-sky-600">
                                <Clock className="h-6 w-6" />
                            </div>
                        </div>
                        <p className="text-xs mt-2 text-slate-400">Total de minutos em aulas concluídas</p>
                    </CardContent>
                </Card>

                {/* Quantidade de Aulas (Unidades) */}
                <Card className="border-none shadow-md bg-white border-l-4 border-l-purple-500">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500 uppercase">Quantidade de Aulas</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between">
                            <div className="text-3xl font-bold text-slate-800">{stats.totalUnits.toFixed(1)}</div>
                            <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
                                <BookOpen className="h-6 w-6" />
                            </div>
                        </div>
                        <p className="text-xs mt-2 text-slate-400">Total de unidades (30 min cada)</p>
                    </CardContent>
                </Card>
            </div>

            {/* Tabela de Detalhes por Aluno */}
            <Card className="border-none shadow-md overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b">
                    <CardTitle className="text-lg font-bold text-slate-800">Histórico por Aluno</CardTitle>
                    <CardDescription>Detalhamento de rendimentos por cada aluno atendido</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-slate-50">
                            <TableRow>
                                <TableHead className="font-bold">Aluno</TableHead>
                                <TableHead className="font-bold">Duração Aula</TableHead>
                                <TableHead className="font-bold">Tempo Total</TableHead>
                                <TableHead className="font-bold">Qtd. Total (30m)</TableHead>
                                <TableHead className="font-bold">Valor Unitário</TableHead>
                                <TableHead className="font-bold text-right">Valor Estimado</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {stats.groupedList.length > 0 ? (
                                stats.groupedList.map((student, idx) => (
                                    <TableRow key={idx} className="hover:bg-slate-50 transition-colors">
                                        <TableCell className="font-medium text-slate-700">
                                            <div className="flex items-center gap-2">
                                                <div className="p-1.5 bg-slate-100 rounded-lg">
                                                    <User className="w-4 h-4 text-slate-500" />
                                                </div>
                                                {student.name}
                                            </div>
                                        </TableCell>
                                        <TableCell>{student.typicalDuration} min</TableCell>
                                        <TableCell>{formatTime(student.totalMinutes)}</TableCell>
                                        <TableCell>
                                            <Badge variant="secondary" className="bg-slate-100 text-slate-700">
                                                {student.units.toFixed(1)}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-slate-500 text-sm">R$ {BASE_RATE.toFixed(2)}</TableCell>
                                        <TableCell className="text-right font-bold text-emerald-600">
                                            R$ {student.earnings.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-12 text-slate-400">
                                        Nenhuma aula concluída encontrada para calcular rendimentos.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
};

export default FinanceiroTab;
