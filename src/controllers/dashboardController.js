// ===================================================================
// CONTROLLER - dashboardController.js (src/controllers/dashboardController.js)
// ===================================================================

const Dashboard = require('../models/Dashboard');
const { sucessoResponse, erroResponse } = require('../utils/responseUtils');

const dashboardController = {
    /**
     * Obter dados completos do dashboard
     */
    obterDashboard: async (req, res) => {
        try {
            const empresaId = req.usuario.empresa_id;
            const fazendaId = req.query.fazenda_id ? parseInt(req.query.fazenda_id) : null;

            // Verificar se usuário tem acesso à fazenda específica (se informada)
            if (fazendaId && req.usuario.nivel_hierarquia > 2) {
                // Verificar acesso do usuário à fazenda
                const { query } = require('../config/database');
                const verificacaoAcesso = await query(`
                    SELECT 1 FROM usuario_fazendas uf
                    INNER JOIN fazendas f ON uf.fazenda_id = f.id
                    WHERE uf.usuario_id = $1 AND f.id = $2 AND f.empresa_id = $3
                `, [req.usuario.id, fazendaId, empresaId]);

                if (verificacaoAcesso.rows.length === 0) {
                    return erroResponse(res, 'Acesso negado a esta fazenda', 403);
                }
            }

            // Buscar todos os dados do dashboard em paralelo
            const [
                resumoGeral,
                valorEstoque,
                movimentacoesRecentes,
                estatisticasSafras,
                produtosEstoqueBaixo,
                movimentacoesPorTipo,
                metricasAtivos,
                proximasManutencoes
            ] = await Promise.all([
                Dashboard.obterResumoGeral(empresaId, fazendaId),
                Dashboard.obterValorEstoque(empresaId, fazendaId),
                Dashboard.obterMovimentacoesRecentes(empresaId, fazendaId, 10),
                Dashboard.obterEstatisticasSafras(empresaId, fazendaId),
                Dashboard.obterProdutosEstoqueBaixo(empresaId, fazendaId),
                Dashboard.obterMovimentacoesPorTipo(empresaId, fazendaId),
                Dashboard.obterMetricasAtivos(empresaId, fazendaId),
                Dashboard.obterProximasManutencoes(empresaId, fazendaId, 10)
            ]);

            // Calcular métricas derivadas
            const alertas = {
                estoque_baixo: produtosEstoqueBaixo.length,
                manutencoes_pendentes: proximasManutencoes.length,
                safras_ativas: estatisticasSafras.find(s => s.status === 'andamento')?.quantidade || 0
            };

            const dadosDashboard = {
                resumo_geral: {
                    ...resumoGeral,
                    area_total: parseFloat(resumoGeral.area_total)
                },
                financeiro: {
                    valor_total_estoque: parseFloat(valorEstoque.valor_total_estoque),
                    valor_insumos: parseFloat(valorEstoque.valor_insumos),
                    valor_ativos: parseFloat(valorEstoque.valor_ativos),
                    produtos_em_estoque: parseInt(valorEstoque.produtos_em_estoque),
                    total_lotes: parseInt(valorEstoque.total_lotes)
                },
                movimentacoes: {
                    recentes: movimentacoesRecentes.map(mov => ({
                        ...mov,
                        valor_total: parseFloat(mov.valor_total) || 0,
                        data_movimentacao: mov.data_movimentacao
                    })),
                    por_tipo: movimentacoesPorTipo.map(tipo => ({
                        ...tipo,
                        valor_total: parseFloat(tipo.valor_total) || 0
                    }))
                },
                safras: estatisticasSafras.map(safra => ({
                    ...safra,
                    area_total: parseFloat(safra.area_total) || 0,
                    producao_estimada: parseFloat(safra.producao_estimada) || 0,
                    producao_real: parseFloat(safra.producao_real) || 0,
                    custo_total: parseFloat(safra.custo_total) || 0,
                    receita_total: parseFloat(safra.receita_total) || 0
                })),
                ativos: {
                    metricas: metricasAtivos.map(metrica => ({
                        ...metrica,
                        valor_total: parseFloat(metrica.valor_total) || 0
                    })),
                    proximas_manutencoes: proximasManutencoes
                },
                alertas: {
                    ...alertas,
                    produtos_estoque_baixo: produtosEstoqueBaixo.map(produto => ({
                        ...produto,
                        quantidade_total: parseFloat(produto.quantidade_total) || 0,
                        estoque_minimo: parseFloat(produto.estoque_minimo) || 0
                    }))
                },
                metadata: {
                    empresa_id: empresaId,
                    fazenda_id: fazendaId,
                    usuario: req.usuario.nome,
                    gerado_em: new Date().toISOString(),
                    nivel_acesso: req.usuario.nivel_hierarquia
                }
            };

            return sucessoResponse(res, dadosDashboard, 'Dashboard carregado com sucesso');

        } catch (error) {
            console.error('Erro ao obter dashboard:', error);
            return erroResponse(res, 'Erro interno do servidor', 500);
        }
    },

    /**
     * Obter apenas resumo rápido (para atualizações frequentes)
     */
    obterResumoRapido: async (req, res) => {
        try {
            const empresaId = req.usuario.empresa_id;
            const fazendaId = req.query.fazenda_id ? parseInt(req.query.fazenda_id) : null;

            const [resumoGeral, valorEstoque, alertas] = await Promise.all([
                Dashboard.obterResumoGeral(empresaId, fazendaId),
                Dashboard.obterValorEstoque(empresaId, fazendaId),
                Dashboard.obterProdutosEstoqueBaixo(empresaId, fazendaId)
            ]);

            const resumoRapido = {
                totais: {
                    fazendas: parseInt(resumoGeral.total_fazendas),
                    produtos: parseInt(resumoGeral.total_produtos),
                    safras_ativas: parseInt(resumoGeral.safras_ativas),
                    usuarios: parseInt(resumoGeral.total_usuarios)
                },
                financeiro: {
                    valor_estoque: parseFloat(valorEstoque.valor_total_estoque)
                },
                alertas: {
                    estoque_baixo: alertas.length
                },
                atualizado_em: new Date().toISOString()
            };

            return sucessoResponse(res, resumoRapido, 'Resumo rápido obtido com sucesso');

        } catch (error) {
            console.error('Erro ao obter resumo rápido:', error);
            return erroResponse(res, 'Erro interno do servidor', 500);
        }
    }
};

module.exports = dashboardController;