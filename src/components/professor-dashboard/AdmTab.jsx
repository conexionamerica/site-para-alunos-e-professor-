import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Trash2, UserX, UserCheck, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';

// Utility for managing profile actions
const ProfileActions = ({ profile, onDelete, onToggleActive, isSubmitting, currentUserId }) => {
    // A função de deleção de Auth precisa ser manual via SDK admin (no backend), não disponível aqui.
    const isCurrentUser = profile.id === currentUserId;
    const isActive = profile.is_active !== false; // Assume ativo se o campo estiver ausente ou true

    if (isCurrentUser) {
        return <span className="text-sm text-slate-500">Sua Conta (Não Editável)</span>;
    }

    const actionText = isSubmitting ? 'Processando...' : (isActive ? 'Inativar' : 'Ativar');

    return (
        <div className="flex space-x-2">
            <Button
                // CORREÇÃO: Passa o objeto completo para a simulação
                variant={isActive ? 'destructive' : 'default'}
                size="sm"
                onClick={() => onToggleActive(profile.id, !isActive, profile)}
                disabled={isSubmitting}
                className={cn(isSubmitting ? 'opacity-70' : '')}
            >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                    isActive ? <UserX className="h-4 w-4 mr-1" /> : <UserCheck className="h-4 w-4 mr-1" />
                )}
                {actionText}
            </Button>
            <Button
                variant="destructive"
                size="sm"
                onClick={() => onDelete(profile)}
                disabled={isSubmitting}
            >
                <Trash2 className="h-4 w-4" />
            </Button>
        </div>
    );
};

