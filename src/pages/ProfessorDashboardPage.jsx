// Archivo: src/pages/ProfessorDashboardPage.jsx

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

// Función de búsqueda de datos
const fetchProfessorDashboardData = async (professorId) => {
    const today = new Date().toISOString();
    
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
    
    // 4. Fetch de Todos los Alumnos (para AlunosTab, PreferenciasTab, AulasTab)
    const { data: students, error: studentsError } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'student') 
        .order('full_name', { ascending: true });
    if (studentsError) throw studentsError;

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
    if (appointmentsError) throw appointmentsError;

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
        packages: packages || [],
        classSlots: classSlots || [],
        appointments: appointments || [],
        allBillings: allBillings || [],
        assignedLogs: assignedLogs || [],
        chatList: chatList || [],
    };
};

const Logo = () => (
    <Link to="/" className="text-left flex items-center h-16">
        <div className="text-xl font-bold">
            <span className="text-sky-600">Conexion</span>
            <span className="text-slate-800"> America</span>
        </div>
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

    // Función para verificar el tamaño de la pantalla y cerrar la sidebar en pantallas mayores
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth >= 1024) {
                setIsSidebarOpen(false);
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

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
            <Tabs value={activeTab} onValueChange={setActiveTab} orientation="vertical" className="h-full">
                <TabsList className="flex flex-col h-full bg-transparent space-y-2">
                    {navItems.map(item => (
                        <TabsTrigger
                            key={item.id}
                            value={item.id}
                            onClick={() => {
                                setActiveTab(item.id);
                                setIsSidebarOpen(false); 
                            }}
                            className={`w-full justify-start text-lg px-4 py-3 rounded-xl transition-all duration-200 ${
                                activeTab === item.id
                                    ? 'bg-blue-600 text-white shadow-lg'
                                    : 'text-gray-300 hover:bg-gray-800'
                            }`}
                            disabled={isLoading}
                        >
                            <item.icon className="h-5 w-5 mr-3" />
                            {item.label}
                        </TabsTrigger>
                    ))}
                </TabsList>
            </Tabs>
            
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
            <div className="flex items-center justify-center min-h-screen bg-gray-100">
                <div className="flex flex-col items-center">
                    <Loader2 className="h-12 w-12 text-sky-600 animate-spin" />
                    <p className="mt-4 text-xl font-semibold text-gray-700">Carregando Painel do Professor...</p>
                </div>
            </div>
        );
    }
    
    if (hasError || !dashboardData) { 
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-100">
                <div className="flex flex-col items-center p-8 bg-white rounded-lg shadow-xl">
                    <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
                    <h2 className="text-2xl font-bold text-gray-800">Erro ao Carregar Dados</h2>
                    <p className="mt-2 text-gray-600 text-center">Não foi possível carregar as informações do dashboard. Verifique sua conexão ou tente novamente.</p>
                    <Button onClick={fetchData} className="mt-4 bg-sky-600 hover:bg-sky-700">
                        Tentar Novamente
                    </Button>
                </div>
            </div>
        );
    }
    
    return (
        <div className="flex min-h-screen bg-gray-100">
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
                    {/* Linha superior: Logo e Dropdown - CORREÇÃO 1: Usamos w-full e px-4/8 para preenchimento. */}
                    <div className="w-full flex justify-between items-center h-16 px-4 lg:px-8">
                        <Logo /> 
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                                    <Users className="h-5 w-5" /> 
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-56" align="end" forceMount>
                                <DropdownMenuLabel className="font-normal">
                                    <div className="flex flex-col space-y-1">
                                        <p className="text-sm font-medium leading-none">{dashboardData.professorName || 'Professor'}</p> 
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
                    </div>

                    {/* Linha inferior: TabsList para Navegação Desktop */}
                    <div className="hidden lg:block bg-white border-b border-slate-200">
                        {/* CORREÇÃO 2: Aplicamos w-full para se esticar e px-4/8 para padding consistente */}
                        <div className="w-full px-4 lg:px-8">
                            <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
                                <TabsList className="w-full justify-start h-auto p-0 bg-transparent rounded-none">
                                    {navItems.map(item => (
                                        <TabsTrigger
                                            key={item.id}
                                            value={item.id}
                                            onClick={() => setActiveTab(item.id)}
                                            className={`relative flex items-center text-base px-4 py-3 mr-2 rounded-none transition-all duration-200 border-b-2 border-transparent 
                                                ${activeTab === item.id
                                                    ? 'text-sky-600 border-sky-600 font-semibold' 
                                                    : 'text-gray-600 hover:text-gray-800'
                                                }`}
                                        >
                                            <item.icon className="h-5 w-5 mr-2" />
                                            {item.label}
                                        </TabsTrigger>
                                    ))}
                                </TabsList>
                            </Tabs>
                        </div>
                    </div>
                     {/* Header Mobile */}
                    <header className="flex items-center justify-between p-4 bg-white shadow-md lg:hidden">
                        <Button variant="ghost" onClick={() => setIsSidebarOpen(true)}>
                            <Menu className="h-6 w-6 text-gray-800" />
                        </Button>
                        <h1 className="text-xl font-bold text-gray-800">Dashboard</h1>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                                    <Users className="h-5 w-5" /> 
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-56" align="end" forceMount>
                                <DropdownMenuLabel className="font-normal">
                                    <div className="flex flex-col space-y-1">
                                        <p className="text-sm font-medium leading-none">{dashboardData.professorName || 'Professor'}</p> 
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
                
                {/* Conteúdo da main - CORREÇÃO 3: Removido 'container mx-auto' e usado w-full + padding */}
                <main className="flex-1 overflow-x-hidden overflow-y-auto">
                    {/* Este wrapper garante que o conteúdo use a largura total e aplique o padding lateral/vertical */}
                    <div className="w-full px-4 lg:px-8 py-4 lg:py-8 h-full"> 
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
                            {/* Tabs Content */}
                            {navItems.map(item => (
                                <TabsContent key={item.id} value={item.id} className="mt-0">
                                    <item.component dashboardData={dashboardData} /> 
                                </TabsContent>
                            ))}
                        </Tabs>
                    </div>
                </main>
            </div>

            {/* BOTÃO FLUTUANTE DE WHATSAPP */}
            <a
                href="https://wa.me/555198541835?text=Olá! Preciso de ajuda no painel de aluno."
                target="_blank"
                rel="noopener noreferrer"
                className="fixed bottom-6 right-6 z-50 bg-green-500 hover:bg-green-600 text-white p-4 rounded-full shadow-lg transition-transform hover:scale-110"
                aria-label="Fale conosco pelo WhatsApp"
            >
                {/* Ícone de WhatsApp (SVG simplificado) */}
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12.0003 2C6.48667 2 2.00033 6.48667 2.00033 12.0003C2.00033 13.9877 2.56967 15.866 3.63033 17.4417L2.41733 21.5833L6.68733 20.3703C8.167 21.242 9.94067 21.725 12.0003 21.725C17.514 21.725 22.0003 17.2387 22.0003 12.0003C22.0003 6.48667 17.514 2 12.0003 2ZM17.1523 15.429C16.929 15.8343 16.2907 16.0377 15.8973 16.141C15.539 16.234 15.1763 16.2857 14.8103 16.2857C13.881 16.2857 12.571 15.9397 11.261 15.584C9.57767 15.127 8.35633 13.9057 7.90067 12.2223C7.54467 10.9123 7.19867 9.60233 7.19867 8.673C7.19867 8.307 7.24967 7.94433 7.34267 7.58633C7.44567 7.19333 7.64933 6.55467 8.05433 6.33167C8.423 6.13633 8.79067 6.13833 9.12467 6.14167C9.336 6.14367 9.53167 6.17633 9.68967 6.52933C10.025 7.28433 10.3603 8.03967 10.6953 8.79467C10.825 9.079 10.8407 9.42067 10.655 9.71833C10.5147 9.944 10.3347 10.0983 10.1547 10.2526C9.923 10.4503 9.771 10.686 9.67333 10.9577C9.64167 11.0443 9.64167 11.135 9.67333 11.2216C10.052 12.1896 10.817 13.0643 11.785 13.4433C11.8716 13.475 11.9623 13.475 12.049 13.4433C12.3207 13.3457 12.5563 13.1937 12.754 12.962C12.9083 12.782 13.0626 12.602 13.288 12.4613C13.5857 12.2757 13.9273 12.2913 14.2117 12.421C14.9667 12.756 15.722 13.0913 16.477 13.4267C16.83 13.5847 16.8627 13.7803 16.8647 13.9917C16.868 14.3257 16.87 14.6933 16.6743 15.062C16.4513 15.467 16.2163 15.619 15.823 15.8423L16.2163 15.8423Z" />
                </svg>
            </a>
        </div>
    );
};

export default ProfessorDashboardPage;
