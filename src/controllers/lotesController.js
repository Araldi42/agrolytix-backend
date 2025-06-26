/**
 * Controller de Lotes
 * Gerencia lotes de produtos para rastreabilidade
 */

const BaseController = require('./baseController');
const Lote = require('../models/Lote');

class LotesController extends BaseController {
    constructor() {
        super('lotes', 'Lote');
        this.loteModel = new Lote();
    }

    /**
     * Listar lotes com filtros
     */
    async listar(req, res, next) {
        try {
            const empresaId = req.usuario.empresa_id;

            if (!empresaId && !req.query.empresa_id) {
                return this.erroResponse(res, 'Empresa deve ser especificada', 400);
            }

            const options = {
                produto_id: req.query.produto_id,
                status_vencimento: req.query.status_vencimento,
                com_estoque: req.query.com_estoque === 'true',
                page: parseInt(req.query.page) || 1,
                limit: Math.min(parseInt(req.query.limit) || 50, 100)
            };

            const targetEmpresaId = empresaId || req.query.empresa_id;
            const lotes = await this.loteModel.findByEmpresa(targetEmpresaId, options);

            // Contar total para paginação
            const filtros = { empresa_id: targetEmpresaId };
            if (options.produto_id) filtros.produto_id = options.produto_id;

            const total = await this.loteModel.count(filtros);

            return this.respostaPaginada(
                res,
                lotes,
                total,
                options.page,
                options.limit,
                'Lotes listados com sucesso'
            );

        } catch (error) {
            console.error('Erro ao listar lotes:', error);
            next(error);
        }
    }

    /**
     * Buscar lote por ID
     */
    async buscarPorId(req, res, next) {
        try {
            const { id } = req.params;
            const empresaId = req.usuario.empresa_id;

            const lote = await this.loteModel.findById(id);

            if (!lote) {
                return this.erroResponse(res, 'Lote não encontrado', 404);
            }

            // Verificar permissão de acesso
            if (empresaId) {
                // Verificar se o lote pertence à empresa do usuário
                const produto = await this.loteModel.query(
                    'SELECT empresa_id FROM produtos WHERE id = $1',
                    [lote.produto_id]
                );

                if (produto.rows.length === 0 || produto.rows[0].empresa_id !== empresaId) {
                    return this.erroResponse(res, 'Acesso negado a este lote', 403);
                }
            }

            return this.sucessoResponse(res, lote, 'Lote encontrado');

        } catch (error) {
            console.error('Erro ao buscar lote:', error);
            next(error);
        }
    }

    /**
     * Buscar lotes por produto
     */
    async porProduto(req, res, next) {
        try {
            const { produto_id } = req.params;
            const empresaId = req.usuario.empresa_id;

            // Verificar se o produto existe e pertence à empresa
            if (empresaId) {
                const produto = await this.loteModel.query(
                    'SELECT empresa_id FROM produtos WHERE id = $1 AND ativo = true',
                    [produto_id]
                );

                if (produto.rows.length === 0) {
                    return this.erroResponse(res, 'Produto não encontrado', 404);
                }

                if (produto.rows[0].empresa_id !== empresaId) {
                    return this.erroResponse(res, 'Acesso negado a este produto', 403);
                }
            }

            const options = {
                apenas_ativos: req.query.apenas_ativos !== 'false',
                com_estoque: req.query.com_estoque === 'true',
                vencimento_proximo: req.query.vencimento_proximo ? parseInt(req.query.vencimento_proximo) : null,
                page: parseInt(req.query.page) || 1,
                limit: Math.min(parseInt(req.query.limit) || 50, 100)
            };

            const lotes = await this.loteModel.findByProduto(produto_id, options);

            return this.sucessoResponse(
                res,
                lotes,
                'Lotes do produto listados com sucesso'
            );

        } catch (error) {
            console.error('Erro ao buscar lotes por produto:', error);
            next(error);
        }
    }

