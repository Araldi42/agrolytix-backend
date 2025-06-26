/**
 * Model de Lote
 * Gerencia lotes de produtos para rastreabilidade
 * Controla validade, fabricação e movimentações por lote
 */

const BaseModel = require('./BaseModel');
const { query, getClient } = require('../config/database');

class Lote extends BaseModel {
    constructor() {
        super('lotes', 'id');

        // Campos que podem ser preenchidos em massa
        this.fillable = [
            'produto_id', 'numero_lote', 'data_fabricacao', 'data_vencimento',
            'quantidade_inicial', 'fornecedor_id', 'observacoes', 'ativo', 'atualizado_por'
        ];

        // Conversões de tipo automáticas
        this.casts = {
            'data_fabricacao': 'date',
            'data_vencimento': 'date',
            'quantidade_inicial': 'float',
            'ativo': 'boolean'
        };

        // Relacionamentos
        this.relationships = {
            produto: { table: 'produtos', foreign_key: 'produto_id', local_key: 'id' },
            fornecedor: { table: 'fornecedores', foreign_key: 'fornecedor_id', local_key: 'id' }
        };
    }

    /**
     * Buscar lotes por produto
     */
    async findByProduto(produtoId, options = {}) {
        const {
            apenas_ativos = true,
            com_estoque = false,
            vencimento_proximo = null,
            page = 1,
            limit = 50
        } = options;

        const offset = (page - 1) * limit;
        let paramIndex = 1;
        const params = [produtoId];
        const conditions = ['l.produto_id = $1'];

        let sql = `
            SELECT 
                l.id, l.numero_lote, l.data_fabricacao, l.data_vencimento,
                l.quantidade_inicial, l.observacoes, l.criado_em,
                p.nome as produto_nome, p.codigo_interno,
                f.nome as fornecedor_nome,
                COALESCE(SUM(e.quantidade_atual), 0) as estoque_atual,
                COUNT(DISTINCT mi.movimentacao_id) as total_movimentacoes,
                CASE 
                    WHEN l.data_vencimento IS NULL THEN 'SEM_VENCIMENTO'
                    WHEN l.data_vencimento <= CURRENT_DATE THEN 'VENCIDO'
                    WHEN l.data_vencimento <= CURRENT_DATE + INTERVAL '30 days' THEN 'VENCENDO'
                    ELSE 'VALIDO'
                END as status_vencimento,
                CASE 
                    WHEN l.data_vencimento IS NOT NULL 
                    THEN (l.data_vencimento - CURRENT_DATE) 
                    ELSE NULL 
                END as dias_para_vencer
            FROM lotes l
            INNER JOIN produtos p ON l.produto_id = p.id
            LEFT JOIN fornecedores f ON l.fornecedor_id = f.id
            LEFT JOIN estoque e ON l.id = e.lote_id
            LEFT JOIN movimentacao_itens mi ON l.id = mi.lote_id
        `;

        if (apenas_ativos) {
            conditions.push('l.ativo = true');
        }

        if (com_estoque) {
            conditions.push('e.quantidade_atual > 0');
        }

        if (vencimento_proximo) {
            paramIndex++;
            conditions.push(`l.data_vencimento <= CURRENT_DATE + INTERVAL '$${paramIndex} days'`);
            conditions.push('l.data_vencimento > CURRENT_DATE');
            params.push(vencimento_proximo);
        }

        sql += ` WHERE ${conditions.join(' AND ')}`;
        sql += ` GROUP BY l.id, p.nome, p.codigo_interno, f.nome`;
        sql += ` ORDER BY l.data_vencimento ASC NULLS LAST, l.numero_lote`;

        // Paginação
        paramIndex++;
        sql += ` LIMIT $${paramIndex}`;
        params.push(limit);

        paramIndex++;
        sql += ` OFFSET $${paramIndex}`;
        params.push(offset);

        const result = await query(sql, params);
        return result.rows.map(row => this.castAttributes(row));
    }

