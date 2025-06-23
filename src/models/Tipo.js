/**
 * Model de Tipo
 * Representa tipos de produtos/categorias
 */

const BaseModel = require('./BaseModel');
const { query } = require('../config/database');

class Tipo extends BaseModel {
    constructor() {
        super('tipos', 'id');

        // Campos que podem ser preenchidos em massa
        this.fillable = [
            'categoria_id', 'empresa_id', 'nome', 'descricao', 'unidade_medida_padrao_id',
            'vida_util_meses', 'perecivel', 'validade_dias', 'estoque_minimo', 'estoque_maximo',
            'controla_lote', 'controla_serie'
        ];

        // Campos que devem ser omitidos nas respostas
        this.hidden = [];

        // Conversões de tipo automáticas
        this.casts = {
            'ativo': 'boolean',
            'estoque_minimo': 'float',
            'estoque_maximo': 'float',
            'vida_util_meses': 'int',
            'perecivel': 'boolean',
            'validade_dias': 'int',
            'controla_lote': 'boolean',
            'controla_serie': 'boolean'
        };

        // Relacionamentos
        this.relationships = {
            categoria: { table: 'categorias', foreign_key: 'categoria_id', local_key: 'id' },
            produtos: { table: 'produtos', foreign_key: 'tipo_id', local_key: 'id' },
            empresa: { table: 'empresas', foreign_key: 'empresa_id', local_key: 'id' },
            unidade_medida_padrao: { table: 'unidades_medida', foreign_key: 'unidade_medida_padrao_id', local_key: 'id' }
        };
    }

    /**
     * Buscar tipos por categoria com relacionamentos
     */
    async findByCategoria(categoriaId, empresaId = null, options = {}) {
        const {
            search = null,
            page = 1,
            limit = 50
        } = options;

        const offset = (page - 1) * limit;
        let paramIndex = 2;
        const params = [categoriaId];
        const conditions = ['t.categoria_id = $1', 't.ativo = true', 'c.ativo = true'];

        let sql = `
            SELECT 
                t.id, t.nome, t.descricao, t.unidade_medida_padrao_id,
                t.estoque_minimo, t.estoque_maximo, t.vida_util_meses,
                t.perecivel, t.validade_dias, t.controla_lote, t.controla_serie,
                t.criado_em, t.atualizado_em,
                c.nome as categoria_nome,
                um.nome as unidade_medida_nome, um.sigla as unidade_medida_sigla,
                u_criado.nome as criado_por_nome,
                u_atualizado.nome as atualizado_por_nome,
                COUNT(p.id) as total_produtos,
                COUNT(CASE WHEN p.status = 'ativo' THEN 1 END) as produtos_ativos,
                e.nome_fantasia as empresa_nome
            FROM tipos t
            INNER JOIN categorias c ON t.categoria_id = c.id
            LEFT JOIN unidades_medida um ON t.unidade_medida_padrao_id = um.id
            LEFT JOIN produtos p ON t.id = p.tipo_id AND p.ativo = true
            LEFT JOIN usuarios u_criado ON t.criado_por = u_criado.id
            LEFT JOIN usuarios u_atualizado ON t.atualizado_por = u_atualizado.id
            LEFT JOIN empresas e ON t.empresa_id = e.id
        `;

        // Filtro por empresa (null = tipos globais)
        if (empresaId !== null) {
            conditions.push(`(t.empresa_id = $${paramIndex} OR t.empresa_id IS NULL)`);
            params.push(empresaId);
            paramIndex++;
        } else {
            conditions.push('t.empresa_id IS NULL');
        }

        // Filtro de busca
        if (search) {
            conditions.push(`LOWER(t.nome) LIKE LOWER($${paramIndex})`);
            params.push(`%${search}%`);
            paramIndex++;
        }

        sql += ` WHERE ${conditions.join(' AND ')}`;
        sql += ` GROUP BY t.id, t.nome, t.descricao, t.unidade_medida_padrao_id, t.estoque_minimo, t.estoque_maximo, t.vida_util_meses, t.perecivel, t.validade_dias, t.controla_lote, t.controla_serie, t.criado_em, t.atualizado_em, c.nome, um.nome, um.sigla, u_criado.nome, u_atualizado.nome, e.nome_fantasia`;
        sql += ` ORDER BY t.nome`;

        // Paginação
        sql += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(limit, offset);

        const result = await query(sql, params);
        return result.rows.map(row => this.castAttributes(row));
    }

