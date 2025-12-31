import { useState } from 'react';
import { useNotifications } from '@/hooks/useNotifications';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { History, Search, Filter, CheckCircle, XCircle, Archive, Eye } from 'lucide-react';
import { Loader2 } from 'lucide-react';

export default function HistoricoTab({ dashboardData }) {
    const { professorId } = dashboardData;
    const [typeFilter, setTypeFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');

    // Buscar notificações resolvidas/arquivadas
    const { notifications, loading } = useNotifications(professorId, {
        status: ['read', 'accepted', 'rejected', 'archived']
    });

    // Filtrar notificações
    const filteredNotifications = notifications.filter(n => {
        const matchesType = typeFilter === 'all' || n.type === typeFilter;
        const matchesStatus = statusFilter === 'all' || n.status === statusFilter;
        const matchesSearch =
            n.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            n.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            n.metadata?.student_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            n.metadata?.professor_name?.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesType && matchesStatus && matchesSearch;
    });

    // Badge de status
    const getStatusBadge = (status) => {
        const configs = {
            read: { variant: 'secondary', icon: Eye, label: 'Lido' },
            accepted: { variant: 'default', icon: CheckCircle, label: 'Aceito', className: 'bg-green-600' },
            rejected: { variant: 'destructive', icon: XCircle, label: 'Rejeitado' },
            archived: { variant: 'outline', icon: Archive, label: 'Arquivado' }
        };

        const config = configs[status] || configs.archived;
        const Icon = config.icon;

        return (
            <Badge variant={config.variant} className={config.className || ''}>
                <Icon className="h-3 w-3 mr-1" />
                {config.label}
            </Badge>
        );
    };

    // Badge de tipo
    const getTypeBadge = (type) => {
        const labels = {
            new_student_assignment: 'Novo Aluno',
            student_reallocation: 'Realocação',
            schedule_request: 'Agendamento',
            plan_expiring: 'Plano Expirado',
            general: 'Geral'
        };

        return <Badge variant="outline">{labels[type] || type}</Badge>;
    };

    return (
        <div className="space-y-4 p-4">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <History className="h-5 w-5" />
                        Histórico de Notificações
                    </CardTitle>
                    <p className="text-sm text-slate-600">
                        Todas as notificações completadas, aceitas, rejeitadas ou arquivadas
                    </p>
                </CardHeader>
                <CardContent>
                    {/* Filtros */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Buscar por nome, descrição..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9"
                            />
                        </div>

                        <Select value={typeFilter} onValueChange={setTypeFilter}>
                            <SelectTrigger>
                                <Filter className="h-4 w-4 mr-2" />
                                <SelectValue placeholder="Filtrar por tipo" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos os Tipos</SelectItem>
                                <SelectItem value="new_student_assignment">Novos Alunos</SelectItem>
                                <SelectItem value="student_reallocation">Realocações</SelectItem>
                                <SelectItem value="schedule_request">Solicitações de Agendamento</SelectItem>
                                <SelectItem value="plan_expiring">Planos Expirados</SelectItem>
                            </SelectContent>
                        </Select>

                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger>
                                <SelectValue placeholder="Filtrar por status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos os Status</SelectItem>
                                <SelectItem value="read">Lidos</SelectItem>
                                <SelectItem value="accepted">Aceitos</SelectItem>
                                <SelectItem value="rejected">Rejeitados</SelectItem>
                                <SelectItem value="archived">Arquivados</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Estatísticas */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <Card className="bg-slate-50">
                            <CardContent className="pt-4 pb-3">
                                <p className="text-xs text-slate-600 mb-1">Total</p>
                                <p className="text-2xl font-bold">{notifications.length}</p>
                            </CardContent>
                        </Card>
                        <Card className="bg-green-50">
                            <CardContent className="pt-4 pb-3">
                                <p className="text-xs text-green-700 mb-1">Aceitos</p>
                                <p className="text-2xl font-bold text-green-700">
                                    {notifications.filter(n => n.status === 'accepted').length}
                                </p>
                            </CardContent>
                        </Card>
                        <Card className="bg-red-50">
                            <CardContent className="pt-4 pb-3">
                                <p className="text-xs text-red-700 mb-1">Rejeitados</p>
                                <p className="text-2xl font-bold text-red-700">
                                    {notifications.filter(n => n.status === 'rejected').length}
                                </p>
                            </CardContent>
                        </Card>
                        <Card className="bg-blue-50">
                            <CardContent className="pt-4 pb-3">
                                <p className="text-xs text-blue-700 mb-1">Arquivados</p>
                                <p className="text-2xl font-bold text-blue-700">
                                    {notifications.filter(n => n.status === 'archived').length}
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Lista de notificações */}
                    <div className="space-y-3">
                        {loading ? (
                            <div className="flex justify-center py-12">
                                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                            </div>
                        ) : filteredNotifications.length === 0 ? (
                            <div className="text-center py-12">
                                <Archive className="h-12 w-12 mx-auto text-slate-300 mb-3" />
                                <p className="text-slate-500">
                                    {searchTerm || typeFilter !== 'all' || statusFilter !== 'all'
                                        ? 'Nenhuma notificação encontrada com os filtros aplicados'
                                        : 'Nenhuma notificação no histórico ainda'}
                                </p>
                            </div>
                        ) : (
                            filteredNotifications.map(notif => (
                                <div
                                    key={notif.id}
                                    className="p-4 border rounded-lg bg-white hover:shadow-md transition-shadow"
                                >
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h4 className="font-semibold text-lg">{notif.title}</h4>
                                            {getTypeBadge(notif.type)}
                                            {getStatusBadge(notif.status)}
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs text-slate-500">
                                                {format(new Date(notif.created_at), "dd/MM/yyyy", { locale: ptBR })}
                                            </p>
                                            <p className="text-xs text-slate-400">
                                                {format(new Date(notif.created_at), "HH:mm", { locale: ptBR })}
                                            </p>
                                        </div>
                                    </div>

                                    <p className="text-sm text-slate-600 mb-3">{notif.description}</p>

                                    {/* Informações extras de metadata */}
                                    {notif.metadata && Object.keys(notif.metadata).length > 0 && (
                                        <div className="bg-slate-50 p-3 rounded text-xs space-y-1">
                                            {notif.metadata.student_name && (
                                                <p><strong>Aluno:</strong> {notif.metadata.student_name}</p>
                                            )}
                                            {notif.metadata.professor_name && (
                                                <p><strong>Professor:</strong> {notif.metadata.professor_name}</p>
                                            )}
                                            {notif.metadata.old_professor_name && (
                                                <p><strong>De:</strong> {notif.metadata.old_professor_name}</p>
                                            )}
                                            {notif.metadata.professor_response && (
                                                <p>
                                                    <strong>Resposta do Professor:</strong>{' '}
                                                    <span className={notif.metadata.professor_response === 'accepted' ? 'text-green-600' : 'text-red-600'}>
                                                        {notif.metadata.professor_response === 'accepted' ? 'Aceito' : 'Rejeitado'}
                                                    </span>
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    {notif.resolved_at && (
                                        <p className="text-xs text-slate-400 mt-2">
                                            Resolvido em: {format(new Date(notif.resolved_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                        </p>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
