/**
 * Controller de Produtos Refatorado
 * Usa Repository Pattern com Model para abstração de dados
 * Unifica gestão de ativos e produtos em uma única interface
 */

const BaseController = require('./baseController');
const Produto = require('../models/Produto');
const ValidationService = require('../services/validationService');

class ProdutosController extends BaseController {
    constructor() {
        super('produtos', 'Produto');
        this.produtoModel = new Produto();
    }

    /**
     * Listar produtos com filtros avançados e paginação
     */
    async listar(req, res, next) {
        try {
            const empresaId = req.usuario.empresa_id;

            // Se não tem empresa (admin sistema), precisa especificar
            if (!empresaId && !req.query.empresa_id) {
                return this.erroResponse(res, 'Empresa deve ser especificada', 400);
            }

            const options = {
                search: req.query.search,
                tipo_id: req.query.tipo_id,
                fazenda_id: req.query.fazenda_id,
                categoria_produto: req.query.categoria_produto,
                status: req.query.status || 'ativo',
                page: parseInt(req.query.page) || 1,
                limit: Math.min(parseInt(req.query.limit) || 20, 100) // Máximo 100
            };

            const targetEmpresaId = empresaId || req.query.empresa_id;
            const produtos = await this.produtoModel.findByEmpresa(targetEmpresaId, options);

            // Contar total para paginação
            const total = await this.produtoModel.count({
                empresa_id: targetEmpresaId,
                ativo: true
            });

            return this.respostaPaginada(
                res,
                produtos,
                total,
                options.page,
                options.limit,
                'Produtos listados com sucesso'
            );

        } catch (error) {
            console.error('Erro ao listar produtos:', error);
            next(error);
        }
    }

    /**
     * Buscar produto por ID com dados relacionados
     */
    async buscarPorId(req, res, next) {
        try {
            const { id } = req.params;
            const empresaId = req.usuario.empresa_id;

            const produto = await this.produtoModel.findByIdWithRelations(id, empresaId);

            if (!produto) {
                return this.erroResponse(res, 'Produto não encontrado', 404);
            }

            // Verificar permissão de acesso
            if (empresaId && produto.empresa_id !== empresaId) {
                return this.erroResponse(res, 'Acesso negado a este produto', 403);
            }

            return this.sucessoResponse(res, produto, 'Produto encontrado');

        } catch (error) {
            console.error('Erro ao buscar produto:', error);
            next(error);
        }
    }

    /**
     * Criar novo produto
     */
    async criar(req, res, next) {
        try {
            const dadosLimpos = this.sanitizarDados(req.body, [
                'nome', 'descricao', 'codigo_interno', 'marca', 'modelo', 'observacoes'
            ]);

            // Definir empresa automaticamente se usuário não for admin sistema
            if (req.usuario.empresa_id) {
                dadosLimpos.empresa_id = req.usuario.empresa_id;
            } else if (dadosLimpos.fazenda_id && !dadosLimpos.empresa_id) {
                // Se admin sistema não especificou empresa_id, buscar da fazenda
                const fazenda = await this.produtoModel.raw(
                    'SELECT empresa_id FROM fazendas WHERE id = $1',
                    [dadosLimpos.fazenda_id]
                );
                if (fazenda.length > 0) {
                    dadosLimpos.empresa_id = fazenda[0].empresa_id;
                }
            }

            // Validações básicas
            const errosValidacao = this.produtoModel.validate(dadosLimpos);
            if (errosValidacao.length > 0) {
                return this.erroResponse(res, 'Dados inválidos', 400, errosValidacao);
            }

            // Validações de negócio
            const errosNegocio = ValidationService.validarProduto(dadosLimpos);
            if (errosNegocio.length > 0) {
                return this.erroResponse(res, 'Validação de negócio falhou', 400, errosNegocio);
            }

            // Verificar código interno único
            if (dadosLimpos.codigo_interno) {
                const isUnique = await this.produtoModel.isCodigoInternoUnique(
                    dadosLimpos.codigo_interno,
                    dadosLimpos.empresa_id
                );

                if (!isUnique) {
                    return this.erroResponse(res, 'Código interno já existe nesta empresa', 409);
                }
            }

            // Verificar se fazenda pertence à empresa
            const permissaoFazenda = await ValidationService.verificarPermissaoFazenda(
                req.usuario.id,
                dadosLimpos.fazenda_id
            );

            if (!permissaoFazenda) {
                return this.erroResponse(res, 'Acesso negado a esta fazenda', 403);
            }

            // Criar produto
            dadosLimpos.criado_por = req.usuario.id;
            const produto = await this.produtoModel.create(dadosLimpos);

            // Buscar produto criado com relacionamentos
            const produtoCriado = await this.produtoModel.findByIdWithRelations(
                produto.id,
                dadosLimpos.empresa_id
            );

            // Log de auditoria
            await this.logarAuditoria(
                req.usuario.id,
                'CREATE',
                'produtos',
                produto.id,
                null,
                produtoCriado
            );

            return this.sucessoResponse(
                res,
                produtoCriado,
                'Produto criado com sucesso',
                201
            );

        } catch (error) {
            console.error('Erro ao criar produto:', error);
            next(error);
        }
    }

