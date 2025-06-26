/**
 * Model de Categoria
 * Representa categorias de tipos/produtos
 */

const BaseModel = require('./BaseModel');
const { query } = require('../config/database');

class Categoria extends BaseModel {
    constructor() {
        super('categorias', 'id');

        // Campos que podem ser preenchidos em massa
        this.fillable = [
            'nome', 'descricao', 'empresa_id', 'cor', 'categoria_pai_id', 'icone', 'ativo', 'atualizado_por'
        ];

        // Campos que devem ser omitidos nas respostas
        this.hidden = [];

        // Conversões de tipo automáticas
        this.casts = {
            'ativo': 'boolean'
        };

        // Relacionamentos
        this.relationships = {
            tipos: { table: 'tipos', foreign_key: 'categoria_id', local_key: 'id' },
            empresa: { table: 'empresas', foreign_key: 'empresa_id', local_key: 'id' },
            categoria_pai: { table: 'categorias', foreign_key: 'categoria_pai_id', local_key: 'id' },
            subcategorias: { table: 'categorias', foreign_key: 'id', local_key: 'categoria_pai_id' }
        };
    }

    /**
     * Buscar todas as categorias com contadores
     */
    async findAllWithCounts(empresaId = null, options = {}) {
        const {
            search = null,
            page = 1,
            limit = 50
        } = options;

        const offset = (page - 1) * limit;
        let paramIndex = 1;
        const params = [];
        const conditions = ['c.ativo = true'];

        let sql = `
            SELECT 
                c.id, c.nome, c.descricao, c.cor, c.icone, c.categoria_pai_id,
                c.criado_em, c.atualizado_em,
                cp.nome as categoria_pai_nome,
                u_criado.nome as criado_por_nome,
                u_atualizado.nome as atualizado_por_nome,
                COUNT(t.id) as total_tipos,
                COUNT(DISTINCT sub.id) as total_subcategorias,
                e.nome_fantasia as empresa_nome
            FROM categorias c
            LEFT JOIN categorias cp ON c.categoria_pai_id = cp.id
            LEFT JOIN categorias sub ON c.id = sub.categoria_pai_id AND sub.ativo = true
            LEFT JOIN tipos t ON c.id = t.categoria_id AND t.ativo = true
            LEFT JOIN usuarios u_criado ON c.criado_por = u_criado.id
            LEFT JOIN usuarios u_atualizado ON c.atualizado_por = u_atualizado.id
            LEFT JOIN empresas e ON c.empresa_id = e.id
        `;

        // Filtro por empresa (null = categorias globais)
        if (empresaId !== undefined) {
            if (empresaId === null) {
                conditions.push('c.empresa_id IS NULL');
            } else {
                conditions.push(`(c.empresa_id = $${paramIndex} OR c.empresa_id IS NULL)`);
                params.push(empresaId);
                paramIndex++;
            }
        }

        // Filtro de busca
        if (search) {
            conditions.push(`LOWER(c.nome) LIKE LOWER($${paramIndex})`);
            params.push(`%${search}%`);
            paramIndex++;
        }

        sql += ` WHERE ${conditions.join(' AND ')}`;
        sql += ` GROUP BY c.id, c.nome, c.descricao, c.cor, c.icone, c.categoria_pai_id, c.criado_em, c.atualizado_em, cp.nome, u_criado.nome, u_atualizado.nome, e.nome_fantasia`;
        sql += ` ORDER BY c.nome ASC`;

        // Paginação
        sql += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(limit, offset);

        const result = await query(sql, params);
        return result.rows.map(row => this.castAttributes(row));
    }

    /**
     * Buscar categoria por ID com relacionamentos
     */
    async findByIdWithDetails(id, empresaId = null) {
        let sql = `
            SELECT 
                c.*,
                cp.nome as categoria_pai_nome,
                u_criado.nome as criado_por_nome,
                u_atualizado.nome as atualizado_por_nome,
                e.nome_fantasia as empresa_nome,
                COUNT(t.id) as total_tipos,
                COUNT(DISTINCT sub.id) as total_subcategorias
            FROM categorias c
            LEFT JOIN categorias cp ON c.categoria_pai_id = cp.id
            LEFT JOIN categorias sub ON c.id = sub.categoria_pai_id AND sub.ativo = true
            LEFT JOIN usuarios u_criado ON c.criado_por = u_criado.id
            LEFT JOIN usuarios u_atualizado ON c.atualizado_por = u_atualizado.id
            LEFT JOIN empresas e ON c.empresa_id = e.id
            LEFT JOIN tipos t ON c.id = t.categoria_id AND t.ativo = true
            WHERE c.id = $1 AND c.ativo = true
        `;

        const params = [id];

        if (empresaId !== null) {
            sql += ` AND (c.empresa_id = $2 OR c.empresa_id IS NULL)`;
            params.push(empresaId);
        }

        sql += ` GROUP BY c.id, cp.nome, u_criado.nome, u_atualizado.nome, e.nome_fantasia`;

        const result = await query(sql, params);
        return result.rows.length > 0 ? this.castAttributes(result.rows[0]) : null;
    }

