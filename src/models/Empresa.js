/**
 * Model de Empresa
 * Gerencia as empresas clientes do SaaS multi-tenant
 * Entidade raiz da hierarquia: Empresa → Fazendas → Setores
 */

const BaseModel = require('./BaseModel');
const { query, getClient } = require('../config/database');

class Empresa extends BaseModel {
    constructor() {
        super('empresas', 'id');

        // Campos que podem ser preenchidos em massa
        this.fillable = [
            'razao_social', 'nome_fantasia', 'cnpj', 'inscricao_estadual',
            'email', 'telefone', 'endereco_completo', 'cep', 'cidade', 'estado',
            'plano_assinatura', 'data_vencimento_plano'
        ];

        // Conversões de tipo automáticas
        this.casts = {
            'data_vencimento_plano': 'date',
            'ativo': 'boolean'
        };

        // Relacionamentos
        this.relationships = {
            fazendas: { table: 'fazendas', foreign_key: 'empresa_id', local_key: 'id' },
            usuarios: { table: 'usuarios', foreign_key: 'empresa_id', local_key: 'id' }
        };
    }

    /**
     * Buscar todas as empresas (apenas para admin sistema)
     */
    async findAll(options = {}) {
        const {
            search = null,
            plano = null,
            ativo = true,
            vencimento_proximo = false,
            page = 1,
            limit = 20
        } = options;

        const offset = (page - 1) * limit;
        let paramIndex = 1;
        const params = [];
        const conditions = [];

        let sql = `
            SELECT 
                e.id, e.razao_social, e.nome_fantasia, e.cnpj,
                e.email, e.telefone, e.cidade, e.estado,
                e.plano_assinatura, e.data_vencimento_plano, e.ativo, e.criado_em,
                COUNT(DISTINCT f.id) as total_fazendas,
                COUNT(DISTINCT u.id) as total_usuarios,
                COUNT(DISTINCT p.id) as total_produtos,
                CASE 
                    WHEN e.data_vencimento_plano <= CURRENT_DATE THEN 'VENCIDO'
                    WHEN e.data_vencimento_plano <= CURRENT_DATE + INTERVAL '7 days' THEN 'VENCENDO'
                    ELSE 'ATIVO'
                END as status_assinatura
            FROM empresas e
            LEFT JOIN fazendas f ON e.id = f.empresa_id AND f.ativo = true
            LEFT JOIN usuarios u ON e.id = u.empresa_id AND u.ativo = true
            LEFT JOIN produtos p ON e.id = p.empresa_id AND p.ativo = true
        `;

        // Filtros dinâmicos
        if (ativo !== null) {
            conditions.push(`e.ativo = $${paramIndex}`);
            params.push(ativo);
            paramIndex++;
        }

        if (search) {
            conditions.push(`(LOWER(e.razao_social) LIKE LOWER($${paramIndex}) OR LOWER(e.nome_fantasia) LIKE LOWER($${paramIndex}))`);
            params.push(`%${search}%`);
            paramIndex++;
        }

        if (plano) {
            conditions.push(`e.plano_assinatura = $${paramIndex}`);
            params.push(plano);
            paramIndex++;
        }

        if (vencimento_proximo) {
            conditions.push(`e.data_vencimento_plano <= CURRENT_DATE + INTERVAL '30 days'`);
        }

        if (conditions.length > 0) {
            sql += ` WHERE ${conditions.join(' AND ')}`;
        }

        sql += ` GROUP BY e.id`;
        sql += ` ORDER BY e.razao_social`;

        // Paginação
        sql += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(limit, offset);

        const result = await query(sql, params);
        return result.rows.map(row => this.castAttributes(row));
    }

    /**
     * Buscar empresa por ID com estatísticas completas
     */
    async findByIdWithStats(id) {
        const sql = `
            SELECT 
                e.*,
                COUNT(DISTINCT f.id) as total_fazendas,
                COUNT(DISTINCT u.id) as total_usuarios,
                COUNT(DISTINCT p.id) as total_produtos,
                COUNT(DISTINCT s.id) as total_setores,
                COALESCE(SUM(est.quantidade_atual), 0) as quantidade_total_estoque,
                COALESCE(SUM(est.valor_total), 0) as valor_total_estoque,
                COUNT(DISTINCT sf.id) as total_safras,
                CASE 
                    WHEN e.data_vencimento_plano <= CURRENT_DATE THEN 'VENCIDO'
                    WHEN e.data_vencimento_plano <= CURRENT_DATE + INTERVAL '7 days' THEN 'VENCENDO'
                    ELSE 'ATIVO'
                END as status_assinatura,
                (e.data_vencimento_plano - CURRENT_DATE) as dias_para_vencimento
            FROM empresas e
            LEFT JOIN fazendas f ON e.id = f.empresa_id AND f.ativo = true
            LEFT JOIN usuarios u ON e.id = u.empresa_id AND u.ativo = true
            LEFT JOIN produtos p ON e.id = p.empresa_id AND p.ativo = true
            LEFT JOIN setores s ON f.id = s.fazenda_id AND s.ativo = true
            LEFT JOIN estoque est ON s.id = est.setor_id
            LEFT JOIN safras sf ON f.id = sf.fazenda_id AND sf.ativo = true
            WHERE e.id = $1 AND e.ativo = true
            GROUP BY e.id
        `;

        const result = await query(sql, [id]);
        return result.rows.length > 0 ? this.castAttributes(result.rows[0]) : null;
    }

