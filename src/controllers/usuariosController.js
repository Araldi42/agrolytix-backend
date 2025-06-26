/**
 * Controller de Usuários - VERSÃO CORRIGIDA
 * Resposta padronizada e consistente
 */

const Usuario = require('../models/Usuario');
const ValidationService = require('../services/validationService');
const { sucessoResponse, respostaPaginada, erroResponse } = require('../utils/responseUtils');

class UsuariosController {
    constructor() {
        this.usuarioModel = new Usuario();
    }

    /**
     * Listar usuários da empresa
     */
    async listar(req, res, next) {
        try {
            console.log('🎯 Controller listar - Usuário:', req.usuario?.nome);
            console.log('🎯 Empresa ID:', req.usuario?.empresa_id);

            const empresaId = req.usuario.empresa_id;

            if (!empresaId) {
                return erroResponse(res, 'Acesso negado - empresa não identificada', 403);
            }

            const options = {
                search: req.query.search,
                perfil_id: req.query.perfil_id,
                ativo: req.query.ativo !== 'false',
                page: parseInt(req.query.page) || 1,
                limit: Math.min(parseInt(req.query.limit) || 20, 100)
            };

            console.log('🎯 Options:', options);

            const usuarios = await this.usuarioModel.findByEmpresa(empresaId, options);

            // Contar total para paginação
            const total = await this.usuarioModel.count({
                empresa_id: empresaId,
                ativo: options.ativo
            });

            console.log('🎯 Usuários encontrados:', usuarios.length);
            console.log('🎯 Total:', total);

            return respostaPaginada(
                res,
                usuarios,
                total,
                options.page,
                options.limit,
                'Usuários listados com sucesso'
            );

        } catch (error) {
            console.error('❌ Erro ao listar usuários:', error);
            return erroResponse(res, 'Erro interno do servidor', 500);
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
                return erroResponse(res, 'Sem permissão para acessar este usuário', 403);
            }

            const usuario = await this.usuarioModel.findByIdWithDetails(id, empresaId);

            if (!usuario) {
                return erroResponse(res, 'Usuário não encontrado', 404);
            }

            return sucessoResponse(
                res,
                usuario,
                'Usuário encontrado com sucesso'
            );

        } catch (error) {
            console.error('❌ Erro ao buscar usuário:', error);
            return erroResponse(res, 'Erro interno do servidor', 500);
        }
    }

    /**
     * Criar novo usuário
     */
    async criar(req, res, next) {
        try {
            const { senha, confirmar_senha, fazendas_ids, ...dadosUsuario } = req.body;
            const empresaId = req.usuario.empresa_id;

            // Verificar permissões
            if (req.usuario.nivel_hierarquia > 3) {
                return erroResponse(res, 'Sem permissão para criar usuários', 403);
            }

            // Validar dados básicos
            const validationErrors = this.usuarioModel.validate(dadosUsuario);
            if (validationErrors.length > 0) {
                return erroResponse(res, 'Dados inválidos', 400, validationErrors);
            }

            // Validar senha
            if (!senha || senha.length < 6) {
                return erroResponse(res, 'Senha deve ter pelo menos 6 caracteres', 400);
            }

            if (senha !== confirmar_senha) {
                return erroResponse(res, 'Confirmação de senha não confere', 400);
            }

            // Verificar unicidade
            const loginUnico = await this.usuarioModel.isLoginUnique(dadosUsuario.login);
            if (!loginUnico) {
                return erroResponse(res, 'Login já está em uso', 409);
            }

            const emailUnico = await this.usuarioModel.isEmailUnique(dadosUsuario.email);
            if (!emailUnico) {
                return erroResponse(res, 'Email já está em uso', 409);
            }

            // Definir empresa e criador
            dadosUsuario.empresa_id = empresaId;
            dadosUsuario.criado_por = req.usuario.id;
            dadosUsuario.fazendas_ids = fazendas_ids;

            // Criar usuário
            const novoUsuario = await this.usuarioModel.createWithPassword(dadosUsuario, senha);

            return sucessoResponse(
                res,
                novoUsuario,
                'Usuário criado com sucesso',
                201
            );

        } catch (error) {
            console.error('❌ Erro ao criar usuário:', error);
            return erroResponse(res, 'Erro interno do servidor', 500);
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

            // Verificar se pode editar
            if (req.usuario.nivel_hierarquia > 3 && req.usuario.id !== parseInt(id)) {
                return erroResponse(res, 'Sem permissão para editar este usuário', 403);
            }

            // Buscar usuário existente
            const usuarioExistente = await this.usuarioModel.findByIdWithDetails(id, empresaId);
            if (!usuarioExistente) {
                return erroResponse(res, 'Usuário não encontrado', 404);
            }

            // Validar dados
            const validationErrors = this.usuarioModel.validate(dadosUsuario);
            if (validationErrors.length > 0) {
                return erroResponse(res, 'Dados inválidos', 400, validationErrors);
            }

            // Verificar unicidade se alterado
            if (dadosUsuario.login && dadosUsuario.login !== usuarioExistente.login) {
                const loginUnico = await this.usuarioModel.isLoginUnique(dadosUsuario.login, id);
                if (!loginUnico) {
                    return erroResponse(res, 'Login já está em uso', 409);
                }
            }

            if (dadosUsuario.email && dadosUsuario.email !== usuarioExistente.email) {
                const emailUnico = await this.usuarioModel.isEmailUnique(dadosUsuario.email, id);
                if (!emailUnico) {
                    return erroResponse(res, 'Email já está em uso', 409);
                }
            }

            // Atualizar usuário
            const usuarioAtualizado = await this.usuarioModel.update(id, dadosUsuario);

            // Atualizar fazendas se fornecido
            if (fazendas_ids !== undefined) {
                await this.usuarioModel.updateFazendasAccess(id, fazendas_ids);
            }

            // Buscar usuário completo atualizado
            const usuarioCompleto = await this.usuarioModel.findByIdWithDetails(id, empresaId);

            return sucessoResponse(
                res,
                usuarioCompleto,
                'Usuário atualizado com sucesso'
            );

        } catch (error) {
            console.error('❌ Erro ao atualizar usuário:', error);
            return erroResponse(res, 'Erro interno do servidor', 500);
        }
    }

    /**
     * Inativar usuário
     */
    async inativar(req, res, next) {
        try {
            const { id } = req.params;
            const empresaId = req.usuario.empresa_id;

            if (req.usuario.nivel_hierarquia > 3) {
                return erroResponse(res, 'Sem permissão para inativar usuários', 403);
            }

            if (req.usuario.id === parseInt(id)) {
                return erroResponse(res, 'Não é possível inativar seu próprio usuário', 400);
            }

            const usuario = await this.usuarioModel.findByIdWithDetails(id, empresaId);
            if (!usuario) {
                return erroResponse(res, 'Usuário não encontrado', 404);
            }

            await this.usuarioModel.update(id, { ativo: false });

            return sucessoResponse(
                res,
                { id: parseInt(id), ativo: false },
                'Usuário inativado com sucesso'
            );

        } catch (error) {
            console.error('❌ Erro ao inativar usuário:', error);
            return erroResponse(res, 'Erro interno do servidor', 500);
        }
    }

    /**
     * Reativar usuário
     */
    async reativar(req, res, next) {
        try {
            const { id } = req.params;
            const empresaId = req.usuario.empresa_id;

            if (req.usuario.nivel_hierarquia > 3) {
                return erroResponse(res, 'Sem permissão para reativar usuários', 403);
            }

            const usuario = await this.usuarioModel.findByIdWithDetails(id, empresaId);
            if (!usuario) {
                return erroResponse(res, 'Usuário não encontrado', 404);
            }

            await this.usuarioModel.update(id, { ativo: true });

            return sucessoResponse(
                res,
                { id: parseInt(id), ativo: true },
                'Usuário reativado com sucesso'
            );

        } catch (error) {
            console.error('❌ Erro ao reativar usuário:', error);
            return erroResponse(res, 'Erro interno do servidor', 500);
        }
    }

    /**
     * Alterar senha
     */
    async alterarSenha(req, res, next) {
        try {
            const { id } = req.params;
            const { senha_atual, nova_senha, confirmar_senha } = req.body;

            if (req.usuario.id !== parseInt(id) && req.usuario.nivel_hierarquia > 2) {
                return erroResponse(res, 'Sem permissão para alterar senha deste usuário', 403);
            }

            if (!nova_senha || nova_senha.length < 6) {
                return erroResponse(res, 'Nova senha deve ter pelo menos 6 caracteres', 400);
            }

            if (nova_senha !== confirmar_senha) {
                return erroResponse(res, 'Confirmação de senha não confere', 400);
            }

            // Se for o próprio usuário, verificar senha atual
            if (req.usuario.id === parseInt(id)) {
                if (!senha_atual) {
                    return erroResponse(res, 'Senha atual é obrigatória', 400);
                }

                const senhaValida = await this.usuarioModel.verifyPassword(id, senha_atual);
                if (!senhaValida) {
                    return erroResponse(res, 'Senha atual incorreta', 400);
                }
            }

            const resultado = await this.usuarioModel.updatePassword(id, nova_senha);

            if (!resultado) {
                return erroResponse(res, 'Usuário não encontrado', 404);
            }

            return sucessoResponse(
                res,
                { mensagem: 'Senha alterada com sucesso' },
                'Senha alterada com sucesso'
            );

        } catch (error) {
            console.error('❌ Erro ao alterar senha:', error);
            return erroResponse(res, 'Erro interno do servidor', 500);
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
                return erroResponse(res, 'Acesso negado', 403);
            }

            const usuarios = await this.usuarioModel.findByPerfil(perfil_id, empresaId);

            return sucessoResponse(
                res,
                usuarios,
                'Usuários por perfil listados com sucesso'
            );

        } catch (error) {
            console.error('❌ Erro ao buscar usuários por perfil:', error);
            return erroResponse(res, 'Erro interno do servidor', 500);
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
                return erroResponse(res, 'Cargo é obrigatório', 400);
            }

            if (!empresaId) {
                return erroResponse(res, 'Acesso negado', 403);
            }

            const usuarios = await this.usuarioModel.findByCargo(cargo, empresaId);

            return sucessoResponse(
                res,
                usuarios,
                'Usuários por cargo listados com sucesso'
            );

        } catch (error) {
            console.error('❌ Erro ao buscar usuários por cargo:', error);
            return erroResponse(res, 'Erro interno do servidor', 500);
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
                return erroResponse(res, 'Acesso negado', 403);
            }

            if (req.usuario.nivel_hierarquia > 3) {
                return erroResponse(res, 'Sem permissão para visualizar usuários inativos', 403);
            }

            const usuarios = await this.usuarioModel.findInativosPorPeriodo(parseInt(dias), empresaId);

            return sucessoResponse(
                res,
                usuarios,
                `Usuários inativos há ${dias} dias listados com sucesso`
            );

        } catch (error) {
            console.error('❌ Erro ao buscar usuários inativos:', error);
            return erroResponse(res, 'Erro interno do servidor', 500);
        }
    }

    /**
     * Gerenciar fazendas
     */
    async gerenciarFazendas(req, res, next) {
        try {
            const { id } = req.params;
            const { fazendas_ids } = req.body;
            const empresaId = req.usuario.empresa_id;

            if (req.usuario.nivel_hierarquia > 3) {
                return erroResponse(res, 'Sem permissão para gerenciar acesso às fazendas', 403);
            }

            const usuario = await this.usuarioModel.findByIdWithDetails(id, empresaId);
            if (!usuario) {
                return erroResponse(res, 'Usuário não encontrado', 404);
            }

            if (!Array.isArray(fazendas_ids)) {
                return erroResponse(res, 'fazendas_ids deve ser um array', 400);
            }

            await this.usuarioModel.updateFazendasAccess(id, fazendas_ids);
            const fazendasAtualizadas = await this.usuarioModel.getFazendasAccess(id);

            return sucessoResponse(
                res,
                {
                    usuario_id: parseInt(id),
                    fazendas: fazendasAtualizadas
                },
                'Acesso às fazendas atualizado com sucesso'
            );

        } catch (error) {
            console.error('❌ Erro ao gerenciar fazendas:', error);
            return erroResponse(res, 'Erro interno do servidor', 500);
        }
    }

    /**
     * Buscar fazendas do usuário
     */
    async fazendasUsuario(req, res, next) {
        try {
            const { id } = req.params;
            const empresaId = req.usuario.empresa_id;

            if (req.usuario.nivel_hierarquia > 3 && req.usuario.id !== parseInt(id)) {
                return erroResponse(res, 'Sem permissão para acessar fazendas deste usuário', 403);
            }

            const usuario = await this.usuarioModel.findByIdWithDetails(id, empresaId);
            if (!usuario) {
                return erroResponse(res, 'Usuário não encontrado', 404);
            }

            const fazendas = await this.usuarioModel.getFazendasAccess(id);

            return sucessoResponse(
                res,
                fazendas,
                'Fazendas do usuário listadas com sucesso'
            );

        } catch (error) {
            console.error('❌ Erro ao buscar fazendas do usuário:', error);
            return erroResponse(res, 'Erro interno do servidor', 500);
        }
    }

    /**
     * Obter estatísticas
     */
    async estatisticas(req, res, next) {
        try {
            const empresaId = req.usuario.empresa_id;

            if (!empresaId) {
                return erroResponse(res, 'Acesso negado', 403);
            }

            if (req.usuario.nivel_hierarquia > 3) {
                return erroResponse(res, 'Sem permissão para visualizar estatísticas', 403);
            }

            const estatisticas = await this.usuarioModel.getEstatisticas(empresaId);

            return sucessoResponse(
                res,
                estatisticas,
                'Estatísticas de usuários obtidas com sucesso'
            );

        } catch (error) {
            console.error('❌ Erro ao obter estatísticas:', error);
            return erroResponse(res, 'Erro interno do servidor', 500);
        }
    }

    /**
     * Dashboard
     */
    async dashboard(req, res, next) {
        try {
            const empresaId = req.usuario.empresa_id;

            if (!empresaId) {
                return erroResponse(res, 'Acesso negado', 403);
            }

            if (req.usuario.nivel_hierarquia > 3) {
                return erroResponse(res, 'Sem permissão para visualizar dashboard', 403);
            }

            // Buscar dados em paralelo
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
                    usuarios_inativos: usuariosInativos.slice(0, 10)
                },
                usuarios_recentes: usuariosRecentes,
                timestamp: new Date().toISOString()
            };

            return sucessoResponse(
                res,
                dashboard,
                'Dashboard de usuários carregado com sucesso'
            );

        } catch (error) {
            console.error('❌ Erro ao carregar dashboard:', error);
            return erroResponse(res, 'Erro interno do servidor', 500);
        }
    }
}

module.exports = new UsuariosController();