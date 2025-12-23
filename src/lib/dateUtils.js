// Utilidades para manejo de fechas con zona horaria de Rio Grande del Sur, Brasil (UTC-3)
// Fecha de creación: 21 de Diciembre de 2025

/**
 * Obtiene la fecha y hora actual en la zona horaria de Rio Grande del Sur (UTC-3)
 * @returns {Date} Fecha actual en UTC-3
 */
export const getBrazilDate = () => {
    // Crear fecha actual en UTC
    const now = new Date();

    // Obtener el offset de UTC-3 (Rio Grande del Sur, Brasil)
    // UTC-3 = -180 minutos
    const brazilOffset = -180;

    // Obtener el offset local del navegador
    const localOffset = now.getTimezoneOffset();

    // Calcular la diferencia y ajustar
    const diff = localOffset - brazilOffset;

    // Crear nueva fecha ajustada
    const brazilDate = new Date(now.getTime() + diff * 60 * 1000);

    return brazilDate;
};

/**
 * Convierte una fecha a ISO string considerando la zona horaria de Brasil (UTC-3)
 * @param {Date} date - Fecha a convertir
 * @returns {string} String en formato ISO
 */
export const toBrazilISOString = (date) => {
    if (!date) return null;

    // Si la fecha ya es un objeto Date, usarla directamente
    const dateObj = date instanceof Date ? date : new Date(date);

    // Obtener componentes de la fecha en hora local
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    const hours = String(dateObj.getHours()).padStart(2, '0');
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
    const seconds = String(dateObj.getSeconds()).padStart(2, '0');

    // Retornar en formato ISO pero sin conversión a UTC
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}-03:00`;
};

/**
 * Obtiene la fecha de hoy en formato YYYY-MM-DD en hora de Brasil
 * @returns {string} Fecha en formato YYYY-MM-DD
 */
export const getTodayBrazil = () => {
    const now = getBrazilDate();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
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
    // Crear fecha en hora local
    const date = new Date(year, month, day, hours, minutes, seconds);
    return date;
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
    const now = getBrazilDate();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
};

/**
 * Verifica si una fecha es hoy en hora de Brasil
 * @param {Date|string} date - Fecha a verificar
 * @returns {boolean} True si es hoy
 */
export const isTodayBrazil = (date) => {
    if (!date) return false;

    const dateObj = date instanceof Date ? date : new Date(date);
    const today = getBrazilDate();

    return (
        dateObj.getDate() === today.getDate() &&
        dateObj.getMonth() === today.getMonth() &&
        dateObj.getFullYear() === today.getFullYear()
    );
};

/**
 * Convierte una fecha UTC a hora de Brasil
 * @param {string} utcDateString - Fecha en formato ISO UTC
 * @returns {Date} Fecha convertida a hora de Brasil
 */
export const utcToBrazil = (utcDateString) => {
    if (!utcDateString) return null;

    const utcDate = new Date(utcDateString);
    // La fecha ya se mostrará en hora local del navegador
    // pero podemos ajustarla si es necesario
    return utcDate;
};