    /**
     * Atualizar produto existente
     */
    async atualizar(req, res, next) {
        try {
            const { id } = req.params;
            const empresaId = req.usuario.empresa_id;

            // Buscar produto atual
            const produtoAtual = await this.produtoModel.findByIdWithRelations(id, empresaId);
            if (!produtoAtual) {
                return this.erroResponse(res, 'Produto não encontrado', 404);
            }

            // Verificar permissão
            if (empresaId && produtoAtual.empresa_id !== empresaId) {
                return this.erroResponse(res, 'Acesso negado a este produto', 403);
            }

            const dadosLimpos = this.sanitizarDados(req.body, [
                'nome', 'descricao', 'codigo_interno', 'marca', 'modelo', 'observacoes'
            ]);

            // Validações básicas
            const dadosCompletos = { ...produtoAtual, ...dadosLimpos };
            const errosValidacao = this.produtoModel.validate(dadosCompletos);
            if (errosValidacao.length > 0) {
                return this.erroResponse(res, 'Dados inválidos', 400, errosValidacao);
            }

            // Verificar código interno único (se alterado)
            if (dadosLimpos.codigo_interno &&
                dadosLimpos.codigo_interno !== produtoAtual.codigo_interno) {

                const isUnique = await this.produtoModel.isCodigoInternoUnique(
                    dadosLimpos.codigo_interno,
                    produtoAtual.empresa_id,
                    id
                );

                if (!isUnique) {
                    return this.erroResponse(res, 'Código interno já existe nesta empresa', 409);
                }
            }

            // Atualizar produto
            dadosLimpos.atualizado_por = req.usuario.id;
            await this.produtoModel.update(id, dadosLimpos);

            // Buscar produto atualizado
            const produtoAtualizado = await this.produtoModel.findByIdWithRelations(
                id,
                empresaId
            );

            // Log de auditoria
            await this.logarAuditoria(
                req.usuario.id,
                'UPDATE',
                'produtos',
                id,
                produtoAtual,
                produtoAtualizado
            );

            return this.sucessoResponse(
                res,
                produtoAtualizado,
                'Produto atualizado com sucesso'
            );

        } catch (error) {
            console.error('Erro ao atualizar produto:', error);
            next(error);
        }
    }

    /**
     * Excluir produto (soft delete)
     */
    async excluir(req, res, next) {
        try {
            const { id } = req.params;
            const empresaId = req.usuario.empresa_id;

            // Buscar produto
            const produto = await this.produtoModel.findByIdWithRelations(id, empresaId);
            if (!produto) {
                return this.erroResponse(res, 'Produto não encontrado', 404);
            }

            // Verificar permissão
            if (empresaId && produto.empresa_id !== empresaId) {
                return this.erroResponse(res, 'Acesso negado a este produto', 403);
            }

            // Verificar se tem estoque
            const temEstoque = await this.produtoModel.hasEstoque(id);
            if (temEstoque) {
                return this.erroResponse(
                    res,
                    'Produto com estoque não pode ser excluído. Transfira o estoque primeiro.',
                    409
                );
            }

            // Verificar se tem movimentações
            const temMovimentacoes = await this.produtoModel.hasMovimentacoes(id);
            if (temMovimentacoes) {
                return this.erroResponse(
                    res,
                    'Produto com histórico de movimentações não pode ser excluído.',
                    409
                );
            }

            // Soft delete
            await this.produtoModel.softDelete(id, req.usuario.id);

            // Log de auditoria
            await this.logarAuditoria(
                req.usuario.id,
                'DELETE',
                'produtos',
                id,
                produto,
                null
            );

            return this.sucessoResponse(res, null, 'Produto excluído com sucesso');

        } catch (error) {
            console.error('Erro ao excluir produto:', error);
            next(error);
        }
    }

    /**
     * Buscar produtos com estoque baixo
     */
    async estoqueBaixo(req, res, next) {
        try {
            const empresaId = req.usuario.empresa_id;
            const limite = parseInt(req.query.limite) || 10;

            if (!empresaId) {
                return this.erroResponse(res, 'Acesso negado', 403);
            }

            const produtos = await this.produtoModel.findComEstoqueBaixo(empresaId, limite);

            return this.sucessoResponse(
                res,
                produtos,
                'Produtos com estoque baixo listados'
            );

        } catch (error) {
            console.error('Erro ao buscar estoque baixo:', error);
            next(error);
        }
    }

    /**
     * Obter estatísticas dos produtos
     */
    async estatisticas(req, res, next) {
        try {
            const empresaId = req.usuario.empresa_id;

            if (!empresaId) {
                return this.erroResponse(res, 'Acesso negado', 403);
            }

            const [estatisticas, contadorCategoria] = await Promise.all([
                this.produtoModel.getEstatisticas(empresaId),
                this.produtoModel.countByCategoria(empresaId)
            ]);

            const dados = {
                ...estatisticas,
                por_categoria: contadorCategoria
            };

            return this.sucessoResponse(res, dados, 'Estatísticas obtidas');

        } catch (error) {
            console.error('Erro ao obter estatísticas:', error);
            next(error);
        }
    }

