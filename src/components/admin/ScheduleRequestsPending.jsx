import { Clock, Users, Calendar, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useNotifications } from '@/hooks/useNotifications';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function ScheduleRequestsPending({ adminId }) {
    const { notifications, loading, markAsRead } = useNotifications(adminId, {
        type: 'schedule_request',
        status: 'pending'
    });

    if (loading || notifications.length === 0) return null;

    const handleMarkAsRead = (notifId) => {
        markAsRead(notifId);
    };

    return (
        <Card className="border-orange-200 bg-orange-50/50">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-orange-700">
                    <Clock className="h-5 w-5" />
                    Solicitações de Agendamento Pendentes
                </CardTitle>
                <CardDescription>
                    {notifications.length} solicitação(ões) aguardando ação do professor
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {notifications.map(notif => {
                        const isReallocation = notif.related_entity_type === 'student_reallocation';
                        const professorResponse = notif.metadata?.professor_response;

                        return (
                            <div
                                key={notif.id}
                                className="flex items-start justify-between p-3 bg-white border border-orange-200 rounded-lg hover:shadow-md transition-shadow cursor-pointer"
                                onClick={() => handleMarkAsRead(notif.id)}
                            >
                                <div className="flex items-start gap-3 flex-1">
                                    <Avatar className="h-10 w-10 border-2 border-orange-200">
                                        <AvatarFallback className="bg-orange-100 text-orange-700">
                                            {notif.metadata?.student_name?.[0]?.toUpperCase() || 'A'}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <p className="font-semibold">
                                                {notif.metadata?.student_name}
                                            </p>
                                            {isReallocation && (
                                                <Badge variant="secondary" className="text-xs">
                                                    Realocação
                                                </Badge>
                                            )}
                                        </div>
                                        <p className="text-sm text-slate-600 mb-1">
                                            Professor: <strong>{notif.metadata?.professor_name}</strong>
                                        </p>
                                        {isReallocation && notif.metadata?.old_professor_name && (
                                            <p className="text-xs text-slate-500">
                                                Transferido de: {notif.metadata.old_professor_name}
                                            </p>
                                        )}
                                        <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                                            <Calendar className="h-3 w-3" />
                                            {format(new Date(notif.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
                                        <Clock className="h-3 w-3 mr-1" />
                                        Aguardando
                                    </Badge>
                                    {professorResponse && (
                                        <Badge
                                            variant={professorResponse === 'accepted' ? 'default' : 'destructive'}
                                            className={professorResponse === 'accepted' ? 'bg-green-600' : ''}
                                        >
                                            {professorResponse === 'accepted' ? 'Aceito' : 'Rejeitado'}
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5" />
                        <p className="text-xs text-blue-700">
                            <strong>Dica:</strong> Estas solicitações serão atualizadas automaticamente quando o professor aceitar ou rejeitar o aluno.
                            Clique em uma notificação para marcá-la como lida.
                        </p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
