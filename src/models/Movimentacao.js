/**
 * Model Movimentacao
 * Representa movimentações de estoque
 */

const BaseModel = require('./BaseModel');

class Movimentacao extends BaseModel {
    constructor() {
        super('movimentacoes', 'id');
        
        this.fillable = [
            'empresa_id', 'fazenda_id', 'tipo_movimentacao_id',
            'numero_documento', 'data_movimentacao', 'descricao',
            'origem_setor_id', 'destino_setor_id', 'observacoes',
            'valor_total', 'status'
        ];

        this.casts = {
            ativo: 'boolean',
            data_movimentacao: 'date',
            valor_total: 'number',
            criado_em: 'date',
            atualizado_em: 'date'
        };
    }

    /**
     * Criar movimentação com itens
     */
    async createWithItens(dadosMovimentacao, itens, userId) {
        return await this.transaction(async (client) => {
            // Inserir movimentação
            const movimentacao = await this.create(dadosMovimentacao, userId);
            
            // Inserir itens
            for (const item of itens) {
                await this.createItem(client, movimentacao.id, item);
            }

            // Atualizar estoque
            await this.atualizarEstoque(client, movimentacao.id, dadosMovimentacao.tipo_movimentacao_id);

            return await this.findWithItens(movimentacao.id);
        });
    }

    /**
     * Criar item da movimentação
     */
    async createItem(client, movimentacaoId, item) {
        const sql = `
            INSERT INTO movimentacao_itens 
            (movimentacao_id, produto_id, quantidade, valor_unitario, valor_total, observacoes)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `;

        const valorTotal = item.quantidade * item.valor_unitario;
        const params = [
            movimentacaoId,
            item.produto_id,
            item.quantidade,
            item.valor_unitario,
            valorTotal,
            item.observacoes || null
        ];

        const result = await client.query(sql, params);
        return result.rows[0];
    }

    /**
     * Atualizar estoque baseado na movimentação
     */
    async atualizarEstoque(client, movimentacaoId, tipoMovimentacaoId) {
        // Buscar tipo de movimentação para saber a operação
        const tipoResult = await client.query('SELECT operacao FROM tipos_movimentacao WHERE id = $1', [tipoMovimentacaoId]);
        const operacao = tipoResult.rows[0]?.operacao;

        if (!operacao) return;

        // Buscar itens da movimentação
        const itensResult = await client.query(`
            SELECT produto_id, quantidade, valor_unitario 
            FROM movimentacao_itens 
            WHERE movimentacao_id = $1
        `, [movimentacaoId]);

        for (const item of itensResult.rows) {
            if (operacao === 'entrada') {
                await this.adicionarEstoque(client, item);
            } else if (operacao === 'saida') {
                await this.removerEstoque(client, item);
            }
        }
    }

    /**
     * Adicionar ao estoque
     */
    async adicionarEstoque(client, item) {
        const sql = `
            INSERT INTO estoque (produto_id, quantidade_atual, quantidade_disponivel, valor_unitario_medio)
            VALUES ($1, $2, $2, $3)
            ON CONFLICT (produto_id) 
            DO UPDATE SET
                quantidade_atual = estoque.quantidade_atual + $2,
                quantidade_disponivel = estoque.quantidade_disponivel + $2,
                valor_unitario_medio = (
                    (estoque.valor_unitario_medio * estoque.quantidade_atual) + 
                    ($3 * $2)
                ) / (estoque.quantidade_atual + $2),
                atualizado_em = CURRENT_TIMESTAMP
        `;

        await client.query(sql, [item.produto_id, item.quantidade, item.valor_unitario]);
    }

    /**
     * Remover do estoque
     */
    async removerEstoque(client, item) {
        const sql = `
            UPDATE estoque 
            SET 
                quantidade_atual = quantidade_atual - $2,
                quantidade_disponivel = quantidade_disponivel - $2,
                atualizado_em = CURRENT_TIMESTAMP
            WHERE produto_id = $1 AND quantidade_atual >= $2
        `;

        const result = await client.query(sql, [item.produto_id, item.quantidade]);
        
        if (result.rowCount === 0) {
            throw new Error(`Estoque insuficiente para o produto ID ${item.produto_id}`);
        }
    }

    /**
     * Buscar movimentação com itens
     */
    async findWithItens(id) {
        const sql = `
            SELECT 
                m.*,
                tm.nome as tipo_movimentacao_nome,
                tm.operacao,
                so.nome as setor_origem_nome,
                sd.nome as setor_destino_nome,
                u.nome as usuario_nome,
                json_agg(
                    json_build_object(
                        'id', mi.id,
                        'produto_id', mi.produto_id,
                        'produto_nome', p.nome,
                        'quantidade', mi.quantidade,
                        'valor_unitario', mi.valor_unitario,
                        'valor_total', mi.valor_total,
                        'observacoes', mi.observacoes
                    )
                ) as itens
            FROM movimentacoes m
            INNER JOIN tipos_movimentacao tm ON m.tipo_movimentacao_id = tm.id
            LEFT JOIN setores so ON m.origem_setor_id = so.id
            LEFT JOIN setores sd ON m.destino_setor_id = sd.id
            LEFT JOIN usuarios u ON m.usuario_criacao = u.id
            LEFT JOIN movimentacao_itens mi ON m.id = mi.movimentacao_id
            LEFT JOIN produtos p ON mi.produto_id = p.id
            WHERE m.id = $1
            GROUP BY m.id, tm.nome, tm.operacao, so.nome, sd.nome, u.nome
        `;

        const result = await this.customQuery(sql, [id]);
        return result.length > 0 ? result[0] : null;
    }

