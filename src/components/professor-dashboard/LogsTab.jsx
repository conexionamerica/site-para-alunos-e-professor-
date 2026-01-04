// src/components/professor-dashboard/LogsTab.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    RotateCcw,
    History,
    Search,
    Calendar as CalendarIcon,
    User as UserIcon,
    FilterX,
    Loader2,
    Info,
    Eye,
    ChevronRight,
    ArrowRight
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";

const LogsTab = ({ dashboardData }) => {
    const { toast } = useToast();
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [reverting, setReverting] = useState(null); // ID do log sendo revertido
    const [selectedLog, setSelectedLog] = useState(null); // Log selecionado para ver detalhes

    // Filtros
    const [filterCode, setFilterCode] = useState('');
    const [filterUser, setFilterUser] = useState('all');
    const [filterTable, setFilterTable] = useState('all');
    const [filterAction, setFilterAction] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStartDate, setFilterStartDate] = useState('');
    const [filterEndDate, setFilterEndDate] = useState('');

    const onUpdate = dashboardData?.onUpdate;
    const allStudents = dashboardData?.data?.students || [];
    const allProfiles = dashboardData?.data?.allProfiles || [];

    // Helper para encontrar nome do aluno/usuário
    const getProfileName = useCallback((id) => {
        if (!id) return null;
        const profile = allProfiles.find(p => p.id === id);
        return profile?.full_name || null;
    }, [allProfiles]);

    // Helper para traduzir nome da tabela
    const translateTableName = (tableName) => {
        const translations = {
            'appointments': 'Aulas',
            'profiles': 'Perfis',
            'billing': 'Faturas',
            'packages': 'Pacotes',
            'class_slots': 'Horários',
            'solicitudes_clase': 'Solicitações',
            'chats': 'Conversas',
            'mensajes': 'Mensagens',
            'class_feedback': 'Feedbacks',
            'notifications': 'Notificações',
            'assigned_packages_log': 'Atribuições de Pacotes'
        };
        return translations[tableName] || tableName;
    };

    // Helper para traduzir campos
    const translateField = (field) => {
        const translations = {
            'class_datetime': 'Data/Hora da Aula',
            'status': 'Status',
            'student_id': 'Aluno',
            'professor_id': 'Professor',
            'full_name': 'Nome Completo',
            'email': 'Email',
            'phone': 'Telefone',
            'spanish_level': 'Nível de Espanhol',
            'reschedule_reason': 'Motivo do Reagendamento',
            'observation': 'Observação',
            'start_time': 'Horário de Início',
            'end_time': 'Horário de Término',
            'day_of_week': 'Dia da Semana',
            'package_id': 'Pacote',
            'assigned_classes': 'Aulas Atribuídas',
            'purchase_date': 'Data da Compra',
            'expiration_date': 'Data de Expiração'
        };
        return translations[field] || field;
    };

    // Formatar valor para exibição
    const formatValue = (key, value) => {
        if (value === null || value === undefined) return '(vazio)';

        // Formatar datas
        if (key.includes('datetime') || key.includes('date') || key.includes('_at')) {
            try {
                return format(new Date(value), 'dd/MM/yyyy HH:mm', { locale: ptBR });
            } catch { return value; }
        }

        // Traduzir status
        if (key === 'status') {
            const statuses = {
                'scheduled': 'Agendado',
                'rescheduled': 'Reagendado',
                'completed': 'Realizada',
                'cancelled': 'Cancelada',
                'no_show': 'Falta'
            };
            return statuses[value] || value;
        }

        // IDs de usuários - tentar buscar nome
        if (key.includes('_id') && typeof value === 'string' && value.includes('-')) {
            const name = getProfileName(value);
            if (name) return name;
        }

        return String(value);
    };

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('audit_logs')
                .select(`
                    *,
                    profiles:changed_by(full_name, avatar_url)
                `)
                .order('created_at', { ascending: false })
                .limit(200);

            const { data, error } = await query;
            if (error) throw error;
            setLogs(data || []);
        } catch (error) {
            console.error('Erro ao buscar logs:', error);
            toast({
                variant: 'destructive',
                title: 'Erro ao carregar logs',
                description: error.message
            });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    const handleRevert = async (log) => {
        if (!window.confirm(`Tem certeza que deseja reverter a ação #${log.log_code}? Isso restaurará os dados para o estado anterior.`)) {
            return;
        }

        setReverting(log.id);
        try {
            const { data, error } = await supabase.rpc('reverse_audit_log', { p_log_id: log.id });

            if (error) throw error;

            if (data?.success) {
                toast({
                    title: 'Operação revertida!',
                    description: data.message
                });
                fetchLogs();
                if (onUpdate) onUpdate();
            } else {
                toast({
                    variant: 'destructive',
                    title: 'Falha na reversão',
                    description: data?.message || 'Erro desconhecido'
                });
            }
        } catch (error) {
            console.error('Erro ao reverter:', error);
            toast({
                variant: 'destructive',
                title: 'Erro sistêmico',
                description: error.message
            });
        } finally {
            setReverting(null);
        }
    };

    // Filtros calculados localmente (inclui data e usuário)
    const filteredLogs = useMemo(() => {
        return logs
            .filter(log => {
                const matchCode = filterCode === '' || log.log_code.toString().includes(filterCode);
                const matchUser = filterUser === 'all' || log.changed_by === filterUser;
                const matchTable = filterTable === 'all' || log.table_name === filterTable;
                const matchAction = filterAction === 'all' || log.action === filterAction;
                const matchSearch = searchTerm === '' ||
                    (log.history || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                    (log.table_name || '').toLowerCase().includes(searchTerm.toLowerCase());
                const matchStart = filterStartDate === '' || new Date(log.created_at) >= new Date(filterStartDate);
                const matchEnd = filterEndDate === '' || new Date(log.created_at) <= new Date(filterEndDate);
                return matchCode && matchUser && matchTable && matchAction && matchSearch && matchStart && matchEnd;
            })
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at)); // Decrescente
    }, [logs, filterCode, filterUser, filterTable, filterAction, searchTerm, filterStartDate, filterEndDate]);

    const users = useMemo(() => {
        const uniqueUsers = [];
        const seen = new Set();
        logs.forEach(log => {
            if (log.changed_by && !seen.has(log.changed_by)) {
                seen.add(log.changed_by);
                uniqueUsers.push({
                    id: log.changed_by,
                    name: log.profiles?.full_name || 'Desconhecido'
                });
            }
        });
        return uniqueUsers;
    }, [logs]);

    const tables = useMemo(() => {
        return [...new Set(logs.map(l => l.table_name))];
    }, [logs]);

    const clearFilters = () => {
        setFilterCode('');
        setFilterUser('all');
        setFilterTable('all');
        setFilterAction('all');
        setSearchTerm('');
        setFilterStartDate('');
        setFilterEndDate('');
    };

    return (
        <div className="w-full px-4 lg:px-8 space-y-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <History className="h-6 w-6 text-sky-600" />
                        Log's de Auditoria
                    </h2>
                    <p className="text-slate-500 text-sm">Acompanhe todas as inserções e alterações realizadas na base de dados.</p>
                </div>
                <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RotateCcw className="h-4 w-4 mr-2" />}
                    Atualizar Logs
                </Button>
            </div>

            {/* Painel de Filtros */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Buscar no histórico..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 h-9"
                        />
                    </div>

                    <Input
                        placeholder="Código (#)"
                        type="number"
                        value={filterCode}
                        onChange={(e) => setFilterCode(e.target.value)}
                        className="h-9"
                    />

                    <Select value={filterUser} onValueChange={setFilterUser}>
                        <SelectTrigger className="h-9">
                            <SelectValue placeholder="Usuário" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos os usuários</SelectItem>
                            {users.map(u => (
                                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={filterTable} onValueChange={setFilterTable}>
                        <SelectTrigger className="h-9">
                            <SelectValue placeholder="Tabela" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todas as tabelas</SelectItem>
                            {tables.map(t => (
                                <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <div className="flex gap-2">
                        <Select value={filterAction} onValueChange={setFilterAction}>
                            <SelectTrigger className="h-9 flex-1">
                                <SelectValue placeholder="Ação" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todas as ações</SelectItem>
                                <SelectItem value="INITIAL">Carga Inicial</SelectItem>
                                <SelectItem value="INSERT">Inclusões</SelectItem>
                                <SelectItem value="UPDATE">Alterações</SelectItem>
                                <SelectItem value="DELETE">Exclusões</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button variant="ghost" size="icon" onClick={clearFilters} title="Limpar filtros">
                            <FilterX className="h-4 w-4 text-slate-500" />
                        </Button>
                    </div>
                </div>

                {/* Filtros de data */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Data início</label>
                        <Input type="date" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} className="h-9" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Data fim</label>
                        <Input type="date" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} className="h-9" />
                    </div>
                </div>
            </div>

            {/* Tabela de Logs */}
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <Table>
                    <TableHeader className="bg-slate-50">
                        <TableRow>
                            <TableHead className="w-[100px]">Código</TableHead>
                            <TableHead className="w-[180px]">Data e Hora</TableHead>
                            <TableHead>Histórico e Movimentação</TableHead>
                            <TableHead className="w-[180px]">Usuário</TableHead>
                            <TableHead className="text-right w-[120px]">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-20">
                                    <Loader2 className="h-10 w-10 animate-spin mx-auto text-sky-500" />
                                    <p className="mt-2 text-slate-500">Buscando auditoria...</p>
                                </TableCell>
                            </TableRow>
                        ) : filteredLogs.length > 0 ? (
                            filteredLogs.map((log) => (
                                <TableRow key={log.id} className="hover:bg-slate-50/50">
                                    <TableCell className="font-mono font-bold text-sky-700">
                                        #{log.log_code}
                                    </TableCell>
                                    <TableCell className="text-slate-600 text-sm">
                                        {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-2">
                                                <Badge variant={
                                                    log.action === 'INITIAL' ? 'outline' :
                                                        log.action === 'INSERT' ? 'success' :
                                                            log.action === 'UPDATE' ? 'warning' : 'destructive'
                                                } className="text-[10px] uppercase font-bold py-0 h-4">
                                                    {log.action === 'INITIAL' ? 'CARGA INICIAL' :
                                                        log.action === 'INSERT' ? 'INCLUSÃO' :
                                                            log.action === 'UPDATE' ? 'ALTERAÇÃO' : 'EXCLUSÃO'}
                                                </Badge>
                                                <span className="font-medium text-slate-800">{log.history}</span>
                                            </div>
                                            <span className="text-[10px] text-slate-400 font-mono">
                                                ID: {log.record_id || 'N/A'} | Tabela: {log.table_name}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <div className="h-6 w-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] uppercase font-bold text-slate-500 overflow-hidden">
                                                {log.profiles?.avatar_url ? (
                                                    <img src={log.profiles.avatar_url} alt="Profile" className="h-full w-full object-cover" />
                                                ) : (log.profiles?.full_name?.[0] || 'S')}
                                            </div>
                                            <span className="text-sm text-slate-700">{log.profiles?.full_name || 'Sistema'}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 text-sky-600 hover:text-sky-700 hover:bg-sky-50"
                                                onClick={() => setSelectedLog(log)}
                                                title="Ver detalhes"
                                            >
                                                <Eye className="h-3.5 w-3.5 mr-1" />
                                                Detalhes
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 text-orange-600 hover:text-orange-700 hover:bg-orange-50 disabled:opacity-30"
                                                onClick={() => handleRevert(log)}
                                                disabled={reverting === log.id || log.history?.includes('[REVERTIDO') || log.action === 'INITIAL'}
                                                title={log.action === 'INITIAL' ? 'Registros de carga inicial não podem ser revertidos' : 'Reverter esta ação'}
                                            >
                                                {reverting === log.id ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <>
                                                        <RotateCcw className="h-3.5 w-3.5 mr-1" />
                                                        Reverter
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-20 text-slate-500">
                                    <Info className="h-10 w-10 mx-auto mb-2 opacity-20" />
                                    Nenhum log encontrado com os filtros aplicados.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Modal de Detalhes do Log */}
            <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
                <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <History className="h-5 w-5 text-sky-600" />
                            Detalhes do Log #{selectedLog?.log_code}
                        </DialogTitle>
                        <DialogDescription>
                            Informações completas da movimentação registrada.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedLog && (
                        <ScrollArea className="flex-1 pr-4">
                            <div className="space-y-4">
                                {/* Informações básicas */}
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div className="bg-slate-50 p-3 rounded-lg">
                                        <p className="text-slate-500 text-xs font-medium">Data/Hora</p>
                                        <p className="font-semibold text-slate-800">
                                            {format(new Date(selectedLog.created_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
                                        </p>
                                    </div>
                                    <div className="bg-slate-50 p-3 rounded-lg">
                                        <p className="text-slate-500 text-xs font-medium">Tipo de Ação</p>
                                        <Badge variant={
                                            selectedLog.action === 'INSERT' ? 'success' :
                                                selectedLog.action === 'UPDATE' ? 'warning' :
                                                    selectedLog.action === 'DELETE' ? 'destructive' : 'outline'
                                        } className="mt-1">
                                            {selectedLog.action === 'INSERT' ? 'Inclusão' :
                                                selectedLog.action === 'UPDATE' ? 'Alteração' :
                                                    selectedLog.action === 'DELETE' ? 'Exclusão' : 'Carga Inicial'}
                                        </Badge>
                                    </div>
                                    <div className="bg-slate-50 p-3 rounded-lg">
                                        <p className="text-slate-500 text-xs font-medium">Rotina/Tabela</p>
                                        <p className="font-semibold text-slate-800">
                                            {translateTableName(selectedLog.table_name)}
                                        </p>
                                        <p className="text-xs text-slate-400 font-mono">{selectedLog.table_name}</p>
                                    </div>
                                    <div className="bg-slate-50 p-3 rounded-lg">
                                        <p className="text-slate-500 text-xs font-medium">Usuário Responsável</p>
                                        <p className="font-semibold text-slate-800">
                                            {selectedLog.profiles?.full_name || 'Sistema'}
                                        </p>
                                    </div>
                                </div>

                                {/* Descrição */}
                                <div className="bg-sky-50 p-3 rounded-lg border border-sky-200">
                                    <p className="text-sky-700 text-xs font-medium mb-1">Descrição da Movimentação</p>
                                    <p className="text-sky-900 font-medium">{selectedLog.history || 'Sem descrição'}</p>
                                </div>

                                {/* Aluno relacionado (se aplicável) */}
                                {selectedLog.old_data?.student_id && (
                                    <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
                                        <p className="text-purple-700 text-xs font-medium mb-1">Aluno Relacionado</p>
                                        <p className="text-purple-900 font-semibold">
                                            {getProfileName(selectedLog.old_data.student_id) || selectedLog.old_data.student_id}
                                        </p>
                                    </div>
                                )}

                                {/* Mudanças realizadas (para UPDATE) */}
                                {selectedLog.action === 'UPDATE' && selectedLog.old_data && selectedLog.new_data && (
                                    <div className="space-y-2">
                                        <h4 className="font-semibold text-slate-800 flex items-center gap-2">
                                            <ChevronRight className="h-4 w-4" />
                                            Alterações Realizadas
                                        </h4>
                                        <div className="bg-white border rounded-lg overflow-hidden">
                                            <table className="w-full text-sm">
                                                <thead className="bg-slate-100">
                                                    <tr>
                                                        <th className="text-left p-2 font-medium text-slate-700">Campo</th>
                                                        <th className="text-left p-2 font-medium text-slate-700">Antes</th>
                                                        <th className="text-center p-2 w-8"></th>
                                                        <th className="text-left p-2 font-medium text-slate-700">Depois</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {Object.keys(selectedLog.new_data)
                                                        .filter(key => {
                                                            const oldVal = selectedLog.old_data?.[key];
                                                            const newVal = selectedLog.new_data[key];
                                                            return JSON.stringify(oldVal) !== JSON.stringify(newVal) &&
                                                                !['id', 'created_at', 'updated_at', 'last_log_code'].includes(key);
                                                        })
                                                        .map(key => (
                                                            <tr key={key} className="border-t">
                                                                <td className="p-2 font-medium text-slate-600">
                                                                    {translateField(key)}
                                                                </td>
                                                                <td className="p-2 text-red-600 bg-red-50">
                                                                    {formatValue(key, selectedLog.old_data?.[key])}
                                                                </td>
                                                                <td className="p-2 text-center">
                                                                    <ArrowRight className="h-4 w-4 text-slate-400 inline" />
                                                                </td>
                                                                <td className="p-2 text-green-600 bg-green-50">
                                                                    {formatValue(key, selectedLog.new_data[key])}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* Dados do registro (para INSERT/DELETE/INITIAL) */}
                                {(selectedLog.action === 'INSERT' || selectedLog.action === 'DELETE' || selectedLog.action === 'INITIAL') && (
                                    <div className="space-y-2">
                                        <h4 className="font-semibold text-slate-800 flex items-center gap-2">
                                            <ChevronRight className="h-4 w-4" />
                                            Dados do Registro
                                        </h4>
                                        <div className="bg-slate-50 p-3 rounded-lg border max-h-64 overflow-y-auto">
                                            <dl className="grid grid-cols-1 gap-2 text-sm">
                                                {Object.entries(selectedLog.action === 'INSERT'
                                                    ? (selectedLog.new_data || {})
                                                    : (selectedLog.old_data || {}))
                                                    .filter(([key]) => !['id', 'created_at', 'updated_at', 'last_log_code'].includes(key))
                                                    .map(([key, value]) => (
                                                        <div key={key} className="flex justify-between py-1 border-b border-slate-200 last:border-0">
                                                            <dt className="text-slate-500">{translateField(key)}</dt>
                                                            <dd className="font-medium text-slate-800">{formatValue(key, value)}</dd>
                                                        </div>
                                                    ))
                                                }
                                            </dl>
                                        </div>
                                    </div>
                                )}

                                {/* Status de reversão */}
                                {selectedLog.history?.includes('[REVERTIDO') && (
                                    <div className="bg-orange-50 p-3 rounded-lg border border-orange-200">
                                        <p className="text-orange-700 font-medium flex items-center gap-2">
                                            <RotateCcw className="h-4 w-4" />
                                            Este log já foi revertido
                                        </p>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    )}

                    <DialogFooter className="mt-4">
                        <Button variant="outline" onClick={() => setSelectedLog(null)}>
                            Fechar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default LogsTab;
