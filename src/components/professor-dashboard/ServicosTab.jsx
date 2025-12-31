// Arquivo: src/components/professor-dashboard/ServicosTab.jsx
// Sistema de tickets de serviço para professores

import React, { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, Plus, Send, Headphones, Search, Filter, X } from 'lucide-react';
import { ptBR } from 'date-fns/locale';

// Tipos de solicitação (baseado na imagem do usuário, removendo os taxados)
const TICKET_TYPES = [
    { value: 'transfer_student', label: 'Transferência de Aluno', icon: '👥' },
    { value: 'temporary_replacement', label: 'Substituição Temporária', icon: '🔄' },
    { value: 'system_question', label: 'Queixa sobre o Sistema', icon: '💬' },
    { value: 'reschedule_class', label: 'Reagendar Aula', icon: '📅' },
    { value: 'change_student_schedule', label: 'Mudança de Horário do Aluno', icon: '⏰' },
    { value: 'schedule_unavailability', label: 'Indisponibilidade de horários', icon: '🚫' },
    { value: 'confirm_student_info', label: 'Confirmar informações de aluno', icon: '✓' }
];

// Status dos tickets
const TICKET_STATUS = {
    pending: { label: 'Pendente', color: 'bg-yellow-500', textColor: 'text-yellow-900', bgLight: 'bg-yellow-50' },
    open: { label: 'Aberta', color: 'bg-blue-500', textColor: 'text-blue-900', bgLight: 'bg-blue-50' },
    awaiting_user: { label: 'Aguardando Solicitante', color: 'bg-orange-500', textColor: 'text-orange-900', bgLight: 'bg-orange-50' },
    closed: { label: 'Encerrada', color: 'bg-green-500', textColor: 'text-green-900', bgLight: 'bg-green-50' }
};

const StatusBadge = ({ status }) => {
    const config = TICKET_STATUS[status] || TICKET_STATUS.pending;
    return (
        <Badge className={`${config.color} hover:${config.color} text-white`}>
            {config.label}
        </Badge>
    );
};

