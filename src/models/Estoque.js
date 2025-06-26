/**
 * Model de Estoque
 * Controla os níveis de estoque por produto/setor/lote
 * Funciona em conjunto com as movimentações
 */

const BaseModel = require('./BaseModel');
const { query, getClient } = require('../config/database');

class Estoque extends BaseModel {
    constructor() {
        super('estoque', 'id');

        // Campos que podem ser preenchidos em massa
        this.fillable = [
            'produto_id', 'setor_id', 'lote_id', 'quantidade_atual',
            'quantidade_reservada', 'valor_unitario_medio'
        ];

        // Conversões de tipo automáticas
        this.casts = {
            'quantidade_atual': 'float',
            'quantidade_reservada': 'float',
            'quantidade_disponivel': 'float',
            'valor_unitario_medio': 'float',
            'valor_total': 'float'
        };

        // Relacionamentos
        this.relationships = {
            produto: { table: 'produtos', foreign_key: 'produto_id', local_key: 'id' },
            setor: { table: 'setores', foreign_key: 'setor_id', local_key: 'id' },
            lote: { table: 'lotes', foreign_key: 'lote_id', local_key: 'id' }
        };
    }

    /**
     * Buscar estoque por empresa
     */
    async findByEmpresa(empresaId, options = {}) {
        const {
            fazenda_id = null,
            setor_id = null,
            produto_id = null,
            categoria_produto = null,
            apenas_com_estoque = true,
            page = 1,
            limit = 50
        } = options;

        const offset = (page - 1) * limit;
        let paramIndex = 1;
        const params = [empresaId];
        const conditions = ['p.empresa_id = $1', 'p.ativo = true'];

        let sql = `
            SELECT 
                e.id, e.produto_id, e.setor_id, e.lote_id,
                e.quantidade_atual, e.quantidade_reservada, e.quantidade_disponivel,
                e.valor_unitario_medio, e.valor_total, e.data_ultima_movimentacao,
                p.nome as produto_nome, p.codigo_interno, p.categoria_produto,
                s.nome as setor_nome,
                s.fazenda_id, f.nome as fazenda_nome,
                t.nome as tipo_nome, t.estoque_minimo, t.estoque_maximo,
                l.numero_lote, l.data_vencimento,
                CASE 
                    WHEN t.estoque_minimo IS NOT NULL AND e.quantidade_atual <= t.estoque_minimo THEN 'CRÍTICO'
                    WHEN t.estoque_minimo IS NOT NULL AND e.quantidade_atual <= t.estoque_minimo * 1.5 THEN 'BAIXO'
                    WHEN t.estoque_maximo IS NOT NULL AND e.quantidade_atual >= t.estoque_maximo THEN 'ALTO'
                    ELSE 'NORMAL'
                END as status_estoque
            FROM estoque e
            INNER JOIN produtos p ON e.produto_id = p.id
            INNER JOIN setores s ON e.setor_id = s.id
            INNER JOIN fazendas f ON s.fazenda_id = f.id
            INNER JOIN tipos t ON p.tipo_id = t.id
            LEFT JOIN lotes l ON e.lote_id = l.id
        `;

        // Filtros dinâmicos
        if (fazenda_id) {
            paramIndex++;
            conditions.push(`f.id = ${paramIndex}`);
            params.push(fazenda_id);
        }

        if (setor_id) {
            paramIndex++;
            conditions.push(`e.setor_id = ${paramIndex}`);
            params.push(setor_id);
        }

        if (produto_id) {
            paramIndex++;
            conditions.push(`e.produto_id = ${paramIndex}`);
            params.push(produto_id);
        }

        if (categoria_produto) {
            paramIndex++;
            conditions.push(`p.categoria_produto = ${paramIndex}`);
            params.push(categoria_produto);
        }

        if (apenas_com_estoque) {
            conditions.push('e.quantidade_atual > 0');
        }

        sql += ` WHERE ${conditions.join(' AND ')}`;
        sql += ` ORDER BY p.nome, s.nome`;

        // Paginação
        paramIndex++;
        sql += ` LIMIT ${paramIndex}`;
        params.push(limit);

        paramIndex++;
        sql += ` OFFSET ${paramIndex}`;
        params.push(offset);

        const result = await query(sql, params);
        return result.rows.map(row => this.castAttributes(row));
    }

