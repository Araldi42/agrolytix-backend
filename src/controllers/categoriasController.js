/**
 * Controller de Categorias Refatorado
 * Gerencia categorias de tipos/produtos
 * Usa Repository Pattern com Model para abstração de dados
 */

const BaseController = require('./baseController');
const Categoria = require('../models/Categoria');
const ValidationService = require('../services/validationService');

class CategoriasController extends BaseController {
    constructor() {
        super('categorias', 'Categoria');
        this.categoriaModel = new Categoria();
    }

    /**
     * Listar categorias com contadores
     */
    async listar(req, res, next) {
        try {
            const empresaId = req.usuario.empresa_id;
            const { pagina, limite, offset } = this.obterParametrosPaginacao(req.query);

            const options = {
                search: req.query.search,
                page: pagina,
                limit: limite
            };

            const categorias = await this.categoriaModel.findAllWithCounts(empresaId, options);

            // Contar total para paginação
            const total = await this.categoriaModel.count({
                empresa_id: empresaId || null
            });

            return this.respostaPaginada(
                res,
                categorias,
                total,
                pagina,
                limite,
                'Categorias listadas com sucesso'
            );

        } catch (error) {
            console.error('Erro ao listar categorias:', error);
            next(error);
        }
    }

    /**
     * Buscar categoria por ID
     */
    async buscarPorId(req, res, next) {
        try {
            const { id } = req.params;
            const empresaId = req.usuario.empresa_id;

            const categoria = await this.categoriaModel.findByIdWithDetails(id, empresaId);

            if (!categoria) {
                return this.erroResponse(res, 'Categoria não encontrada', 404);
            }

            return this.sucessoResponse(res, categoria, 'Categoria encontrada');

        } catch (error) {
            console.error('Erro ao buscar categoria:', error);
            next(error);
        }
    }

    /**
     * Criar nova categoria
     */
    async criar(req, res, next) {
        try {
            const dadosLimpos = this.sanitizarDados(req.body, [
                'nome', 'descricao', 'cor', 'icone', 'categoria_pai_id'
            ]);

            // Definir empresa automaticamente se usuário não for admin sistema
            if (req.usuario.empresa_id) {
                dadosLimpos.empresa_id = req.usuario.empresa_id;
            }

            // Validações básicas
            const errosValidacao = this.categoriaModel.validate(dadosLimpos);
            if (errosValidacao.length > 0) {
                return this.erroResponse(res, 'Dados inválidos', 400, errosValidacao);
            }

            // Verificar se nome é único
            const isUnique = await this.categoriaModel.isNomeUnique(
                dadosLimpos.nome,
                dadosLimpos.empresa_id
            );

            if (!isUnique) {
                return this.erroResponse(res, 'Já existe uma categoria com este nome', 409);
            }

            // Criar categoria
            dadosLimpos.criado_por = req.usuario.id;
            const categoria = await this.categoriaModel.create(dadosLimpos);

            // Buscar categoria criada com detalhes
            const categoriaCriada = await this.categoriaModel.findByIdWithDetails(
                categoria.id,
                dadosLimpos.empresa_id
            );

            // Log de auditoria
            await this.logarAuditoria(
                req.usuario.id,
                'CREATE',
                'categorias',
                categoria.id,
                null,
                categoriaCriada
            );

            return this.sucessoResponse(
                res,
                categoriaCriada,
                'Categoria criada com sucesso',
                201
            );

        } catch (error) {
            console.error('Erro ao criar categoria:', error);
            next(error);
        }
    }

