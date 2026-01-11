// Hook para detectar inactividad del usuario y cerrar sesión automáticamente
// Archivo: src/hooks/useIdleTimeout.js

import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';

const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutos en milisegundos
const WARNING_BEFORE_LOGOUT_MS = 60 * 1000; // Mostrar aviso 1 minuto antes

export const useIdleTimeout = (enabled = true) => {
    const { user, signOut } = useAuth();
    const { toast } = useToast();
    const timeoutRef = useRef(null);
    const warningTimeoutRef = useRef(null);
    const lastActivityRef = useRef(Date.now());
    const warningShownRef = useRef(false);

    // Función para cerrar sesión por inactividad
    const handleIdleLogout = useCallback(async () => {
        if (!user) return;

        toast({
            variant: "destructive",
            title: "Sessão Encerrada",
            description: "Sua sessão foi encerrada por inatividade de 15 minutos.",
            duration: 8000,
        });

        await signOut();
    }, [user, signOut, toast]);

    // Función para mostrar aviso de que la sesión está por expirar
    const showWarning = useCallback(() => {
        if (warningShownRef.current) return;
        warningShownRef.current = true;

        toast({
            variant: "default",
            title: "⏱️ Sessão expirando",
            description: "Sua sessão será encerrada em 1 minuto por inatividade. Mova o mouse ou pressione uma tecla para continuar.",
            duration: 55000, // Mostrar por 55 segundos
        });
    }, [toast]);

    // Función para reiniciar el timer de inactividad
    const resetIdleTimer = useCallback(() => {
        lastActivityRef.current = Date.now();
        warningShownRef.current = false;

        // Limpiar timers existentes
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        if (warningTimeoutRef.current) {
            clearTimeout(warningTimeoutRef.current);
        }

        if (!enabled || !user) return;

        // Timer para mostrar aviso (14 minutos)
        warningTimeoutRef.current = setTimeout(() => {
            showWarning();
        }, IDLE_TIMEOUT_MS - WARNING_BEFORE_LOGOUT_MS);

        // Timer para cerrar sesión (15 minutos)
        timeoutRef.current = setTimeout(() => {
            handleIdleLogout();
        }, IDLE_TIMEOUT_MS);
    }, [enabled, user, handleIdleLogout, showWarning]);

    // Configurar event listeners para detectar actividad
    useEffect(() => {
        if (!enabled || !user) return;

        // Eventos que indican actividad del usuario
        const activityEvents = [
            'mousedown',
            'mousemove',
            'keypress',
            'keydown',
            'scroll',
            'touchstart',
            'click',
            'wheel'
        ];

        // Throttle para evitar demasiadas llamadas
        let lastEventTime = 0;
        const throttleMs = 1000; // Solo procesar eventos cada 1 segundo

        const handleActivity = () => {
            const now = Date.now();
            if (now - lastEventTime > throttleMs) {
                lastEventTime = now;
                resetIdleTimer();
            }
        };

        // Agregar listeners
        activityEvents.forEach(event => {
            document.addEventListener(event, handleActivity, { passive: true });
        });

        // Iniciar el timer
        resetIdleTimer();

        // Cleanup
        return () => {
            activityEvents.forEach(event => {
                document.removeEventListener(event, handleActivity);
            });

            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
            if (warningTimeoutRef.current) {
                clearTimeout(warningTimeoutRef.current);
            }
        };
    }, [enabled, user, resetIdleTimer]);

    // Retornar información útil
    return {
        resetIdleTimer,
        lastActivity: lastActivityRef.current,
    };
};

export default useIdleTimeout;
