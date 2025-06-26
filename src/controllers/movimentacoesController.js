/**
 * Controller de Movimentações Refatorado
 * Gerencia movimentações de estoque com controle automático
 * Usa Repository Pattern para abstração de dados
 */

const BaseController = require('./baseController');
const Movimentacao = require('../models/Movimentacao');
const ValidationService = require('../services/validationService');
const { query } = require('../config/database');

class MovimentacoesController extends BaseController {
    constructor() {
        super('movimentacoes', 'Movimentação');
        this.movimentacaoModel = new Movimentacao();
    }

    /**
     * Listar movimentações com filtros avançados
     */
    async listar(req, res, next) {
        try {
            const empresaId = req.usuario.empresa_id;

            if (!empresaId && !req.query.empresa_id) {
                return this.erroResponse(res, 'Empresa deve ser especificada', 400);
            }

            const options = {
                fazenda_id: req.query.fazenda_id,
                tipo_movimentacao_id: req.query.tipo_movimentacao_id,
                data_inicio: req.query.data_inicio,
                data_fim: req.query.data_fim,
                status: req.query.status,
                page: parseInt(req.query.page) || 1,
                limit: Math.min(parseInt(req.query.limit) || 20, 100)
            };

            const targetEmpresaId = empresaId || req.query.empresa_id;
            const movimentacoes = await this.movimentacaoModel.findByEmpresa(targetEmpresaId, options);

            // Contar total para paginação
            const filtros = { empresa_id: targetEmpresaId };
            if (options.fazenda_id) filtros.fazenda_id = options.fazenda_id;
            if (options.status) filtros.status = options.status;

            const total = await this.movimentacaoModel.count(filtros);

            return this.respostaPaginada(
                res,
                movimentacoes,
                total,
                options.page,
                options.limit,
                'Movimentações listadas com sucesso'
            );

        } catch (error) {
            console.error('Erro ao listar movimentações:', error);
            next(error);
        }
    }

    /**
     * Buscar movimentação por ID com itens
     */
    async buscarPorId(req, res, next) {
        try {
            const { id } = req.params;
            const empresaId = req.usuario.empresa_id;

            const movimentacao = await this.movimentacaoModel.findByIdWithItens(id, empresaId);

            if (!movimentacao) {
                return this.erroResponse(res, 'Movimentação não encontrada', 404);
            }

            // Verificar permissão de acesso
            if (empresaId && movimentacao.empresa_id !== empresaId) {
                return this.erroResponse(res, 'Acesso negado a esta movimentação', 403);
            }

            return this.sucessoResponse(res, movimentacao, 'Movimentação encontrada');

        } catch (error) {
            console.error('Erro ao buscar movimentação:', error);
            next(error);
        }
    }

    /**
     * Criar nova movimentação com itens
     */
    async criar(req, res, next) {
        try {
            const { itens, ...dadosMovimentacao } = req.body;

            // Definir empresa automaticamente se usuário não for admin sistema
            if (req.usuario.empresa_id) {
                dadosMovimentacao.empresa_id = req.usuario.empresa_id;
            }

            dadosMovimentacao.usuario_criacao = req.usuario.id;

            // Validações básicas da movimentação
            const errosMovimentacao = this.movimentacaoModel.validate(dadosMovimentacao);
            if (errosMovimentacao.length > 0) {
                return this.erroResponse(res, 'Dados da movimentação inválidos', 400, errosMovimentacao);
            }

            // Validar itens
            if (!itens || !Array.isArray(itens) || itens.length === 0) {
                return this.erroResponse(res, 'Pelo menos um item é obrigatório', 400);
            }

            const errosItens = [];
            for (let i = 0; i < itens.length; i++) {
                const errosItem = this.movimentacaoModel.validateItem(itens[i]);
                if (errosItem.length > 0) {
                    errosItens.push(`Item ${i + 1}: ${errosItem.join(', ')}`);
                }
            }

            if (errosItens.length > 0) {
                return this.erroResponse(res, 'Erro nos itens da movimentação', 400, errosItens);
            }

            // Verificar permissão da fazenda
            const permissaoFazenda = await ValidationService.verificarPermissaoFazenda(
                req.usuario.id,
                dadosMovimentacao.fazenda_id
            );

            if (!permissaoFazenda) {
                return this.erroResponse(res, 'Acesso negado a esta fazenda', 403);
            }

            // Verificar se é movimentação de saída e há estoque suficiente
            if (dadosMovimentacao.tipo_movimentacao_id) {
                const tipoMov = await this.verificarTipoMovimentacao(dadosMovimentacao.tipo_movimentacao_id);

                if (tipoMov && tipoMov.operacao === '-') {
                    for (const item of itens) {
                        const estoqueOk = await ValidationService.verificarEstoqueSuficiente(
                            item.produto_id,
                            dadosMovimentacao.origem_setor_id,
                            item.quantidade,
                            item.lote_id
                        );

                        if (!estoqueOk) {
                            return this.erroResponse(
                                res,
                                `Estoque insuficiente para o produto ${item.produto_id}`,
                                409
                            );
                        }
                    }
                }
            }

            // Gerar número de documento se não fornecido
            if (!dadosMovimentacao.numero_documento) {
                dadosMovimentacao.numero_documento = await this.movimentacaoModel.gerarNumeroDocumento(
                    dadosMovimentacao.empresa_id,
                    dadosMovimentacao.tipo_movimentacao_id
                );
            }

            // Criar movimentação completa
            const movimentacao = await this.movimentacaoModel.createCompleta(dadosMovimentacao, itens);

            // Log de auditoria
            await this.logarAuditoria(
                req.usuario.id,
                'CREATE',
                'movimentacoes',
                movimentacao.id,
                null,
                movimentacao
            );

            return this.sucessoResponse(
                res,
                movimentacao,
                'Movimentação criada com sucesso',
                201
            );

        } catch (error) {
            console.error('Erro ao criar movimentação:', error);
            next(error);
        }
    }