    /**
     * Buscar lotes por empresa
     */
    async findByEmpresa(empresaId, options = {}) {
        const {
            produto_id = null,
            status_vencimento = null,
            com_estoque = false,
            page = 1,
            limit = 50
        } = options;

        const offset = (page - 1) * limit;
        let paramIndex = 1;
        const params = [empresaId];
        const conditions = ['p.empresa_id = $1', 'l.ativo = true', 'p.ativo = true'];

        let sql = `
            SELECT 
                l.id, l.numero_lote, l.data_fabricacao, l.data_vencimento,
                l.quantidade_inicial, l.observacoes, l.criado_em,
                p.nome as produto_nome, p.codigo_interno,
                f.nome as fornecedor_nome,
                fa.nome as fazenda_nome,
                COALESCE(SUM(e.quantidade_atual), 0) as estoque_atual,
                CASE 
                    WHEN l.data_vencimento IS NULL THEN 'SEM_VENCIMENTO'
                    WHEN l.data_vencimento <= CURRENT_DATE THEN 'VENCIDO'
                    WHEN l.data_vencimento <= CURRENT_DATE + INTERVAL '30 days' THEN 'VENCENDO'
                    ELSE 'VALIDO'
                END as status_vencimento,
                CASE 
                    WHEN l.data_vencimento IS NOT NULL 
                    THEN (l.data_vencimento - CURRENT_DATE) 
                    ELSE NULL 
                END as dias_para_vencer
            FROM lotes l
            INNER JOIN produtos p ON l.produto_id = p.id
            INNER JOIN fazendas fa ON p.fazenda_id = fa.id
            LEFT JOIN fornecedores f ON l.fornecedor_id = f.id
            LEFT JOIN estoque e ON l.id = e.lote_id
        `;

        if (produto_id) {
            paramIndex++;
            conditions.push(`l.produto_id = $${paramIndex}`);
            params.push(produto_id);
        }

        if (com_estoque) {
            conditions.push('e.quantidade_atual > 0');
        }

        sql += ` WHERE ${conditions.join(' AND ')}`;
        sql += ` GROUP BY l.id, p.nome, p.codigo_interno, f.nome, fa.nome`;

        // Filtro por status de vencimento
        if (status_vencimento) {
            switch (status_vencimento) {
                case 'VENCIDO':
                    sql += ` HAVING l.data_vencimento <= CURRENT_DATE`;
                    break;
                case 'VENCENDO':
                    sql += ` HAVING l.data_vencimento <= CURRENT_DATE + INTERVAL '30 days' AND l.data_vencimento > CURRENT_DATE`;
                    break;
                case 'VALIDO':
                    sql += ` HAVING l.data_vencimento > CURRENT_DATE + INTERVAL '30 days' OR l.data_vencimento IS NULL`;
                    break;
            }
        }

        sql += ` ORDER BY l.data_vencimento ASC NULLS LAST, l.numero_lote`;

        // Paginação
        paramIndex++;
        sql += ` LIMIT $${paramIndex}`;
        params.push(limit);

        paramIndex++;
        sql += ` OFFSET $${paramIndex}`;
        params.push(offset);

        const result = await query(sql, params);
        return result.rows.map(row => this.castAttributes(row));
    }

    /**
     * Buscar lotes próximos do vencimento
     */
    async findProximosVencimento(empresaId, dias = 30) {
        const sql = `
            SELECT 
                l.id, l.numero_lote, l.data_vencimento,
                l.quantidade_inicial,
                p.nome as produto_nome, p.codigo_interno,
                fa.nome as fazenda_nome,
                COALESCE(SUM(e.quantidade_atual), 0) as estoque_atual,
                (l.data_vencimento - CURRENT_DATE) as dias_para_vencer
            FROM lotes l
            INNER JOIN produtos p ON l.produto_id = p.id
            INNER JOIN fazendas fa ON p.fazenda_id = fa.id
            LEFT JOIN estoque e ON l.id = e.lote_id
            WHERE p.empresa_id = $1 
                AND l.ativo = true 
                AND p.ativo = true
                AND l.data_vencimento IS NOT NULL
                AND l.data_vencimento <= CURRENT_DATE + INTERVAL '$2 days'
                AND l.data_vencimento > CURRENT_DATE
            GROUP BY l.id, p.nome, p.codigo_interno, fa.nome
            HAVING COALESCE(SUM(e.quantidade_atual), 0) > 0
            ORDER BY l.data_vencimento ASC
        `;

        const result = await query(sql, [empresaId, dias]);
        return result.rows;
    }

