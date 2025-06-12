const { query } = require('../config/database');
const { criarErro } = require('../middlewares/tratadorErros');

/**
 * Controller para operações com usuários
 */
const usuariosController = {
    /**
     * Buscar todos os usuários
     */
    async buscarTodos(req, res, next) {
        try {
            const consulta = `
                SELECT 
                    id,
                    nome,
                    login,
                    email,
                    ativo,
                    criado_em,
                    atualizado_em
                FROM usuarios
                WHERE ativo = true
                ORDER BY nome
            `;

            const resultado = await query(consulta);

            res.json(resultado.rows);

        } catch (error) {
            next(error);
        }
    },

    /**
     * Buscar usuário por ID
     */
    async buscarPorId(req, res, next) {
        try {
            const { id } = req.params;

            const consulta = `
                SELECT 
                    id,
                    nome,
                    login,
                    email,
                    ativo,
                    criado_em,
                    atualizado_em
                FROM usuarios
                WHERE id = $1 AND ativo = true
            `;

            const resultado = await query(consulta, [id]);

            if (resultado.rows.length === 0) {
                return res.status(404).json({
                    message: 'Usuário não encontrado'
                });
            }

            res.json(resultado.rows[0]);

        } catch (error) {
            next(error);
        }
    },

    /**
     * Atualizar usuário
     */
    async atualizar(req, res, next) {
        try {
            const { id } = req.params;
            const { nome, login, email } = req.body;
            const usuarioLogadoId = req.usuario.id;

            // Verificar se o usuário existe
            const consultaExistencia = `
                SELECT id FROM usuarios 
                WHERE id = $1 AND ativo = true
            `;

            const usuarioExiste = await query(consultaExistencia, [id]);

            if (usuarioExiste.rows.length === 0) {
                return res.status(404).json({
                    message: 'Usuário não encontrado'
                });
            }

            // Verificar se o usuário tem permissão (apenas o próprio usuário)
            if (usuarioLogadoId !== parseInt(id)) {
                return res.status(403).json({
                    message: 'Acesso negado. Você só pode atualizar seu próprio perfil.'
                });
            }

            // Validação básica
            if (!nome || nome.trim().length === 0) {
                return res.status(400).json({
                    message: 'Nome é obrigatório'
                });
            }

            if (!email || email.trim().length === 0) {
                return res.status(400).json({
                    message: 'Email é obrigatório'
                });
            }

            // Validar formato do email
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({
                    message: 'Formato de email inválido'
                });
            }

            // Verificar se email ou login já existem para outro usuário
            if (login) {
                const consultaExistente = `
                    SELECT id FROM usuarios 
                    WHERE (email = $1 OR login = $2) AND id != $3 AND ativo = true
                `;

                const usuarioExistente = await query(consultaExistente, [email.trim(), login.trim(), id]);

                if (usuarioExistente.rows.length > 0) {
                    return res.status(409).json({
                        message: 'Email ou nome de usuário já está em uso por outro usuário'
                    });
                }
            } else {
                const consultaEmailExistente = `
                    SELECT id FROM usuarios 
                    WHERE email = $1 AND id != $2 AND ativo = true
                `;

                const emailExistente = await query(consultaEmailExistente, [email.trim(), id]);

                if (emailExistente.rows.length > 0) {
                    return res.status(409).json({
                        message: 'Email já está em uso por outro usuário'
                    });
                }
            }

            // Atualizar usuário
            const consultaAtualizacao = `
                UPDATE usuarios 
                SET 
                    nome = $1,
                    ${login ? 'login = $2,' : ''}
                    email = $${login ? '3' : '2'},
                    atualizado_em = CURRENT_TIMESTAMP
                WHERE id = $${login ? '4' : '3'} AND ativo = true
                RETURNING 
                    id, nome, login, email, ativo,
                    criado_em, atualizado_em
            `;

            const parametros = login
                ? [nome.trim(), login.trim(), email.trim(), id]
                : [nome.trim(), email.trim(), id];

            const usuarioAtualizado = await query(consultaAtualizacao, parametros);

            res.json({
                message: 'Usuário atualizado com sucesso',
                user: usuarioAtualizado.rows[0]
            });

        } catch (error) {
            next(error);
        }
    },

    /**
     * Excluir usuário (soft delete)
     */
    async excluir(req, res, next) {
        try {
            const { id } = req.params;
            const usuarioLogadoId = req.usuario.id;

            // Verificar se o usuário existe
            const consultaExistencia = `
                SELECT id FROM usuarios 
                WHERE id = $1 AND ativo = true
            `;

            const usuarioExiste = await query(consultaExistencia, [id]);

            if (usuarioExiste.rows.length === 0) {
                return res.status(404).json({
                    message: 'Usuário não encontrado'
                });
            }

            // Verificar se o usuário tem permissão (apenas o próprio usuário)
            if (usuarioLogadoId !== parseInt(id)) {
                return res.status(403).json({
                    message: 'Acesso negado. Você só pode excluir seu próprio perfil.'
                });
            }

            // Verificar se não é o último usuário ativo
            const consultaUsuariosAtivos = `
                SELECT COUNT(*) as total FROM usuarios 
                WHERE ativo = true
            `;

            const totalUsuarios = await query(consultaUsuariosAtivos);

            if (parseInt(totalUsuarios.rows[0].total) <= 1) {
                return res.status(409).json({
                    message: 'Não é possível excluir o último usuário ativo do sistema'
                });
            }

            // Soft delete do usuário
            const consultaExclusao = `
                UPDATE usuarios 
                SET 
                    ativo = false,
                    atualizado_em = CURRENT_TIMESTAMP
                WHERE id = $1
            `;

            await query(consultaExclusao, [id]);

            res.json({
                message: 'Usuário excluído com sucesso'
            });

        } catch (error) {
            next(error);
        }
    }
};

module.exports = usuariosController;