import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from '@/components/ui/button';
import { Bell, MessageSquare, Star, Package, Clock, RotateCcw, UserX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const NotificationIcon = ({ type }) => {
  switch (type) {
    case 'class_feedback':
      return <Star className="h-4 w-4 text-yellow-500" />;
    case 'new_package':
      return <Package className="h-4 w-4 text-green-500" />;
    case 'new_message':
      return <MessageSquare className="h-4 w-4 text-blue-500" />;
    case 'class_reminder':
      return <Clock className="h-4 w-4 text-blue-500" />;
    case 'class_missed':
        return <UserX className="h-4 w-4 text-red-500" />;
    case 'class_rescheduled':
        return <RotateCcw className="h-4 w-4 text-purple-500" />;
    default:
      return <Bell className="h-4 w-4 text-slate-500" />;
  }
};

const MiniStarRating = ({ rating }) => (
    <div className="flex items-center">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-3 w-3 ${rating >= star ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
        />
      ))}
    </div>
);

const NotificationItem = ({ notification, onRead }) => {
  const { type, content, created_at, is_read } = notification;

  let title = "Nova notificação";
  let description = "Você tem uma nova atualização.";
  let feedbackDetails = null;

  switch (type) {
    case 'class_feedback':
      title = "Feedback recebido!";
      description = content.message || `O professor avaliou sua aula.`;
      if (content.ratings) {
        feedbackDetails = (
          <div className="mt-2 space-y-1 text-xs text-slate-500 border-t pt-2">
            {Object.entries(content.ratings).map(([key, value]) => (
              <div key={key} className="flex justify-between items-center">
                <span className="capitalize">{key.replace('_', ' ')}</span>
                <MiniStarRating rating={value} />
              </div>
            ))}
            {content.comment && (
              <p className="mt-2 pt-1 border-t text-slate-600">"{content.comment}"</p>
            )}
          </div>
        );
      }
      break;
    case 'new_package':
      title = "Novo pacote de aulas!";
      description = content.message || `Você recebeu um novo pacote.`;
      break;
    case 'new_message':
      title = "Nova mensagem";
      description = content.message || `Você tem uma nova mensagem.`;
      break;
    case 'class_missed':
      title = "Aula marcada como falta";
      description = content.message || "Uma de suas aulas foi marcada como falta.";
      break;
    case 'class_rescheduled':
        title = "Crédito de aula devolvido";
        description = content.message || "Um crédito de aula foi devolvido para reagendamento.";
        break;
  }
  
  return (
    <div
      className={cn(
        "p-3 flex items-start gap-3 border-b last:border-b-0 cursor-pointer hover:bg-slate-50",
        !is_read && "bg-sky-50"
      )}
      onClick={() => !is_read && onRead(notification.id)}
    >
        {!is_read && <div className="h-2 w-2 rounded-full bg-sky-500 mt-1.5 flex-shrink-0"></div>}
        <div className={cn("flex-shrink-0", is_read && 'ml-4')}>
            <NotificationIcon type={type} />
        </div>
        <div className="flex-1">
            <p className="font-semibold text-sm">{title}</p>
            <p className="text-xs text-slate-600">{description}</p>
            {feedbackDetails}
            <p className="text-xs text-slate-400 mt-2">
                {formatDistanceToNow(new Date(created_at), { addSuffix: true, locale: ptBR })}
            </p>
        </div>
    </div>
  );
};


const NotificationsWidget = () => {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);

    const fetchNotifications = useCallback(async () => {
        if (!user) return;
        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(20);

        if (!error) {
            setNotifications(data);
            setUnreadCount(data.filter(n => !n.is_read).length);
        }
    }, [user]);

    useEffect(() => {
        fetchNotifications();

        const channel = supabase
            .channel('realtime-notifications')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${user?.id}`
            }, (payload) => {
                setNotifications(prev => [payload.new, ...prev]);
                setUnreadCount(prev => prev + 1);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, fetchNotifications]);
    
    const handleMarkAsRead = async (id) => {
        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('id', id);

        if (!error) {
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
        }
    };
    
    const handleMarkAllAsRead = async () => {
        const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
        if (unreadIds.length === 0) return;

        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .in('id', unreadIds);

        if (!error) {
            setNotifications(prev => prev.map(n => ({...n, is_read: true})));
            setUnreadCount(0);
        }
    }
    
    useEffect(() => {
        if(isOpen && unreadCount > 0) {
            // Give a moment for the user to see the notifications before marking all as read
            const timer = setTimeout(() => {
                handleMarkAllAsRead();
            }, 3000);
            return () => clearTimeout(timer);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, unreadCount]);


  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5 text-slate-600" />
              {unreadCount > 0 && (
                <span className="absolute top-0 right-0 flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-sky-500 text-white text-xs items-center justify-center">{unreadCount}</span>
                </span>
              )}
            </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 p-0">
            <div className="p-3 border-b">
                <h4 className="font-medium text-sm">Notificações</h4>
            </div>
            <div className="max-h-96 overflow-y-auto">
                {notifications.length > 0 ? (
                    notifications.map(n => <NotificationItem key={n.id} notification={n} onRead={handleMarkAsRead} />)
                ) : (
                    <p className="text-center text-sm text-slate-500 py-8">Nenhuma notificação por aqui.</p>
                )}
            </div>
        </PopoverContent>
    </Popover>
  );
};

export default NotificationsWidget;