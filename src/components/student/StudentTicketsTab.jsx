import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import {
    Ticket,
    Plus,
    MessageSquare,
    Clock,
    CheckCircle2,
    XCircle,
    Calendar,
    UserX,
    HelpCircle,
    FileText,
    Headphones,
    Loader2
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Tipos de tickets disponibles para alumnos
const TICKET_TYPES = [
    {
        value: 'reagendamento',
        label: 'Reagendamento de Aula',
        icon: Calendar,
        description: 'Solicitar mudança de horário de aula'
    },
    {
        value: 'mudanca_professor',
        label: 'Mudança de Professor',
        icon: UserX,
        description: 'Solicitar troca de professor'
    },
    {
        value: 'duvida_fatura',
        label: 'Dúvida sobre Fatura',
        icon: FileText,
        description: 'Questões sobre pagamentos e faturas'
    },
    {
        value: 'duvida_geral',
        label: 'Dúvida Geral',
        icon: HelpCircle,
        description: 'Outras dúvidas sobre o curso'
    },
    {
        value: 'suporte_direto',
        label: 'Falar com Suporte',
        icon: Headphones,
        description: 'Contato direto com a equipe de suporte'
    }
];

const STATUS_CONFIG = {
    open: { label: 'Aberto', color: 'bg-sky-100 text-sky-700 border-sky-200', icon: Clock },
    in_progress: { label: 'Em Andamento', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: MessageSquare },
    resolved: { label: 'Resolvido', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
    closed: { label: 'Fechado', color: 'bg-slate-100 text-slate-700 border-slate-200', icon: XCircle }
};

export function StudentTicketsTab() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showNewTicket, setShowNewTicket] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Form state
    const [newTicket, setNewTicket] = useState({
        type: '',
        subject: '',
        description: ''
    });

    // Fetch tickets
    useEffect(() => {
        if (!user?.id) return;
        fetchTickets();
    }, [user?.id]);

    const fetchTickets = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('support_tickets')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setTickets(data || []);
        } catch (error) {
            console.error('Error fetching tickets:', error);
            toast({
                title: 'Erro',
                description: 'Não foi possível carregar os tickets',
                variant: 'destructive'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleCreateTicket = async () => {
        if (!newTicket.type || !newTicket.subject || !newTicket.description) {
            toast({
                title: 'Campos obrigatórios',
                description: 'Por favor, preencha todos os campos',
                variant: 'destructive'
            });
            return;
        }

        try {
            setSubmitting(true);

            const { data, error } = await supabase
                .from('support_tickets')
                .insert([
                    {
                        user_id: user.id,
                        type: newTicket.type,
                        subject: newTicket.subject,
                        description: newTicket.description,
                        status: 'open',
                        priority: 'medium'
                    }
                ])
                .select()
                .single();

            if (error) throw error;

            toast({
                title: 'Ticket criado!',
                description: 'Sua solicitação foi enviada com sucesso. Em breve entraremos em contato.'
            });

            setTickets([data, ...tickets]);
            setShowNewTicket(false);
            setNewTicket({ type: '', subject: '', description: '' });
        } catch (error) {
            console.error('Error creating ticket:', error);
            toast({
                title: 'Erro',
                description: 'Não foi possível criar o ticket',
                variant: 'destructive'
            });
        } finally {
            setSubmitting(false);
        }
    };

    const getTicketTypeInfo = (type) => {
        return TICKET_TYPES.find(t => t.value === type) || TICKET_TYPES[0];
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-6 border-b border-slate-100">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-violet-100 rounded-lg">
                                <Ticket className="h-5 w-5 text-violet-600" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-slate-800">Meus Tickets</h2>
                                <p className="text-sm text-slate-500">Gerencie suas solicitações de suporte</p>
                            </div>
                        </div>
                        <Button
                            onClick={() => setShowNewTicket(true)}
                            className="bg-gradient-to-r from-violet-500 to-purple-600"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Novo Ticket
                        </Button>
                    </div>
                </div>

                {/* Tickets List */}
                <div className="p-6">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
                        </div>
                    ) : tickets.length > 0 ? (
                        <div className="space-y-4">
                            {tickets.map((ticket, idx) => {
                                const typeInfo = getTicketTypeInfo(ticket.type);
                                const statusInfo = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open;
                                const StatusIcon = statusInfo.icon;
                                const TypeIcon = typeInfo.icon;

                                return (
                                    <motion.div
                                        key={ticket.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.05 }}
                                        className="p-5 rounded-xl border border-slate-200 hover:border-violet-200 hover:bg-violet-50/30 transition-all"
                                    >
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex items-start gap-3 flex-1">
                                                <div className="p-2 bg-violet-100 rounded-lg">
                                                    <TypeIcon className="h-5 w-5 text-violet-600" />
                                                </div>
                                                <div className="flex-1">
                                                    <h3 className="font-bold text-slate-800 mb-1">{ticket.subject}</h3>
                                                    <p className="text-sm text-slate-600 mb-2">{ticket.description}</p>
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <Badge variant="outline" className="text-xs">
                                                            {typeInfo.label}
                                                        </Badge>
                                                        <span className="text-xs text-slate-400">
                                                            {format(parseISO(ticket.created_at), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <Badge className={`${statusInfo.color} border flex items-center gap-1`}>
                                                <StatusIcon className="h-3 w-3" />
                                                {statusInfo.label}
                                            </Badge>
                                        </div>

                                        {ticket.admin_response && (
                                            <div className="mt-3 pt-3 border-t border-slate-100">
                                                <div className="bg-emerald-50 rounded-lg p-3">
                                                    <p className="text-xs font-semibold text-emerald-700 mb-1 flex items-center gap-1">
                                                        <MessageSquare className="h-3 w-3" />
                                                        Resposta do Suporte:
                                                    </p>
                                                    <p className="text-sm text-slate-700">{ticket.admin_response}</p>
                                                    {ticket.resolved_at && (
                                                        <p className="text-xs text-slate-500 mt-2">
                                                            Resolvido em {format(parseISO(ticket.resolved_at), "dd/MM/yyyy 'às' HH:mm")}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </motion.div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-12">
                            <div className="p-4 bg-slate-100 rounded-full inline-block mb-4">
                                <Ticket className="h-10 w-10 text-slate-300" />
                            </div>
                            <p className="font-medium text-slate-600 mb-2">Nenhum ticket aberto</p>
                            <p className="text-sm text-slate-400 mb-4">
                                Crie um ticket para entrar em contato com o suporte
                            </p>
                            <Button
                                onClick={() => setShowNewTicket(true)}
                                variant="outline"
                                className="border-violet-200 text-violet-600 hover:bg-violet-50"
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                Criar Primeiro Ticket
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {/* New Ticket Dialog */}
            <Dialog open={showNewTicket} onOpenChange={setShowNewTicket}>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Ticket className="h-5 w-5 text-violet-600" />
                            Novo Ticket de Suporte
                        </DialogTitle>
                        <DialogDescription>
                            Preencha os campos abaixo para abrir uma solicitação. Nossa equipe responderá em breve.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {/* Tipo de Ticket */}
                        <div className="space-y-2">
                            <Label htmlFor="ticket-type">Tipo de Solicitação *</Label>
                            <Select value={newTicket.type} onValueChange={(value) => setNewTicket({ ...newTicket, type: value })}>
                                <SelectTrigger id="ticket-type">
                                    <SelectValue placeholder="Selecione o tipo de solicitação" />
                                </SelectTrigger>
                                <SelectContent>
                                    {TICKET_TYPES.map((type) => {
                                        const Icon = type.icon;
                                        return (
                                            <SelectItem key={type.value} value={type.value}>
                                                <div className="flex items-center gap-2">
                                                    <Icon className="h-4 w-4 text-violet-600" />
                                                    <div>
                                                        <p className="font-medium">{type.label}</p>
                                                        <p className="text-xs text-slate-500">{type.description}</p>
                                                    </div>
                                                </div>
                                            </SelectItem>
                                        );
                                    })}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Assunto */}
                        <div className="space-y-2">
                            <Label htmlFor="ticket-subject">Assunto *</Label>
                            <input
                                id="ticket-subject"
                                type="text"
                                value={newTicket.subject}
                                onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
                                placeholder="Ex: Gostaria de reagendar minha aula de segunda-feira"
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                            />
                        </div>

                        {/* Descrição */}
                        <div className="space-y-2">
                            <Label htmlFor="ticket-description">Descrição *</Label>
                            <Textarea
                                id="ticket-description"
                                value={newTicket.description}
                                onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                                placeholder="Descreva sua solicitação com o máximo de detalhes possível..."
                                rows={5}
                                className="resize-none"
                            />
                            <p className="text-xs text-slate-500">
                                Quanto mais detalhes você fornecer, mais rápido poderemos ajudá-lo.
                            </p>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setShowNewTicket(false)}
                            disabled={submitting}
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleCreateTicket}
                            disabled={submitting}
                            className="bg-gradient-to-r from-violet-500 to-purple-600"
                        >
                            {submitting ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Enviando...
                                </>
                            ) : (
                                <>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Criar Ticket
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
