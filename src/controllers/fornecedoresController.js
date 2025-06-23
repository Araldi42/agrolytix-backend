/**
 * Controller de Fornecedores Refatorado
 * Gerencia fornecedores de produtos/serviços
 * Usa Repository Pattern com Model para abstração de dados
 */

const BaseController = require('./baseController');
const Fornecedor = require('../models/Fornecedor');
const ValidationService = require('../services/validationService');

class FornecedoresController extends BaseController {
    constructor() {
        super('fornecedores', 'Fornecedor');
        this.fornecedorModel = new Fornecedor();
    }

    /**
     * Listar fornecedores com estatísticas
     */
    async listar(req, res, next) {
        try {
            const empresaId = req.usuario.empresa_id;
            const { pagina, limite, offset } = this.obterParametrosPaginacao(req.query);

            const options = {
                search: req.query.search,
                tipo_pessoa: req.query.tipo_pessoa,
                ativo_fornecedor: req.query.ativo !== 'false', // default true
                page: pagina,
                limit: limite
            };

            const fornecedores = await this.fornecedorModel.findByEmpresa(empresaId, options);

            // Contar total para paginação
            const total = await this.fornecedorModel.count({
                empresa_id: empresaId || null,
                ativo: true
            });

            return this.respostaPaginada(
                res,
                fornecedores,
                total,
                pagina,
                limite,
                'Fornecedores listados com sucesso'
            );

        } catch (error) {
            console.error('Erro ao listar fornecedores:', error);
            next(error);
        }
    }

    /**
     * Buscar fornecedor por ID
     */
    async buscarPorId(req, res, next) {
        try {
            const { id } = req.params;
            const empresaId = req.usuario.empresa_id;

            const fornecedor = await this.fornecedorModel.findByIdWithDetails(id, empresaId);

            if (!fornecedor) {
                return this.erroResponse(res, 'Fornecedor não encontrado', 404);
            }

            // Formatar dados para exibição
            const fornecedorFormatado = this.fornecedorModel.format(fornecedor);

            return this.sucessoResponse(res, fornecedorFormatado, 'Fornecedor encontrado');

        } catch (error) {
            console.error('Erro ao buscar fornecedor:', error);
            next(error);
        }
    }

    /**
     * Criar novo fornecedor
     */
    async criar(req, res, next) {
        try {
            const dadosLimpos = this.sanitizarDados(req.body, [
                'nome', 'contato', 'endereco_completo', 'cidade', 'observacoes'
            ]);

            // Definir empresa automaticamente se usuário não for admin sistema
            if (req.usuario.empresa_id) {
                dadosLimpos.empresa_id = req.usuario.empresa_id;
            }

            // Validações básicas
            const errosValidacao = this.fornecedorModel.validate(dadosLimpos);
            if (errosValidacao.length > 0) {
                return this.erroResponse(res, 'Dados inválidos', 400, errosValidacao);
            }

            // Validações de negócio
            const errosNegocio = ValidationService.validarFornecedor(dadosLimpos);
            if (errosNegocio.length > 0) {
                return this.erroResponse(res, 'Validação de negócio falhou', 400, errosNegocio);
            }

            // Verificar CNPJ único (se fornecido)
            if (dadosLimpos.cnpj) {
                const isUnique = await this.fornecedorModel.isCNPJUnique(
                    dadosLimpos.cnpj,
                    dadosLimpos.empresa_id
                );

                if (!isUnique) {
                    return this.erroResponse(res, 'CNPJ já cadastrado', 409);
                }
            }

            // Verificar CPF único (se fornecido)
            if (dadosLimpos.cpf) {
                const isUnique = await this.fornecedorModel.isCPFUnique(
                    dadosLimpos.cpf,
                    dadosLimpos.empresa_id
                );

                if (!isUnique) {
                    return this.erroResponse(res, 'CPF já cadastrado', 409);
                }
            }

            // Verificar email único (se fornecido)
            if (dadosLimpos.email) {
                const isUnique = await this.fornecedorModel.isEmailUnique(
                    dadosLimpos.email,
                    dadosLimpos.empresa_id
                );

                if (!isUnique) {
                    return this.erroResponse(res, 'Email já cadastrado', 409);
                }
            }

            // Criar fornecedor
            dadosLimpos.criado_por = req.usuario.id;
            const fornecedor = await this.fornecedorModel.create(dadosLimpos);

            // Buscar fornecedor criado com detalhes
            const fornecedorCriado = await this.fornecedorModel.findByIdWithDetails(
                fornecedor.id,
                dadosLimpos.empresa_id
            );

            // Log de auditoria
            await this.logarAuditoria(
                req.usuario.id,
                'CREATE',
                'fornecedores',
                fornecedor.id,
                null,
                fornecedorCriado
            );

            return this.sucessoResponse(
                res,
                this.fornecedorModel.format(fornecedorCriado),
                'Fornecedor criado com sucesso',
                201
            );

        } catch (error) {
            console.error('Erro ao criar fornecedor:', error);
            next(error);
        }
    }

