// Arquivo: horizons-export-22fc469e-c423-4e5d-bc45-c6e823625c43 (3)/src/pages/ProfessorDashboardPage.jsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LogOut, Home, BookOpen, Calendar, Users, MessageSquare, Settings, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/SupabaseAuthContext'; // Corrected import
import HomeTab from '@/components/professor-dashboard/HomeTab';
import AulasTab from '@/components/professor-dashboard/AulasTab';
import AgendaTab from '@/components/professor-dashboard/AgendaTab';
import AlunosTab from '@/components/professor-dashboard/AlunosTab';
import ConversasTab from '@/components/professor-dashboard/ConversasTab';
import PreferenciasTab from '@/components/professor-dashboard/PreferenciasTab';

const ProfessorDashboardPage = () => {
    const { signOut } = useAuth(); // Corrected usage (useAuth provides signOut)
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('home');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const handleLogout = async () => {
        await signOut();
        navigate('/professor-login');
    };

    // Função para verificar o tamanho da tela e fechar a sidebar em telas maiores
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth >= 1024) {
                setIsSidebarOpen(false); // Fecha a sidebar em telas grandes
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const navItems = [
        { id: 'home', icon: Home, label: 'Início', component: HomeTab },
        { id: 'aulas', icon: BookOpen, label: 'Minhas Aulas', component: AulasTab },
        { id: 'agenda', icon: Calendar, label: 'Agenda', component: AgendaTab },
        { id: 'alunos', icon: Users, label: 'Meus Alunos', component: AlunosTab },
        { id: 'conversas', icon: MessageSquare, label: 'Conversas', component: ConversasTab },
        { id: 'preferencias', icon: Settings, label: 'Preferências', component: PreferenciasTab },
    ];

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
            <TabsList className="flex flex-col h-full bg-transparent space-y-2">
                {navItems.map(item => (
                    <TabsTrigger
                        key={item.id}
                        value={item.id}
                        onClick={() => {
                            setActiveTab(item.id);
                            setIsSidebarOpen(false); // Fecha a sidebar após selecionar em mobile
                        }}
                        className={`w-full justify-start text-lg px-4 py-3 rounded-xl transition-all duration-200 ${
                            activeTab === item.id
                                ? 'bg-blue-600 text-white shadow-lg'
                                : 'text-gray-300 hover:bg-gray-800'
                        }`}
                    >
                        <item.icon className="h-5 w-5 mr-3" />
                        {item.label}
                    </TabsTrigger>
                ))}
                <Button 
                    onClick={handleLogout} 
                    className="w-full justify-start text-lg px-4 py-3 rounded-xl mt-auto bg-transparent border border-red-500 text-red-400 hover:bg-red-900 hover:text-white"
                >
                    <LogOut className="h-5 w-5 mr-3" />
                    Sair
                </Button>
            </TabsList>
        </motion.div>
    );

    return (
        <div className="flex min-h-screen bg-gray-100">
            {/* Sidebar para desktop e mobile (oculta/aberta) */}
            <Sidebar />

            {/* Overlay para mobile quando sidebar está aberta */}
            {isSidebarOpen && (
                <div 
                    className="fixed inset-0 z-30 bg-black opacity-50 lg:hidden" 
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Conteúdo Principal do Dashboard */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header (Topo) */}
                <header className="flex items-center justify-between p-4 bg-white shadow-md lg:hidden">
                    <Button variant="ghost" onClick={() => setIsSidebarOpen(true)}>
                        <Menu className="h-6 w-6 text-gray-800" />
                    </Button>
                    <h1 className="text-xl font-bold text-gray-800">Dashboard</h1>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                                <Users className="h-5 w-5" /> {/* Ícone de perfil temporário */}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-56" align="end" forceMount>
                            <DropdownMenuLabel className="font-normal">
                                <div className="flex flex-col space-y-1">
                                    <p className="text-sm font-medium leading-none">Professor</p>
                                    <p className="text-xs leading-none text-muted-foreground">
                                        seu.email@escola.com
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

                <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 lg:p-8">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
                        {/* Tabs Content */}
                        {navItems.map(item => (
                            <TabsContent key={item.id} value={item.id} className="mt-0">
                                <item.component />
                            </TabsContent>
                        ))}
                    </Tabs>
                </main>
            </div>

            {/* BOTÃO FLUTUANTE DE WHATSAPP (Adicionado aqui para aparecer em todas as abas) */}
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
