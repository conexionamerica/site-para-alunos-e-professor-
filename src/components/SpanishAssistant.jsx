// Archivo: src/components/SpanishAssistant.jsx
// Interfaz de Chat para el Asistente de Español

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Send, Bot, User, Sparkles, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import spanishAI from '@/lib/spanishAI';

const SpanishAssistant = ({ className }) => {
    const [messages, setMessages] = useState([
        {
            role: 'assistant',
            content: '¡Hola! 👋 Soy tu asistente de español. Puedo ayudarte con:\n\n📝 Traducción de palabras\n📖 Conjugación de verbos\n📚 Reglas gramaticales\n✍️ Ejercicios de práctica\n\n¿En qué puedo ayudarte hoy?',
            timestamp: new Date()
        }
    ]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [suggestions, setSuggestions] = useState(spanishAI.getSuggestions());
    const scrollRef = useRef(null);

    // Auto-scroll al final
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = async (messageText = input) => {
        if (!messageText.trim()) return;

        // Agregar mensaje del usuario
        const userMessage = {
            role: 'user',
            content: messageText,
            timestamp: new Date()
        };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsTyping(true);

        // Simular delay de "pensamiento"
        await new Promise(resolve => setTimeout(resolve, 500));

        // Obtener respuesta de la IA
        const aiResponse = spanishAI.processMessage(messageText);

        const assistantMessage = {
            role: 'assistant',
            content: aiResponse,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, assistantMessage]);
        setIsTyping(false);

        // Actualizar sugerencias
        setSuggestions(spanishAI.getSuggestions());
    };

    const handleSuggestionClick = (suggestion) => {
        handleSend(suggestion);
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <Card className={cn("w-full max-w-4xl mx-auto", className)}>
            <CardHeader className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
                <div className="flex items-center gap-3">
                    <div className="bg-white/20 p-2 rounded-lg">
                        <Bot className="h-6 w-6" />
                    </div>
                    <div>
                        <CardTitle className="text-xl">Asistente de Español</CardTitle>
                        <CardDescription className="text-blue-100">
                            IA especializada en enseñanza de español
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="p-0">
                {/* Área de mensajes */}
                <div ref={scrollRef} className="h-[500px] p-4 overflow-y-auto bg-slate-50">
                    <div className="space-y-4">
                        {messages.map((message, index) => (
                            <div
                                key={index}
                                className={cn(
                                    "flex gap-3",
                                    message.role === 'user' ? 'justify-end' : 'justify-start'
                                )}
                            >
                                {message.role === 'assistant' && (
                                    <div className="flex-shrink-0">
                                        <div className="bg-gradient-to-br from-blue-500 to-purple-500 p-2 rounded-full">
                                            <Bot className="h-5 w-5 text-white" />
                                        </div>
                                    </div>
                                )}

                                <div
                                    className={cn(
                                        "max-w-[80%] rounded-lg px-4 py-3",
                                        message.role === 'user'
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-slate-100 text-slate-900'
                                    )}
                                >
                                    <div className="whitespace-pre-wrap text-sm">
                                        {message.content}
                                    </div>
                                    <div
                                        className={cn(
                                            "text-xs mt-2",
                                            message.role === 'user' ? 'text-blue-100' : 'text-slate-500'
                                        )}
                                    >
                                        {message.timestamp.toLocaleTimeString('pt-BR', {
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </div>
                                </div>

                                {message.role === 'user' && (
                                    <div className="flex-shrink-0">
                                        <div className="bg-blue-600 p-2 rounded-full">
                                            <User className="h-5 w-5 text-white" />
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}

                        {/* Indicador de digitação */}
                        {isTyping && (
                            <div className="flex gap-3 justify-start">
                                <div className="flex-shrink-0">
                                    <div className="bg-gradient-to-br from-blue-500 to-purple-500 p-2 rounded-full">
                                        <Bot className="h-5 w-5 text-white" />
                                    </div>
                                </div>
                                <div className="bg-slate-100 rounded-lg px-4 py-3">
                                    <div className="flex gap-1">
                                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Sugerencias */}
                {suggestions.length > 0 && (
                    <div className="px-4 py-2 border-t bg-slate-50">
                        <div className="flex items-center gap-2 mb-2">
                            <Sparkles className="h-4 w-4 text-purple-600" />
                            <span className="text-xs font-medium text-slate-600">Sugestões:</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {suggestions.map((suggestion, index) => (
                                <Badge
                                    key={index}
                                    variant="outline"
                                    className="cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition-colors"
                                    onClick={() => handleSuggestionClick(suggestion)}
                                >
                                    {suggestion}
                                </Badge>
                            ))}
                        </div>
                    </div>
                )}

                {/* Input de mensagem */}
                <div className="p-4 border-t bg-white">
                    <div className="flex gap-2">
                        <Input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyPress={handleKeyPress}
                            placeholder="Digite sua pergunta em português ou español..."
                            className="flex-1"
                            disabled={isTyping}
                        />
                        <Button
                            onClick={() => handleSend()}
                            disabled={!input.trim() || isTyping}
                            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                        >
                            <Send className="h-4 w-4" />
                        </Button>
                    </div>
                    <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                        <BookOpen className="h-3 w-3" />
                        <span>Pressione Enter para enviar • Shift+Enter para nova linha</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default SpanishAssistant;