    /**
     * Buscar estoque de um produto específico
     */
    async findByProduto(produtoId, empresaId = null) {
        let sql = `
            SELECT 
                e.*,
                s.nome as setor_nome,
                s.fazenda_id, f.nome as fazenda_nome,
                l.numero_lote, l.data_vencimento,
                p.nome as produto_nome, p.codigo_interno
            FROM estoque e
            INNER JOIN produtos p ON e.produto_id = p.id
            INNER JOIN setores s ON e.setor_id = s.id
            INNER JOIN fazendas f ON s.fazenda_id = f.id
            LEFT JOIN lotes l ON e.lote_id = l.id
            WHERE e.produto_id = $1
        `;

        const params = [produtoId];

        if (empresaId) {
            sql += ` AND p.empresa_id = $2`;
            params.push(empresaId);
        }

        sql += ` ORDER BY s.nome, l.numero_lote`;

        const result = await query(sql, params);
        return result.rows.map(row => this.castAttributes(row));
    }

    /**
     * Buscar produtos com estoque baixo
     */
    async findEstoqueBaixo(empresaId, limite = 20) {
        const sql = `
            SELECT 
                p.id, p.nome as produto_nome, p.codigo_interno,
                t.nome as tipo_nome, t.estoque_minimo,
                SUM(e.quantidade_atual) as estoque_atual,
                p.fazenda_id, f.nome as fazenda_nome,
                COUNT(e.id) as locais_estoque,
                (SUM(e.quantidade_atual) / NULLIF(t.estoque_minimo, 0)) * 100 as percentual_estoque
            FROM produtos p
            INNER JOIN tipos t ON p.tipo_id = t.id
            LEFT JOIN estoque e ON p.id = e.produto_id AND e.quantidade_atual > 0
            LEFT JOIN setores s ON e.setor_id = s.id
            LEFT JOIN fazendas f ON s.fazenda_id = f.id
            WHERE p.empresa_id = $1 
                AND p.ativo = true 
                AND p.categoria_produto = 'insumo'
                AND t.estoque_minimo IS NOT NULL
            GROUP BY p.id, p.nome, p.codigo_interno, t.nome, t.estoque_minimo, p.fazenda_id, f.nome
            HAVING SUM(e.quantidade_atual) <= t.estoque_minimo
            ORDER BY percentual_estoque ASC
            LIMIT $2
        `;

        const result = await query(sql, [empresaId, limite]);
        return result.rows;
    }

    /**
     * Buscar produtos com estoque crítico (zerado)
     */
    async findEstoqueCritico(empresaId) {
        const sql = `
            SELECT 
                p.id, p.nome as produto_nome, p.codigo_interno,
                t.nome as tipo_nome,
                p.fazenda_id, f.nome as fazenda_nome,
                COALESCE(SUM(e.quantidade_atual), 0) as estoque_atual
            FROM produtos p
            INNER JOIN tipos t ON p.tipo_id = t.id
            INNER JOIN fazendas f ON p.fazenda_id = f.id
            LEFT JOIN estoque e ON p.id = e.produto_id
            WHERE p.empresa_id = $1 
                AND p.ativo = true 
                AND p.categoria_produto = 'insumo'
            GROUP BY p.id, p.nome, p.codigo_interno, t.nome, p.fazenda_id, f.nome
            HAVING COALESCE(SUM(e.quantidade_atual), 0) = 0
            ORDER BY p.nome
        `;

        const result = await query(sql, [empresaId]);
        return result.rows;
    }

