/**
 * Model de Usuario
 * Gerencia usuários do sistema com perfis e permissões
 * Suporta multi-tenant e controle hierárquico
 */

const BaseModel = require('./BaseModel');
const { query, getClient } = require('../config/database');
const bcrypt = require('bcryptjs');

class Usuario extends BaseModel {
    constructor() {
        super('usuarios', 'id');

        // Campos que podem ser preenchidos em massa
        this.fillable = [
            'empresa_id', 'perfil_id', 'nome', 'login', 'email',
            'cpf', 'telefone', 'cargo'
        ];

        // Campos que devem ser omitidos nas respostas
        this.hidden = ['senha'];

        // Conversões de tipo automáticas
        this.casts = {
            'ultimo_acesso': 'date',
            'ativo': 'boolean'
        };

        // Relacionamentos
        this.relationships = {
            empresa: { table: 'empresas', foreign_key: 'empresa_id', local_key: 'id' },
            perfil: { table: 'perfis_usuario', foreign_key: 'perfil_id', local_key: 'id' }
        };
    }

    /**
     * Buscar usuários por empresa
     */
    async findByEmpresa(empresaId, options = {}) {
        const {
            search = null,
            perfil_id = null,
            ativo = true,
            page = 1,
            limit = 20
        } = options;

        const offset = (page - 1) * limit;
        let paramIndex = 1;
        const params = [empresaId];
        const conditions = ['u.empresa_id = $1'];

        let sql = `
            SELECT 
                u.id, u.nome, u.login, u.email, u.cpf, u.telefone,
                u.cargo, u.ultimo_acesso, u.ativo, u.criado_em,
                p.nome as perfil_nome, p.nivel_hierarquia, p.permissoes,
                e.razao_social as empresa_nome,
                COUNT(uf.fazenda_id) as fazendas_acesso
            FROM usuarios u
            INNER JOIN perfis_usuario p ON u.perfil_id = p.id
            LEFT JOIN empresas e ON u.empresa_id = e.id
            LEFT JOIN usuario_fazendas uf ON u.id = uf.usuario_id AND uf.ativo = true
        `;

        // Filtros dinâmicos
        if (ativo !== null) {
            conditions.push('u.ativo = $' + (++paramIndex));
            params.push(ativo);
        }

        if (search) {
            conditions.push(`(LOWER(u.nome) LIKE LOWER($${++paramIndex}) OR LOWER(u.login) LIKE LOWER($${paramIndex}) OR LOWER(u.email) LIKE LOWER($${paramIndex}))`);
            params.push(`%${search}%`);
        }

        if (perfil_id) {
            conditions.push(`u.perfil_id = $${++paramIndex}`);
            params.push(perfil_id);
        }

        sql += ` WHERE ${conditions.join(' AND ')}`;
        sql += ` GROUP BY u.id, p.id, e.id`;
        sql += ` ORDER BY u.nome`;

        // Paginação
        sql += ` LIMIT $${++paramIndex} OFFSET $${++paramIndex}`;
        params.push(limit, offset);

        const result = await query(sql, params);
        return result.rows.map(row => this.castAttributes(row));
    }

    /**
     * Buscar usuário por ID com detalhes completos
     */
    async findByIdWithDetails(id, empresaId = null) {
        let sql = `
            SELECT 
                u.*,
                p.nome as perfil_nome, p.nivel_hierarquia, p.permissoes,
                e.razao_social as empresa_nome,
                array_agg(DISTINCT f.nome) FILTER (WHERE f.nome IS NOT NULL) as fazendas_nomes
            FROM usuarios u
            INNER JOIN perfis_usuario p ON u.perfil_id = p.id
            LEFT JOIN empresas e ON u.empresa_id = e.id
            LEFT JOIN usuario_fazendas uf ON u.id = uf.usuario_id AND uf.ativo = true
            LEFT JOIN fazendas f ON uf.fazenda_id = f.id AND f.ativo = true
            WHERE u.id = $1 AND u.ativo = true
        `;

        const params = [id];

        if (empresaId) {
            sql += ` AND u.empresa_id = $2`;
            params.push(empresaId);
        }

        sql += ` GROUP BY u.id, p.id, e.id`;

        const result = await query(sql, params);
        return result.rows.length > 0 ? this.castAttributes(result.rows[0]) : null;
    }

