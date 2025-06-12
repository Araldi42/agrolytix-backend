/**
 * Model Empresa
 * Representa empresas no sistema multi-tenant
 */

const BaseModel = require('./BaseModel');

class Empresa extends BaseModel {
    constructor() {
        super('empresas', 'id');
        
        this.fillable = [
            'nome_fantasia', 'razao_social', 'cnpj', 'inscricao_estadual',
            'inscricao_municipal', 'endereco', 'cidade', 'estado', 'cep',
            'telefone', 'email', 'website', 'logo_url', 'tipo_pessoa',
            'area_atuacao', 'plano_id', 'configuracoes'
        ];

        this.hidden = ['configuracoes_sistema'];

        this.casts = {
            ativo: 'boolean',
            configuracoes: 'json',
            criado_em: 'date',
            atualizado_em: 'date'
        };
    }

    /**
     * Buscar empresa com estatísticas
     */
    async findWithStats(id) {
        const sql = `
            SELECT 
                e.*,
                p.nome as plano_nome,
                p.preco as plano_preco,
                COUNT(DISTINCT f.id) as total_fazendas,
                COUNT(DISTINCT u.id) as total_usuarios,
                COUNT(DISTINCT pr.id) as total_produtos,
                COUNT(DISTINCT m.id) as total_movimentacoes_mes
            FROM empresas e
            LEFT JOIN planos p ON e.plano_id = p.id
            LEFT JOIN fazendas f ON e.id = f.empresa_id AND f.ativo = true
            LEFT JOIN usuarios u ON e.id = u.empresa_id AND u.ativo = true
            LEFT JOIN produtos pr ON e.id = pr.empresa_id AND pr.ativo = true
            LEFT JOIN movimentacoes m ON e.id = m.empresa_id AND m.ativo = true 
                AND m.criado_em >= DATE_TRUNC('month', CURRENT_DATE)
            WHERE e.id = $1
            GROUP BY e.id, p.nome, p.preco
        `;

        const result = await this.customQuery(sql, [id]);
        return result.length > 0 ? result[0] : null;
    }

    /**
     * Buscar empresas com filtros avançados
     */
    async findWithFilters(filters = {}, options = {}) {
        const { plano, estado, areaAtuacao, ativo = true, ...baseOptions } = options;
        
        let sql = `
            SELECT 
                e.*,
                p.nome as plano_nome,
                p.preco as plano_preco,
                COUNT(DISTINCT f.id) as total_fazendas,
                COUNT(DISTINCT u.id) as total_usuarios
            FROM empresas e
            LEFT JOIN planos p ON e.plano_id = p.id
            LEFT JOIN fazendas f ON e.id = f.empresa_id AND f.ativo = true
            LEFT JOIN usuarios u ON e.id = u.empresa_id AND u.ativo = true
            WHERE e.ativo = $1
        `;

        const params = [ativo];
        let paramIndex = 2;

        if (plano) {
            sql += ` AND e.plano_id = $${paramIndex}`;
            params.push(plano);
            paramIndex++;
        }

        if (estado) {
            sql += ` AND e.estado = $${paramIndex}`;
            params.push(estado);
            paramIndex++;
        }

        if (areaAtuacao) {
            sql += ` AND e.area_atuacao = $${paramIndex}`;
            params.push(areaAtuacao);
            paramIndex++;
        }

        if (filters.nome) {
            sql += ` AND (e.nome_fantasia ILIKE $${paramIndex} OR e.razao_social ILIKE $${paramIndex})`;
            params.push(`%${filters.nome}%`);
            paramIndex++;
        }

        sql += ` GROUP BY e.id, p.nome, p.preco`;
        sql += ` ORDER BY e.nome_fantasia`;

        if (baseOptions.limit) {
            sql += ` LIMIT $${paramIndex}`;
            params.push(baseOptions.limit);
            paramIndex++;
        }

        if (baseOptions.offset) {
            sql += ` OFFSET $${paramIndex}`;
            params.push(baseOptions.offset);
        }

        return await this.customQuery(sql, params);
    }

    /**
     * Verificar se CNPJ é único
     */
    async isCnpjUnique(cnpj, excludeId = null) {
        const where = { cnpj, ativo: true };

        if (excludeId) {
            where.id = { operator: '!=', value: excludeId };
        }

        return !(await this.exists(where));
    }

    /**
     * Obter dashboard da empresa
     */
    async getDashboard(empresaId) {
        const sql = `
            SELECT 
                -- Totais gerais
                COUNT(DISTINCT f.id) as total_fazendas,
                COUNT(DISTINCT s.id) as total_setores,
                COUNT(DISTINCT u.id) as total_usuarios,
                COUNT(DISTINCT pr.id) as total_produtos,
                
                -- Estatísticas de estoque
                COALESCE(SUM(est.quantidade_atual), 0) as estoque_total_quantidade,
                COALESCE(SUM(est.valor_unitario_medio * est.quantidade_atual), 0) as estoque_valor_total,
                COUNT(CASE WHEN est.quantidade_atual <= t.estoque_minimo THEN 1 END) as produtos_estoque_baixo,
                
                -- Movimentações do mês
                COUNT(CASE WHEN m.criado_em >= DATE_TRUNC('month', CURRENT_DATE) THEN 1 END) as movimentacoes_mes,
                COALESCE(SUM(CASE WHEN m.criado_em >= DATE_TRUNC('month', CURRENT_DATE) THEN m.valor_total END), 0) as valor_movimentacoes_mes,
                
                -- Usuários ativos hoje
                COUNT(CASE WHEN ua.ultimo_acesso >= CURRENT_DATE THEN 1 END) as usuarios_ativos_hoje
                
            FROM empresas e
            LEFT JOIN fazendas f ON e.id = f.empresa_id AND f.ativo = true
            LEFT JOIN setores s ON f.id = s.fazenda_id AND s.ativo = true
            LEFT JOIN usuarios u ON e.id = u.empresa_id AND u.ativo = true
            LEFT JOIN produtos pr ON e.id = pr.empresa_id AND pr.ativo = true
            LEFT JOIN estoque est ON pr.id = est.produto_id
            LEFT JOIN tipos t ON pr.tipo_id = t.id
            LEFT JOIN movimentacoes m ON e.id = m.empresa_id AND m.ativo = true
            LEFT JOIN usuarios ua ON e.id = ua.empresa_id AND ua.ativo = true
            WHERE e.id = $1
            GROUP BY e.id
        `;

        const result = await this.customQuery(sql, [empresaId]);
        return result.length > 0 ? result[0] : {};
    }

