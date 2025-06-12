/**
 * Base Model - Classe base para todos os models
 * Implementa funcionalidades comuns como CRUD, validações e queries
 */

const { query, getClient } = require('../config/database');

class BaseModel {
    constructor(tableName, primaryKey = 'id') {
        this.tableName = tableName;
        this.primaryKey = primaryKey;
        this.fillable = []; // Campos que podem ser preenchidos em massa
        this.hidden = ['senha']; // Campos que devem ser omitidos nas respostas
        this.casts = {}; // Conversões de tipo automáticas
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

        // Construir WHERE
        const whereConditions = this.buildWhereClause(where, params, paramIndex);
        if (whereConditions.conditions.length > 0) {
            sql += ` WHERE ${whereConditions.conditions.join(' AND ')}`;
            paramIndex = whereConditions.paramIndex;
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
            paramIndex++;
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
        
        sql += ` WHERE ${this.tableName}.${this.primaryKey} = $1`;

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
    async create(data, userId = null) {
        const filteredData = this.filterFillable(data);
        
        // Adicionar campos de auditoria
        if (userId) {
            filteredData.criado_por = userId;
        }
        
        const fields = Object.keys(filteredData);
        const values = Object.values(filteredData);
        const placeholders = values.map((_, index) => `$${index + 1}`);

        const sql = `
            INSERT INTO ${this.tableName} (${fields.join(', ')})
            VALUES (${placeholders.join(', ')})
            RETURNING *
        `;

        const result = await query(sql, values);
        return this.castAttributes(result.rows[0]);
    }

    /**
     * Atualizar registro
     */
    async update(id, data, userId = null) {
        const filteredData = this.filterFillable(data);
        
        // Adicionar campos de auditoria
        if (userId) {
            filteredData.atualizado_por = userId;
        }
        filteredData.atualizado_em = new Date();

        const fields = Object.keys(filteredData);
        const values = Object.values(filteredData);
        
        const setClause = fields.map((field, index) => `${field} = $${index + 1}`);
        values.push(id);

        const sql = `
            UPDATE ${this.tableName} 
            SET ${setClause.join(', ')}
            WHERE ${this.primaryKey} = $${values.length}
            RETURNING *
        `;

        const result = await query(sql, values);
        return result.rows.length > 0 ? this.castAttributes(result.rows[0]) : null;
    }

    /**
     * Excluir registro (soft delete se tiver campo 'ativo')
     */
    async delete(id, userId = null) {
        // Verificar se a tabela tem campo 'ativo' para soft delete
        const hasActiveField = await this.hasColumn('ativo');
        
        if (hasActiveField) {
            // Soft delete
            return await this.update(id, { ativo: false }, userId);
        } else {
            // Hard delete
            const sql = `DELETE FROM ${this.tableName} WHERE ${this.primaryKey} = $1 RETURNING *`;
            const result = await query(sql, [id]);
            return result.rows.length > 0 ? this.castAttributes(result.rows[0]) : null;
        }
    }

    /**
     * Contar registros
     */
    async count(where = {}) {
        let sql = `SELECT COUNT(*) as total FROM ${this.tableName}`;
        const params = [];
        
        const whereConditions = this.buildWhereClause(where, params, 1);
        if (whereConditions.conditions.length > 0) {
            sql += ` WHERE ${whereConditions.conditions.join(' AND ')}`;
        }

        const result = await query(sql, params);
        return parseInt(result.rows[0].total);
    }

    /**
     * Verificar se existe registro
     */
    async exists(where = {}) {
        const count = await this.count(where);
        return count > 0;
    }

    /**
     * Construir cláusula WHERE
     */
    buildWhereClause(where, params, startIndex) {
        const conditions = [];
        let paramIndex = startIndex;

        Object.entries(where).forEach(([field, value]) => {
            if (value === null) {
                conditions.push(`${field} IS NULL`);
            } else if (Array.isArray(value)) {
                const placeholders = value.map(() => `$${paramIndex++}`);
                conditions.push(`${field} IN (${placeholders.join(', ')})`);
                params.push(...value);
            } else if (typeof value === 'object' && value.operator) {
                conditions.push(`${field} ${value.operator} $${paramIndex++}`);
                params.push(value.value);
            } else {
                conditions.push(`${field} = $${paramIndex++}`);
                params.push(value);
            }
        });

        return { conditions, paramIndex };
    }

    /**
     * Filtrar apenas campos permitidos
     */
    filterFillable(data) {
        if (this.fillable.length === 0) {
            return data; // Se não definiu fillable, permite todos
        }

        const filtered = {};
        this.fillable.forEach(field => {
            if (data.hasOwnProperty(field)) {
                filtered[field] = data[field];
            }
        });

        return filtered;
    }

    /**
     * Aplicar conversões de tipo e ocultar campos sensíveis
     */
    castAttributes(row) {
        if (!row) return null;

        const casted = { ...row };

        // Aplicar conversões
        Object.entries(this.casts).forEach(([field, type]) => {
            if (casted[field] !== undefined) {
                switch (type) {
                    case 'boolean':
                        casted[field] = Boolean(casted[field]);
                        break;
                    case 'number':
                        casted[field] = Number(casted[field]);
                        break;
                    case 'date':
                        casted[field] = new Date(casted[field]);
                        break;
                    case 'json':
                        if (typeof casted[field] === 'string') {
                            casted[field] = JSON.parse(casted[field]);
                        }
                        break;
                }
            }
        });

        // Remover campos ocultos
        this.hidden.forEach(field => {
            delete casted[field];
        });

        return casted;
    }

    /**
     * Verificar se tabela tem uma coluna específica
     */
    async hasColumn(columnName) {
        const sql = `
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = $1 AND column_name = $2
        `;
        
        const result = await query(sql, [this.tableName, columnName]);
        return result.rows.length > 0;
    }

    /**
     * Executar query customizada
     */
    async customQuery(sql, params = []) {
        const result = await query(sql, params);
        return result.rows.map(row => this.castAttributes(row));
    }

    /**
     * Executar transação
     */
    async transaction(callback) {
        const client = await getClient();
        
        try {
            await client.query('BEGIN');
            const result = await callback(client);
            await client.query('COMMIT');
            return result;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }
}

module.exports = BaseModel; 