    /**
     * Buscar todos os tipos com relacionamentos
     */
    async findAllWithRelations(empresaId = null, options = {}) {
        const {
            search = null,
            categoria_id = null,
            page = 1,
            limit = 50
        } = options;

        const offset = (page - 1) * limit;
        let paramIndex = 1;
        const params = [];
        const conditions = ['t.ativo = true', 'c.ativo = true'];

        let sql = `
            SELECT 
                t.id, t.nome, t.descricao, t.unidade_medida_padrao_id,
                t.estoque_minimo, t.estoque_maximo, t.vida_util_meses,
                t.perecivel, t.validade_dias, t.controla_lote, t.controla_serie,
                t.criado_em, t.atualizado_em,
                c.id as categoria_id, c.nome as categoria_nome,
                um.nome as unidade_medida_nome, um.sigla as unidade_medida_sigla,
                u_criado.nome as criado_por_nome,
                u_atualizado.nome as atualizado_por_nome,
                COUNT(p.id) as total_produtos,
                COUNT(CASE WHEN p.status = 'ativo' THEN 1 END) as produtos_ativos,
                e.nome_fantasia as empresa_nome
            FROM tipos t
            INNER JOIN categorias c ON t.categoria_id = c.id
            LEFT JOIN unidades_medida um ON t.unidade_medida_padrao_id = um.id
            LEFT JOIN produtos p ON t.id = p.tipo_id AND p.ativo = true
            LEFT JOIN usuarios u_criado ON t.criado_por = u_criado.id
            LEFT JOIN usuarios u_atualizado ON t.atualizado_por = u_atualizado.id
            LEFT JOIN empresas e ON t.empresa_id = e.id
        `;

        // Filtro por empresa (null = tipos globais)
        if (empresaId !== null) {
            conditions.push(`(t.empresa_id = $${paramIndex} OR t.empresa_id IS NULL)`);
            params.push(empresaId);
            paramIndex++;
        } else {
            conditions.push('t.empresa_id IS NULL');
        }

        // Filtros adicionais
        if (categoria_id) {
            conditions.push(`t.categoria_id = $${paramIndex}`);
            params.push(categoria_id);
            paramIndex++;
        }

        if (search) {
            conditions.push(`LOWER(t.nome) LIKE LOWER($${paramIndex})`);
            params.push(`%${search}%`);
            paramIndex++;
        }

        sql += ` WHERE ${conditions.join(' AND ')}`;
        sql += ` GROUP BY t.id, t.nome, t.descricao, t.unidade_medida_padrao_id, t.estoque_minimo, t.estoque_maximo, t.vida_util_meses, t.perecivel, t.validade_dias, t.controla_lote, t.controla_serie, t.criado_em, t.atualizado_em, c.id, c.nome, um.nome, um.sigla, u_criado.nome, u_atualizado.nome, e.nome_fantasia`;
        sql += ` ORDER BY c.nome, t.nome`;

        // Paginação
        sql += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(limit, offset);

        const result = await query(sql, params);
        return result.rows.map(row => this.castAttributes(row));
    }

    /**
     * Buscar tipo por ID com detalhes
     */
    async findByIdWithDetails(id, empresaId = null) {
        let sql = `
            SELECT 
                t.*,
                c.id as categoria_id, c.nome as categoria_nome,
                um.nome as unidade_medida_nome, um.sigla as unidade_medida_sigla,
                u_criado.nome as criado_por_nome,
                u_atualizado.nome as atualizado_por_nome,
                e.nome_fantasia as empresa_nome,
                COUNT(p.id) as total_produtos,
                COUNT(CASE WHEN p.status = 'ativo' THEN 1 END) as produtos_ativos,
                COALESCE(SUM(est.quantidade_atual), 0) as estoque_total
            FROM tipos t
            INNER JOIN categorias c ON t.categoria_id = c.id
            LEFT JOIN unidades_medida um ON t.unidade_medida_padrao_id = um.id
            LEFT JOIN usuarios u_criado ON t.criado_por = u_criado.id
            LEFT JOIN usuarios u_atualizado ON t.atualizado_por = u_atualizado.id
            LEFT JOIN empresas e ON t.empresa_id = e.id
            LEFT JOIN produtos p ON t.id = p.tipo_id AND p.ativo = true
            LEFT JOIN estoque est ON p.id = est.produto_id
            WHERE t.id = $1 AND t.ativo = true AND c.ativo = true
        `;

        const params = [id];

        if (empresaId !== null) {
            sql += ` AND (t.empresa_id = $2 OR t.empresa_id IS NULL)`;
            params.push(empresaId);
        }

        sql += ` GROUP BY t.id, c.id, c.nome, um.nome, um.sigla, u_criado.nome, u_atualizado.nome, e.nome_fantasia`;

        const result = await query(sql, params);
        return result.rows.length > 0 ? this.castAttributes(result.rows[0]) : null;
    }

