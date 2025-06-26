/**
 * Controller de Estoque
 * Gerencia consultas e operações de estoque
 * Complementa as movimentações com visões de estoque atual
 */

const BaseController = require('./baseController');
const Estoque = require('../models/Estoque');
const ValidationService = require('../services/validationService');

class EstoqueController extends BaseController {
    constructor() {
        super('estoque', 'Estoque');
        this.estoqueModel = new Estoque();
    }

    /**
     * Listar estoque por empresa com filtros
     */
    async listar(req, res, next) {
        try {
            const empresaId = req.usuario.empresa_id;

            if (!empresaId && !req.query.empresa_id) {
                return this.erroResponse(res, 'Empresa deve ser especificada', 400);
            }

            // Verificar permissões
            if (!empresaId) {
                return this.erroResponse(res, 'Acesso negado', 403);
            }

            const options = {
                fazenda_id: req.query.fazenda_id,
                setor_id: req.query.setor_id,
                produto_id: req.query.produto_id,
                categoria_produto: req.query.categoria_produto,
                apenas_com_estoque: req.query.apenas_com_estoque !== 'false', // default true
                page: parseInt(req.query.page) || 1,
                limit: Math.min(parseInt(req.query.limit) || 50, 200)
            };

            const targetEmpresaId = empresaId || req.query.empresa_id;
            const estoque = await this.estoqueModel.findByEmpresa(targetEmpresaId, options);

            // Contar total para paginação
            const total = await this.estoqueModel.count({
                produto_id: {
                    operator: 'IN',
                    value: `(SELECT id FROM produtos WHERE empresa_id = ${targetEmpresaId} AND ativo = true)`
                }
            });

            return this.respostaPaginada(
                res,
                estoque,
                total,
                options.page,
                options.limit,
                'Estoque listado com sucesso'
            );

        } catch (error) {
            console.error('Erro ao listar estoque:', error);
            next(error);
        }
    }

    /**
     * Buscar estoque de um produto específico
     */
    async porProduto(req, res, next) {
        try {
            const { produto_id } = req.params;
            const empresaId = req.usuario.empresa_id;

            const estoque = await this.estoqueModel.findByProduto(produto_id, empresaId);

            return this.sucessoResponse(
                res,
                estoque,
                'Estoque do produto listado'
            );

        } catch (error) {
            console.error('Erro ao buscar estoque do produto:', error);
            next(error);
        }
    }

