import { X, AlertTriangle, Calendar } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useNotifications } from '@/hooks/useNotifications';

export function PlanExpiringBanner({ userId }) {
    const { notifications, markAsArchived, loading } = useNotifications(userId, {
        type: 'plan_expiring',
        status: 'pending',
        limit: 1
    });

    if (loading || notifications.length === 0) return null;

    const notification = notifications[0];
    const daysRemaining = Math.floor(notification.metadata?.days_remaining || 0);
    const endDate = notification.metadata?.end_date;
    const billingAmount = notification.metadata?.billing_amount;
    const billingPeriod = notification.metadata?.billing_period;

    // Determinar cor do alerta baseado nos dias restantes
    const getVariant = () => {
        if (daysRemaining <= 2) return 'destructive';
        if (daysRemaining <= 5) return 'default';
        return 'default';
    };

    const handleDismiss = () => {
        markAsArchived(notification.id);
    };

    return (
        <Alert variant={getVariant()} className="mb-4 border-2">
            <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                    <AlertTriangle className="h-5 w-5 mt-0.5" />
                    <div className="flex-1">
                        <AlertTitle className="text-lg font-semibold mb-2">
                            ⚠️ Seu Plano Está Acabando!
                        </AlertTitle>
                        <AlertDescription className="space-y-2">
                            <div className="flex items-center gap-2 text-base">
                                <Calendar className="h-4 w-4" />
                                <span>
                                    Faltam apenas <strong className="text-lg">{daysRemaining} {daysRemaining === 1 ? 'dia' : 'dias'}</strong> para o vencimento do seu plano
                                </span>
                            </div>

                            <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-md">
                                <p className="text-sm">
                                    <strong>Plano atual:</strong> {billingAmount} aulas/{billingPeriod}
                                </p>
                                <p className="text-sm">
                                    <strong>Data de vencimento:</strong> {new Date(endDate).toLocaleDateString('pt-BR')}
                                </p>
                            </div>

                            <p className="text-sm mt-3">
                                Entre em contato com a administração para renovar seu plano e continuar suas aulas sem interrupções.
                            </p>

                            <div className="mt-4 flex gap-2">
                                <Button
                                    size="sm"
                                    onClick={handleDismiss}
                                    className="bg-blue-600 hover:bg-blue-700"
                                >
                                    Entendi
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handleDismiss}
                                >
                                    Fechar
                                </Button>
                            </div>
                        </AlertDescription>
                    </div>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleDismiss}
                    className="h-6 w-6 rounded-full"
                >
                    <X className="h-4 w-4" />
                </Button>
            </div>
        </Alert>
    );
}