    /**
     * Buscar lotes vencidos com estoque
     */
    async findVencidosComEstoque(empresaId) {
        const sql = `
            SELECT 
                l.id, l.numero_lote, l.data_vencimento,
                p.nome as produto_nome, p.codigo_interno,
                fa.nome as fazenda_nome,
                COALESCE(SUM(e.quantidade_atual), 0) as estoque_atual,
                (CURRENT_DATE - l.data_vencimento) as dias_vencido
            FROM lotes l
            INNER JOIN produtos p ON l.produto_id = p.id
            INNER JOIN fazendas fa ON p.fazenda_id = fa.id
            LEFT JOIN estoque e ON l.id = e.lote_id
            WHERE p.empresa_id = $1 
                AND l.ativo = true 
                AND p.ativo = true
                AND l.data_vencimento IS NOT NULL
                AND l.data_vencimento < CURRENT_DATE
            GROUP BY l.id, p.nome, p.codigo_interno, fa.nome
            HAVING COALESCE(SUM(e.quantidade_atual), 0) > 0
            ORDER BY l.data_vencimento ASC
        `;

        const result = await query(sql, [empresaId]);
        return result.rows;
    }

    /**
     * Verificar se número de lote é único para o produto
     */
    async isNumeroLoteUnique(produtoId, numeroLote, excludeId = null) {
        let sql = `
            SELECT id FROM lotes 
            WHERE produto_id = $1 AND numero_lote = $2 AND ativo = true
        `;
        const params = [produtoId, numeroLote];

        if (excludeId) {
            sql += ` AND id != $3`;
            params.push(excludeId);
        }

        const result = await query(sql, params);
        return result.rows.length === 0;
    }

    /**
     * Buscar histórico de movimentações do lote
     */
    async getHistoricoMovimentacoes(loteId, limit = 50) {
        const sql = `
            SELECT 
                m.id, m.data_movimentacao, m.numero_documento,
                tm.nome as tipo_movimentacao, tm.operacao,
                mi.quantidade, mi.valor_unitario,
                so.nome as setor_origem, sd.nome as setor_destino,
                u.nome as usuario_nome
            FROM movimentacao_itens mi
            INNER JOIN movimentacoes m ON mi.movimentacao_id = m.id
            INNER JOIN tipos_movimentacao tm ON m.tipo_movimentacao_id = tm.id
            LEFT JOIN setores so ON m.origem_setor_id = so.id
            LEFT JOIN setores sd ON m.destino_setor_id = sd.id
            LEFT JOIN usuarios u ON m.usuario_criacao = u.id
            WHERE mi.lote_id = $1
            ORDER BY m.data_movimentacao DESC
            LIMIT $2
        `;

        const result = await query(sql, [loteId, limit]);
        return result.rows;
    }

    /**
     * Obter estoque atual do lote por setor
     */
    async getEstoquePorSetor(loteId) {
        const sql = `
            SELECT 
                e.setor_id, e.quantidade_atual, e.quantidade_reservada,
                e.valor_unitario_medio, e.data_ultima_movimentacao,
                s.nome as setor_nome, s.tipo as setor_tipo,
                s.fazenda_id, f.nome as fazenda_nome
            FROM estoque e
            INNER JOIN setores s ON e.setor_id = s.id
            INNER JOIN fazendas f ON s.fazenda_id = f.id
            WHERE e.lote_id = $1 AND e.quantidade_atual > 0
            ORDER BY s.nome
        `;

        const result = await query(sql, [loteId]);
        return result.rows;
    }

