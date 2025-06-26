/**
 * Model de Produto
 * Unifica ativos e produtos em uma única entidade
 * Implementa Repository Pattern para abstração de dados
 */

const BaseModel = require('./BaseModel');
const { query, getClient } = require('../config/database');

class Produto extends BaseModel {
    constructor() {
        super('produtos', 'id');

        // Campos que podem ser preenchidos em massa
        this.fillable = [
            'empresa_id', 'fazenda_id', 'tipo_id', 'codigo_interno', 'codigo_barras',
            'nome', 'descricao', 'numero_serie', 'marca', 'modelo', 'ano_fabricacao',
            'valor_aquisicao', 'data_aquisicao', 'fornecedor_id', 'categoria_produto',
            'status', 'observacoes', 'ativo', 'atualizado_por'
        ];

        // Campos que devem ser omitidos nas respostas
        this.hidden = [];

        // Conversões de tipo automáticas
        this.casts = {
            'valor_aquisicao': 'float',
            'ano_fabricacao': 'int',
            'ativo': 'boolean'
        };

        // Relacionamentos
        this.relationships = {
            fazenda: { table: 'fazendas', foreign_key: 'fazenda_id', local_key: 'id' },
            tipo: { table: 'tipos', foreign_key: 'tipo_id', local_key: 'id' },
            fornecedor: { table: 'fornecedores', foreign_key: 'fornecedor_id', local_key: 'id' },
            empresa: { table: 'empresas', foreign_key: 'empresa_id', local_key: 'id' }
        };
    }

