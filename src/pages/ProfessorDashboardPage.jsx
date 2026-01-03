// Arquivo: src/pages/ProfessorDashboardPage.jsx

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LogOut, Home, BookOpen, Calendar, Users, MessageSquare, Settings, Menu, Loader2, AlertTriangle, Shield, LayoutDashboard, Filter, Headphones, DollarSign, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import HomeTab from '@/components/professor-dashboard/HomeTab';
import AulasTab from '@/components/professor-dashboard/AulasTab';
import AgendaTab from '@/components/professor-dashboard/AgendaTab';
import AlunosTab from '@/components/professor-dashboard/AlunosTab';
import ConversasTab from '@/components/professor-dashboard/ConversasTab';
import PreferenciasTab from '@/components/professor-dashboard/PreferenciasTab';
import AdminTab from '@/components/professor-dashboard/AdminTab';
import ServicosTab from '@/components/professor-dashboard/ServicosTab';
import FinanceiroTab from '@/components/professor-dashboard/FinanceiroTab';
import { useToast } from '@/components/ui/use-toast';
import { Link } from 'react-router-dom';
import { getBrazilDate } from '@/lib/dateUtils';

// Función de busca de datos
const fetchProfessorDashboardData = async (professorId, isSuperadmin = false) => {
    const today = getBrazilDate().toISOString();

    // 1. Fetch del perfil del usuario (solo nombre y rol)
    const { data: userProfile, error: profProfileError } = await supabase
        .from('profiles')
        .select('full_name, role, can_manage_classes, can_manage_students')
        .eq('id', professorId)
        .maybeSingle();
    if (profProfileError) throw profProfileError;

    // 2. Fetch de Solicitacoes (para HomeTab)
    // Superadmin ve TODAS las solicitudes, profesor solo las suyas
    let scheduleRequestsQuery = supabase
        .from('solicitudes_clase')
        .select(`*, profile:profiles!alumno_id(*), profesor:profiles!profesor_id(full_name)`)
        .eq('status', 'Pendiente')
        .order('solicitud_id', { ascending: true });

    if (!isSuperadmin) {
        scheduleRequestsQuery = scheduleRequestsQuery.eq('profesor_id', professorId);
    }

    const { data: scheduleRequests, error: reqError } = await scheduleRequestsQuery;
    if (reqError) throw reqError;

    // 3. Fetch de TODAS as Próximas Aulas agendadas (para HomeTab)
    let upcomingClassesQuery = supabase
        .from('appointments')
        .select(`*, student:profiles!student_id(full_name, spanish_level), professor:profiles!professor_id(full_name)`)
        .in('status', ['scheduled', 'rescheduled'])
        .gte('class_datetime', today)
        .order('class_datetime', { ascending: true });

    if (!isSuperadmin) {
        upcomingClassesQuery = upcomingClassesQuery.eq('professor_id', professorId);
    }

    const { data: upcomingClasses, error: upcomingClassesError } = await upcomingClassesQuery;
    if (upcomingClassesError && upcomingClassesError.code !== 'PGRST116') throw upcomingClassesError;

    // 4. Fetch de ALL os Perfis (para AdmTab y AlunosTab)
    const { data: allProfiles, error: allProfilesError } = await supabase
        .from('profiles')
        .select('*, created_at, phone, cpf, birth_date, registration_status, address_street, address_city, address_state, address_zip_code')
        .order('role', { ascending: true })
        .order('full_name', { ascending: true });
    if (allProfilesError) throw allProfilesError;

    // Filter students and professors from all profiles
    const students = allProfiles.filter(p => p.role === 'student');
    const professors = allProfiles.filter(p => p.role === 'professor');

    // 5. Fetch de Pacotes (para PreferenciasTab)
    const { data: packages, error: packagesError } = await supabase
        .from('packages')
        .select('*');
    if (packagesError) throw packagesError;

    // 6. Fetch de Slots (para PreferenciasTab)
    // Superadmin ve todos los slots, profesor solo los suyos
    let classSlotsQuery = supabase.from('class_slots').select('*');
    if (!isSuperadmin) {
        classSlotsQuery = classSlotsQuery.eq('professor_id', professorId);
    }
    const { data: classSlots, error: slotsError } = await classSlotsQuery;
    if (slotsError) throw slotsError;

    // 7. Fetch de Todos los Agendamentos (para AulasTab, AlunosTab)
    let appointmentsQuery = supabase
        .from('appointments')
        .select(`*, student:profiles!student_id(full_name, spanish_level, student_code, avatar_url), professor:profiles!professor_id(full_name)`)
        .order('class_datetime', { ascending: false });

    if (!isSuperadmin) {
        appointmentsQuery = appointmentsQuery.eq('professor_id', professorId);
    }

    const { data: appointments, error: appointmentsError } = await appointmentsQuery;
    if (appointmentsError) {
        console.error("Erro no fetch de appointments:", appointmentsError);
    }

    // 8. Fetch de Faturas y Logs (para AlunosTab, PreferenciasTab)
    const { data: allBillings, error: billingsError } = await supabase
        .from('billing')
        .select('*, packages(name)')
        .order('purchase_date', { ascending: false });
    if (billingsError) throw billingsError;

    const { data: assignedLogs, error: logsError } = await supabase
        .from('assigned_packages_log')
        .select('*');
    if (logsError) throw logsError;

    const { data: chatList, error: chatListError } = await supabase.rpc('get_professor_chat_list', { p_id: professorId });
    if (chatListError && chatListError.code !== '42883') throw chatListError;

    // 10. Fetch de configurações de role (permissões de abas)
    const { data: roleSettings, error: roleSettingsError } = await supabase
        .from('role_settings')
        .select('*');
    if (roleSettingsError && roleSettingsError.code !== 'PGRST116') {
        console.error("Erro ao buscar role_settings:", roleSettingsError);
    }

    // 11. Permissões de ações baseadas APENAS em role_settings
    // IMPORTANTE: Ignora permissões individuais (can_manage_classes/can_manage_students na tabela profiles)
    // Sempre usa as configurações do perfil (role) definidas em role_settings
    const userRoleSettings = roleSettings?.find(rs => rs.role === userProfile?.role);
    const roleActions = userRoleSettings?.permissions?.actions || {};

    // Usar SEMPRE as permissões do role, com fallback para true se não definido
    const can_manage_classes = roleActions.can_manage_classes ?? true;
    const can_manage_students = roleActions.can_manage_students ?? true;

    return {
        professorId,
        professorName: userProfile?.full_name || (isSuperadmin ? 'Administrador' : 'Professor(a)'),
        userRole: userProfile?.role || 'professor',
        isSuperadmin,
        scheduleRequests: scheduleRequests || [],
        upcomingClasses: upcomingClasses || [],
        students: students || [],
        professors: professors || [],
        allProfiles: allProfiles || [],
        packages: packages || [],
        classSlots: classSlots || [],
        appointments: appointments || [],
        allBillings: allBillings || [],
        assignedLogs: assignedLogs || [],
        chatList: chatList || [],
        roleSettings: roleSettings || [],
        can_manage_classes,
        can_manage_students,
    };
};