    /**
     * Buscar produtos próximos do vencimento
     */
    async findProximosVencimento(empresaId, diasAlerta = 30) {
        const sql = `
            SELECT 
                e.id, e.quantidade_atual,
                p.nome as produto_nome, p.codigo_interno,
                l.numero_lote, l.data_vencimento,
                s.nome as setor_nome,
                s.fazenda_id, f.nome as fazenda_nome,
                (l.data_vencimento - CURRENT_DATE) as dias_para_vencer
            FROM estoque e
            INNER JOIN produtos p ON e.produto_id = p.id
            INNER JOIN lotes l ON e.lote_id = l.id
            INNER JOIN setores s ON e.setor_id = s.id
            INNER JOIN fazendas f ON s.fazenda_id = f.id
            WHERE p.empresa_id = $1 
                AND p.ativo = true
                AND e.quantidade_atual > 0
                AND l.data_vencimento IS NOT NULL
                AND l.data_vencimento <= CURRENT_DATE + INTERVAL '$2 days'
            ORDER BY l.data_vencimento ASC
        `;

        const result = await query(sql, [empresaId, diasAlerta]);
        return result.rows;
    }

    /**
     * Obter resumo do estoque por fazenda
     */
    async getResumoByFazenda(empresaId) {
        const sql = `
            SELECT 
                f.id as fazenda_id, f.nome as fazenda_nome,
                COUNT(DISTINCT p.id) as total_produtos,
                COUNT(e.id) as total_posicoes_estoque,
                SUM(e.valor_total) as valor_total_estoque,
                COUNT(CASE WHEN e.quantidade_atual <= COALESCE(t.estoque_minimo, 0) THEN 1 END) as produtos_estoque_baixo
            FROM fazendas f
            LEFT JOIN setores s ON f.id = s.fazenda_id
            LEFT JOIN estoque e ON s.id = e.setor_id AND e.quantidade_atual > 0
            LEFT JOIN produtos p ON e.produto_id = p.id
            LEFT JOIN tipos t ON p.tipo_id = t.id
            WHERE f.empresa_id = $1 AND f.ativo = true
            GROUP BY f.id, f.nome
            ORDER BY f.nome
        `;

        const result = await query(sql, [empresaId]);
        return result.rows;
    }

