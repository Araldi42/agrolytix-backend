/**
 * Model de Movimentação
 * Gerencia movimentações de estoque (entrada, saída, transferência)
 * Controla automaticamente o estoque através de triggers
 */

const BaseModel = require('./BaseModel');
const { query, getClient } = require('../config/database');

class Movimentacao extends BaseModel {
    constructor() {
        super('movimentacoes', 'id');

        // Campos que podem ser preenchidos em massa
        this.fillable = [
            'empresa_id', 'fazenda_id', 'tipo_movimentacao_id', 'numero_documento',
            'data_movimentacao', 'origem_setor_id', 'destino_setor_id',
            'fornecedor_id', 'cliente_id', 'valor_total', 'observacoes',
            'status', 'usuario_criacao'
        ];

        // Conversões de tipo automáticas
        this.casts = {
            'valor_total': 'float',
            'data_movimentacao': 'date',
            'ativo': 'boolean'
        };

        // Relacionamentos
        this.relationships = {
            empresa: { table: 'empresas', foreign_key: 'empresa_id', local_key: 'id' },
            fazenda: { table: 'fazendas', foreign_key: 'fazenda_id', local_key: 'id' },
            tipo_movimentacao: { table: 'tipos_movimentacao', foreign_key: 'tipo_movimentacao_id', local_key: 'id' },
            fornecedor: { table: 'fornecedores', foreign_key: 'fornecedor_id', local_key: 'id' },
            cliente: { table: 'clientes', foreign_key: 'cliente_id', local_key: 'id' },
            usuario: { table: 'usuarios', foreign_key: 'usuario_criacao', local_key: 'id' }
        };
    }