    /**
     * Criar novo lote
     */
    async criar(req, res, next) {
        try {
            const dadosLimpos = this.sanitizarDados(req.body, [
                'produto_id', 'numero_lote', 'data_fabricacao', 'data_vencimento',
                'quantidade_inicial', 'fornecedor_id', 'observacoes'
            ]);

            // Validações básicas
            const errosValidacao = this.loteModel.validate(dadosLimpos);
            if (errosValidacao.length > 0) {
                return this.erroResponse(res, 'Dados inválidos', 400, errosValidacao);
            }

            // Verificar se o produto existe e pertence à empresa
            const empresaId = req.usuario.empresa_id;
            if (empresaId) {
                const produto = await this.loteModel.query(
                    'SELECT empresa_id FROM produtos WHERE id = $1 AND ativo = true',
                    [dadosLimpos.produto_id]
                );

                if (produto.rows.length === 0) {
                    return this.erroResponse(res, 'Produto não encontrado', 404);
                }

                if (produto.rows[0].empresa_id !== empresaId) {
                    return this.erroResponse(res, 'Acesso negado a este produto', 403);
                }
            }

            // Verificar se número do lote é único para o produto
            if (dadosLimpos.numero_lote) {
                const isUnique = await this.loteModel.isNumeroLoteUnique(
                    dadosLimpos.produto_id,
                    dadosLimpos.numero_lote
                );

                if (!isUnique) {
                    return this.erroResponse(res, 'Já existe um lote com este número para este produto', 409);
                }
            } else {
                // Gerar número do lote automaticamente
                dadosLimpos.numero_lote = await this.loteModel.gerarNumeroLote(dadosLimpos.produto_id);
            }

            dadosLimpos.criado_por = req.usuario.id;

            const lote = await this.loteModel.create(dadosLimpos);

            // Log de auditoria
            await this.logarAuditoria(
                req.usuario.id,
                'CREATE',
                'lotes',
                lote.id,
                null,
                lote
            );

            return this.sucessoResponse(
                res,
                lote,
                'Lote criado com sucesso',
                201
            );

        } catch (error) {
            console.error('Erro ao criar lote:', error);
            next(error);
        }
    }

    /**
     * Atualizar lote
     */
    async atualizar(req, res, next) {
        try {
            const { id } = req.params;
            const empresaId = req.usuario.empresa_id;

            // Buscar lote atual
            const loteAtual = await this.loteModel.findById(id);
            if (!loteAtual) {
                return this.erroResponse(res, 'Lote não encontrado', 404);
            }

            // Verificar permissão
            if (empresaId) {
                const produto = await this.loteModel.query(
                    'SELECT empresa_id FROM produtos WHERE id = $1',
                    [loteAtual.produto_id]
                );

                if (produto.rows.length === 0 || produto.rows[0].empresa_id !== empresaId) {
                    return this.erroResponse(res, 'Acesso negado a este lote', 403);
                }
            }

            const dadosLimpos = this.sanitizarDados(req.body, [
                'numero_lote', 'data_fabricacao', 'data_vencimento',
                'quantidade_inicial', 'fornecedor_id', 'observacoes'
            ]);

            // Validações básicas
            const dadosCompletos = { ...loteAtual, ...dadosLimpos };
            const errosValidacao = this.loteModel.validate(dadosCompletos);
            if (errosValidacao.length > 0) {
                return this.erroResponse(res, 'Dados inválidos', 400, errosValidacao);
            }

            // Verificar número único (se alterado)
            if (dadosLimpos.numero_lote && dadosLimpos.numero_lote !== loteAtual.numero_lote) {
                const isUnique = await this.loteModel.isNumeroLoteUnique(
                    loteAtual.produto_id,
                    dadosLimpos.numero_lote,
                    id
                );

                if (!isUnique) {
                    return this.erroResponse(res, 'Já existe outro lote com este número para este produto', 409);
                }
            }

            dadosLimpos.atualizado_por = req.usuario.id;
            await this.loteModel.update(id, dadosLimpos);

            // Buscar lote atualizado
            const loteAtualizado = await this.loteModel.findById(id);

            // Log de auditoria
            await this.logarAuditoria(
                req.usuario.id,
                'UPDATE',
                'lotes',
                id,
                loteAtual,
                loteAtualizado
            );

            return this.sucessoResponse(
                res,
                loteAtualizado,
                'Lote atualizado com sucesso'
            );

        } catch (error) {
            console.error('Erro ao atualizar lote:', error);
            next(error);
        }
    }

