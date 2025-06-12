const bcrypt = require('bcryptjs');
const { query } = require('../config/database');
const jwtService = require('../services/jwtService');
const { criarErro } = require('../middlewares/tratadorErros');

/**
 * Controller para operações de autenticação
 */
const autenticacaoController = {
    /**
     * Login do usuário
     */
    async login(req, res, next) {
        try {
            const { identifier, senha } = req.body;

            // Validação básica
            if (!identifier || !senha) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'Email/login e senha são obrigatórios'
                });
            }

            // Buscar usuário por email ou login com informações de perfil
            const consultaUsuario = `
                SELECT 
                    u.id, u.nome, u.login, u.email, u.senha, u.ativo,
                    u.empresa_id, u.perfil_id,
                    p.nome as perfil_nome, p.nivel_hierarquia, p.permissoes,
                    e.razao_social as empresa_nome
                FROM usuarios u
                INNER JOIN perfis_usuario p ON u.perfil_id = p.id
                LEFT JOIN empresas e ON u.empresa_id = e.id
                WHERE (u.email = $1 OR u.login = $1) AND u.ativo = true AND p.ativo = true
            `;

            const resultado = await query(consultaUsuario, [identifier]);

            if (resultado.rows.length === 0) {
                return res.status(401).json({
                    sucesso: false,
                    mensagem: 'Credenciais inválidas'
                });
            }

            const usuario = resultado.rows[0];

            // Verificar senha
            const senhaValida = await bcrypt.compare(senha, usuario.senha);

            if (!senhaValida) {
                return res.status(401).json({
                    sucesso: false,
                    mensagem: 'Credenciais inválidas'
                });
            }

            // Gerar token JWT
            const token = jwtService.gerarToken(usuario);

            // Remover senha do objeto de resposta
            const { senha: _, ...usuarioSemSenha } = usuario;

            res.json({
                sucesso: true,
                mensagem: 'Login realizado com sucesso',
                usuario: usuarioSemSenha,
                token
            });

        } catch (error) {
            next(error);
        }
    },

    /**
     * Cadastro de novo usuário
     */
    async cadastro(req, res, next) {
        try {
            const { nome, login, email, senha } = req.body;

            // Validação básica
            if (!nome || !login || !email || !senha) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'Todos os campos são obrigatórios'
                });
            }

            // Validar formato do email
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'Formato de email inválido'
                });
            }

            // Validar força da senha
            if (senha.length < 6) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'Senha deve ter pelo menos 6 caracteres'
                });
            }

            // Verificar se email ou login já existem
            const consultaExistente = `
                SELECT id FROM usuarios 
                WHERE email = $1 OR login = $2
            `;

            const usuarioExistente = await query(consultaExistente, [email, login]);

            if (usuarioExistente.rows.length > 0) {
                return res.status(409).json({
                    sucesso: false,
                    mensagem: 'Email ou nome de usuário já cadastrado'
                });
            }

            // Hash da senha
            const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 10;
            const senhaHash = await bcrypt.hash(senha, saltRounds);

            // Inserir novo usuário
            const consultaInsercao = `
                INSERT INTO usuarios (nome, login, email, senha)
                VALUES ($1, $2, $3, $4)
                RETURNING id, nome, login, email, ativo, criado_em
            `;

            const novoUsuario = await query(consultaInsercao, [nome, login, email, senhaHash]);

            res.status(201).json({
                sucesso: true,
                mensagem: 'Usuário cadastrado com sucesso',
                usuario: novoUsuario.rows[0]
            });

        } catch (error) {
            next(error);
        }
    },

    /**
     * Verificar autenticação
     */
    async verificar(req, res, next) {
        try {
            const authHeader = req.headers.authorization;

            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return res.json({
                    sucesso: false,
                    autenticado: false
                });
            }

            const token = authHeader.split(' ')[1];
            const decoded = jwtService.verificarToken(token);

            if (!decoded) {
                return res.json({
                    sucesso: false,
                    autenticado: false
                });
            }

            // Buscar dados atualizados do usuário
            const consultaUsuario = `
                SELECT id, nome, login, email, ativo, criado_em
                FROM usuarios 
                WHERE id = $1 AND ativo = true
            `;

            const resultado = await query(consultaUsuario, [decoded.id]);

            if (resultado.rows.length === 0) {
                return res.json({
                    sucesso: false,
                    autenticado: false
                });
            }

            res.json({
                sucesso: true,
                autenticado: true,
                usuario: resultado.rows[0]
            });

        } catch (error) {
            next(error);
        }
    },

    /**
     * Logout (placeholder - o frontend deve remover o token)
     */
    async logout(req, res) {
        res.json({
            sucesso: true,
            mensagem: 'Logout realizado com sucesso'
        });
    },

    /**
     * Renovar token JWT
     */
    async renovarToken(req, res, next) {
        try {
            const usuario = req.usuario; // Vem do middleware de autenticação

            // Buscar dados atualizados do usuário
            const consultaUsuario = `
                SELECT id, nome, login, email, ativo
                FROM usuarios 
                WHERE id = $1 AND ativo = true
            `;

            const resultado = await query(consultaUsuario, [usuario.id]);

            if (resultado.rows.length === 0) {
                return res.status(401).json({
                    sucesso: false,
                    mensagem: 'Usuário não encontrado ou inativo'
                });
            }

            // Gerar novo token
            const novoToken = jwtService.gerarToken(resultado.rows[0]);

            res.json({
                sucesso: true,
                mensagem: 'Token renovado com sucesso',
                token: novoToken,
                usuario: resultado.rows[0]
            });

        } catch (error) {
            next(error);
        }
    }
};

module.exports = autenticacaoController;