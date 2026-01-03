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
 * Formata telefone (formato livre - internacional)
 * @param {string} value - Telefone
 * @returns {string} Telefone sem formatação específica
 */
export const formatPhone = (value) => {
    if (!value) return '';
    // Retorna como está - formato livre para telefones internacionais
    return value;
};

/**
 * Valida formato de telefone (aceita qualquer formato com números)
 * @param {string} phone - Telefone a ser validado
 * @returns {boolean} true se tiver pelo menos 8 dígitos
 */
export const validatePhone = (phone) => {
    if (!phone) return false;

    const cleaned = cleanPhone(phone);

    // Telefone válido: pelo menos 8 dígitos (internacional)
    return cleaned.length >= 8;
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
