/**
 * Controller de Tipos Refatorado
 * Gerencia tipos de produtos/categorias
 * Usa Repository Pattern com Model para abstração de dados
 */

const BaseController = require('./baseController');
const Tipo = require('../models/Tipo');
const ValidationService = require('../services/validationService');

class TiposController extends BaseController {
    constructor() {
        super('tipos', 'Tipo');
        this.tipoModel = new Tipo();
    }

    /**
     * Listar tipos com relacionamentos
     */
    async listar(req, res, next) {
        try {
            const empresaId = req.usuario.empresa_id;
            const { pagina, limite, offset } = this.obterParametrosPaginacao(req.query);

            const options = {
                search: req.query.search,
                categoria_id: req.query.categoria_id,
                page: pagina,
                limit: limite
            };

            const tipos = await this.tipoModel.findAllWithRelations(empresaId, options);

            // Contar total para paginação
            const total = await this.tipoModel.count({
                empresa_id: empresaId || null,
                ativo: true
            });

            return this.respostaPaginada(
                res,
                tipos,
                total,
                pagina,
                limite,
                'Tipos listados com sucesso'
            );

        } catch (error) {
            console.error('Erro ao listar tipos:', error);
            next(error);
        }
    }

    /**
     * Buscar tipo por ID
     */
    async buscarPorId(req, res, next) {
        try {
            const { id } = req.params;
            const empresaId = req.usuario.empresa_id;

            const tipo = await this.tipoModel.findByIdWithDetails(id, empresaId);

            if (!tipo) {
                return this.erroResponse(res, 'Tipo não encontrado', 404);
            }

            return this.sucessoResponse(res, tipo, 'Tipo encontrado');

        } catch (error) {
            console.error('Erro ao buscar tipo:', error);
            next(error);
        }
    }

    /**
     * Criar novo tipo
     */
    async criar(req, res, next) {
        try {
            const dadosLimpos = this.sanitizarDados(req.body, [
                'nome', 'descricao', 'unidade_medida'
            ]);

            // Definir empresa automaticamente se usuário não for admin sistema
            if (req.usuario.empresa_id) {
                dadosLimpos.empresa_id = req.usuario.empresa_id;
            }

            // Validações básicas
            const errosValidacao = this.tipoModel.validate(dadosLimpos);
            if (errosValidacao.length > 0) {
                return this.erroResponse(res, 'Dados inválidos', 400, errosValidacao);
            }

            // Verificar se categoria existe e está ativa
            const categoriaValida = await ValidationService.verificarCategoriaExistente(
                dadosLimpos.categoria_id,
                dadosLimpos.empresa_id
            );

            if (!categoriaValida) {
                return this.erroResponse(res, 'Categoria não encontrada ou inativa', 404);
            }

            // Verificar se nome é único na categoria
            const isUnique = await this.tipoModel.isNomeUniqueInCategoria(
                dadosLimpos.nome,
                dadosLimpos.categoria_id,
                dadosLimpos.empresa_id
            );

            if (!isUnique) {
                return this.erroResponse(res, 'Já existe um tipo com este nome nesta categoria', 409);
            }

            // Criar tipo
            dadosLimpos.criado_por = req.usuario.id;
            const tipo = await this.tipoModel.create(dadosLimpos);

            // Buscar tipo criado com detalhes
            const tipoCriado = await this.tipoModel.findByIdWithDetails(
                tipo.id,
                dadosLimpos.empresa_id
            );

            // Log de auditoria
            await this.logarAuditoria(
                req.usuario.id,
                'CREATE',
                'tipos',
                tipo.id,
                null,
                tipoCriado
            );

            return this.sucessoResponse(
                res,
                tipoCriado,
                'Tipo criado com sucesso',
                201
            );

        } catch (error) {
            console.error('Erro ao criar tipo:', error);
            next(error);
        }
    }

