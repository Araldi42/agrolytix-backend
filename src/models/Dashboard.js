// ===================================================================
// MODEL - Dashboard.js (src/models/Dashboard.js)
// ===================================================================

const { query } = require('../config/database');

class Dashboard {
    /**
     * Obter resumo geral da empresa/fazenda
     */
    static async obterResumoGeral(empresaId, fazendaId = null) {
        try {
            let condicaoFazenda = fazendaId ? 'AND f.id = $2' : '';
            let parametros = fazendaId ? [empresaId, fazendaId] : [empresaId];

            const consulta = `
                SELECT 
                    COUNT(DISTINCT f.id) as total_fazendas,
                    COUNT(DISTINCT s.id) as total_setores,
                    COUNT(DISTINCT p.id) as total_produtos,
                    COUNT(DISTINCT p.id) FILTER (WHERE p.categoria_produto = 'ativo') as total_ativos,
                    COUNT(DISTINCT p.id) FILTER (WHERE p.categoria_produto = 'insumo') as total_insumos,
                    COUNT(DISTINCT sf.id) as total_safras,
                    COUNT(DISTINCT sf.id) FILTER (WHERE sf.status = 'andamento') as safras_ativas,
                    COUNT(DISTINCT u.id) as total_usuarios,
                    COALESCE(SUM(f.area_total_hectares), 0) as area_total
                FROM fazendas f
                LEFT JOIN setores s ON f.id = s.fazenda_id AND s.ativo = true
                LEFT JOIN produtos p ON f.id = p.fazenda_id AND p.ativo = true
                LEFT JOIN safras sf ON f.id = sf.fazenda_id AND sf.ativo = true
                LEFT JOIN usuarios u ON f.empresa_id = u.empresa_id AND u.ativo = true
                WHERE f.empresa_id = $1 AND f.ativo = true ${condicaoFazenda}
            `;

            const resultado = await query(consulta, parametros);
            return resultado.rows[0];
        } catch (error) {
            console.error('Erro ao obter resumo geral:', error);
            throw error;
        }
    }

    /**
     * Obter valor total do estoque
     */
    static async obterValorEstoque(empresaId, fazendaId = null) {
        try {
            let condicaoFazenda = fazendaId ? 'AND f.id = $2' : '';
            let parametros = fazendaId ? [empresaId, fazendaId] : [empresaId];

            const consulta = `
                SELECT 
                    COALESCE(SUM(e.valor_total), 0) as valor_total_estoque,
                    COALESCE(SUM(e.valor_total) FILTER (WHERE p.categoria_produto = 'insumo'), 0) as valor_insumos,
                    COALESCE(SUM(e.valor_total) FILTER (WHERE p.categoria_produto = 'ativo'), 0) as valor_ativos,
                    COUNT(DISTINCT p.id) as produtos_em_estoque,
                    COUNT(DISTINCT l.id) as total_lotes
                FROM estoque e
                INNER JOIN produtos p ON e.produto_id = p.id
                INNER JOIN fazendas f ON p.fazenda_id = f.id
                LEFT JOIN lotes l ON e.lote_id = l.id
                WHERE f.empresa_id = $1 AND p.ativo = true ${condicaoFazenda}
                AND e.quantidade_atual > 0
            `;

            const resultado = await query(consulta, parametros);
            return resultado.rows[0];
        } catch (error) {
            console.error('Erro ao obter valor do estoque:', error);
            throw error;
        }
    }

