const jwtService = require('../services/jwtService');

/**
 * Middleware para verificar autenticação via JWT
 */
const autenticacao = (req, res, next) => {
    try {
        // Obter token do header Authorization
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                sucesso: false,
                mensagem: 'Acesso negado. Token não fornecido ou formato inválido.'
            });
        }

        // Extrair token do header
        const token = authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({
                sucesso: false,
                mensagem: 'Acesso negado. Token não fornecido.'
            });
        }

        // Verificar token
        const decoded = jwtService.verificarToken(token);

        if (!decoded) {
            return res.status(403).json({
                sucesso: false,
                mensagem: 'Token inválido ou expirado.'
            });
        }

        // Adicionar dados do usuário à requisição
        req.usuario = {
            id: decoded.id,
            email: decoded.email,
            login: decoded.login,
            nome: decoded.nome
        };

        // Verificar se o token está próximo do vencimento
        if (jwtService.proximoVencimento(token, 60)) {
            // Adicionar header indicando que o token precisa ser renovado
            res.set('X-Token-Renovacao-Necessaria', 'true');
        }

        // Prosseguir para o próximo middleware/controlador
        next();
    } catch (error) {
        console.error('Erro no middleware de autenticação:', error.message);
        return res.status(500).json({
            sucesso: false,
            mensagem: 'Erro interno do servidor durante autenticação.'
        });
    }
};

/**
 * Middleware opcional para autenticação (não bloqueia se não autenticado)
 */
const autenticacaoOpcional = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            const decoded = jwtService.verificarToken(token);

            if (decoded) {
                req.usuario = {
                    id: decoded.id,
                    email: decoded.email,
                    login: decoded.login,
                    nome: decoded.nome
                };
            }
        }

        next();
    } catch (error) {
        console.error('Erro no middleware de autenticação opcional:', error.message);
        next(); // Continua mesmo com erro
    }
};

module.exports = {
    autenticacao,
    autenticacaoOpcional
};