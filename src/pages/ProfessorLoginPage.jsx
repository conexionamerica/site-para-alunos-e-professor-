import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion } from "framer-motion";
import { Eye, EyeOff, UserCog, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';

const ProfessorLoginForm = ({ onLogin, loading }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    onLogin(email, password);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="email-login">Email ou Usuário</Label>
        <Input
          id="email-login"
          type="text"
          placeholder="seu@email.com ou usuario"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="bg-slate-900 border-slate-700 text-white focus:ring-sky-500"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password-login">Senha</Label>
        <div className="relative">
          <Input id="password-login" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required className="pr-10 bg-slate-900 border-slate-700 text-white focus:ring-sky-500" />
          <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400">
            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </div>
      </div>
      <Button type="submit" className="w-full bg-sky-600 hover:bg-sky-700 text-white" disabled={loading}>
        {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verificando...</> : 'Entrar'}
      </Button>
    </form>
  );
};

const ProfessorLoginPage = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { setProfessorSession } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (identifier, password) => {
    setLoading(true);
    let loginEmail = identifier;

    // Se não tiver @, assume que é um username e tenta buscar o e-mail
    if (!identifier.includes('@')) {
      const { data: profile, error: searchError } = await supabase
        .from('profiles')
        .select('real_email')
        .eq('username', identifier.trim().toLowerCase())
        .single();

      if (profile?.real_email) {
        loginEmail = profile.real_email;
      } else {
        toast({ variant: "destructive", title: "Usuário não encontrado", description: "O nome de usuário informado não existe." });
        setLoading(false);
        return;
      }
    }

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: loginEmail.trim(),
      password
    });

    if (authError || !authData.user) {
      toast({ variant: "destructive", title: "Credenciais inválidas", description: "O e-mail/usuário ou a senha estão incorretos." });
      setLoading(false);
      return;
    }

    const { data: profileData, error: profileError } = await supabase.from('profiles').select('role').eq('id', authData.user.id).single();

    // Permitir acesso a profesores Y superadmins Y admins
    const allowedRoles = ['professor', 'superadmin', 'admin'];

    if (profileError || !allowedRoles.includes(profileData?.role)) {
      toast({ variant: "destructive", title: "Acesso Negado", description: "Você não tem permissão para acessar este painel." });
      await supabase.auth.signOut();
    } else {
      setProfessorSession(true);
      const welcomeMessage = (profileData.role === 'superadmin' || profileData.role === 'admin')
        ? "Bem-vindo ao painel administrativo."
        : "Bem-vindo ao painel do professor.";
      toast({ variant: "info", title: "Login bem-sucedido!", description: welcomeMessage });
      navigate('/professor-dashboard');
    }
    setLoading(false);
  };

  return (
    <motion.div
      className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="absolute top-8 left-8">
        <Link to="/" className="text-left">
          <div className="text-3xl font-bold"><span className="text-sky-400">Conexion</span><span className="text-slate-100"> America</span></div>
          <p className="text-xs text-slate-400 tracking-wider mt-1">A qualquer hora, Em qualquer lugar...</p>
        </Link>
      </div>

      <div className="w-full max-w-md p-8 space-y-8 bg-slate-800/50 backdrop-blur-sm rounded-2xl shadow-lg border border-slate-700">
        <div className="text-center">
          <UserCog className="mx-auto h-12 w-12 text-sky-400" />
          <h1 className="text-3xl font-bold text-white mt-4">Portal do Professor</h1>
          <p className="text-slate-400">Acesso exclusivo para administradores.</p>
        </div>

        <div className="mt-6">
          <ProfessorLoginForm onLogin={handleLogin} loading={loading} />
        </div>

        <div className="text-center mt-4">
          <Link to="/login" className="text-sm text-slate-400 hover:text-white transition-colors">
            Ir para o Portal do Aluno &rarr;
          </Link>
        </div>
      </div>
    </motion.div>
  );
};

export default ProfessorLoginPage;