/**
 * Base Model - Classe base para todos os models
 * Implementa funcionalidades comuns como CRUD, validações e queries
 * Repository Pattern para abstração de dados
 */

const { query, getClient } = require('../config/database');

class BaseModel {
    constructor(tableName, primaryKey = 'id') {
        this.tableName = tableName;
        this.primaryKey = primaryKey;
        this.fillable = []; // Campos que podem ser preenchidos em massa
        this.hidden = ['senha']; // Campos que devem ser omitidos nas respostas
        this.casts = {}; // Conversões de tipo automáticas
        this.relationships = {}; // Relacionamentos com outras tabelas
    }

    /**
     * Aplicar conversões de tipo aos atributos
     */
    castAttributes(attributes) {
        const casted = { ...attributes };

        Object.keys(this.casts).forEach(key => {
            if (casted[key] !== null && casted[key] !== undefined) {
                switch (this.casts[key]) {
                    case 'int':
                        casted[key] = parseInt(casted[key]);
                        break;
                    case 'float':
                        casted[key] = parseFloat(casted[key]);
                        break;
                    case 'boolean':
                        casted[key] = Boolean(casted[key]);
                        break;
                    case 'date':
                        casted[key] = new Date(casted[key]);
                        break;
                    case 'json':
                        if (typeof casted[key] === 'string') {
                            try {
                                casted[key] = JSON.parse(casted[key]);
                            } catch (e) {
                                // Manter como string se não for JSON válido
                            }
                        }
                        break;
                }
            }
        });

        // Remover campos hidden
        this.hidden.forEach(field => {
            delete casted[field];
        });

        return casted;
    }

    /**
     * Construir cláusula WHERE dinamicamente
     */
    buildWhereClause(conditions, params = [], startIndex = 1) {
        const whereConditions = [];
        let paramIndex = startIndex;

        Object.keys(conditions).forEach(key => {
            const value = conditions[key];

            if (value === null) {
                whereConditions.push(`${key} IS NULL`);
            } else if (Array.isArray(value)) {
                whereConditions.push(`${key} = ANY($${paramIndex})`);
                params.push(value);
                paramIndex++;
            } else if (typeof value === 'object' && value.operator) {
                // Operadores customizados: { operator: 'LIKE', value: '%test%' }
                whereConditions.push(`${key} ${value.operator} $${paramIndex}`);
                params.push(value.value);
                paramIndex++;
            } else {
                whereConditions.push(`${key} = $${paramIndex}`);
                params.push(value);
                paramIndex++;
            }
        });

        return {
            conditions: whereConditions,
            paramIndex
        };
    }

    /**
     * Buscar todos os registros com filtros
     */
    async findAll(filters = {}, options = {}) {
        const {
            where = {},
            select = '*',
            orderBy = `${this.primaryKey} DESC`,
            limit,
            offset,
            joins = []
        } = options;

        let sql = `SELECT ${select} FROM ${this.tableName}`;
        const params = [];
        let paramIndex = 1;

        // Adicionar JOINs
        if (joins.length > 0) {
            sql += ' ' + joins.join(' ');
        }

        // Filtro padrão para registros ativos
        const allConditions = { ativo: true, ...where };

        // Construir WHERE
        const whereClause = this.buildWhereClause(allConditions, params, paramIndex);
        if (whereClause.conditions.length > 0) {
            sql += ` WHERE ${whereClause.conditions.join(' AND ')}`;
            paramIndex = whereClause.paramIndex;
        }

        // Adicionar ORDER BY
        sql += ` ORDER BY ${orderBy}`;

        // Adicionar LIMIT e OFFSET
        if (limit) {
            sql += ` LIMIT $${paramIndex}`;
            params.push(limit);
            paramIndex++;
        }

        if (offset) {
            sql += ` OFFSET $${paramIndex}`;
            params.push(offset);
        }

        const result = await query(sql, params);
        return result.rows.map(row => this.castAttributes(row));
    }

    /**
     * Buscar um registro por ID
     */
    async findById(id, options = {}) {
        const { select = '*', joins = [] } = options;

        let sql = `SELECT ${select} FROM ${this.tableName}`;

        if (joins.length > 0) {
            sql += ' ' + joins.join(' ');
        }

        sql += ` WHERE ${this.tableName}.${this.primaryKey} = $1 AND ${this.tableName}.ativo = true`;

        const result = await query(sql, [id]);

        if (result.rows.length === 0) {
            return null;
        }

        return this.castAttributes(result.rows[0]);
    }

    /**
     * Buscar um registro por condições
     */
    async findOne(where = {}, options = {}) {
        const records = await this.findAll({}, { ...options, where, limit: 1 });
        return records.length > 0 ? records[0] : null;
    }

    /**
     * Criar novo registro
     */
    async create(data) {
        // Filtrar apenas campos fillable
        const filteredData = {};
        Object.keys(data).forEach(key => {
            if (this.fillable.includes(key)) {
                filteredData[key] = data[key];
            }
        });

        // Adicionar timestamp de criação
        filteredData.criado_em = new Date();
        filteredData.ativo = true;

        const fields = Object.keys(filteredData);
        const values = Object.values(filteredData);
        const placeholders = fields.map((_, index) => `$${index + 1}`).join(', ');

        const sql = `
            INSERT INTO ${this.tableName} (${fields.join(', ')})
            VALUES (${placeholders})
            RETURNING *
        `;

        const result = await query(sql, values);
        return this.castAttributes(result.rows[0]);
    }