    /**
     * Obter estatísticas de uso por período
     */
    async getEstatisticasUso(empresaId, dataInicio, dataFim) {
        const sql = `
            SELECT 
                DATE_TRUNC('day', m.criado_em) as data,
                COUNT(m.id) as total_movimentacoes,
                COALESCE(SUM(m.valor_total), 0) as valor_total,
                COUNT(DISTINCT m.usuario_criacao) as usuarios_ativos
            FROM movimentacoes m
            WHERE m.empresa_id = $1 
                AND m.criado_em BETWEEN $2 AND $3
                AND m.ativo = true
            GROUP BY DATE_TRUNC('day', m.criado_em)
            ORDER BY data DESC
        `;

        return await this.customQuery(sql, [empresaId, dataInicio, dataFim]);
    }

    /**
     * Configurar empresa
     */
    async updateConfiguracoes(id, configuracoes, userId) {
        const empresa = await this.findById(id);
        if (!empresa) return null;

        const novasConfiguracoes = {
            ...empresa.configuracoes,
            ...configuracoes
        };

        return await this.update(id, { configuracoes: novasConfiguracoes }, userId);
    }

    /**
     * Validar limites do plano
     */
    async validarLimitesPlano(empresaId) {
        const sql = `
            SELECT 
                e.id as empresa_id,
                p.nome as plano_nome,
                p.limite_usuarios,
                p.limite_fazendas,
                p.limite_produtos,
                COUNT(DISTINCT u.id) as usuarios_atuais,
                COUNT(DISTINCT f.id) as fazendas_atuais,
                COUNT(DISTINCT pr.id) as produtos_atuais
            FROM empresas e
            INNER JOIN planos p ON e.plano_id = p.id
            LEFT JOIN usuarios u ON e.id = u.empresa_id AND u.ativo = true
            LEFT JOIN fazendas f ON e.id = f.empresa_id AND f.ativo = true
            LEFT JOIN produtos pr ON e.id = pr.empresa_id AND pr.ativo = true
            WHERE e.id = $1
            GROUP BY e.id, p.nome, p.limite_usuarios, p.limite_fazendas, p.limite_produtos
        `;

        const result = await this.customQuery(sql, [empresaId]);
        
        if (result.length === 0) return null;

        const dados = result[0];
        
        return {
            empresa_id: dados.empresa_id,
            plano_nome: dados.plano_nome,
            limites: {
                usuarios: {
                    limite: dados.limite_usuarios,
                    atual: parseInt(dados.usuarios_atuais),
                    disponivel: dados.limite_usuarios - parseInt(dados.usuarios_atuais),
                    excedido: parseInt(dados.usuarios_atuais) >= dados.limite_usuarios
                },
                fazendas: {
                    limite: dados.limite_fazendas,
                    atual: parseInt(dados.fazendas_atuais),
                    disponivel: dados.limite_fazendas - parseInt(dados.fazendas_atuais),
                    excedido: parseInt(dados.fazendas_atuais) >= dados.limite_fazendas
                },
                produtos: {
                    limite: dados.limite_produtos,
                    atual: parseInt(dados.produtos_atuais),
                    disponivel: dados.limite_produtos - parseInt(dados.produtos_atuais),
                    excedido: parseInt(dados.produtos_atuais) >= dados.limite_produtos
                }
            }
        };
    }

    /**
     * Listar empresas para admin do sistema
     */
    async findForAdmin(options = {}) {
        const sql = `
            SELECT 
                e.*,
                p.nome as plano_nome,
                p.preco as plano_preco,
                COUNT(DISTINCT u.id) as total_usuarios,
                COUNT(DISTINCT f.id) as total_fazendas,
                COUNT(DISTINCT pr.id) as total_produtos,
                MAX(u.ultimo_acesso) as ultimo_acesso_usuario
            FROM empresas e
            LEFT JOIN planos p ON e.plano_id = p.id
            LEFT JOIN usuarios u ON e.id = u.empresa_id
            LEFT JOIN fazendas f ON e.id = f.empresa_id AND f.ativo = true
            LEFT JOIN produtos pr ON e.id = pr.empresa_id AND pr.ativo = true
            GROUP BY e.id, p.nome, p.preco
            ORDER BY e.criado_em DESC
        `;

        return await this.customQuery(sql);
    }

    /**
     * Suspender/Reativar empresa
     */
    async toggleStatus(id, userId, motivo = '') {
        const empresa = await this.findById(id);
        if (!empresa) return null;

        const novoStatus = !empresa.ativo;
        const observacao = `Status alterado para ${novoStatus ? 'ATIVO' : 'SUSPENSO'}. Motivo: ${motivo}`;

        return await this.update(id, { 
            ativo: novoStatus,
            observacoes: observacao
        }, userId);
    }
}

module.exports = new Empresa(); 