    /**
     * Atualizar fornecedor
     */
    async atualizar(req, res, next) {
        try {
            const { id } = req.params;
            const empresaId = req.usuario.empresa_id;

            // Buscar fornecedor atual
            const fornecedorAtual = await this.fornecedorModel.findByIdWithDetails(id, empresaId);
            if (!fornecedorAtual) {
                return this.erroResponse(res, 'Fornecedor não encontrado', 404);
            }

            const dadosLimpos = this.sanitizarDados(req.body, [
                'nome', 'contato', 'endereco_completo', 'cidade', 'observacoes'
            ]);

            // Validações básicas
            const dadosCompletos = { ...fornecedorAtual, ...dadosLimpos };
            const errosValidacao = this.fornecedorModel.validate(dadosCompletos);
            if (errosValidacao.length > 0) {
                return this.erroResponse(res, 'Dados inválidos', 400, errosValidacao);
            }

            // Verificar CNPJ único (se alterado)
            if (dadosLimpos.cnpj && dadosLimpos.cnpj !== fornecedorAtual.cnpj) {
                const isUnique = await this.fornecedorModel.isCNPJUnique(
                    dadosLimpos.cnpj,
                    fornecedorAtual.empresa_id,
                    id
                );

                if (!isUnique) {
                    return this.erroResponse(res, 'CNPJ já cadastrado', 409);
                }
            }

            // Verificar CPF único (se alterado)
            if (dadosLimpos.cpf && dadosLimpos.cpf !== fornecedorAtual.cpf) {
                const isUnique = await this.fornecedorModel.isCPFUnique(
                    dadosLimpos.cpf,
                    fornecedorAtual.empresa_id,
                    id
                );

                if (!isUnique) {
                    return this.erroResponse(res, 'CPF já cadastrado', 409);
                }
            }

            // Verificar email único (se alterado)
            if (dadosLimpos.email && dadosLimpos.email !== fornecedorAtual.email) {
                const isUnique = await this.fornecedorModel.isEmailUnique(
                    dadosLimpos.email,
                    fornecedorAtual.empresa_id,
                    id
                );

                if (!isUnique) {
                    return this.erroResponse(res, 'Email já cadastrado', 409);
                }
            }

            // Atualizar fornecedor
            dadosLimpos.atualizado_por = req.usuario.id;
            await this.fornecedorModel.update(id, dadosLimpos);

            // Buscar fornecedor atualizado
            const fornecedorAtualizado = await this.fornecedorModel.findByIdWithDetails(
                id,
                empresaId
            );

            // Log de auditoria
            await this.logarAuditoria(
                req.usuario.id,
                'UPDATE',
                'fornecedores',
                id,
                fornecedorAtual,
                fornecedorAtualizado
            );

            return this.sucessoResponse(
                res,
                this.fornecedorModel.format(fornecedorAtualizado),
                'Fornecedor atualizado com sucesso'
            );

        } catch (error) {
            console.error('Erro ao atualizar fornecedor:', error);
            next(error);
        }
    }

    /**
     * Excluir fornecedor (soft delete)
     */
    async excluir(req, res, next) {
        try {
            const { id } = req.params;
            const empresaId = req.usuario.empresa_id;

            // Buscar fornecedor
            const fornecedor = await this.fornecedorModel.findByIdWithDetails(id, empresaId);
            if (!fornecedor) {
                return this.erroResponse(res, 'Fornecedor não encontrado', 404);
            }

            // Verificar se pode ser excluído
            const canDelete = await this.fornecedorModel.canDelete(id);
            if (!canDelete) {
                return this.erroResponse(
                    res,
                    'Este fornecedor está vinculado a produtos ou movimentações e não pode ser excluído',
                    409
                );
            }

            // Soft delete
            await this.fornecedorModel.softDelete(id, req.usuario.id);

            // Log de auditoria
            await this.logarAuditoria(
                req.usuario.id,
                'DELETE',
                'fornecedores',
                id,
                fornecedor,
                null
            );

            return this.sucessoResponse(res, null, 'Fornecedor excluído com sucesso');

        } catch (error) {
            console.error('Erro ao excluir fornecedor:', error);
            next(error);
        }
    }

