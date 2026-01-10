import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { Upload, Loader2 } from 'lucide-react';

// Component for sending resources to students
const SendResourceDialog = ({ student, isOpen, onClose, onUpdate, professorId }) => {
    const { toast } = useToast();
    const [isUploading, setIsUploading] = useState(false);
    const [file, setFile] = useState(null);
    const [materialName, setMaterialName] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState('');
    const fileInputRef = React.useRef(null);

    const CATEGORIES = [
        'Gramática',
        'Vocabulário',
        'Listening',
        'Speaking',
        'Exercícios',
        'Leitura',
        'Escrita',
        'Cultura',
        'Outro'
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

    const handleFileChange = (e) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            // Validate file size (max 50MB)
            if (selectedFile.size > 50 * 1024 * 1024) {
                toast({
                    variant: 'destructive',
                    title: 'Arquivo muito grande',
                    description: 'O arquivo deve ter no máximo 50MB'
                });
                return;
            }
            setFile(selectedFile);
            // Auto-fill material name from filename if empty
            if (!materialName) {
                const nameWithoutExt = selectedFile.name.replace(/\.[^/.]+$/, '');
                setMaterialName(nameWithoutExt);
            }
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
            // 1. Upload file to Supabase Storage
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
            const filePath = `professor-materials/${professorId}/${fileName}`;

            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('shared-materials')
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (uploadError) throw uploadError;

            // 2. Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from('shared-materials')
                .getPublicUrl(filePath);

            // 3. Insert into shared_materials table
            const fileType = FILE_TYPES[file.type] || 'OTHER';

            const { error: insertError } = await supabase
                .from('shared_materials')
                .insert({
                    professor_id: professorId,
                    student_id: student?.id || null, // null = shared with all students
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
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }

            onUpdate?.();
            onClose();
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

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Upload className="h-5 w-5 text-sky-600" />
                        Enviar Material de Estudo
                    </DialogTitle>
                    <DialogDescription>
                        {student
                            ? `Compartilhar material com ${student.full_name}`
                            : 'Compartilhar material com todos os seus alunos'}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* File Upload */}
                    <div className="space-y-2">
                        <Label htmlFor="file-upload">Arquivo *</Label>
                        <div className="flex items-center gap-2">
                            <Input
                                id="file-upload"
                                ref={fileInputRef}
                                type="file"
                                onChange={handleFileChange}
                                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.mp3,.mp4,.zip"
                                className="cursor-pointer"
                            />
                        </div>
                        {file && (
                            <p className="text-xs text-slate-500">
                                Arquivo selecionado: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                            </p>
                        )}
                        <p className="text-xs text-slate-400">
                            Formatos aceitos: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, MP3, MP4, ZIP (máx. 50MB)
                        </p>
                    </div>

                    {/* Material Name */}
                    <div className="space-y-2">
                        <Label htmlFor="material-name">Nome do Material *</Label>
                        <Input
                            id="material-name"
                            value={materialName}
                            onChange={(e) => setMaterialName(e.target.value)}
                            placeholder="Ex: Verbos Irregulares - Guia Completa"
                            maxLength={200}
                        />
                    </div>

                    {/* Category */}
                    <div className="space-y-2">
                        <Label htmlFor="category">Categoria</Label>
                        <Select value={category} onValueChange={setCategory}>
                            <SelectTrigger id="category">
                                <SelectValue placeholder="Selecione uma categoria (opcional)" />
                            </SelectTrigger>
                            <SelectContent>
                                {CATEGORIES.map((cat) => (
                                    <SelectItem key={cat} value={cat}>
                                        {cat}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <Label htmlFor="description">Descrição</Label>
                        <Textarea
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Breve descrição do material (opcional)"
                            rows={3}
                            maxLength={500}
                        />
                        <p className="text-xs text-slate-400 text-right">
                            {description.length}/500
                        </p>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isUploading}>
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={isUploading || !file || !materialName.trim()}
                        className="bg-sky-600 hover:bg-sky-700"
                    >
                        {isUploading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Enviando...
                            </>
                        ) : (
                            <>
                                <Upload className="mr-2 h-4 w-4" />
                                Enviar Material
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default SendResourceDialog;
