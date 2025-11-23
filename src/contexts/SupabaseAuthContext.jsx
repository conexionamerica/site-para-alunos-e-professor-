import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { useNavigate } from 'react-router-dom';

const AuthContext = createContext(undefined);

export const AuthProvider = ({ children }) => {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);

  const [professorSession, setProfessorSession] = useState(() => {
    return sessionStorage.getItem('professor-session') === 'true';
  });

  const fetchProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null);
      return null;
    }
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (error) {
      console.error('Error fetching profile:', error);
      setProfile(null);
    } else {
      setProfile(data);
    }
    return data;
  }, []);

  const signOut = useCallback(async () => {
    setUser(null);
    setSession(null);
    setProfile(null);
    setProfessorSession(false);
    sessionStorage.removeItem('professor-session');

    const { error } = await supabase.auth.signOut();
    if (error) {
      if (error.message !== 'No session found' && error.code !== 'session_not_found') {
        console.error("Sign out error:", error);
        toast({ variant: "destructive", title: "Erro ao sair", description: "Houve um problema ao finalizar a sessão." });
      }
    } else {
      toast({ variant: "info", title: "Até logo! 😊", description: "Você saiu com sucesso." });
    }

    navigate('/login');
  }, [navigate, toast]);

  const handleSetProfessorSession = (isActive) => {
    setProfessorSession(isActive);
    if (isActive) {
      sessionStorage.setItem('professor-session', 'true');
    } else {
      sessionStorage.removeItem('professor-session');
    }
  };

  const handleSession = useCallback(async (currentSession) => {
    setSession(currentSession);
    let currentUser = currentSession?.user ?? null;
    setUser(currentUser);

    // FIX: Tentar atualizar a sessão se houver um token mas o objeto 'user' estiver ausente (erro 403: missing sub claim)
    if (currentSession && !currentUser) {
      console.log('Session exists but user is missing, trying to refresh token...');
      const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();
      if (!refreshError && refreshedSession) {
        currentUser = refreshedSession.user;
        setUser(currentUser);
        setSession(refreshedSession);
      } else {
        console.error('Failed to refresh session:', refreshError);
        // Se o refresh falhar, força o sign out para limpar tokens inválidos
        await supabase.auth.signOut();
      }
    }

    if (currentUser) {
      await fetchProfile(currentUser.id);
    } else {
      setProfile(null);
    }
    setLoading(false);
  }, [fetchProfile]);

  const createProfessorUser = useCallback(async () => {
    const professorEmail = 'tamayominael@gmail.com';
    const professorPassword = 'AlyRoberto2025*';

    const { data: { user: existingUser } } = await supabase.auth.getUser();
    if (existingUser?.email === professorEmail) {
      return;
    }

    // Check if professor already exists in profiles
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'professor')
      .maybeSingle();

    if (existingProfile) {
      console.log('Professor profile already exists');
      return;
    }

    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email: professorEmail,
      password: professorPassword,
      options: {
        data: {
          full_name: 'Professor Admin',
          username: 'admin.professor',
          role: 'professor'
        },
        emailRedirectTo: undefined
      }
    });

    if (signUpError) {
      if (signUpError.message.includes('User already registered') || signUpError.message.includes('already been registered')) {
        console.log('Professor user already exists in auth.');
      } else {
        console.error('Error during professor signup:', signUpError.message);
      }
    } else if (authData.user) {
      console.log('Professor user created successfully:', authData.user.email);
      await supabase.auth.signOut();
    }
  }, []);

  useEffect(() => {
    createProfessorUser();

    const getInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      handleSession(session);
    };

    getInitialSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        handleSession(session);
        if (_event === 'SIGNED_IN') {
          const userProfile = await fetchProfile(session.user.id);
          if (userProfile?.role === 'professor') {
            // Handled by ProfessorLoginPage
          } else {
            toast({
              variant: "info",
              title: "Login bem-sucedido! 😊",
              description: "Bem-vindo(a) de volta ao seu painel.",
            });
            navigate('/');
          }
        } else if (_event === 'SIGNED_OUT') {
          setProfessorSession(false);
          sessionStorage.removeItem('professor-session');
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [handleSession, fetchProfile, navigate, toast, createProfessorUser]);

  const signUp = useCallback(async (email, password, options) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        ...options,
        emailRedirectTo: undefined
      },
    });

    if (error) {
      toast({
        variant: "destructive",
        title: "Falha no Cadastro",
        description: error.message || "Algo deu errado",
      });
    }

    return { data, error };
  }, [toast]);

  const signIn = useCallback(async (email, password) => {
    const { error, data } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast({
        variant: "destructive",
        title: "Falha no Login",
        description: error.message || "E-mail ou senha inválidos.",
      });
      return { error };
    }

    return { error: null };
  }, [toast]);

  const sendPasswordResetLink = useCallback(async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/update-password`,
    });

    if (error) {
      toast({ variant: "destructive", title: "Falha ao redefinir", description: error.message });
    } else {
      toast({ variant: "info", title: "Verifique seu e-mail!", description: "Enviamos um link para redefinir sua senha." });
    }
    return { error };
  }, [toast]);

  const updateUserPassword = useCallback(async (password) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      toast({ variant: "destructive", title: "Erro ao atualizar senha", description: error.message });
    } else {
      toast({ variant: "info", title: "Senha atualizada!", description: "Sua senha foi alterada com sucesso." });
      navigate('/');
    }
    return { error };
  }, [toast, navigate]);

  const value = useMemo(() => ({
    user,
    session,
    profile,
    fetchProfile,
    loading,
    professorSession,
    setProfessorSession: handleSetProfessorSession,
    signUp,
    signIn,
    signOut,
    sendPasswordResetLink,
    updateUserPassword,
  }), [user, session, profile, fetchProfile, loading, professorSession, signUp, signIn, signOut, sendPasswordResetLink, updateUserPassword]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};