import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Clock, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { differenceInDays, parseISO, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function DaysRemainingWidget({ userId }) {
    const [daysRemaining, setDaysRemaining] = useState(null);
    const [expirationDate, setExpirationDate] = useState(null);
    const [loading, setLoading] = useState(true);
    const [packageName, setPackageName] = useState('');

    useEffect(() => {
        if (!userId) return;

        const fetchActiveBilling = async () => {
            try {
                setLoading(true);

                // Buscar el paquete activo más reciente del usuario
                const { data: billings, error } = await supabase
                    .from('billing')
                    .select(`
            *,
            packages (
              name,
              number_of_classes
            )
          `)
                    .eq('user_id', userId)
                    .eq('status', 'active')
                    .gte('end_date', new Date().toISOString())
                    .order('end_date', { ascending: false })
                    .limit(1);

                if (error) {
                    console.error('Error fetching billing:', error);
                    return;
                }

                if (billings && billings.length > 0) {
                    const billing = billings[0];
                    const endDate = parseISO(billing.end_date);
                    const today = new Date();
                    const days = differenceInDays(endDate, today);

                    setDaysRemaining(days);
                    setExpirationDate(endDate);
                    setPackageName(billing.custom_package_name || billing.packages?.name || 'Pacote');
                } else {
                    setDaysRemaining(null);
                    setExpirationDate(null);
                }
            } catch (err) {
                console.error('Error in fetchActiveBilling:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchActiveBilling();

        // Actualizar cada hora
        const interval = setInterval(fetchActiveBilling, 60 * 60 * 1000);
        return () => clearInterval(interval);
    }, [userId]);

    if (loading || daysRemaining === null) {
        return null;
    }

    // Determinar el color basado en los días restantes
    const getColorScheme = () => {
        if (daysRemaining <= 5) {
            return {
                gradient: 'from-red-500 to-rose-600',
                bg: 'bg-red-50',
                text: 'text-red-700',
                icon: 'text-red-500',
                border: 'border-red-200'
            };
        } else if (daysRemaining <= 10) {
            return {
                gradient: 'from-orange-500 to-amber-600',
                bg: 'bg-orange-50',
                text: 'text-orange-700',
                icon: 'text-orange-500',
                border: 'border-orange-200'
            };
        } else {
            return {
                gradient: 'from-sky-500 to-blue-600',
                bg: 'bg-sky-50',
                text: 'text-sky-700',
                icon: 'text-sky-500',
                border: 'border-sky-200'
            };
        }
    };

    const colors = getColorScheme();

    return (
        <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-xl border-2 ${colors.border} ${colors.bg} p-4 shadow-sm mb-6`}
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className={`p-2 bg-gradient-to-br ${colors.gradient} rounded-lg`}>
                        {daysRemaining <= 5 ? (
                            <AlertTriangle className="h-5 w-5 text-white" />
                        ) : (
                            <Calendar className="h-5 w-5 text-white" />
                        )}
                    </div>
                    <div>
                        <p className={`font-bold ${colors.text}`}>
                            {daysRemaining} {daysRemaining === 1 ? 'dia restante' : 'dias restantes'}
                        </p>
                        <p className="text-xs text-slate-500">
                            {packageName} • Vence em {format(expirationDate, "dd 'de' MMMM", { locale: ptBR })}
                        </p>
                    </div>
                </div>

                {/* Contador visual */}
                <div className="text-right">
                    <div className={`text-3xl font-black bg-gradient-to-br ${colors.gradient} bg-clip-text text-transparent`}>
                        {daysRemaining}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-slate-400">
                        <Clock className="h-3 w-3" />
                        <span>dias</span>
                    </div>
                </div>
            </div>

            {/* Barra de progreso */}
            <div className="mt-3">
                <div className="bg-slate-200 rounded-full h-2 overflow-hidden">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min((daysRemaining / 30) * 100, 100)}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className={`h-full bg-gradient-to-r ${colors.gradient} rounded-full`}
                    />
                </div>
            </div>

            {/* Mensaje de alerta si está cerca de vencer */}
            {daysRemaining <= 5 && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-3 pt-3 border-t border-red-200"
                >
                    <p className="text-xs text-red-600 font-medium flex items-center gap-2">
                        <AlertTriangle className="h-3 w-3" />
                        Seu pacote está próximo do vencimento! Entre em contato para renovar.
                    </p>
                </motion.div>
            )}
        </motion.div>
    );
}
