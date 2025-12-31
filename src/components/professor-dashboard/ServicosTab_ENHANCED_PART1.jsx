// Arquivo: src/components/professor-dashboard/ServicosTab.jsx
// Sistema de tickets de serviço para professores - VERSÃO COMPLETA COM MELHORIAS

import React, { useState, useEffect, useCallback } from 'react';
import { format, parseISO, differenceInHours } from 'date-fns';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, Select Item, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Loader2, Plus, Send, Headphones, Search, X, Upload, Paperclip, Download, FileText, Image as ImageIcon, File, Trash2, AlertCircle } from 'lucide-react';
import { ptBR } from 'date-fns/locale';

// Tipos de solicitação
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

// Prioridades
const PRIORITIES = {
    low: { label: 'Baixa', color: 'bg-green-500', icon: '⬇️', hours: 48 },
    medium: { label: 'Média', color: 'bg-yellow-500', icon: '➡️', hours: 24 },
    high: { label: 'Alta', color: 'bg-orange-500', icon: '⬆️', hours: 12 },
    urgent: { label: 'Urgente', color: 'bg-red-500', icon: '🔥', hours: 4 }
};

const StatusBadge = ({ status }) => {
    const config = TICKET_STATUS[status] || TICKET_STATUS.pending;
    return <Badge className={`${config.color} hover:${config.color} text-white`}>{config.label}</Badge>;
};

const PriorityBadge = ({ priority }) => {
    const config = PRIORITIES[priority] || PRIORITIES.medium;
    return <Badge className={`${config.color} text-white`}>{config.icon} {config.label}</Badge>;
};

// SLA Progress Indicator
const SLAIndicator = ({ ticket }) => {
    if (ticket.status === 'closed' || ticket.first_response_at) return null;

    const hoursSinceCreated = differenceInHours(new Date(), parseISO(ticket.created_at));
    const expectedHours = ticket.expected_response_hours || PRIORITIES[ticket.priority]?.hours || 24;
    const progress = (hoursSinceCreated / expectedHours) * 100;
    const isViolated = progress > 100 || ticket.sla_violated;

    return (
        <div className="space-y-1">
            <div className="flex justify-between text-xs">
                <span className={isViolated ? 'text-red-600 font-medium' : 'text-slate-600'}>
                    {isViolated ? '⚠️ SLA Violado' : 'Aguardando resposta'}
                </span>
                <span className="text-slate-500">
                    {hoursSinceCreated}h / {expectedHours}h
                </span>
            </div>
            <Progress value={Math.min(progress, 100)} className={`h-1.5 ${isViolated ? '[&>div]:bg-red-500' : ''}`} />
        </div>
    );
};