    /**
     * Atualizar tipo
     */
    async atualizar(req, res, next) {
        try {
            const { id } = req.params;
            const empresaId = req.usuario.empresa_id;

            // Buscar tipo atual
            const tipoAtual = await this.tipoModel.findByIdWithDetails(id, empresaId);
            if (!tipoAtual) {
                return this.erroResponse(res, 'Tipo não encontrado', 404);
            }

            const dadosLimpos = this.sanitizarDados(req.body, [
                'nome', 'descricao', 'unidade_medida'
            ]);

            // Validações básicas
            const dadosCompletos = { ...tipoAtual, ...dadosLimpos };
            const errosValidacao = this.tipoModel.validate(dadosCompletos);
            if (errosValidacao.length > 0) {
                return this.erroResponse(res, 'Dados inválidos', 400, errosValidacao);
            }

            // Verificar categoria (se alterada)
            if (dadosLimpos.categoria_id && dadosLimpos.categoria_id !== tipoAtual.categoria_id) {
                const categoriaValida = await ValidationService.verificarCategoriaExistente(
                    dadosLimpos.categoria_id,
                    tipoAtual.empresa_id
                );

                if (!categoriaValida) {
                    return this.erroResponse(res, 'Categoria não encontrada ou inativa', 404);
                }
            }

            // Verificar nome único na categoria (se nome ou categoria alterados)
            if ((dadosLimpos.nome && dadosLimpos.nome !== tipoAtual.nome) ||
                (dadosLimpos.categoria_id && dadosLimpos.categoria_id !== tipoAtual.categoria_id)) {

                const categoriaId = dadosLimpos.categoria_id || tipoAtual.categoria_id;
                const nome = dadosLimpos.nome || tipoAtual.nome;

                const isUnique = await this.tipoModel.isNomeUniqueInCategoria(
                    nome,
                    categoriaId,
                    tipoAtual.empresa_id,
                    id
                );

                if (!isUnique) {
                    return this.erroResponse(res, 'Já existe outro tipo com este nome nesta categoria', 409);
                }
            }

            // Atualizar tipo
            dadosLimpos.atualizado_por = req.usuario.id;
            await this.tipoModel.update(id, dadosLimpos);

            // Buscar tipo atualizado
            const tipoAtualizado = await this.tipoModel.findByIdWithDetails(
                id,
                empresaId
            );

            // Log de auditoria
            await this.logarAuditoria(
                req.usuario.id,
                'UPDATE',
                'tipos',
                id,
                tipoAtual,
                tipoAtualizado
            );

            return this.sucessoResponse(
                res,
                tipoAtualizado,
                'Tipo atualizado com sucesso'
            );

        } catch (error) {
            console.error('Erro ao atualizar tipo:', error);
            next(error);
        }
    }

    /**
     * Excluir tipo (soft delete)
     */
    async excluir(req, res, next) {
        try {
            const { id } = req.params;
            const empresaId = req.usuario.empresa_id;

            // Buscar tipo
            const tipo = await this.tipoModel.findByIdWithDetails(id, empresaId);
            if (!tipo) {
                return this.erroResponse(res, 'Tipo não encontrado', 404);
            }

            // Verificar se pode ser excluído
            const canDelete = await this.tipoModel.canDelete(id);
            if (!canDelete) {
                return this.erroResponse(
                    res,
                    'Este tipo está em uso em produtos e não pode ser excluído',
                    409
                );
            }

            // Soft delete
            await this.tipoModel.softDelete(id, req.usuario.id);

            // Log de auditoria
            await this.logarAuditoria(
                req.usuario.id,
                'DELETE',
                'tipos',
                id,
                tipo,
                null
            );

            return this.sucessoResponse(res, null, 'Tipo excluído com sucesso');

        } catch (error) {
            console.error('Erro ao excluir tipo:', error);
            next(error);
        }
    }

    /**
     * Buscar tipos por categoria
     */
    async porCategoria(req, res, next) {
        try {
            const { categoria_id } = req.params;
            const empresaId = req.usuario.empresa_id;

            const options = {
                search: req.query.search,
                page: parseInt(req.query.page) || 1,
                limit: Math.min(parseInt(req.query.limit) || 50, 100)
            };

            const tipos = await this.tipoModel.findByCategoria(categoria_id, empresaId, options);

            return this.sucessoResponse(
                res,
                tipos,
                'Tipos da categoria listados'
            );

        } catch (error) {
            console.error('Erro ao buscar tipos por categoria:', error);
            next(error);
        }
    }

    /**
     * Buscar produtos do tipo
     */
    async produtos(req, res, next) {
        try {
            const { id } = req.params;
            const empresaId = req.usuario.empresa_id;

            // Verificar se tipo existe
            const tipo = await this.tipoModel.findByIdWithDetails(id, empresaId);
            if (!tipo) {
                return this.erroResponse(res, 'Tipo não encontrado', 404);
            }

            const options = {
                status: req.query.status || 'ativo',
                categoria_produto: req.query.categoria_produto,
                limit: parseInt(req.query.limit) || 50
            };

            const produtos = await this.tipoModel.getProdutos(id, options);

            return this.sucessoResponse(
                res,
                produtos,
                'Produtos do tipo listados'
            );

        } catch (error) {
            console.error('Erro ao buscar produtos do tipo:', error);
            next(error);
        }
    }

