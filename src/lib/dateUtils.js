// Utilidades para manejo de fechas con zona horaria de Rio Grande del Sur, Brasil (UTC-3)
// Fecha de creación: 21 de Diciembre de 2025
// ATUALIZADO: 29 de Diciembre de 2025 - Usando Intl.DateTimeFormat para precisão de timezone

const BRAZIL_TIMEZONE = 'America/Sao_Paulo';

/**
 * Obtiene los componentes de fecha/hora actuales en el timezone de Brasil
 * Esto funciona independientemente del timezone del dispositivo del usuario
 * @returns {Object} Componentes de fecha { year, month, day, hours, minutes, seconds, dayOfWeek }
 */
export const getBrazilDateComponents = () => {
    const now = new Date();

    // Usar Intl.DateTimeFormat para obtener la fecha/hora en Brasil
    const formatter = new Intl.DateTimeFormat('pt-BR', {
        timeZone: BRAZIL_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        weekday: 'short',
        hour12: false
    });

    const parts = formatter.formatToParts(now);
    const getPartValue = (type) => parts.find(p => p.type === type)?.value || '';

    const year = parseInt(getPartValue('year'), 10);
    const month = parseInt(getPartValue('month'), 10) - 1; // 0-indexed
    const day = parseInt(getPartValue('day'), 10);
    const hours = parseInt(getPartValue('hour'), 10);
    const minutes = parseInt(getPartValue('minute'), 10);
    const seconds = parseInt(getPartValue('second'), 10);

    // Calcular dia da semana baseado na data do Brasil
    // Criamos uma data local com os componentes do Brasil
    const weekdayStr = getPartValue('weekday').toLowerCase();
    const weekdayMap = {
        'dom': 0, 'dom.': 0,
        'seg': 1, 'seg.': 1,
        'ter': 2, 'ter.': 2,
        'qua': 3, 'qua.': 3,
        'qui': 4, 'qui.': 4,
        'sex': 5, 'sex.': 5,
        'sáb': 6, 'sáb.': 6, 'sab': 6, 'sab.': 6
    };
    const dayOfWeek = weekdayMap[weekdayStr] ?? new Date(year, month, day).getDay();

    return { year, month, day, hours, minutes, seconds, dayOfWeek };
};

/**
 * Obtiene la fecha y hora actual en la zona horaria de Brasil
 * Retorna un objeto Date que representa la hora actual en Brasil
 * @returns {Date} Fecha actual representando la hora de Brasil
 */
export const getBrazilDate = () => {
    const { year, month, day, hours, minutes, seconds } = getBrazilDateComponents();
    return new Date(year, month, day, hours, minutes, seconds);
};

/**
 * Obtiene la fecha de hoy en formato YYYY-MM-DD en hora de Brasil
 * Esta es la función más confiable para comparaciones de "hoje"
 * @returns {string} Fecha en formato YYYY-MM-DD
 */
export const getTodayBrazil = () => {
    const { year, month, day } = getBrazilDateComponents();
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

/**
 * Obtiene el día de la semana actual en Brasil (0=Domingo, 6=Sábado)
 * @returns {number} Día de la semana (0-6)
 */
export const getBrazilDayOfWeek = () => {
    return getBrazilDateComponents().dayOfWeek;
};

/**
 * Verifica si una fecha (string YYYY-MM-DD o Date) es hoy en hora de Brasil
 * @param {Date|string} date - Fecha a verificar
 * @returns {boolean} True si es hoy en Brasil
 */
export const isTodayBrazil = (date) => {
    if (!date) return false;

    const todayStr = getTodayBrazil();

    if (typeof date === 'string') {
        // Si es string, comparar directamente
        return date.substring(0, 10) === todayStr;
    }

    // Si es Date, formatear y comparar
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return dateStr === todayStr;
};

/**
 * Convierte una fecha a ISO string considerando la zona horaria de Brasil (UTC-3)
 * @param {Date} date - Fecha a convertir
 * @returns {string} String en formato ISO
 */
export const toBrazilISOString = (date) => {
    if (!date) return null;

    const dateObj = date instanceof Date ? date : new Date(date);

    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    const hours = String(dateObj.getHours()).padStart(2, '0');
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
    const seconds = String(dateObj.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}-03:00`;
};

/**
 * Crea una fecha a partir de un string YYYY-MM-DD
 * @param {string} dateStr - String de fecha
 * @returns {Date} Objeto Date
 */
export const createDateFromString = (dateStr) => {
    if (!dateStr) return null;
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
};

/**
 * Crea una fecha y hora específica en la zona horaria de Brasil
 * @param {number} year - Año
 * @param {number} month - Mes (0-11)
 * @param {number} day - Día
 * @param {number} hours - Horas (0-23)
 * @param {number} minutes - Minutos (0-59)
 * @param {number} seconds - Segundos (0-59)
 * @returns {Date} Fecha creada
 */
export const createBrazilDate = (year, month, day, hours = 0, minutes = 0, seconds = 0) => {
    return new Date(year, month, day, hours, minutes, seconds);
};

/**
 * Formatea una fecha para mostrar en la interfaz con hora de Brasil
 * @param {Date|string} date - Fecha a formatear
 * @param {string} format - Formato deseado ('date', 'time', 'datetime')
 * @returns {string} Fecha formateada
 */
export const formatBrazilDate = (date, format = 'datetime') => {
    if (!date) return 'N/A';

    const dateObj = date instanceof Date ? date : new Date(date);

    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = dateObj.getFullYear();
    const hours = String(dateObj.getHours()).padStart(2, '0');
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');

    switch (format) {
        case 'date':
            return `${day}/${month}/${year}`;
        case 'time':
            return `${hours}:${minutes}`;
        case 'datetime':
            return `${day}/${month}/${year} ${hours}:${minutes}`;
        default:
            return `${day}/${month}/${year} ${hours}:${minutes}`;
    }
};

/**
 * Obtiene la hora actual en formato HH:mm en hora de Brasil
 * @returns {string} Hora actual en formato HH:mm
 */
export const getCurrentBrazilTime = () => {
    const { hours, minutes } = getBrazilDateComponents();
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

/**
 * Calcula el inicio de la semana (Domingo) basado en la fecha actual de Brasil
 * @returns {Date} Fecha del domingo de esta semana
 */
export const getBrazilWeekStart = () => {
    const { year, month, day, dayOfWeek } = getBrazilDateComponents();
    // Retroceder al domingo
    const sundayDay = day - dayOfWeek;
    return new Date(year, month, sundayDay);
};

/**
 * Convierte una fecha UTC a hora de Brasil
 * @param {string} utcDateString - Fecha en formato ISO UTC
 * @returns {Date} Fecha convertida a hora de Brasil
 */
export const utcToBrazil = (utcDateString) => {
    if (!utcDateString) return null;
    const utcDate = new Date(utcDateString);
    return utcDate;
};