const Logo = () => (
    <Link to="/" className="flex items-baseline gap-1 hover:opacity-80 transition-opacity">
        <span className="text-xl sm:text-2xl font-bold text-sky-500">Conexión</span>
        <span className="text-xl sm:text-2xl font-bold text-slate-800">América</span>
    </Link>
);


const ProfessorDashboardPage = () => {
    const { user, profile, signOut } = useAuth();
    const { toast } = useToast();
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = useState('home');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [dashboardData, setDashboardData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);
    const [hasUnreadMessages, setHasUnreadMessages] = useState(false);

    // NOVO: Estado para filtro global de professor (para superusuários)
    const [globalProfessorFilter, setGlobalProfessorFilter] = useState('all');

    const handleLogout = async () => {
        await signOut();
        navigate('/professor-login');
    };

    const fetchData = useCallback(async () => {
        const currentUserId = user?.id;
        if (!currentUserId) {
            setIsLoading(true);
            return;
        }

        setIsLoading(true);
        setHasError(false);
        try {
            // Primero verificar si el usuario es superadmin
            const { data: userProfile } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', currentUserId)
                .maybeSingle();

            const isSuperadmin = userProfile?.role === 'superadmin' || userProfile?.role === 'admin';

            const data = await fetchProfessorDashboardData(currentUserId, isSuperadmin);

            setDashboardData({
                data: {
                    ...data,
                    // Garantir que as permissões estejam acessíveis dentro do objeto data
                    can_manage_classes: data.can_manage_classes,
                    can_manage_students: data.can_manage_students
                },
                professorId: data.professorId,
                professorName: data.professorName,
                userRole: data.userRole,
                isSuperadmin: data.isSuperadmin,
                loading: false,
                onUpdate: fetchData
            });
        } catch (error) {
            console.error("Erro ao carregar dados do dashboard:", error);
            const errorMessage = error.message || 'Erro desconhecido ao conectar ao Supabase.';
            setHasError(true);
            setDashboardData(null);
            toast({
                variant: 'destructive',
                title: 'Erro de Conexão',
                description: `Não foi possível carregar os dados do dashboard. Detalhes: ${errorMessage}`
            });
        } finally {
            setIsLoading(false);
        }
    }, [user?.id, toast]);

    // Solo se ejecuta una vez al tener el usuario autenticado
    useEffect(() => {
        if (user?.id) {
            fetchData();
        } else if (user === null && !profile && !isLoading) {
            // Caso de que la sessão haya terminado de cargar y no haya user. Redirecciona.
            navigate('/professor-login');
        }
    }, [user, navigate, fetchData]);

    // Suscripción en tiempo real para actualizaciones automáticas
    useEffect(() => {
        if (!user?.id) return;

        // Canales de subscripción para actualización automática
        const appointmentsChannel = supabase
            .channel('appointments-changes')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'appointments'
            }, () => {
                // fetchData(); // DESABILITADO: Causava refresh automático e perda de dados
            })
            .subscribe();

        const requestsChannel = supabase
            .channel('requests-changes')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'solicitudes_clase'
            }, () => {
                // fetchData(); // DESABILITADO: Causava refresh automático e perda de dados
            })
            .subscribe();

        const profilesChannel = supabase
            .channel('profiles-changes')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'profiles'
            }, () => {
                // fetchData(); // DESABILITADO: Causava refresh automático e perda de dados
            })
            .subscribe();

        return () => {
            supabase.removeChannel(appointmentsChannel);
            supabase.removeChannel(requestsChannel);
            supabase.removeChannel(profilesChannel);
        };
    }, [user?.id, fetchData]);

    // Função para verificar o tamanho da tela e fechar a sidebar
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth >= 1024) {
                setIsSidebarOpen(false);
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Buscar mensagens não lidas
    useEffect(() => {
        const checkUnreadMessages = async () => {
            if (!user?.id) return;

            try {
                // 1. Buscar os IDs dos chats que pertencem a este professor
                const { data: chats, error: chatsError } = await supabase
                    .from('chats')
                    .select('chat_id')
                    .eq('profesor_id', user.id);

                if (chatsError) throw chatsError;
                if (!chats || chats.length === 0) {
                    setHasUnreadMessages(false);
                    return;
                }

                const chatIds = chats.map(c => c.chat_id);

                // 2. Contar mensagens não lidas nesses chats (que não foram enviadas pelo professor)
                const { count, error: msgError } = await supabase
                    .from('mensajes')
                    .select('mensaje_id', { count: 'exact', head: true })
                    .in('chat_id', chatIds)
                    .neq('remitente_id', user.id)
                    .eq('leido', false);

                if (msgError) throw msgError;
                setHasUnreadMessages(count > 0);
            } catch (err) {
                console.error('Erro ao verificar mensagens não lidas:', err);
            }
        };

        checkUnreadMessages();

        // Realtime para atualizar quando novas mensagens chegam
        const messagesChannel = supabase
            .channel('messages-changes')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'mensajes'
            }, () => {
                checkUnreadMessages();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(messagesChannel);
        };
    }, [user?.id]);

    // Marcar mensagens como lidas quando abrir a aba Conversas
    useEffect(() => {
        if (activeTab === 'conversas' && hasUnreadMessages && user?.id) {
            // Dar um pequeno delay para garantir que o usuário realmente abriu a aba
            const timer = setTimeout(async () => {
                try {
                    // 1. Buscar os IDs dos chats que pertencem a este professor
                    const { data: chats } = await supabase
                        .from('chats')
                        .select('chat_id')
                        .eq('profesor_id', user.id);

                    if (chats && chats.length > 0) {
                        const chatIds = chats.map(c => c.chat_id);

                        // 2. Marcar mensagens não lidas desses chats como lidas
                        await supabase
                            .from('mensajes')
                            .update({ leido: true })
                            .in('chat_id', chatIds)
                            .neq('remitente_id', user.id)
                            .eq('leido', false);
                    }

                    setHasUnreadMessages(false);
                } catch (err) {
                    console.error('Erro ao marcar mensagens como lidas:', err);
                }
            }, 1000);

            return () => clearTimeout(timer);
        }
    }, [activeTab, hasUnreadMessages, user?.id]);

    // Pestañas dinámicas según el rol
    const isSuperadmin = dashboardData?.isSuperadmin || false;

    // Pestañas dinámicas según el rol y configurações de permissão
    const currentRole = profile?.role || dashboardData?.userRole;
    const currentRoleSettings = dashboardData?.data?.roleSettings?.find(s => s.role === currentRole);
    const allowedTabs = currentRoleSettings?.permissions?.tabs || [];

    // NOVA ESTRUTURA DE ABAS CONFORME SOLICITADO
    // Para Superusuários: Painel, Início, Agenda, Conversas, Alunos, Aulas, Administração
    // Para Professores: Início, Agenda, Conversas, Alunos, Aulas, Preferências
    const fullNavItems = isSuperadmin ? [
        { id: 'painel', icon: LayoutDashboard, label: 'Painel', component: HomeTab, permission: 'painel', isPainelTab: true },
        { id: 'home', icon: Home, label: 'Início', component: HomeTab, permission: 'inicio' },
        { id: 'agenda', icon: Calendar, label: 'Agenda', component: AgendaTab, permission: 'agenda' },
        { id: 'conversas', icon: MessageSquare, label: 'Conversas', component: ConversasTab, permission: 'conversas' },
        { id: 'alunos', icon: Users, label: 'Alunos', component: AlunosTab, permission: 'alunos' },
        { id: 'aulas', icon: BookOpen, label: 'Aulas', component: AulasTab, permission: 'aulas' },
        { id: 'servicos', icon: Headphones, label: 'Serviços', component: ServicosTab, permission: 'servicos' },
        { id: 'financeiro', icon: DollarSign, label: 'Financeiro', component: FinanceiroTab, permission: 'financeiro' },
        { id: 'administracao', icon: Shield, label: 'Administração', component: AdminTab, permission: 'admtab' },
    ] : [
        { id: 'home', icon: Home, label: 'Início', component: HomeTab, permission: 'inicio' },
        { id: 'agenda', icon: Calendar, label: 'Agenda', component: AgendaTab, permission: 'agenda' },
        { id: 'conversas', icon: MessageSquare, label: 'Conversas', component: ConversasTab, permission: 'conversas' },
        { id: 'alunos', icon: Users, label: 'Alunos', component: AlunosTab, permission: 'alunos' },
        { id: 'aulas', icon: BookOpen, label: 'Aulas', component: AulasTab, permission: 'aulas' },
        { id: 'servicos', icon: Headphones, label: 'Serviços', component: ServicosTab, permission: 'servicos' },
        { id: 'financeiro', icon: DollarSign, label: 'Financeiro', component: FinanceiroTab, permission: 'financeiro' },
        { id: 'preferencias', icon: Settings, label: 'Preferências', component: PreferenciasTab, permission: 'preferencias' },
    ];

    const navItems = fullNavItems.filter(item => {
        // Superadmin siempre ve todo
        if (isSuperadmin) return true;
        // Si no hay configuración, mostrar todo por defecto para no bloquear acceso
        if (!currentRoleSettings) return true;
        return allowedTabs.includes(item.permission);
    });

    // Preparar dashboardData com filtro de professor aplicado - MEMOIZADO
    const filteredDashboardData = useMemo(() => {
        if (!dashboardData) return null;

        // Se não for superadmin, retorna dados normais (já filtrados no backend)
        // mas ainda adiciona o globalProfessorFilter para referência
        if (!isSuperadmin) {
            return {
                ...dashboardData,
                globalProfessorFilter: 'all'
            };
        }

        // Se for superadmin e filtro = 'all', retorna dados completos
        if (globalProfessorFilter === 'all') {
            return {
                ...dashboardData,
                globalProfessorFilter: 'all'
            };
        }

        // Aplicar filtro de professor nos dados
        const filteredData = {
            ...dashboardData,
            data: {
                ...dashboardData.data,
                // Filtrar appointments
                appointments: (dashboardData.data?.appointments || []).filter(
                    apt => apt.professor_id === globalProfessorFilter
                ),
                // Filtrar alunos vinculados ao professor
                students: (dashboardData.data?.students || []).filter(
                    s => s.assigned_professor_id === globalProfessorFilter
                ),
                // Filtrar scheduleRequests
                scheduleRequests: (dashboardData.data?.scheduleRequests || []).filter(
                    req => req.profesor_id === globalProfessorFilter
                ),
                // Filtrar classSlots
                classSlots: (dashboardData.data?.classSlots || []).filter(
                    slot => slot.professor_id === globalProfessorFilter
                ),
                // Manter todos os slots para lógicas de matching (ex: trocar professor)
                allClassSlots: dashboardData.data?.classSlots || [],
            },
            // Passar o ID do professor filtrado para os componentes
            filteredProfessorId: globalProfessorFilter,
            globalProfessorFilter: globalProfessorFilter,
        };

        return filteredData;
    }, [dashboardData, isSuperadmin, globalProfessorFilter]); // Só recria quando essas dependências mudarem

    // Componente Sidebar (Layout Mobile/Toggle)
    const Sidebar = () => (
        <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: isSidebarOpen ? '0%' : '-100%' }}
            transition={{ duration: 0.3 }}
            className="fixed inset-y-0 left-0 z-40 w-64 bg-gray-900 text-white p-6 shadow-2xl lg:hidden"
        >
            <div className="flex justify-between items-center mb-8 lg:hidden">
                <h2 className="text-2xl font-bold text-blue-400">Dashboard</h2>
                <Button variant="ghost" className="text-white hover:bg-gray-700" onClick={() => setIsSidebarOpen(false)}>
                    <Menu className="h-6 w-6" />
                </Button>
            </div>

            {/* TabsList para navegação Mobile (dentro da Sidebar) */}
            <Tabs value={activeTab} onOpenChange={setActiveTab} orientation="vertical" className="h-full">
                <TabsList className="flex flex-col h-full bg-transparent space-y-2">
                    {navItems.map(item => (
                        <TabsTrigger
                            key={item.id}
                            value={item.id}
                            onClick={() => {
                                setActiveTab(item.id);
                                setIsSidebarOpen(false);
                            }}
                            className={`w-full justify-start text-lg px-4 py-3 rounded-xl transition-all duration-200 ${activeTab === item.id
                                ? 'bg-blue-600 text-white shadow-lg'
                                : item.id === 'conversas' && hasUnreadMessages
                                    ? 'text-blue-800 font-bold hover:bg-gray-800'
                                    : 'text-gray-300 hover:bg-gray-800'
                                }`}
                            disabled={isLoading}
                        >
                            <item.icon className="h-5 w-5 mr-3" />
                            {item.label}
                            {item.id === 'conversas' && hasUnreadMessages && (
                                <span className="ml-auto bg-blue-600 text-white text-xs px-2 py-1 rounded-full">
                                    Nova
                                </span>
                            )}
                        </TabsTrigger>
                    ))}
                </TabsList>
            </Tabs>

            {/* Botão Sair - MANTIDO para a Sidebar Mobile */}
            <Button
                onClick={handleLogout}
                className="w-full justify-start text-lg px-4 py-3 rounded-xl mt-auto bg-transparent border border-red-500 text-red-400 hover:bg-red-900 hover:text-white"
            >
                <LogOut className="h-5 w-5 mr-3" />
                Sair
            </Button>
        </motion.div>
    );

    // FIX LÓGICO DE RENDERIZADO
    if (isLoading || (!dashboardData && !hasError)) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-background">
                <div className="flex flex-col items-center">
                    <Loader2 className="h-12 w-12 text-sky-500 animate-spin" />
                    <p className="mt-4 text-xl font-semibold text-slate-700">Carregando Painel do Professor...</p>
                </div>
            </div>
        );
    }

    if (hasError || !dashboardData) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-background">
                <div className="flex flex-col items-center p-8 bg-white rounded-lg shadow-xl">
                    <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
                    <h2 className="text-2xl font-bold text-slate-800">Erro ao Carregar Dados</h2>
                    <p className="mt-2 text-slate-600 text-center">Não foi possível carregar a informação do dashboard. Verifique sua conexão ou tente novamente.</p>
                    <Button onClick={fetchData} className="mt-4 bg-sky-500 hover:bg-sky-600">
                        Tentar Novamente
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen bg-background">
            {/* Sidebar (Navegação mobile) */}
            <Sidebar />

            {isSidebarOpen && (
                <div
                    className="fixed inset-0 z-30 bg-black opacity-50 lg:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Conteúdo Principal do Dashboard */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header/Navegação Desktop (Topo) */}
                <header className="flex flex-col bg-white shadow-md">
                    {/* Linha superior: Logo e Dropdown - Fundo Branco e Conteúdo */}
                    <div className="w-full flex justify-center items-center h-16 bg-white border-b border-slate-200">
                        <div className="w-full px-4 lg:px-8 flex justify-between items-center">
                            <Logo />
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    {/* Trigger com nome e e-mail no desktop */}
                                    <Button variant="ghost" className="relative h-8 w-auto pr-3 rounded-full text-slate-800 hover:bg-slate-100">
                                        <div className="flex flex-col items-end mr-2">
                                            <p className="text-sm font-medium leading-none">{dashboardData.professorName || 'Professor'}</p>
                                            <p className="text-xs leading-none text-muted-foreground">{user?.email || 'email@escola.com'}</p>
                                        </div>
                                        {/* Avatar Placeholder */}
                                        <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-lg font-bold text-sky-600">
                                            {(user?.email?.[0] || 'P').toUpperCase()}
                                        </div>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-56" align="end" forceMount>
                                    <DropdownMenuLabel className="font-normal">
                                        <div className="flex flex-col space-y-1">
                                            <p className="text-sm font-medium leading-none text-slate-800">{dashboardData.professorName || 'Professor'}</p>
                                            <p className="text-xs leading-none text-muted-foreground">
                                                {user?.email || 'email@escola.com'}
                                            </p>
                                        </div>
                                    </DropdownMenuLabel>
                                    <DropdownMenuSeparator />

                                    {/* Botão Sair com LogOut Icone */}
                                    <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-700">
                                        <LogOut className="mr-2 h-4 w-4" />
                                        Sair
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>

                    {/* Linha inferior: TabsList para Navegação Desktop + Filtro de Professor - Fundo Branco e Alinhamento */}
                    <div className="hidden lg:block bg-white border-b border-slate-200">
                        <div className="w-full px-4 lg:px-8 flex items-center justify-between">
                            <Tabs value={activeTab} onOpenChange={setActiveTab} className="h-full">
                                <TabsList className="justify-start h-auto p-0 bg-transparent rounded-none">
                                    {navItems.map(item => (
                                        <TabsTrigger
                                            key={item.id}
                                            value={item.id}
                                            onClick={() => setActiveTab(item.id)}
                                            className={`relative flex items-center text-base px-4 py-3 mr-2 rounded-none transition-all duration-200 border-b-2 border-transparent 
                                                ${activeTab === item.id
                                                    ? 'text-sky-600 border-sky-600 font-semibold'
                                                    : item.id === 'conversas' && hasUnreadMessages
                                                        ? 'text-blue-800 font-bold hover:text-blue-900'
                                                        : 'text-gray-600 hover:text-gray-800'
                                                }`}
                                        >
                                            <item.icon className="h-5 w-5 mr-2" />
                                            {item.label}
                                            {item.id === 'conversas' && hasUnreadMessages && (
                                                <span className="ml-2 bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">
                                                    Nova
                                                </span>
                                            )}
                                        </TabsTrigger>
                                    ))}
                                </TabsList>
                            </Tabs>

                            {/* FILTRO GLOBAL DE PROFESSOR (apenas para superusuários) */}
                            {isSuperadmin && activeTab !== 'painel' && (
                                <div className="flex items-center gap-2 py-2">
                                    <Filter className="h-4 w-4 text-slate-500" />
                                    <Select value={globalProfessorFilter} onValueChange={setGlobalProfessorFilter}>
                                        <SelectTrigger className="w-[220px] h-9">
                                            <SelectValue placeholder="Filtrar por professor" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Todos os professores</SelectItem>
                                            {(dashboardData?.data?.professors || []).map(prof => (
                                                <SelectItem key={prof.id} value={prof.id}>
                                                    {prof.full_name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        </div>
                    </div>
                    {/* Header Mobile */}
                    <header className="flex items-center justify-between px-4 py-3 bg-white shadow-md lg:hidden">
                        <Button variant="ghost" size="sm" onClick={() => setIsSidebarOpen(true)} className="hover:bg-slate-100">
                            <Menu className="h-6 w-6 text-slate-800" />
                        </Button>
                        <h1 className="text-lg font-bold text-slate-800">Painel do Professor</h1>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                                    <Users className="h-5 w-5" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-56" align="end" forceMount>
                                <DropdownMenuLabel className="font-normal">
                                    <div className="flex flex-col space-y-1">
                                        <p className="text-sm font-medium leading-none text-slate-800">{dashboardData.professorName || 'Professor'}</p>
                                        <p className="text-xs leading-none text-muted-foreground">
                                            {user?.email || 'email@escola.com'}
                                        </p>
                                    </div>
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setActiveTab('preferencias')}>
                                    Preferências
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={handleLogout}>
                                    Sair
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </header>

                </header>

                {/* Conteúdo da main (LAYOUT FULL-WIDTH RESPONSIVO) */}
                <main className="flex-1 overflow-x-hidden overflow-y-auto w-full">
                    {/* Container fluido com padding responsivo */}
                    <div className="w-full py-4 lg:py-8">
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
                            {/* Tabs Content - TODOS renderizados simultaneamente para manter estado */}
                            {navItems.map(item => (
                                <TabsContent
                                    key={item.id}
                                    value={item.id}
                                    className="mt-0"
                                    style={{ display: activeTab === item.id ? 'block' : 'none' }}
                                    forceMount={true}
                                >
                                    {/* Passar dashboardData filtrado para os componentes */}
                                    <item.component
                                        dashboardData={{
                                            ...filteredDashboardData,
                                            // Indicar se é a aba "Painel" (para o HomeTab mostrar pendências)
                                            showPainelView: item.isPainelTab === true,
                                            // Indicar se é a aba "Início" normal
                                            showHomeView: item.id === 'home' && !item.isPainelTab,
                                        }}
                                    />
                                </TabsContent>
                            ))}
                        </Tabs>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default ProfessorDashboardPage;