    /**
     * Atualizar categoria
     */
    async atualizar(req, res, next) {
        try {
            const { id } = req.params;
            const empresaId = req.usuario.empresa_id;

            // Buscar categoria atual
            const categoriaAtual = await this.categoriaModel.findByIdWithDetails(id, empresaId);
            if (!categoriaAtual) {
                return this.erroResponse(res, 'Categoria não encontrada', 404);
            }

            const dadosLimpos = this.sanitizarDados(req.body, [
                'nome', 'descricao'
            ]);

            // Validações básicas
            const dadosCompletos = { ...categoriaAtual, ...dadosLimpos };
            const errosValidacao = this.categoriaModel.validate(dadosCompletos);
            if (errosValidacao.length > 0) {
                return this.erroResponse(res, 'Dados inválidos', 400, errosValidacao);
            }

            // Verificar nome único (se alterado)
            if (dadosLimpos.nome && dadosLimpos.nome !== categoriaAtual.nome) {
                const isUnique = await this.categoriaModel.isNomeUnique(
                    dadosLimpos.nome,
                    categoriaAtual.empresa_id,
                    id
                );

                if (!isUnique) {
                    return this.erroResponse(res, 'Já existe outra categoria com este nome', 409);
                }
            }

            // Atualizar categoria
            dadosLimpos.atualizado_por = req.usuario.id;
            await this.categoriaModel.update(id, dadosLimpos);

            // Buscar categoria atualizada
            const categoriaAtualizada = await this.categoriaModel.findByIdWithDetails(
                id,
                empresaId
            );

            // Log de auditoria
            await this.logarAuditoria(
                req.usuario.id,
                'UPDATE',
                'categorias',
                id,
                categoriaAtual,
                categoriaAtualizada
            );

            return this.sucessoResponse(
                res,
                categoriaAtualizada,
                'Categoria atualizada com sucesso'
            );

        } catch (error) {
            console.error('Erro ao atualizar categoria:', error);
            next(error);
        }
    }

    /**
     * Excluir categoria (soft delete)
     */
    async excluir(req, res, next) {
        try {
            const { id } = req.params;
            const empresaId = req.usuario.empresa_id;

            // Buscar categoria
            const categoria = await this.categoriaModel.findByIdWithDetails(id, empresaId);
            if (!categoria) {
                return this.erroResponse(res, 'Categoria não encontrada', 404);
            }

            // Verificar se pode ser excluída
            const canDelete = await this.categoriaModel.canDelete(id);
            if (!canDelete) {
                return this.erroResponse(
                    res,
                    'Esta categoria possui tipos vinculados e não pode ser excluída',
                    409
                );
            }

            // Soft delete
            await this.categoriaModel.softDelete(id, req.usuario.id);

            // Log de auditoria
            await this.logarAuditoria(
                req.usuario.id,
                'DELETE',
                'categorias',
                id,
                categoria,
                null
            );

            return this.sucessoResponse(res, null, 'Categoria excluída com sucesso');

        } catch (error) {
            console.error('Erro ao excluir categoria:', error);
            next(error);
        }
    }

    /**
     * Buscar tipos de uma categoria
     */
    async buscarTipos(req, res, next) {
        try {
            const { id } = req.params;
            const empresaId = req.usuario.empresa_id;

            // Verificar se categoria existe
            const categoria = await this.categoriaModel.findByIdWithDetails(id, empresaId);
            if (!categoria) {
                return this.erroResponse(res, 'Categoria não encontrada', 404);
            }

            const tipos = await this.categoriaModel.getTipos(id, empresaId);

            return this.sucessoResponse(
                res,
                tipos,
                'Tipos da categoria listados'
            );

        } catch (error) {
            console.error('Erro ao buscar tipos da categoria:', error);
            next(error);
        }
    }

    /**
     * Buscar categorias mais utilizadas
     */
    async maisUtilizadas(req, res, next) {
        try {
            const empresaId = req.usuario.empresa_id;
            const limite = parseInt(req.query.limite) || 10;

            const categorias = await this.categoriaModel.findMostUsed(empresaId, limite);

            return this.sucessoResponse(
                res,
                categorias,
                'Categorias mais utilizadas listadas'
            );

        } catch (error) {
            console.error('Erro ao buscar categorias mais utilizadas:', error);
            next(error);
        }
    }

    /**
     * Reordenar categorias
     */
    async reordenar(req, res, next) {
        try {
            return this.erroResponse(
                res, 
                'Funcionalidade de reordenação não implementada. A tabela categorias não possui campo ordem.',
                501
            );

        } catch (error) {
            console.error('Erro ao reordenar categorias:', error);
            next(error);
        }
    }