    /**
     * Aprovar movimentação pendente
     */
    async aprovar(req, res, next) {
        try {
            const { id } = req.params;
            const { observacoes } = req.body;
            const empresaId = req.usuario.empresa_id;

            // Verificar se movimentação existe e está pendente
            const movimentacao = await this.movimentacaoModel.findById(id);

            if (!movimentacao) {
                return this.erroResponse(res, 'Movimentação não encontrada', 404);
            }

            if (empresaId && movimentacao.empresa_id !== empresaId) {
                return this.erroResponse(res, 'Acesso negado a esta movimentação', 403);
            }

            if (movimentacao.status !== 'pendente') {
                return this.erroResponse(res, 'Movimentação não está pendente de aprovação', 409);
            }

            // Verificar se usuário pode aprovar (não pode aprovar próprias movimentações)
            if (movimentacao.usuario_criacao === req.usuario.id) {
                return this.erroResponse(res, 'Não é possível aprovar próprias movimentações', 403);
            }

            // Aprovar
            const movimentacaoAprovada = await this.movimentacaoModel.aprovar(id, req.usuario.id);

            if (!movimentacaoAprovada) {
                return this.erroResponse(res, 'Erro ao aprovar movimentação', 500);
            }

            // Log de auditoria
            await this.logarAuditoria(
                req.usuario.id,
                'APPROVE',
                'movimentacoes',
                id,
                { status: 'pendente' },
                { status: 'aprovado', usuario_aprovacao: req.usuario.id }
            );

            return this.sucessoResponse(
                res,
                movimentacaoAprovada,
                'Movimentação aprovada com sucesso'
            );

        } catch (error) {
            console.error('Erro ao aprovar movimentação:', error);
            next(error);
        }
    }

    /**
     * Cancelar movimentação
     */
    async cancelar(req, res, next) {
        try {
            const { id } = req.params;
            const { motivo } = req.body;
            const empresaId = req.usuario.empresa_id;

            // Verificar se movimentação existe
            const movimentacao = await this.movimentacaoModel.findById(id);

            if (!movimentacao) {
                return this.erroResponse(res, 'Movimentação não encontrada', 404);
            }

            if (empresaId && movimentacao.empresa_id !== empresaId) {
                return this.erroResponse(res, 'Acesso negado a esta movimentação', 403);
            }

            if (movimentacao.status === 'cancelado') {
                return this.erroResponse(res, 'Movimentação já está cancelada', 409);
            }

            // Verificar permissão para cancelar
            // Apenas criador ou usuários de nível superior podem cancelar
            if (movimentacao.usuario_criacao !== req.usuario.id && req.usuario.nivel_hierarquia > 3) {
                return this.erroResponse(res, 'Sem permissão para cancelar esta movimentação', 403);
            }

            // Cancelar
            const movimentacaoCancelada = await this.movimentacaoModel.cancelar(id, req.usuario.id, motivo);

            // Log de auditoria
            await this.logarAuditoria(
                req.usuario.id,
                'CANCEL',
                'movimentacoes',
                id,
                { status: movimentacao.status },
                { status: 'cancelado', motivo }
            );

            return this.sucessoResponse(
                res,
                movimentacaoCancelada,
                'Movimentação cancelada com sucesso'
            );

        } catch (error) {
            console.error('Erro ao cancelar movimentação:', error);
            next(error);
        }
    }

