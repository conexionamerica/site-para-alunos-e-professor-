import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { Upload, Loader2, Trash2, FileText as FileIcon, Music, Video, Search, File } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

// Component for sending resources to students
const SendResourceDialog = ({ student, isOpen, onClose, onUpdate, professorId }) => {
    const { toast } = useToast();
    const [isUploading, setIsUploading] = useState(false);
    const [isDeleting, setIsDeleting] = useState(null); // ID of material being deleted
    const [file, setFile] = useState(null);
    const [materialName, setMaterialName] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState('');
    const [history, setHistory] = useState([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [activeTab, setActiveTab] = useState('enviar');
    const fileInputRef = React.useRef(null);

    const CATEGORIES = [
        'Gramática', 'Vocabulário', 'Listening', 'Speaking', 'Exercícios',
        'Leitura', 'Escrita', 'Cultura', 'Outro'
    ];

    const FILE_TYPES = {
        'application/pdf': 'PDF',
        'audio/mpeg': 'MP3',
        'audio/mp3': 'MP3',
        'video/mp4': 'MP4',
        'application/msword': 'DOC',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
        'application/vnd.ms-excel': 'XLS',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
        'application/vnd.ms-powerpoint': 'PPT',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PPTX',
        'application/zip': 'ZIP',
    };

    const fetchHistory = React.useCallback(async () => {
        if (!isOpen) return;
        setIsLoadingHistory(true);
        try {
            let query = supabase
                .from('shared_materials')
                .select('*')
                .eq('professor_id', professorId)
                .order('created_at', { ascending: false });

            if (student) {
                query = query.eq('student_id', student.id);
            } else {
                query = query.is('student_id', null);
            }

            const { data, error } = await query;
            if (error) throw error;
            setHistory(data || []);
        } catch (error) {
            console.error('Error fetching material history:', error);
        } finally {
            setIsLoadingHistory(false);
        }
    }, [isOpen, professorId, student]);

    React.useEffect(() => {
        if (isOpen) {
            fetchHistory();
        }
    }, [isOpen, fetchHistory]);

    const handleFileChange = (e) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            if (selectedFile.size > 50 * 1024 * 1024) {
                toast({
                    variant: 'destructive',
                    title: 'Arquivo muito grande',
                    description: 'O arquivo deve ter no máximo 50MB'
                });
                return;
            }
            setFile(selectedFile);
            if (!materialName) {
                const nameWithoutExt = selectedFile.name.replace(/\.[^/.]+$/, '');
                setMaterialName(nameWithoutExt);
            }
        }
    };

    const handleDeleteMaterial = async (material) => {
        if (!window.confirm(`Tem certeza que deseja excluir o material "${material.material_name}"?`)) return;

        setIsDeleting(material.id);
        try {
            // 1. Extraer path del storage desde la URL
            const urlParts = material.file_url.split('/shared-materials/');
            if (urlParts.length > 1) {
                const filePath = urlParts[1];
                const { error: storageError } = await supabase.storage
                    .from('shared-materials')
                    .remove([filePath]);
                if (storageError) console.warn('Could not delete file from storage:', storageError);
            }

            // 2. Eliminar de la base de datos
            const { error: dbError } = await supabase
                .from('shared_materials')
                .delete()
                .eq('id', material.id);

            if (dbError) throw dbError;

            toast({
                title: 'Material excluído',
                description: 'O material foi removido com sucesso.'
            });

            setHistory(prev => prev.filter(m => m.id !== material.id));
            onUpdate?.();
        } catch (error) {
            console.error('Error deleting material:', error);
            toast({
                variant: 'destructive',
                title: 'Erro ao excluir material',
                description: error.message
            });
        } finally {
            setIsDeleting(null);
        }
    };

    const handleSubmit = async () => {
        if (!file || !materialName.trim()) {
            toast({
                variant: 'destructive',
                title: 'Campos obrigatórios',
                description: 'Por favor, selecione um arquivo e preencha o nome do material'
            });
            return;
        }

        setIsUploading(true);

        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
            const filePath = `professor-materials/${professorId}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('shared-materials')
                .upload(filePath, file, { cacheControl: '3600', upsert: false });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('shared-materials')
                .getPublicUrl(filePath);

            const fileType = FILE_TYPES[file.type] || 'OTHER';

            const { error: insertError } = await supabase
                .from('shared_materials')
                .insert({
                    professor_id: professorId,
                    student_id: student?.id || null,
                    material_name: materialName.trim(),
                    file_url: publicUrl,
                    file_type: fileType,
                    file_size_bytes: file.size,
                    category: category || null,
                    description: description.trim() || null
                });

            if (insertError) throw insertError;

            toast({
                title: 'Material enviado!',
                description: student
                    ? `Material compartilhado com ${student.full_name}`
                    : 'Material compartilhado com todos os seus alunos'
            });

            // Reset form
            setFile(null);
            setMaterialName('');
            setDescription('');
            setCategory('');
            if (fileInputRef.current) fileInputRef.current.value = '';

            fetchHistory(); // Atualizar histórico
            onUpdate?.();
            setActiveTab('historico'); // Mudar para o histórico para ver o que foi enviado
        } catch (error) {
            console.error('Error uploading material:', error);
            toast({
                variant: 'destructive',
                title: 'Erro ao enviar material',
                description: error.message
            });
        } finally {
            setIsUploading(false);
        }
    };

    const getFileIcon = (type) => {
        if (type === 'PDF') return <FileIcon className="h-5 w-5 text-red-500" />;
        if (type === 'MP3') return <Music className="h-5 w-5 text-purple-500" />;
        if (type === 'MP4') return <Video className="h-5 w-5 text-blue-500" />;
        return <File className="h-5 w-5 text-sky-500" />;
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden rounded-2xl">
                <div className="p-6 bg-slate-50 border-b border-slate-100">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl">
                            <Upload className="h-5 w-5 text-sky-600" />
                            Gestão de Materiais
                        </DialogTitle>
                        <DialogDescription className="text-slate-500">
                            {student
                                ? `Materiais para ${student.full_name}`
                                : 'Materiais compartilhados com todos os alunos'}
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <div className="px-6 pt-2 bg-slate-50">
                        <TabsList className="grid w-full grid-cols-2 bg-slate-200/50 p-1 rounded-xl">
                            <TabsTrigger value="enviar" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                                <Upload className="h-4 w-4 mr-2" />
                                Enviar Novo
                            </TabsTrigger>
                            <TabsTrigger value="historico" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                                <Search className="h-4 w-4 mr-2" />
                                Histórico ({history.length})
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <div className="p-6 min-h-[400px]">
                        <TabsContent value="enviar" className="mt-0 space-y-4 animate-in fade-in-50 duration-300">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="file-upload" className="font-bold text-slate-700">Arquivo *</Label>
                                    <Input
                                        id="file-upload"
                                        ref={fileInputRef}
                                        type="file"
                                        onChange={handleFileChange}
                                        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.mp3,.mp4,.zip"
                                        className="cursor-pointer bg-white border-slate-200 hover:border-sky-300 transition-colors"
                                    />
                                    {file && (
                                        <p className="text-xs font-semibold text-sky-600 flex items-center gap-1">
                                            ✓ {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                                        </p>
                                    )}
                                    <p className="text-[11px] text-slate-400">
                                        PDF, DOC, XLS, PPT, MP3, MP4, ZIP (máx. 50MB)
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="material-name" className="font-bold text-slate-700">Nome do Material *</Label>
                                    <Input
                                        id="material-name"
                                        value={materialName}
                                        onChange={(e) => setMaterialName(e.target.value)}
                                        placeholder="Ex: Guia de Conversação"
                                        className="bg-white"
                                    />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="category" className="font-bold text-slate-700">Categoria</Label>
                                        <Select value={category} onValueChange={setCategory}>
                                            <SelectTrigger id="category" className="bg-white">
                                                <SelectValue placeholder="Selecione..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {CATEGORIES.map((cat) => (
                                                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="description" className="font-bold text-slate-700">Descrição</Label>
                                    <Textarea
                                        id="description"
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder="O que o aluno deve fazer com este material?"
                                        rows={3}
                                        className="bg-white resize-none"
                                    />
                                </div>
                            </div>

                            <div className="pt-4 flex justify-end gap-3">
                                <Button variant="outline" onClick={onClose} disabled={isUploading} className="rounded-xl px-6">
                                    Cancelar
                                </Button>
                                <Button
                                    onClick={handleSubmit}
                                    disabled={isUploading || !file || !materialName.trim()}
                                    className="bg-sky-600 hover:bg-sky-700 rounded-xl px-8 shadow-lg shadow-sky-100"
                                >
                                    {isUploading ? (
                                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando...</>
                                    ) : (
                                        <><Upload className="mr-2 h-4 w-4" /> Enviar Agora</>
                                    )}
                                </Button>
                            </div>
                        </TabsContent>

                        <TabsContent value="historico" className="mt-0 animate-in fade-in-50 duration-300">
                            <ScrollArea className="h-[380px] w-full pr-4">
                                {isLoadingHistory ? (
                                    <div className="flex flex-col items-center justify-center h-full py-20 text-slate-400">
                                        <Loader2 className="h-8 w-8 animate-spin mb-2" />
                                        <p>Carregando histórico...</p>
                                    </div>
                                ) : history.length > 0 ? (
                                    <div className="space-y-3">
                                        {history.map((item) => (
                                            <div key={item.id} className="group flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-sky-100 hover:bg-sky-50 transition-all">
                                                <div className="flex items-center gap-3 overflow-hidden">
                                                    <div className="p-2 bg-white rounded-lg shadow-sm">
                                                        {getFileIcon(item.file_type)}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-bold text-slate-800 text-sm truncate">
                                                            {item.material_name}
                                                        </p>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <span className="text-[10px] text-slate-400 font-medium">
                                                                {format(new Date(item.created_at), "dd/MM/yyyy", { locale: ptBR })}
                                                            </span>
                                                            <Badge variant="outline" className="text-[9px] h-4 py-0 px-1 text-slate-500 uppercase">
                                                                {item.file_type}
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50"
                                                        onClick={() => handleDeleteMaterial(item)}
                                                        disabled={isDeleting === item.id}
                                                    >
                                                        {isDeleting === item.id ? (
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <Trash2 className="h-4 w-4" />
                                                        )}
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full py-20 text-slate-400">
                                        <div className="p-4 bg-slate-50 rounded-full mb-3">
                                            <File className="h-10 w-10 text-slate-200" />
                                        </div>
                                        <p className="font-medium text-slate-400">Nenhum material enviado ainda.</p>
                                        <p className="text-xs">O que você enviar aparecerá aqui.</p>
                                    </div>
                                )}
                            </ScrollArea>
                        </TabsContent>
                    </div>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
};

export default SendResourceDialog;