    /**
     * Atualizar registro por ID
     */
    async update(id, data) {
        // Filtrar apenas campos fillable
        const filteredData = {};
        Object.keys(data).forEach(key => {
            if (this.fillable.includes(key)) {
                filteredData[key] = data[key];
            }
        });

        // Adicionar timestamp de atualização
        filteredData.atualizado_em = new Date();

        const fields = Object.keys(filteredData);
        const values = Object.values(filteredData);
        const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');

        const sql = `
            UPDATE ${this.tableName} 
            SET ${setClause}
            WHERE ${this.primaryKey} = $1 AND ativo = true
            RETURNING *
        `;

        const result = await query(sql, [id, ...values]);

        if (result.rows.length === 0) {
            return null;
        }

        return this.castAttributes(result.rows[0]);
    }

    /**
     * Excluir registro (hard delete)
     */
    async delete(id) {
        const sql = `DELETE FROM ${this.tableName} WHERE ${this.primaryKey} = $1 RETURNING *`;
        const result = await query(sql, [id]);

        if (result.rows.length === 0) {
            return null;
        }

        return this.castAttributes(result.rows[0]);
    }

    /**
     * Soft delete - marcar como inativo
     */
    async softDelete(id, userId = null) {
        const data = {
            ativo: false,
            atualizado_em: new Date()
        };

        if (userId) {
            data.atualizado_por = userId;
        }

        return this.update(id, data);
    }

    /**
     * Contar registros com filtros
     */
    async count(where = {}) {
        const allConditions = { ativo: true, ...where };
        const params = [];

        const whereClause = this.buildWhereClause(allConditions, params, 1);

        let sql = `SELECT COUNT(*) as total FROM ${this.tableName}`;

        if (whereClause.conditions.length > 0) {
            sql += ` WHERE ${whereClause.conditions.join(' AND ')}`;
        }

        const result = await query(sql, params);
        return parseInt(result.rows[0].total);
    }

    /**
     * Verificar se registro existe
     */
    async exists(where = {}) {
        const count = await this.count(where);
        return count > 0;
    }

    /**
     * Buscar primeiro registro
     */
    async first(where = {}, options = {}) {
        return this.findOne(where, { ...options, limit: 1 });
    }

    /**
     * Buscar último registro
     */
    async last(where = {}, options = {}) {
        const orderBy = `${this.primaryKey} DESC`;
        return this.findOne(where, { ...options, orderBy, limit: 1 });
    }

    /**
     * Criar múltiplos registros em uma transação
     */
    async createMany(dataArray) {
        const client = await getClient();
        const created = [];

        try {
            await client.query('BEGIN');

            for (const data of dataArray) {
                const result = await this.create(data);
                created.push(result);
            }

            await client.query('COMMIT');
            return created;

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Atualizar múltiplos registros em uma transação
     */
    async updateMany(updates) {
        const client = await getClient();
        const updated = [];

        try {
            await client.query('BEGIN');

            for (const { id, data } of updates) {
                const result = await this.update(id, data);
                if (result) {
                    updated.push(result);
                }
            }

            await client.query('COMMIT');
            return updated;

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Buscar registros com paginação
     */
    async paginate(page = 1, limit = 20, where = {}, options = {}) {
        const offset = (page - 1) * limit;

        const [records, total] = await Promise.all([
            this.findAll({}, { ...options, where, limit, offset }),
            this.count(where)
        ]);

        return {
            data: records,
            pagination: {
                current_page: page,
                per_page: limit,
                total: total,
                last_page: Math.ceil(total / limit),
                from: offset + 1,
                to: offset + records.length
            }
        };
    }

    /**
     * Executar query raw
     */
    async raw(sql, params = []) {
        const result = await query(sql, params);
        return result.rows.map(row => this.castAttributes(row));
    }

    /**
     * Verificar se tem relacionamento ativo
     */
    async hasRelated(id, relatedTable, foreignKey) {
        const sql = `
            SELECT COUNT(*) as total 
            FROM ${relatedTable} 
            WHERE ${foreignKey} = $1 AND ativo = true
        `;

        const result = await query(sql, [id]);
        return parseInt(result.rows[0].total) > 0;
    }

    /**
     * Verificar se produto tem estoque
     */
    async hasEstoque(produtoId) {
        const sql = `
            SELECT COALESCE(SUM(quantidade_atual), 0) as total
            FROM estoque 
            WHERE produto_id = $1
        `;

        const result = await query(sql, [produtoId]);
        return parseFloat(result.rows[0].total) > 0;
    }

    /**
     * Verificar se produto tem movimentações
     */
    async hasMovimentacoes(produtoId) {
        const sql = `
            SELECT COUNT(*) as total
            FROM movimentacao_itens 
            WHERE produto_id = $1
        `;

        const result = await query(sql, [produtoId]);
        return parseInt(result.rows[0].total) > 0;
    }

    /**
     * Buscar com relacionamentos (JOIN)
     */
    async findWithRelations(where = {}, relations = []) {
        let sql = `SELECT ${this.tableName}.*`;
        const joins = [];

        // Construir JOINs baseado nos relacionamentos definidos
        relations.forEach(relation => {
            if (this.relationships[relation]) {
                const rel = this.relationships[relation];
                sql += `, ${rel.table}.nome as ${relation}_nome`;
                joins.push(`LEFT JOIN ${rel.table} ON ${this.tableName}.${rel.foreign_key} = ${rel.table}.${rel.local_key}`);
            }
        });

        sql += ` FROM ${this.tableName}`;

        if (joins.length > 0) {
            sql += ' ' + joins.join(' ');
        }

        const allConditions = { [`${this.tableName}.ativo`]: true, ...where };
        const params = [];

        const whereClause = this.buildWhereClause(allConditions, params, 1);

        if (whereClause.conditions.length > 0) {
            sql += ` WHERE ${whereClause.conditions.join(' AND ')}`;
        }

        const result = await query(sql, params);
        return result.rows.map(row => this.castAttributes(row));
    }
}

module.exports = BaseModel;