    /**
     * Buscar produtos do fornecedor
     */
    async produtos(req, res, next) {
        try {
            const { id } = req.params;
            const empresaId = req.usuario.empresa_id;

            // Verificar se fornecedor existe
            const fornecedor = await this.fornecedorModel.findByIdWithDetails(id, empresaId);
            if (!fornecedor) {
                return this.erroResponse(res, 'Fornecedor não encontrado', 404);
            }

            const options = {
                categoria_produto: req.query.categoria_produto,
                status: req.query.status || 'ativo',
                limit: parseInt(req.query.limit) || 50
            };

            const produtos = await this.fornecedorModel.getProdutos(id, options);

            return this.sucessoResponse(
                res,
                produtos,
                'Produtos do fornecedor listados'
            );

        } catch (error) {
            console.error('Erro ao buscar produtos do fornecedor:', error);
            next(error);
        }
    }

    /**
     * Buscar fornecedores mais utilizados
     */
    async maisUtilizados(req, res, next) {
        try {
            const empresaId = req.usuario.empresa_id;
            const limite = parseInt(req.query.limite) || 10;

            const fornecedores = await this.fornecedorModel.findMostUsed(empresaId, limite);

            return this.sucessoResponse(
                res,
                fornecedores,
                'Fornecedores mais utilizados listados'
            );

        } catch (error) {
            console.error('Erro ao buscar fornecedores mais utilizados:', error);
            next(error);
        }
    }

    /**
     * Buscar fornecedores por localização
     */
    async porLocalizacao(req, res, next) {
        try {
            const empresaId = req.usuario.empresa_id;
            const { estado, cidade } = req.query;

            const fornecedores = await this.fornecedorModel.findByLocalizacao(
                estado,
                cidade,
                empresaId
            );

            return this.sucessoResponse(
                res,
                fornecedores,
                'Fornecedores por localização listados'
            );

        } catch (error) {
            console.error('Erro ao buscar fornecedores por localização:', error);
            next(error);
        }
    }

    /**
     * Atualizar rating do fornecedor
     */
    async atualizarRating(req, res, next) {
        try {
            const { id } = req.params;
            const { rating, observacoes } = req.body;
            const empresaId = req.usuario.empresa_id;

            // Verificar se fornecedor existe
            const fornecedor = await this.fornecedorModel.findByIdWithDetails(id, empresaId);
            if (!fornecedor) {
                return this.erroResponse(res, 'Fornecedor não encontrado', 404);
            }

            // Validar rating
            if (!rating || rating < 0 || rating > 5) {
                return this.erroResponse(res, 'Rating deve estar entre 0 e 5', 400);
            }

            // Atualizar rating
            const resultado = await this.fornecedorModel.updateRating(id, rating, observacoes);

            if (!resultado) {
                return this.erroResponse(res, 'Erro ao atualizar rating', 500);
            }

            // Log de auditoria
            await this.logarAuditoria(
                req.usuario.id,
                'UPDATE_RATING',
                'fornecedores',
                id,
                { rating: fornecedor.rating },
                { rating, observacoes }
            );

            return this.sucessoResponse(
                res,
                resultado,
                'Rating atualizado com sucesso'
            );

        } catch (error) {
            console.error('Erro ao atualizar rating:', error);
            next(error);
        }
    }

    /**
     * Buscar fornecedores com rating baixo
     */
    async ratingBaixo(req, res, next) {
        try {
            const empresaId = req.usuario.empresa_id;
            const ratingMaximo = parseFloat(req.query.rating_maximo) || 2.5;

            const fornecedores = await this.fornecedorModel.findComRatingBaixo(
                empresaId,
                ratingMaximo
            );

            return this.sucessoResponse(
                res,
                fornecedores,
                `Fornecedores com rating até ${ratingMaximo} listados`
            );

        } catch (error) {
            console.error('Erro ao buscar fornecedores com rating baixo:', error);
            next(error);
        }
    }

