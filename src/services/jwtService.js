const jwt = require('jsonwebtoken');
require('dotenv').config();

/**
 * Serviço para trabalhar com JWT
 */
const jwtService = {
    /**
     * Gera um token JWT para um usuário
     * @param {Object} usuario - Dados do usuário
     * @returns {String} Token JWT
     */
    gerarToken: (usuario) => {
        try {
            const payload = {
                id: usuario.id,
                email: usuario.email,
                login: usuario.login,
                nome: usuario.nome
            };

            return jwt.sign(
                payload,
                process.env.JWT_SECRET,
                {
                    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
                    issuer: 'agrolytix-api',
                    audience: 'agrolytix-frontend'
                }
            );
        } catch (error) {
            console.error('Erro ao gerar token JWT:', error.message);
            throw new Error('Erro interno do servidor');
        }
    },

    /**
     * Verifica e decodifica um token JWT
     * @param {String} token - Token JWT
     * @returns {Object|null} Payload decodificado ou null se inválido
     */
    verificarToken: (token) => {
        try {
            return jwt.verify(token, process.env.JWT_SECRET, {
                issuer: 'agrolytix-api',
                audience: 'agrolytix-frontend'
            });
        } catch (error) {
            if (error.name === 'TokenExpiredError') {
                console.log('Token expirado');
            } else if (error.name === 'JsonWebTokenError') {
                console.log('Token inválido');
            } else {
                console.error('Erro ao verificar token:', error.message);
            }
            return null;
        }
    },

    /**
     * Decodifica um token sem verificar a assinatura (para debug)
     * @param {String} token - Token JWT
     * @returns {Object|null} Payload decodificado
     */
    decodificarToken: (token) => {
        try {
            return jwt.decode(token);
        } catch (error) {
            console.error('Erro ao decodificar token:', error.message);
            return null;
        }
    },

    /**
     * Verifica se um token está próximo do vencimento
     * @param {String} token - Token JWT
     * @param {Number} tempoMinutos - Tempo em minutos para considerar próximo do vencimento
     * @returns {Boolean} True se próximo do vencimento
     */
    proximoVencimento: (token, tempoMinutos = 60) => {
        try {
            const decoded = jwt.decode(token);
            if (!decoded || !decoded.exp) return true;

            const agora = Math.floor(Date.now() / 1000);
            const tempoRestante = decoded.exp - agora;
            const tempoLimite = tempoMinutos * 60; // Converter para segundos

            return tempoRestante <= tempoLimite;
        } catch (error) {
            console.error('Erro ao verificar vencimento do token:', error.message);
            return true;
        }
    }
};

module.exports = jwtService;