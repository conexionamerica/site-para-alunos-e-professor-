// Utilitários para manipulação e validação de CPF
// Arquivo: src/lib/cpfUtils.js

/**
 * Remove formatação do CPF (mantém apenas números)
 * @param {string} cpf - CPF formatado ou não
 * @returns {string} CPF apenas com números
 */
export const cleanCPF = (cpf) => {
  if (!cpf) return '';
  return cpf.replace(/\D/g, '');
};

/**
 * Formata CPF com máscara 000.000.000-00
 * @param {string} value - CPF sem formatação
 * @returns {string} CPF formatado
 */
export const formatCPF = (value) => {
  if (!value) return '';
  
  const cleaned = cleanCPF(value);
  
  // Limita a 11 dígitos
  const limited = cleaned.substring(0, 11);
  
  // Aplica a máscara progressivamente
  if (limited.length <= 3) {
    return limited;
  } else if (limited.length <= 6) {
    return `${limited.slice(0, 3)}.${limited.slice(3)}`;
  } else if (limited.length <= 9) {
    return `${limited.slice(0, 3)}.${limited.slice(3, 6)}.${limited.slice(6)}`;
  } else {
    return `${limited.slice(0, 3)}.${limited.slice(3, 6)}.${limited.slice(6, 9)}-${limited.slice(9)}`;
  }
};

/**
 * Valida CPF (formato e dígitos verificadores)
 * @param {string} cpf - CPF a ser validado
 * @returns {boolean} true se válido, false caso contrário
 */
export const validateCPF = (cpf) => {
  if (!cpf) return false;
  
  const cleaned = cleanCPF(cpf);
  
  // Verifica se tem 11 dígitos
  if (cleaned.length !== 11) return false;
  
  // Verifica se todos os dígitos são iguais (CPF inválido)
  if (/^(\d)\1{10}$/.test(cleaned)) return false;
  
  // Valida primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleaned.charAt(i)) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleaned.charAt(9))) return false;
  
  // Valida segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleaned.charAt(i)) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleaned.charAt(10))) return false;
  
  return true;
};

/**
 * Formata CPF parcialmente oculto para exibição (000.***.**-00)
 * @param {string} cpf - CPF a ser parcialmente oculto
 * @returns {string} CPF com parte oculta
 */
export const maskCPF = (cpf) => {
  if (!cpf) return '—';
  
  const cleaned = cleanCPF(cpf);
  
  if (cleaned.length !== 11) return cpf;
  
  return `${cleaned.slice(0, 3)}.***.**${cleaned.slice(9, 11)}`;
};
