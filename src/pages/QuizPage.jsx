import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Home } from 'lucide-react';
import QuizComponent from '@/components/student/QuizComponent';

const QuizPage = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-gradient-to-br from-violet-50 via-purple-50 to-indigo-50">
            {/* Header minimalista */}
            <div className="bg-white/80 backdrop-blur-sm border-b border-slate-100 sticky top-0 z-10">
                <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate('/')}
                        className="text-slate-600 hover:text-slate-800"
                    >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Voltar
                    </Button>
                    <div className="flex items-center gap-2">
                        <span className="text-2xl">🎯</span>
                        <span className="font-bold text-slate-800">Practica Español</span>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate('/')}
                        className="text-slate-600 hover:text-slate-800"
                    >
                        <Home className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Contenido del Quiz - Centrado y compacto */}
            <div className="max-w-2xl mx-auto px-4 py-6">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                >
                    <QuizComponent />
                </motion.div>
            </div>
        </div>
    );
};

export default QuizPage;
