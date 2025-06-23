/**
 * Controller de Autenticação Refatorado
 * Gerencia autenticação e autorização de usuários
 * Usa Repository Pattern com Model para abstração de dados
 */

const BaseController = require('./baseController');
const Usuario = require('../models/Usuario');
const ValidationService = require('../services/validationService');
const jwtService = require('../services/jwtService');
const bcrypt = require('bcryptjs');

class AutenticacaoController extends BaseController {
    constructor() {
        super('usuarios', 'Usuário');
        this.usuarioModel = new Usuario();
    }

    /**
     * Login do usuário
     */
    async login(req, res, next) {
        try {
            const { identifier, senha } = req.body;

            // Validação básica
            if (!identifier || !senha) {
                return this.erroResponse(res, 'Email/login e senha são obrigatórios', 400);
            }

            // Buscar usuário por email ou login
            const usuario = await this.usuarioModel.findByEmailOrLogin(identifier);

            if (!usuario) {
                return this.erroResponse(res, 'Credenciais inválidas', 401);
            }

            // Verificar se usuário está ativo
            if (!usuario.ativo) {
                return this.erroResponse(res, 'Usuário inativo. Contate o administrador.', 401);
            }

            // Verificar senha
            const senhaValida = await bcrypt.compare(senha, usuario.senha);

            if (!senhaValida) {
                // Log de tentativa de login inválida
                await this.logarAuditoria(
                    null,
                    'LOGIN_FAILED',
                    'usuarios',
                    usuario.id,
                    null,
                    { identifier, ip: req.ip, user_agent: req.get('User-Agent') }
                );

                return this.erroResponse(res, 'Credenciais inválidas', 401);
            }

            // Verificar se empresa está ativa (se aplicável)
            if (usuario.empresa_id && usuario.empresa_status !== 'ativo') {
                return this.erroResponse(res, 'Empresa inativa ou suspensa. Contate o suporte.', 401);
            }

            // Gerar token JWT
            const tokenData = {
                id: usuario.id,
                email: usuario.email,
                login: usuario.login,
                nome: usuario.nome,
                empresa_id: usuario.empresa_id,
                nivel_hierarquia: usuario.nivel_hierarquia
            };

            const token = jwtService.gerarToken(tokenData);

            // Atualizar último acesso
            await this.usuarioModel.updateLastAccess(usuario.id);

            // Preparar dados do usuário para resposta (sem senha)
            const { senha: _, ...usuarioSemSenha } = usuario;

            // Log de login bem-sucedido
            await this.logarAuditoria(
                usuario.id,
                'LOGIN_SUCCESS',
                'usuarios',
                usuario.id,
                null,
                { ip: req.ip, user_agent: req.get('User-Agent') }
            );

            return this.sucessoResponse(
                res,
                {
                    usuario: usuarioSemSenha,
                    token,
                    expires_in: process.env.JWT_EXPIRES_IN || '7d'
                },
                'Login realizado com sucesso'
            );

        } catch (error) {
            console.error('Erro no login:', error);
            next(error);
        }
    }

    /**
     * Cadastro de novo usuário (auto-registro ou admin)
     */
    async cadastro(req, res, next) {
        try {
            const { senha, confirmar_senha, ...dadosUsuario } = req.body;

            // Validação básica
            if (!dadosUsuario.nome || !dadosUsuario.login || !dadosUsuario.email || !senha) {
                return this.erroResponse(res, 'Todos os campos são obrigatórios', 400);
            }

            // Validar confirmação de senha
            if (senha !== confirmar_senha) {
                return this.erroResponse(res, 'Confirmação de senha não confere', 400);
            }

            // Validações de dados
            const errosValidacao = this.usuarioModel.validate(dadosUsuario);
            if (errosValidacao.length > 0) {
                return this.erroResponse(res, 'Dados inválidos', 400, errosValidacao);
            }

            // Validações de negócio
            const errosNegocio = ValidationService.validarUsuario({ ...dadosUsuario, senha });
            if (errosNegocio.length > 0) {
                return this.erroResponse(res, 'Validação de negócio falhou', 400, errosNegocio);
            }

            // Verificar unicidade do login
            const loginUnico = await this.usuarioModel.isLoginUnique(dadosUsuario.login);
            if (!loginUnico) {
                return this.erroResponse(res, 'Login já está em uso', 409);
            }

            // Verificar unicidade do email
            const emailUnico = await this.usuarioModel.isEmailUnique(dadosUsuario.email);
            if (!emailUnico) {
                return this.erroResponse(res, 'Email já está em uso', 409);
            }

            // Definir perfil padrão se não especificado (usuário básico)
            if (!dadosUsuario.perfil_id) {
                dadosUsuario.perfil_id = await this.usuarioModel.getDefaultPerfilId();
            }

            // Criar usuário
            const novoUsuario = await this.usuarioModel.createWithPassword(dadosUsuario, senha);

            // Log de auditoria
            await this.logarAuditoria(
                novoUsuario.id,
                'REGISTER',
                'usuarios',
                novoUsuario.id,
                null,
                { nome: novoUsuario.nome, login: novoUsuario.login, email: novoUsuario.email }
            );

            // Preparar resposta (sem senha)
            const { senha: _, ...usuarioSemSenha } = novoUsuario;

            return this.sucessoResponse(
                res,
                usuarioSemSenha,
                'Usuário cadastrado com sucesso',
                201
            );

        } catch (error) {
            console.error('Erro no cadastro:', error);
            next(error);
        }
    }

