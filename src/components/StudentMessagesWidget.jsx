// Archivo: src/components/StudentMessagesWidget.jsx

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, X, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const StudentMessagesWidget = () => {
    const { user } = useAuth();
    const [messages, setMessages] = useState([]);
    const [collapsed, setCollapsed] = useState(false);

    useEffect(() => {
        if (!user?.id) return;

        const fetchMessages = async () => {
            const { data } = await supabase
                .from('student_messages')
                .select('*')
                .eq('student_id', user.id)
                .eq('is_read', false)
                .order('created_at', { ascending: false })
                .limit(5);

            setMessages(data || []);
        };

        fetchMessages();

        // Suscripción a cambios en tiempo real
        const channel = supabase
            .channel('student-messages')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'student_messages',
                filter: `student_id=eq.${user.id}`
            }, () => {
                fetchMessages();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user?.id]);

    const handleMarkAsRead = async (messageId) => {
        await supabase
            .from('student_messages')
            .update({ is_read: true })
            .eq('id', messageId);

        setMessages(messages.filter(m => m.id !== messageId));
    };

    if (messages.length === 0) return null;

    const getPriorityColor = (priority) => {
        switch (priority) {
            case 'urgent':
                return 'border-red-500 bg-red-50';
            case 'important':
                return 'border-yellow-500 bg-yellow-50';
            default:
                return 'border-sky-500 bg-sky-50';
        }
    };

    const getPriorityBadge = (priority) => {
        switch (priority) {
            case 'urgent':
                return <Badge variant="destructive">Urgente</Badge>;
            case 'important':
                return <Badge className="bg-yellow-500">Importante</Badge>;
            default:
                return <Badge className="bg-sky-500">Normal</Badge>;
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
        >
            <div className="bg-white border-l-4 border-sky-500 rounded-lg shadow-sm p-4">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <MessageSquare className="h-5 w-5 text-sky-600" />
                        <h3 className="font-bold text-lg">Mensagens do Professor ({messages.length})</h3>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCollapsed(!collapsed)}
                    >
                        {collapsed ? <Eye className="h-4 w-4" /> : <X className="h-4 w-4" />}
                    </Button>
                </div>

                <AnimatePresence>
                    {!collapsed && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="space-y-3"
                        >
                            {messages.map(msg => (
                                <Alert key={msg.id} className={getPriorityColor(msg.priority)}>
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <AlertTitle className="font-semibold text-base">{msg.title}</AlertTitle>
                                                {getPriorityBadge(msg.priority)}
                                            </div>
                                            <AlertDescription className="text-sm text-slate-700 whitespace-pre-wrap">
                                                {msg.message}
                                            </AlertDescription>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleMarkAsRead(msg.id)}
                                            className="shrink-0"
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </Alert>
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
};

export default StudentMessagesWidget;