    /**
     * Buscar movimentações por período
     */
    async porPeriodo(req, res, next) {
        try {
            const empresaId = req.usuario.empresa_id;
            const { data_inicio, data_fim } = req.query;

            if (!empresaId) {
                return this.erroResponse(res, 'Acesso negado', 403);
            }

            if (!data_inicio || !data_fim) {
                return this.erroResponse(res, 'Data início e fim são obrigatórias', 400);
            }

            const options = {
                tipo_movimentacao_id: req.query.tipo_movimentacao_id,
                fazenda_id: req.query.fazenda_id
            };

            const movimentacoes = await this.movimentacaoModel.findByPeriodo(
                empresaId,
                data_inicio,
                data_fim,
                options
            );

            return this.sucessoResponse(
                res,
                movimentacoes,
                'Movimentações do período listadas'
            );

        } catch (error) {
            console.error('Erro ao buscar movimentações por período:', error);
            next(error);
        }
    }

    /**
     * Obter estatísticas de movimentações
     */
    async estatisticas(req, res, next) {
        try {
            const empresaId = req.usuario.empresa_id;
            const { periodo = 'mes' } = req.query;

            if (!empresaId) {
                return this.erroResponse(res, 'Acesso negado', 403);
            }

            const estatisticas = await this.movimentacaoModel.getEstatisticas(empresaId, periodo);

            return this.sucessoResponse(res, estatisticas, 'Estatísticas obtidas');

        } catch (error) {
            console.error('Erro ao obter estatísticas:', error);
            next(error);
        }
    }

    /**
     * Buscar movimentações pendentes de aprovação
     */
    async pendentesAprovacao(req, res, next) {
        try {
            const empresaId = req.usuario.empresa_id;

            if (!empresaId) {
                return this.erroResponse(res, 'Acesso negado', 403);
            }

            // Verificar se usuário pode aprovar movimentações
            if (req.usuario.nivel_hierarquia > 3) {
                return this.erroResponse(res, 'Sem permissão para ver aprovações', 403);
            }

            const pendentes = await this.movimentacaoModel.findPendentesAprovacao(
                empresaId,
                req.usuario.id
            );

            return this.sucessoResponse(
                res,
                pendentes,
                'Movimentações pendentes listadas'
            );

        } catch (error) {
            console.error('Erro ao buscar pendentes de aprovação:', error);
            next(error);
        }
    }

    /**
     * Buscar produtos mais movimentados
     */
    async produtosMaisMovimentados(req, res, next) {
        try {
            const empresaId = req.usuario.empresa_id;
            const { limite = 10, periodo = 'mes' } = req.query;

            if (!empresaId) {
                return this.erroResponse(res, 'Acesso negado', 403);
            }

            const produtos = await this.movimentacaoModel.findProdutosMaisMovimentados(
                empresaId,
                parseInt(limite),
                periodo
            );

            return this.sucessoResponse(
                res,
                produtos,
                'Produtos mais movimentados listados'
            );

        } catch (error) {
            console.error('Erro ao buscar produtos mais movimentados:', error);
            next(error);
        }
    }

    /**
     * Gerar relatório de movimentações
     */
    async relatorio(req, res, next) {
        try {
            const empresaId = req.usuario.empresa_id;
            const { data_inicio, data_fim, formato = 'json' } = req.query;

            if (!empresaId) {
                return this.erroResponse(res, 'Acesso negado', 403);
            }

            if (!data_inicio || !data_fim) {
                return this.erroResponse(res, 'Período é obrigatório para relatório', 400);
            }

            const movimentacoes = await this.movimentacaoModel.findByPeriodo(
                empresaId,
                data_inicio,
                data_fim
            );

            if (formato === 'csv') {
                // TODO: Implementar exportação CSV
                return this.erroResponse(res, 'Exportação CSV em desenvolvimento', 501);
            }

            return this.sucessoResponse(
                res,
                movimentacoes,
                'Relatório de movimentações gerado'
            );

        } catch (error) {
            console.error('Erro ao gerar relatório:', error);
            next(error);
        }
    }

    /**
     * Método auxiliar para verificar tipo de movimentação
     */
    async verificarTipoMovimentacao(tipoId) {
        const sql = 'SELECT operacao, nome FROM tipos_movimentacao WHERE id = $1';
        const result = await query(sql, [tipoId]);
        return result.rows.length > 0 ? result.rows[0] : null;
    }
}

module.exports = new MovimentacoesController();