// File Upload Component
const FileUploadButton = ({ ticketId, onUploadComplete, disabled }) => {
    const { toast } = useToast();
    const [uploading, setUploading] = useState(false);
    const fileInputRef = React.useRef(null);

    const handleFileSelect = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file size (5MB)
        if (file.size > 5242880) {
            toast({
                variant: 'destructive',
                title: 'Arquivo muito grande',
                description: 'O arquivo deve ter no máximo 5MB'
            });
            return;
        }

        setUploading(true);

        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${ticketId}/${Date.now()}.${fileExt}`;

            // Upload to storage
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('ticket-attachments')
                .upload(fileName, file);

            if (uploadError) throw uploadError;

            // Save to database
            const { error: dbError } = await supabase
                .from('ticket_attachments')
                .insert({
                    ticket_id: ticketId,
                    file_name: file.name,
                    file_path: uploadData.path,
                    file_size: file.size,
                    file_type: file.type,
                    uploaded_by: (await supabase.auth.getUser()).data.user.id
                });

            if (dbError) throw dbError;

            toast({
                title: 'Arquivo anexado!',
                description: 'O arquivo foi enviado com sucesso'
            });

            onUploadComplete?.();
        } catch (error) {
            console.error('Upload error:', error);
            toast({
                variant: 'destructive',
                title: 'Erro ao enviar arquivo',
                description: error.message
            });
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return (
        <>
            <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                accept="image/*,.pdf,.doc,.docx"
                className="hidden"
                disabled={disabled || uploading}
            />
            <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled || uploading}
            >
                {uploading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando...</>
                ) : (
                    <><Paperclip className="mr-2 h-4 w-4" /> Anexar</>
                )}
            </Button>
        </>
    );
};

// Attachments List
const AttachmentsList = ({ ticketId, canDelete }) => {
    const { toast } = useToast();
    const [attachments, setAttachments] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadAttachments();
    }, [ticketId]);

    const loadAttachments = async () => {
        const { data, error } = await supabase
            .from('ticket_attachments')
            .select(`
                *,
                uploader:profiles!uploaded_by(full_name)
            `)
            .eq('ticket_id', ticketId)
            .order('created_at', { ascending: true });

        if (!error) {
            setAttachments(data || []);
        }
        setLoading(false);
    };

    const handleDownload = async (attachment) => {
        const { data, error } = await supabase.storage
            .from('ticket-attachments')
            .download(attachment.file_path);

        if (error) {
            toast({
                variant: 'destructive',
                title: 'Erro ao baixar arquivo'
            });
            return;
        }

        const url = URL.createObjectURL(data);
        const a = document.createElement('a');
        a.href = url;
        a.download = attachment.file_name;
        a.click();
    };

    const handleDelete = async (attachmentId) => {
        if (!window.confirm('Deseja remover este anexo?')) return;

        const { error } = await supabase
            .from('ticket_attachments')
            .delete()
            .eq('id', attachmentId);

        if (error) {
            toast({
                variant: 'destructive',
                title: 'Erro ao remover anexo'
            });
        } else {
            toast({ title: 'Anexo removido' });
            loadAttachments();
        }
    };

    const getFileIcon = (fileType) => {
        if (fileType.startsWith('image/')) return <ImageIcon className="h-4 w-4" />;
        if (fileType === 'application/pdf') return <FileText className="h-4 w-4" />;
        return <File className="h-4 w-4" />;
    };

    if (loading) return <div className="text-sm text-slate-500">Carregando anexos...</div>;
    if (attachments.length === 0) return null;

    return (
        <div className="space-y-2">
            <Label className="text-xs text-slate-500">Anexos ({attachments.length})</Label>
            <div className="space-y-1">
                {attachments.map(att => (
                    <div key={att.id} className="flex items-center gap-2 p-2 bg-slate-50 rounded border">
                        {getFileIcon(att.file_type)}
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{att.file_name}</p>
                            <p className="text-xs text-slate-500">
                                {(att.file_size / 1024).toFixed(1)} KB • {att.uploader?.full_name}
                            </p>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownload(att)}
                        >
                            <Download className="h-4 w-4" />
                        </Button>
                        {canDelete && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(att.id)}
                            >
                                <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

// Template Selector (Admin Only)
const TemplateSelector = ({ ticketType, onSelect }) => {
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadTemplates();
    }, [ticketType]);

    const loadTemplates = async () => {
        const { data, error } = await supabase
            .from('ticket_response_templates')
            .select('*')
            .eq('is_active', true)
            .or(`category.eq.${ticketType},category.is.null`)
            .order('title');

        if (!error) {
            setTemplates(data || []);
        }
        setLoading(false);
    };

    if (loading) return <Button variant="outline" size="sm" disabled><Loader2 className="h-4 w-4 animate-spin" /></Button>;
    if (templates.length === 0) return null;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                    <FileText className="mr-2 h-4 w-4" />
                    Templates ({templates.length})
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-80 max-h-96 overflow-y-auto">
                <DropdownMenuLabel>Selecionar Template</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {templates.map(template => (
                    <DropdownMenuItem
                        key={template.id}
                        onClick={() => onSelect(template.content)}
                        className="cursor-pointer"
                    >
                        <div className="space-y-1">
                            <p className="font-medium">{template.title}</p>
                            <p className="text-xs text-slate-500 line-clamp-2">
                                {template.content.substring(0, 100)}...
                            </p>
                        </div>
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
};

// Dialog para criar novo ticket
const CreateTicketDialog = ({ isOpen, onClose, onCreated, professorId }) => {
    const { toast } = useToast();
    const [ticketType, setTicketType] = useState('');
    const [priority, setPriority] = useState('medium');
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
            const { data: ticket, error: ticketError } = await supabase
                .from('service_tickets')
                .insert({
                    requester_id: professorId,
                    type: ticketType,
                    priority: priority,
                    status: 'pending'
                })
                .select()
                .single();

            if (ticketError) throw ticketError;

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
            setPriority('medium');
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
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Novo Ticket de Serviço</DialogTitle>
                    <DialogDescription>
                        Descreva sua solicitação e nossa equipe entrará em contato
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Tipo de Solicitação *</Label>
                            <Select value={ticketType} onValueChange={setTicketType}>
                                <SelectTrigger className="mt-1">
                                    <SelectValue placeholder="Selecionar tipo..." />
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
                            <Label>Prioridade *</Label>
                            <Select value={priority} onValueChange={setPriority}>
                                <SelectTrigger className="mt-1">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.entries(PRIORITIES).map(([key, config]) => (
                                        <SelectItem key={key} value={key}>
                                            {config.icon} {config.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-slate-500 mt-1">
                                Tempo esperado: {PRIORITIES[priority].hours}h
                            </p>
                        </div>
                    </div>

                    <div>
                        <Label>Mensagem *</Label>
                        <Textarea
                            placeholder="Descreva detalhadamente sua solicitação..."
                            value={initialMessage}
                            onChange={(e) => setInitialMessage(e.target.value)}
                            rows={6}
                            className="mt-1"
                            maxLength={1000}
                        />
                        <p className="text-xs text-slate-500 mt-1">
                            {initialMessage.length}/1000 caracteres
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

// ** CONTINUA NA PARTE 2 devido ao limite de caracteres **