    /**
     * Buscar usuário por login ou email para autenticação
     */
    async findForAuth(identifier) {
        const sql = `
            SELECT 
                u.id, u.nome, u.login, u.email, u.senha, u.ativo,
                u.empresa_id, u.perfil_id,
                p.nome as perfil_nome, p.nivel_hierarquia, p.permissoes,
                e.razao_social as empresa_nome
            FROM usuarios u
            INNER JOIN perfis_usuario p ON u.perfil_id = p.id
            LEFT JOIN empresas e ON u.empresa_id = e.id
            WHERE (u.email = $1 OR u.login = $1) 
                AND u.ativo = true 
                AND p.ativo = true
        `;

        const result = await query(sql, [identifier]);
        return result.rows.length > 0 ? result.rows[0] : null; // Não aplicar castAttributes aqui para manter senha
    }

    /**
     * Verificar se login é único
     */
    async isLoginUnique(login, excludeId = null) {
        let sql = `SELECT id FROM usuarios WHERE login = $1 AND ativo = true`;
        const params = [login];

        if (excludeId) {
            sql += ` AND id != $2`;
            params.push(excludeId);
        }

        const result = await query(sql, params);
        return result.rows.length === 0;
    }

    /**
     * Verificar se email é único
     */
    async isEmailUnique(email, excludeId = null) {
        let sql = `SELECT id FROM usuarios WHERE email = $1 AND ativo = true`;
        const params = [email];

        if (excludeId) {
            sql += ` AND id != $2`;
            params.push(excludeId);
        }

        const result = await query(sql, params);
        return result.rows.length === 0;
    }