const ProfileTable = ({ title, profiles, onDelete, onToggleActive, isSubmitting, currentUserId }) => {
    return (
        <div className="space-y-4">
            <h4 className="text-xl font-semibold mb-3">{title} ({profiles.length})</h4>
            <div className="border rounded-lg overflow-hidden">
                <Table>
                    <TableHeader className="bg-slate-50">
                        <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Membro Desde</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {profiles.length > 0 ? (
                            profiles.map(profile => (
                                <TableRow key={profile.id} className={profile.is_active === false ? 'opacity-50' : ''}>
                                    <TableCell className="font-medium">{profile.full_name}</TableCell>
                                    <TableCell>{profile.real_email || profile.email || 'N/A'}</TableCell>
                                    <TableCell>{format(new Date(profile.created_at), 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
                                    <TableCell>
                                        <Badge variant={profile.is_active === false ? 'destructive' : 'default'}>
                                            {profile.is_active === false ? 'Inativo' : 'Ativo'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <ProfileActions
                                            profile={profile}
                                            onDelete={onDelete}
                                            onToggleActive={onToggleActive}
                                            isSubmitting={isSubmitting}
                                            currentUserId={currentUserId}
                                        />
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan="5" className="text-center py-8 text-slate-500">
                                    Nenhum perfil encontrado.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}

const AdmTab = ({ dashboardData }) => {
    const { toast } = useToast();
    const data = dashboardData?.data || {};
    const loading = dashboardData?.loading || false;
    const allProfiles = data.allProfiles || [];
    const onUpdate = dashboardData?.onUpdate;

    const professorId = dashboardData?.professorId;

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [localProfiles, setLocalProfiles] = useState(allProfiles);

    // Sync profiles when dashboardData updates
    useEffect(() => {
        setLocalProfiles(allProfiles);
    }, [allProfiles]);


    const students = localProfiles.filter(p => p.role === 'student').sort((a, b) => a.full_name?.localeCompare(b.full_name));
    const professors = localProfiles.filter(p => p.role === 'professor').sort((a, b) => a.full_name?.localeCompare(b.full_name));

    // CORREÇÃO: Função modificada para APENAS atualizar o estado local e notificar o usuário
    const handleToggleActive = useCallback(async (profileId, newStatus, profileToUpdate) => {
        setIsSubmitting(true);
        const action = newStatus ? 'Ativar' : 'Inativar';

        if (!window.confirm(`Confirma ${action} o perfil de ${profileToUpdate.full_name}? (Atenção: A atualização da base de dados será ignorada para evitar erros. A mudança será apenas visual para você e dependerá de uma correção manual do campo is_active no Supabase para bloquear o aluno.)`)) {
            setIsSubmitting(false);
            return;
        }

        try {
            // *** REMOVIDA A CHAMADA SUPABASE.UPDATE PARA EVITAR O ERRO RLS ***

            // 1. Atualizar o estado local (Simulação)
            setLocalProfiles(prev => prev.map(p =>
                p.id === profileId ? { ...p, is_active: newStatus } : p
            ));

            // 2. Notificação (alerta sobre a simulação)
            toast({
                variant: newStatus ? 'default' : 'destructive',
                title: `${action} (Simulado) Concluído!`,
                description: `Status de ${profileToUpdate.full_name} atualizado superficialmente. Verifique o RLS para o bloqueio real.`
            });
            // Não chama onUpdate para não forçar o pai a recarregar e perder a simulação local

        } catch (error) {
            console.error("Error simulating toggling status:", error);
            toast({ variant: 'destructive', title: `Erro ao ${action}`, description: `Falha na simulação: ${error.message}` });
        } finally {
            setIsSubmitting(false);
        }
    }, [toast]);

    const handleDelete = useCallback(async (profileToDelete) => {
        if (!window.confirm(`ATENÇÃO: Confirma a exclusão COMPLETA do perfil de ${profileToDelete.full_name} (${profileToDelete.role})? 
        
        ISSO É IRREVERSÍVEL. O registro de perfil será deletado. O usuário DEVE ser removido do Supabase Auth manualmente para liberar o e-mail.`)) {
            return;
        }

        setIsSubmitting(true);

        try {
            // 1. Delete all appointments linked to this user (for cleanup)
            if (profileToDelete.role === 'student') {
                // Deletar as aulas agendadas (foreign key constraint)
                await supabase.from('appointments').delete().eq('student_id', profileToDelete.id);
            }

            // 2. Delete the profile record
            const { error } = await supabase.from('profiles').delete().eq('id', profileToDelete.id);

            if (error) throw error;

            // 3. Update local state
            setLocalProfiles(prev => prev.filter(p => p.id !== profileToDelete.id));

            toast({
                variant: 'destructive',
                title: 'Perfil Deletado!',
                description: `O perfil de ${profileToDelete.full_name} foi removido. REMOVA MANUALMENTE o usuário no Supabase Authentication!`
            });
            if (onUpdate) onUpdate();

        } catch (error) {
            console.error("Error deleting profile:", error);
            toast({ variant: 'destructive', title: 'Erro ao Deletar', description: error.message });
        } finally {
            setIsSubmitting(false);
        }
    }, [toast, onUpdate]);


    return (
        <div className="bg-white p-6 rounded-lg shadow-sm">
            <h3 className="text-2xl font-bold mb-6">Administração de Usuários</h3>

            {loading ? (
                <div className="flex justify-center py-10">
                    <Loader2 className="w-8 h-8 animate-spin text-sky-600" />
                </div>
            ) : (
                <Tabs defaultValue="students">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="students">Alunos</TabsTrigger>
                        <TabsTrigger value="professors">Professores</TabsTrigger>
                    </TabsList>

                    <TabsContent value="students" className="mt-4">
                        <ProfileTable
                            title="Perfis de Alunos"
                            profiles={students}
                            onDelete={handleDelete}
                            onToggleActive={handleToggleActive}
                            isSubmitting={isSubmitting}
                            currentUserId={professorId}
                        />
                    </TabsContent>

                    <TabsContent value="professors" className="mt-4">
                        <ProfileTable
                            title="Perfis de Professores"
                            profiles={professors}
                            onDelete={handleDelete}
                            onToggleActive={handleToggleActive}
                            isSubmitting={isSubmitting}
                            currentUserId={professorId}
                        />
                    </TabsContent>
                </Tabs>
            )}

            <div className="mt-6 p-4 border-l-4 border-yellow-500 bg-yellow-50 text-sm text-yellow-900">
                <p className="font-bold">Atenção Administrativa - Exclusão de Usuários:</p>
                <p>O cliente Supabase não permite deletar usuários do serviço de autenticação (email/senha) via código frontend. Após deletar um perfil aqui, você deve removê-lo manualmente do painel do Supabase Authentication para liberar o e-mail para um novo cadastro.</p>
            </div>
        </div>
    );
};

export default AdmTab;