    /**
     * Buscar produtos por empresa com relacionamentos
     */
    async findByEmpresa(empresaId, options = {}) {
        const {
            search = null,
            tipo_id = null,
            fazenda_id = null,
            categoria_produto = null,
            status = 'ativo',
            page = 1,
            limit = 20
        } = options;

        const offset = (page - 1) * limit;
        let paramIndex = 1;
        const params = [empresaId];
        const conditions = ['p.empresa_id = $1', 'p.ativo = true'];

        let sql = `
            SELECT 
                p.id, p.codigo_interno, p.codigo_barras, p.nome, p.descricao,
                p.numero_serie, p.marca, p.modelo, p.ano_fabricacao,
                p.valor_aquisicao, p.data_aquisicao, p.categoria_produto,
                p.status, p.observacoes, p.criado_em, p.atualizado_em,
                p.fazenda_id, f.nome as fazenda_nome,
                t.nome as tipo_nome,
                forn.nome as fornecedor_nome,
                c.nome as categoria_nome,
                COALESCE(est.quantidade_total, 0) as estoque_total
            FROM produtos p
            LEFT JOIN fazendas f ON p.fazenda_id = f.id
            LEFT JOIN tipos t ON p.tipo_id = t.id
            LEFT JOIN fornecedores forn ON p.fornecedor_id = forn.id
            LEFT JOIN categorias c ON t.categoria_id = c.id
            LEFT JOIN (
                SELECT 
                    produto_id, 
                    SUM(quantidade_atual) as quantidade_total
                FROM estoque 
                GROUP BY produto_id
            ) est ON p.id = est.produto_id
        `;

        // Filtros dinâmicos
        if (search) {
            paramIndex++;
            conditions.push(`(LOWER(p.nome) LIKE LOWER($${paramIndex}) OR LOWER(p.codigo_interno) LIKE LOWER($${paramIndex}))`);
            params.push(`%${search}%`);
        }

        if (tipo_id) {
            paramIndex++;
            conditions.push(`p.tipo_id = $${paramIndex}`);
            params.push(tipo_id);
        }

        if (fazenda_id) {
            paramIndex++;
            conditions.push(`p.fazenda_id = $${paramIndex}`);
            params.push(fazenda_id);
        }

        if (categoria_produto) {
            paramIndex++;
            conditions.push(`p.categoria_produto = $${paramIndex}`);
            params.push(categoria_produto);
        }

        if (status) {
            paramIndex++;
            conditions.push(`p.status = $${paramIndex}`);
            params.push(status);
        }

        sql += ` WHERE ${conditions.join(' AND ')}`;
        sql += ` ORDER BY p.nome`;

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
     * Buscar produto por ID com relacionamentos
     */
    async findByIdWithRelations(id, empresaId = null) {
        let sql = `
            SELECT 
                p.*,
                f.nome as fazenda_nome,
                t.nome as tipo_nome,
                forn.nome as fornecedor_nome,
                c.nome as categoria_nome,
                u_criado.nome as criado_por_nome,
                u_atualizado.nome as atualizado_por_nome
            FROM produtos p
            LEFT JOIN fazendas f ON p.fazenda_id = f.id
            LEFT JOIN tipos t ON p.tipo_id = t.id
            LEFT JOIN fornecedores forn ON p.fornecedor_id = forn.id
            LEFT JOIN categorias c ON t.categoria_id = c.id
            LEFT JOIN usuarios u_criado ON p.criado_por = u_criado.id
            LEFT JOIN usuarios u_atualizado ON p.atualizado_por = u_atualizado.id
            WHERE p.id = $1 AND p.ativo = true
        `;

        const params = [id];

        if (empresaId) {
            sql += ` AND p.empresa_id = $2`;
            params.push(empresaId);
        }

        const result = await query(sql, params);
        return result.rows.length > 0 ? this.castAttributes(result.rows[0]) : null;
    }

    /**
     * Verificar se código interno é único na empresa
     */
    async isCodigoInternoUnique(codigoInterno, empresaId, excludeId = null) {
        let sql = `
            SELECT id FROM produtos 
            WHERE codigo_interno = $1 AND empresa_id = $2 AND ativo = true
        `;
        const params = [codigoInterno, empresaId];

        if (excludeId) {
            sql += ` AND id != $3`;
            params.push(excludeId);
        }

        const result = await query(sql, params);
        return result.rows.length === 0;
    }

    /**
     * Buscar produtos com estoque baixo
     */
    async findComEstoqueBaixo(empresaId, limite = 10) {
        const sql = `
            SELECT 
                p.id, p.nome, p.codigo_interno,
                t.nome as tipo_nome,
                t.estoque_minimo,
                COALESCE(SUM(e.quantidade_atual), 0) as estoque_atual,
                p.fazenda_id, f.nome as fazenda_nome
            FROM produtos p
            INNER JOIN tipos t ON p.tipo_id = t.id
            LEFT JOIN estoque e ON p.id = e.produto_id
            LEFT JOIN fazendas f ON p.fazenda_id = f.id
            WHERE p.empresa_id = $1 
                AND p.ativo = true 
                AND p.categoria_produto = 'insumo'
                AND t.estoque_minimo IS NOT NULL
            GROUP BY p.id, p.nome, p.codigo_interno, t.nome, t.estoque_minimo, p.fazenda_id, f.nome
            HAVING COALESCE(SUM(e.quantidade_atual), 0) <= t.estoque_minimo
            ORDER BY (COALESCE(SUM(e.quantidade_atual), 0) / NULLIF(t.estoque_minimo, 0)) ASC
            LIMIT $2
        `;

        const result = await query(sql, [empresaId, limite]);
        return result.rows;
    }

    /**
     * Contar produtos por categoria
     */
    async countByCategoria(empresaId) {
        const sql = `
            SELECT 
                p.categoria_produto,
                COUNT(*) as total,
                COUNT(CASE WHEN p.status = 'ativo' THEN 1 END) as ativos,
                COUNT(CASE WHEN p.status = 'manutencao' THEN 1 END) as manutencao
            FROM produtos p
            WHERE p.empresa_id = $1 AND p.ativo = true
            GROUP BY p.categoria_produto
            ORDER BY p.categoria_produto
        `;

        const result = await query(sql, [empresaId]);
        return result.rows;
    }

    /**
     * Buscar produtos por fornecedor
     */
    async findByFornecedor(fornecedorId, empresaId = null) {
        let sql = `
            SELECT p.*, f.nome as fornecedor_nome
            FROM produtos p
            INNER JOIN fornecedores f ON p.fornecedor_id = f.id
            WHERE p.fornecedor_id = $1 AND p.ativo = true
        `;
        const params = [fornecedorId];

        if (empresaId) {
            sql += ` AND p.empresa_id = $2`;
            params.push(empresaId);
        }

        sql += ` ORDER BY p.nome`;

        const result = await query(sql, params);
        return result.rows.map(row => this.castAttributes(row));
    }

    /**
     * Atualizar status de múltiplos produtos
     */
    async updateStatusBatch(produtoIds, novoStatus, usuarioId) {
        const client = await getClient();

        try {
            await client.query('BEGIN');

            const sql = `
                UPDATE produtos 
                SET status = $1, atualizado_por = $2, atualizado_em = NOW()
                WHERE id = ANY($3) AND ativo = true
                RETURNING id, nome, status
            `;

            const result = await client.query(sql, [novoStatus, usuarioId, produtoIds]);

            await client.query('COMMIT');
            return result.rows;

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Buscar produtos para manutenção preventiva
     */
    async findParaManutencao(empresaId) {
        const sql = `
            SELECT 
                p.id, p.nome, p.numero_serie, p.marca, p.modelo,
                t.vida_util_meses,
                p.data_aquisicao,
                f.nome as fazenda_nome,
                EXTRACT(MONTHS FROM AGE(NOW(), p.data_aquisicao)) as meses_uso,
                m.data_manutencao as ultima_manutencao
            FROM produtos p
            INNER JOIN tipos t ON p.tipo_id = t.id
            LEFT JOIN fazendas f ON p.fazenda_id = f.id
            LEFT JOIN LATERAL (
                SELECT data_manutencao 
                FROM manutencoes 
                WHERE produto_id = p.id 
                ORDER BY data_manutencao DESC 
                LIMIT 1
            ) m ON true
            WHERE p.empresa_id = $1 
                AND p.ativo = true 
                AND p.categoria_produto = 'ativo'
                AND t.vida_util_meses IS NOT NULL
                AND (
                    EXTRACT(MONTHS FROM AGE(NOW(), p.data_aquisicao)) >= t.vida_util_meses * 0.8
                    OR 
                    EXTRACT(MONTHS FROM AGE(NOW(), COALESCE(m.data_manutencao, p.data_aquisicao))) >= 6
                )
            ORDER BY meses_uso DESC
        `;

        const result = await query(sql, [empresaId]);
        return result.rows;
    }

    /**
     * Obter estatísticas gerais dos produtos
     */
    async getEstatisticas(empresaId) {
        const sql = `
            SELECT 
                COUNT(*) as total_produtos,
                COUNT(CASE WHEN categoria_produto = 'insumo' THEN 1 END) as total_insumos,
                COUNT(CASE WHEN categoria_produto = 'ativo' THEN 1 END) as total_ativos,
                COUNT(CASE WHEN status = 'ativo' THEN 1 END) as produtos_ativos,
                COUNT(CASE WHEN status = 'manutencao' THEN 1 END) as em_manutencao,
                COALESCE(SUM(valor_aquisicao), 0) as valor_total_ativos,
                COALESCE(AVG(valor_aquisicao), 0) as valor_medio_produto
            FROM produtos
            WHERE empresa_id = $1 AND ativo = true
        `;

        const result = await query(sql, [empresaId]);
        return result.rows[0];
    }

    /**
     * Validar dados antes de salvar
     */
    validate(data) {
        const errors = [];

        if (!data.nome || data.nome.trim().length === 0) {
            errors.push('Nome do produto é obrigatório');
        }

        if (!data.empresa_id) {
            errors.push('Empresa é obrigatória');
        }

        if (!data.fazenda_id) {
            errors.push('Fazenda é obrigatória');
        }

        if (!data.tipo_id) {
            errors.push('Tipo do produto é obrigatório');
        }

        if (data.valor_aquisicao && data.valor_aquisicao < 0) {
            errors.push('Valor de aquisição não pode ser negativo');
        }

        if (data.ano_fabricacao) {
            const anoAtual = new Date().getFullYear();
            if (data.ano_fabricacao < 1900 || data.ano_fabricacao > anoAtual + 1) {
                errors.push('Ano de fabricação inválido');
            }
        }

        return errors;
    }
}

module.exports = Produto;