    /**
     * Obter movimentações recentes (últimos 30 dias)
     */
    static async obterMovimentacoesRecentes(empresaId, fazendaId = null, limite = 10) {
        try {
            let condicaoFazenda = fazendaId ? 'AND m.fazenda_id = $2' : '';
            let parametros = fazendaId ? [empresaId, fazendaId, limite] : [empresaId, limite];
            let limiteIndex = fazendaId ? '$3' : '$2';

            const consulta = `
                SELECT 
                    m.id,
                    m.data_movimentacao,
                    tm.nome as tipo_movimentacao,
                    tm.tipo as categoria_tipo,
                    m.numero_documento,
                    m.valor_total,
                    m.observacoes,
                    f.nome as fazenda_nome,
                    u.nome as usuario_nome,
                    COUNT(mi.id) as total_itens
                FROM movimentacoes m
                INNER JOIN tipos_movimentacao tm ON m.tipo_movimentacao_id = tm.id
                INNER JOIN fazendas f ON m.fazenda_id = f.id
                INNER JOIN usuarios u ON m.usuario_criacao = u.id
                LEFT JOIN movimentacao_itens mi ON m.id = mi.movimentacao_id
                WHERE m.empresa_id = $1 ${condicaoFazenda}
                AND m.data_movimentacao >= CURRENT_DATE - INTERVAL '30 days'
                AND m.status = 'confirmado'
                GROUP BY m.id, tm.nome, tm.tipo, f.nome, u.nome
                ORDER BY m.data_movimentacao DESC
                LIMIT ${limiteIndex}
            `;

            const resultado = await query(consulta, parametros);
            return resultado.rows;
        } catch (error) {
            console.error('Erro ao obter movimentações recentes:', error);
            throw error;
        }
    }

    /**
     * Obter estatísticas das safras
     */
    static async obterEstatisticasSafras(empresaId, fazendaId = null) {
        try {
            let condicaoFazenda = fazendaId ? 'AND f.id = $2' : '';
            let parametros = fazendaId ? [empresaId, fazendaId] : [empresaId];

            const consulta = `
                SELECT 
                    s.status,
                    COUNT(*) as quantidade,
                    COALESCE(SUM(s.area_hectares), 0) as area_total,
                    COALESCE(SUM(s.producao_estimada), 0) as producao_estimada,
                    COALESCE(SUM(s.producao_real), 0) as producao_real,
                    COALESCE(SUM(s.custo_total), 0) as custo_total,
                    COALESCE(SUM(s.receita_total), 0) as receita_total
                FROM safras s
                INNER JOIN fazendas f ON s.fazenda_id = f.id
                WHERE f.empresa_id = $1 ${condicaoFazenda}
                AND s.ativo = true
                GROUP BY s.status
                ORDER BY s.status
            `;

            const resultado = await query(consulta, parametros);
            return resultado.rows;
        } catch (error) {
            console.error('Erro ao obter estatísticas das safras:', error);
            throw error;
        }
    }

    /**
     * Obter produtos com estoque baixo
     */
    static async obterProdutosEstoqueBaixo(empresaId, fazendaId = null) {
        try {
            let condicaoFazenda = fazendaId ? 'AND f.id = $2' : '';
            let parametros = fazendaId ? [empresaId, fazendaId] : [empresaId];

            const consulta = `
                SELECT 
                    p.id,
                    p.nome,
                    p.codigo_interno,
                    c.nome as categoria_nome,
                    t.nome as tipo_nome,
                    t.estoque_minimo,
                    SUM(e.quantidade_atual) as quantidade_total,
                    f.nome as fazenda_nome,
                    p.categoria_produto
                FROM produtos p
                INNER JOIN tipos t ON p.tipo_id = t.id
                INNER JOIN categorias c ON t.categoria_id = c.id
                INNER JOIN fazendas f ON p.fazenda_id = f.id
                LEFT JOIN estoque e ON p.id = e.produto_id
                WHERE f.empresa_id = $1 ${condicaoFazenda}
                AND p.ativo = true
                AND t.estoque_minimo IS NOT NULL
                AND t.estoque_minimo > 0
                GROUP BY p.id, p.nome, p.codigo_interno, c.nome, t.nome, t.estoque_minimo, f.nome, p.categoria_produto
                HAVING COALESCE(SUM(e.quantidade_atual), 0) <= t.estoque_minimo
                ORDER BY (COALESCE(SUM(e.quantidade_atual), 0) / NULLIF(t.estoque_minimo, 0)) ASC
                LIMIT 20
            `;

            const resultado = await query(consulta, parametros);
            return resultado.rows;
        } catch (error) {
            console.error('Erro ao obter produtos com estoque baixo:', error);
            throw error;
        }
    }