    /**
     * Obter estatísticas dos fornecedores
     */
    async estatisticas(req, res, next) {
        try {
            const empresaId = req.usuario.empresa_id;

            const estatisticas = await this.fornecedorModel.getEstatisticas(empresaId);

            return this.sucessoResponse(
                res,
                estatisticas,
                'Estatísticas dos fornecedores obtidas'
            );

        } catch (error) {
            console.error('Erro ao obter estatísticas:', error);
            next(error);
        }
    }

    /**
     * Dashboard de fornecedores - resumo executivo
     */
    async dashboard(req, res, next) {
        try {
            const empresaId = req.usuario.empresa_id;

            // Buscar dados em paralelo para performance
            const [
                estatisticas,
                maisUtilizados,
                ratingBaixo
            ] = await Promise.all([
                this.fornecedorModel.getEstatisticas(empresaId),
                this.fornecedorModel.findMostUsed(empresaId, 5),
                this.fornecedorModel.findComRatingBaixo(empresaId, 2.5)
            ]);

            const dashboard = {
                estatisticas_gerais: estatisticas,
                mais_utilizados: maisUtilizados,
                alertas: {
                    rating_baixo: ratingBaixo.slice(0, 5) // Top 5 com rating baixo
                },
                timestamp: new Date().toISOString()
            };

            return this.sucessoResponse(
                res,
                dashboard,
                'Dashboard de fornecedores carregado'
            );

        } catch (error) {
            console.error('Erro ao carregar dashboard:', error);
            next(error);
        }
    }

    /**
     * Buscar fornecedores globais (disponíveis para todas as empresas)
     */
    async globais(req, res, next) {
        try {
            const { pagina, limite, offset } = this.obterParametrosPaginacao(req.query);

            const options = {
                search: req.query.search,
                tipo_pessoa: req.query.tipo_pessoa,
                ativo_fornecedor: true,
                page: pagina,
                limit: limite
            };

            // Buscar fornecedores globais (empresa_id = null)
            const fornecedores = await this.fornecedorModel.findByEmpresa(null, options);

            return this.sucessoResponse(
                res,
                fornecedores,
                'Fornecedores globais listados'
            );

        } catch (error) {
            console.error('Erro ao buscar fornecedores globais:', error);
            next(error);
        }
    }

    /**
     * Criar fornecedor global (apenas admin sistema)
     */
    async criarGlobal(req, res, next) {
        try {
            // Apenas admin sistema pode criar fornecedores globais
            if (req.usuario.nivel_hierarquia > 1) {
                return this.erroResponse(res, 'Acesso negado', 403);
            }

            const dadosLimpos = this.sanitizarDados(req.body, [
                'nome', 'contato', 'endereco_completo', 'cidade', 'observacoes'
            ]);

            // Fornecedor global não tem empresa_id
            dadosLimpos.empresa_id = null;

            // Validações básicas
            const errosValidacao = this.fornecedorModel.validate(dadosLimpos);
            if (errosValidacao.length > 0) {
                return this.erroResponse(res, 'Dados inválidos', 400, errosValidacao);
            }

            // Verificar unicidade global
            if (dadosLimpos.cnpj) {
                const isUnique = await this.fornecedorModel.isCNPJUnique(dadosLimpos.cnpj, null);
                if (!isUnique) {
                    return this.erroResponse(res, 'CNPJ já cadastrado globalmente', 409);
                }
            }

            // Criar fornecedor global
            dadosLimpos.criado_por = req.usuario.id;
            const fornecedor = await this.fornecedorModel.create(dadosLimpos);

            // Buscar fornecedor criado com detalhes
            const fornecedorCriado = await this.fornecedorModel.findByIdWithDetails(
                fornecedor.id,
                null
            );

            // Log de auditoria
            await this.logarAuditoria(
                req.usuario.id,
                'CREATE_GLOBAL',
                'fornecedores',
                fornecedor.id,
                null,
                fornecedorCriado
            );

            return this.sucessoResponse(
                res,
                this.fornecedorModel.format(fornecedorCriado),
                'Fornecedor global criado com sucesso',
                201
            );

        } catch (error) {
            console.error('Erro ao criar fornecedor global:', error);
            next(error);
        }
    }
}

module.exports = new FornecedoresController();