    /**
     * Excluir lote (soft delete)
     */
    async excluir(req, res, next) {
        try {
            const { id } = req.params;
            const empresaId = req.usuario.empresa_id;

            // Buscar lote
            const lote = await this.loteModel.findById(id);
            if (!lote) {
                return this.erroResponse(res, 'Lote não encontrado', 404);
            }

            // Verificar permissão
            if (empresaId) {
                const produto = await this.loteModel.query(
                    'SELECT empresa_id FROM produtos WHERE id = $1',
                    [lote.produto_id]
                );

                if (produto.rows.length === 0 || produto.rows[0].empresa_id !== empresaId) {
                    return this.erroResponse(res, 'Acesso negado a este lote', 403);
                }
            }

            // Verificar se pode ser excluído (não tem estoque ou movimentações)
            const temEstoque = await this.loteModel.query(
                'SELECT COUNT(*) as total FROM estoque WHERE lote_id = $1 AND quantidade_atual > 0',
                [id]
            );

            if (parseInt(temEstoque.rows[0].total) > 0) {
                return this.erroResponse(
                    res,
                    'Este lote possui estoque e não pode ser excluído',
                    409
                );
            }

            const temMovimentacoes = await this.loteModel.query(
                'SELECT COUNT(*) as total FROM movimentacao_itens WHERE lote_id = $1',
                [id]
            );

            if (parseInt(temMovimentacoes.rows[0].total) > 0) {
                return this.erroResponse(
                    res,
                    'Este lote possui movimentações e não pode ser excluído',
                    409
                );
            }

            // Soft delete
            await this.loteModel.softDelete(id, req.usuario.id);

            // Log de auditoria
            await this.logarAuditoria(
                req.usuario.id,
                'DELETE',
                'lotes',
                id,
                lote,
                null
            );

            return this.sucessoResponse(res, null, 'Lote excluído com sucesso');

        } catch (error) {
            console.error('Erro ao excluir lote:', error);
            next(error);
        }
    }

    /**
     * Buscar lotes próximos do vencimento
     */
    async proximosVencimento(req, res, next) {
        try {
            const empresaId = req.usuario.empresa_id;
            const dias = parseInt(req.query.dias) || 30;

            if (!empresaId) {
                return this.erroResponse(res, 'Acesso negado', 403);
            }

            const lotes = await this.loteModel.findProximosVencimento(empresaId, dias);

            return this.sucessoResponse(
                res,
                lotes,
                'Lotes próximos do vencimento listados'
            );

        } catch (error) {
            console.error('Erro ao buscar lotes próximos do vencimento:', error);
            next(error);
        }
    }

    /**
     * Buscar lotes vencidos com estoque
     */
    async vencidosComEstoque(req, res, next) {
        try {
            const empresaId = req.usuario.empresa_id;

            if (!empresaId) {
                return this.erroResponse(res, 'Acesso negado', 403);
            }

            const lotes = await this.loteModel.findVencidosComEstoque(empresaId);

            return this.sucessoResponse(
                res,
                lotes,
                'Lotes vencidos com estoque listados'
            );

        } catch (error) {
            console.error('Erro ao buscar lotes vencidos:', error);
            next(error);
        }
    }

    /**
     * Obter histórico de movimentações do lote
     */
    async historicoMovimentacoes(req, res, next) {
        try {
            const { id } = req.params;
            const empresaId = req.usuario.empresa_id;
            const limit = Math.min(parseInt(req.query.limit) || 50, 100);

            // Verificar se lote existe e permissão
            const lote = await this.loteModel.findById(id);
            if (!lote) {
                return this.erroResponse(res, 'Lote não encontrado', 404);
            }

            if (empresaId) {
                const produto = await this.loteModel.query(
                    'SELECT empresa_id FROM produtos WHERE id = $1',
                    [lote.produto_id]
                );

                if (produto.rows.length === 0 || produto.rows[0].empresa_id !== empresaId) {
                    return this.erroResponse(res, 'Acesso negado a este lote', 403);
                }
            }

            const historico = await this.loteModel.getHistoricoMovimentacoes(id, limit);

            return this.sucessoResponse(
                res,
                historico,
                'Histórico de movimentações do lote'
            );

        } catch (error) {
            console.error('Erro ao buscar histórico de movimentações:', error);
            next(error);
        }
    }