    /**
     * Obter movimentações por tipo (últimos 30 dias)
     */
    static async obterMovimentacoesPorTipo(empresaId, fazendaId = null) {
        try {
            let condicaoFazenda = fazendaId ? 'AND m.fazenda_id = $2' : '';
            let parametros = fazendaId ? [empresaId, fazendaId] : [empresaId];

            const consulta = `
                SELECT 
                    tm.nome as tipo_nome,
                    tm.tipo as categoria,
                    COUNT(m.id) as total_movimentacoes,
                    COALESCE(SUM(m.valor_total), 0) as valor_total,
                    COUNT(DISTINCT m.fazenda_id) as fazendas_envolvidas
                FROM movimentacoes m
                INNER JOIN tipos_movimentacao tm ON m.tipo_movimentacao_id = tm.id
                WHERE m.empresa_id = $1 ${condicaoFazenda}
                AND m.data_movimentacao >= CURRENT_DATE - INTERVAL '30 days'
                AND m.status = 'confirmado'
                GROUP BY tm.nome, tm.tipo
                ORDER BY total_movimentacoes DESC
            `;

            const resultado = await query(consulta, parametros);
            return resultado.rows;
        } catch (error) {
            console.error('Erro ao obter movimentações por tipo:', error);
            throw error;
        }
    }

    /**
     * Obter métricas dos ativos
     */
    static async obterMetricasAtivos(empresaId, fazendaId = null) {
        try {
            let condicaoFazenda = fazendaId ? 'AND f.id = $2' : '';
            let parametros = fazendaId ? [empresaId, fazendaId] : [empresaId];

            const consulta = `
                SELECT 
                    p.status,
                    COUNT(*) as quantidade,
                    COALESCE(SUM(p.valor_aquisicao), 0) as valor_total,
                    COUNT(*) FILTER (WHERE p.data_aquisicao >= CURRENT_DATE - INTERVAL '1 year') as adquiridos_ultimo_ano,
                    COUNT(DISTINCT m.id) as total_manutencoes
                FROM produtos p
                INNER JOIN fazendas f ON p.fazenda_id = f.id
                LEFT JOIN manutencoes m ON p.id = m.produto_id
                WHERE f.empresa_id = $1 ${condicaoFazenda}
                AND p.categoria_produto = 'ativo'
                AND p.ativo = true
                GROUP BY p.status
                ORDER BY quantidade DESC
            `;

            const resultado = await query(consulta, parametros);
            return resultado.rows;
        } catch (error) {
            console.error('Erro ao obter métricas dos ativos:', error);
            throw error;
        }
    }

    /**
     * Obter próximas manutenções
     */
    static async obterProximasManutencoes(empresaId, fazendaId = null, limite = 10) {
        try {
            let condicaoFazenda = fazendaId ? 'AND f.id = $2' : '';
            let parametros = fazendaId ? [empresaId, fazendaId, limite] : [empresaId, limite];
            let limiteIndex = fazendaId ? '$3' : '$2';

            const consulta = `
                SELECT 
                    p.id as produto_id,
                    p.nome as produto_nome,
                    p.codigo_interno,
                    m.proximo_servico_horas,
                    m.proximo_servico_km,
                    m.data_manutencao as ultima_manutencao,
                    m.tipo_manutencao as ultimo_tipo,
                    f.nome as fazenda_nome,
                    CASE 
                        WHEN m.proximo_servico_horas IS NOT NULL THEN 'horas'
                        WHEN m.proximo_servico_km IS NOT NULL THEN 'km'
                        ELSE 'tempo'
                    END as tipo_controle
                FROM produtos p
                INNER JOIN fazendas f ON p.fazenda_id = f.id
                LEFT JOIN LATERAL (
                    SELECT * FROM manutencoes m2 
                    WHERE m2.produto_id = p.id 
                    ORDER BY m2.data_manutencao DESC 
                    LIMIT 1
                ) m ON true
                WHERE f.empresa_id = $1 ${condicaoFazenda}
                AND p.categoria_produto = 'ativo'
                AND p.status = 'ativo'
                AND p.ativo = true
                AND (m.proximo_servico_horas IS NOT NULL OR m.proximo_servico_km IS NOT NULL)
                ORDER BY m.data_manutencao ASC
                LIMIT ${limiteIndex}
            `;

            const resultado = await query(consulta, parametros);
            return resultado.rows;
        } catch (error) {
            console.error('Erro ao obter próximas manutenções:', error);
            throw error;
        }
    }
}

module.exports = Dashboard;