    /**
     * Buscar tipos mais utilizados
     */
    async maisUtilizados(req, res, next) {
        try {
            const empresaId = req.usuario.empresa_id;
            const limite = parseInt(req.query.limite) || 10;

            const tipos = await this.tipoModel.findMostUsed(empresaId, limite);

            return this.sucessoResponse(
                res,
                tipos,
                'Tipos mais utilizados listados'
            );

        } catch (error) {
            console.error('Erro ao buscar tipos mais utilizados:', error);
            next(error);
        }
    }

    /**
     * Buscar tipos com estoque baixo
     */
    async estoqueBaixo(req, res, next) {
        try {
            const empresaId = req.usuario.empresa_id;

            if (!empresaId) {
                return this.erroResponse(res, 'Acesso negado', 403);
            }

            const tipos = await this.tipoModel.findComEstoqueBaixo(empresaId);

            return this.sucessoResponse(
                res,
                tipos,
                'Tipos com estoque baixo listados'
            );

        } catch (error) {
            console.error('Erro ao buscar tipos com estoque baixo:', error);
            next(error);
        }
    }

    /**
     * Buscar unidades de medida disponíveis
     */
    async unidadesMedida(req, res, next) {
        try {
            const empresaId = req.usuario.empresa_id;

            const unidades = await this.tipoModel.getUnidadesMedida(empresaId);

            return this.sucessoResponse(
                res,
                unidades,
                'Unidades de medida listadas'
            );

        } catch (error) {
            console.error('Erro ao buscar unidades de medida:', error);
            next(error);
        }
    }

    /**
     * Obter estatísticas dos tipos
     */
    async estatisticas(req, res, next) {
        try {
            const empresaId = req.usuario.empresa_id;

            const estatisticas = await this.tipoModel.getEstatisticas(empresaId);

            return this.sucessoResponse(
                res,
                estatisticas,
                'Estatísticas dos tipos obtidas'
            );

        } catch (error) {
            console.error('Erro ao obter estatísticas:', error);
            next(error);
        }
    }

    /**
     * Dashboard de tipos - resumo executivo
     */
    async dashboard(req, res, next) {
        try {
            const empresaId = req.usuario.empresa_id;

            // Buscar dados em paralelo para performance
            const [
                estatisticas,
                maisUtilizados,
                estoqueBaixo,
                unidadesMedida
            ] = await Promise.all([
                this.tipoModel.getEstatisticas(empresaId),
                this.tipoModel.findMostUsed(empresaId, 5),
                this.tipoModel.findComEstoqueBaixo(empresaId),
                this.tipoModel.getUnidadesMedida(empresaId)
            ]);

            const dashboard = {
                estatisticas_gerais: estatisticas,
                mais_utilizados: maisUtilizados,
                alertas: {
                    estoque_baixo: estoqueBaixo.slice(0, 5) // Top 5 com estoque baixo
                },
                unidades_medida: unidadesMedida,
                timestamp: new Date().toISOString()
            };

            return this.sucessoResponse(
                res,
                dashboard,
                'Dashboard de tipos carregado'
            );

        } catch (error) {
            console.error('Erro ao carregar dashboard:', error);
            next(error);
        }
    }

    /**
     * Buscar tipos globais (disponíveis para todas as empresas)
     */
    async globais(req, res, next) {
        try {
            const options = {
                search: req.query.search,
                categoria_id: req.query.categoria_id,
                page: parseInt(req.query.page) || 1,
                limit: parseInt(req.query.limit) || 50
            };

            // Buscar tipos globais (empresa_id = null)
            const tipos = await this.tipoModel.findAllWithRelations(null, options);

            return this.sucessoResponse(
                res,
                tipos,
                'Tipos globais listados'
            );

        } catch (error) {
            console.error('Erro ao buscar tipos globais:', error);
            next(error);
        }
    }

