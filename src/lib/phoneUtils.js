// Utilitários para manipulação e formatação de telefone
// Arquivo: src/lib/phoneUtils.js

/**
 * Remove formatação do telefone (mantém apenas números)
 * @param {string} phone - Telefone formatado ou não
 * @returns {string} Telefone apenas com números
 */
export const cleanPhone = (phone) => {
    if (!phone) return '';
    return phone.replace(/\D/g, '');
};

/**
 * Formata telefone com máscara (00) 00000-0000 ou (00) 0000-0000
 * @param {string} value - Telefone sem formatação
 * @returns {string} Telefone formatado
 */
export const formatPhone = (value) => {
    if (!value) return '';

    const cleaned = cleanPhone(value);

    // Limita a 11 dígitos (celular com 9 dígitos) ou 10 (fixo com 8 dígitos)
    const limited = cleaned.substring(0, 11);

    // Aplica a máscara progressivamente
    if (limited.length <= 2) {
        return limited;
    } else if (limited.length <= 3) {
        return `(${limited.slice(0, 2)}) ${limited.slice(2)}`;
    } else if (limited.length <= 7) {
        return `(${limited.slice(0, 2)}) ${limited.slice(2)}`;
    } else if (limited.length <= 10) {
        // Telefone fixo (00) 0000-0000
        return `(${limited.slice(0, 2)}) ${limited.slice(2, 6)}-${limited.slice(6)}`;
    } else {
        // Celular (00) 00000-0000
        return `(${limited.slice(0, 2)}) ${limited.slice(2, 7)}-${limited.slice(7)}`;
    }
};

/**
 * Valida formato de telefone brasileiro
 * @param {string} phone - Telefone a ser validado
 * @returns {boolean} true se válido (10 ou 11 dígitos), false caso contrário
 */
export const validatePhone = (phone) => {
    if (!phone) return false;

    const cleaned = cleanPhone(phone);

    // Telefone brasileiro tem 10 dígitos (fixo) ou 11 dígitos (celular)
    return cleaned.length === 10 || cleaned.length === 11;
};

/**
 * Formata CEP com máscara 00000-000
 * @param {string} value - CEP sem formatação
 * @returns {string} CEP formatado
 */
export const formatCEP = (value) => {
    if (!value) return '';

    const cleaned = value.replace(/\D/g, '');
    const limited = cleaned.substring(0, 8);

    if (limited.length <= 5) {
        return limited;
    } else {
        return `${limited.slice(0, 5)}-${limited.slice(5)}`;
    }
};

/**
 * Remove formatação do CEP
 * @param {string} cep - CEP formatado
 * @returns {string} CEP apenas com números
 */
export const cleanCEP = (cep) => {
    if (!cep) return '';
    return cep.replace(/\D/g, '');
};