    /**
     * Verificar se nome é único
     */
    async isNomeUnique(nome, empresaId = null, excludeId = null) {
        let sql = `
            SELECT id FROM categorias 
            WHERE LOWER(nome) = LOWER($1) AND ativo = true
        `;
        const params = [nome];
        let paramIndex = 2;

        // Verificar no mesmo escopo (empresa ou global)
        if (empresaId === null) {
            sql += ` AND empresa_id IS NULL`;
        } else {
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
     * Buscar tipos de uma categoria
     */
    async getTipos(categoriaId, empresaId = null) {
        let sql = `
            SELECT 
                t.id, t.nome, t.descricao, um.sigla as unidade_medida_sigla,
                t.estoque_minimo, t.vida_util_meses, t.perecivel,
                t.criado_em, t.atualizado_em,
                COUNT(p.id) as total_produtos
            FROM tipos t
            LEFT JOIN unidades_medida um ON t.unidade_medida_padrao_id = um.id
            LEFT JOIN produtos p ON t.id = p.tipo_id AND p.ativo = true
            WHERE t.categoria_id = $1 AND t.ativo = true
        `;

        const params = [categoriaId];

        if (empresaId) {
            sql += ` AND (t.empresa_id = $2 OR t.empresa_id IS NULL)`;
            params.push(empresaId);
        }

        sql += ` GROUP BY t.id, t.nome, t.descricao, um.sigla, t.estoque_minimo, t.vida_util_meses, t.perecivel, t.criado_em, t.atualizado_em`;
        sql += ` ORDER BY t.nome`;

        const result = await query(sql, params);
        return result.rows;
    }

    /**
     * Buscar subcategorias de uma categoria
     */
    async getSubcategorias(categoriaId, empresaId = null) {
        let sql = `
            SELECT 
                c.id, c.nome, c.descricao, c.cor, c.icone,
                c.criado_em, c.atualizado_em,
                COUNT(t.id) as total_tipos
            FROM categorias c
            LEFT JOIN tipos t ON c.id = t.categoria_id AND t.ativo = true
            WHERE c.categoria_pai_id = $1 AND c.ativo = true
        `;

        const params = [categoriaId];

        if (empresaId) {
            sql += ` AND (c.empresa_id = $2 OR c.empresa_id IS NULL)`;
            params.push(empresaId);
        }

        sql += ` GROUP BY c.id, c.nome, c.descricao, c.cor, c.icone, c.criado_em, c.atualizado_em`;
        sql += ` ORDER BY c.nome`;

        const result = await query(sql, params);
        return result.rows;
    }

    /**
     * Verificar se categoria pode ser excluída
     */
    async canDelete(id) {
        const sql = `
            SELECT 
                COUNT(t.id) as total_tipos,
                COUNT(sub.id) as total_subcategorias
            FROM categorias c
            LEFT JOIN tipos t ON c.id = t.categoria_id AND t.ativo = true
            LEFT JOIN categorias sub ON c.id = sub.categoria_pai_id AND sub.ativo = true
            WHERE c.id = $1
            GROUP BY c.id
        `;

        const result = await query(sql, [id]);

        if (result.rows.length === 0) return true;

        const counts = result.rows[0];
        return parseInt(counts.total_tipos) === 0 && parseInt(counts.total_subcategorias) === 0;
    }

    /**
     * Buscar categorias hierárquicas (árvore)
     */
    async findHierarchy(empresaId = null) {
        let sql = `
            WITH RECURSIVE categoria_tree AS (
                -- Categorias raiz (sem pai)
                SELECT 
                    c.id, c.nome, c.descricao, c.cor, c.icone,
                    c.categoria_pai_id, c.empresa_id,
                    0 as nivel,
                    ARRAY[c.id] as caminho,
                    c.nome as caminho_nomes
                FROM categorias c
                WHERE c.categoria_pai_id IS NULL 
                    AND c.ativo = true
                
                UNION ALL
                
                -- Subcategorias recursivamente
                SELECT 
                    c.id, c.nome, c.descricao, c.cor, c.icone,
                    c.categoria_pai_id, c.empresa_id,
                    ct.nivel + 1,
                    ct.caminho || c.id,
                    ct.caminho_nomes || ' > ' || c.nome
                FROM categorias c
                INNER JOIN categoria_tree ct ON c.categoria_pai_id = ct.id
                WHERE c.ativo = true
            )
            SELECT 
                ct.*,
                COUNT(t.id) as total_tipos
            FROM categoria_tree ct
            LEFT JOIN tipos t ON ct.id = t.categoria_id AND t.ativo = true
        `;

        const params = [];

        if (empresaId !== null) {
            sql += ` WHERE (ct.empresa_id = $1 OR ct.empresa_id IS NULL)`;
            params.push(empresaId);
        }

        sql += ` GROUP BY ct.id, ct.nome, ct.descricao, ct.cor, ct.icone, ct.categoria_pai_id, ct.empresa_id, ct.nivel, ct.caminho, ct.caminho_nomes`;
        sql += ` ORDER BY ct.caminho`;

        const result = await query(sql, params);
        return result.rows;
    }

    /**
     * Buscar categorias mais utilizadas
     */
    async findMostUsed(empresaId = null, limit = 10) {
        let sql = `
            SELECT 
                c.id, c.nome, c.cor,
                COUNT(p.id) as total_produtos,
                COUNT(DISTINCT t.id) as total_tipos
            FROM categorias c
            INNER JOIN tipos t ON c.id = t.categoria_id AND t.ativo = true
            LEFT JOIN produtos p ON t.id = p.tipo_id AND p.ativo = true
            WHERE c.ativo = true
        `;

        const params = [];

        if (empresaId !== null) {
            sql += ` AND (c.empresa_id = $1 OR c.empresa_id IS NULL)`;
            params.push(empresaId);
        }

        sql += ` GROUP BY c.id, c.nome, c.cor`;
        sql += ` HAVING COUNT(p.id) > 0`;
        sql += ` ORDER BY COUNT(p.id) DESC, c.nome`;
        sql += ` LIMIT ${params.length + 1}`;
        params.push(limit);

        const result = await query(sql, params);
        return result.rows;
    }

    /**
     * Obter estatísticas das categorias
     */
    async getEstatisticas(empresaId = null) {
        let sql = `
            SELECT 
                COUNT(*) as total_categorias,
                COUNT(CASE WHEN empresa_id IS NULL THEN 1 END) as categorias_globais,
                COUNT(CASE WHEN empresa_id IS NOT NULL THEN 1 END) as categorias_empresa,
                COUNT(CASE WHEN categoria_pai_id IS NULL THEN 1 END) as categorias_raiz,
                COUNT(CASE WHEN categoria_pai_id IS NOT NULL THEN 1 END) as subcategorias
            FROM categorias
            WHERE ativo = true
        `;

        const params = [];

        if (empresaId !== null) {
            sql += ` AND (empresa_id = $1 OR empresa_id IS NULL)`;
            params.push(empresaId);
        }

        const result = await query(sql, params);
        return result.rows[0];
    }

    /**
     * Buscar categorias por cor
     */
    async findByCor(cor, empresaId = null) {
        let sql = `
            SELECT 
                c.id, c.nome, c.descricao, c.cor,
                COUNT(t.id) as total_tipos
            FROM categorias c
            LEFT JOIN tipos t ON c.id = t.categoria_id AND t.ativo = true
            WHERE c.ativo = true AND c.cor = $1
        `;

        const params = [cor];

        if (empresaId !== null) {
            sql += ` AND (c.empresa_id = $2 OR c.empresa_id IS NULL)`;
            params.push(empresaId);
        }

        sql += ` GROUP BY c.id, c.nome, c.descricao, c.cor`;
        sql += ` ORDER BY c.nome`;

        const result = await query(sql, params);
        return result.rows;
    }

    /**
     * Verificar se pode ser definida como categoria pai (evitar ciclos)
     */
    async canBeParent(categoriaId, potentialParentId) {
        if (categoriaId === potentialParentId) return false;

        const sql = `
            WITH RECURSIVE parent_tree AS (
                SELECT id, categoria_pai_id
                FROM categorias
                WHERE id = $1 AND ativo = true
                
                UNION ALL
                
                SELECT c.id, c.categoria_pai_id
                FROM categorias c
                INNER JOIN parent_tree pt ON c.id = pt.categoria_pai_id
                WHERE c.ativo = true
            )
            SELECT COUNT(*) as count
            FROM parent_tree
            WHERE id = $2
        `;

        const result = await query(sql, [categoriaId, potentialParentId]);
        return parseInt(result.rows[0].count) === 0;
    }

    /**
     * Validar dados antes de salvar
     */
    validate(data) {
        const errors = [];

        if (!data.nome || data.nome.trim().length === 0) {
            errors.push('Nome da categoria é obrigatório');
        }

        if (data.nome && data.nome.length > 255) {
            errors.push('Nome da categoria deve ter no máximo 255 caracteres');
        }

        if (data.descricao && data.descricao.length > 500) {
            errors.push('Descrição deve ter no máximo 500 caracteres');
        }

        if (data.cor && !/^#[0-9A-Fa-f]{6}$/.test(data.cor)) {
            errors.push('Cor deve estar no formato hexadecimal (#RRGGBB)');
        }

        if (data.icone && data.icone.length > 50) {
            errors.push('Ícone deve ter no máximo 50 caracteres');
        }

        return errors;
    }

    /**
     * Formatar dados para exibição
     */
    format(data) {
        if (!data) return null;

        const formatted = { ...data };

        // Converter booleanos
        if (typeof formatted.ativo === 'string') {
            formatted.ativo = formatted.ativo === 'true';
        }

        // Formatar cores
        if (formatted.cor && !formatted.cor.startsWith('#')) {
            formatted.cor = `#${formatted.cor}`;
        }

        return formatted;
    }
}

module.exports = Categoria;