    /**
     * Verificar autenticação (validar token)
     */
    async verificar(req, res, next) {
        try {
            const authHeader = req.headers.authorization;

            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return this.sucessoResponse(
                    res,
                    { autenticado: false },
                    'Token não fornecido'
                );
            }

            const token = authHeader.split(' ')[1];
            const decoded = jwtService.verificarToken(token);

            if (!decoded) {
                return this.sucessoResponse(
                    res,
                    { autenticado: false },
                    'Token inválido ou expirado'
                );
            }

            // Buscar dados atualizados do usuário
            const usuario = await this.usuarioModel.findByIdWithDetails(decoded.id);

            if (!usuario || !usuario.ativo) {
                return this.sucessoResponse(
                    res,
                    { autenticado: false },
                    'Usuário não encontrado ou inativo'
                );
            }

            // Verificar se empresa está ativa (se aplicável)
            if (usuario.empresa_id && usuario.empresa_status !== 'ativo') {
                return this.sucessoResponse(
                    res,
                    { autenticado: false, motivo: 'empresa_inativa' },
                    'Empresa inativa ou suspensa'
                );
            }

            // Preparar dados do usuário (sem senha)
            const { senha: _, ...usuarioSemSenha } = usuario;

            // Verificar se token está próximo do vencimento
            const proximoVencimento = jwtService.proximoVencimento(token, 60);

            return this.sucessoResponse(
                res,
                {
                    autenticado: true,
                    usuario: usuarioSemSenha,
                    token_expira_em_breve: proximoVencimento
                },
                'Token válido'
            );

        } catch (error) {
            console.error('Erro na verificação de token:', error);
            return this.sucessoResponse(
                res,
                { autenticado: false },
                'Erro na verificação'
            );
        }
    }

    /**
     * Logout (invalidar token no cliente)
     */
    async logout(req, res, next) {
        try {
            // Log de logout se usuário estiver autenticado
            if (req.usuario) {
                await this.logarAuditoria(
                    req.usuario.id,
                    'LOGOUT',
                    'usuarios',
                    req.usuario.id,
                    null,
                    { ip: req.ip, user_agent: req.get('User-Agent') }
                );
            }

            return this.sucessoResponse(
                res,
                null,
                'Logout realizado com sucesso'
            );

        } catch (error) {
            console.error('Erro no logout:', error);
            next(error);
        }
    }

    /**
     * Renovar token JWT
     */
    async renovarToken(req, res, next) {
        try {
            const usuario = req.usuario; // Vem do middleware de autenticação

            // Buscar dados atualizados do usuário
            const usuarioAtualizado = await this.usuarioModel.findByIdWithDetails(usuario.id);

            if (!usuarioAtualizado || !usuarioAtualizado.ativo) {
                return this.erroResponse(res, 'Usuário não encontrado ou inativo', 401);
            }

            // Verificar se empresa está ativa (se aplicável)
            if (usuarioAtualizado.empresa_id && usuarioAtualizado.empresa_status !== 'ativo') {
                return this.erroResponse(res, 'Empresa inativa ou suspensa', 401);
            }

            // Gerar novo token
            const tokenData = {
                id: usuarioAtualizado.id,
                email: usuarioAtualizado.email,
                login: usuarioAtualizado.login,
                nome: usuarioAtualizado.nome,
                empresa_id: usuarioAtualizado.empresa_id,
                nivel_hierarquia: usuarioAtualizado.nivel_hierarquia
            };

            const novoToken = jwtService.gerarToken(tokenData);

            // Preparar dados do usuário (sem senha)
            const { senha: _, ...usuarioSemSenha } = usuarioAtualizado;

            // Log de renovação
            await this.logarAuditoria(
                usuario.id,
                'TOKEN_REFRESH',
                'usuarios',
                usuario.id,
                null,
                { ip: req.ip }
            );

            return this.sucessoResponse(
                res,
                {
                    token: novoToken,
                    usuario: usuarioSemSenha,
                    expires_in: process.env.JWT_EXPIRES_IN || '7d'
                },
                'Token renovado com sucesso'
            );

        } catch (error) {
            console.error('Erro ao renovar token:', error);
            next(error);
        }
    }

    /**
     * Alterar senha do usuário logado
     */
    async alterarSenha(req, res, next) {
        try {
            const { senha_atual, nova_senha, confirmar_senha } = req.body;
            const usuarioId = req.usuario.id;

            // Validações básicas
            if (!senha_atual || !nova_senha || !confirmar_senha) {
                return this.erroResponse(res, 'Todos os campos são obrigatórios', 400);
            }

            if (nova_senha !== confirmar_senha) {
                return this.erroResponse(res, 'Confirmação de senha não confere', 400);
            }

            if (nova_senha.length < 6) {
                return this.erroResponse(res, 'Nova senha deve ter pelo menos 6 caracteres', 400);
            }

            // Verificar senha atual
            const senhaValida = await this.usuarioModel.verifyPassword(usuarioId, senha_atual);
            if (!senhaValida) {
                return this.erroResponse(res, 'Senha atual incorreta', 400);
            }

            // Atualizar senha
            const resultado = await this.usuarioModel.updatePassword(usuarioId, nova_senha);

            if (!resultado) {
                return this.erroResponse(res, 'Erro ao atualizar senha', 500);
            }

            // Log de auditoria
            await this.logarAuditoria(
                usuarioId,
                'CHANGE_PASSWORD',
                'usuarios',
                usuarioId,
                null,
                { ip: req.ip }
            );

            return this.sucessoResponse(
                res,
                null,
                'Senha alterada com sucesso'
            );

        } catch (error) {
            console.error('Erro ao alterar senha:', error);
            next(error);
        }
    }

    /**
     * Solicitar recuperação de senha
     */
    async solicitarRecuperacao(req, res, next) {
        try {
            const { email } = req.body;

            if (!email) {
                return this.erroResponse(res, 'Email é obrigatório', 400);
            }

            // Buscar usuário pelo email
            const usuario = await this.usuarioModel.findByEmail(email);

            // Por segurança, sempre retorna sucesso, mesmo se email não existir
            if (!usuario) {
                return this.sucessoResponse(
                    res,
                    null,
                    'Se o email estiver cadastrado, você receberá instruções para recuperação'
                );
            }

            // Verificar se usuário está ativo
            if (!usuario.ativo) {
                return this.sucessoResponse(
                    res,
                    null,
                    'Se o email estiver cadastrado, você receberá instruções para recuperação'
                );
            }

            // Gerar token de recuperação (válido por 1 hora)
            const tokenRecuperacao = jwtService.gerarToken(
                { id: usuario.id, tipo: 'password_reset' },
                '1h'
            );

            // Aqui seria enviado o email com o token
            // Por enquanto, apenas log de auditoria
            await this.logarAuditoria(
                usuario.id,
                'PASSWORD_RESET_REQUEST',
                'usuarios',
                usuario.id,
                null,
                { email, ip: req.ip, token_gerado: true }
            );

            // TODO: Implementar envio de email
            console.log(`Token de recuperação para ${email}: ${tokenRecuperacao}`);

            return this.sucessoResponse(
                res,
                null,
                'Se o email estiver cadastrado, você receberá instruções para recuperação'
            );

        } catch (error) {
            console.error('Erro ao solicitar recuperação:', error);
            next(error);
        }
    }

    /**
     * Redefinir senha com token
     */
    async redefinirSenha(req, res, next) {
        try {
            const { token, nova_senha, confirmar_senha } = req.body;

            if (!token || !nova_senha || !confirmar_senha) {
                return this.erroResponse(res, 'Todos os campos são obrigatórios', 400);
            }

            if (nova_senha !== confirmar_senha) {
                return this.erroResponse(res, 'Confirmação de senha não confere', 400);
            }

            if (nova_senha.length < 6) {
                return this.erroResponse(res, 'Nova senha deve ter pelo menos 6 caracteres', 400);
            }

            // Verificar token de recuperação
            const decoded = jwtService.verificarToken(token);

            if (!decoded || decoded.tipo !== 'password_reset') {
                return this.erroResponse(res, 'Token inválido ou expirado', 400);
            }

            // Buscar usuário
            const usuario = await this.usuarioModel.findById(decoded.id);

            if (!usuario || !usuario.ativo) {
                return this.erroResponse(res, 'Usuário não encontrado ou inativo', 404);
            }

            // Atualizar senha
            const resultado = await this.usuarioModel.updatePassword(decoded.id, nova_senha);

            if (!resultado) {
                return this.erroResponse(res, 'Erro ao redefinir senha', 500);
            }

            // Log de auditoria
            await this.logarAuditoria(
                decoded.id,
                'PASSWORD_RESET_SUCCESS',
                'usuarios',
                decoded.id,
                null,
                { ip: req.ip }
            );

            return this.sucessoResponse(
                res,
                null,
                'Senha redefinida com sucesso'
            );

        } catch (error) {
            console.error('Erro ao redefinir senha:', error);
            next(error);
        }
    }

    /**
     * Obter perfil do usuário logado
     */
    async meuPerfil(req, res, next) {
        try {
            const usuario = await this.usuarioModel.findByIdWithDetails(req.usuario.id);

            if (!usuario) {
                return this.erroResponse(res, 'Usuário não encontrado', 404);
            }

            // Preparar dados do usuário (sem senha)
            const { senha: _, ...usuarioSemSenha } = usuario;

            return this.sucessoResponse(
                res,
                usuarioSemSenha,
                'Perfil do usuário obtido'
            );

        } catch (error) {
            console.error('Erro ao buscar perfil:', error);
            next(error);
        }
    }

    /**
     * Atualizar perfil do usuário logado
     */
    async atualizarMeuPerfil(req, res, next) {
        try {
            const { nome, email, telefone, cargo } = req.body;
            const usuarioId = req.usuario.id;

            // Dados que o usuário pode alterar em seu próprio perfil
            const dadosPermitidos = { nome, telefone, cargo };

            // Email precisa validação especial
            if (email && email !== req.usuario.email) {
                const emailUnico = await this.usuarioModel.isEmailUnique(email, usuarioId);
                if (!emailUnico) {
                    return this.erroResponse(res, 'Email já está em uso', 409);
                }
                dadosPermitidos.email = email;
            }

            // Validar dados
            const validationErrors = this.usuarioModel.validate(dadosPermitidos);
            if (validationErrors.length > 0) {
                return this.erroResponse(res, 'Dados inválidos', 400, validationErrors);
            }

            // Atualizar
            await this.usuarioModel.update(usuarioId, dadosPermitidos);

            // Buscar usuário atualizado
            const usuarioAtualizado = await this.usuarioModel.findByIdWithDetails(usuarioId);

            // Log de auditoria
            await this.logarAuditoria(
                usuarioId,
                'UPDATE_OWN_PROFILE',
                'usuarios',
                usuarioId,
                null,
                dadosPermitidos
            );

            // Preparar dados do usuário (sem senha)
            const { senha: _, ...usuarioSemSenha } = usuarioAtualizado;

            return this.sucessoResponse(
                res,
                usuarioSemSenha,
                'Perfil atualizado com sucesso'
            );

        } catch (error) {
            console.error('Erro ao atualizar perfil:', error);
            next(error);
        }
    }

    /**
     * Listar sessões ativas do usuário
     */
    async sessõesAtivas(req, res, next) {
        try {
            // Esta funcionalidade requereria armazenamento de sessões
            // Por enquanto, retorna informação básica
            const sessaoAtual = {
                ip: req.ip,
                user_agent: req.get('User-Agent'),
                data_login: new Date().toISOString(),
                ativa: true
            };

            return this.sucessoResponse(
                res,
                [sessaoAtual],
                'Sessões ativas listadas'
            );

        } catch (error) {
            console.error('Erro ao listar sessões:', error);
            next(error);
        }
    }

    /**
     * Verificar status da conta
     */
    async statusConta(req, res, next) {
        try {
            const usuario = await this.usuarioModel.findByIdWithDetails(req.usuario.id);

            if (!usuario) {
                return this.erroResponse(res, 'Usuário não encontrado', 404);
            }

            const status = {
                usuario_ativo: usuario.ativo,
                empresa_ativa: usuario.empresa_id ? usuario.empresa_status === 'ativo' : true,
                perfil_nome: usuario.perfil_nome,
                nivel_hierarquia: usuario.nivel_hierarquia,
                ultimo_acesso: usuario.ultimo_acesso,
                data_criacao: usuario.criado_em,
                permissoes: usuario.permissoes || {},
                fazendas_acesso: usuario.fazendas_acesso || []
            };

            return this.sucessoResponse(
                res,
                status,
                'Status da conta obtido'
            );

        } catch (error) {
            console.error('Erro ao obter status da conta:', error);
            next(error);
        }
    }
}

module.exports = new AutenticacaoController();