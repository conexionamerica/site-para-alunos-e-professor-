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

    // Função REAL para atualizar o status no Supabase
    const handleToggleActive = useCallback(async (profileId, newStatus, profileToUpdate) => {
        setIsSubmitting(true);
        const action = newStatus ? 'Ativar' : 'Inativar';

        if (!window.confirm(`Confirma ${action} o perfil de ${profileToUpdate.full_name}?`)) {
            setIsSubmitting(false);
            return;
        }

        try {
            const { error } = await supabase
                .from('profiles')
                .update({ is_active: newStatus })
                .eq('id', profileId);

            if (error) throw error;

            // 1. Atualizar o estado local
            setLocalProfiles(prev => prev.map(p =>
                p.id === profileId ? { ...p, is_active: newStatus } : p
            ));

            toast({
                variant: newStatus ? 'default' : 'success',
                title: `${action} Concluído!`,
                description: `O status de ${profileToUpdate.full_name} foi atualizado com sucesso.`
            });

            if (onUpdate) onUpdate();

        } catch (error) {
            console.error(`Error ${action} profile:`, error);
            toast({
                variant: 'destructive',
                title: `Erro ao ${action}`,
                description: error.message
            });
        } finally {
            setIsSubmitting(false);
        }
    }, [toast, onUpdate]);

    const handleDelete = useCallback(async (profileToDelete) => {
        // TRAVA DE SEGURANÇA: Só permite excluir se estiver INATIVO
        if (profileToDelete.is_active !== false) {
            toast({
                variant: 'destructive',
                title: 'Exclusão Bloqueada',
                description: 'Para sua segurança, apenas usuários com status "Inativo" podem ser excluídos.'
            });
            return;
        }

        if (!window.confirm(`ATENÇÃO: Confirma a exclusão COMPLETA e PERMANENTE de ${profileToDelete.full_name}? \n\nIsso removerá todo o histórico (aulas, faturas, pacotes) e o acesso do usuário ao sistema.`)) {
            return;
        }

        setIsSubmitting(true);

        try {
            // Usar o RPC que limpa tudo (Auth + Tabelas vinculadas)
            const { error: rpcError } = await supabase.rpc('delete_user_complete', {
                p_user_id: profileToDelete.id
            });

            if (rpcError) throw rpcError;

            // Atualizar estado local
            setLocalProfiles(prev => prev.filter(p => p.id !== profileToDelete.id));

            toast({
                variant: 'default',
                title: 'Usuário Excluído!',
                description: `O perfil de ${profileToDelete.full_name} e todos os seus dados foram removidos.`
            });

            if (onUpdate) onUpdate();

        } catch (error) {
            console.error("Error deleting profile:", error);
            toast({
                variant: 'destructive',
                title: 'Erro ao Deletar',
                description: error.message
            });
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

            <div className="mt-6 p-4 border-l-4 border-purple-500 bg-purple-50 text-sm text-purple-900">
                <p className="font-bold">Informação Administrativa:</p>
                <p>O sistema agora utiliza uma rotina de exclusão completa que remove o usuário do Banco de Dados e do Serviço de Autenticação simultaneamente. Para garantir a integridade dos dados, um usuário só pode ser excluído após ser marcado como <strong>Inativo</strong>.</p>
            </div>
        </div>
    );
};

export default AdmTab;
