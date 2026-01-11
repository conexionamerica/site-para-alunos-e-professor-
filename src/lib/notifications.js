// Sistema de notificaciones con sonido y push del navegador

// URL del sonido de notificación (usando un sonido público)
const NOTIFICATION_SOUND_URL = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';

// Crear elemento de audio para reproducir sonidos
let notificationAudio = null;

const getAudioElement = () => {
    if (!notificationAudio) {
        notificationAudio = new Audio(NOTIFICATION_SOUND_URL);
        notificationAudio.volume = 0.5;
    }
    return notificationAudio;
};

/**
 * Reproduce un sonido de notificación
 */
export const playNotificationSound = () => {
    try {
        const audio = getAudioElement();
        audio.currentTime = 0;
        audio.play().catch(e => {
            console.log('No se pudo reproducir sonido (requiere interacción del usuario):', e.message);
        });
    } catch (error) {
        console.log('Error reproduciendo sonido:', error);
    }
};

/**
 * Solicita permiso para notificaciones del navegador
 * @returns {Promise<boolean>} - true si el permiso fue concedido
 */
export const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
        console.log('Este navegador no soporta notificaciones');
        return false;
    }

    if (Notification.permission === 'granted') {
        return true;
    }

    if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
    }

    return false;
};

/**
 * Muestra una notificación del navegador
 * @param {string} title - Título de la notificación
 * @param {object} options - Opciones de la notificación
 */
export const showBrowserNotification = async (title, options = {}) => {
    // Solo mostrar si estamos en segundo plano o pestaña no activa
    if (document.visibilityState === 'visible' && document.hasFocus()) {
        // Si la pestaña está activa, solo reproducir sonido
        playNotificationSound();
        return null;
    }

    const hasPermission = await requestNotificationPermission();

    if (!hasPermission) {
        // Si no hay permiso, al menos reproducir sonido
        playNotificationSound();
        return null;
    }

    // Reproducir sonido
    playNotificationSound();

    // Mostrar notificación del navegador
    const notification = new Notification(title, {
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: options.tag || 'conexion-america',
        renotify: true,
        ...options
    });

    // Auto-cerrar después de 5 segundos
    setTimeout(() => notification.close(), 5000);

    // Al hacer clic, enfocar la pestaña
    notification.onclick = () => {
        window.focus();
        notification.close();
        if (options.onClick) {
            options.onClick();
        }
    };

    return notification;
};

/**
 * Notificación de nuevo ticket
 * @param {string} ticketNumber - Número del ticket
 * @param {string} requesterName - Nombre del solicitante
 */
export const notifyNewTicket = async (ticketNumber, requesterName = 'Novo solicitante') => {
    return showBrowserNotification('🎫 Novo Ticket!', {
        body: `Ticket ${ticketNumber} criado por ${requesterName}`,
        tag: `ticket-${ticketNumber}`,
        requireInteraction: true
    });
};

/**
 * Notificación de mensaje en ticket
 * @param {string} ticketNumber - Número del ticket
 * @param {string} senderName - Nombre del remitente
 */
export const notifyTicketMessage = async (ticketNumber, senderName = 'Alguém') => {
    return showBrowserNotification('💬 Nova Mensagem!', {
        body: `${senderName} respondeu no ticket ${ticketNumber}`,
        tag: `message-${ticketNumber}`
    });
};

/**
 * Notificación de actualización de status
 * @param {string} ticketNumber - Número del ticket
 * @param {string} newStatus - Nuevo status
 */
export const notifyTicketStatusChange = async (ticketNumber, newStatus) => {
    return showBrowserNotification('🔔 Ticket Atualizado', {
        body: `Ticket ${ticketNumber} está agora: ${newStatus}`,
        tag: `status-${ticketNumber}`
    });
};

// Intentar pre-cargar el audio cuando el usuario interactúa con la página
if (typeof window !== 'undefined') {
    const preloadAudio = () => {
        getAudioElement();
        document.removeEventListener('click', preloadAudio);
        document.removeEventListener('keydown', preloadAudio);
    };

    document.addEventListener('click', preloadAudio, { once: true });
    document.addEventListener('keydown', preloadAudio, { once: true });
}
