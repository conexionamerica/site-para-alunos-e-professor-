import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSupabaseOtp } from '@/hooks/useSupabaseOtp';
import { useToast } from '@/components/ui/use-toast';

const VerifyOtpPage = () => {
    const [otp, setOtp] = useState('');
    const [loading, setLoading] = useState(false);
    const { verifyEmailOtp, sendEmailOtp } = useSupabaseOtp();
    const navigate = useNavigate();
    const location = useLocation();
    const { toast } = useToast();

    const { email, type } = location.state || {};

    useEffect(() => {
        if (!email || !type) {
            toast({
                variant: 'destructive',
                title: 'Erro',
                description: 'Informações de verificação ausentes. Por favor, tente novamente.',
            });
            navigate('/register');
        }
    }, [email, type, navigate, toast]);

    const handleVerify = async (e) => {
        e.preventDefault();
        setLoading(true);

        const { session, error } = await verifyEmailOtp(email, otp, type);
        
        if (!error && session) {
            if (type === 'recovery') {
                // After successful OTP for recovery, user is logged in.
                // Navigate them to the page to update their password.
                navigate('/update-password');
            } else {
                // For signup, successful verification means they can go to the homepage.
                navigate('/');
            }
        }
        setLoading(false);
    };

    const handleResendOtp = async () => {
        await sendEmailOtp(email, type);
    };

    return (
        <motion.div
            className="flex items-center justify-center min-h-[80vh]"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
        >
            <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-2xl shadow-lg">
                <div className="text-center">
                    <h1 className="text-3xl font-bold text-slate-800">Verifique seu Código</h1>
                    <p className="text-slate-500">
                        Enviamos um código de 6 dígitos para <span className="font-semibold text-slate-700">{email}</span>.
                    </p>
                </div>
                <form onSubmit={handleVerify} className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="otp">Código de Verificação</Label>
                        <Input
                            id="otp"
                            type="text"
                            placeholder="123456"
                            maxLength="6"
                            value={otp}
                            onChange={(e) => setOtp(e.target.value)}
                            required
                            className="text-center text-2xl tracking-[1em]"
                        />
                    </div>
                    <Button type="submit" className="w-full bg-sky-600 hover:bg-sky-700" disabled={loading}>
                        {loading ? 'Verificando...' : 'Verificar'}
                    </Button>
                </form>
                <div className="text-sm text-center">
                    <p className="text-slate-500">Não recebeu o código?</p>
                    <Button variant="link" onClick={handleResendOtp} className="text-sky-600">
                        Reenviar código
                    </Button>
                </div>
            </div>
        </motion.div>
    );
};

export default VerifyOtpPage;