    /**
     * Obter estatísticas das categorias
     */
    async estatisticas(req, res, next) {
        try {
            const empresaId = req.usuario.empresa_id;

            const estatisticas = await this.categoriaModel.getEstatisticas(empresaId);

            return this.sucessoResponse(
                res,
                estatisticas,
                'Estatísticas das categorias obtidas'
            );

        } catch (error) {
            console.error('Erro ao obter estatísticas:', error);
            next(error);
        }
    }

    /**
     * Dashboard de categorias - resumo executivo
     */
    async dashboard(req, res, next) {
        try {
            const empresaId = req.usuario.empresa_id;

            // Buscar dados em paralelo para performance
            const [
                estatisticas,
                maisUtilizadas,
                todasCategorias
            ] = await Promise.all([
                this.categoriaModel.getEstatisticas(empresaId),
                this.categoriaModel.findMostUsed(empresaId, 5),
                this.categoriaModel.findAllWithCounts(empresaId, { limit: 10 })
            ]);

            const dashboard = {
                estatisticas_gerais: estatisticas,
                mais_utilizadas: maisUtilizadas,
                categorias_recentes: todasCategorias,
                timestamp: new Date().toISOString()
            };

            return this.sucessoResponse(
                res,
                dashboard,
                'Dashboard de categorias carregado'
            );

        } catch (error) {
            console.error('Erro ao carregar dashboard:', error);
            next(error);
        }
    }

    /**
     * Buscar categorias globais (disponíveis para todas as empresas)
     */
    async globais(req, res, next) {
        try {
            // Apenas admin sistema pode ver categorias globais
            if (req.usuario.nivel_hierarquia > 1) {
                return this.erroResponse(res, 'Acesso negado', 403);
            }

            const options = {
                search: req.query.search,
                page: parseInt(req.query.page) || 1,
                limit: parseInt(req.query.limit) || 20
            };

            const categorias = await this.categoriaModel.findAllWithCounts(null, options);

            return this.sucessoResponse(
                res,
                categorias,
                'Categorias globais listadas'
            );

        } catch (error) {
            console.error('Erro ao buscar categorias globais:', error);
            next(error);
        }
    }

    /**
     * Criar categoria global (apenas admin sistema)
     */
    async criarGlobal(req, res, next) {
        try {
            // Apenas admin sistema pode criar categorias globais
            if (req.usuario.nivel_hierarquia > 1) {
                return this.erroResponse(res, 'Acesso negado', 403);
            }

            const dadosLimpos = this.sanitizarDados(req.body, [
                'nome', 'descricao', 'cor', 'icone', 'categoria_pai_id'
            ]);

            // Categoria global não tem empresa_id
            dadosLimpos.empresa_id = null;

            // Validações básicas
            const errosValidacao = this.categoriaModel.validate(dadosLimpos);
            if (errosValidacao.length > 0) {
                return this.erroResponse(res, 'Dados inválidos', 400, errosValidacao);
            }

            // Verificar se nome é único entre categorias globais
            const isUnique = await this.categoriaModel.isNomeUnique(
                dadosLimpos.nome,
                null
            );

            if (!isUnique) {
                return this.erroResponse(res, 'Já existe uma categoria global com este nome', 409);
            }

            // Criar categoria
            dadosLimpos.criado_por = req.usuario.id;
            const categoria = await this.categoriaModel.create(dadosLimpos);

            // Buscar categoria criada com detalhes
            const categoriaCriada = await this.categoriaModel.findByIdWithDetails(
                categoria.id,
                null
            );

            // Log de auditoria
            await this.logarAuditoria(
                req.usuario.id,
                'CREATE_GLOBAL',
                'categorias',
                categoria.id,
                null,
                categoriaCriada
            );

            return this.sucessoResponse(
                res,
                categoriaCriada,
                'Categoria global criada com sucesso',
                201
            );

        } catch (error) {
            console.error('Erro ao criar categoria global:', error);
            next(error);
        }
    }
}

module.exports = new CategoriasController();