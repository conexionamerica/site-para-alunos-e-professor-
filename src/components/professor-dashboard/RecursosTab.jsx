import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import {
    FileText,
    Search,
    Upload,
    Trash2,
    ExternalLink,
    Download,
    Filter,
    Users,
    User,
    Loader2,
    Plus,
    Calendar,
    Tag,
    Clock
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import SendResourceDialog from './SendResourceDialog';

const RecursosTab = ({ dashboardData }) => {
    const { toast } = useToast();
    const [materials, setMaterials] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [studentFilter, setStudentFilter] = useState('all');
    const [isSendDialogOpen, setIsSendDialogOpen] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState(null);

    const data = dashboardData?.data || {};
    const professorId = dashboardData?.professorId;
    const isSuperadmin = dashboardData?.isSuperadmin;
    const students = data.students || [];
    const allProfessors = data.professors || [];

    // Categorias fixas (mesmas do SendResourceDialog)
    const CATEGORIES = [
        'Gramática', 'Vocabulário', 'Listening', 'Speaking', 'Exercícios',
        'Leitura', 'Escrita', 'Cultura', 'Outro'
    ];

    const fetchMaterials = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('shared_materials')
                .select(`
                    *,
                    student:profiles!student_id(id, full_name),
                    professor:profiles!professor_id(id, full_name)
                `)
                .order('created_at', { ascending: false });

            // Se for professor (não superadmin), filtrar apenas os seus
            if (!isSuperadmin) {
                query = query.eq('professor_id', professorId);
            } else if (dashboardData?.filteredProfessorId && dashboardData.filteredProfessorId !== 'all') {
                // Se for superadmin e tiver um professor selecionado no filtro global
                query = query.eq('professor_id', dashboardData.filteredProfessorId);
            }

            const { data: materialsData, error } = await query;
            if (error) throw error;
            setMaterials(materialsData || []);
        } catch (error) {
            console.error('Error fetching resources:', error);
            toast({
                variant: 'destructive',
                title: 'Erro ao carregar recursos',
                description: error.message
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMaterials();
    }, [professorId, isSuperadmin, dashboardData?.filteredProfessorId]);

    const handleDelete = async (material) => {
        if (!window.confirm(`Tem certeza que deseja excluir "${material.material_name}"?`)) return;

        try {
            // 1. Storage
            const urlParts = material.file_url.split('/shared-materials/');
            if (urlParts.length > 1) {
                const filePath = urlParts[1];
                await supabase.storage.from('shared-materials').remove([filePath]);
            }

            // 2. Database
            const { error } = await supabase
                .from('shared_materials')
                .delete()
                .eq('id', material.id);

            if (error) throw error;

            toast({ title: 'Sucesso', description: 'Recurso excluído com sucesso.' });
            setMaterials(prev => prev.filter(m => m.id !== material.id));
        } catch (error) {
            console.error('Error deleting resource:', error);
            toast({
                variant: 'destructive',
                title: 'Erro ao excluir recurso',
                description: error.message
            });
        }
    };

    const filteredMaterials = useMemo(() => {
        return materials.filter(m => {
            const matchesSearch =
                m.material_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                m.student?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                m.professor?.full_name?.toLowerCase().includes(searchTerm.toLowerCase());

            const matchesCategory = categoryFilter === 'all' || m.category === categoryFilter;

            const matchesStudent = studentFilter === 'all' ||
                (studentFilter === 'none' && !m.student_id) ||
                m.student_id === studentFilter;

            return matchesSearch && matchesCategory && matchesStudent;
        });
    }, [materials, searchTerm, categoryFilter, studentFilter]);

    const getFileIcon = (type) => {
        const t = (type || '').toUpperCase();
        if (t === 'PDF') return <FileText className="h-5 w-5 text-red-500" />;
        if (t === 'MP3' || t.includes('AUDIO')) return <Clock className="h-5 w-5 text-purple-500" />; // Should be Music, but use lucide
        if (t === 'MP4' || t.includes('VIDEO')) return <Clock className="h-5 w-5 text-blue-500" />; // Should be Video
        return <FileText className="h-5 w-5 text-sky-500" />;
    };

    return (
        <div className="p-4 lg:p-8 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-sky-100 rounded-2xl">
                        <FileText className="h-8 w-8 text-sky-600" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">Biblioteca de Recursos</h2>
                        <p className="text-slate-500">Gerencie todos os recursos compartilhados com alunos</p>
                    </div>
                </div>
                <Button
                    onClick={() => {
                        setSelectedStudent(null);
                        setIsSendDialogOpen(true);
                    }}
                    className="bg-sky-600 hover:bg-sky-700 shadow-lg shadow-sky-100"
                >
                    <Plus className="h-4 w-4 mr-2" /> Compartilhar Recurso
                </Button>
            </div>

            <Card className="border-none shadow-sm bg-white/50 backdrop-blur-sm">
                <CardHeader className="pb-4">
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Buscar por recurso, aluno ou professor..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 h-10 border-slate-200 focus:ring-sky-500"
                            />
                        </div>

                        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                            <SelectTrigger className="w-[180px] h-10 bg-white">
                                <Tag className="h-4 w-4 mr-2 text-slate-400" />
                                <SelectValue placeholder="Categoria" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todas as categorias</SelectItem>
                                {CATEGORIES.map(cat => (
                                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={studentFilter} onValueChange={setStudentFilter}>
                            <SelectTrigger className="w-[180px] h-10 bg-white">
                                <Users className="h-4 w-4 mr-2 text-slate-400" />
                                <SelectValue placeholder="Filtrar por aluno" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos os alunos</SelectItem>
                                <SelectItem value="none">Compartilhado com Todos</SelectItem>
                                {students.map(s => (
                                    <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Button
                            variant="outline"
                            size="icon"
                            onClick={fetchMaterials}
                            className="h-10 w-10 text-sky-600 border-sky-200 hover:bg-sky-50"
                        >
                            <Loader2 className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-xl overflow-hidden bg-white">
                        <Table>
                            <TableHeader className="bg-slate-50/50">
                                <TableRow>
                                    <TableHead className="font-bold">Recurso</TableHead>
                                    {isSuperadmin && <TableHead className="font-bold">Professor</TableHead>}
                                    <TableHead className="font-bold">Aluno</TableHead>
                                    <TableHead className="font-bold">Categoria</TableHead>
                                    <TableHead className="font-bold text-center">Tipo</TableHead>
                                    <TableHead className="font-bold">Data Envio</TableHead>
                                    <TableHead className="text-right font-bold">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={isSuperadmin ? 7 : 6} className="h-32 text-center text-slate-400">
                                            <div className="flex flex-col items-center gap-2">
                                                <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
                                                <p>Carregando recursos...</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : filteredMaterials.length > 0 ? (
                                    filteredMaterials.map((material) => (
                                        <TableRow key={material.id} className="hover:bg-slate-50/50 group">
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-slate-100 rounded-lg">
                                                        {getFileIcon(material.file_type)}
                                                    </div>
                                                    <div className="max-w-[200px]">
                                                        <p className="font-bold text-slate-800 truncate" title={material.material_name}>
                                                            {material.material_name}
                                                        </p>
                                                        {material.description && (
                                                            <p className="text-xs text-slate-500 truncate" title={material.description}>
                                                                {material.description}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </TableCell>
                                            {isSuperadmin && (
                                                <TableCell className="text-slate-600 font-medium">
                                                    {material.professor?.full_name || 'Desconhecido'}
                                                </TableCell>
                                            )}
                                            <TableCell>
                                                {material.student_id ? (
                                                    <div className="flex items-center gap-2">
                                                        <User className="h-3.5 w-3.5 text-slate-400" />
                                                        <span className="text-sm text-slate-700 font-medium">{material.student?.full_name}</span>
                                                    </div>
                                                ) : (
                                                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Todos os Alunos</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {material.category ? (
                                                    <Badge className="bg-sky-100 text-sky-700 hover:bg-sky-200 border-none">
                                                        {material.category}
                                                    </Badge>
                                                ) : (
                                                    <span className="text-slate-400 text-xs">-</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant="secondary" className="text-[10px] uppercase font-bold">
                                                    {material.file_type}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-slate-500 text-sm">
                                                <span className="flex items-center gap-1.5">
                                                    <Calendar className="h-3.5 w-3.5" />
                                                    {format(new Date(material.created_at), 'dd/MM/yyyy')}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        asChild
                                                        className="h-8 w-8 text-sky-600 hover:bg-sky-50"
                                                    >
                                                        <a href={material.file_url} target="_blank" rel="noopener noreferrer">
                                                            <ExternalLink className="h-4 w-4" />
                                                        </a>
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleDelete(material)}
                                                        className="h-8 w-8 text-red-500 hover:bg-red-50"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={isSuperadmin ? 7 : 6} className="h-48 text-center text-slate-400">
                                            <div className="flex flex-col items-center gap-2">
                                                <FileText className="h-12 w-12 text-slate-200" />
                                                <p className="font-medium">Nenhum recurso encontrado</p>
                                                {searchTerm || categoryFilter !== 'all' || studentFilter !== 'all' ? (
                                                    <Button variant="link" onClick={() => {
                                                        setSearchTerm('');
                                                        setCategoryFilter('all');
                                                        setStudentFilter('all');
                                                    }}>Limpar filtros</Button>
                                                ) : (
                                                    <p className="text-xs">Compartilhe recursos com seus alunos para que apareçam aqui.</p>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <SendResourceDialog
                student={selectedStudent}
                isOpen={isSendDialogOpen}
                onClose={() => setIsSendDialogOpen(false)}
                onUpdate={fetchMaterials}
                professorId={professorId}
            />
        </div>
    );
};

export default RecursosTab;
