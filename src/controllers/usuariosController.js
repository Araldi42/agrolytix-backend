/**
 * Controller de Usuários
 * Gerencia usuários do sistema com perfis e permissões
 * Suporta multi-tenant e controle hierárquico
 */

const BaseController = require('./baseController');
const Usuario = require('../models/Usuario');
const ValidationService = require('../services/validationService');
const bcrypt = require('bcryptjs');

class UsuariosController extends BaseController {
    constructor() {
        super('usuarios', 'Usuário');
        this.usuarioModel = new Usuario();
    }

    /**
     * Listar usuários da empresa
     */
    async listar(req, res, next) {
        try {
            const empresaId = req.usuario.empresa_id;

            if (!empresaId) {
                return this.erroResponse(res, 'Acesso negado', 403);
            }

            const options = {
                search: req.query.search,
                perfil_id: req.query.perfil_id,
                ativo: req.query.ativo !== 'false', // default true
                page: parseInt(req.query.page) || 1,
                limit: Math.min(parseInt(req.query.limit) || 20, 100)
            };

            const usuarios = await this.usuarioModel.findByEmpresa(empresaId, options);

            // Contar total para paginação
            const total = await this.usuarioModel.count({
                empresa_id: empresaId,
                ativo: options.ativo
            });

            return this.respostaPaginada(
                res,
                usuarios,
                total,
                options.page,
                options.limit,
                'Usuários listados com sucesso'
            );

        } catch (error) {
            console.error('Erro ao listar usuários:', error);
            next(error);
        }
    }

    /**
     * Buscar usuário por ID
     */
    async buscarPorId(req, res, next) {
        try {
            const { id } = req.params;
            const empresaId = req.usuario.empresa_id;

            // Verificar se pode acessar o usuário
            if (req.usuario.nivel_hierarquia > 2 && req.usuario.id !== parseInt(id)) {
                return this.erroResponse(res, 'Sem permissão para acessar este usuário', 403);
            }

            const usuario = await this.usuarioModel.findByIdWithDetails(id, empresaId);

            if (!usuario) {
                return this.erroResponse(res, 'Usuário não encontrado', 404);
            }

            return this.sucessoResponse(
                res,
                usuario,
                'Usuário encontrado'
            );

        } catch (error) {
            console.error('Erro ao buscar usuário:', error);
            next(error);
        }
    }