    /**
     * Verificar se nome é único na categoria
     */
    async isNomeUniqueInCategoria(nome, categoriaId, empresaId = null, excludeId = null) {
        let sql = `
            SELECT id FROM tipos 
            WHERE LOWER(nome) = LOWER($1) AND categoria_id = $2 AND ativo = true
        `;
        const params = [nome, categoriaId];
        let paramIndex = 3;

        if (empresaId !== null) {
            sql += ` AND (empresa_id = $${paramIndex} OR empresa_id IS NULL)`;
            params.push(empresaId);
            paramIndex++;
        }

        if (excludeId) {
            sql += ` AND id != $${paramIndex}`;
            params.push(excludeId);
        }

        const result = await query(sql, params);
        return result.rows.length === 0;
    }

    /**
     * Verificar se tipo pode ser excluído
     */
    async canDelete(id) {
        const sql = `
            SELECT COUNT(*) as total FROM produtos 
            WHERE tipo_id = $1 AND ativo = true
        `;

        const result = await query(sql, [id]);
        return parseInt(result.rows[0].total) === 0;
    }

    /**
     * Buscar produtos do tipo
     */
    async getProdutos(tipoId, options = {}) {
        const {
            status = 'ativo',
            categoria_produto = null,
            limit = 50
        } = options;

        let sql = `
            SELECT 
                p.id, p.nome, p.codigo_interno, p.categoria_produto,
                p.status, p.valor_aquisicao, p.data_aquisicao,
                f.nome as fazenda_nome,
                COALESCE(SUM(e.quantidade_atual), 0) as estoque_atual
            FROM produtos p
            LEFT JOIN fazendas f ON p.fazenda_id = f.id
            LEFT JOIN estoque e ON p.id = e.produto_id
            WHERE p.tipo_id = $1 AND p.ativo = true
        `;

        const params = [tipoId];
        let paramIndex = 2;

        if (status) {
            sql += ` AND p.status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }

        if (categoria_produto) {
            sql += ` AND p.categoria_produto = $${paramIndex}`;
            params.push(categoria_produto);
            paramIndex++;
        }

        sql += ` GROUP BY p.id, p.nome, p.codigo_interno, p.categoria_produto, p.status, p.valor_aquisicao, p.data_aquisicao, f.nome`;
        sql += ` ORDER BY p.nome`;
        sql += ` LIMIT $${paramIndex}`;
        params.push(limit);

        const result = await query(sql, params);
        return result.rows;
    }

    /**
     * Buscar tipos mais utilizados
     */
    async findMostUsed(empresaId = null, limit = 10) {
        let sql = `
            SELECT 
                t.id, t.nome, um.sigla as unidade_medida_sigla,
                c.nome as categoria_nome,
                COUNT(p.id) as total_produtos,
                COUNT(CASE WHEN p.status = 'ativo' THEN 1 END) as produtos_ativos,
                COALESCE(SUM(est.quantidade_atual), 0) as estoque_total
            FROM tipos t
            INNER JOIN categorias c ON t.categoria_id = c.id
            LEFT JOIN unidades_medida um ON t.unidade_medida_padrao_id = um.id
            LEFT JOIN produtos p ON t.id = p.tipo_id AND p.ativo = true
            LEFT JOIN estoque est ON p.id = est.produto_id
            WHERE t.ativo = true AND c.ativo = true
        `;

        const params = [];

        if (empresaId !== null) {
            sql += ` AND (t.empresa_id = $1 OR t.empresa_id IS NULL)`;
            params.push(empresaId);
        }

        sql += ` GROUP BY t.id, t.nome, um.sigla, c.nome`;
        sql += ` HAVING COUNT(p.id) > 0`;
        sql += ` ORDER BY COUNT(p.id) DESC, t.nome`;
        sql += ` LIMIT $${params.length + 1}`;
        params.push(limit);

        const result = await query(sql, params);
        return result.rows;
    }

    /**
     * Buscar tipos com estoque baixo
     */
    async findComEstoqueBaixo(empresaId = null) {
        let sql = `
            SELECT 
                t.id, t.nome, t.estoque_minimo,
                c.nome as categoria_nome,
                um.sigla as unidade_medida_sigla,
                COUNT(p.id) as total_produtos,
                COALESCE(SUM(est.quantidade_atual), 0) as estoque_atual,
                CASE 
                    WHEN t.estoque_minimo > 0 THEN 
                        ROUND((COALESCE(SUM(est.quantidade_atual), 0) / t.estoque_minimo) * 100, 2)
                    ELSE 0 
                END as percentual_estoque
            FROM tipos t
            INNER JOIN categorias c ON t.categoria_id = c.id
            LEFT JOIN unidades_medida um ON t.unidade_medida_padrao_id = um.id
            LEFT JOIN produtos p ON t.id = p.tipo_id AND p.ativo = true
            LEFT JOIN estoque est ON p.id = est.produto_id
            WHERE t.ativo = true 
                AND c.ativo = true 
                AND t.estoque_minimo IS NOT NULL 
                AND t.estoque_minimo > 0
        `;

        const params = [];

        if (empresaId !== null) {
            sql += ` AND (t.empresa_id = $1 OR t.empresa_id IS NULL)`;
            params.push(empresaId);
        }

        sql += ` GROUP BY t.id, t.nome, t.estoque_minimo, c.nome, um.sigla`;
        sql += ` HAVING COALESCE(SUM(est.quantidade_atual), 0) <= t.estoque_minimo`;
        sql += ` ORDER BY percentual_estoque ASC, t.nome`;

        const result = await query(sql, params);
        return result.rows;
    }

    /**
     * Obter estatísticas dos tipos
     */
    async getEstatisticas(empresaId = null) {
        let sql = `
            SELECT 
                COUNT(DISTINCT t.id) as total_tipos,
                COUNT(DISTINCT t.categoria_id) as categorias_com_tipos,
                COUNT(CASE WHEN t.controla_lote = true THEN 1 END) as tipos_com_lote,
                COUNT(CASE WHEN t.perecivel = true THEN 1 END) as tipos_pereciveis,
                COUNT(CASE WHEN t.estoque_minimo IS NOT NULL THEN 1 END) as tipos_com_estoque_minimo,
                COUNT(CASE WHEN t.empresa_id IS NULL THEN 1 END) as tipos_globais,
                AVG(t.estoque_minimo) as estoque_minimo_medio
            FROM tipos t
            INNER JOIN categorias c ON t.categoria_id = c.id
            WHERE t.ativo = true AND c.ativo = true
        `;

        const params = [];

        if (empresaId !== null) {
            sql += ` AND (t.empresa_id = $1 OR t.empresa_id IS NULL)`;
            params.push(empresaId);
        }

        const result = await query(sql, params);
        return result.rows[0];
    }

    /**
     * Buscar unidades de medida únicas
     */
    async getUnidadesMedida(empresaId = null) {
        let sql = `
            SELECT DISTINCT um.id, um.nome, um.sigla, um.tipo
            FROM tipos t
            INNER JOIN unidades_medida um ON t.unidade_medida_padrao_id = um.id
            WHERE t.ativo = true 
                AND um.ativo = true
        `;

        const params = [];

        if (empresaId !== null) {
            sql += ` AND (t.empresa_id = $1 OR t.empresa_id IS NULL)`;
            params.push(empresaId);
        }

        sql += ` ORDER BY um.nome`;

        const result = await query(sql, params);
        return result.rows;
    }

    /**
     * Validar dados antes de salvar
     */
    validate(data) {
        const errors = [];

        if (!data.nome || data.nome.trim().length === 0) {
            errors.push('Nome do tipo é obrigatório');
        }

        if (data.nome && data.nome.length > 255) {
            errors.push('Nome deve ter no máximo 255 caracteres');
        }

        if (!data.categoria_id) {
            errors.push('Categoria é obrigatória');
        }

        if (data.estoque_minimo && data.estoque_minimo < 0) {
            errors.push('Estoque mínimo não pode ser negativo');
        }

        if (data.estoque_maximo && data.estoque_maximo < 0) {
            errors.push('Estoque máximo não pode ser negativo');
        }

        if (data.estoque_minimo && data.estoque_maximo &&
            data.estoque_minimo > data.estoque_maximo) {
            errors.push('Estoque mínimo não pode ser maior que o máximo');
        }

        if (data.vida_util_meses && (data.vida_util_meses < 1 || data.vida_util_meses > 1200)) {
            errors.push('Vida útil deve estar entre 1 e 1200 meses');
        }

        if (data.validade_dias && data.validade_dias < 1) {
            errors.push('Validade deve ser pelo menos 1 dia');
        }

        if (data.descricao && data.descricao.length > 500) {
            errors.push('Descrição deve ter no máximo 500 caracteres');
        }

        return errors;
    }
}

module.exports = Tipo;