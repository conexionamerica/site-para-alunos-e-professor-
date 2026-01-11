import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
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

  // Ref para el canal de presencia
  const presenceChannelRef = useRef(null);

  // Función para actualizar el estado online del usuario
  const updateOnlineStatus = useCallback(async (userId, isOnline) => {
    if (!userId) return;
    try {
      await supabase
        .from('profiles')
        .update({
          is_online: isOnline,
          last_seen_at: new Date().toISOString()
        })
        .eq('id', userId);
    } catch (error) {
      console.error('Error updating online status:', error);
    }
  }, []);

  // Configurar canal de presencia
  const setupPresenceChannel = useCallback((userId, userProfile) => {
    if (!userId || presenceChannelRef.current) return;

    const channel = supabase.channel('online-users', {
      config: {
        presence: {
          key: userId,
        },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        // Sync event - presencia actualizada
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('User joined:', key);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('User left:', key);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Anunciar presencia del usuario
          await channel.track({
            user_id: userId,
            full_name: userProfile?.full_name || 'Usuario',
            role: userProfile?.role || 'student',
            online_at: new Date().toISOString(),
          });
        }
      });

    presenceChannelRef.current = channel;
  }, []);

  // Limpiar canal de presencia
  const cleanupPresenceChannel = useCallback(() => {
    if (presenceChannelRef.current) {
      supabase.removeChannel(presenceChannelRef.current);
      presenceChannelRef.current = null;
    }
  }, []);

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
    const userId = user?.id;

    // Marcar usuario como offline antes de cerrar sesión
    if (userId) {
      await updateOnlineStatus(userId, false);
    }

    // Limpiar canal de presencia
    cleanupPresenceChannel();

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
  }, [navigate, toast, user?.id, updateOnlineStatus, cleanupPresenceChannel]);

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

  // A função createProfessorUser foi removida deste arquivo.

  useEffect(() => {
    // createProfessorUser(); // Esta chamada foi removida.

    const getInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      handleSession(session);
    };

    getInitialSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        handleSession(session);
        if (_event === 'SIGNED_IN' && session?.user?.id) {
          const userProfile = await fetchProfile(session.user.id);

          // Verificar si el usuario está inactivo
          if (userProfile?.is_active === false) {
            await supabase.auth.signOut();
            toast({
              variant: "destructive",
              title: "Conta Inativa",
              description: "Sua conta foi inativada. Para mais informações, entre em contato com o suporte.",
              duration: 8000,
            });
            setLoading(false);
            return;
          }

          // Marcar usuario como online
          await updateOnlineStatus(session.user.id, true);

          // Configurar canal de presencia
          setupPresenceChannel(session.user.id, userProfile);

          if (userProfile?.role === 'professor' || userProfile?.role === 'superadmin' || userProfile?.role === 'admin') {
            // Handled by ProfessorLoginPage or by staying on current route if already in dashboard
          } else {
            // Only redirect to / if we are on the login page
            if (window.location.pathname === '/login') {
              toast({
                variant: "info",
                title: "Login bem-sucedido! 😊",
                description: "Bem-vindo(a) de volta ao seu painel.",
              });
              navigate('/');
            }
          }
        } else if (_event === 'SIGNED_OUT') {
          cleanupPresenceChannel();
          setProfessorSession(false);
          sessionStorage.removeItem('professor-session');
        }
      }
    );

    // Limpiar al desmontar
    return () => {
      subscription.unsubscribe();
      cleanupPresenceChannel();
    };
  }, [handleSession, fetchProfile, navigate, toast, updateOnlineStatus, setupPresenceChannel, cleanupPresenceChannel]);

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
