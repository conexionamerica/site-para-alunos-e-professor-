// Archivo: src/components/professor-dashboard/AdminTab.jsx
// Pestaña de Administração para superusuarios con CRUD de usuarios

import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Users, Shield, UserPlus, Pencil, UserX, UserCheck, Trash2, X, Search, AlertTriangle, Clock } from 'lucide-react';
import PreferenciasTab from './PreferenciasTab';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { getBrazilDate } from '@/lib/dateUtils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const daysOfWeek = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

const AdminTab = ({ dashboardData }) => {
    const { toast } = useToast();
    const [activeSubTab, setActiveSubTab] = useState('preferencias');
    const [professorFilter, setProfessorFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
    const [editingRole, setEditingRole] = useState(null);
    const [tempPermissions, setTempPermissions] = useState({ tabs: [] });
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [userToDelete, setUserToDelete] = useState(null);
    const [professorAvailability, setProfessorAvailability] = useState(null);
    const [availabilityWarning, setAvailabilityWarning] = useState(null);

    // Form state
    const [formData, setFormData] = useState({
        full_name: '',
        username: '',
        email: '',
        role: 'student',
        assigned_professor_id: '',
        is_active: true
    });
    const [generatedPassword, setGeneratedPassword] = useState('');

    const data = dashboardData?.data || {};
    const onUpdate = dashboardData?.onUpdate;
    const professorId = dashboardData?.professorId;
    const professors = data.professors || [];
    const allProfiles = data.allProfiles || [];
    const students = data.students || [];
    const roleSettings = data.roleSettings || [];
    const classSlots = data.classSlots || [];

    // Función para verificar disponibilidad del profesor seleccionado
    const checkProfessorAvailability = async (profId) => {
        if (!profId || profId === 'none') {
            setProfessorAvailability(null);
            setAvailabilityWarning(null);
            return;
        }

        try {
            // Buscar slots activos del profesor
            const { data: profSlots, error } = await supabase
                .from('class_slots')
                .select('*')
                .eq('professor_id', profId)
                .in('status', ['active', 'filled']);

            if (error) throw error;

            const activeSlots = (profSlots || []).filter(s => s.status === 'active');
            const filledSlots = (profSlots || []).filter(s => s.status === 'filled');

            // Agrupar slots activos por día
            const slotsByDay = {};
            activeSlots.forEach(slot => {
                const day = slot.day_of_week;
                if (!slotsByDay[day]) slotsByDay[day] = [];
                slotsByDay[day].push(slot.start_time?.substring(0, 5));
            });

            const availableDays = Object.keys(slotsByDay).map(d => daysOfWeek[parseInt(d)]);

            setProfessorAvailability({
                totalActive: activeSlots.length,
                totalFilled: filledSlots.length,
                slotsByDay,
                availableDays
            });

            // Generar alerta si no hay horarios disponibles
            if (activeSlots.length === 0) {
                const profName = professors.find(p => p.id === profId)?.full_name || 'Professor';
                setAvailabilityWarning({
                    type: 'error',
                    title: 'Professor sem horários disponíveis!',
                    message: `${profName} não possui horários ativos na aba de preferências. O aluno pode ser vinculado, mas não será possível agendar aulas até que o professor configure seus horários.`
                });
            } else if (activeSlots.length < 4) {
                const profName = professors.find(p => p.id === profId)?.full_name || 'Professor';
                setAvailabilityWarning({
                    type: 'warning',
                    title: 'Poucos horários disponíveis',
                    message: `${profName} possui apenas ${activeSlots.length} horário(s) disponível(is) nos dias: ${availableDays.join(', ')}. Verifique se são suficientes para o pacote do aluno.`
                });
            } else {
                setAvailabilityWarning(null);
            }
        } catch (err) {
            console.error('Erro ao verificar disponibilidade do professor:', err);
            setAvailabilityWarning(null);
        }
    };



    // Filter users by search and role
    const filteredProfiles = allProfiles.filter(profile => {
        const matchesSearch = profile.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            profile.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            profile.student_code?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesRole = roleFilter === 'all' || profile.role === roleFilter;
        return matchesSearch && matchesRole;
    });

    // Filter class slots for preferences
    const filteredClassSlots = professorFilter === 'all'
        ? data.classSlots || []
        : (data.classSlots || []).filter(slot => slot.professor_id === professorFilter);

    const generateRandomPassword = () => {
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
        let password = '';
        for (let i = 0; i < 10; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return password;
    };

    const getNextStudentCode = () => {
        // Usar allProfiles para garantir que pegamos o maior código de TODO o sistema, 
        // e não apenas dos alunos visíveis no filtro atual.
        const studentCodes = allProfiles
            .filter(p => p.student_code)
            .map(s => s.student_code)
            .filter(code => code && /^\d+$/.test(code))
            .map(code => parseInt(code, 10));

        const lastCode = studentCodes.length > 0 ? Math.max(...studentCodes) : 101014;
        const nextCode = lastCode + 1;
        return nextCode.toString().padStart(7, '0');
    };

    // Open dialog for new user
    const handleNewUser = () => {
        const newPassword = generateRandomPassword();
        const nextCode = getNextStudentCode();
        setEditingUser(null);
        setFormData({
            full_name: '',
            username: '',
            email: '',
            role: 'student',
            student_code: nextCode,
            assigned_professor_id: '',
            is_active: true
        });
        setGeneratedPassword(newPassword);
        setIsUserDialogOpen(true);
    };

    // Open dialog for editing user - Fetch fresh data to ensure real_email is present
    const handleEditUser = async (baseUser) => {
        // Mostrar carregamento se necessário ou apenas esperar
        const { data: freshUser, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', baseUser.id)
            .single();

        const user = freshUser || baseUser;

        setEditingUser(user);
        setFormData({
            full_name: user.full_name || '',
            username: user.username || '',
            email: user.real_email || user.email || '',
            role: user.role || 'student',
            student_code: user.student_code || '',
            assigned_professor_id: user.assigned_professor_id || '',
            is_active: user.is_active !== false
        });
        setGeneratedPassword('');
        setIsUserDialogOpen(true);
    };

    // Toggle user active status
    const handleToggleActive = async (user) => {
        const newStatus = user.is_active === false ? true : false;
        const action = newStatus ? 'ativar' : 'inativar';

        if (!window.confirm(`Tem certeza que deseja ${action} o usuário ${user.full_name}?`)) {
            return;
        }

        try {
            const { error } = await supabase
                .from('profiles')
                .update({ is_active: newStatus })
                .eq('id', user.id);

            if (error) throw error;

            toast({
                title: 'Sucesso',
                description: `Usuário ${newStatus ? 'ativado' : 'inativado'} com sucesso.`,
            });

            onUpdate?.();
        } catch (error) {
            console.error('Error toggling user status:', error);
            toast({
                title: 'Erro',
                description: 'Erro ao alterar status do usuário.',
                variant: 'destructive'
            });
        }
    };

    // Save user (create or update)
    const handleSaveUser = async () => {
        if (!formData.full_name.trim() || !formData.email.trim()) {
            toast({
                title: 'Erro',
                description: 'Nome e E-mail são obrigatórios.',
                variant: 'destructive'
            });
            return;
        }

        setIsSubmitting(true);

        try {
            // Verificar se o e-mail já existe (apenas para novos usuários)
            if (!editingUser) {
                const { data: existingUser, error: checkError } = await supabase
                    .from('profiles')
                    .select('full_name, real_email')
                    .eq('real_email', formData.email.trim())
                    .maybeSingle();

                if (existingUser) {
                    setIsSubmitting(false);
                    toast({
                        title: 'E-mail em uso',
                        description: `O e-mail ${formData.email} já está vinculado ao usuário: ${existingUser.full_name}.`,
                        variant: 'destructive'
                    });
                    return;
                }
            }

            if (editingUser) {
                // Update existing user
                const updateData = {
                    full_name: (formData.full_name || '').trim(),
                    username: (formData.username || '').trim(),
                    real_email: (formData.email || '').trim(), // Manter real_email atualizado como fonte única
                    role: formData.role,
                    student_code: formData.role === 'student' ? (formData.student_code?.trim() || null) : null,
                    assigned_professor_id: formData.role === 'student' ? (formData.assigned_professor_id || null) : null,
                    is_active: formData.is_active === true
                };


                // 1. Atualizar o vínculo do professor via RPC (Garante o salvamento saltando RLS)
                if (formData.role === 'student' && updateData.assigned_professor_id) {
                    await supabase.rpc('admin_link_professor', {
                        p_student_id: editingUser.id,
                        p_professor_id: updateData.assigned_professor_id
                    });
                }

                const { data: updatedRows, error: updateError } = await supabase
                    .from('profiles')
                    .update(updateData)
                    .eq('id', editingUser.id)
                    .select();


                if (updateError) {
                    console.error('Erro no update do profile:', updateError);
                    throw updateError;
                }

                if (!updatedRows || updatedRows.length === 0) {
                    // No rows updated - this is a warning condition
                }

                // Lógica de inativação avançada (limpeza de horários e cancelamento de aulas)
                const wasActive = editingUser.is_active !== false;
                const willBeActive = formData.is_active;

                if (wasActive && !willBeActive && formData.role === 'student') {
                    const today = getBrazilDate().toISOString();

                    // Buscar agendamentos futuros
                    const { data: futureAppointments, error: apptError } = await supabase
                        .from('appointments')
                        .select('id, class_slot_id, duration_minutes')
                        .eq('student_id', editingUser.id)
                        .gte('class_datetime', today)
                        .in('status', ['scheduled', 'pending', 'rescheduled']);

                    if (apptError) {
                        console.error('Erro ao buscar aulas futuras para limpeza:', apptError);
                        toast({
                            title: 'Aviso',
                            description: 'Usuário inativado, mas houve um erro ao limpar agendamentos futuros.',
                            variant: 'warning'
                        });
                    } else if (futureAppointments && futureAppointments.length > 0) {
                        const slotIdsToFree = new Set();
                        futureAppointments.forEach(apt => {
                            if (apt.class_slot_id) slotIdsToFree.add(apt.class_slot_id);
                        });

                        // Liberar slots no banco
                        if (slotIdsToFree.size > 0) {
                            await supabase
                                .from('class_slots')
                                .update({ status: 'active' })
                                .in('id', Array.from(slotIdsToFree));
                        }

                        // Cancelar aulas futuras no banco
                        await supabase
                            .from('appointments')
                            .update({ status: 'cancelled' })
                            .eq('student_id', editingUser.id)
                            .gte('class_datetime', today)
                            .in('status', ['scheduled', 'pending', 'rescheduled']);

                        // Cancelar/Remover solicitações de aula recorrentes (libera o vínculo fixo)
                        await supabase
                            .from('solicitudes_clase')
                            .delete()
                            .eq('alumno_id', editingUser.id)
                            .in('status', ['Aceita', 'Aprovada', 'Pendiente']);

                        toast({
                            title: 'Aluno Inativado',
                            description: `Perfil inativado, ${futureAppointments.length} aulas canceladas e todos os vínculos/horários foram liberados.`,
                        });
                    } else {
                        // Mesmo sem agendamentos futuros, limpar solicitações recorrentes por segurança
                        await supabase
                            .from('solicitudes_clase')
                            .delete()
                            .eq('alumno_id', editingUser.id);

                        toast({
                            title: 'Sucesso',
                            description: 'Usuário inativado e vínculos removidos do sistema.',
                        });
                    }
                } else {
                    toast({
                        title: 'Sucesso',
                        description: 'Dados do usuário (incluindo e-mail) atualizados com sucesso.',
                    });
                }
            } else {
                // For new users, create via the new admin_create_user RPC
                // This prevents session switching issues and centralizes creation
                try {
                    const { data: newUserId, error: rpcError } = await supabase.rpc('admin_create_user', {
                        p_email: formData.email.trim(),
                        p_password: generatedPassword,
                        p_full_name: (formData.full_name || '').trim(),
                        p_role: formData.role,
                        p_username: (formData.username || '').trim(),
                        p_student_code: formData.role === 'student' ? (formData.student_code || null) : null,
                        p_assigned_professor_id: null
                    });

                    if (rpcError) {
                        console.error('Error calling admin_create_user RPC:', rpcError);
                        let errorMsg = rpcError.message;

                        // Identificar qual campo está duplicado para ser mais específico
                        if (rpcError.message.includes('profiles_student_code_key')) {
                            errorMsg = 'Este "Código do Aluno" já está sendo usado por outro usuário.';
                        } else if (rpcError.message.includes('profiles_username_key')) {
                            errorMsg = 'Este "Username" já está em uso.';
                        } else if (rpcError.message.includes('users_email_partial_key') || rpcError.message.includes('already exists')) {
                            errorMsg = 'Este "E-mail" já está registrado no sistema.';
                        } else if (rpcError.message.includes('unique constraint') || rpcError.message.includes('already exists')) {
                            errorMsg = 'Algum dos dados informados (E-mail, Código ou Username) já existe no sistema.';
                        }
                        throw new Error(errorMsg);
                    }

                    if (!newUserId) {
                        throw new Error('Não foi possível obter o ID do novo usuário criado.');
                    }

                    toast({
                        title: 'Sucesso!',
                        description: `Usuário criado com sucesso. ${formData.role === 'student' ? `Código: ${formData.student_code}. ` : ''}Senha provisória: ${generatedPassword}`,
                        duration: 15000,
                    });
                } catch (rpcException) {
                    console.error('Exception during user creation via RPC:', rpcException);
                    throw rpcException;
                }
            }

            setIsUserDialogOpen(false);
            onUpdate?.();
        } catch (error) {
            console.error('Error saving user:', error);
            let errorDescription = error.message || 'Erro desconhecido ao salvar usuário.';

            // Mensajes de error más amigables
            if (error.message?.includes('duplicate key')) {
                errorDescription = 'Este usuário ou e-mail já existe no sistema.';
            } else if (error.message?.includes('foreign key')) {
                errorDescription = 'O professor selecionado não foi encontrado. Tente selecionar outro.';
            } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
                errorDescription = 'Erro de conexão. Verifique sua internet e tente novamente.';
            }

            toast({
                title: 'Erro ao criar usuário',
                description: errorDescription,
                variant: 'destructive'
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteRequest = (user) => {
        setUserToDelete(user);
        setIsDeleteDialogOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!userToDelete) return;
        setIsSubmitting(true);
        try {
            const { error: rpcError } = await supabase.rpc('delete_user_complete', {
                p_user_id: userToDelete.id
            });

            if (rpcError) throw rpcError;

            toast({
                variant: 'default',
                title: 'Usuário excluído',
                description: `O perfil de ${userToDelete.full_name} foi removido com sucesso de todas as tabelas.`
            });

            setIsDeleteDialogOpen(false);
            setUserToDelete(null);
            if (onUpdate) onUpdate();
        } catch (error) {
            console.error("Erro ao excluir usuário:", error);
            toast({
                variant: 'destructive',
                title: 'Erro ao excluir',
                description: error.message.includes('foreign key constraint')
                    ? 'Não é possível excluir: o usuário possui registros vinculados (aulas, faturas, etc). Tente inativar o perfil.'
                    : `Erro técnico: ${error.message}`
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEditRole = (role) => {
        const settings = roleSettings.find(s => s.role === role);
        setEditingRole(role);
        setTempPermissions(settings?.permissions || { tabs: [] });
        setIsSettingsDialogOpen(true);
    };

    const handleSaveRoleSettings = async () => {
        setIsSubmitting(true);
        try {
            const { error } = await supabase
                .from('role_settings')
                .upsert({
                    role: editingRole,
                    permissions: tempPermissions,
                    updated_at: new Date().toISOString()
                });

            if (error) throw error;

            toast({ title: 'Sucesso', description: 'Configurações de perfil atualizadas.' });
            setIsSettingsDialogOpen(false);
            onUpdate?.();
        } catch (error) {
            console.error('Error saving role settings:', error);
            toast({ title: 'Erro', description: 'Falha ao salvar configurações.', variant: 'destructive' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const togglePermission = (tabId) => {
        const currentTabs = tempPermissions.tabs || [];
        const newTabs = currentTabs.includes(tabId)
            ? currentTabs.filter(id => id !== tabId)
            : [...currentTabs, tabId];
        setTempPermissions({ ...tempPermissions, tabs: newTabs });
    };

    return (
        <div className="px-4 lg:px-8 space-y-6">
            <div className="flex items-center gap-3">
                <Shield className="h-8 w-8 text-purple-600" />
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Administração</h2>
                    <p className="text-slate-500">Gerencie usuários, preferências e perfis de acesso</p>
                </div>
            </div>

            <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3 max-w-md">
                    <TabsTrigger value="preferencias" className="flex items-center gap-2">
                        <Settings className="h-4 w-4" />
                        Preferências
                    </TabsTrigger>
                    <TabsTrigger value="usuarios" className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Usuários
                    </TabsTrigger>
                    <TabsTrigger value="perfis" className="flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        Perfis
                    </TabsTrigger>
                </TabsList>

                {/* Sub-tab: Preferências de todos los profesores */}
                <TabsContent value="preferencias" className="mt-6">
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <div>
                                    <CardTitle>Preferências dos Professores</CardTitle>
                                    <CardDescription>Visualize as preferências de horários de todos os professores</CardDescription>
                                </div>
                                <Select value={professorFilter} onValueChange={setProfessorFilter}>
                                    <SelectTrigger className="w-[250px]">
                                        <SelectValue placeholder="Filtrar por professor" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todos os professores</SelectItem>
                                        {professors.map(prof => (
                                            <SelectItem key={prof.id} value={prof.id}>
                                                {prof.full_name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {professorFilter !== 'all' ? (
                                <PreferenciasTab dashboardData={{
                                    ...dashboardData,
                                    data: {
                                        ...data,
                                        classSlots: filteredClassSlots
                                    },
                                    professorId: professorFilter
                                }} />
                            ) : (
                                <div className="text-center py-8 text-slate-500">
                                    <Settings className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                                    <p>Selecione um professor para ver suas preferências</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Sub-tab: Gestión de Usuarios */}
                <TabsContent value="usuarios" className="mt-6">
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center flex-wrap gap-4">
                                <div>
                                    <CardTitle>Gestão de Usuários</CardTitle>
                                    <CardDescription>Crie, edite e gerencie todos os usuários do sistema</CardDescription>
                                </div>
                                <div className="flex gap-3 flex-wrap">
                                    <Select value={roleFilter} onValueChange={setRoleFilter}>
                                        <SelectTrigger className="w-[180px]">
                                            <SelectValue placeholder="Filtrar por tipo" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Todos os tipos</SelectItem>
                                            <SelectItem value="student">Alunos</SelectItem>
                                            <SelectItem value="professor">Professores</SelectItem>
                                            <SelectItem value="superadmin">Administradores</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                        <Input
                                            placeholder="Nome ou código do aluno..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="pl-10 w-[250px]"
                                        />
                                    </div>
                                    <Button onClick={handleNewUser} className="bg-purple-600 hover:bg-purple-700">
                                        <UserPlus className="h-4 w-4 mr-2" />
                                        Novo Usuário
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="border rounded-lg overflow-hidden">
                                <Table>
                                    <TableHeader className="bg-slate-50">
                                        <TableRow>
                                            <TableHead>Nome</TableHead>
                                            <TableHead>Username</TableHead>
                                            <TableHead>E-mail</TableHead>
                                            <TableHead>Código</TableHead>
                                            <TableHead>Tipo</TableHead>
                                            <TableHead>Professor Vinculado</TableHead>
                                            <TableHead>Estado</TableHead>
                                            <TableHead>Criado em</TableHead>
                                            <TableHead className="text-right">Ações</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredProfiles.length > 0 ? filteredProfiles.map(profile => (
                                            <TableRow key={profile.id}>
                                                <TableCell className="font-medium">{profile.full_name}</TableCell>
                                                <TableCell className="text-slate-500">{profile.username}</TableCell>
                                                <TableCell className="text-slate-500 max-w-[200px] truncate" title={profile.real_email || profile.email}>
                                                    {profile.real_email || profile.email || '—'}
                                                </TableCell>
                                                <TableCell>{profile.student_code || '—'}</TableCell>
                                                <TableCell>
                                                    <Badge variant={
                                                        profile.role === 'superadmin' ? 'destructive' :
                                                            profile.role === 'professor' ? 'default' : 'secondary'
                                                    }>
                                                        {profile.role === 'superadmin' ? 'Admin' :
                                                            profile.role === 'professor' ? 'Professor' : 'Aluno'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    {profile.role === 'student' && profile.assigned_professor_id ? (
                                                        professors.find(p => p.id === profile.assigned_professor_id)?.full_name || '—'
                                                    ) : '—'}
                                                </TableCell>
                                                <TableCell>
                                                    {profile.is_active !== false ? (
                                                        <Badge className="bg-green-100 text-green-800">Ativo</Badge>
                                                    ) : (
                                                        <Badge variant="destructive">Inativo</Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {profile.created_at ? format(new Date(profile.created_at), 'dd/MM/yyyy') : '-'}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleEditUser(profile)}
                                                            title="Editar / Inativar"
                                                        >
                                                            <Pencil className="h-4 w-4 text-blue-600" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleDeleteRequest(profile)}
                                                            title="Excluir Usuário"
                                                            className="hover:text-red-600"
                                                        >
                                                            <Trash2 className="h-4 w-4 text-red-500" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )) : (
                                            <TableRow>
                                                <TableCell colSpan={8} className="text-center py-8 text-slate-500">
                                                    Nenhum usuário encontrado.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Sub-tab: Perfis de Acesso */}
                <TabsContent value="perfis" className="mt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Perfis de Acesso</CardTitle>
                            <CardDescription>Gerencie os perfis e permissões de acesso ao sistema</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-4">
                                {/* Perfil Aluno */}
                                <div className="border rounded-lg p-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h4 className="font-semibold text-slate-800">Aluno (student)</h4>
                                            <p className="text-sm text-slate-500">Acesso ao portal do aluno</p>
                                            <div className="mt-2 flex flex-wrap gap-1">
                                                {['dashboard', 'clases', 'chat', 'desempenho', 'faturas'].map(tab => {
                                                    const isAllowed = roleSettings.find(s => s.role === 'student')?.permissions?.tabs?.includes(tab);
                                                    return (
                                                        <Badge
                                                            key={tab}
                                                            variant={isAllowed ? "default" : "outline"}
                                                            className={`text-xs capitalize ${!isAllowed ? 'opacity-40' : ''}`}
                                                        >
                                                            {tab}
                                                        </Badge>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <Badge variant="secondary">{students.length} usuários</Badge>
                                            <Button variant="outline" size="sm" onClick={() => handleEditRole('student')}>
                                                <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                                            </Button>
                                        </div>
                                    </div>
                                </div>

                                {/* Perfil Professor */}
                                <div className="border rounded-lg p-4 border-sky-200 bg-sky-50/50">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h4 className="font-semibold text-sky-800">Professor (professor)</h4>
                                            <p className="text-sm text-sky-600">Acesso ao painel do professor (dados próprios)</p>
                                            <div className="mt-2 flex flex-wrap gap-1">
                                                {[
                                                    { id: 'inicio', label: 'Início' },
                                                    { id: 'agenda', label: 'Agenda' },
                                                    { id: 'conversas', label: 'Conversas' },
                                                    { id: 'alunos', label: 'Alunos' },
                                                    { id: 'aulas', label: 'Aulas' },
                                                    { id: 'preferencias', label: 'Preferências' }
                                                ].map(tab => {
                                                    const isAllowed = roleSettings.find(s => s.role === 'professor')?.permissions?.tabs?.includes(tab.id);
                                                    return (
                                                        <Badge
                                                            key={tab.id}
                                                            variant={isAllowed ? "default" : "outline"}
                                                            className={`text-xs ${!isAllowed ? 'opacity-40 text-slate-400' : 'border-sky-300 text-sky-700 bg-sky-100'}`}
                                                        >
                                                            {tab.label}
                                                        </Badge>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <Badge className="bg-sky-600">{professors.length} usuários</Badge>
                                            <Button variant="outline" size="sm" onClick={() => handleEditRole('professor')}>
                                                <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                                            </Button>
                                        </div>
                                    </div>
                                </div>

                                {/* Perfil Superadmin */}
                                <div className="border rounded-lg p-4 border-purple-200 bg-purple-50">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h4 className="font-semibold text-purple-800">Administrador (superadmin)</h4>
                                            <p className="text-sm text-purple-600">Acesso total com visão global e filtro por professor</p>
                                            <div className="mt-2 flex flex-wrap gap-1">
                                                {[
                                                    { id: 'painel', label: 'Painel' },
                                                    { id: 'inicio', label: 'Início' },
                                                    { id: 'agenda', label: 'Agenda' },
                                                    { id: 'conversas', label: 'Conversas' },
                                                    { id: 'alunos', label: 'Alunos' },
                                                    { id: 'aulas', label: 'Aulas' },
                                                    { id: 'admtab', label: 'Administração' }
                                                ].map(tab => (
                                                    <Badge
                                                        key={tab.id}
                                                        variant="outline"
                                                        className="text-xs border-purple-300 text-purple-700 bg-purple-100"
                                                    >
                                                        {tab.label}
                                                    </Badge>
                                                ))}
                                            </div>
                                            <p className="text-xs text-purple-500 mt-2">
                                                + Filtro global por professor em todas as abas
                                            </p>
                                        </div>
                                        <Badge variant="destructive">
                                            {allProfiles.filter(p => p.role === 'superadmin').length} usuários
                                        </Badge>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6 p-4 bg-slate-50 rounded-lg">
                                <p className="text-sm text-slate-600">
                                    <strong>Nota:</strong> Superusuários têm acesso a todas as abas com a possibilidade de filtrar por professor específico. Professores veem apenas seus próprios dados.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Dialog para editar usuário */}
            <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>{editingUser ? 'Gerenciar Usuário' : 'Novo Usuário'}</DialogTitle>
                        <DialogDescription>
                            {editingUser ? 'Gerencie o vínculo com professor e status da conta.' : 'Preencha os dados do novo usuário.'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        {/* Solo mostrar campos de nombre/email/etc cuando es NUEVO usuario */}
                        {!editingUser && (
                            <>
                                <div className="grid gap-2">
                                    <Label htmlFor="full_name">Nome completo *</Label>
                                    <Input
                                        id="full_name"
                                        value={formData.full_name}
                                        onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                        placeholder="Nome do usuário"
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="username">Username</Label>
                                    <Input
                                        id="username"
                                        value={formData.username}
                                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                        placeholder="username"
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="email">Email</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        placeholder="seu@email.com"
                                    />
                                </div>
                                <div className="p-3 bg-slate-100 rounded-lg space-y-2">
                                    <Label className="text-xs text-slate-500 uppercase">Senha Gerada Aleatoriamente</Label>
                                    <div className="flex items-center gap-2">
                                        <Input value={generatedPassword} readOnly className="font-mono text-sm bg-white" />
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                navigator.clipboard.writeText(generatedPassword);
                                                toast({ title: "Copiado!", description: "Senha copiada para a área de transferência." });
                                            }}
                                        >
                                            Copiar
                                        </Button>
                                    </div>
                                    <p className="text-[10px] text-slate-400">Esta senha será usada para o primeiro acesso do usuário.</p>
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="role">Tipo de usuário</Label>
                                    <Select
                                        value={formData.role}
                                        onValueChange={(value) => setFormData({ ...formData, role: value })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecione o tipo" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="student">Aluno</SelectItem>
                                            <SelectItem value="professor">Professor</SelectItem>
                                            <SelectItem value="superadmin">Administrador</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                {formData.role === 'student' && (
                                    <div className="grid gap-2">
                                        <div className="flex items-center justify-between">
                                            <Label htmlFor="student_code">Código do Aluno</Label>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 text-xs text-purple-600 hover:text-purple-700"
                                                onClick={() => setFormData({ ...formData, student_code: getNextStudentCode() })}
                                                type="button"
                                            >
                                                Regerar Código
                                            </Button>
                                        </div>
                                        <Input
                                            id="student_code"
                                            value={formData.student_code || ''}
                                            onChange={(e) => setFormData({ ...formData, student_code: e.target.value })}
                                            placeholder="EX: 0101010"
                                        />
                                    </div>
                                )}
                            </>
                        )}

                        {/* Cuando es EDICIÓN, mostrar solo info y opciones de gestión */}
                        {editingUser && (
                            <>
                                {/* Info del usuario (solo lectura) */}
                                <div className="p-3 bg-slate-50 rounded-lg border space-y-1">
                                    <p className="font-medium text-slate-900">{editingUser.full_name}</p>
                                    <p className="text-sm text-slate-500">
                                        {editingUser.real_email || editingUser.email || 'Sin email'}
                                    </p>
                                    <div className="flex items-center gap-2 mt-2">
                                        <Badge variant={editingUser.role === 'student' ? 'default' : 'secondary'}>
                                            {editingUser.role === 'student' ? 'Aluno' :
                                                editingUser.role === 'professor' ? 'Professor' : 'Admin'}
                                        </Badge>
                                        {editingUser.student_code && (
                                            <Badge variant="outline">Código: {editingUser.student_code}</Badge>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}



                        {/* Estado da conta - solo para edición */}
                        {editingUser && (
                            <div className="flex items-center justify-between p-3 border rounded-lg bg-orange-50 border-orange-100">
                                <div className="space-y-0.5">
                                    <Label className="text-orange-900">Estado da Conta</Label>
                                    <p className="text-xs text-orange-700">
                                        {formData.is_active ? 'Conta ativa' : 'Conta inativa'}
                                    </p>
                                </div>
                                <Button
                                    variant={formData.is_active ? "destructive" : "default"}
                                    size="sm"
                                    type="button"
                                    onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                                >
                                    {formData.is_active ? 'Inativar' : 'Ativar'}
                                </Button>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" type="button" onClick={() => setIsUserDialogOpen(false)}>
                            Cancelar
                        </Button>
                        <Button onClick={handleSaveUser} disabled={isSubmitting} className="bg-purple-600 hover:bg-purple-700">
                            {isSubmitting ? (
                                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</>
                            ) : (
                                'Salvar'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            {/* Dialog para editar permissões de perfil */}
            <Dialog open={isSettingsDialogOpen} onOpenChange={setIsSettingsDialogOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Editar Permissões - {editingRole}</DialogTitle>
                        <DialogDescription>
                            Selecione quais abas e recursos estarão visíveis para este papel.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-4 space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            {(editingRole === 'student'
                                ? ['dashboard', 'clases', 'chat', 'desempenho', 'faturas']
                                : ['inicio', 'agenda', 'alunos', 'aulas', 'conversas', 'preferencias', 'admtab', 'global']
                            ).map(tabId => (
                                <div key={tabId} className="flex items-center space-x-2 border p-3 rounded-lg hover:bg-slate-50 cursor-pointer"
                                    onClick={() => togglePermission(tabId)}>
                                    <div className={`w-5 h-5 rounded border flex items-center justify-center ${tempPermissions.tabs?.includes(tabId) ? 'bg-purple-600 border-purple-600' : 'border-slate-300'}`}>
                                        {tempPermissions.tabs?.includes(tabId) && <UserCheck className="h-3 w-3 text-white" />}
                                    </div>
                                    <Label className="capitalize cursor-pointer flex-1">{tabId}</Label>
                                </div>
                            ))}
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsSettingsDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSaveRoleSettings} disabled={isSubmitting} className="bg-purple-600 hover:bg-purple-700">
                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar Alterações'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Diálogo de Confirmação de Exclusão */}
            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-600">
                            <Trash2 className="h-5 w-5" />
                            Confirmar Exclusão
                        </DialogTitle>
                        <DialogDescription>
                            Tem certeza que deseja excluir permanentemente o usuário <strong>{userToDelete?.full_name}</strong>?
                            <br /><br />
                            Esta ação não pode ser desfeita e pode falhar se o usuário possuir registros vinculados no sistema.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} disabled={isSubmitting}>
                            Cancelar
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleConfirmDelete}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Confirmar Exclusão
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div >
    );
};

export default AdminTab;