    /**
     * Verificar se CNPJ é único
     */
    async isCNPJUnique(cnpj, excludeId = null) {
        if (!cnpj) return true; // CNPJ é opcional

        let sql = `SELECT id FROM empresas WHERE cnpj = $1 AND ativo = true`;
        const params = [cnpj];

        if (excludeId) {
            sql += ` AND id != $2`;
            params.push(excludeId);
        }

        const result = await query(sql, params);
        return result.rows.length === 0;
    }

    /**
     * Buscar empresas com vencimento próximo
     */
    async findComVencimentoProximo(dias = 30) {
        const sql = `
            SELECT 
                e.id, e.razao_social, e.nome_fantasia, e.email,
                e.plano_assinatura, e.data_vencimento_plano,
                (e.data_vencimento_plano - CURRENT_DATE) as dias_para_vencimento,
                COUNT(DISTINCT u.id) as total_usuarios
            FROM empresas e
            LEFT JOIN usuarios u ON e.id = u.empresa_id AND u.ativo = true
            WHERE e.ativo = true 
                AND e.data_vencimento_plano IS NOT NULL
                AND e.data_vencimento_plano <= CURRENT_DATE + INTERVAL '$1 days'
                AND e.data_vencimento_plano >= CURRENT_DATE
            GROUP BY e.id
            ORDER BY e.data_vencimento_plano ASC
        `;

        const result = await query(sql, [dias]);
        return result.rows;
    }

    /**
     * Buscar empresas vencidas
     */
    async findVencidas() {
        const sql = `
            SELECT 
                e.id, e.razao_social, e.nome_fantasia, e.email,
                e.plano_assinatura, e.data_vencimento_plano,
                (CURRENT_DATE - e.data_vencimento_plano) as dias_vencido,
                COUNT(DISTINCT u.id) as total_usuarios
            FROM empresas e
            LEFT JOIN usuarios u ON e.id = u.empresa_id AND u.ativo = true
            WHERE e.ativo = true 
                AND e.data_vencimento_plano IS NOT NULL
                AND e.data_vencimento_plano < CURRENT_DATE
            GROUP BY e.id
            ORDER BY e.data_vencimento_plano ASC
        `;

        const result = await query(sql);
        return result.rows;
    }

    /**
     * Obter estatísticas gerais do sistema
     */
    async getEstatisticasGerais() {
        const sql = `
            SELECT 
                COUNT(*) as total_empresas,
                COUNT(CASE WHEN ativo = true THEN 1 END) as empresas_ativas,
                COUNT(CASE WHEN plano_assinatura = 'basico' THEN 1 END) as plano_basico,
                COUNT(CASE WHEN plano_assinatura = 'premium' THEN 1 END) as plano_premium,
                COUNT(CASE WHEN plano_assinatura = 'enterprise' THEN 1 END) as plano_enterprise,
                COUNT(CASE WHEN data_vencimento_plano < CURRENT_DATE THEN 1 END) as empresas_vencidas,
                COUNT(CASE WHEN data_vencimento_plano <= CURRENT_DATE + INTERVAL '30 days' AND data_vencimento_plano >= CURRENT_DATE THEN 1 END) as vencimento_proximo
            FROM empresas
            WHERE ativo = true
        `;

        const result = await query(sql);
        return result.rows[0];
    }

    /**
     * Obter estatísticas por período
     */
    async getEstatisticasPorPeriodo(periodo = 'mes') {
        let intervalCondition = '';

        switch (periodo) {
            case 'semana':
                intervalCondition = "DATE_TRUNC('week', criado_em) = DATE_TRUNC('week', CURRENT_DATE)";
                break;
            case 'mes':
                intervalCondition = "DATE_TRUNC('month', criado_em) = DATE_TRUNC('month', CURRENT_DATE)";
                break;
            case 'ano':
                intervalCondition = "DATE_TRUNC('year', criado_em) = DATE_TRUNC('year', CURRENT_DATE)";
                break;
            default:
                intervalCondition = "DATE_TRUNC('month', criado_em) = DATE_TRUNC('month', CURRENT_DATE)";
        }

        const sql = `
            SELECT 
                plano_assinatura,
                COUNT(*) as total_cadastros,
                COUNT(CASE WHEN ativo = true THEN 1 END) as cadastros_ativos
            FROM empresas
            WHERE ${intervalCondition}
            GROUP BY plano_assinatura
            ORDER BY total_cadastros DESC
        `;

        const result = await query(sql);
        return result.rows;
    }