// Dialog para criar novo ticket
const CreateTicketDialog = ({ isOpen, onClose, onCreated, professorId }) => {
    const { toast } = useToast();
    const [ticketType, setTicketType] = useState('');
    const [initialMessage, setInitialMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!ticketType || !initialMessage.trim()) {
            toast({
                variant: 'destructive',
                title: 'Campos obrigatórios',
                description: 'Selecione um tipo e escreva uma mensagem'
            });
            return;
        }

        setIsSubmitting(true);

        try {
            // Criar ticket
            const { data: ticket, error: ticketError } = await supabase
                .from('service_tickets')
                .insert({
                    requester_id: professorId,
                    type: ticketType,
                    status: 'pending'
                })
                .select()
                .single();

            if (ticketError) throw ticketError;

            // Adicionar mensagem inicial
            const { error: messageError } = await supabase
                .from('service_ticket_messages')
                .insert({
                    ticket_id: ticket.id,
                    user_id: professorId,
                    message: initialMessage
                });

            if (messageError) throw messageError;

            toast({
                title: 'Ticket criado!',
                description: `Seu ticket ${ticket.ticket_number} foi criado com sucesso`
            });

            setTicketType('');
            setInitialMessage('');
            onCreated();
            onClose();
        } catch (error) {
            console.error('Error creating ticket:', error);
            toast({
                variant: 'destructive',
                title: 'Erro ao criar ticket',
                description: error.message
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[550px]">
                <DialogHeader>
                    <DialogTitle>Novo Ticket de Serviço</DialogTitle>
                    <DialogDescription>
                        Descreva sua solicitação e nossa equipe entrará em contato
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div>
                        <Label>Tipo de Solicitação *</Label>
                        <Select value={ticketType} onValueChange={setTicketType}>
                            <SelectTrigger className="mt-1">
                                <SelectValue placeholder="Selecionar tipo da solicitação..." />
                            </SelectTrigger>
                            <SelectContent>
                                {TICKET_TYPES.map(type => (
                                    <SelectItem key={type.value} value={type.value}>
                                        <span className="flex items-center gap-2">
                                            <span>{type.icon}</span>
                                            <span>{type.label}</span>
                                        </span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <Label>Mensagem *</Label>
                        <Textarea
                            placeholder="Descreva detalhadamente sua solicitação..."
                            value={initialMessage}
                            onChange={(e) => setInitialMessage(e.target.value)}
                            rows={6}
                            className="mt-1"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                            {initialMessage.length}/500 caracteres
                        </p>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={isSubmitting || !ticketType || !initialMessage.trim()}
                        className="bg-purple-600 hover:bg-purple-700"
                    >
                        {isSubmitting ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Criando...</>
                        ) : (
                            <><Plus className="mr-2 h-4 w-4" /> Criar Ticket</>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

// Dialog de detalhes do ticket
const TicketDetailsDialog = ({ ticket, isOpen, onClose, onUpdated, isSuperadmin, currentUserId }) => {
    const { toast } = useToast();
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [newStatus, setNewStatus] = useState(ticket?.status || 'pending');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoadingMessages, setIsLoadingMessages] = useState(true);

    useEffect(() => {
        if (ticket && isOpen) {
            loadMessages();
            setNewStatus(ticket.status);
        }
    }, [ticket, isOpen]);

    const loadMessages = async () => {
        if (!ticket) return;

        setIsLoadingMessages(true);
        const { data, error } = await supabase
            .from('service_ticket_messages')
            .select(`
                *,
                user:profiles(full_name, avatar_url, role)
            `)
            .eq('ticket_id', ticket.id)
            .order('created_at', { ascending: true });

        if (!error) {
            setMessages(data || []);
        }
        setIsLoadingMessages(false);
    };

    const handleSendMessage = async () => {
        if (!newMessage.trim()) return;

        setIsSubmitting(true);
        try {
            const { error } = await supabase
                .from('service_ticket_messages')
                .insert({
                    ticket_id: ticket.id,
                    user_id: currentUserId,
                    message: newMessage.trim()
                });

            if (error) throw error;

            setNewMessage('');
            loadMessages();

            toast({
                title: 'Mensagem enviada!',
                description: 'Sua mensagem foi adicionada ao ticket'
            });
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

    const handleUpdateStatus = async () => {
        if (newStatus === ticket.status) return;

        try {
            const { error } = await supabase
                .from('service_tickets')
                .update({
                    status: newStatus,
                    closed_at: newStatus === 'closed' ? new Date().toISOString() : null
                })
                .eq('id', ticket.id);

            if (error) throw error;

            toast({
                title: 'Status atualizado!',
                description: `Ticket alterado para: ${TICKET_STATUS[newStatus].label}`
            });

            onUpdated();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Erro ao atualizar status',
                description: error.message
            });
        }
    };

    if (!ticket) return null;

    const typeInfo = TICKET_TYPES.find(t => t.value === ticket.type);
    const isClosed = ticket.status === 'closed';

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                                <AvatarImage src={ticket.requester?.avatar_url} />
                                <AvatarFallback className="bg-purple-100 text-purple-600">
                                    {ticket.requester?.full_name?.[0] || 'U'}
                                </AvatarFallback>
                            </Avatar>
                            <div>
                                <DialogTitle>{ticket.requester?.full_name}</DialogTitle>
                                <p className="text-sm text-slate-500 font-mono">{ticket.ticket_number}</p>
                            </div>
                        </div>
                        <StatusBadge status={ticket.status} />
                    </div>
                </DialogHeader>

                {/* Informações do Ticket */}
                <div className="grid grid-cols-2 gap-4 py-4 border-t border-b bg-slate-50 px-4 rounded-lg">
                    <div>
                        <Label className="text-xs text-slate-500">Tipo de Solicitação</Label>
                        <p className="font-medium flex items-center gap-2 mt-1">
                            <span>{typeInfo?.icon}</span>
                            <span>{typeInfo?.label || ticket.type}</span>
                        </p>
                    </div>
                    <div>
                        <Label className="text-xs text-slate-500">Data de Criação</Label>
                        <p className="font-medium mt-1">
                            {format(parseISO(ticket.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                    </div>
                </div>

                {/* Alterar Status (Admin Only) */}
                {isSuperadmin && !isClosed && (
                    <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                        <Label className="font-semibold text-blue-900">Gerenciar Status</Label>
                        <div className="flex gap-2 mt-2">
                            <Select value={newStatus} onValueChange={setNewStatus}>
                                <SelectTrigger className="w-[280px] bg-white">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="pending">🟡 Pendente</SelectItem>
                                    <SelectItem value="open">🔵 Aberta</SelectItem>
                                    <SelectItem value="awaiting_user">🟠 Aguardando Solicitante</SelectItem>
                                    <SelectItem value="closed">🟢 Encerrada</SelectItem>
                                </SelectContent>
                            </Select>
                            <Button
                                onClick={handleUpdateStatus}
                                disabled={newStatus === ticket.status}
                                className="bg-blue-600 hover:bg-blue-700"
                            >
                                Atualizar Status
                            </Button>
                        </div>
                    </div>
                )}

                {/* Histórico de Mensagens */}
                <div className="space-y-4 mt-4">
                    <h4 className="font-semibold text-slate-700 flex items-center gap-2">
                        <Headphones className="h-4 w-4" />
                        Histórico de Comunicação
                    </h4>

                    {isLoadingMessages ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
                        </div>
                    ) : messages.length === 0 ? (
                        <div className="text-center py-8 text-slate-500">
                            <p>Nenhuma mensagem ainda</p>
                        </div>
                    ) : (
                        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                            {messages.map(msg => {
                                const isAdmin = msg.user?.role === 'superadmin';
                                const isCurrentUser = msg.user_id === currentUserId;

                                return (
                                    <div
                                        key={msg.id}
                                        className={`flex gap-3 ${isCurrentUser ? 'flex-row-reverse' : ''}`}
                                    >
                                        <Avatar className="h-8 w-8 flex-shrink-0">
                                            <AvatarImage src={msg.user?.avatar_url} />
                                            <AvatarFallback className={isAdmin ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}>
                                                {msg.user?.full_name?.[0] || 'U'}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className={`flex-1 max-w-[80%] ${isCurrentUser ? 'items-end' : ''}`}>
                                            <div className={`${isCurrentUser ? 'bg-purple-100' : 'bg-slate-100'} p-3 rounded-lg`}>
                                                <div className="flex items-center justify-between gap-2 mb-1">
                                                    <span className="font-medium text-sm">
                                                        {isAdmin ? '👨‍💼 ' : ''}{msg.user?.full_name}
                                                    </span>
                                                    <span className="text-xs text-slate-500">
                                                        {format(parseISO(msg.created_at), 'dd/MM HH:mm')}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-slate-700 whitespace-pre-wrap">{msg.message}</p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Adicionar Nova Mensagem */}
                {!isClosed ? (
                    <div className="flex gap-2 pt-4 border-t">
                        <Textarea
                            placeholder="Digite sua mensagem..."
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            rows={3}
                            className="flex-1"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSendMessage();
                                }
                            }}
                        />
                        <Button
                            onClick={handleSendMessage}
                            disabled={!newMessage.trim() || isSubmitting}
                            className="bg-purple-600 hover:bg-purple-700 self-end"
                        >
                            {isSubmitting ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Send className="h-4 w-4" />
                            )}
                        </Button>
                    </div>
                ) : (
                    <div className="bg-green-50 border border-green-200 p-4 rounded-lg text-center">
                        <p className="text-sm text-green-800 font-medium">
                            ✓ Este ticket está encerrado
                        </p>
                        <p className="text-xs text-green-700 mt-1">
                            Para reabrir, entre em contato com a administração
                        </p>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};

// Componente principal
const ServicosTab = ({ dashboardData }) => {
    const { toast } = useToast();
    const [tickets, setTickets] = useState([]);
    const [filteredTickets, setFilteredTickets] = useState([]);
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    const isSuperadmin = dashboardData?.isSuperadmin || false;
    const professorId = dashboardData?.professorId;

    useEffect(() => {
        fetchTickets();
    }, [professorId, isSuperadmin]);

    useEffect(() => {
        filterTickets();
    }, [tickets, searchTerm, statusFilter]);

    const fetchTickets = async () => {
        if (!professorId) return;

        setLoading(true);
        try {
            let query = supabase
                .from('service_tickets')
                .select(`
                    *,
                    requester:profiles!requester_id(full_name, avatar_url, student_code),
                    assigned:profiles!assigned_to(full_name)
                `)
                .order('created_at', { ascending: false });

            if (!isSuperadmin) {
                query = query.eq('requester_id', professorId);
            }

            const { data, error } = await query;

            if (error) throw error;

            setTickets(data || []);
        } catch (error) {
            console.error('Error fetching tickets:', error);
            toast({
                variant: 'destructive',
                title: 'Erro ao carregar tickets',
                description: error.message
            });
        } finally {
            setLoading(false);
        }
    };

    const filterTickets = () => {
        let filtered = tickets;

        // Filtro de busca
        if (searchTerm) {
            filtered = filtered.filter(ticket => {
                const typeLabel = TICKET_TYPES.find(t => t.value === ticket.type)?.label || '';
                return (
                    ticket.ticket_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    typeLabel.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    ticket.requester?.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
                );
            });
        }

        // Filtro de status
        if (statusFilter !== 'all') {
            filtered = filtered.filter(ticket => ticket.status === statusFilter);
        }

        setFilteredTickets(filtered);
    };

    const handleViewDetails = async (ticket) => {
        setSelectedTicket(ticket);
        setIsDetailsDialogOpen(true);
    };

    const handleTicketUpdated = () => {
        fetchTickets();
        if (selectedTicket) {
            // Reload ticket details
            const updated = tickets.find(t => t.id === selectedTicket.id);
            if (updated) {
                setSelectedTicket(updated);
            }
        }
    };

    // Contagem por status
    const statusCounts = {
        all: tickets.length,
        pending: tickets.filter(t => t.status === 'pending').length,
        open: tickets.filter(t => t.status === 'open').length,
        awaiting_user: tickets.filter(t => t.status === 'awaiting_user').length,
        closed: tickets.filter(t => t.status === 'closed').length
    };

    return (
        <div className="w-full px-4 lg:px-8">
            <div className="bg-white p-6 rounded-lg shadow-sm">
                {/* Header */}
                <div className="mb-6">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div>
                            <h2 className="text-2xl font-bold text-slate-800">Serviços</h2>
                            <p className="text-sm text-slate-500">
                                {isSuperadmin
                                    ? 'Gerenciar tickets de solicitação de todos os professores'
                                    : 'Sistema de solicitações e suporte para professores'
                                }
                            </p>
                        </div>
                        {!isSuperadmin && (
                            <Button
                                onClick={() => setIsCreateDialogOpen(true)}
                                className="bg-purple-600 hover:bg-purple-700"
                            >
                                <Plus className="mr-2 h-4 w-4" />
                                Novo Ticket
                            </Button>
                        )}
                    </div>

                    {/* Badges de contagem */}
                    <div className="flex flex-wrap gap-2 mt-4">
                        <Badge
                            variant={statusFilter === 'all' ? 'default' : 'outline'}
                            className="cursor-pointer"
                            onClick={() => setStatusFilter('all')}
                        >
                            Todos: {statusCounts.all}
                        </Badge>
                        <Badge
                            variant={statusFilter === 'pending' ? 'default' : 'outline'}
                            className="cursor-pointer bg-yellow-100 text-yellow-800 border-yellow-300"
                            onClick={() => setStatusFilter('pending')}
                        >
                            Pendentes: {statusCounts.pending}
                        </Badge>
                        <Badge
                            variant={statusFilter === 'open' ? 'default' : 'outline'}
                            className="cursor-pointer bg-blue-100 text-blue-800 border-blue-300"
                            onClick={() => setStatusFilter('open')}
                        >
                            Abertas: {statusCounts.open}
                        </Badge>
                        <Badge
                            variant={statusFilter === 'awaiting_user' ? 'default' : 'outline'}
                            className="cursor-pointer bg-orange-100 text-orange-800 border-orange-300"
                            onClick={() => setStatusFilter('awaiting_user')}
                        >
                            Aguardando: {statusCounts.awaiting_user}
                        </Badge>
                        <Badge
                            variant={statusFilter === 'closed' ? 'default' : 'outline'}
                            className="cursor-pointer bg-green-100 text-green-800 border-green-300"
                            onClick={() => setStatusFilter('closed')}
                        >
                            Encerradas: {statusCounts.closed}
                        </Badge>
                    </div>
                </div>

                {/* Barra de pesquisa */}
                <div className="mb-4 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                        placeholder="Buscar por número, tipo ou solicitante..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 pr-10"
                    />
                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>

                {/* Tabela de Tickets */}
                <div className="border rounded-lg overflow-hidden">
                    <Table>
                        <TableHeader className="bg-slate-50">
                            <TableRow>
                                <TableHead>Número</TableHead>
                                {isSuperadmin && <TableHead>Solicitante</TableHead>}
                                <TableHead>Tipo</TableHead>
                                <TableHead>Data de Criação</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={isSuperadmin ? 6 : 5} className="text-center py-8">
                                        <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                                    </TableCell>
                                </TableRow>
                            ) : filteredTickets.length > 0 ? (
                                filteredTickets.map(ticket => {
                                    const typeInfo = TICKET_TYPES.find(t => t.value === ticket.type);

                                    return (
                                        <TableRow key={ticket.id} className="hover:bg-slate-50">
                                            <TableCell className="font-mono text-sm font-medium text-purple-600">
                                                {ticket.ticket_number}
                                            </TableCell>
                                            {isSuperadmin && (
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <Avatar className="h-7 w-7">
                                                            <AvatarImage src={ticket.requester?.avatar_url} />
                                                            <AvatarFallback className="text-xs">
                                                                {ticket.requester?.full_name?.[0]}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <div>
                                                            <p className="text-sm font-medium">{ticket.requester?.full_name}</p>
                                                            <p className="text-xs text-slate-500">{ticket.requester?.student_code}</p>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                            )}
                                            <TableCell>
                                                <span className="flex items-center gap-2">
                                                    <span>{typeInfo?.icon}</span>
                                                    <span className="text-sm">{typeInfo?.label || ticket.type}</span>
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-sm text-slate-600">
                                                {format(parseISO(ticket.created_at), 'dd/MM/yyyy HH:mm')}
                                            </TableCell>
                                            <TableCell>
                                                <StatusBadge status={ticket.status} />
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleViewDetails(ticket)}
                                                    className="text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                                                >
                                                    Ver detalhes
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={isSuperadmin ? 6 : 5} className="text-center py-12">
                                        <div className="flex flex-col items-center gap-3">
                                            <Headphones className="h-12 w-12 text-slate-300" />
                                            <p className="text-slate-500 font-medium">
                                                {searchTerm || statusFilter !== 'all'
                                                    ? 'Nenhum ticket encontrado com os filtros aplicados'
                                                    : 'Nenhum ticket criado ainda'
                                                }
                                            </p>
                                            {!isSuperadmin && !searchTerm && statusFilter === 'all' && (
                                                <Button
                                                    onClick={() => setIsCreateDialogOpen(true)}
                                                    variant="outline"
                                                    className="mt-2"
                                                >
                                                    <Plus className="mr-2 h-4 w-4" />
                                                    Criar primeiro ticket
                                                </Button>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* Dialogs */}
                <CreateTicketDialog
                    isOpen={isCreateDialogOpen}
                    onClose={() => setIsCreateDialogOpen(false)}
                    onCreated={fetchTickets}
                    professorId={professorId}
                />

                <TicketDetailsDialog
                    ticket={selectedTicket}
                    isOpen={isDetailsDialogOpen}
                    onClose={() => setIsDetailsDialogOpen(false)}
                    onUpdated={handleTicketUpdated}
                    isSuperadmin={isSuperadmin}
                    currentUserId={professorId}
                />
            </div>
        </div>
    );
};

export default ServicosTab;
