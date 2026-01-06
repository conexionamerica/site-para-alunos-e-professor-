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
import { Checkbox } from '@/components/ui/checkbox';
import { formatCPF, validateCPF, cleanCPF, maskCPF } from '@/lib/cpfUtils';
import { formatPhone, validatePhone, cleanPhone, formatCEP, cleanCEP } from '@/lib/phoneUtils';
import { useFormPersistence } from '@/hooks/useFormPersistence';

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

    // Form state with persistence - Campos essenciais + professor
    const [formData, setFormData, clearFormData] = useFormPersistence('admin_user_form', {
        full_name: '',
        email: '',
        password: '',
        role: 'student',
        is_active: true,
        assigned_professor_id: '' // Campo para selecionar professor
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
            profile.student_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            profile.cpf?.includes(cleanCPF(searchTerm)); // NOVO: busca por CPF
        const matchesRole = roleFilter === 'all' || profile.role === roleFilter;
        return matchesSearch && matchesRole;
    });

    // Filter class slots for preferences
    const filteredClassSlots = professorFilter === 'all'
        ? data.classSlots || []
        : (data.classSlots || []).filter(slot => slot.professor_id === professorFilter);

    // REMOVIDO: generatePasswordFromNameAndBirthdate não é mais usada
    // const generatePasswordFromNameAndBirthdate = (fullName, birthDate) => {
    //     if (!fullName || !birthDate) {
    //         // Fallback para senha aleatória se não tiver os dados
    //         const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    //         let password = '';
    //         for (let i = 0; i < 10; i++) {
    //             password += chars.charAt(Math.floor(Math.random() * chars.length));
    //         }
    //         return password;
    //     }

    //     // Pegar primeiro nome (tudo antes do primeiro espaço)
    //     const firstName = fullName.trim().split(' ')[0];

    //     // Capitalizar primeira letra, o resto em minúsculo
    //     const capitalizedFirstName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();

    //     // Pegar ano da data de nascimento de forma robusta
    //     // O formato vindo do input type="date" é YYYY-MM-DD
    //     let year = '';
    //     if (birthDate.includes('-')) {
    //         year = birthDate.split('-')[0];
    //     } else {
    //         // Fallback se vier em outro formato
    //         const date = new Date(birthDate);
    //         const fullYear = date.getFullYear();
    //         year = isNaN(fullYear) ? '' : fullYear.toString();
    //     }

    //     if (!year || year === '1969' || year === '1970') {
    //         // Se falhou ou pegou data base do unix, tenta pegar os últimos 4 caracteres se parecer um ano
    //         const match = birthDate.match(/\d{4}/);
    //         year = match ? match[0] : "2000";
    //     }

    //     // Senha = PrimeiroNome + Ano (ex: Maria2005)
    //     return `${capitalizedFirstName}${year}`;
    // };

    const getNextStudentCode = () => {
        // Usar allProfiles para garantir que pegamos o maior código de ALL os perfis do sistema,
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

    // Open dialog for new user - SIMPLIFICADO
    const handleNewUser = () => {
        setEditingUser(null);
        setFormData({
            full_name: '',
            email: '',
            password: '',
            role: 'student',
            is_active: true
        });
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
            phone: user.phone || '', // NOVO
            role: user.role || 'student',
            student_code: user.student_code || '',
            assigned_professor_id: user.assigned_professor_id || '',
            cpf: user.cpf || '', // NOVO
            birth_date: user.birth_date || '', // NOVO
            gender: user.gender || '', // NOVO
            address_street: user.address_street || '', // NOVO
            address_number: user.address_number || '', // NOVO
            address_complement: user.address_complement || '', // NOVO
            address_neighborhood: user.address_neighborhood || '', // NOVO
            address_city: user.address_city || '', // NOVO
            address_state: user.address_state || '', // NOVO
            address_zip_code: user.address_zip_code || '', // NOVO
            registration_status: user.registration_status || 'pre_registered', // NOVO
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

    // Save user (create or update) - SIMPLIFICADO
    const handleSaveUser = async () => {
        // Validações básicas - apenas Nome e E-mail são obrigatórios
        if (!formData.full_name.trim() || !formData.email.trim()) {
            toast({
                title: 'Erro',
                description: 'Nome e E-mail são obrigatórios.',
                variant: 'destructive'
            });
            return;
        }

        // Validar senha apenas para novos usuários
        if (!editingUser && !formData.password) {
            toast({
                title: 'Erro',
                description: 'Senha é obrigatória para novos usuários.',
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
                // Verificar se é uma nova atribuição de professor (mudança de professor)
                const oldProfessorId = editingUser.assigned_professor_id;
                // Update existing user
                const updateData = {
                    full_name: formData.full_name?.trim(),
                    email: formData.email?.trim().toLowerCase(), // Update email stored in profiles (optional)
                    phone: cleanPhone(formData.phone),
                    student_code: formData.student_code?.trim() || null,
                    role: formData.role, // Allow role change
                    responsible_name: formData.responsible_name?.trim(),
                    responsible_phone: cleanPhone(formData.responsible_phone),
                    academic_level: formData.academic_level,
                    spanish_level: formData.spanish_level,
                    learning_goals: formData.learning_goals,
                    observations: formData.observations,
                    cpf: cleanCPF(formData.cpf) || null,
                    birth_date: formData.birth_date || null,
                    gender: formData.gender || null,
                    address_street: formData.address_street || null,
                    address_number: formData.address_number || null,
                    address_complement: formData.address_complement || null,
                    address_neighborhood: formData.address_neighborhood || null,
                    address_city: formData.address_city || null,
                    address_state: formData.address_state || null,
                    address_zip_code: cleanCEP(formData.address_zip_code) || null,
                    registration_status: formData.registration_status || 'pre_registered',
                    is_active: formData.is_active // Persistir estado activo/inativo
                };

                const { error: updateError } = await supabase
                    .from('profiles')
                    .update(updateData)
                    .eq('id', editingUser.id);

                if (updateError) {
                    // Check unique constraint violation
                    if (updateError.message?.includes('duplicate key')) {
                        throw new Error('Já existe outro usuário com estes dados.');
                    }
                    throw updateError;
                }

                toast({
                    title: 'Usuário atualizado!',
                    description: 'Os dados foram salvos com sucesso.',
                });
            } else {
                // Criar novo usuário via RPC - SIMPLIFICADO
                try {
                    // A senha é passada exatamente como digitada (respeitando símbolos, maiúsculas, minúsculas)
                    const { data: newUserId, error: rpcError } = await supabase.rpc('admin_create_user', {
                        p_email: formData.email.trim().toLowerCase(),
                        p_password: formData.password, // Senha exatamente como digitada
                        p_full_name: (formData.full_name || '').trim(),
                        p_role: formData.role
                        // Demais parâmetros são opcionais (usam DEFAULT no SQL)
                    });

                    if (rpcError) {
                        throw new Error(rpcError.message);
                    }

                    toast({
                        title: 'Sucesso!',
                        description: `Usuário criado com sucesso. Senha: ${formData.password}`,
                        duration: 10000,
                    });
                } catch (rpcException) {
                    console.error('Exception during user creation via RPC:', rpcException);
                    throw rpcException;
                }
            }

            setIsUserDialogOpen(false);
            clearFormData();
            onUpdate?.();
        } catch (error) {
            console.error('Error saving user:', error);
            let errorDescription = error.message || 'Erro desconhecido ao salvar usuário.';

            // Mensajes de error más amigáveis
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

        // REMOVIDA TRAVA DE SEGURANÇA: Administrador pode excluir a qualquer momento.
        // if (userToDelete.is_active !== false) { ... }

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
        // Garantir que actions existe com valores padrão
        const permissions = settings?.permissions || { tabs: [] };
        if (!permissions.actions) {
            permissions.actions = {
                can_manage_classes: role === 'professor' || role === 'superadmin',
                can_manage_students: role === 'professor' || role === 'superadmin'
            };
        }
        setTempPermissions(permissions);
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

    const toggleActionPermission = (actionKey) => {
        const currentActions = tempPermissions.actions || {};
        setTempPermissions({
            ...tempPermissions,
            actions: {
                ...currentActions,
                [actionKey]: !currentActions[actionKey]
            }
        });
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
                <TabsContent value="preferencias" className="mt-6 space-y-6">
                    {/* Sección fija para Incluir Aulas */}
                    <PreferenciasTab
                        hideTable={true}
                        dashboardData={{
                            ...dashboardData,
                            professorId: professorFilter // Pode ser 'all'
                        }}
                    />

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
                                <PreferenciasTab
                                    hideForm={true}
                                    dashboardData={{
                                        ...dashboardData,
                                        data: {
                                            ...data,
                                            classSlots: filteredClassSlots
                                        },
                                        professorId: professorFilter
                                    }}
                                />
                            ) : (
                                <div className="text-center py-8 text-slate-500">
                                    <Settings className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                                    <p>Selecione um professor no filtro acima para ver e editar seus horários semanais.</p>
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
                                            placeholder="Nome, código ou CPF..."
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
                                            <TableHead>Telefone</TableHead>
                                            <TableHead>CPF</TableHead>
                                            <TableHead>Código</TableHead>
                                            <TableHead>Tipo</TableHead>
                                            <TableHead>Status Cadastro</TableHead>
                                            <TableHead>Professor Vinculado</TableHead>
                                            <TableHead>Estado</TableHead>
                                            <TableHead className="text-right">Ações</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredProfiles.length > 0 ? filteredProfiles.map(profile => (
                                            <TableRow key={profile.id}>
                                                <TableCell className="font-medium">{profile.full_name}</TableCell>
                                                <TableCell className="text-slate-500">{formatPhone(profile.phone) || '—'}</TableCell>
                                                <TableCell className="text-slate-500">{profile.cpf ? maskCPF(profile.cpf) : '—'}</TableCell>
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
                                                    {profile.role === 'student' ? (
                                                        profile.registration_status === 'complete' ? (
                                                            <Badge className="bg-green-100 text-green-700 border-green-300">Completo</Badge>
                                                        ) : (
                                                            <Badge variant="outline" className="text-amber-700 border-amber-300">Pré-cadastro</Badge>
                                                        )
                                                    ) : (
                                                        <Badge className="bg-blue-100 text-blue-700 border-blue-300">—</Badge>
                                                    )}
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
                <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingUser ? 'Gerenciar Usuário' : 'Novo Usuário'}</DialogTitle>
                        <DialogDescription>
                            {editingUser ? 'Gerencie o vínculo com professor e status da conta.' : 'Preencha os dados do novo usuário.'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        {/* FORMULÁRIO SIMPLIFICADO PARA NOVO USUÁRIO */}
                        {!editingUser && (
                            <>
                                {/* 1. Nome Completo */}
                                <div className="grid gap-2">
                                    <Label htmlFor="full_name">Nome completo *</Label>
                                    <Input
                                        id="full_name"
                                        value={formData.full_name}
                                        onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                        placeholder="Nome completo do usuário"
                                        autoFocus
                                    />
                                </div>

                                {/* 2. E-mail */}
                                <div className="grid gap-2">
                                    <Label htmlFor="email">E-mail *</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        placeholder="usuario@email.com"
                                    />
                                    <p className="text-xs text-slate-500">Este será o e-mail de login do usuário.</p>
                                </div>

                                {/* 3. Senha */}
                                <div className="p-4 bg-purple-50 rounded-lg space-y-2 border border-purple-200">
                                    <Label htmlFor="password_new" className="text-sm text-purple-700 font-semibold">Senha *</Label>
                                    <Input
                                        id="password_new"
                                        type="text"
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        placeholder="Digite a senha (letras, números, símbolos)"
                                        className="font-mono text-base bg-white border-purple-300"
                                    />
                                    <p className="text-xs text-purple-600">
                                        A senha será salva exatamente como digitada, respeitando maiúsculas, minúsculas e símbolos.
                                    </p>
                                </div>

                                {/* 4. Perfil/Role */}
                                <div className="grid gap-2">
                                    <Label htmlFor="role">Perfil de Usuário *</Label>
                                    <Select
                                        value={formData.role}
                                        onValueChange={(value) => setFormData({ ...formData, role: value })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecione um tipo" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="student">Aluno</SelectItem>
                                            <SelectItem value="professor">Professor</SelectItem>
                                            {/* Admin creation restricted to DB/Superadmin manually for safety or enable here */}
                                            {/* <SelectItem value="admin">Administrador</SelectItem> */}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </>
                        )}

                        {/* Info del usuario (solo lectura) para EDICIÓN */}
                        {editingUser && (
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
                        )}

                        {/* Seção de Dados Complementares para EDIÇÃO */}
                        {editingUser && (
                            <div className="border-t pt-4 mt-4">
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="font-semibold text-sm text-slate-700">
                                        Dados Complementares
                                    </h4>
                                    {editingUser.registration_status === 'complete' ? (
                                        <Badge className="bg-green-100 text-green-700 border-green-300">
                                            Cadastro Completo
                                        </Badge>
                                    ) : (
                                        <Badge variant="outline" className="text-amber-700 border-amber-300">
                                            Pré-cadastro
                                        </Badge>
                                    )}
                                </div>
                                <p className="text-xs text-slate-500 mb-4">
                                    Atualize os dados para cadastro completo. Necessário para contratos e títulos financeiros.
                                </p>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="edit_phone">Telefone *</Label>
                                        <Input
                                            id="edit_phone"
                                            value={formatPhone(formData.phone)}
                                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                            placeholder="(00) 00000-0000"
                                            maxLength={15}
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="edit_cpf">CPF</Label>
                                        <Input
                                            id="edit_cpf"
                                            value={formatCPF(formData.cpf)}
                                            onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                                            placeholder="000.000.000-00"
                                            maxLength={14}
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="edit_birth_date">Data de Nascimento</Label>
                                        <Input
                                            id="edit_birth_date"
                                            type="date"
                                            value={formData.birth_date}
                                            onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="mt-4">
                                    <h5 className="font-medium text-sm text-slate-700 mb-3">Endereço</h5>
                                    <div className="grid gap-3">
                                        <div className="grid grid-cols-3 gap-3">
                                            <div className="col-span-2 grid gap-2">
                                                <Label htmlFor="edit_address_street">Rua</Label>
                                                <Input
                                                    id="edit_address_street"
                                                    value={formData.address_street}
                                                    onChange={(e) => setFormData({ ...formData, address_street: e.target.value })}
                                                    placeholder="Nome da rua"
                                                />
                                            </div>
                                            <div className="grid gap-2">
                                                <Label htmlFor="edit_address_number">Número</Label>
                                                <Input
                                                    id="edit_address_number"
                                                    value={formData.address_number}
                                                    onChange={(e) => setFormData({ ...formData, address_number: e.target.value })}
                                                    placeholder="123"
                                                />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="grid gap-2">
                                                <Label htmlFor="edit_address_complement">Complemento</Label>
                                                <Input
                                                    id="edit_address_complement"
                                                    value={formData.address_complement}
                                                    onChange={(e) => setFormData({ ...formData, address_complement: e.target.value })}
                                                    placeholder="Apto, bloco..."
                                                />
                                            </div>
                                            <div className="grid gap-2">
                                                <Label htmlFor="edit_address_neighborhood">Bairro</Label>
                                                <Input
                                                    id="edit_address_neighborhood"
                                                    value={formData.address_neighborhood}
                                                    onChange={(e) => setFormData({ ...formData, address_neighborhood: e.target.value })}
                                                    placeholder="Nome do bairro"
                                                />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-3 gap-3">
                                            <div className="grid gap-2">
                                                <Label htmlFor="edit_address_city">Cidade</Label>
                                                <Input
                                                    id="edit_address_city"
                                                    value={formData.address_city}
                                                    onChange={(e) => setFormData({ ...formData, address_city: e.target.value })}
                                                    placeholder="Cidade"
                                                />
                                            </div>
                                            <div className="grid gap-2">
                                                <Label htmlFor="edit_address_state">Estado</Label>
                                                <Select
                                                    value={formData.address_state}
                                                    onValueChange={(value) => setFormData({ ...formData, address_state: value })}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="UF" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="AC">AC</SelectItem>
                                                        <SelectItem value="AL">AL</SelectItem>
                                                        <SelectItem value="AP">AP</SelectItem>
                                                        <SelectItem value="AM">AM</SelectItem>
                                                        <SelectItem value="BA">BA</SelectItem>
                                                        <SelectItem value="CE">CE</SelectItem>
                                                        <SelectItem value="DF">DF</SelectItem>
                                                        <SelectItem value="ES">ES</SelectItem>
                                                        <SelectItem value="GO">GO</SelectItem>
                                                        <SelectItem value="MA">MA</SelectItem>
                                                        <SelectItem value="MT">MT</SelectItem>
                                                        <SelectItem value="MS">MS</SelectItem>
                                                        <SelectItem value="MG">MG</SelectItem>
                                                        <SelectItem value="PA">PA</SelectItem>
                                                        <SelectItem value="PB">PB</SelectItem>
                                                        <SelectItem value="PR">PR</SelectItem>
                                                        <SelectItem value="PE">PE</SelectItem>
                                                        <SelectItem value="PI">PI</SelectItem>
                                                        <SelectItem value="RJ">RJ</SelectItem>
                                                        <SelectItem value="RN">RN</SelectItem>
                                                        <SelectItem value="RS">RS</SelectItem>
                                                        <SelectItem value="RO">RO</SelectItem>
                                                        <SelectItem value="RR">RR</SelectItem>
                                                        <SelectItem value="SC">SC</SelectItem>
                                                        <SelectItem value="SP">SP</SelectItem>
                                                        <SelectItem value="SE">SE</SelectItem>
                                                        <SelectItem value="TO">TO</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="grid gap-2">
                                                <Label htmlFor="edit_address_zip_code">CEP</Label>
                                                <Input
                                                    id="edit_address_zip_code"
                                                    value={formatCEP(formData.address_zip_code)}
                                                    onChange={(e) => setFormData({ ...formData, address_zip_code: e.target.value })}
                                                    placeholder="00000-000"
                                                    maxLength={9}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* PERMISSÕES: Agora gerenciadas exclusivamente na aba "Perfis" */}
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <p className="text-xs text-blue-800">
                                <strong>💡 Nota:</strong> As permissões de acesso (Ações em Aulas e Alunos) são configuradas por tipo de perfil na aba <strong>"Perfis"</strong>.
                            </p>
                        </div>

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

                    <div className="py-4 space-y-6">
                        {/* Seção de Abas */}
                        <div className="space-y-3">
                            <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                <UserCheck className="h-4 w-4" />
                                Abas Visíveis
                            </h4>
                            <div className="grid grid-cols-2 gap-3">
                                {(editingRole === 'student'
                                    ? ['dashboard', 'clases', 'chat', 'desempenho', 'faturas']
                                    : ['inicio', 'agenda', 'alunos', 'aulas', 'conversas', 'servicos', 'financeiro', 'preferencias', 'admtab', 'global']
                                ).map(tabId => {
                                    const labels = {
                                        inicio: 'Início',
                                        agenda: 'Agenda',
                                        alunos: 'Alunos',
                                        aulas: 'Aulas',
                                        conversas: 'Conversas',
                                        servicos: 'Serviços',
                                        financeiro: 'Financeiro',
                                        preferencias: 'Preferências',
                                        admtab: 'Admin',
                                        global: 'Global',
                                        dashboard: 'Dashboard',
                                        clases: 'Aulas (Aluno)',
                                        chat: 'Chat',
                                        desempenho: 'Desempenho',
                                        faturas: 'Faturas'
                                    };
                                    return (
                                        <div key={tabId} className="flex items-center space-x-2 border p-3 rounded-lg hover:bg-slate-50 cursor-pointer"
                                            onClick={() => togglePermission(tabId)}>
                                            <div className={`w-5 h-5 rounded border flex items-center justify-center ${tempPermissions.tabs?.includes(tabId) ? 'bg-purple-600 border-purple-600' : 'border-slate-300'}`}>
                                                {tempPermissions.tabs?.includes(tabId) && <UserCheck className="h-3 w-3 text-white" />}
                                            </div>
                                            <Label className="capitalize cursor-pointer flex-1">{labels[tabId] || tabId}</Label>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Seção de Permissões de Ações */}
                        {editingRole !== 'student' && (
                            <div className="space-y-3 pt-4 border-t">
                                <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                    <Shield className="h-4 w-4" />
                                    Permissões de Ações
                                </h4>
                                <div className="space-y-2">
                                    <div
                                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50 cursor-pointer"
                                        onClick={() => toggleActionPermission('can_manage_classes')}
                                    >
                                        <div className="flex-1">
                                            <Label className="cursor-pointer font-medium text-slate-800">Gerenciar Aulas</Label>
                                            <p className="text-xs text-slate-500 mt-0.5">Permitir editar e excluir aulas</p>
                                        </div>
                                        <div className={`w-11 h-6 rounded-full transition-colors ${tempPermissions.actions?.can_manage_classes ? 'bg-purple-600' : 'bg-slate-300'}`}>
                                            <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 mt-0.5 ${tempPermissions.actions?.can_manage_classes ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                        </div>
                                    </div>
                                    <div
                                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50 cursor-pointer"
                                        onClick={() => toggleActionPermission('can_manage_students')}
                                    >
                                        <div className="flex-1">
                                            <Label className="cursor-pointer font-medium text-slate-800">Gerenciar Alunos</Label>
                                            <p className="text-xs text-slate-500 mt-0.5">Permitir editar e excluir alunos</p>
                                        </div>
                                        <div className={`w-11 h-6 rounded-full transition-colors ${tempPermissions.actions?.can_manage_students ? 'bg-purple-600' : 'bg-slate-300'}`}>
                                            <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 mt-0.5 ${tempPermissions.actions?.can_manage_students ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
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