    /**
     * Buscar produtos com estoque baixo
     */
    async estoqueBaixo(req, res, next) {
        try {
            const empresaId = req.usuario.empresa_id;
            const limite = parseInt(req.query.limite) || 20;

            if (!empresaId) {
                return this.erroResponse(res, 'Acesso negado', 403);
            }

            const produtos = await this.estoqueModel.findEstoqueBaixo(empresaId, limite);

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
     * Buscar produtos com estoque crítico (zerado)
     */
    async estoqueCritico(req, res, next) {
        try {
            const empresaId = req.usuario.empresa_id;

            if (!empresaId) {
                return this.erroResponse(res, 'Acesso negado', 403);
            }

            const produtos = await this.estoqueModel.findEstoqueCritico(empresaId);

            return this.sucessoResponse(
                res,
                produtos,
                'Produtos com estoque crítico listados'
            );

        } catch (error) {
            console.error('Erro ao buscar estoque crítico:', error);
            next(error);
        }
    }

    /**
     * Buscar produtos próximos do vencimento
     */
    async proximosVencimento(req, res, next) {
        try {
            const empresaId = req.usuario.empresa_id;
            const diasAlerta = parseInt(req.query.dias) || 30;

            if (!empresaId) {
                return this.erroResponse(res, 'Acesso negado', 403);
            }

            const produtos = await this.estoqueModel.findProximosVencimento(empresaId, diasAlerta);

            return this.sucessoResponse(
                res,
                produtos,
                `Produtos com vencimento em ${diasAlerta} dias listados`
            );

        } catch (error) {
            console.error('Erro ao buscar produtos próximos do vencimento:', error);
            next(error);
        }
    }

    /**
     * Obter resumo do estoque por fazenda
     */
    async resumoPorFazenda(req, res, next) {
        try {
            const empresaId = req.usuario.empresa_id;

            if (!empresaId) {
                return this.erroResponse(res, 'Acesso negado', 403);
            }

            const resumo = await this.estoqueModel.getResumoByFazenda(empresaId);

            return this.sucessoResponse(
                res,
                resumo,
                'Resumo do estoque por fazenda obtido'
            );

        } catch (error) {
            console.error('Erro ao obter resumo por fazenda:', error);
            next(error);
        }
    }

    /**
     * Ajustar estoque manualmente
     */
    async ajustar(req, res, next) {
        try {
            const { produto_id, setor_id, nova_quantidade, motivo, lote_id } = req.body;
            const empresaId = req.usuario.empresa_id;

            // Validações básicas
            if (!produto_id || !setor_id || nova_quantidade === undefined) {
                return this.erroResponse(
                    res,
                    'Produto, setor e nova quantidade são obrigatórios',
                    400
                );
            }

            if (nova_quantidade < 0) {
                return this.erroResponse(res, 'Quantidade não pode ser negativa', 400);
            }

            // Verificar permissões
            if (!empresaId) {
                return this.erroResponse(res, 'Acesso negado', 403);
            }

            // Verificar se usuário pode fazer ajustes (apenas gerentes ou superiores)
            if (req.usuario.nivel_hierarquia > 3) {
                return this.erroResponse(res, 'Sem permissão para ajustar estoque', 403);
            }

            // Verificar se produto pertence à empresa
            const produtoValido = await ValidationService.verificarProdutoEmpresa(produto_id, empresaId);
            if (!produtoValido) {
                return this.erroResponse(res, 'Produto não encontrado ou sem acesso', 404);
            }

            // Verificar se setor pertence à empresa
            const setorValido = await ValidationService.verificarSetorEmpresa(setor_id, empresaId);
            if (!setorValido) {
                return this.erroResponse(res, 'Setor não encontrado ou sem acesso', 404);
            }

            // Fazer ajuste
            const resultado = await this.estoqueModel.ajustarEstoque(
                produto_id,
                setor_id,
                nova_quantidade,
                req.usuario.id,
                motivo,
                lote_id
            );

            // Log de auditoria
            await this.logarAuditoria(
                req.usuario.id,
                'ADJUST_STOCK',
                'estoque',
                `${produto_id}-${setor_id}`,
                { quantidade_anterior: resultado.quantidade_anterior },
                { quantidade_nova: resultado.quantidade_nova, motivo }
            );

            return this.sucessoResponse(
                res,
                resultado,
                'Estoque ajustado com sucesso'
            );

        } catch (error) {
            console.error('Erro ao ajustar estoque:', error);
            next(error);
        }
    }

    /**
     * Reservar estoque
     */
    async reservar(req, res, next) {
        try {
            const { produto_id, setor_id, quantidade, lote_id } = req.body;
            const empresaId = req.usuario.empresa_id;

            // Validações básicas
            if (!produto_id || !setor_id || !quantidade || quantidade <= 0) {
                return this.erroResponse(
                    res,
                    'Produto, setor e quantidade são obrigatórios',
                    400
                );
            }

            // Verificar permissões
            if (!empresaId) {
                return this.erroResponse(res, 'Acesso negado', 403);
            }

            // Reservar estoque
            const resultado = await this.estoqueModel.reservarEstoque(
                produto_id,
                setor_id,
                quantidade,
                lote_id
            );

            if (!resultado) {
                return this.erroResponse(
                    res,
                    'Não foi possível reservar o estoque. Verifique disponibilidade.',
                    409
                );
            }

            return this.sucessoResponse(
                res,
                resultado,
                'Estoque reservado com sucesso'
            );

        } catch (error) {
            console.error('Erro ao reservar estoque:', error);
            next(error);
        }
    }

    /**
     * Liberar reserva de estoque
     */
    async liberarReserva(req, res, next) {
        try {
            const { produto_id, setor_id, quantidade, lote_id } = req.body;
            const empresaId = req.usuario.empresa_id;

            // Validações básicas
            if (!produto_id || !setor_id || !quantidade || quantidade <= 0) {
                return this.erroResponse(
                    res,
                    'Produto, setor e quantidade são obrigatórios',
                    400
                );
            }

            // Verificar permissões
            if (!empresaId) {
                return this.erroResponse(res, 'Acesso negado', 403);
            }

            // Liberar reserva
            const resultado = await this.estoqueModel.liberarReserva(
                produto_id,
                setor_id,
                quantidade,
                lote_id
            );

            if (!resultado) {
                return this.erroResponse(
                    res,
                    'Não foi possível liberar a reserva',
                    409
                );
            }

            return this.sucessoResponse(
                res,
                resultado,
                'Reserva liberada com sucesso'
            );

        } catch (error) {
            console.error('Erro ao liberar reserva:', error);
            next(error);
        }
    }

    /**
     * Transferir estoque entre setores
     */
    async transferir(req, res, next) {
        try {
            const { produto_id, setor_origem_id, setor_destino_id, quantidade, lote_id } = req.body;
            const empresaId = req.usuario.empresa_id;

            // Validações básicas
            if (!produto_id || !setor_origem_id || !setor_destino_id || !quantidade || quantidade <= 0) {
                return this.erroResponse(
                    res,
                    'Produto, setores de origem/destino e quantidade são obrigatórios',
                    400
                );
            }

            if (setor_origem_id === setor_destino_id) {
                return this.erroResponse(res, 'Setores de origem e destino devem ser diferentes', 400);
            }

            // Verificar permissões
            if (!empresaId) {
                return this.erroResponse(res, 'Acesso negado', 403);
            }

            if (req.usuario.nivel_hierarquia > 3) {
                return this.erroResponse(res, 'Sem permissão para transferir estoque', 403);
            }

            // Verificar se produto e setores pertencem à empresa
            const [produtoValido, setorOrigemValido, setorDestinoValido] = await Promise.all([
                ValidationService.verificarProdutoEmpresa(produto_id, empresaId),
                ValidationService.verificarSetorEmpresa(setor_origem_id, empresaId),
                ValidationService.verificarSetorEmpresa(setor_destino_id, empresaId)
            ]);

            if (!produtoValido) {
                return this.erroResponse(res, 'Produto não encontrado ou sem acesso', 404);
            }

            if (!setorOrigemValido || !setorDestinoValido) {
                return this.erroResponse(res, 'Setor não encontrado ou sem acesso', 404);
            }

            // Fazer transferência
            const resultado = await this.estoqueModel.transferirEstoque(
                produto_id,
                setor_origem_id,
                setor_destino_id,
                quantidade,
                req.usuario.id,
                lote_id
            );

            // Log de auditoria
            await this.logarAuditoria(
                req.usuario.id,
                'TRANSFER_STOCK',
                'estoque',
                resultado.movimentacao_id,
                null,
                resultado
            );

            return this.sucessoResponse(
                res,
                resultado,
                'Transferência realizada com sucesso'
            );

        } catch (error) {
            console.error('Erro ao transferir estoque:', error);
            next(error);
        }
    }

    /**
     * Obter estatísticas gerais do estoque
     */
    async estatisticas(req, res, next) {
        try {
            const empresaId = req.usuario.empresa_id;

            if (!empresaId) {
                return this.erroResponse(res, 'Acesso negado', 403);
            }

            const estatisticas = await this.estoqueModel.getEstatisticas(empresaId);

            return this.sucessoResponse(
                res,
                estatisticas,
                'Estatísticas do estoque obtidas'
            );

        } catch (error) {
            console.error('Erro ao obter estatísticas do estoque:', error);
            next(error);
        }
    }

    /**
     * Dashboard do estoque - resumo executivo
     */
    async dashboard(req, res, next) {
        try {
            const empresaId = req.usuario.empresa_id;

            if (!empresaId) {
                return this.erroResponse(res, 'Acesso negado', 403);
            }

            // Buscar dados em paralelo para performance
            const [
                estatisticas,
                estoqueBaixo,
                estoqueCritico,
                proximosVencimento,
                resumoFazendas
            ] = await Promise.all([
                this.estoqueModel.getEstatisticas(empresaId),
                this.estoqueModel.findEstoqueBaixo(empresaId, 5),
                this.estoqueModel.findEstoqueCritico(empresaId),
                this.estoqueModel.findProximosVencimento(empresaId, 15),
                this.estoqueModel.getResumoByFazenda(empresaId)
            ]);

            const dashboard = {
                estatisticas_gerais: estatisticas,
                alertas: {
                    estoque_baixo: estoqueBaixo,
                    estoque_critico: estoqueCritico,
                    proximos_vencimento: proximosVencimento
                },
                resumo_fazendas: resumoFazendas,
                timestamp: new Date().toISOString()
            };

            return this.sucessoResponse(
                res,
                dashboard,
                'Dashboard do estoque carregado'
            );

        } catch (error) {
            console.error('Erro ao carregar dashboard do estoque:', error);
            next(error);
        }
    }

    /**
     * Relatório detalhado do estoque
     */
    async relatorio(req, res, next) {
        try {
            const empresaId = req.usuario.empresa_id;
            const { formato = 'json', incluir_zerados = false } = req.query;

            if (!empresaId) {
                return this.erroResponse(res, 'Acesso negado', 403);
            }

            const options = {
                page: 1,
                limit: 10000, // Limite alto para relatório
                apenas_com_estoque: !incluir_zerados
            };

            const estoque = await this.estoqueModel.findByEmpresa(empresaId, options);

            if (formato === 'csv') {
                // TODO: Implementar exportação CSV
                return this.erroResponse(res, 'Exportação CSV em desenvolvimento', 501);
            }

            // Adicionar resumo no topo do relatório
            const estatisticas = await this.estoqueModel.getEstatisticas(empresaId);

            const relatorio = {
                resumo: estatisticas,
                itens: estoque,
                filtros: {
                    incluir_zerados,
                    data_geracao: new Date().toISOString()
                }
            };

            return this.sucessoResponse(
                res,
                relatorio,
                'Relatório de estoque gerado'
            );

        } catch (error) {
            console.error('Erro ao gerar relatório de estoque:', error);
            next(error);
        }
    }

    /**
     * Histórico de movimentações de um item de estoque
     */
    async historico(req, res, next) {
        try {
            const { produto_id, setor_id } = req.params;
            const { lote_id, limite = 50 } = req.query;
            const empresaId = req.usuario.empresa_id;

            if (!empresaId) {
                return this.erroResponse(res, 'Acesso negado', 403);
            }

            let sql = `
                SELECT 
                    m.id, m.data_movimentacao, m.numero_documento,
                    tm.nome as tipo_movimentacao, tm.operacao,
                    mi.quantidade, mi.valor_unitario,
                    u.nome as usuario_nome,
                    so.nome as origem_setor, sd.nome as destino_setor
                FROM movimentacao_itens mi
                INNER JOIN movimentacoes m ON mi.movimentacao_id = m.id
                INNER JOIN tipos_movimentacao tm ON m.tipo_movimentacao_id = tm.id
                INNER JOIN usuarios u ON m.usuario_criacao = u.id
                LEFT JOIN setores so ON m.origem_setor_id = so.id
                LEFT JOIN setores sd ON m.destino_setor_id = sd.id
                WHERE mi.produto_id = $1 
                    AND (m.origem_setor_id = $2 OR m.destino_setor_id = $2)
                    AND m.empresa_id = $3

            `;

            const params = [produto_id, setor_id, empresaId];

            if (lote_id) {
                sql += ` AND mi.lote_id = $4`;
                params.push(lote_id);
                sql += ` ORDER BY m.data_movimentacao DESC LIMIT $5`;
                params.push(limite);
            } else {
                sql += ` AND mi.lote_id IS NULL`;
                sql += ` ORDER BY m.data_movimentacao DESC LIMIT $4`;
                params.push(limite);
            }

            const result = await this.estoqueModel.raw(sql, params);

            return this.sucessoResponse(
                res,
                result,
                'Histórico de movimentações obtido'
            );

        } catch (error) {
            console.error('Erro ao obter histórico de movimentações:', error);
            next(error);
        }
    }

    /**
     * Verificar disponibilidade de estoque para uma operação
     */
    async verificarDisponibilidade(req, res, next) {
        try {
            const { produto_id, setor_id, quantidade_necessaria, lote_id } = req.query;
            const empresaId = req.usuario.empresa_id;

            // Validações básicas
            if (!produto_id || !setor_id || !quantidade_necessaria) {
                return this.erroResponse(
                    res,
                    'Produto, setor e quantidade necessária são obrigatórios',
                    400
                );
            }

            if (!empresaId) {
                return this.erroResponse(res, 'Acesso negado', 403);
            }

            let sql = `
                SELECT 
                    e.quantidade_atual,
                    e.quantidade_reservada,
                    e.quantidade_disponivel,
                    e.valor_unitario_medio,
                    p.nome as produto_nome,
                    s.nome as setor_nome,
                    l.numero_lote,
                    CASE 
                        WHEN e.quantidade_disponivel >= $3 THEN true
                        ELSE false
                    END as disponivel
                FROM estoque e
                INNER JOIN produtos p ON e.produto_id = p.id
                INNER JOIN setores s ON e.setor_id = s.id
                LEFT JOIN lotes l ON e.lote_id = l.id
                WHERE e.produto_id = $1 
                    AND e.setor_id = $2
                    AND p.empresa_id = $4
                    AND (e.lote_id = $5 OR (e.lote_id IS NULL AND $5 IS NULL))
            `;

            const params = [produto_id, setor_id, quantidade_necessaria, empresaId, lote_id];
            const result = await this.estoqueModel.raw(sql, params);

            const disponibilidade = result.length > 0 ? result[0] : {
                quantidade_atual: 0,
                quantidade_reservada: 0,
                quantidade_disponivel: 0,
                disponivel: false
            };

            return this.sucessoResponse(
                res,
                disponibilidade,
                'Disponibilidade verificada'
            );

        } catch (error) {
            console.error('Erro ao verificar disponibilidade:', error);
            next(error);
        }
    }

    /**
     * Buscar produtos sem movimentação recente
     */
    async produtosSemMovimentacao(req, res, next) {
        try {
            const empresaId = req.usuario.empresa_id;
            const { dias = 90, limite = 50 } = req.query;

            if (!empresaId) {
                return this.erroResponse(res, 'Acesso negado', 403);
            }

            const sql = `
                SELECT 
                    e.id, e.produto_id, e.quantidade_atual, e.valor_total,
                    e.data_ultima_movimentacao,
                    p.nome as produto_nome, p.codigo_interno,
                    s.nome as setor_nome,
                    s.fazenda_id, f.nome as fazenda_nome,
                    CURRENT_DATE - e.data_ultima_movimentacao as dias_sem_movimentacao
                FROM estoque e
                INNER JOIN produtos p ON e.produto_id = p.id
                INNER JOIN setores s ON e.setor_id = s.id
                INNER JOIN fazendas f ON s.fazenda_id = f.id
                WHERE p.empresa_id = $1 
                    AND p.ativo = true
                    AND e.quantidade_atual > 0
                    AND (e.data_ultima_movimentacao IS NULL 
                         OR e.data_ultima_movimentacao <= CURRENT_DATE - INTERVAL '$2 days')
                ORDER BY e.data_ultima_movimentacao ASC NULLS FIRST
                LIMIT $3
            `;

            const result = await this.estoqueModel.raw(sql, [empresaId, dias, limite]);

            return this.sucessoResponse(
                res,
                result,
                `Produtos sem movimentação há ${dias} dias listados`
            );

        } catch (error) {
            console.error('Erro ao buscar produtos sem movimentação:', error);
            next(error);
        }
    }
}

module.exports = new EstoqueController();