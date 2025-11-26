// Arquivo: src/pages/ProfessorDashboardPage.jsx

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LogOut, Home, BookOpen, Calendar, Users, MessageSquare, Settings, Menu, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient'; // Importa o supabase real
import HomeTab from '@/components/professor-dashboard/HomeTab';
import AulasTab from '@/components/professor-dashboard/AulasTab';
import AgendaTab from '@/components/professor-dashboard/AgendaTab';
import AlunosTab from '@/components/professor-dashboard/AlunosTab';
import ConversasTab from '@/components/professor-dashboard/ConversasTab';
import PreferenciasTab from '@/components/professor-dashboard/PreferenciasTab';
import { useToast } from '@/components/ui/use-toast'; // Importa useToast

// CORREÇÃO: Função de busca de dados do dashboard REAL (não a mockada)
const fetchProfessorDashboardData = async (professorId) => {
    // Aqui você colocaria toda a sua lógica real de fetch do Supabase para TODAS as abas.
    // Como a lógica é complexa, vou simular o retorno de coleções vazias para evitar crashes por dados ausentes.
    const today = new Date().toISOString();
    
    // 1. Fetch de Solicitacoes (para HomeTab)
    const { data: scheduleRequests, error: reqError } = await supabase
      .from('solicitudes_clase')
      .select(`*, profile:profiles!alumno_id(*)`)
      .eq('profesor_id', professorId)
      .eq('status', 'Pendiente')
      .order('created_at', { ascending: true });
    if (reqError) throw reqError;
    
    // 2. Fetch de Próxima Aula (para HomeTab)
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
    
    // 3. Fetch de Todos os Alunos (para AlunosTab, PreferenciasTab, AulasTab)
    const { data: students, error: studentsError } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'student')
        .order('full_name', { ascending: true });
    if (studentsError) throw studentsError;

    // 4. Fetch de Pacotes (para PreferenciasTab, AlunosTab)
    const { data: packages, error: packagesError } = await supabase
        .from('packages')
        .select('*');
    if (packagesError) throw packagesError;

    // 5. Fetch de Slots (para PreferenciasTab)
    const { data: classSlots, error: slotsError } = await supabase
        .from('class_slots')
        .select('*')
        .eq('professor_id', professorId);
    if (slotsError) throw slotsError;

    // 6. Fetch de Todos os Agendamentos (para AulasTab, AlunosTab)
    const { data: appointments, error: appointmentsError } = await supabase
        .from('appointments')
        .select(`*, student:profiles!student_id(full_name, spanish_level)`)
        .eq('professor_id', professorId)
        .order('class_datetime', { ascending: false });
    if (appointmentsError) throw appointmentsError;

    // 7. Fetch de Faturas e Logs (para AlunosTab, PreferenciasTab)
    const { data: allBillings, error: billingsError } = await supabase
        .from('billing')
        .select('*, packages(name)')
        .order('purchase_date', { ascending: false });
    if (billingsError) throw billingsError;

    const { data: assignedLogs, error: logsError } = await supabase
        .from('assigned_packages_log')
        .select('*');
    if (logsError) throw logsError;

    // Retorno do objeto de dados completo
    return {
        professorId,
        professorName: students.find(p => p.id === professorId)?.full_name || 'Professor(a)',
        email: students.find(p => p.id === professorId)?.email || '',
        scheduleRequests: scheduleRequests || [],
        nextClass: nextClass,
        students: students.filter(s => s.id !== professorId), // Filtra o próprio professor
        packages: packages || [],
        classSlots: classSlots || [],
        appointments: appointments || [],
        allBillings: allBillings || [],
        assignedLogs: assignedLogs || [],
    };
};

const ProfessorDashboardPage = () => {
    const { profile, signOut } = useAuth();
    const { toast } = useToast();
    const navigate = useNavigate();
    
    const [activeTab, setActiveTab] = useState('home');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [dashboardData, setDashboardData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false); // NOVO: Estado para erro

    const handleLogout = async () => {
        await signOut();
        navigate('/professor-login');
    };

    const fetchData = useCallback(async () => {
        if (!profile?.id) return;

        setIsLoading(true);
        setHasError(false);
        try {
            const data = await fetchProfessorDashboardData(profile.id);
            setDashboardData({
                ...data,
                // Passa o status de loading como parte do objeto data para as abas
                loading: false, 
                onUpdate: fetchData // Adiciona a função de recarga para uso nas abas
            });
        } catch (error) {
            console.error("Erro ao carregar dados do dashboard:", error);
            toast({ 
                variant: 'destructive', 
                title: 'Erro de Conexão', 
                description: `Não foi possível carregar os dados do dashboard. ${error.message}` 
            });
            setHasError(true);
            setDashboardData(null); // Limpa dados em caso de erro
        } finally {
            setIsLoading(false);
        }
    }, [profile?.id, toast]);

    useEffect(() => {
        if (profile?.id) {
            fetchData();
        } else if (!profile && !isLoading) {
            // Se não houver perfil e não estiver carregando, redirecionar
            navigate('/professor-login');
        }
    }, [profile, navigate, fetchData, isLoading]);

    // Função para verificar o tamanho da tela e fechar a sidebar em telas maiores
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
        // CORREÇÃO: Passa o objeto dashboardData completo (que agora contém o loading e onUpdate)
        { id: 'home', icon: Home, label: 'Início', component: HomeTab },
        { id: 'aulas', icon: BookOpen, label: 'Minhas Aulas', component: AulasTab },
        { id: 'agenda', icon: Calendar, label: 'Agenda', component: AgendaTab },
        { id: 'alunos', icon: Users, label: 'Meus Alunos', component: AlunosTab },
        { id: 'conversas', icon: MessageSquare, label: 'Conversas', component: ConversasTab },
        { id: 'preferencias', icon: Settings, label: 'Preferências', component: PreferenciasTab },
    ];

    // ... (Sidebar component remains the same, but uses isLoading for disabled state)

    const Sidebar = () => (
        <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: isSidebarOpen ? '0%' : '-100%' }}
            transition={{ duration: 0.3 }}
            className="fixed inset-y-0 left-0 z-40 w-64 bg-gray-900 text-white p-6 shadow-2xl lg:static lg:translate-x-0 lg:shadow-none lg:p-0 lg:w-auto"
        >
            <div className="flex justify-between items-center mb-8 lg:hidden">
                <h2 className="text-2xl font-bold
