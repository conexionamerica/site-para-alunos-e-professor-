import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';

/**
 * Hook customizado para gerenciar notificações do usuário
 * @param {string} userId - ID do usuário
 * @param {object} filters - Filtros opcionais { status, type, limit }
 */
export function useNotifications(userId, filters = {}) {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [unreadCount, setUnreadCount] = useState(0);

    const fetchNotifications = useCallback(async () => {
        if (!userId) {
            setLoading(false);
            return;
        }

        let query = supabase
            .from('notifications')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        // Aplicar filtros
        if (filters.status) {
            if (Array.isArray(filters.status)) {
                query = query.in('status', filters.status);
            } else {
                query = query.eq('status', filters.status);
            }
        }

        if (filters.type) {
            if (Array.isArray(filters.type)) {
                query = query.in('type', filters.type);
            } else {
                query = query.eq('type', filters.type);
            }
        }

        if (filters.limit) {
            query = query.limit(filters.limit);
        }

        const { data, error } = await query;

        if (!error && data) {
            setNotifications(data);
            // Contar não lidas (status pending)
            const unread = data.filter(n => n.status === 'pending').length;
            setUnreadCount(unread);
        } else if (error) {
            console.error('Error fetching notifications:', error);
        }

        setLoading(false);
    }, [userId, JSON.stringify(filters)]);

    /**
     * Marca uma notificação como lida
     */
    const markAsRead = async (notificationId) => {
        const { error } = await supabase
            .from('notifications')
            .update({
                status: 'read',
                read_at: new Date().toISOString()
            })
            .eq('id', notificationId);

        if (!error) {
            await fetchNotifications();
        }

        return { error };
    };

    /**
     * Marca uma notificação como arquivada
     */
    const markAsArchived = async (notificationId) => {
        const { error } = await supabase
            .from('notifications')
            .update({
                status: 'archived',
                resolved_at: new Date().toISOString()
            })
            .eq('id', notificationId);

        if (!error) {
            await fetchNotifications();
        }

        return { error };
    };

    /**
     * Responde a uma solicitação (aceitar ou rejeitar)
     * @param {string} notificationId - ID da notificação
     * @param {string} response - 'accepted' ou 'rejected'
     */
    const respondToRequest = async (notificationId, response) => {
        // Buscar a notificação para obter metadata
        const { data: notif } = await supabase
            .from('notifications')
            .select('*')
            .eq('id', notificationId)
            .single();

        if (!notif) return { error: 'Notification not found' };

        // Atualizar a notificação do professor
        const { error } = await supabase
            .from('notifications')
            .update({
                status: response,
                resolved_at: new Date().toISOString()
            })
            .eq('id', notificationId);

        if (error) return { error };

        // Atualizar notificação relacionada do admin
        await updateAdminNotification(notif, response);

        await fetchNotifications();

        return { error: null };
    };

    /**
     * Atualiza a notificação do admin quando professor responde
     */
    const updateAdminNotification = async (professorNotif, response) => {
        if (!professorNotif.related_user_id) return;

        // Buscar a notificação do admin relacionada
        const { data: adminNotifs } = await supabase
            .from('notifications')
            .select('*')
            .eq('type', 'schedule_request')
            .eq('related_user_id', professorNotif.related_user_id)
            .in('status', ['pending', 'read']);

        if (adminNotifs && adminNotifs.length > 0) {
            // Atualizar todas as notificações relacionadas
            for (const adminNotif of adminNotifs) {
                await supabase
                    .from('notifications')
                    .update({
                        status: response === 'accepted' ? 'archived' : 'read',
                        resolved_at: new Date().toISOString(),
                        metadata: {
                            ...adminNotif.metadata,
                            professor_response: response,
                            responded_at: new Date().toISOString()
                        }
                    })
                    .eq('id', adminNotif.id);
            }
        }
    };

    /**
     * Marcar múltiplas notificações como lidas
     */
    const markAllAsRead = async () => {
        const { error } = await supabase
            .from('notifications')
            .update({
                status: 'read',
                read_at: new Date().toISOString()
            })
            .eq('user_id', userId)
            .eq('status', 'pending');

        if (!error) {
            await fetchNotifications();
        }

        return { error };
    };

    // Buscar notificações ao montar e quando filtros mudarem
    useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]);

    // Configurar real-time subscription
    useEffect(() => {
        if (!userId) return;

        const subscription = supabase
            .channel('notifications_changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${userId}`
                },
                (payload) => {
                    console.log('Notification change:', payload);
                    fetchNotifications();
                }
            )
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, [userId, fetchNotifications]);

    return {
        notifications,
        loading,
        unreadCount,
        markAsRead,
        markAsArchived,
        respondToRequest,
        markAllAsRead,
        refresh: fetchNotifications
    };
}
