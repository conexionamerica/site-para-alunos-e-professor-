import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MessageSquare, Send, X, Bot, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { getBrazilDate } from '@/lib/dateUtils';

const ChatWidget = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [messageContent, setMessageContent] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef(null);

  const [professorId, setProfessorId] = useState(null);
  const [chatId, setChatId] = useState(null);
  const [loadingInitial, setLoadingInitial] = useState(true);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const getOrCreateChat = useCallback(async (currentProfessorId) => {
    if (!user || !currentProfessorId) return null;

    let { data: existingChat, error: fetchError } = await supabase
      .from('chats')
      .select('chat_id')
      .eq('alumno_id', user.id)
      .eq('profesor_id', currentProfessorId)
      .maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error("Error fetching chat:", fetchError);
      toast({ variant: "destructive", title: "Erro no Chat", description: "Não foi possível carregar a conversa." });
      return null;
    }

    if (existingChat) {
      return existingChat.chat_id;
    } else {
      const { data: newChat, error: createError } = await supabase
        .from('chats')
        .insert({ alumno_id: user.id, profesor_id: currentProfessorId })
        .select('chat_id')
        .single();

      if (createError) {
        console.error("Error creating chat:", createError);
        toast({ variant: "destructive", title: "Erro no Chat", description: "Não foi possível iniciar uma nova conversa." });
        return null;
      }
      return newChat.chat_id;
    }
  }, [user, toast]);

  const fetchInitialData = useCallback(async () => {
    if (!user || !isOpen) return;

    setLoadingInitial(true);
    const { data: profData, error: profError } = await supabase.from('profiles').select('id').eq('role', 'professor').limit(1).maybeSingle();

    if (profError || !profData) {
      toast({ variant: "destructive", title: "Erro no Chat", description: "Professor não cadastrado. Não é possível iniciar o chat." });
      setLoadingInitial(false);
      return;
    }
    const currentProfessorId = profData.id;
    setProfessorId(currentProfessorId);

    const currentChatId = await getOrCreateChat(currentProfessorId);
    if (!currentChatId) {
      setLoadingInitial(false);
      return;
    }
    setChatId(currentChatId);

    const { data: messagesData, error: messagesError } = await supabase.from('mensajes').select('*').eq('chat_id', currentChatId).order('enviado_en', { ascending: true });

    if (messagesError) {
      console.error("Error fetching messages:", messagesError);
      toast({ variant: "destructive", title: "Erro no Chat", description: "Não foi possível carregar as mensagens." });
    } else {
      setMessages(messagesData || []);
    }
    setLoadingInitial(false);
  }, [user, isOpen, getOrCreateChat, toast]);


  useEffect(() => {
    if (isOpen) {
      fetchInitialData();
    } else {
      setMessages([]);
      setChatId(null);
      setProfessorId(null);
    }
  }, [isOpen, fetchInitialData]);

  useEffect(() => {
    if (!chatId) return;

    const channel = supabase
      .channel(`chat-room-${chatId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes', filter: `chat_id=eq.${chatId}` },
        (payload) => {
          if (payload.new.remitente_id !== user.id) {
            setMessages((currentMessages) => [...currentMessages, payload.new]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatId, user.id]);

  useEffect(scrollToBottom, [messages]);


  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!messageContent.trim() || !user || !chatId) return;

    setLoading(true);
    const tempMessageContent = messageContent;
    setMessageContent('');

    const localMessage = {
      mensaje_id: `temp-${Date.now()}`,
      chat_id: chatId,
      remitente_id: user.id,
      contenido: tempMessageContent,
      enviado_en: getBrazilDate().toISOString(),
      leido: false,
    };
    setMessages((prevMessages) => [...prevMessages, localMessage]);


    const { error } = await supabase
      .from('mensajes')
      .insert({
        chat_id: chatId,
        remitente_id: user.id,
        contenido: tempMessageContent,
      });

    if (error) {
      toast({ variant: "destructive", title: "Erro ao enviar", description: error.message });
      setMessageContent(tempMessageContent);
      setMessages((prevMessages) => prevMessages.filter(msg => msg.mensaje_id !== localMessage.mensaje_id));
    }
    setLoading(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
          <Button size="icon" className="rounded-full w-16 h-16 bg-sky-600 hover:bg-sky-700 shadow-lg">
            {isOpen ? <X className="h-8 w-8" /> : <MessageSquare className="h-8 w-8" />}
          </Button>
        </motion.div>
      </PopoverTrigger>
      <PopoverContent side="top" align="end" className="w-80 md:w-96 p-0 border-0 rounded-2xl shadow-2xl mr-4 mb-2" sideOffset={10}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}>
          <div className="flex flex-col h-[28rem]">
            <header className="p-4 bg-sky-600 text-white rounded-t-2xl flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-full"><Bot className="h-6 w-6" /></div>
              <h3 className="font-bold text-lg">Fale com o Professor</h3>
            </header>
            <main className="flex-1 p-4 bg-slate-50 overflow-y-auto space-y-4">
              {loadingInitial ? <div className="flex justify-center items-center h-full"><Loader2 className="w-8 h-8 animate-spin text-sky-600" /></div> :
                messages.map((msg) => {
                  const isSender = msg.remitente_id === user.id;
                  return (
                    <div key={msg.mensaje_id} className={cn("flex", isSender ? "justify-end" : "justify-start")}>
                      <div className={cn("rounded-lg px-4 py-2 max-w-[80%]", isSender ? "bg-sky-600 text-white" : "bg-slate-200 text-slate-800")}>
                        <p className="text-sm">{msg.contenido}</p>
                      </div>
                    </div>
                  );
                })}
              <div ref={chatEndRef} />
              {messages.length === 0 && !loadingInitial && (
                <div className="text-center text-sm text-slate-400 pt-16">
                  O histórico de mensagens aparecerá aqui. Envie a primeira!
                </div>
              )}
            </main>
            <footer className="p-4 bg-white border-t rounded-b-2xl">
              <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                <Input
                  type="text"
                  placeholder="Digite sua mensagem..."
                  value={messageContent}
                  onChange={(e) => setMessageContent(e.target.value)}
                  disabled={loading || loadingInitial || !chatId}
                />
                <Button type="submit" size="icon" disabled={loading || loadingInitial || !messageContent.trim() || !chatId}>
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </footer>
          </div>
        </motion.div>
      </PopoverContent>
    </Popover>
  );
};

export default ChatWidget;