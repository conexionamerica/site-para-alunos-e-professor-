import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


const PostRegistrationForm = () => {
    const { user, fetchProfile } = useAuth();
    const [age, setAge] = useState('');
    const [spanishLevel, setSpanishLevel] = useState('');
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!age || !spanishLevel) {
            toast({ variant: 'destructive', title: 'Campos obrigatórios', description: 'Por favor, preencha todos os campos.' });
            return;
        }
        setLoading(true);

        const { error } = await supabase
            .from('profiles')
            .update({ age: parseInt(age, 10), spanish_level: spanishLevel })
            .eq('id', user.id);

        if (error) {
            toast({ variant: 'destructive', title: 'Erro ao salvar', description: error.message });
        } else {
            toast({ variant: 'info', title: 'Informações salvas!', description: 'Obrigado por completar seu perfil.' });
            await fetchProfile(user.id); // Re-fetch profile to update context and remove form
        }
        setLoading(false);
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <motion.div
                className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
            >
                <h2 className="text-2xl font-bold text-center mb-2">Quase lá!</h2>
                <p className="text-slate-500 text-center mb-6">Precisamos de mais algumas informações para personalizar sua experiência.</p>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="age">Qual é a sua idade?</Label>
                        <Input
                            id="age"
                            type="number"
                            placeholder="Ex: 25"
                            value={age}
                            onChange={(e) => setAge(e.target.value)}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="spanishLevel">Qual seu nível de espanhol?</Label>
                         <Select onValueChange={setSpanishLevel} value={spanishLevel}>
                            <SelectTrigger id="spanishLevel">
                                <SelectValue placeholder="Selecione seu nível" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Iniciante">Iniciante (A1/A2)</SelectItem>
                                <SelectItem value="Intermediário">Intermediário (B1/B2)</SelectItem>
                                <SelectItem value="Avançado">Avançado (C1/C2)</SelectItem>
                                <SelectItem value="Nenhum">Não tenho conhecimento</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <Button type="submit" className="w-full bg-sky-600 hover:bg-sky-700" disabled={loading}>
                        {loading ? 'Salvando...' : 'Salvar e Continuar'}
                    </Button>
                </form>
            </motion.div>
        </div>
    );
};

export default PostRegistrationForm;