    /**
     * Buscar movimentações por empresa com filtros
     */
    async findByEmpresa(empresaId, options = {}) {
        const {
            fazenda_id = null,
            tipo_movimentacao_id = null,
            data_inicio = null,
            data_fim = null,
            status = null,
            page = 1,
            limit = 20
        } = options;

        const offset = (page - 1) * limit;
        let paramIndex = 1;
        const params = [empresaId];
        const conditions = ['m.empresa_id = $1', 'm.ativo = true'];

        let sql = `
            SELECT 
                m.id, m.numero_documento, m.data_movimentacao,
                m.valor_total, m.status, m.observacoes, m.criado_em,
                tm.nome as tipo_movimentacao, tm.operacao, tm.codigo,
                f.nome as fazenda_nome,
                forn.nome as fornecedor_nome,
                cli.nome as cliente_nome,
                u.nome as usuario_nome,
                so.nome as origem_setor_nome,
                sd.nome as destino_setor_nome,
                COUNT(mi.id) as total_itens
            FROM movimentacoes m
            INNER JOIN tipos_movimentacao tm ON m.tipo_movimentacao_id = tm.id
            INNER JOIN fazendas f ON m.fazenda_id = f.id
            LEFT JOIN fornecedores forn ON m.fornecedor_id = forn.id
            LEFT JOIN clientes cli ON m.cliente_id = cli.id
            LEFT JOIN usuarios u ON m.usuario_criacao = u.id
            LEFT JOIN setores so ON m.origem_setor_id = so.id
            LEFT JOIN setores sd ON m.destino_setor_id = sd.id
            LEFT JOIN movimentacao_itens mi ON m.id = mi.movimentacao_id
        `;

        // Filtros dinâmicos
        if (fazenda_id) {
            paramIndex++;
            conditions.push(`m.fazenda_id = $${paramIndex}`);
            params.push(fazenda_id);
        }

        if (tipo_movimentacao_id) {
            paramIndex++;
            conditions.push(`m.tipo_movimentacao_id = $${paramIndex}`);
            params.push(tipo_movimentacao_id);
        }

        if (data_inicio) {
            paramIndex++;
            conditions.push(`m.data_movimentacao >= $${paramIndex}`);
            params.push(data_inicio);
        }

        if (data_fim) {
            paramIndex++;
            conditions.push(`m.data_movimentacao <= $${paramIndex}`);
            params.push(data_fim);
        }

        if (status) {
            paramIndex++;
            conditions.push(`m.status = $${paramIndex}`);
            params.push(status);
        }

        sql += ` WHERE ${conditions.join(' AND ')}`;
        sql += ` GROUP BY m.id, tm.id, f.id, forn.id, cli.id, u.id, so.id, sd.id`;
        sql += ` ORDER BY m.data_movimentacao DESC`;

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
     * Buscar movimentação por ID com itens
     */
    async findByIdWithItens(id, empresaId = null) {
        let sql = `
            SELECT 
                m.*,
                tm.nome as tipo_movimentacao, tm.operacao, tm.codigo,
                f.nome as fazenda_nome,
                forn.nome as fornecedor_nome,
                cli.nome as cliente_nome,
                u.nome as usuario_nome,
                so.nome as origem_setor_nome,
                sd.nome as destino_setor_nome
            FROM movimentacoes m
            INNER JOIN tipos_movimentacao tm ON m.tipo_movimentacao_id = tm.id
            INNER JOIN fazendas f ON m.fazenda_id = f.id
            LEFT JOIN fornecedores forn ON m.fornecedor_id = forn.id
            LEFT JOIN clientes cli ON m.cliente_id = cli.id
            LEFT JOIN usuarios u ON m.usuario_criacao = u.id
            LEFT JOIN setores so ON m.origem_setor_id = so.id
            LEFT JOIN setores sd ON m.destino_setor_id = sd.id
            WHERE m.id = $1 AND m.ativo = true
        `;

        const params = [id];

        if (empresaId) {
            sql += ` AND m.empresa_id = $2`;
            params.push(empresaId);
        }

        const result = await query(sql, params);

        if (result.rows.length === 0) {
            return null;
        }

        const movimentacao = this.castAttributes(result.rows[0]);

        // Buscar itens da movimentação
        const itensSQL = `
            SELECT 
                mi.*,
                p.nome as produto_nome,
                p.codigo_interno as produto_codigo,
                t.nome as tipo_nome,
                l.numero_lote
            FROM movimentacao_itens mi
            INNER JOIN produtos p ON mi.produto_id = p.id
            INNER JOIN tipos t ON p.tipo_id = t.id
            LEFT JOIN lotes l ON mi.lote_id = l.id
            WHERE mi.movimentacao_id = $1
            ORDER BY mi.id
        `;

        const itensResult = await query(itensSQL, [id]);
        movimentacao.itens = itensResult.rows;

        return movimentacao;
    }

    /**
     * Criar movimentação completa com itens
     */
    async createCompleta(dadosMovimentacao, itens) {
        const client = await getClient();

        try {
            await client.query('BEGIN');

            // 1. Criar movimentação
            const movimentacaoSQL = `
                INSERT INTO movimentacoes (
                    empresa_id, fazenda_id, tipo_movimentacao_id, numero_documento,
                    data_movimentacao, origem_setor_id, destino_setor_id,
                    fornecedor_id, cliente_id, valor_total, observacoes,
                    status, usuario_criacao
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                RETURNING id
            `;

            const movParams = [
                dadosMovimentacao.empresa_id,
                dadosMovimentacao.fazenda_id,
                dadosMovimentacao.tipo_movimentacao_id,
                dadosMovimentacao.numero_documento || null,
                dadosMovimentacao.data_movimentacao || new Date(),
                dadosMovimentacao.origem_setor_id || null,
                dadosMovimentacao.destino_setor_id || null,
                dadosMovimentacao.fornecedor_id || null,
                dadosMovimentacao.cliente_id || null,
                dadosMovimentacao.valor_total || 0,
                dadosMovimentacao.observacoes || null,
                dadosMovimentacao.status || 'confirmado',
                dadosMovimentacao.usuario_criacao
            ];

            const movResult = await client.query(movimentacaoSQL, movParams);
            const movimentacaoId = movResult.rows[0].id;

            // 2. Criar itens da movimentação
            let valorTotalCalculado = 0;

            for (const item of itens) {
                const itemSQL = `
                    INSERT INTO movimentacao_itens (
                        movimentacao_id, produto_id, lote_id, quantidade,
                        valor_unitario, data_vencimento, observacoes
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                    RETURNING id
                `;

                const valorItem = (item.quantidade || 0) * (item.valor_unitario || 0);
                valorTotalCalculado += valorItem;

                await client.query(itemSQL, [
                    movimentacaoId,
                    item.produto_id,
                    item.lote_id || null,
                    item.quantidade,
                    item.valor_unitario || 0,
                    item.data_vencimento || null,
                    item.observacoes || null
                ]);
            }

            // 3. Atualizar valor total da movimentação
            if (valorTotalCalculado > 0) {
                await client.query(
                    'UPDATE movimentacoes SET valor_total = $1 WHERE id = $2',
                    [valorTotalCalculado, movimentacaoId]
                );
            }

            // 4. Atualizar estoque automaticamente (trigger do banco fará isso)
            // O trigger atualizar_estoque_trigger já está definido no DDL

            await client.query('COMMIT');

            // Buscar movimentação criada com todos os dados
            return await this.findByIdWithItens(movimentacaoId);

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Aprovar movimentação
     */
    async aprovar(id, usuarioAprovacao) {
        const sql = `
            UPDATE movimentacoes 
            SET status = 'aprovado', 
                usuario_aprovacao = $1, 
                data_aprovacao = NOW(),
                atualizado_em = NOW()
            WHERE id = $2 AND status = 'pendente' AND ativo = true
            RETURNING *
        `;

        const result = await query(sql, [usuarioAprovacao, id]);
        return result.rows.length > 0 ? this.castAttributes(result.rows[0]) : null;
    }

    /**
     * Cancelar movimentação
     */
    async cancelar(id, usuarioId, motivo = null) {
        const client = await getClient();

        try {
            await client.query('BEGIN');

            // 1. Verificar se pode ser cancelada
            const checkSQL = `
                SELECT id, status FROM movimentacoes 
                WHERE id = $1 AND ativo = true
            `;
            const checkResult = await client.query(checkSQL, [id]);

            if (checkResult.rows.length === 0) {
                throw new Error('Movimentação não encontrada');
            }

            const mov = checkResult.rows[0];
            if (mov.status === 'cancelado') {
                throw new Error('Movimentação já está cancelada');
            }

            // 2. Reverter estoque (criar movimentação inversa)
            // TODO: Implementar reversão de estoque

            // 3. Marcar como cancelada
            const cancelSQL = `
                UPDATE movimentacoes 
                SET status = 'cancelado',
                    observacoes = COALESCE(observacoes, '') || ' | CANCELADO: ' || COALESCE($2, 'Sem motivo'),
                    atualizado_em = NOW()
                WHERE id = $1
                RETURNING *
            `;

            const result = await client.query(cancelSQL, [id, motivo]);

            await client.query('COMMIT');
            return result.rows.length > 0 ? this.castAttributes(result.rows[0]) : null;

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Buscar movimentações por período
     */
    async findByPeriodo(empresaId, dataInicio, dataFim, options = {}) {
        const { tipo_movimentacao_id = null, fazenda_id = null } = options;

        let sql = `
            SELECT 
                m.*,
                tm.nome as tipo_movimentacao, tm.operacao,
                f.nome as fazenda_nome,
                COUNT(mi.id) as total_itens,
                SUM(mi.quantidade * mi.valor_unitario) as valor_calculado
            FROM movimentacoes m
            INNER JOIN tipos_movimentacao tm ON m.tipo_movimentacao_id = tm.id
            INNER JOIN fazendas f ON m.fazenda_id = f.id
            LEFT JOIN movimentacao_itens mi ON m.id = mi.movimentacao_id
            WHERE m.empresa_id = $1 
                AND m.data_movimentacao >= $2 
                AND m.data_movimentacao <= $3
                AND m.ativo = true
        `;

        const params = [empresaId, dataInicio, dataFim];
        let paramIndex = 4;

        if (tipo_movimentacao_id) {
            sql += ` AND m.tipo_movimentacao_id = ${paramIndex}`;
            params.push(tipo_movimentacao_id);
            paramIndex++;
        }

        if (fazenda_id) {
            sql += ` AND m.fazenda_id = ${paramIndex}`;
            params.push(fazenda_id);
        }

        sql += ` GROUP BY m.id, tm.id, f.id ORDER BY m.data_movimentacao DESC`;

        const result = await query(sql, params);
        return result.rows.map(row => this.castAttributes(row));
    }

    /**
     * Obter estatísticas de movimentações
     */
    async getEstatisticas(empresaId, periodo = 'mes') {
        let intervalCondition = '';

        switch (periodo) {
            case 'semana':
                intervalCondition = "DATE_TRUNC('week', m.data_movimentacao) = DATE_TRUNC('week', CURRENT_DATE)";
                break;
            case 'mes':
                intervalCondition = "DATE_TRUNC('month', m.data_movimentacao) = DATE_TRUNC('month', CURRENT_DATE)";
                break;
            case 'ano':
                intervalCondition = "DATE_TRUNC('year', m.data_movimentacao) = DATE_TRUNC('year', CURRENT_DATE)";
                break;
            default:
                intervalCondition = "DATE_TRUNC('month', m.data_movimentacao) = DATE_TRUNC('month', CURRENT_DATE)";
        }

        const sql = `
            SELECT 
                tm.nome as tipo_movimentacao,
                tm.operacao,
                COUNT(m.id) as total_movimentacoes,
                COALESCE(SUM(m.valor_total), 0) as valor_total,
                COALESCE(AVG(m.valor_total), 0) as valor_medio
            FROM movimentacoes m
            INNER JOIN tipos_movimentacao tm ON m.tipo_movimentacao_id = tm.id
            WHERE m.empresa_id = $1 
                AND ${intervalCondition}
                AND m.status = 'confirmado'
                AND m.ativo = true
            GROUP BY tm.id, tm.nome, tm.operacao
            ORDER BY valor_total DESC
        `;

        const result = await query(sql, [empresaId]);
        return result.rows;
    }

    /**
     * Buscar movimentações pendentes de aprovação
     */
    async findPendentesAprovacao(empresaId, usuarioId = null) {
        let sql = `
            SELECT 
                m.id, m.numero_documento, m.data_movimentacao,
                m.valor_total, m.observacoes, m.criado_em,
                tm.nome as tipo_movimentacao,
                f.nome as fazenda_nome,
                u.nome as usuario_criacao_nome,
                COUNT(mi.id) as total_itens,
                EXTRACT(DAYS FROM (NOW() - m.criado_em)) as dias_pendente
            FROM movimentacoes m
            INNER JOIN tipos_movimentacao tm ON m.tipo_movimentacao_id = tm.id
            INNER JOIN fazendas f ON m.fazenda_id = f.id
            INNER JOIN usuarios u ON m.usuario_criacao = u.id
            LEFT JOIN movimentacao_itens mi ON m.id = mi.movimentacao_id
            WHERE m.empresa_id = $1 
                AND m.status = 'pendente'
                AND m.ativo = true
        `;

        const params = [empresaId];

        if (usuarioId) {
            sql += ` AND m.usuario_criacao != $2`; // Não mostrar próprias movimentações
            params.push(usuarioId);
        }

        sql += ` GROUP BY m.id, tm.nome, f.nome, u.nome`;
        sql += ` ORDER BY m.criado_em ASC`; // Mais antigas primeiro

        const result = await query(sql, params);
        return result.rows.map(row => this.castAttributes(row));
    }

    /**
     * Buscar produtos mais movimentados
     */
    async findProdutosMaisMovimentados(empresaId, limite = 10, periodo = 'mes') {
        let intervalCondition = '';

        switch (periodo) {
            case 'semana':
                intervalCondition = "AND DATE_TRUNC('week', m.data_movimentacao) = DATE_TRUNC('week', CURRENT_DATE)";
                break;
            case 'mes':
                intervalCondition = "AND DATE_TRUNC('month', m.data_movimentacao) = DATE_TRUNC('month', CURRENT_DATE)";
                break;
            case 'ano':
                intervalCondition = "AND DATE_TRUNC('year', m.data_movimentacao) = DATE_TRUNC('year', CURRENT_DATE)";
                break;
            default:
                intervalCondition = "AND DATE_TRUNC('month', m.data_movimentacao) = DATE_TRUNC('month', CURRENT_DATE)";
        }

        const sql = `
            SELECT 
                p.id, p.nome as produto_nome, p.codigo_interno,
                t.nome as tipo_nome,
                COUNT(mi.id) as total_movimentacoes,
                SUM(mi.quantidade) as quantidade_total_movimentada,
                SUM(mi.quantidade * mi.valor_unitario) as valor_total_movimentado
            FROM movimentacao_itens mi
            INNER JOIN movimentacoes m ON mi.movimentacao_id = m.id
            INNER JOIN produtos p ON mi.produto_id = p.id
            INNER JOIN tipos t ON p.tipo_id = t.id
            WHERE m.empresa_id = $1 
                AND m.status = 'confirmado'
                AND m.ativo = true
                ${intervalCondition}
            GROUP BY p.id, p.nome, p.codigo_interno, t.nome
            ORDER BY total_movimentacoes DESC, quantidade_total_movimentada DESC
            LIMIT $2
        `;

        const result = await query(sql, [empresaId, limite]);
        return result.rows;
    }

    /**
     * Gerar número de documento automático
     */
    async gerarNumeroDocumento(empresaId, tipoMovimentacaoId) {
        const sql = `
            SELECT 
                tm.codigo,
                COUNT(m.id) + 1 as proximo_numero
            FROM tipos_movimentacao tm
            LEFT JOIN movimentacoes m ON tm.id = m.tipo_movimentacao_id 
                AND m.empresa_id = $1 
                AND EXTRACT(YEAR FROM m.data_movimentacao) = EXTRACT(YEAR FROM CURRENT_DATE)
            WHERE tm.id = $2
            GROUP BY tm.codigo
        `;

        const result = await query(sql, [empresaId, tipoMovimentacaoId]);

        if (result.rows.length === 0) {
            throw new Error('Tipo de movimentação não encontrado');
        }

        const { codigo, proximo_numero } = result.rows[0];
        const ano = new Date().getFullYear();

        return `${codigo}-${ano}-${String(proximo_numero).padStart(6, '0')}`;
    }

    /**
     * Validar dados da movimentação
     */
    validate(data) {
        const errors = [];

        if (!data.empresa_id) {
            errors.push('Empresa é obrigatória');
        }

        if (!data.fazenda_id) {
            errors.push('Fazenda é obrigatória');
        }

        if (!data.tipo_movimentacao_id) {
            errors.push('Tipo de movimentação é obrigatório');
        }

        if (!data.data_movimentacao) {
            errors.push('Data da movimentação é obrigatória');
        }

        if (data.valor_total && data.valor_total < 0) {
            errors.push('Valor total não pode ser negativo');
        }

        return errors;
    }

    /**
     * Validar item da movimentação
     */
    validateItem(item) {
        const errors = [];

        if (!item.produto_id) {
            errors.push('Produto é obrigatório');
        }

        if (!item.quantidade || item.quantidade <= 0) {
            errors.push('Quantidade deve ser maior que zero');
        }

        if (item.valor_unitario && item.valor_unitario < 0) {
            errors.push('Valor unitário não pode ser negativo');
        }

        return errors;
    }
}

module.exports = Movimentacao;