    /**
     * Criar novo usuário
     */
    async criar(req, res, next) {
        try {
            const { senha, confirmar_senha, fazendas_ids, ...dadosUsuario } = req.body;
            const empresaId = req.usuario.empresa_id;

            // Verificar permissões - apenas gerentes ou superiores podem criar usuários
            if (req.usuario.nivel_hierarquia > 3) {
                return this.erroResponse(res, 'Sem permissão para criar usuários', 403);
            }

            // Validar dados básicos
            const validationErrors = this.usuarioModel.validate(dadosUsuario);
            if (validationErrors.length > 0) {
                return this.erroResponse(res, validationErrors.join(', '), 400);
            }

            // Validar senha
            if (!senha || senha.length < 6) {
                return this.erroResponse(res, 'Senha deve ter pelo menos 6 caracteres', 400);
            }

            if (senha !== confirmar_senha) {
                return this.erroResponse(res, 'Confirmação de senha não confere', 400);
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

            // Definir empresa do usuário
            dadosUsuario.empresa_id = empresaId;
            dadosUsuario.criado_por = req.usuario.id;
            dadosUsuario.fazendas_ids = fazendas_ids;

            // Verificar se o perfil existe e pertence à hierarquia adequada
            if (dadosUsuario.perfil_id) {
                const perfilValido = await ValidationService.verificarPerfilUsuario(
                    dadosUsuario.perfil_id,
                    req.usuario.nivel_hierarquia
                );

                if (!perfilValido) {
                    return this.erroResponse(res, 'Perfil inválido ou sem permissão', 400);
                }
            }

            // Criar usuário
            const novoUsuario = await this.usuarioModel.createWithPassword(dadosUsuario, senha);

            // Log de auditoria
            await this.logarAuditoria(
                req.usuario.id,
                'CREATE_USER',
                'usuarios',
                novoUsuario.id,
                null,
                { nome: novoUsuario.nome, login: novoUsuario.login }
            );

            return this.sucessoResponse(
                res,
                novoUsuario,
                'Usuário criado com sucesso',
                201
            );

        } catch (error) {
            console.error('Erro ao criar usuário:', error);
            next(error);
        }
    }

    /**
     * Atualizar usuário
     */
    async atualizar(req, res, next) {
        try {
            const { id } = req.params;
            const { fazendas_ids, ...dadosUsuario } = req.body;
            const empresaId = req.usuario.empresa_id;

            // Verificar se pode editar o usuário
            if (req.usuario.nivel_hierarquia > 3 && req.usuario.id !== parseInt(id)) {
                return this.erroResponse(res, 'Sem permissão para editar este usuário', 403);
            }

            // Buscar usuário existente
            const usuarioExistente = await this.usuarioModel.findByIdWithDetails(id, empresaId);
            if (!usuarioExistente) {
                return this.erroResponse(res, 'Usuário não encontrado', 404);
            }

            // Validar dados básicos
            const validationErrors = this.usuarioModel.validate(dadosUsuario);
            if (validationErrors.length > 0) {
                return this.erroResponse(res, validationErrors.join(', '), 400);
            }

            // Verificar unicidade do login (excluindo o próprio usuário)
            if (dadosUsuario.login && dadosUsuario.login !== usuarioExistente.login) {
                const loginUnico = await this.usuarioModel.isLoginUnique(dadosUsuario.login, id);
                if (!loginUnico) {
                    return this.erroResponse(res, 'Login já está em uso', 409);
                }
            }

            // Verificar unicidade do email (excluindo o próprio usuário)
            if (dadosUsuario.email && dadosUsuario.email !== usuarioExistente.email) {
                const emailUnico = await this.usuarioModel.isEmailUnique(dadosUsuario.email, id);
                if (!emailUnico) {
                    return this.erroResponse(res, 'Email já está em uso', 409);
                }
            }

            // Verificar se o perfil existe e pertence à hierarquia adequada
            if (dadosUsuario.perfil_id && dadosUsuario.perfil_id !== usuarioExistente.perfil_id) {
                const perfilValido = await ValidationService.verificarPerfilUsuario(
                    dadosUsuario.perfil_id,
                    req.usuario.nivel_hierarquia
                );

                if (!perfilValido) {
                    return this.erroResponse(res, 'Perfil inválido ou sem permissão', 400);
                }
            }

            // Atualizar usuário
            const usuarioAtualizado = await this.usuarioModel.update(id, dadosUsuario);

            // Atualizar acesso às fazendas se fornecido
            if (fazendas_ids !== undefined) {
                await this.usuarioModel.updateFazendasAccess(id, fazendas_ids);
            }

            // Buscar usuário atualizado com detalhes
            const usuarioCompleto = await this.usuarioModel.findByIdWithDetails(id, empresaId);

            // Log de auditoria
            await this.logarAuditoria(
                req.usuario.id,
                'UPDATE_USER',
                'usuarios',
                id,
                usuarioExistente,
                dadosUsuario
            );

            return this.sucessoResponse(
                res,
                usuarioCompleto,
                'Usuário atualizado com sucesso'
            );

        } catch (error) {
            console.error('Erro ao atualizar usuário:', error);
            next(error);
        }
    }

    /**
     * Inativar usuário
     */
    async inativar(req, res, next) {
        try {
            const { id } = req.params;
            const empresaId = req.usuario.empresa_id;

            // Verificar permissões - apenas gerentes ou superiores podem inativar usuários
            if (req.usuario.nivel_hierarquia > 3) {
                return this.erroResponse(res, 'Sem permissão para inativar usuários', 403);
            }

            // Não permitir que o usuário inactive a si mesmo
            if (req.usuario.id === parseInt(id)) {
                return this.erroResponse(res, 'Não é possível inativar seu próprio usuário', 400);
            }

            // Buscar usuário
            const usuario = await this.usuarioModel.findByIdWithDetails(id, empresaId);
            if (!usuario) {
                return this.erroResponse(res, 'Usuário não encontrado', 404);
            }

            // Inativar
            await this.usuarioModel.update(id, { ativo: false });

            // Log de auditoria
            await this.logarAuditoria(
                req.usuario.id,
                'DEACTIVATE_USER',
                'usuarios',
                id,
                { ativo: true },
                { ativo: false }
            );

            return this.sucessoResponse(
                res,
                { id: parseInt(id), ativo: false },
                'Usuário inativado com sucesso'
            );

        } catch (error) {
            console.error('Erro ao inativar usuário:', error);
            next(error);
        }
    }

    /**
     * Reativar usuário
     */
    async reativar(req, res, next) {
        try {
            const { id } = req.params;
            const empresaId = req.usuario.empresa_id;

            // Verificar permissões - apenas gerentes ou superiores
            if (req.usuario.nivel_hierarquia > 3) {
                return this.erroResponse(res, 'Sem permissão para reativar usuários', 403);
            }

            // Buscar usuário
            const usuario = await this.usuarioModel.findByIdWithDetails(id, empresaId);
            if (!usuario) {
                return this.erroResponse(res, 'Usuário não encontrado', 404);
            }

            // Reativar
            await this.usuarioModel.update(id, { ativo: true });

            // Log de auditoria
            await this.logarAuditoria(
                req.usuario.id,
                'REACTIVATE_USER',
                'usuarios',
                id,
                { ativo: false },
                { ativo: true }
            );

            return this.sucessoResponse(
                res,
                { id: parseInt(id), ativo: true },
                'Usuário reativado com sucesso'
            );

        } catch (error) {
            console.error('Erro ao reativar usuário:', error);
            next(error);
        }
    }

    /**
     * Alterar senha do usuário
     */
    async alterarSenha(req, res, next) {
        try {
            const { id } = req.params;
            const { senha_atual, nova_senha, confirmar_senha } = req.body;
            const empresaId = req.usuario.empresa_id;

            // Verificar se pode alterar a senha (próprio usuário ou admin)
            if (req.usuario.id !== parseInt(id) && req.usuario.nivel_hierarquia > 2) {
                return this.erroResponse(res, 'Sem permissão para alterar senha deste usuário', 403);
            }

            // Validar nova senha
            if (!nova_senha || nova_senha.length < 6) {
                return this.erroResponse(res, 'Nova senha deve ter pelo menos 6 caracteres', 400);
            }

            if (nova_senha !== confirmar_senha) {
                return this.erroResponse(res, 'Confirmação de senha não confere', 400);
            }

            // Se for o próprio usuário, verificar senha atual
            if (req.usuario.id === parseInt(id)) {
                if (!senha_atual) {
                    return this.erroResponse(res, 'Senha atual é obrigatória', 400);
                }

                const senhaValida = await this.usuarioModel.verifyPassword(id, senha_atual);
                if (!senhaValida) {
                    return this.erroResponse(res, 'Senha atual incorreta', 400);
                }
            }

            // Atualizar senha
            const resultado = await this.usuarioModel.updatePassword(id, nova_senha);

            if (!resultado) {
                return this.erroResponse(res, 'Usuário não encontrado', 404);
            }

            // Log de auditoria
            await this.logarAuditoria(
                req.usuario.id,
                'CHANGE_PASSWORD',
                'usuarios',
                id,
                null,
                { target_user: resultado.nome }
            );

            return this.sucessoResponse(
                res,
                { mensagem: 'Senha alterada com sucesso' },
                'Senha alterada com sucesso'
            );

        } catch (error) {
            console.error('Erro ao alterar senha:', error);
            next(error);
        }
    }

    /**
     * Buscar usuários por perfil
     */
    async buscarPorPerfil(req, res, next) {
        try {
            const { perfil_id } = req.params;
            const empresaId = req.usuario.empresa_id;

            if (!empresaId) {
                return this.erroResponse(res, 'Acesso negado', 403);
            }

            const usuarios = await this.usuarioModel.findByPerfil(perfil_id, empresaId);

            return this.sucessoResponse(
                res,
                usuarios,
                'Usuários por perfil listados'
            );

        } catch (error) {
            console.error('Erro ao buscar usuários por perfil:', error);
            next(error);
        }
    }

    /**
     * Buscar usuários por cargo
     */
    async buscarPorCargo(req, res, next) {
        try {
            const { cargo } = req.query;
            const empresaId = req.usuario.empresa_id;

            if (!cargo) {
                return this.erroResponse(res, 'Cargo é obrigatório', 400);
            }

            if (!empresaId) {
                return this.erroResponse(res, 'Acesso negado', 403);
            }

            const usuarios = await this.usuarioModel.findByCargo(cargo, empresaId);

            return this.sucessoResponse(
                res,
                usuarios,
                'Usuários por cargo listados'
            );

        } catch (error) {
            console.error('Erro ao buscar usuários por cargo:', error);
            next(error);
        }
    }

    /**
     * Buscar usuários inativos
     */
    async usuariosInativos(req, res, next) {
        try {
            const { dias = 30 } = req.query;
            const empresaId = req.usuario.empresa_id;

            if (!empresaId) {
                return this.erroResponse(res, 'Acesso negado', 403);
            }

            // Verificar permissões - apenas gerentes ou superiores
            if (req.usuario.nivel_hierarquia > 3) {
                return this.erroResponse(res, 'Sem permissão para visualizar usuários inativos', 403);
            }

            const usuarios = await this.usuarioModel.findInativosPorPeriodo(parseInt(dias), empresaId);

            return this.sucessoResponse(
                res,
                usuarios,
                `Usuários inativos há ${dias} dias listados`
            );

        } catch (error) {
            console.error('Erro ao buscar usuários inativos:', error);
            next(error);
        }
    }

    /**
     * Gerenciar acesso às fazendas
     */
    async gerenciarFazendas(req, res, next) {
        try {
            const { id } = req.params;
            const { fazendas_ids } = req.body;
            const empresaId = req.usuario.empresa_id;

            // Verificar permissões - apenas gerentes ou superiores
            if (req.usuario.nivel_hierarquia > 3) {
                return this.erroResponse(res, 'Sem permissão para gerenciar acesso às fazendas', 403);
            }

            // Verificar se usuário existe
            const usuario = await this.usuarioModel.findByIdWithDetails(id, empresaId);
            if (!usuario) {
                return this.erroResponse(res, 'Usuário não encontrado', 404);
            }

            // Validar fazendas_ids
            if (!Array.isArray(fazendas_ids)) {
                return this.erroResponse(res, 'fazendas_ids deve ser um array', 400);
            }

            // Atualizar acesso às fazendas
            await this.usuarioModel.updateFazendasAccess(id, fazendas_ids);

            // Buscar fazendas atualizadas
            const fazendasAtualizadas = await this.usuarioModel.getFazendasAccess(id);

            // Log de auditoria
            await this.logarAuditoria(
                req.usuario.id,
                'UPDATE_USER_FARMS',
                'usuarios',
                id,
                null,
                { fazendas_ids, total_fazendas: fazendasAtualizadas.length }
            );

            return this.sucessoResponse(
                res,
                {
                    usuario_id: parseInt(id),
                    fazendas: fazendasAtualizadas
                },
                'Acesso às fazendas atualizado com sucesso'
            );

        } catch (error) {
            console.error('Erro ao gerenciar fazendas:', error);
            next(error);
        }
    }

    /**
     * Buscar fazendas do usuário
     */
    async fazendasUsuario(req, res, next) {
        try {
            const { id } = req.params;
            const empresaId = req.usuario.empresa_id;

            // Verificar se pode acessar as fazendas do usuário
            if (req.usuario.nivel_hierarquia > 3 && req.usuario.id !== parseInt(id)) {
                return this.erroResponse(res, 'Sem permissão para acessar fazendas deste usuário', 403);
            }

            // Verificar se usuário existe e pertence à empresa
            const usuario = await this.usuarioModel.findByIdWithDetails(id, empresaId);
            if (!usuario) {
                return this.erroResponse(res, 'Usuário não encontrado', 404);
            }

            const fazendas = await this.usuarioModel.getFazendasAccess(id);

            return this.sucessoResponse(
                res,
                fazendas,
                'Fazendas do usuário listadas'
            );

        } catch (error) {
            console.error('Erro ao buscar fazendas do usuário:', error);
            next(error);
        }
    }

    /**
     * Obter estatísticas de usuários
     */
    async estatisticas(req, res, next) {
        try {
            const empresaId = req.usuario.empresa_id;

            if (!empresaId) {
                return this.erroResponse(res, 'Acesso negado', 403);
            }

            // Verificar permissões - apenas gerentes ou superiores
            if (req.usuario.nivel_hierarquia > 3) {
                return this.erroResponse(res, 'Sem permissão para visualizar estatísticas', 403);
            }

            const estatisticas = await this.usuarioModel.getEstatisticas(empresaId);

            return this.sucessoResponse(
                res,
                estatisticas,
                'Estatísticas de usuários obtidas'
            );

        } catch (error) {
            console.error('Erro ao obter estatísticas:', error);
            next(error);
        }
    }

    /**
     * Buscar perfil do usuário logado
     */
    async meuPerfil(req, res, next) {
        try {
            const usuario = await this.usuarioModel.findByIdWithDetails(req.usuario.id);

            if (!usuario) {
                return this.erroResponse(res, 'Usuário não encontrado', 404);
            }

            return this.sucessoResponse(
                res,
                usuario,
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
                return this.erroResponse(res, validationErrors.join(', '), 400);
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

            return this.sucessoResponse(
                res,
                usuarioAtualizado,
                'Perfil atualizado com sucesso'
            );

        } catch (error) {
            console.error('Erro ao atualizar perfil:', error);
            next(error);
        }
    }

    /**
     * Dashboard de usuários - resumo executivo
     */
    async dashboard(req, res, next) {
        try {
            const empresaId = req.usuario.empresa_id;

            if (!empresaId) {
                return this.erroResponse(res, 'Acesso negado', 403);
            }

            // Verificar permissões - apenas gerentes ou superiores
            if (req.usuario.nivel_hierarquia > 3) {
                return this.erroResponse(res, 'Sem permissão para visualizar dashboard', 403);
            }

            // Buscar dados em paralelo para performance
            const [
                estatisticas,
                usuariosInativos,
                usuariosRecentes
            ] = await Promise.all([
                this.usuarioModel.getEstatisticas(empresaId),
                this.usuarioModel.findInativosPorPeriodo(30, empresaId),
                this.usuarioModel.findByEmpresa(empresaId, {
                    page: 1,
                    limit: 5,
                    orderBy: 'criado_em DESC'
                })
            ]);

            const dashboard = {
                estatisticas_gerais: estatisticas,
                alertas: {
                    usuarios_inativos: usuariosInativos.slice(0, 10) // Top 10
                },
                usuarios_recentes: usuariosRecentes,
                timestamp: new Date().toISOString()
            };

            return this.sucessoResponse(
                res,
                dashboard,
                'Dashboard de usuários carregado'
            );

        } catch (error) {
            console.error('Erro ao carregar dashboard:', error);
            next(error);
        }
    }
}

module.exports = new UsuariosController();