    /**
     * Renovar assinatura da empresa
     */
    async renovarAssinatura(id, novoPlano, diasRenovacao = 365) {
        const sql = `
            UPDATE empresas 
            SET plano_assinatura = $1,
                data_vencimento_plano = COALESCE(
                    CASE WHEN data_vencimento_plano > CURRENT_DATE 
                         THEN data_vencimento_plano + INTERVAL '$2 days'
                         ELSE CURRENT_DATE + INTERVAL '$2 days'
                    END
                ),
                atualizado_em = NOW()
            WHERE id = $3 AND ativo = true
            RETURNING id, razao_social, plano_assinatura, data_vencimento_plano
        `;

        const result = await query(sql, [novoPlano, diasRenovacao, id]);
        return result.rows.length > 0 ? this.castAttributes(result.rows[0]) : null;
    }

    /**
     * Suspender empresa por vencimento
     */
    async suspenderPorVencimento(id, motivo = 'Assinatura vencida') {
        const client = await getClient();

        try {
            await client.query('BEGIN');

            // Desativar empresa
            await client.query(`
                UPDATE empresas 
                SET ativo = false, 
                    observacoes = COALESCE(observacoes, '') || ' | SUSPENSA: ' || $1,
                    atualizado_em = NOW()
                WHERE id = $2
            `, [motivo, id]);

            // Desativar usuários da empresa
            await client.query(`
                UPDATE usuarios 
                SET ativo = false, 
                    atualizado_em = NOW()
                WHERE empresa_id = $1
            `, [id]);

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
     * Reativar empresa
     */
    async reativar(id, novaDataVencimento) {
        const client = await getClient();

        try {
            await client.query('BEGIN');

            // Reativar empresa
            const empresaResult = await client.query(`
                UPDATE empresas 
                SET ativo = true,
                    data_vencimento_plano = $1,
                    atualizado_em = NOW()
                WHERE id = $2
                RETURNING *
            `, [novaDataVencimento, id]);

            if (empresaResult.rows.length === 0) {
                throw new Error('Empresa não encontrada');
            }

            // Reativar usuários da empresa
            await client.query(`
                UPDATE usuarios 
                SET ativo = true,
                    atualizado_em = NOW()
                WHERE empresa_id = $1
            `, [id]);

            await client.query('COMMIT');
            return this.castAttributes(empresaResult.rows[0]);

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Buscar fazendas da empresa
     */
    async getFazendas(empresaId, limit = 10) {
        const sql = `
            SELECT 
                f.id, f.nome, f.codigo, f.cidade, f.estado,
                f.area_total_hectares, f.tipo_producao,
                COUNT(DISTINCT s.id) as total_setores,
                COUNT(DISTINCT p.id) as total_produtos
            FROM fazendas f
            LEFT JOIN setores s ON f.id = s.fazenda_id AND s.ativo = true
            LEFT JOIN produtos p ON f.id = p.fazenda_id AND p.ativo = true
            WHERE f.empresa_id = $1 AND f.ativo = true
            GROUP BY f.id
            ORDER BY f.nome
            LIMIT $2
        `;

        const result = await query(sql, [empresaId, limit]);
        return result.rows;
    }

    /**
     * Buscar usuários da empresa
     */
    async getUsuarios(empresaId, limit = 10) {
        const sql = `
            SELECT 
                u.id, u.nome, u.login, u.email, u.cargo,
                u.ultimo_acesso, u.criado_em,
                p.nome as perfil_nome, p.nivel_hierarquia
            FROM usuarios u
            INNER JOIN perfis_usuario p ON u.perfil_id = p.id
            WHERE u.empresa_id = $1 AND u.ativo = true
            ORDER BY u.nome
            LIMIT $2
        `;

        const result = await query(sql, [empresaId, limit]);
        return result.rows;
    }

    /**
     * Validar dados da empresa
     */
    validate(data) {
        const errors = [];

        if (!data.razao_social || data.razao_social.trim().length === 0) {
            errors.push('Razão social é obrigatória');
        }

        if (data.razao_social && data.razao_social.length > 255) {
            errors.push('Razão social deve ter no máximo 255 caracteres');
        }

        if (data.cnpj) {
            // Validação básica de formato CNPJ
            const cnpjLimpo = data.cnpj.replace(/[^\d]/g, '');
            if (cnpjLimpo.length !== 14) {
                errors.push('CNPJ deve ter 14 dígitos');
            }
        }

        if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
            errors.push('Email inválido');
        }

        const planosValidos = ['basico', 'premium', 'enterprise'];
        if (data.plano_assinatura && !planosValidos.includes(data.plano_assinatura)) {
            errors.push('Plano de assinatura inválido');
        }

        const estadosValidos = [
            'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
            'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
            'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
        ];

        if (data.estado && !estadosValidos.includes(data.estado)) {
            errors.push('Estado inválido');
        }

        if (data.data_vencimento_plano) {
            const dataVencimento = new Date(data.data_vencimento_plano);
            const hoje = new Date();
            hoje.setHours(0, 0, 0, 0);

            if (dataVencimento < hoje) {
                errors.push('Data de vencimento não pode ser anterior a hoje');
            }
        }

        return errors;
    }
}

module.exports = Empresa;