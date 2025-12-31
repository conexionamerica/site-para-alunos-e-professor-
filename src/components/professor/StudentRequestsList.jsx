import { Check, X, UserPlus, Users, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNotifications } from '@/hooks/useNotifications';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function StudentRequestsList({ professorId }) {
    const { toast } = useToast();
    const { notifications, respondToRequest, loading } = useNotifications(professorId, {
        type: ['new_student_assignment', 'student_reallocation'],
        status: 'pending'
    });

    const handleAccept = async (notif) => {
        const { error } = await respondToRequest(notif.id, 'accepted');

        if (!error) {
            toast({
                title: 'Aluno Aceito!',
                description: `Você aceitou ${notif.metadata?.student_name}. Agende as primeiras aulas.`,
            });
        } else {
            toast({
                variant: 'destructive',
                title: 'Erro',
                description: 'Não foi possível aceitar o aluno.',
            });
        }
    };

    const handleReject = async (notif) => {
        const { error } = await respondToRequest(notif.id, 'rejected');

        if (!error) {
            toast({
                title: 'Solicitação Rejeitada',
                description: `Você rejeitou a solicitação de ${notif.metadata?.student_name}.`,
                variant: 'destructive'
            });
        } else {
            toast({
                variant: 'destructive',
                title: 'Erro',
                description: 'Não foi possível rejeitar a solicitação.',
            });
        }
    };

    if (loading) return null;

    if (notifications.length === 0) {
        return null;
    }

    return (
        <Card className="border-blue-200 shadow-md">
            <CardHeader className="bg-blue-50 dark:bg-blue-950">
                <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                    <UserPlus className="h-5 w-5" />
                    Solicitações de Novos Alunos
                </CardTitle>
                <CardDescription>
                    Você tem <strong>{notifications.length}</strong> solicitação(ões) pendente(s)
                </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
                <Alert className="mb-4 border-blue-200 bg-blue-50">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                        Aceite os novos alunos para que você possa agendar aulas com eles.
                    </AlertDescription>
                </Alert>

                <div className="space-y-3">
                    {notifications.map(notif => {
                        const isReallocation = notif.type === 'student_reallocation';

                        return (
                            <div
                                key={notif.id}
                                className="flex items-center justify-between p-4 border rounded-lg bg-white dark:bg-slate-900 hover:border-blue-300 transition-colors"
                            >
                                <div className="flex items-center gap-3 flex-1">
                                    <Avatar className="h-12 w-12 border-2 border-blue-200">
                                        <AvatarImage src={notif.metadata?.student_avatar} />
                                        <AvatarFallback className="bg-blue-100 text-blue-700 font-semibold">
                                            {notif.metadata?.student_name?.[0]?.toUpperCase() || 'A'}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <p className="font-semibold text-lg">
                                                {notif.metadata?.student_name}
                                            </p>
                                            {isReallocation && (
                                                <Badge variant="secondary" className="text-xs">
                                                    Transferido
                                                </Badge>
                                            )}
                                        </div>
                                        <p className="text-sm text-slate-600 dark:text-slate-400">
                                            {isReallocation ? (
                                                <>
                                                    Transferido de <strong>{notif.metadata?.old_professor_name}</strong>
                                                </>
                                            ) : (
                                                'Novo aluno vinculado'
                                            )}
                                        </p>
                                        <p className="text-xs text-slate-500 mt-1">
                                            {new Date(notif.created_at).toLocaleString('pt-BR')}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-2 ml-4">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleReject(notif)}
                                        className="border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
                                    >
                                        <X className="h-4 w-4 mr-1" />
                                        Rejeitar
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={() => handleAccept(notif)}
                                        className="bg-green-600 hover:bg-green-700 text-white"
                                    >
                                        <Check className="h-4 w-4 mr-1" />
                                        Aceitar
                                    </Button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}
