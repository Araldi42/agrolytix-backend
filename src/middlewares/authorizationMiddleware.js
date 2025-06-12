/**
 * Middleware de Autorização Avançado
 * Controla permissões baseado em perfis e hierarquia de usuários
 */

const { query } = require('../config/database');
const jwtService = require('../services/jwtService');

/**
 * Middleware base de autenticação (expandido)
 */
const autenticacao = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                sucesso: false,
                mensagem: 'Token de acesso necessário'
            });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwtService.verificarToken(token);

        if (!decoded) {
            return res.status(401).json({
                sucesso: false,
                mensagem: 'Token inválido ou expirado'
            });
        }

        // Buscar dados completos do usuário com perfil
        const consulta = `
            SELECT 
                u.id, u.nome, u.login, u.email, u.empresa_id, u.perfil_id,
                p.nome as perfil_nome, p.nivel_hierarquia, p.permissoes,
                e.id as empresa_existe
            FROM usuarios u
            INNER JOIN perfis_usuario p ON u.perfil_id = p.id
            LEFT JOIN empresas e ON u.empresa_id = e.id
            WHERE u.id = $1 AND u.ativo = true AND p.ativo = true
        `;

        const resultado = await query(consulta, [decoded.id]);

        if (resultado.rows.length === 0) {
            return res.status(401).json({
                sucesso: false,
                mensagem: 'Usuário não encontrado ou inativo'
            });
        }

        const usuario = resultado.rows[0];

        // Atualizar último acesso
        await query(
            'UPDATE usuarios SET ultimo_acesso = NOW() WHERE id = $1',
            [usuario.id]
        );

        req.usuario = usuario;
        next();

    } catch (error) {
        console.error('Erro no middleware de autenticação:', error);
        return res.status(401).json({
            sucesso: false,
            mensagem: 'Erro na autenticação'
        });
    }
};

/**
 * Middleware para verificar nível hierárquico mínimo
 */
const requerNivel = (nivelMinimo) => {
    return (req, res, next) => {
        if (!req.usuario) {
            return res.status(401).json({
                sucesso: false,
                mensagem: 'Usuário não autenticado'
            });
        }

        if (req.usuario.nivel_hierarquia > nivelMinimo) {
            return res.status(403).json({
                sucesso: false,
                mensagem: 'Nível de acesso insuficiente'
            });
        }

        next();
    };
};

/**
 * Middleware para verificar permissão específica
 */
const requerPermissao = (modulo, acao) => {
    return (req, res, next) => {
        if (!req.usuario) {
            return res.status(401).json({
                sucesso: false,
                mensagem: 'Usuário não autenticado'
            });
        }

        const permissoes = req.usuario.permissoes || {};

        // Admin sistema tem acesso total
        if (req.usuario.nivel_hierarquia === 1 || permissoes.all?.includes('*')) {
            return next();
        }

        // Verificar permissão específica
        const permissoesModulo = permissoes[modulo];
        if (!permissoesModulo) {
            return res.status(403).json({
                sucesso: false,
                mensagem: `Acesso negado ao módulo ${modulo}`
            });
        }

        if (!permissoesModulo.includes(acao) && !permissoesModulo.includes('*')) {
            return res.status(403).json({
                sucesso: false,
                mensagem: `Permissão negada para ${acao} em ${modulo}`
            });
        }

        next();
    };
};

/**
 * Middleware para verificar se usuário pertence à empresa
 */
const requerEmpresa = async (req, res, next) => {
    try {
        if (!req.usuario) {
            return res.status(401).json({
                sucesso: false,
                mensagem: 'Usuário não autenticado'
            });
        }

        // Admin sistema tem acesso a qualquer empresa
        if (req.usuario.nivel_hierarquia === 1) {
            return next();
        }

        const empresaId = req.params.empresaId || req.body.empresa_id || req.query.empresa_id;

        if (!empresaId) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'ID da empresa é obrigatório'
            });
        }

        // Verificar se usuário pertence à empresa
        if (req.usuario.empresa_id && req.usuario.empresa_id !== parseInt(empresaId)) {
            return res.status(403).json({
                sucesso: false,
                mensagem: 'Acesso negado a esta empresa'
            });
        }

        next();

    } catch (error) {
        console.error('Erro no middleware de empresa:', error);
        return res.status(500).json({
            sucesso: false,
            mensagem: 'Erro interno do servidor'
        });
    }
};