    /**
     * Gerar número de lote automático
     */
    async gerarNumeroLote(produtoId, prefixo = null) {
        // Buscar informações do produto para gerar prefixo se não fornecido
        if (!prefixo) {
            const produtoInfo = await query(`
                SELECT p.codigo_interno, p.nome, t.nome as tipo_nome
                FROM produtos p
                INNER JOIN tipos t ON p.tipo_id = t.id
                WHERE p.id = $1
            `, [produtoId]);

            if (produtoInfo.rows.length > 0) {
                const produto = produtoInfo.rows[0];
                prefixo = produto.codigo_interno ?
                    produto.codigo_interno.substring(0, 3).toUpperCase() :
                    produto.nome.substring(0, 3).toUpperCase();
            } else {
                prefixo = 'LOT';
            }
        }

        // Contar lotes existentes do produto
        const countResult = await query(`
            SELECT COUNT(*) + 1 as proximo_numero
            FROM lotes 
            WHERE produto_id = $1 AND ativo = true
        `, [produtoId]);

        const numero = String(countResult.rows[0].proximo_numero).padStart(4, '0');
        const dataAtual = new Date().toISOString().slice(0, 10).replace(/-/g, '');

        return `${prefixo}-${dataAtual}-${numero}`;
    }

    /**
     * Calcular estatísticas do lote
     */
    async getEstatisticas(loteId) {
        const sql = `
            SELECT 
                l.quantidade_inicial,
                COALESCE(SUM(e.quantidade_atual), 0) as quantidade_atual_total,
                l.quantidade_inicial - COALESCE(SUM(e.quantidade_atual), 0) as quantidade_consumida,
                CASE 
                    WHEN l.quantidade_inicial > 0 THEN 
                        ((l.quantidade_inicial - COALESCE(SUM(e.quantidade_atual), 0)) / l.quantidade_inicial) * 100
                    ELSE 0 
                END as percentual_consumido,
                COUNT(DISTINCT e.setor_id) as setores_com_estoque,
                COUNT(DISTINCT mi.movimentacao_id) as total_movimentacoes,
                MIN(m.data_movimentacao) as primeira_movimentacao,
                MAX(m.data_movimentacao) as ultima_movimentacao
            FROM lotes l
            LEFT JOIN estoque e ON l.id = e.lote_id
            LEFT JOIN movimentacao_itens mi ON l.id = mi.lote_id
            LEFT JOIN movimentacoes m ON mi.movimentacao_id = m.id
            WHERE l.id = $1
            GROUP BY l.id, l.quantidade_inicial
        `;

        const result = await query(sql, [loteId]);
        return result.rows.length > 0 ? result.rows[0] : null;
    }

    /**
     * Marcar lote como consumido (quando estoque zerado)
     */
    async marcarComoConsumido(loteId, usuarioId) {
        // Verificar se realmente não há mais estoque
        const estoqueCheck = await query(`
            SELECT COALESCE(SUM(quantidade_atual), 0) as total
            FROM estoque WHERE lote_id = $1
        `, [loteId]);

        const estoqueTotal = parseFloat(estoqueCheck.rows[0].total);

        if (estoqueTotal > 0) {
            throw new Error('Lote ainda possui estoque disponível');
        }

        const sql = `
            UPDATE lotes 
            SET observacoes = COALESCE(observacoes, '') || ' | CONSUMIDO TOTALMENTE EM ' || CURRENT_DATE,
                atualizado_em = NOW()
            WHERE id = $1 AND ativo = true
            RETURNING *
        `;

        const result = await query(sql, [loteId]);
        return result.rows.length > 0 ? this.castAttributes(result.rows[0]) : null;
    }

    /**
     * Validar dados do lote
     */
    validate(data) {
        const errors = [];

        if (!data.produto_id) {
            errors.push('Produto é obrigatório');
        }

        if (!data.numero_lote || data.numero_lote.trim().length === 0) {
            errors.push('Número do lote é obrigatório');
        }

        if (!data.quantidade_inicial || data.quantidade_inicial <= 0) {
            errors.push('Quantidade inicial deve ser maior que zero');
        }

        if (data.data_vencimento && data.data_fabricacao) {
            const dataVencimento = new Date(data.data_vencimento);
            const dataFabricacao = new Date(data.data_fabricacao);

            if (dataVencimento <= dataFabricacao) {
                errors.push('Data de vencimento deve ser posterior à data de fabricação');
            }
        }

        if (data.data_fabricacao) {
            const dataFabricacao = new Date(data.data_fabricacao);
            const hoje = new Date();

            if (dataFabricacao > hoje) {
                errors.push('Data de fabricação não pode ser futura');
            }
        }

        return errors;
    }
}

module.exports = Lote;