    /**
     * Criar usuário com senha criptografada
     */
    async createWithPassword(data, senha) {
        const client = await getClient();

        try {
            await client.query('BEGIN');

            // Criptografar senha
            const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 10;
            const senhaHash = await bcrypt.hash(senha, saltRounds);

            // Inserir usuário
            const sql = `
                INSERT INTO usuarios (
                    empresa_id, perfil_id, nome, login, email, senha,
                    cpf, telefone, cargo, criado_por
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                RETURNING id
            `;

            const params = [
                data.empresa_id || null,
                data.perfil_id || 4, // Operador por padrão
                data.nome,
                data.login,
                data.email,
                senhaHash,
                data.cpf || null,
                data.telefone || null,
                data.cargo || null,
                data.criado_por || null
            ];

            const result = await client.query(sql, params);
            const usuarioId = result.rows[0].id;

            // Associar fazendas se fornecidas
            if (data.fazendas_ids && Array.isArray(data.fazendas_ids)) {
                for (const fazendaId of data.fazendas_ids) {
                    await client.query(`
                        INSERT INTO usuario_fazendas (usuario_id, fazenda_id)
                        VALUES ($1, $2)
                    `, [usuarioId, fazendaId]);
                }
            }

            await client.query('COMMIT');

            // Buscar usuário criado com detalhes
            return await this.findByIdWithDetails(usuarioId);

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Atualizar senha do usuário
     */
    async updatePassword(id, novaSenha) {
        const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 10;
        const senhaHash = await bcrypt.hash(novaSenha, saltRounds);

        const sql = `
            UPDATE usuarios 
            SET senha = $1, atualizado_em = NOW()
            WHERE id = $2 AND ativo = true
            RETURNING id, nome, email
        `;

        const result = await query(sql, [senhaHash, id]);
        return result.rows.length > 0 ? this.castAttributes(result.rows[0]) : null;
    }

    /**
     * Verificar senha atual
     */
    async verifyPassword(id, senha) {
        const sql = `SELECT senha FROM usuarios WHERE id = $1 AND ativo = true`;
        const result = await query(sql, [id]);

        if (result.rows.length === 0) {
            return false;
        }

        return await bcrypt.compare(senha, result.rows[0].senha);
    }

    /**
     * Atualizar último acesso
     */
    async updateLastAccess(id) {
        const sql = `
            UPDATE usuarios 
            SET ultimo_acesso = NOW()
            WHERE id = $1 AND ativo = true
        `;

        await query(sql, [id]);
    }

    /**
     * Buscar usuários por perfil
     */
    async findByPerfil(perfilId, empresaId = null) {
        let sql = `
            SELECT 
                u.id, u.nome, u.login, u.email, u.cargo,
                u.ultimo_acesso, u.criado_em,
                p.nome as perfil_nome, p.nivel_hierarquia
            FROM usuarios u
            INNER JOIN perfis_usuario p ON u.perfil_id = p.id
            WHERE u.perfil_id = $1 AND u.ativo = true
        `;

        const params = [perfilId];

        if (empresaId) {
            sql += ` AND u.empresa_id = $2`;
            params.push(empresaId);
        }

        sql += ` ORDER BY u.nome`;

        const result = await query(sql, params);
        return result.rows.map(row => this.castAttributes(row));
    }

    /**
     * Buscar usuários inativos por período
     */
    async findInativosPorPeriodo(dias = 30, empresaId = null) {
        let sql = `
            SELECT 
                u.id, u.nome, u.email, u.ultimo_acesso,
                p.nome as perfil_nome,
                (CURRENT_DATE - u.ultimo_acesso::date) as dias_inativo
            FROM usuarios u
            INNER JOIN perfis_usuario p ON u.perfil_id = p.id
            WHERE u.ativo = true 
                AND (u.ultimo_acesso IS NULL OR u.ultimo_acesso < CURRENT_DATE - INTERVAL '$1 days')
        `;

        const params = [dias];

        if (empresaId) {
            sql += ` AND u.empresa_id = $2`;
            params.push(empresaId);
        }

        sql += ` ORDER BY u.ultimo_acesso ASC NULLS FIRST`;

        const result = await query(sql, params);
        return result.rows;
    }

    /**
     * Gerenciar acesso às fazendas do usuário
     */
    async updateFazendasAccess(usuarioId, fazendasIds) {
        const client = await getClient();

        try {
            await client.query('BEGIN');

            // Remover acessos existentes
            await client.query(`
                DELETE FROM usuario_fazendas WHERE usuario_id = $1
            `, [usuarioId]);

            // Adicionar novos acessos
            if (fazendasIds && fazendasIds.length > 0) {
                for (const fazendaId of fazendasIds) {
                    await client.query(`
                        INSERT INTO usuario_fazendas (usuario_id, fazenda_id)
                        VALUES ($1, $2)
                    `, [usuarioId, fazendaId]);
                }
            }

            await client.query('COMMIT');
            return true;

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Buscar fazendas que o usuário tem acesso
     */
    async getFazendasAccess(usuarioId) {
        const sql = `
            SELECT 
                f.id, f.nome, f.codigo, f.cidade, f.estado
            FROM usuario_fazendas uf
            INNER JOIN fazendas f ON uf.fazenda_id = f.id
            WHERE uf.usuario_id = $1 AND uf.ativo = true AND f.ativo = true
            ORDER BY f.nome
        `;

        const result = await query(sql, [usuarioId]);
        return result.rows;
    }

    /**
     * Obter estatísticas de usuários
     */
    async getEstatisticas(empresaId = null) {
        let sql = `
            SELECT 
                COUNT(*) as total_usuarios,
                COUNT(CASE WHEN ativo = true THEN 1 END) as usuarios_ativos,
                COUNT(CASE WHEN ultimo_acesso > CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as ativos_semana,
                COUNT(CASE WHEN ultimo_acesso > CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as ativos_mes,
                COUNT(CASE WHEN ultimo_acesso IS NULL OR ultimo_acesso < CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as inativos_mes
            FROM usuarios u
            WHERE u.ativo = true
        `;

        const params = [];

        if (empresaId) {
            sql += ` AND u.empresa_id = $1`;
            params.push(empresaId);
        }

        const result = await query(sql, params);
        return result.rows[0];
    }

    /**
     * Buscar usuários por cargo
     */
    async findByCargo(cargo, empresaId = null) {
        let sql = `
            SELECT 
                u.id, u.nome, u.email, u.telefone, u.cargo,
                p.nome as perfil_nome
            FROM usuarios u
            INNER JOIN perfis_usuario p ON u.perfil_id = p.id
            WHERE LOWER(u.cargo) LIKE LOWER($1) AND u.ativo = true
        `;

        const params = [`%${cargo}%`];

        if (empresaId) {
            sql += ` AND u.empresa_id = $2`;
            params.push(empresaId);
        }

        sql += ` ORDER BY u.nome`;

        const result = await query(sql, params);
        return result.rows.map(row => this.castAttributes(row));
    }

    /**
     * Validar dados do usuário
     */
    validate(data) {
        const errors = [];

        if (!data.nome || data.nome.trim().length === 0) {
            errors.push('Nome é obrigatório');
        }

        if (!data.login || data.login.trim().length < 3) {
            errors.push('Login deve ter pelo menos 3 caracteres');
        }

        if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
            errors.push('Email válido é obrigatório');
        }

        if (data.cpf) {
            const cpfLimpo = data.cpf.replace(/[^\d]/g, '');
            if (cpfLimpo.length !== 11) {
                errors.push('CPF deve ter 11 dígitos');
            }
        }

        if (data.telefone && data.telefone.replace(/[^\d]/g, '').length < 10) {
            errors.push('Telefone deve ter pelo menos 10 dígitos');
        }

        return errors;
    }
}

module.exports = Usuario;