/**
 * Middleware para verificar acesso à fazenda
 */
const requerFazenda = async (req, res, next) => {
    try {
        if (!req.usuario) {
            return res.status(401).json({
                sucesso: false,
                mensagem: 'Usuário não autenticado'
            });
        }

        // Admin sistema tem acesso a qualquer fazenda
        if (req.usuario.nivel_hierarquia === 1) {
            return next();
        }

        const fazendaId = req.params.fazendaId || req.body.fazenda_id || req.query.fazenda_id;

        if (!fazendaId) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'ID da fazenda é obrigatório'
            });
        }

        // Verificar se usuário tem acesso à fazenda
        const consulta = `
            SELECT f.id 
            FROM fazendas f
            LEFT JOIN usuario_fazendas uf ON f.id = uf.fazenda_id AND uf.usuario_id = $1
            WHERE f.id = $2 AND f.ativo = true
            AND (
                f.empresa_id = $3 OR
                uf.fazenda_id IS NOT NULL OR
                $4 = 1
            )
        `;

        const resultado = await query(consulta, [
            req.usuario.id,
            fazendaId,
            req.usuario.empresa_id,
            req.usuario.nivel_hierarquia
        ]);

        if (resultado.rows.length === 0) {
            return res.status(403).json({
                sucesso: false,
                mensagem: 'Acesso negado a esta fazenda'
            });
        }

        next();

    } catch (error) {
        console.error('Erro no middleware de fazenda:', error);
        return res.status(500).json({
            sucesso: false,
            mensagem: 'Erro interno do servidor'
        });
    }
};

/**
 * Middleware para verificar se usuário pode gerenciar outros usuários
 */
const podeGerenciarUsuarios = async (req, res, next) => {
    try {
        if (!req.usuario) {
            return res.status(401).json({
                sucesso: false,
                mensagem: 'Usuário não autenticado'
            });
        }

        // Apenas admin sistema e admin empresa podem gerenciar usuários
        if (req.usuario.nivel_hierarquia > 2) {
            return res.status(403).json({
                sucesso: false,
                mensagem: 'Apenas administradores podem gerenciar usuários'
            });
        }

        // Se for admin empresa, só pode gerenciar usuários da própria empresa
        if (req.usuario.nivel_hierarquia === 2) {
            const usuarioAlvoId = req.params.id || req.body.id;
            
            if (usuarioAlvoId && usuarioAlvoId !== req.usuario.id) {
                const consulta = `
                    SELECT empresa_id FROM usuarios 
                    WHERE id = $1 AND ativo = true
                `;
                
                const resultado = await query(consulta, [usuarioAlvoId]);
                
                if (resultado.rows.length === 0) {
                    return res.status(404).json({
                        sucesso: false,
                        mensagem: 'Usuário não encontrado'
                    });
                }

                if (resultado.rows[0].empresa_id !== req.usuario.empresa_id) {
                    return res.status(403).json({
                        sucesso: false,
                        mensagem: 'Acesso negado a usuários de outras empresas'
                    });
                }
            }
        }

        next();

    } catch (error) {
        console.error('Erro no middleware de gerenciamento de usuários:', error);
        return res.status(500).json({
            sucesso: false,
            mensagem: 'Erro interno do servidor'
        });
    }
};

/**
 * Middleware para rate limiting básico
 */
const rateLimiting = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
    const requests = new Map();

    return (req, res, next) => {
        const ip = req.ip || req.connection.remoteAddress;
        const now = Date.now();
        const windowStart = now - windowMs;

        // Limpar requisições antigas
        if (requests.has(ip)) {
            const userRequests = requests.get(ip).filter(time => time > windowStart);
            requests.set(ip, userRequests);
        }

        const currentRequests = requests.get(ip) || [];
        
        if (currentRequests.length >= maxRequests) {
            return res.status(429).json({
                sucesso: false,
                mensagem: 'Muitas requisições. Tente novamente em alguns minutos.'
            });
        }

        currentRequests.push(now);
        requests.set(ip, currentRequests);

        next();
    };
};

module.exports = {
    autenticacao,
    requerNivel,
    requerPermissao,
    requerEmpresa,
    requerFazenda,
    podeGerenciarUsuarios,
    rateLimiting
}; 