    /**
     * Buscar produtos para manutenção
     */
    async paraManutencao(req, res, next) {
        try {
            const empresaId = req.usuario.empresa_id;

            if (!empresaId) {
                return this.erroResponse(res, 'Acesso negado', 403);
            }

            const produtos = await this.produtoModel.findParaManutencao(empresaId);

            return this.sucessoResponse(
                res,
                produtos,
                'Produtos para manutenção listados'
            );

        } catch (error) {
            console.error('Erro ao buscar produtos para manutenção:', error);
            next(error);
        }
    }

    /**
     * Atualizar status de múltiplos produtos
     */
    async atualizarStatusBatch(req, res, next) {
        try {
            const { produto_ids, novo_status } = req.body;
            const empresaId = req.usuario.empresa_id;

            if (!produto_ids || !Array.isArray(produto_ids) || produto_ids.length === 0) {
                return this.erroResponse(res, 'Lista de produtos é obrigatória', 400);
            }

            if (!novo_status) {
                return this.erroResponse(res, 'Novo status é obrigatório', 400);
            }

            const statusValidos = ['ativo', 'manutencao', 'inativo', 'vendido'];
            if (!statusValidos.includes(novo_status)) {
                return this.erroResponse(res, 'Status inválido', 400);
            }

            // Verificar se todos os produtos pertencem à empresa
            if (empresaId) {
                for (const produtoId of produto_ids) {
                    const produto = await this.produtoModel.findById(produtoId);
                    if (!produto || produto.empresa_id !== empresaId) {
                        return this.erroResponse(
                            res,
                            `Acesso negado ao produto ${produtoId}`,
                            403
                        );
                    }
                }
            }

            const produtosAtualizados = await this.produtoModel.updateStatusBatch(
                produto_ids,
                novo_status,
                req.usuario.id
            );

            // Log de auditoria em batch
            for (const produto of produtosAtualizados) {
                await this.logarAuditoria(
                    req.usuario.id,
                    'UPDATE_STATUS',
                    'produtos',
                    produto.id,
                    { status: 'anterior' },
                    { status: produto.status }
                );
            }

            return this.sucessoResponse(
                res,
                produtosAtualizados,
                `${produtosAtualizados.length} produtos atualizados`
            );

        } catch (error) {
            console.error('Erro ao atualizar status em batch:', error);
            next(error);
        }
    }

    /**
     * Buscar produtos por fornecedor
     */
    async porFornecedor(req, res, next) {
        try {
            const { fornecedor_id } = req.params;
            const empresaId = req.usuario.empresa_id;

            const produtos = await this.produtoModel.findByFornecedor(
                fornecedor_id,
                empresaId
            );

            return this.sucessoResponse(
                res,
                produtos,
                'Produtos do fornecedor listados'
            );

        } catch (error) {
            console.error('Erro ao buscar produtos por fornecedor:', error);
            next(error);
        }
    }

    /**
     * Gerar relatório de produtos
     */
    async relatorio(req, res, next) {
        try {
            const empresaId = req.usuario.empresa_id;
            const { formato = 'json' } = req.query;

            if (!empresaId) {
                return this.erroResponse(res, 'Acesso negado', 403);
            }

            const produtos = await this.produtoModel.findByEmpresa(empresaId, {
                page: 1,
                limit: 1000 // Limite alto para relatório
            });

            if (formato === 'csv') {
                // TODO: Implementar exportação CSV
                return this.erroResponse(res, 'Exportação CSV em desenvolvimento', 501);
            }

            return this.sucessoResponse(
                res,
                produtos,
                'Relatório de produtos gerado'
            );

        } catch (error) {
            console.error('Erro ao gerar relatório:', error);
            next(error);
        }
    }

    /**
     * Buscar lotes de um produto específico
     */
    async buscarLotes(req, res, next) {
        try {
            const { id } = req.params;
            const empresaId = req.usuario.empresa_id;

            // Verificar se produto existe
            const produto = await this.produtoModel.findById(id);
            if (!produto) {
                return this.erroResponse(res, 'Produto não encontrado', 404);
            }

            // Verificar permissão de acesso
            if (empresaId && produto.empresa_id !== empresaId) {
                return this.erroResponse(res, 'Acesso negado a este produto', 403);
            }

            const options = {
                apenas_ativos: req.query.apenas_ativos !== 'false',
                com_estoque: req.query.com_estoque === 'true',
                vencimento_proximo: req.query.vencimento_proximo ? parseInt(req.query.vencimento_proximo) : null,
                page: parseInt(req.query.page) || 1,
                limit: Math.min(parseInt(req.query.limit) || 50, 100)
            };

            // Importar modelo Lote
            const Lote = require('../models/Lote');
            const loteModel = new Lote();

            const lotes = await loteModel.findByProduto(id, options);

            return this.sucessoResponse(
                res,
                lotes,
                'Lotes do produto listados com sucesso'
            );

        } catch (error) {
            console.error('Erro ao buscar lotes do produto:', error);
            next(error);
        }
    }
}

module.exports = new ProdutosController();