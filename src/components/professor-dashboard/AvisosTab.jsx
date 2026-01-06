import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Megaphone, Calendar, User, Clock, Plus, Trash2, Loader2, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';

const ANNOUNCEMENT_TYPES = [
    { value: 'Manutenção', label: 'Manutenção', color: 'bg-rose-50 text-rose-700 border-rose-200' },
    { value: 'Pedagógico', label: 'Pedagógico', color: 'bg-blue-50 text-blue-700 border-blue-200' },
    { value: 'Geral', label: 'Geral', color: 'bg-slate-50 text-slate-700 border-slate-200' },
    { value: 'Financeiro', label: 'Financeiro', color: 'bg-green-50 text-green-700 border-green-200' },
    { value: 'Importante', label: 'Importante', color: 'bg-amber-50 text-amber-700 border-amber-200' },
];

const CreateAnnouncementDialog = ({ isOpen, onClose, onCreated, professorName }) => {
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        content: '',
        type: 'Geral'
    });

    const handleSubmit = async () => {
        if (!formData.title.trim() || !formData.content.trim()) {
            toast({
                variant: 'destructive',
                title: 'Campos obrigatórios',
                description: 'Preencha o título e o conteúdo do aviso.'
            });
            return;
        }

        setIsSubmitting(true);
        try {
            const { error } = await supabase
                .from('professor_announcements')
                .insert({
                    title: formData.title,
                    content: formData.content,
                    type: formData.type,
                    author: professorName || 'Administração',
                    is_active: true
                });

            if (error) throw error;

            toast({ title: 'Aviso publicado com sucesso!' });
            onCreated();
            onClose();
            setFormData({ title: '', content: '', type: 'Geral' });
        } catch (error) {
            console.error('Erro ao criar aviso:', error);
            toast({
                variant: 'destructive',
                title: 'Erro ao publicar',
                description: error.message
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Novo Comunicado</DialogTitle>
                    <DialogDescription>
                        Crie um novo aviso para todos os professores.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Título</Label>
                        <Input
                            placeholder="Ex: Atualização do Sistema"
                            value={formData.title}
                            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Tipo</Label>
                        <Select
                            value={formData.type}
                            onValueChange={(v) => setFormData(prev => ({ ...prev, type: v }))}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {ANNOUNCEMENT_TYPES.map(t => (
                                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Conteúdo</Label>
                        <Textarea
                            placeholder="Digite o conteúdo do aviso..."
                            rows={5}
                            value={formData.content}
                            onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancelar</Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Publicar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const AvisosTab = ({ dashboardData }) => {
    const { toast } = useToast();
    const [avisos, setAvisos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isCreateOpen, setIsCreateOpen] = useState(false);

    const isSuperadmin = dashboardData?.isSuperadmin || false;

    const fetchAvisos = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('professor_announcements')
                .select('*')
                .eq('is_active', true)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setAvisos(data || []);
        } catch (error) {
            console.error('Erro ao buscar avisos:', error);
            // Fallback silencioso para não assustar o usuário se a tabela não existir ainda
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAvisos();

        // Realtime subscription
        const channel = supabase
            .channel('public:professor_announcements')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'professor_announcements' }, () => {
                fetchAvisos();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const handleDelete = async (id) => {
        if (!window.confirm('Tem certeza que deseja remover este aviso?')) return;

        try {
            const { error } = await supabase
                .from('professor_announcements')
                .update({ is_active: false })
                .eq('id', id);

            if (error) throw error;
            toast({ title: 'Aviso removido' });
            fetchAvisos();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Erro ao remover',
                description: error.message
            });
        }
    };

    const getTypeColor = (type) => {
        const found = ANNOUNCEMENT_TYPES.find(t => t.value === type);
        return found ? found.color : 'bg-slate-50 text-slate-700 border-slate-200';
    };

    // Fallback data for initial display if DB is empty (optional, removed for production logic)
    // const displayAvisos = avisos.length > 0 ? avisos : [];

    return (
        <div className="container mx-auto px-4 py-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-rose-100 rounded-xl">
                        <Megaphone className="w-8 h-8 text-rose-600" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800">Avisos e Comunicados</h1>
                        <p className="text-slate-500 text-lg">Central de notícias para professores</p>
                    </div>
                </div>

                {isSuperadmin && (
                    <Button onClick={() => setIsCreateOpen(true)} className="bg-rose-600 hover:bg-rose-700 text-white">
                        <Plus className="mr-2 h-4 w-4" />
                        Novo Comunicado
                    </Button>
                )}
            </div>

            {loading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-6">
                    {avisos.length > 0 ? (
                        avisos.map((aviso) => (
                            <Card key={aviso.id} className="border-l-4 border-l-rose-500 shadow-sm hover:shadow-md transition-shadow relative group">
                                <CardHeader className="pb-2">
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-2">
                                            <Badge variant="outline" className={`mb-2 ${getTypeColor(aviso.type)}`}>
                                                {aviso.type}
                                            </Badge>
                                            <CardTitle className="text-xl font-bold text-slate-800">{aviso.title}</CardTitle>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-sm text-slate-500 flex items-center gap-1 justify-end">
                                                <Calendar className="w-3.5 h-3.5" />
                                                {format(parseISO(aviso.created_at), "d 'de' MMMM, yyyy", { locale: ptBR })}
                                            </span>
                                        </div>
                                    </div>
                                    {isSuperadmin && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-600"
                                            onClick={() => handleDelete(aviso.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    )}
                                </CardHeader>
                                <CardContent>
                                    <p className="text-slate-600 leading-relaxed mb-4 whitespace-pre-wrap">
                                        {aviso.content}
                                    </p>
                                    <div className="flex items-center gap-2 pt-4 border-t text-sm text-slate-500">
                                        <div className="flex items-center gap-1">
                                            <User className="w-4 h-4" />
                                            <span className="font-medium">{aviso.author || 'Administração'}</span>
                                        </div>
                                        <span>•</span>
                                        <div className="flex items-center gap-1">
                                            <Clock className="w-4 h-4" />
                                            <span>
                                                {format(parseISO(aviso.created_at), "HH:mm")}
                                            </span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    ) : (
                        <div className="text-center py-20 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                            <Megaphone className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                            <h3 className="text-xl font-semibold text-slate-600">Nenhum aviso no momento</h3>
                            <p className="text-slate-500 text-sm mt-1">
                                {isSuperadmin ? 'Clique em "Novo Comunicado" para criar o primeiro aviso.' : 'Fique atento para futuras atualizações aqui.'}
                            </p>
                        </div>
                    )}
                </div>
            )}

            <CreateAnnouncementDialog
                isOpen={isCreateOpen}
                onClose={() => setIsCreateOpen(false)}
                onCreated={fetchAvisos}
                professorName={dashboardData?.professorName}
            />
        </div>
    );
};

export default AvisosTab;
