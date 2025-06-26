/**
 * Model de Setor
 * Gerencia setores/galpões/depósitos das fazendas
 * Estrutura: Empresa → Fazendas → Setores → Estoque
 */

const BaseModel = require('./BaseModel');
const { query, getClient } = require('../config/database');

class Setor extends BaseModel {
    constructor() {
        super('setores', 'id');

        // Campos que podem ser preenchidos em massa
        this.fillable = [
            'fazenda_id', 'nome', 'tipo', 'capacidade_maxima',
            'unidade_capacidade', 'coordenadas_gps', 'observacoes'
        ];

        // Conversões de tipo automáticas
        this.casts = {
            'capacidade_maxima': 'float',
            'ativo': 'boolean'
        };

        // Relacionamentos
        this.relationships = {
            fazenda: { table: 'fazendas', foreign_key: 'fazenda_id', local_key: 'id' },
            estoque: { table: 'estoque', foreign_key: 'setor_id', local_key: 'id' }
        };
    }

    /**
     * Buscar setores por fazenda
     */
    async findByFazenda(fazendaId, options = {}) {
        const {
            search = null,
            tipo = null,
            com_estoque = false,
            page = 1,
            limit = 20
        } = options;

        const offset = (page - 1) * limit;
        let paramIndex = 1;
        const params = [fazendaId];
        const conditions = ['s.fazenda_id = $1', 's.ativo = true'];

        let sql = `
            SELECT 
                s.id, s.nome, s.tipo, s.capacidade_maxima, s.unidade_capacidade,
                s.coordenadas_gps, s.observacoes, s.criado_em,
                s.fazenda_id, f.nome as fazenda_nome,
                e.razao_social as empresa_nome,
                COUNT(est.id) as produtos_estoque,
                COALESCE(SUM(est.quantidade_atual), 0) as quantidade_total_estoque,
                COALESCE(SUM(est.valor_total), 0) as valor_total_estoque,
                CASE 
                    WHEN s.capacidade_maxima IS NOT NULL AND s.capacidade_maxima > 0 THEN
                        (COALESCE(SUM(est.quantidade_atual), 0) / s.capacidade_maxima) * 100
                    ELSE NULL 
                END as percentual_ocupacao
            FROM setores s
            INNER JOIN fazendas f ON s.fazenda_id = f.id
            INNER JOIN empresas e ON f.empresa_id = e.id
            LEFT JOIN estoque est ON s.id = est.setor_id AND est.quantidade_atual > 0
        `;

        // Filtros dinâmicos
        if (search) {
            paramIndex++;
            conditions.push(`LOWER(s.nome) LIKE LOWER($${paramIndex})`);
            params.push(`%${search}%`);
        }

        if (tipo) {
            paramIndex++;
            conditions.push(`s.tipo = $${paramIndex}`);
            params.push(tipo);
        }

        sql += ` WHERE ${conditions.join(' AND ')}`;
        sql += ` GROUP BY s.id, f.nome, e.razao_social`;

        if (com_estoque) {
            sql += ` HAVING COUNT(est.id) > 0`;
        }

        sql += ` ORDER BY s.nome`;

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
     * Buscar setor por ID com detalhes
     */
    async findByIdWithDetails(id, empresaId = null) {
        let sql = `
            SELECT 
                s.*,
                s.fazenda_id, f.nome as fazenda_nome, f.codigo as fazenda_codigo,
                e.razao_social as empresa_nome,
                COUNT(est.id) as produtos_estoque,
                COALESCE(SUM(est.quantidade_atual), 0) as quantidade_total_estoque,
                COALESCE(SUM(est.valor_total), 0) as valor_total_estoque,
                CASE 
                    WHEN s.capacidade_maxima IS NOT NULL AND s.capacidade_maxima > 0 THEN
                        (COALESCE(SUM(est.quantidade_atual), 0) / s.capacidade_maxima) * 100
                    ELSE NULL 
                END as percentual_ocupacao
            FROM setores s
            INNER JOIN fazendas f ON s.fazenda_id = f.id
            INNER JOIN empresas e ON f.empresa_id = e.id
            LEFT JOIN estoque est ON s.id = est.setor_id
            WHERE s.id = $1 AND s.ativo = true
        `;

        const params = [id];

        if (empresaId) {
            sql += ` AND e.id = $2`;
            params.push(empresaId);
        }

        sql += ` GROUP BY s.id, f.nome, f.codigo, e.razao_social`;

        const result = await query(sql, params);
        return result.rows.length > 0 ? this.castAttributes(result.rows[0]) : null;
    }

    /**
     * Buscar setores por empresa
     */
    async findByEmpresa(empresaId, options = {}) {
        const { fazenda_id = null, tipo = null, limit = 50 } = options;

        let sql = `
            SELECT 
                s.id, s.nome, s.tipo, s.capacidade_maxima, s.unidade_capacidade,
                s.fazenda_id, f.nome as fazenda_nome, f.codigo as fazenda_codigo,
                COUNT(est.id) as produtos_estoque,
                COALESCE(SUM(est.quantidade_atual), 0) as quantidade_total_estoque
            FROM setores s
            INNER JOIN fazendas f ON s.fazenda_id = f.id
            LEFT JOIN estoque est ON s.id = est.setor_id AND est.quantidade_atual > 0
            WHERE f.empresa_id = $1 AND s.ativo = true
        `;

        const params = [empresaId];
        let paramIndex = 2;

        if (fazenda_id) {
            sql += ` AND s.fazenda_id = $${paramIndex}`;
            params.push(fazenda_id);
            paramIndex++;
        }

        if (tipo) {
            sql += ` AND s.tipo = $${paramIndex}`;
            params.push(tipo);
            paramIndex++;
        }

        sql += ` GROUP BY s.id, s.fazenda_id, f.nome, f.codigo`;
        sql += ` ORDER BY f.nome, s.nome`;
        sql += ` LIMIT $${paramIndex}`;
        params.push(limit);

        const result = await query(sql, params);
        return result.rows.map(row => this.castAttributes(row));
    }

    /**
     * Verificar se nome do setor é único na fazenda
     */
    async isNomeUnique(nome, fazendaId, excludeId = null) {
        let sql = `
            SELECT id FROM setores 
            WHERE LOWER(nome) = LOWER($1) AND fazenda_id = $2 AND ativo = true
        `;
        const params = [nome, fazendaId];

        if (excludeId) {
            sql += ` AND id != $3`;
            params.push(excludeId);
        }

        const result = await query(sql, params);
        return result.rows.length === 0;
    }

    /**
     * Buscar setores por tipo
     */
    async findByTipo(tipo, empresaId = null) {
        let sql = `
            SELECT 
                s.id, s.nome, s.capacidade_maxima, s.unidade_capacidade,
                s.fazenda_id, f.nome as fazenda_nome,
                COUNT(est.id) as produtos_estoque,
                COALESCE(SUM(est.quantidade_atual), 0) as ocupacao_atual
            FROM setores s
            INNER JOIN fazendas f ON s.fazenda_id = f.id
            LEFT JOIN estoque est ON s.id = est.setor_id AND est.quantidade_atual > 0
            WHERE s.tipo = $1 AND s.ativo = true
        `;

        const params = [tipo];

        if (empresaId) {
            sql += ` AND f.empresa_id = $2`;
            params.push(empresaId);
        }

        sql += ` GROUP BY s.id, s.fazenda_id, f.nome ORDER BY f.nome, s.nome`;

        const result = await query(sql, params);
        return result.rows;
    }

    /**
     * Buscar setores com capacidade disponível
     */
    async findComCapacidadeDisponivel(empresaId, tipoSetor = null, capacidadeMinima = 0) {
        let sql = `
            SELECT 
                s.id, s.nome, s.tipo, s.capacidade_maxima, s.unidade_capacidade,
                s.fazenda_id, f.nome as fazenda_nome,
                COALESCE(SUM(est.quantidade_atual), 0) as ocupacao_atual,
                (s.capacidade_maxima - COALESCE(SUM(est.quantidade_atual), 0)) as capacidade_disponivel,
                CASE 
                    WHEN s.capacidade_maxima > 0 THEN
                        ((s.capacidade_maxima - COALESCE(SUM(est.quantidade_atual), 0)) / s.capacidade_maxima) * 100
                    ELSE 100 
                END as percentual_disponivel
            FROM setores s
            INNER JOIN fazendas f ON s.fazenda_id = f.id
            LEFT JOIN estoque est ON s.id = est.setor_id
            WHERE f.empresa_id = $1 
                AND s.ativo = true 
                AND s.capacidade_maxima IS NOT NULL
                AND s.capacidade_maxima > 0
        `;

        const params = [empresaId];
        let paramIndex = 2;

        if (tipoSetor) {
            sql += ` AND s.tipo = $${paramIndex}`;
            params.push(tipoSetor);
            paramIndex++;
        }

        sql += ` GROUP BY s.id, s.fazenda_id, f.nome`;
        sql += ` HAVING (s.capacidade_maxima - COALESCE(SUM(est.quantidade_atual), 0)) >= $${paramIndex}`;
        params.push(capacidadeMinima);

        sql += ` ORDER BY percentual_disponivel DESC`;

        const result = await query(sql, params);
        return result.rows;
    }

    /**
     * Buscar estoque do setor
     */
    async getEstoque(setorId, options = {}) {
        const { apenas_com_estoque = true, limit = 50 } = options;

        let sql = `
            SELECT 
                est.id, est.quantidade_atual, est.quantidade_reservada,
                est.quantidade_disponivel, est.valor_unitario_medio, est.valor_total,
                p.nome as produto_nome, p.codigo_interno,
                t.nome as tipo_nome,
                l.numero_lote, l.data_vencimento
            FROM estoque est
            INNER JOIN produtos p ON est.produto_id = p.id
            INNER JOIN tipos t ON p.tipo_id = t.id
            LEFT JOIN lotes l ON est.lote_id = l.id
            WHERE est.setor_id = $1
        `;

        const params = [setorId];

        if (apenas_com_estoque) {
            sql += ` AND est.quantidade_atual > 0`;
        }

        sql += ` ORDER BY p.nome, l.numero_lote`;
        sql += ` LIMIT $2`;
        params.push(limit);

        const result = await query(sql, params);
        return result.rows;
    }

    /**
     * Buscar movimentações do setor
     */
    async getMovimentacoes(setorId, options = {}) {
        const { limite = 20, data_inicio = null } = options;

        let sql = `
            SELECT 
                m.id, m.data_movimentacao, m.numero_documento,
                tm.nome as tipo_movimentacao, tm.operacao,
                u.nome as usuario_nome,
                COUNT(mi.id) as total_itens
            FROM movimentacoes m
            INNER JOIN tipos_movimentacao tm ON m.tipo_movimentacao_id = tm.id
            INNER JOIN usuarios u ON m.usuario_criacao = u.id
            LEFT JOIN movimentacao_itens mi ON m.id = mi.movimentacao_id
            WHERE (m.origem_setor_id = $1 OR m.destino_setor_id = $1)
        `;

        const params = [setorId];
        let paramIndex = 2;

        if (data_inicio) {
            sql += ` AND m.data_movimentacao >= $${paramIndex}`;
            params.push(data_inicio);
            paramIndex++;
        }

        sql += ` GROUP BY m.id, tm.nome, tm.operacao, u.nome`;
        sql += ` ORDER BY m.data_movimentacao DESC`;
        sql += ` LIMIT $${paramIndex}`;
        params.push(limite);

        const result = await query(sql, params);
        return result.rows;
    }

    /**
     * Obter resumo do setor
     */
    async getResumo(setorId) {
        const sql = `
            SELECT 
                s.id, s.nome, s.tipo, s.capacidade_maxima, s.unidade_capacidade,
                COUNT(DISTINCT est.produto_id) as produtos_diferentes,
                COUNT(est.id) as posicoes_estoque,
                COALESCE(SUM(est.quantidade_atual), 0) as quantidade_total,
                COALESCE(SUM(est.valor_total), 0) as valor_total,
                CASE 
                    WHEN s.capacidade_maxima IS NOT NULL AND s.capacidade_maxima > 0 THEN
                        (COALESCE(SUM(est.quantidade_atual), 0) / s.capacidade_maxima) * 100
                    ELSE NULL 
                END as percentual_ocupacao,
                COUNT(CASE WHEN est.quantidade_atual <= 0 THEN 1 END) as posicoes_zeradas
            FROM setores s
            LEFT JOIN estoque est ON s.id = est.setor_id
            WHERE s.id = $1 AND s.ativo = true
            GROUP BY s.id
        `;

        const result = await query(sql, [setorId]);
        return result.rows.length > 0 ? result.rows[0] : null;
    }

    /**
     * Buscar setores próximos por coordenadas
     */
    async findProximos(latitude, longitude, raioKm = 10, empresaId = null) {
        let sql = `
            SELECT 
                s.id, s.nome, s.tipo, s.capacidade_maxima,
                s.fazenda_id, f.nome as fazenda_nome,
                s.coordenadas_gps,
                ST_Distance(
                    ST_GeogFromText('POINT(' || $1 || ' ' || $2 || ')'),
                    ST_GeogFromText('POINT(' || ST_X(s.coordenadas_gps) || ' ' || ST_Y(s.coordenadas_gps) || ')')
                ) / 1000 as distancia_km
            FROM setores s
            INNER JOIN fazendas f ON s.fazenda_id = f.id
            WHERE s.ativo = true 
                AND s.coordenadas_gps IS NOT NULL
                AND ST_DWithin(
                    ST_GeogFromText('POINT(' || $1 || ' ' || $2 || ')'),
                    ST_GeogFromText('POINT(' || ST_X(s.coordenadas_gps) || ' ' || ST_Y(s.coordenadas_gps) || ')'),
                    $3 * 1000
                )
        `;

        const params = [longitude, latitude, raioKm];

        if (empresaId) {
            sql += ` AND f.empresa_id = $4`;
            params.push(empresaId);
        }

        sql += ` ORDER BY distancia_km`;

        const result = await query(sql, params);
        return result.rows;
    }

    /**
     * Obter estatísticas por tipo de setor
     */
    async getEstatisticasPorTipo(empresaId) {
        const sql = `
            SELECT 
                s.tipo,
                s.unidade_capacidade,
                COUNT(s.id) as quantidade_setores,
                COALESCE(SUM(s.capacidade_maxima), 0) as capacidade_total,
                COALESCE(SUM(est_sum.quantidade_atual), 0) as ocupacao_atual,
                COALESCE(AVG(est_sum.percentual_ocupacao), 0) as media_ocupacao
            FROM setores s
            INNER JOIN fazendas f ON s.fazenda_id = f.id
            LEFT JOIN (
                SELECT 
                    setor_id,
                    SUM(quantidade_atual) as quantidade_atual,
                    CASE 
                        WHEN MAX(s2.capacidade_maxima) > 0 THEN
                            (SUM(quantidade_atual) / MAX(s2.capacidade_maxima)) * 100
                        ELSE 0 
                    END as percentual_ocupacao
                FROM estoque est
                INNER JOIN setores s2 ON est.setor_id = s2.id
                GROUP BY setor_id
            ) est_sum ON s.id = est_sum.setor_id
            WHERE f.empresa_id = $1 AND s.ativo = true
            GROUP BY s.tipo, s.unidade_capacidade
            ORDER BY capacidade_total DESC
        `;

        const result = await query(sql, [empresaId]);
        return result.rows;
    }

    /**
     * Validar dados do setor
     */
    validate(data) {
        const errors = [];

        if (!data.nome || data.nome.trim().length === 0) {
            errors.push('Nome do setor é obrigatório');
        }

        if (!data.fazenda_id) {
            errors.push('Fazenda é obrigatória');
        }

        const tiposValidos = ['deposito', 'galpao', 'campo', 'silo', 'estacao', 'oficina'];
        if (data.tipo && !tiposValidos.includes(data.tipo)) {
            errors.push('Tipo de setor inválido');
        }

        if (data.capacidade_maxima && data.capacidade_maxima <= 0) {
            errors.push('Capacidade máxima deve ser maior que zero');
        }

        if (data.capacidade_maxima && !data.unidade_capacidade) {
            errors.push('Unidade de capacidade é obrigatória quando capacidade máxima é informada');
        }

        const unidadesValidas = ['toneladas', 'litros', 'm³', 'unidades', 'hectares'];
        if (data.unidade_capacidade && !unidadesValidas.includes(data.unidade_capacidade)) {
            errors.push('Unidade de capacidade inválida');
        }

        return errors;
    }
}

module.exports = Setor;