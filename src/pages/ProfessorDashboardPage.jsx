// Arquivo: src/pages/ProfessorDashboardPage.jsx

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LogOut, Home, BookOpen, Calendar, Users, MessageSquare, Settings, Menu, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import HomeTab from '@/components/professor-dashboard/HomeTab';
import AulasTab from '@/components/professor-dashboard/AulasTab';
import AgendaTab from '@/components/professor-dashboard/AgendaTab';
import AlunosTab from '@/components/professor-dashboard/AlunosTab';
import ConversasTab from '@/components/professor-dashboard/ConversasTab';
import PreferenciasTab from '@/components/professor-dashboard/PreferenciasTab';
import { useToast } from '@/components/ui/use-toast';
import { Link } from 'react-router-dom';
import { getBrazilDate } from '@/lib/dateUtils';

// Função de busca de dados
const fetchProfessorDashboardData = async (professorId) => {
    const today = getBrazilDate().toISOString();

    // 1. Fetch del perfil del profesor (solo nombre)
    const { data: professorProfile, error: profProfileError } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', professorId)
        .maybeSingle();
    if (profProfileError) throw profProfileError;

    // 2. Fetch de Solicitacoes (para HomeTab)
    const { data: scheduleRequests, error: reqError } = await supabase
        .from('solicitudes_clase')
        .select(`*, profile:profiles!alumno_id(*)`)
        .eq('profesor_id', professorId)
        .eq('status', 'Pendiente')
        .order('solicitud_id', { ascending: true });
    if (reqError) throw reqError;

    // 3. Fetch de Próxima Aula (para HomeTab)
    const { data: nextClass, error: nextClassError } = await supabase
        .from('appointments')
        .select(`*, student:profiles!student_id(full_name, spanish_level)`)
        .eq('professor_id', professorId)
        .eq('status', 'scheduled')
        .gte('class_datetime', today)
        .order('class_datetime', { ascending: true })
        .limit(1)
        .maybeSingle();
    if (nextClassError && nextClassError.code !== 'PGRST116') throw nextClassError;

    // 4. Fetch de TODOS los Perfiles (para AdmTab y AlunosTab)
    const { data: allProfiles, error: allProfilesError } = await supabase
        .from('profiles')
        .select('*, created_at')
        .order('role', { ascending: true })
        .order('full_name', { ascending: true });
    if (allProfilesError) throw allProfilesError;

    // Filter students from all profiles
    const students = allProfiles.filter(p => p.role === 'student');

    // 5. Fetch de Pacotes (para PreferenciasTab)
    const { data: packages, error: packagesError } = await supabase
        .from('packages')
        .select('*');
    if (packagesError) throw packagesError;

    // 6. Fetch de Slots (para PreferenciasTab)
    const { data: classSlots, error: slotsError } = await supabase
        .from('class_slots')
        .select('*')
        .eq('professor_id', professorId);
    if (slotsError) throw slotsError;

    // 7. Fetch de Todos los Agendamentos (para AulasTab, AlunosTab)
    const { data: appointments, error: appointmentsError } = await supabase
        .from('appointments')
        .select(`*, student:profiles!student_id(full_name, spanish_level)`)
        .eq('professor_id', professorId)
        .order('class_datetime', { ascending: false });
    // CORREÇÃO DE ESTABILIDADE: Captura o erro aqui para evitar travamento total
    if (appointmentsError) {
        console.error("Erro no fetch de appointments:", appointmentsError);
        // Não lança o erro, permite que o dashboard continue
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

    // 9. Fetch de la lista de Chats (para ConversasTab)
    const { data: chatList, error: chatListError } = await supabase.rpc('get_professor_chat_list', { p_id: professorId });
    if (chatListError && chatListError.code !== '42883') throw chatListError;

    return {
        professorId,
        professorName: professorProfile?.full_name || 'Professor(a)',
        scheduleRequests: scheduleRequests || [],
        nextClass: nextClass,
        students: students || [],
        allProfiles: allProfiles || [],
        packages: packages || [],
        classSlots: classSlots || [],
        appointments: appointments || [], // Retorna dado, mesmo que possa estar vazio em caso de erro
        allBillings: allBillings || [],
        assignedLogs: assignedLogs || [],
        chatList: chatList || [],
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
            const data = await fetchProfessorDashboardData(currentUserId);
            setDashboardData({
                data: data,
                professorId: data.professorId,
                professorName: data.professorName,
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
                fetchData();
            })
            .subscribe();

        const requestsChannel = supabase
            .channel('requests-changes')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'solicitudes_clase'
            }, () => {
                fetchData();
            })
            .subscribe();

        const profilesChannel = supabase
            .channel('profiles-changes')
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'profiles'
            }, () => {
                fetchData();
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

            const { count, error } = await supabase
                .from('student_messages')
                .select('id', { count: 'exact', head: true })
                .eq('professor_id', user.id)
                .eq('read', false);

            if (!error) {
                setHasUnreadMessages(count > 0);
            }
        };

        checkUnreadMessages();

        // Realtime para atualizar quando novas mensagens chegam
        const messagesChannel = supabase
            .channel('messages-changes')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'student_messages',
                filter: `professor_id=eq.${user?.id}`
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
                await supabase
                    .from('student_messages')
                    .update({ read: true })
                    .eq('professor_id', user.id)
                    .eq('read', false);

                setHasUnreadMessages(false);
            }, 1000);

            return () => clearTimeout(timer);
        }
    }, [activeTab, hasUnreadMessages, user?.id]);

    const navItems = [
        { id: 'home', icon: Home, label: 'Início', component: HomeTab },
        { id: 'agenda', icon: Calendar, label: 'Agenda', component: AgendaTab },
        { id: 'conversas', icon: MessageSquare, label: 'Conversas', component: ConversasTab },
        { id: 'alunos', icon: Users, label: 'Alunos', component: AlunosTab },
        { id: 'aulas', icon: BookOpen, label: 'Aulas', component: AulasTab },
        { id: 'preferencias', icon: Settings, label: 'Preferências', component: PreferenciasTab },
    ];

    // Componente Sidebar (Layout Mobile/Toggle)
    const Sidebar = () => (
        <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: isSidebarOpen ? '0%' : '-100%' }}
            transition={{ duration: 0.3 }}
            className="fixed inset-y-0 left-0 z-40 w-64 bg-gray-900 text-white p-6 shadow-2xl lg:static lg:translate-x-0 lg:shadow-none lg:p-0 lg:w-auto"
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
                    {/* Linha superior: Logo e Dropdown - Fundo Branco e Conteúdo Centralizado */}
                    <div className="w-full flex justify-center items-center h-16 bg-white border-b border-slate-200">
                        <div className="w-full max-w-7xl mx-auto px-4 lg:px-8 flex justify-between items-center">
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

                    {/* Linha inferior: TabsList para Navegação Desktop - Fundo Branco e Alinhamento */}
                    <div className="hidden lg:block bg-white border-b border-slate-200">
                        <div className="w-full max-w-7xl mx-auto px-4 lg:px-8">
                            <Tabs value={activeTab} onOpenChange={setActiveTab} className="h-full">
                                <TabsList className="w-full justify-start h-auto p-0 bg-transparent rounded-none">
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

                {/* Conteúdo da main (CORREÇÃO DE LAYOUT) */}
                <main className="flex-1 overflow-x-hidden overflow-y-auto w-full">
                    {/* Aplica max-width e centralização (mx-auto). O padding horizontal foi REMOVIDO daqui. */}
                    <div className="w-full max-w-7xl mx-auto py-4 lg:py-8">
                        <Tabs value={activeTab} onOpenChange={setActiveTab} className="h-full">
                            {/* Tabs Content */}
                            {navItems.map(item => (
                                <TabsContent key={item.id} value={item.id} className="mt-0">
                                    {/* ATENÇÃO: O padding horizontal (px-4 lg:px-8) DEVE ser adicionado no DIV raiz de HomeTab, AgendaTab, etc., para replicar o alinhamento do cabeçalho. */}
                                    <item.component dashboardData={dashboardData} />
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
