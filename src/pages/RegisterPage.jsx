import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion } from "framer-motion";
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const RegisterPage = () => {
  const [loading, setLoading] = useState(false);
  const { signUp, signIn } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    const role = 'student';

    const { error: signUpError } = await signUp(email, password, {
      data: {
        username,
        full_name: fullName,
        role,
      }
    });

    if (!signUpError) {
      const { error: signInError } = await signIn(email, password);
      if (!signInError) {
        // Navigation handled by onAuthStateChange
      }
    }
    
    setLoading(false);
  };

  return (
    <motion.div
      className="flex items-center justify-center min-h-[80vh]"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3 }}
    >
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-2xl shadow-lg">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-slate-800">Crie sua conta de Aluno</h1>
          <p className="text-slate-500">Comece sua jornada conosco!</p>
        </div>
        
        <form onSubmit={handleRegister} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="fullName-student">Nome Completo</Label>
            <Input id="fullName-student" type="text" placeholder="Seu nome completo" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="username-student">Nome de Usuário</Label>
            <Input id="username-student" type="text" placeholder="Ex: joaosilva123" value={username} onChange={(e) => setUsername(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email-student">Email</Label>
            <Input id="email-student" type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password-student">Senha</Label>
            <div className="relative">
              <Input id="password-student" type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required className="pr-10" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500">
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>
          <Button type="submit" className="w-full bg-sky-600 hover:bg-sky-700" disabled={loading}>
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Criando conta...</> : 'Criar Conta de Aluno'}
          </Button>
        </form>

        <p className="text-sm text-center text-slate-500">
          Já tem uma conta?{' '}
          <Link to="/login" className="font-medium text-sky-600 hover:underline">
            Faça login
          </Link>
        </p>
        <p className="text-xs text-center text-slate-400">
          É um professor?{' '}
          <Link to="/professor-login" className="font-medium text-sky-600 hover:underline">
            Acesse o portal do professor
          </Link>
        </p>
      </div>
    </motion.div>
  );
};

export default RegisterPage;