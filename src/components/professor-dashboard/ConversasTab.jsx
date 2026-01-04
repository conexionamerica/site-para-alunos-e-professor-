// Arquivo: src/components/professor-dashboard/ConversasTab.jsx

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { ArrowLeft, Send, Loader2, MessageSquare as MessageSquareText } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getBrazilDate } from '@/lib/dateUtils';

const ChatInterface = ({ activeChat, professorId, professorName, onBack }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef(null);
  const { toast } = useToast();

  const scrollToBottom = () => chatEndRef.current?.scrollIntoView({ behavior: "smooth" });

  const fetchMessages = useCallback(async () => {
    if (!activeChat?.chat_id) return;
    setLoadingMessages(true);
    const { data, error } = await supabase.from('mensajes')
      .select('*')
      .eq('chat_id', activeChat.chat_id)
      .order('enviado_en', { ascending: true });

    if (error) {
      toast({ variant: 'destructive', title: 'Erro ao carregar mensagens.' });
    } else {
      setMessages(data || []);

      // Marcar mensagens do aluno como lidas
      const { error: updateError, count } = await supabase
        .from('mensajes')
        .update({ leido: true })
        .eq('chat_id', activeChat.chat_id)
        .neq('remitente_id', professorId)
        .eq('leido', false);

      if (updateError) {
        console.error('Erro ao marcar mensagens como lidas:', updateError);
      }

    }
    setLoadingMessages(false);
  }, [activeChat, toast, professorId]);

  useEffect(() => {
    fetchMessages();
    const channel = supabase.channel(`professor-chat-${activeChat.chat_id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes', filter: `chat_id=eq.${activeChat.chat_id}` },
        (payload) => {
          if (payload.new.remitente_id !== professorId) {
            setMessages((prev) => [...prev, payload.new]);
          }
        }).subscribe();

    return () => supabase.removeChannel(channel);
  }, [activeChat, fetchMessages, professorId]);

  useEffect(scrollToBottom, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    setSending(true);

    const tempMessage = newMessage;
    setNewMessage('');

    const localMessage = {
      mensaje_id: `temp-${Date.now()}`,
      chat_id: activeChat.chat_id,
      remitente_id: professorId,
      contenido: tempMessage,
      enviado_en: getBrazilDate().toISOString(),
    };
    setMessages((prev) => [...prev, localMessage]);

    const { error } = await supabase.from('mensajes').insert({
      chat_id: activeChat.chat_id,
      remitente_id: professorId,
      contenido: tempMessage.trim(),
    });

    if (error) {
      toast({ variant: "destructive", title: "Erro ao enviar", description: error.message });
      setMessages(prev => prev.filter(m => m.mensaje_id !== localMessage.mensaje_id));
      setNewMessage(tempMessage);
    } else {
      await supabase.from('notifications').insert({
        user_id: activeChat.alumno_id,
        type: 'new_message',
        content: {
          message: `Nova mensagem de ${professorName}`,
          senderName: professorName,
          chatId: activeChat.chat_id,
        }
      });
    }
    setSending(false);
  };

  return (
    <div className="w-full">
      <div className="w-full px-4 lg:px-8">
        <div className="bg-white rounded-lg shadow-sm flex flex-col h-[75vh]">
          <header className="p-4 border-b flex items-center gap-4 sticky top-0 bg-white z-10">
            <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="w-5 h-5" /></Button>
            <Avatar><AvatarImage src={activeChat.alumno_avatar_url} /><AvatarFallback>{activeChat.alumno_full_name?.[0] || 'A'}</AvatarFallback></Avatar>
            <h3 className="font-bold">{activeChat.alumno_full_name}</h3>
          </header>
          <main className="flex-1 p-4 overflow-y-auto bg-slate-50 space-y-4">
            {loadingMessages ? <div className="flex justify-center items-center h-full"><Loader2 className="w-8 h-8 animate-spin text-sky-600" /></div> : messages.length > 0 ? messages.map((msg) => {
              const isSender = msg.remitente_id === professorId;
              return (
                <div key={msg.mensaje_id} className={cn("flex", isSender ? "justify-end" : "justify-start")}>
                  <div className={cn("rounded-lg px-4 py-2 max-w-[80%]", isSender ? "bg-sky-600 text-white" : "bg-slate-200 text-slate-800")}>
                    <p className="text-sm">{msg.contenido}</p>
                  </div>
                </div>
              )
            }) : (
              <div className="flex flex-col items-center justify-center h-full text-center text-slate-400">
                <p>Nenhuma mensagem nesta conversa ainda.</p>
                <p className="text-sm">Envie a primeira mensagem para começar.</p>
              </div>
            )}
            <div ref={chatEndRef} />
          </main>
          <footer className="p-4 border-t bg-white">
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <Input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Digite sua mensagem..." autoComplete="off" disabled={sending} />
              <Button type="submit" disabled={sending || !newMessage.trim()}>
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </form>
          </footer>
        </div>
      </div>
    </div>
  );
};

// CORRECCIÓN PRINCIPAL: Agora só recebe 'dashboardData'
const ConversasTab = ({ dashboardData }) => {
  // Extração segura das propriedades
  const professorId = dashboardData?.professorId;
  const professorName = dashboardData?.professorName || 'Professor';
  const isSuperadmin = dashboardData?.isSuperadmin || false;
  const globalProfessorFilter = dashboardData?.globalProfessorFilter || 'all';
  const filteredProfessorId = dashboardData?.filteredProfessorId;

  // Para superadmin com filtro aplicado, usar o chatList filtrado
  // Para professor normal, usar o chatList que já vem filtrado
  const chatListData = dashboardData?.data?.chatList || [];
  const loading = dashboardData?.loading || false;

  // O professorId efetivo para marcar mensagens como lidas
  // Se superadmin está filtrando por professor, usa o ID do professor filtrado
  // Caso contrário, usa o ID do usuário logado
  const effectiveProfessorId = (isSuperadmin && globalProfessorFilter !== 'all')
    ? filteredProfessorId
    : professorId;

  const [chatList, setChatList] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [unreadCounts, setUnreadCounts] = useState({}); // Contagem de não lidas por chat_id
  const { toast } = useToast();

  const fetchChatList = useCallback(async () => {
    if (!professorId) return;

    // Se os dados já vieram do pai (filtrados), usa eles diretamente
    if (chatListData.length > 0 && !loading) {
      setChatList(chatListData);
      return;
    }

    // Fallback: buscar via RPC se não tiver dados do pai
    if (!loading && chatListData.length === 0) {
      // Para professor normal, sempre filtra pelo seu ID
      // Para superadmin, filtra pelo globalProfessorFilter se aplicado
      const filterProfId = isSuperadmin
        ? (globalProfessorFilter === 'all' ? null : globalProfessorFilter)
        : professorId;

      const { data, error } = await supabase.rpc('get_chat_list_v2', {
        p_prof_id: filterProfId
      });

      if (error) {
        console.error("Error fetching chat list:", error);
        // Fallback para RPC antiga
        if (error.code === 'PGRST202' && !isSuperadmin) {
          const { data: fallbackData } = await supabase.rpc('get_professor_chat_list', { p_id: professorId });
          setChatList(fallbackData || []);
        } else {
          toast({ variant: 'destructive', title: 'Erro ao carregar conversas', description: error.message });
        }
      } else {
        setChatList(data || []);
      }
    }
  }, [professorId, chatListData, loading, toast, isSuperadmin, globalProfessorFilter]);

  // Função para buscar contagem de mensagens não lidas por chat
  const fetchUnreadCounts = useCallback(async () => {
    if (!effectiveProfessorId || chatList.length === 0) return;

    const chatIds = chatList.map(c => c.chat_id);
    const counts = {};

    for (const chatId of chatIds) {
      const { count, error } = await supabase
        .from('mensajes')
        .select('mensaje_id', { count: 'exact', head: true })
        .eq('chat_id', chatId)
        .neq('remitente_id', effectiveProfessorId)
        .eq('leido', false);

      if (!error) {
        counts[chatId] = count || 0;
      }
    }

    setUnreadCounts(counts);
  }, [effectiveProfessorId, chatList]);

  useEffect(() => {
    // Se o pai passar a lista, use-a.
    if (chatListData.length > 0 && chatList.length === 0) {
      setChatList(chatListData);
    }

    // Configuração de Realtime para inserções de mensagens/chats
    if (!professorId) return;

    const handleInserts = (payload) => {
      fetchChatList();
      fetchUnreadCounts();
    };

    const channel = supabase.channel('professor-chat-list')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes' }, handleInserts)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chats',
        filter: isSuperadmin ? undefined : `profesor_id=eq.${professorId}`
      }, handleInserts)
      .subscribe();

    return () => supabase.removeChannel(channel);

  }, [professorId, fetchChatList, fetchUnreadCounts, chatListData, isSuperadmin]);

  // Buscar contagem de mensagens não lidas quando a lista de chats mudar
  useEffect(() => {
    if (chatList.length > 0) {
      fetchUnreadCounts();
    }
  }, [chatList, fetchUnreadCounts]);

  // Handler para voltar do chat e atualizar contagens
  const handleBackFromChat = useCallback(() => {
    setActiveChat(null);
    // Forçar atualização das contagens de mensagens não lidas
    fetchUnreadCounts();
  }, [fetchUnreadCounts]);

  if (activeChat) {
    return <ChatInterface activeChat={activeChat} professorId={effectiveProfessorId} professorName={professorName} onBack={handleBackFromChat} />;
  }

  return (
    <div className="w-full">
      <div className="w-full px-4 lg:px-8">
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h3 className="text-xl font-bold mb-4">Conversas com Alunos</h3>
          <div className="space-y-2 max-h-[70vh] overflow-y-auto">
            {loading ? <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-sky-600" /></div> :
              chatList.length > 0 ? chatList.map(chat => (
                <div key={chat.chat_id} onClick={() => setActiveChat(chat)} className={cn("flex items-start gap-4 p-3 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors border shadow-sm bg-white", unreadCounts[chat.chat_id] > 0 && "bg-sky-50 border-sky-200")}>
                  <Avatar className="h-10 w-10"><AvatarImage src={chat.alumno_avatar_url} /><AvatarFallback>{chat.alumno_full_name?.[0] || 'A'}</AvatarFallback></Avatar>
                  <div className="flex-1 overflow-hidden">
                    <div className="flex justify-between items-center mb-0.5">
                      <div className="flex flex-col">
                        <p className={cn("font-bold text-slate-800 truncate leading-none mb-1", unreadCounts[chat.chat_id] > 0 && "text-sky-800")}>{chat.alumno_full_name}</p>
                        {isSuperadmin && (
                          <span className="text-[10px] text-slate-400 font-medium uppercase tracking-tight">
                            Professor: {chat.profesor_full_name || 'Desconhecido'}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {unreadCounts[chat.chat_id] > 0 && (
                          <span className="bg-sky-600 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                            {unreadCounts[chat.chat_id]}
                          </span>
                        )}
                        {chat.last_message_time && (
                          <p className="text-[10px] text-slate-400 flex-shrink-0 font-medium">{formatDistanceToNow(new Date(chat.last_message_time), { addSuffix: true, locale: ptBR })}</p>
                        )}
                      </div>
                    </div>
                    <p className={cn("text-xs truncate max-w-[90%]", unreadCounts[chat.chat_id] > 0 ? "text-slate-700 font-semibold" : "text-slate-500")}>{chat.last_message_content || 'Nenhuma mensagem ainda.'}</p>
                  </div>
                </div>
              )) :
                <div className="flex flex-col items-center justify-center h-64 text-center text-slate-500">
                  <MessageSquareText className="w-16 h-16 mb-4" />
                  <p className="text-lg">Nenhuma conversa iniciada.</p>
                  <p className="text-sm">Quando um aluno enviar uma mensagem, ela aparecerá aqui.</p>
                </div>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConversasTab;
