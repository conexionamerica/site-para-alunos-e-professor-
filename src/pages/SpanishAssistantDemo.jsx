// Archivo: src/pages/SpanishAssistantDemo.jsx
// Página de demostración del Asistente de Español

import React from 'react';
import SpanishAssistant from '@/components/SpanishAssistant';
import { ArrowLeft, Sparkles, Brain, MessageSquare, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const SpanishAssistantDemo = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
            {/* Header */}
            <div className="bg-white border-b shadow-sm">
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => navigate(-1)}
                            >
                                <ArrowLeft className="h-5 w-5" />
                            </Button>
                            <div>
                                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                                    Asistente de Español IA
                                </h1>
                                <p className="text-sm text-slate-600">
                                    Modelo local de inteligencia artificial
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-medium">
                                ✓ Gratis
                            </div>
                            <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-medium">
                                🚀 Local
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-7xl mx-auto px-4 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Sidebar con información */}
                    <div className="lg:col-span-1 space-y-4">
                        {/* Características */}
                        <div className="bg-white rounded-lg shadow-sm p-6">
                            <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
                                <Sparkles className="h-5 w-5 text-purple-600" />
                                Características
                            </h2>
                            <div className="space-y-3">
                                <div className="flex items-start gap-3">
                                    <div className="bg-blue-100 p-2 rounded-lg">
                                        <Brain className="h-4 w-4 text-blue-600" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-sm">IA Local</p>
                                        <p className="text-xs text-slate-600">
                                            Funciona sin internet, 100% gratis
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="bg-purple-100 p-2 rounded-lg">
                                        <MessageSquare className="h-4 w-4 text-purple-600" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-sm">Chat Inteligente</p>
                                        <p className="text-xs text-slate-600">
                                            Respuestas contextuales y personalizadas
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="bg-pink-100 p-2 rounded-lg">
                                        <BookOpen className="h-4 w-4 text-pink-600" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-sm">Base de Conocimiento</p>
                                        <p className="text-xs text-slate-600">
                                            Gramática, vocabulario y conjugaciones
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Ejemplos de uso */}
                        <div className="bg-white rounded-lg shadow-sm p-6">
                            <h2 className="font-bold text-lg mb-4">Ejemplos de Uso</h2>
                            <div className="space-y-2 text-sm">
                                <div className="bg-slate-50 p-3 rounded-lg">
                                    <p className="font-medium text-blue-600">Traducción:</p>
                                    <p className="text-slate-600">"¿Cómo se dice casa?"</p>
                                </div>
                                <div className="bg-slate-50 p-3 rounded-lg">
                                    <p className="font-medium text-purple-600">Conjugación:</p>
                                    <p className="text-slate-600">"Conjuga el verbo ser"</p>
                                </div>
                                <div className="bg-slate-50 p-3 rounded-lg">
                                    <p className="font-medium text-pink-600">Gramática:</p>
                                    <p className="text-slate-600">"Diferencia entre ser y estar"</p>
                                </div>
                                <div className="bg-slate-50 p-3 rounded-lg">
                                    <p className="font-medium text-green-600">Práctica:</p>
                                    <p className="text-slate-600">"Quiero practicar"</p>
                                </div>
                            </div>
                        </div>

                        {/* Estadísticas */}
                        <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg shadow-sm p-6 text-white">
                            <h2 className="font-bold text-lg mb-4">Capacidades</h2>
                            <div className="space-y-3">
                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span>Vocabulario</span>
                                        <span>50+ palabras</span>
                                    </div>
                                    <div className="bg-white/20 rounded-full h-2">
                                        <div className="bg-white rounded-full h-2 w-3/4"></div>
                                    </div>
                                </div>
                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span>Verbos</span>
                                        <span>4 verbos</span>
                                    </div>
                                    <div className="bg-white/20 rounded-full h-2">
                                        <div className="bg-white rounded-full h-2 w-1/2"></div>
                                    </div>
                                </div>
                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span>Reglas</span>
                                        <span>3 reglas</span>
                                    </div>
                                    <div className="bg-white/20 rounded-full h-2">
                                        <div className="bg-white rounded-full h-2 w-2/3"></div>
                                    </div>
                                </div>
                            </div>
                            <p className="text-xs mt-4 text-blue-100">
                                💡 Este es un modelo de prueba. Puede expandirse con más conocimiento.
                            </p>
                        </div>
                    </div>

                    {/* Chat principal */}
                    <div className="lg:col-span-2">
                        <SpanishAssistant />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SpanishAssistantDemo;
