/**
 * Utilitários para validações comuns
 */
const validacoes = {
    /**
     * Valida formato de email
     * @param {string} email - Email a ser validado
     * @returns {boolean} True se válido
     */
    validarEmail: (email) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    },

    /**
     * Valida CNPJ (formato brasileiro)
     * @param {string} cnpj - CNPJ a ser validado
     * @returns {boolean} True se válido
     */
    validarCNPJ: (cnpj) => {
        if (!cnpj) return false;

        // Remove caracteres não numéricos
        cnpj = cnpj.replace(/[^\d]/g, '');

        // Verifica se tem 14 dígitos
        if (cnpj.length !== 14) return false;

        // Verifica se todos os dígitos são iguais
        if (/^(\d)\1+$/.test(cnpj)) return false;

        // Validação do algoritmo do CNPJ
        let tamanho = cnpj.length - 2;
        let numeros = cnpj.substring(0, tamanho);
        let digitos = cnpj.substring(tamanho);
        let soma = 0;
        let pos = tamanho - 7;

        for (let i = tamanho; i >= 1; i--) {
            soma += numeros.charAt(tamanho - i) * pos--;
            if (pos < 2) pos = 9;
        }

        let resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
        if (resultado != digitos.charAt(0)) return false;

        tamanho = tamanho + 1;
        numeros = cnpj.substring(0, tamanho);
        soma = 0;
        pos = tamanho - 7;

        for (let i = tamanho; i >= 1; i--) {
            soma += numeros.charAt(tamanho - i) * pos--;
            if (pos < 2) pos = 9;
        }

        resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
        return resultado == digitos.charAt(1);
    },

    /**
     * Valida CPF (formato brasileiro)
     * @param {string} cpf - CPF a ser validado
     * @returns {boolean} True se válido
     */
    validarCPF: (cpf) => {
        if (!cpf) return false;

        // Remove caracteres não numéricos
        cpf = cpf.replace(/[^\d]/g, '');

        // Verifica se tem 11 dígitos
        if (cpf.length !== 11) return false;

        // Verifica se todos os dígitos são iguais
        if (/^(\d)\1+$/.test(cpf)) return false;

        // Validação do algoritmo do CPF
        let soma = 0;
        for (let i = 0; i < 9; i++) {
            soma += parseInt(cpf.charAt(i)) * (10 - i);
        }

        let resto = 11 - (soma % 11);
        if (resto === 10 || resto === 11) resto = 0;
        if (resto !== parseInt(cpf.charAt(9))) return false;

        soma = 0;
        for (let i = 0; i < 10; i++) {
            soma += parseInt(cpf.charAt(i)) * (11 - i);
        }

        resto = 11 - (soma % 11);
        if (resto === 10 || resto === 11) resto = 0;

        return resto === parseInt(cpf.charAt(10));
    },

    /**
     * Valida força da senha
     * @param {string} senha - Senha a ser validada
     * @returns {object} Objeto com resultado e mensagens
     */
    validarSenha: (senha) => {
        const resultado = {
            valida: false,
            mensagens: []
        };

        if (!senha) {
            resultado.mensagens.push('Senha é obrigatória');
            return resultado;
        }

        if (senha.length < 6) {
            resultado.mensagens.push('Senha deve ter pelo menos 6 caracteres');
        }

        if (senha.length > 128) {
            resultado.mensagens.push('Senha deve ter no máximo 128 caracteres');
        }

        // Verificar se tem pelo menos uma letra
        if (!/[a-zA-Z]/.test(senha)) {
            resultado.mensagens.push('Senha deve conter pelo menos uma letra');
        }

        // Verificar se tem pelo menos um número
        if (!/\d/.test(senha)) {
            resultado.mensagens.push('Senha deve conter pelo menos um número');
        }

        resultado.valida = resultado.mensagens.length === 0;
        return resultado;
    },

    /**
     * Valida formato de telefone brasileiro
     * @param {string} telefone - Telefone a ser validado
     * @returns {boolean} True se válido
     */
    validarTelefone: (telefone) => {
        if (!telefone) return true; // Campo opcional

        // Remove caracteres não numéricos
        const numeroLimpo = telefone.replace(/[^\d]/g, '');

        // Verifica se tem 10 ou 11 dígitos (telefone fixo ou celular)
        return numeroLimpo.length >= 10 && numeroLimpo.length <= 11;
    },

    /**
     * Valida se um valor é um número positivo
     * @param {any} valor - Valor a ser validado
     * @returns {boolean} True se válido
     */
    validarNumeroPositivo: (valor) => {
        const numero = parseFloat(valor);
        return !isNaN(numero) && numero > 0;
    },

    /**
     * Valida formato de data (YYYY-MM-DD)
     * @param {string} data - Data a ser validada
     * @returns {boolean} True se válido
     */
    validarData: (data) => {
        if (!data) return false;

        const dataObj = new Date(data);
        return dataObj instanceof Date && !isNaN(dataObj.getTime());
    },

    /**
     * Valida se uma string não está vazia após trim
     * @param {string} texto - Texto a ser validado
     * @returns {boolean} True se válido
     */
    validarTextoNaoVazio: (texto) => {
        return texto && typeof texto === 'string' && texto.trim().length > 0;
    },

    /**
     * Sanitiza string removendo caracteres especiais para evitar SQL injection
     * @param {string} texto - Texto a ser sanitizado
     * @returns {string} Texto sanitizado
     */
    sanitizarTexto: (texto) => {
        if (!texto || typeof texto !== 'string') return '';

        return texto
            .trim()
            .replace(/[<>\"']/g, '') // Remove caracteres perigosos
            .substring(0, 1000); // Limita tamanho
    },

    /**
     * Formata CNPJ para exibição
     * @param {string} cnpj - CNPJ a ser formatado
     * @returns {string} CNPJ formatado
     */
    formatarCNPJ: (cnpj) => {
        if (!cnpj) return '';

        const numeroLimpo = cnpj.replace(/[^\d]/g, '');

        if (numeroLimpo.length !== 14) return cnpj;

        return numeroLimpo.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    },

    /**
     * Formata telefone para exibição
     * @param {string} telefone - Telefone a ser formatado
     * @returns {string} Telefone formatado
     */
    formatarTelefone: (telefone) => {
        if (!telefone) return '';

        const numeroLimpo = telefone.replace(/[^\d]/g, '');

        if (numeroLimpo.length === 10) {
            return numeroLimpo.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
        } else if (numeroLimpo.length === 11) {
            return numeroLimpo.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
        }

        return telefone;
    },

    /**
     * Valida parâmetros obrigatórios
     * @param {object} dados - Objeto com os dados
     * @param {array} camposObrigatorios - Array com nomes dos campos obrigatórios
     * @returns {object} Resultado da validação
     */
    validarCamposObrigatorios: (dados, camposObrigatorios) => {
        const resultado = {
            valido: true,
            camposFaltando: []
        };

        for (const campo of camposObrigatorios) {
            if (!dados[campo] || (typeof dados[campo] === 'string' && dados[campo].trim().length === 0)) {
                resultado.valido = false;
                resultado.camposFaltando.push(campo);
            }
        }

        return resultado;
    },

    /**
     * Valida limite de caracteres
     * @param {string} texto - Texto a ser validado
     * @param {number} limite - Limite máximo de caracteres
     * @returns {boolean} True se dentro do limite
     */
    validarLimiteCaracteres: (texto, limite) => {
        if (!texto) return true;
        return texto.length <= limite;
    }
};

module.exports = validacoes;