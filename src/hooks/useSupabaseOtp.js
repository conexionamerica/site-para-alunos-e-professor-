import { useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';

export const useSupabaseOtp = () => {
  const { toast } = useToast();

  const sendEmailOtp = useCallback(async (email) => {
    // This function will now be used for both signup verification and password recovery.
    // Supabase will send a 6-digit code because the template is configured to do so.
    const { error } = await supabase.auth.signInWithOtp({ email });
    
    if (error) {
        toast({
            variant: 'destructive',
            title: "Falha ao enviar código",
            description: error.message,
        });
        return { error };
    }

    toast({
        title: "Código enviado!",
        description: "Verifique seu e-mail para o código de 6 dígitos.",
    });
    return { error: null };
  }, [toast]);

  const verifyEmailOtp = useCallback(async (email, token, type) => {
    // The 'type' for OTP verification via email is now simply 'email'.
    // Supabase handles if it's for signup confirmation or for a sign-in (which we use for recovery).
    const otpType = 'email';
    
    const { data: { session }, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: otpType,
    });

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Verificação falhou',
        description: error.message || 'Código inválido ou expirado.',
      });
    } else {
        toast({
            title: "Verificação bem-sucedida!",
        });
    }

    return { session, error };
  }, [toast]);

  return { sendEmailOtp, verifyEmailOtp };
};