    /**
     * Buscar movimentações por empresa
     */
    async findByEmpresa(empresaId, options = {}) {
        const { dataInicio, dataFim, tipoMovimentacao, setor, ...baseOptions } = options;
        
        let sql = `
            SELECT 
                m.*,
                tm.nome as tipo_movimentacao_nome,
                tm.operacao,
                so.nome as setor_origem_nome,
                sd.nome as setor_destino_nome,
                u.nome as usuario_nome,
                COUNT(mi.id) as total_itens
            FROM movimentacoes m
            INNER JOIN tipos_movimentacao tm ON m.tipo_movimentacao_id = tm.id
            LEFT JOIN setores so ON m.origem_setor_id = so.id
            LEFT JOIN setores sd ON m.destino_setor_id = sd.id
            LEFT JOIN usuarios u ON m.usuario_criacao = u.id
            LEFT JOIN movimentacao_itens mi ON m.id = mi.movimentacao_id
            WHERE m.empresa_id = $1 AND m.ativo = true
        `;

        const params = [empresaId];
        let paramIndex = 2;

        if (dataInicio) {
            sql += ` AND m.data_movimentacao >= $${paramIndex}`;
            params.push(dataInicio);
            paramIndex++;
        }

        if (dataFim) {
            sql += ` AND m.data_movimentacao <= $${paramIndex}`;
            params.push(dataFim);
            paramIndex++;
        }

        if (tipoMovimentacao) {
            sql += ` AND m.tipo_movimentacao_id = $${paramIndex}`;
            params.push(tipoMovimentacao);
            paramIndex++;
        }

        if (setor) {
            sql += ` AND (m.origem_setor_id = $${paramIndex} OR m.destino_setor_id = $${paramIndex})`;
            params.push(setor);
            paramIndex++;
        }

        sql += ` GROUP BY m.id, tm.nome, tm.operacao, so.nome, sd.nome, u.nome`;
        sql += ` ORDER BY m.data_movimentacao DESC`;

        if (baseOptions.limit) {
            sql += ` LIMIT $${paramIndex}`;
            params.push(baseOptions.limit);
            paramIndex++;
        }

        if (baseOptions.offset) {
            sql += ` OFFSET $${paramIndex}`;
            params.push(baseOptions.offset);
        }

        return await this.customQuery(sql, params);
    }

    /**
     * Relatório de movimentações por período
     */
    async getRelatorioMovimentacoes(empresaId, dataInicio, dataFim) {
        const sql = `
            SELECT 
                tm.nome as tipo_movimentacao,
                tm.operacao,
                COUNT(m.id) as total_movimentacoes,
                SUM(m.valor_total) as valor_total,
                SUM(CASE WHEN tm.operacao = 'entrada' THEN m.valor_total ELSE 0 END) as valor_entradas,
                SUM(CASE WHEN tm.operacao = 'saida' THEN m.valor_total ELSE 0 END) as valor_saidas
            FROM movimentacoes m
            INNER JOIN tipos_movimentacao tm ON m.tipo_movimentacao_id = tm.id
            WHERE m.empresa_id = $1 
                AND m.data_movimentacao BETWEEN $2 AND $3
                AND m.ativo = true
            GROUP BY tm.id, tm.nome, tm.operacao
            ORDER BY tm.nome
        `;

        return await this.customQuery(sql, [empresaId, dataInicio, dataFim]);
    }

    /**
     * Cancelar movimentação
     */
    async cancelar(id, userId, motivo) {
        return await this.transaction(async (client) => {
            // Buscar movimentação com tipo
            const movResult = await client.query(`
                SELECT m.*, tm.operacao 
                FROM movimentacoes m
                INNER JOIN tipos_movimentacao tm ON m.tipo_movimentacao_id = tm.id
                WHERE m.id = $1 AND m.status = 'ativo'
            `, [id]);

            if (movResult.rows.length === 0) {
                throw new Error('Movimentação não encontrada ou já cancelada');
            }

            const movimentacao = movResult.rows[0];

            // Reverter estoque
            await this.reverterEstoque(client, id, movimentacao.operacao);

            // Marcar como cancelada
            await client.query(`
                UPDATE movimentacoes 
                SET status = 'cancelado', 
                    observacoes = CONCAT(observacoes, ' - CANCELADO: ', $2),
                    atualizado_por = $3,
                    atualizado_em = CURRENT_TIMESTAMP
                WHERE id = $1
            `, [id, motivo, userId]);

            return await this.findWithItens(id);
        });
    }

    /**
     * Reverter estoque de uma movimentação cancelada
     */
    async reverterEstoque(client, movimentacaoId, operacao) {
        const itensResult = await client.query(`
            SELECT produto_id, quantidade, valor_unitario 
            FROM movimentacao_itens 
            WHERE movimentacao_id = $1
        `, [movimentacaoId]);

        for (const item of itensResult.rows) {
            if (operacao === 'entrada') {
                // Reverter entrada = remover do estoque
                await this.removerEstoque(client, item);
            } else if (operacao === 'saida') {
                // Reverter saída = adicionar ao estoque
                await this.adicionarEstoque(client, item);
            }
        }
    }
}

module.exports = new Movimentacao(); 