    /**
     * Atualizar estoque manualmente (ajuste)
     */
    async ajustarEstoque(produtoId, setorId, novaQuantidade, usuarioId, motivo = null, loteId = null) {
        const client = await getClient();

        try {
            await client.query('BEGIN');

            // Buscar estoque atual
            let estoqueAtual = null;
            const consultaAtual = `
                SELECT * FROM estoque 
                WHERE produto_id = $1 AND setor_id = $2 
                AND (lote_id = $3 OR (lote_id IS NULL AND $3 IS NULL))
            `;

            const resultAtual = await client.query(consultaAtual, [produtoId, setorId, loteId]);

            if (resultAtual.rows.length > 0) {
                estoqueAtual = resultAtual.rows[0];
            }

            const quantidadeAnterior = estoqueAtual ? estoqueAtual.quantidade_atual : 0;
            const diferenca = novaQuantidade - quantidadeAnterior;

            if (estoqueAtual) {
                // Atualizar estoque existente
                await client.query(`
                    UPDATE estoque 
                    SET quantidade_atual = $1, data_ultima_movimentacao = NOW(), atualizado_em = NOW()
                    WHERE id = $2
                `, [novaQuantidade, estoqueAtual.id]);
            } else if (novaQuantidade > 0) {
                // Criar novo registro de estoque
                await client.query(`
                    INSERT INTO estoque (produto_id, setor_id, lote_id, quantidade_atual, data_ultima_movimentacao)
                    VALUES ($1, $2, $3, $4, NOW())
                `, [produtoId, setorId, loteId, novaQuantidade]);
            }

            // Registrar ajuste como movimentação
            const tipoAjuste = diferenca > 0 ? 8 : 9; // Ajuste positivo ou negativo

            await client.query(`
                INSERT INTO movimentacoes (
                    empresa_id, fazenda_id, tipo_movimentacao_id, numero_documento,
                    data_movimentacao, destino_setor_id, observacoes, status, usuario_criacao
                ) VALUES (
                    (SELECT empresa_id FROM produtos WHERE id = $1),
                    (SELECT fazenda_id FROM produtos WHERE id = $1),
                    $2, 
                    'AJUSTE-' || TO_CHAR(NOW(), 'YYYYMMDD-HH24MISS'),
                    NOW(), $3, $4, 'confirmado', $5
                ) RETURNING id
            `, [produtoId, tipoAjuste, setorId, motivo || 'Ajuste manual de estoque', usuarioId]);

            await client.query('COMMIT');

            return {
                produto_id: produtoId,
                setor_id: setorId,
                lote_id: loteId,
                quantidade_anterior: quantidadeAnterior,
                quantidade_nova: novaQuantidade,
                diferenca: diferenca
            };

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Reservar estoque para uma operação
     */
    async reservarEstoque(produtoId, setorId, quantidade, loteId = null) {
        const sql = `
            UPDATE estoque 
            SET quantidade_reservada = quantidade_reservada + $3,
                atualizado_em = NOW()
            WHERE produto_id = $1 AND setor_id = $2 
                AND (lote_id = $4 OR (lote_id IS NULL AND $4 IS NULL))
                AND quantidade_disponivel >= $3
            RETURNING *
        `;

        const result = await query(sql, [produtoId, setorId, quantidade, loteId]);
        return result.rows.length > 0 ? this.castAttributes(result.rows[0]) : null;
    }

    /**
     * Liberar reserva de estoque
     */
    async liberarReserva(produtoId, setorId, quantidade, loteId = null) {
        const sql = `
            UPDATE estoque 
            SET quantidade_reservada = GREATEST(0, quantidade_reservada - $3),
                atualizado_em = NOW()
            WHERE produto_id = $1 AND setor_id = $2 
                AND (lote_id = $4 OR (lote_id IS NULL AND $4 IS NULL))
            RETURNING *
        `;

        const result = await query(sql, [produtoId, setorId, quantidade, loteId]);
        return result.rows.length > 0 ? this.castAttributes(result.rows[0]) : null;
    }

    /**
     * Transferir estoque entre setores
     */
    async transferirEstoque(produtoId, setorOrigemId, setorDestinoId, quantidade, usuarioId, loteId = null) {
        const client = await getClient();

        try {
            await client.query('BEGIN');

            // Verificar se há estoque suficiente na origem
            const estoqueOrigem = await client.query(`
                SELECT * FROM estoque 
                WHERE produto_id = $1 AND setor_id = $2 
                AND (lote_id = $3 OR (lote_id IS NULL AND $3 IS NULL))
                AND quantidade_disponivel >= $4
            `, [produtoId, setorOrigemId, loteId, quantidade]);

            if (estoqueOrigem.rows.length === 0) {
                throw new Error('Estoque insuficiente na origem');
            }

            const origem = estoqueOrigem.rows[0];

            // Reduzir estoque na origem
            await client.query(`
                UPDATE estoque 
                SET quantidade_atual = quantidade_atual - $1,
                    data_ultima_movimentacao = NOW(),
                    atualizado_em = NOW()
                WHERE id = $2
            `, [quantidade, origem.id]);

            // Aumentar estoque no destino (criar se não existir)
            const estoqueDestino = await client.query(`
                SELECT * FROM estoque 
                WHERE produto_id = $1 AND setor_id = $2 
                AND (lote_id = $3 OR (lote_id IS NULL AND $3 IS NULL))
            `, [produtoId, setorDestinoId, loteId]);

            if (estoqueDestino.rows.length > 0) {
                // Atualizar existente
                await client.query(`
                    UPDATE estoque 
                    SET quantidade_atual = quantidade_atual + $1,
                        valor_unitario_medio = $2,
                        data_ultima_movimentacao = NOW(),
                        atualizado_em = NOW()
                    WHERE id = $3
                `, [quantidade, origem.valor_unitario_medio, estoqueDestino.rows[0].id]);
            } else {
                // Criar novo
                await client.query(`
                    INSERT INTO estoque (
                        produto_id, setor_id, lote_id, quantidade_atual, 
                        valor_unitario_medio, data_ultima_movimentacao
                    ) VALUES ($1, $2, $3, $4, $5, NOW())
                `, [produtoId, setorDestinoId, loteId, quantidade, origem.valor_unitario_medio]);
            }

            // Registrar transferência como movimentação
            const movResult = await client.query(`
                INSERT INTO movimentacoes (
                    empresa_id, fazenda_id, tipo_movimentacao_id, numero_documento,
                    data_movimentacao, origem_setor_id, destino_setor_id, 
                    observacoes, status, usuario_criacao
                ) VALUES (
                    (SELECT empresa_id FROM produtos WHERE id = $1),
                    (SELECT fazenda_id FROM produtos WHERE id = $1),
                    7, -- Transferência entre setores
                    'TRF-' || TO_CHAR(NOW(), 'YYYYMMDD-HH24MISS'),
                    NOW(), $2, $3, 'Transferência automática', 'confirmado', $4
                ) RETURNING id
            `, [produtoId, setorOrigemId, setorDestinoId, usuarioId]);

            // Registrar item da movimentação
            await client.query(`
                INSERT INTO movimentacao_itens (
                    movimentacao_id, produto_id, lote_id, quantidade, valor_unitario
                ) VALUES ($1, $2, $3, $4, $5)
            `, [movResult.rows[0].id, produtoId, loteId, quantidade, origem.valor_unitario_medio]);

            await client.query('COMMIT');

            return {
                movimentacao_id: movResult.rows[0].id,
                produto_id: produtoId,
                setor_origem_id: setorOrigemId,
                setor_destino_id: setorDestinoId,
                quantidade: quantidade
            };

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Obter estatísticas gerais do estoque
     */
    async getEstatisticas(empresaId) {
        const sql = `
            SELECT 
                COUNT(DISTINCT e.produto_id) as produtos_com_estoque,
                COUNT(e.id) as total_posicoes,
                SUM(e.quantidade_atual) as quantidade_total,
                SUM(e.valor_total) as valor_total_estoque,
                AVG(e.valor_unitario_medio) as valor_medio_unitario,
                COUNT(CASE WHEN e.quantidade_atual <= COALESCE(t.estoque_minimo, 0) THEN 1 END) as produtos_estoque_baixo,
                COUNT(CASE WHEN e.quantidade_atual = 0 THEN 1 END) as produtos_sem_estoque
            FROM estoque e
            INNER JOIN produtos p ON e.produto_id = p.id
            INNER JOIN tipos t ON p.tipo_id = t.id
            WHERE p.empresa_id = $1 AND p.ativo = true
        `;

        const result = await query(sql, [empresaId]);
        return result.rows[0];
    }

    /**
     * Validar dados do estoque
     */
    validate(data) {
        const errors = [];

        if (!data.produto_id) {
            errors.push('Produto é obrigatório');
        }

        if (!data.setor_id) {
            errors.push('Setor é obrigatório');
        }

        if (data.quantidade_atual === undefined || data.quantidade_atual < 0) {
            errors.push('Quantidade atual deve ser maior ou igual a zero');
        }

        if (data.quantidade_reservada && data.quantidade_reservada < 0) {
            errors.push('Quantidade reservada não pode ser negativa');
        }

        if (data.valor_unitario_medio && data.valor_unitario_medio < 0) {
            errors.push('Valor unitário médio não pode ser negativo');
        }

        return errors;
    }
}

module.exports = Estoque;