    /**
     * Criar tipo global (apenas admin sistema)
     */
    async criarGlobal(req, res, next) {
        try {
            // Apenas admin sistema pode criar tipos globais
            if (req.usuario.nivel_hierarquia > 1) {
                return this.erroResponse(res, 'Acesso negado', 403);
            }

            const dadosLimpos = this.sanitizarDados(req.body, [
                'nome', 'descricao', 'unidade_medida'
            ]);

            // Tipo global não tem empresa_id
            dadosLimpos.empresa_id = null;

            // Validações básicas
            const errosValidacao = this.tipoModel.validate(dadosLimpos);
            if (errosValidacao.length > 0) {
                return this.erroResponse(res, 'Dados inválidos', 400, errosValidacao);
            }

            // Verificar se categoria existe (deve ser global também)
            const categoriaValida = await ValidationService.verificarCategoriaExistente(
                dadosLimpos.categoria_id,
                null
            );

            if (!categoriaValida) {
                return this.erroResponse(res, 'Categoria global não encontrada', 404);
            }

            // Verificar se nome é único na categoria global
            const isUnique = await this.tipoModel.isNomeUniqueInCategoria(
                dadosLimpos.nome,
                dadosLimpos.categoria_id,
                null
            );

            if (!isUnique) {
                return this.erroResponse(res, 'Já existe um tipo global com este nome nesta categoria', 409);
            }

            // Criar tipo global
            dadosLimpos.criado_por = req.usuario.id;
            const tipo = await this.tipoModel.create(dadosLimpos);

            // Buscar tipo criado com detalhes
            const tipoCriado = await this.tipoModel.findByIdWithDetails(
                tipo.id,
                null
            );

            // Log de auditoria
            await this.logarAuditoria(
                req.usuario.id,
                'CREATE_GLOBAL',
                'tipos',
                tipo.id,
                null,
                tipoCriado
            );

            return this.sucessoResponse(
                res,
                tipoCriado,
                'Tipo global criado com sucesso',
                201
            );

        } catch (error) {
            console.error('Erro ao criar tipo global:', error);
            next(error);
        }
    }

    /**
     * Importar tipos de outra categoria
     */
    async importarDeCategoria(req, res, next) {
        try {
            const { categoria_origem_id, categoria_destino_id } = req.body;
            const empresaId = req.usuario.empresa_id;

            if (!categoria_origem_id || !categoria_destino_id) {
                return this.erroResponse(res, 'Categoria de origem e destino são obrigatórias', 400);
            }

            if (categoria_origem_id === categoria_destino_id) {
                return this.erroResponse(res, 'Categorias de origem e destino devem ser diferentes', 400);
            }

            // Verificar permissões - apenas gerentes ou superiores
            if (req.usuario.nivel_hierarquia > 3) {
                return this.erroResponse(res, 'Sem permissão para importar tipos', 403);
            }

            // Buscar tipos da categoria origem
            const tiposOrigem = await this.tipoModel.findByCategoria(
                categoria_origem_id,
                empresaId,
                { limit: 100 }
            );

            if (tiposOrigem.length === 0) {
                return this.erroResponse(res, 'Nenhum tipo encontrado na categoria de origem', 404);
            }

            const tiposImportados = [];
            const errosImportacao = [];

            // Importar cada tipo
            for (const tipoOrigem of tiposOrigem) {
                try {
                    // Verificar se já existe na categoria destino
                    const jaExiste = await this.tipoModel.isNomeUniqueInCategoria(
                        tipoOrigem.nome,
                        categoria_destino_id,
                        empresaId
                    );

                    if (!jaExiste) {
                        errosImportacao.push(`Tipo "${tipoOrigem.nome}" já existe na categoria destino`);
                        continue;
                    }

                    // Criar novo tipo na categoria destino
                    const dadosNovoTipo = {
                        nome: tipoOrigem.nome,
                        descricao: tipoOrigem.descricao,
                        categoria_id: categoria_destino_id,
                        unidade_medida: tipoOrigem.unidade_medida,
                        estoque_minimo: tipoOrigem.estoque_minimo,
                        estoque_maximo: tipoOrigem.estoque_maximo,
                        vida_util_meses: tipoOrigem.vida_util_meses,
                        requer_lote: tipoOrigem.requer_lote,
                        controla_validade: tipoOrigem.controla_validade,
                        permite_saldo_negativo: tipoOrigem.permite_saldo_negativo,
                        empresa_id: empresaId,
                        criado_por: req.usuario.id
                    };

                    const novoTipo = await this.tipoModel.create(dadosNovoTipo);
                    tiposImportados.push(novoTipo);

                } catch (error) {
                    errosImportacao.push(`Erro ao importar "${tipoOrigem.nome}": ${error.message}`);
                }
            }

            // Log de auditoria
            await this.logarAuditoria(
                req.usuario.id,
                'IMPORT_TIPOS',
                'tipos',
                null,
                null,
                {
                    categoria_origem_id,
                    categoria_destino_id,
                    tipos_importados: tiposImportados.length,
                    erros: errosImportacao.length
                }
            );

            return this.sucessoResponse(
                res,
                {
                    tipos_importados: tiposImportados.length,
                    erros_importacao: errosImportacao,
                    detalhes: tiposImportados
                },
                `${tiposImportados.length} tipos importados com sucesso`
            );

        } catch (error) {
            console.error('Erro ao importar tipos:', error);
            next(error);
        }
    }
}

module.exports = new TiposController();