    /**
     * Obter estoque por setor do lote
     */
    async estoquePorSetor(req, res, next) {
        try {
            const { id } = req.params;
            const empresaId = req.usuario.empresa_id;

            // Verificar se lote existe e permissão
            const lote = await this.loteModel.findById(id);
            if (!lote) {
                return this.erroResponse(res, 'Lote não encontrado', 404);
            }

            if (empresaId) {
                const produto = await this.loteModel.query(
                    'SELECT empresa_id FROM produtos WHERE id = $1',
                    [lote.produto_id]
                );

                if (produto.rows.length === 0 || produto.rows[0].empresa_id !== empresaId) {
                    return this.erroResponse(res, 'Acesso negado a este lote', 403);
                }
            }

            const estoque = await this.loteModel.getEstoquePorSetor(id);

            return this.sucessoResponse(
                res,
                estoque,
                'Estoque do lote por setor'
            );

        } catch (error) {
            console.error('Erro ao buscar estoque por setor:', error);
            next(error);
        }
    }

    /**
     * Obter estatísticas do lote
     */
    async estatisticas(req, res, next) {
        try {
            const { id } = req.params;
            const empresaId = req.usuario.empresa_id;

            // Verificar se lote existe e permissão
            const lote = await this.loteModel.findById(id);
            if (!lote) {
                return this.erroResponse(res, 'Lote não encontrado', 404);
            }

            if (empresaId) {
                const produto = await this.loteModel.query(
                    'SELECT empresa_id FROM produtos WHERE id = $1',
                    [lote.produto_id]
                );

                if (produto.rows.length === 0 || produto.rows[0].empresa_id !== empresaId) {
                    return this.erroResponse(res, 'Acesso negado a este lote', 403);
                }
            }

            const estatisticas = await this.loteModel.getEstatisticas(id);

            return this.sucessoResponse(
                res,
                estatisticas,
                'Estatísticas do lote'
            );

        } catch (error) {
            console.error('Erro ao obter estatísticas do lote:', error);
            next(error);
        }
    }

    /**
     * Marcar lote como consumido
     */
    async marcarConsumido(req, res, next) {
        try {
            const { id } = req.params;
            const empresaId = req.usuario.empresa_id;

            // Verificar se lote existe e permissão
            const lote = await this.loteModel.findById(id);
            if (!lote) {
                return this.erroResponse(res, 'Lote não encontrado', 404);
            }

            if (empresaId) {
                const produto = await this.loteModel.query(
                    'SELECT empresa_id FROM produtos WHERE id = $1',
                    [lote.produto_id]
                );

                if (produto.rows.length === 0 || produto.rows[0].empresa_id !== empresaId) {
                    return this.erroResponse(res, 'Acesso negado a este lote', 403);
                }
            }

            // Verificar se ainda tem estoque
            const estoque = await this.loteModel.query(
                'SELECT SUM(quantidade_atual) as total FROM estoque WHERE lote_id = $1',
                [id]
            );

            const estoqueTotal = parseFloat(estoque.rows[0].total) || 0;
            if (estoqueTotal > 0) {
                return this.erroResponse(
                    res,
                    'Lote ainda possui estoque e não pode ser marcado como consumido',
                    409
                );
            }

            await this.loteModel.marcarComoConsumido(id, req.usuario.id);

            // Log de auditoria
            await this.logarAuditoria(
                req.usuario.id,
                'CONSUME',
                'lotes',
                id,
                { status: 'ativo' },
                { status: 'consumido' }
            );

            return this.sucessoResponse(
                res,
                null,
                'Lote marcado como consumido com sucesso'
            );

        } catch (error) {
            console.error('Erro ao marcar lote como consumido:', error);
            next(error);
        }
    }
}

module.exports = new LotesController(); 