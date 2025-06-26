/**
 * Model de Fazenda
 * Gerencia as propriedades/unidades da empresa
 * Estrutura hierárquica: Empresa → Fazendas → Setores
 */

const BaseModel = require('./BaseModel');
const { query, getClient } = require('../config/database');

class Fazenda extends BaseModel {
    constructor() {
        super('fazendas', 'id');

        // Campos que podem ser preenchidos em massa
        this.fillable = [
            'empresa_id', 'nome', 'codigo', 'endereco_completo',
            'cep', 'cidade', 'estado', 'area_total_hectares',
            'coordenadas_gps', 'tipo_producao', 'observacoes'
        ];

        // Conversões de tipo automáticas
        this.casts = {
            'area_total_hectares': 'float',
            'ativo': 'boolean'
        };

        // Relacionamentos
        this.relationships = {
            empresa: { table: 'empresas', foreign_key: 'empresa_id', local_key: 'id' },
            setores: { table: 'setores', foreign_key: 'fazenda_id', local_key: 'id' }
        };
    }

    /**
     * Buscar fazendas por empresa
     */
    async findByEmpresa(empresaId, options = {}) {
        const {
            search = null,
            tipo_producao = null,
            estado = null,
            page = 1,
            limit = 20
        } = options;

        const offset = (page - 1) * limit;
        let paramIndex = 1;
        const params = [empresaId];
        const conditions = ['f.empresa_id = $1', 'f.ativo = true'];

        let sql = `
            SELECT 
                f.id, f.nome, f.codigo, f.endereco_completo,
                f.cep, f.cidade, f.estado, f.area_total_hectares,
                f.tipo_producao, f.observacoes, f.criado_em,
                e.razao_social as empresa_nome,
                COUNT(s.id) as total_setores,
                COUNT(p.id) as total_produtos,
                COALESCE(SUM(s.capacidade_maxima), 0) as capacidade_total_armazenamento
            FROM fazendas f
            INNER JOIN empresas e ON f.empresa_id = e.id
            LEFT JOIN setores s ON f.id = s.fazenda_id AND s.ativo = true
            LEFT JOIN produtos p ON f.id = p.fazenda_id AND p.ativo = true
        `;

        // Filtros dinâmicos
        if (search) {
            paramIndex++;
            conditions.push(`(LOWER(f.nome) LIKE LOWER($${paramIndex}) OR LOWER(f.codigo) LIKE LOWER($${paramIndex}))`);
            params.push(`%${search}%`);
        }

        if (tipo_producao) {
            paramIndex++;
            conditions.push(`f.tipo_producao = $${paramIndex}`);
            params.push(tipo_producao);
        }

        if (estado) {
            paramIndex++;
            conditions.push(`f.estado = $${paramIndex}`);
            params.push(estado);
        }

        sql += ` WHERE ${conditions.join(' AND ')}`;
        sql += ` GROUP BY f.id, e.razao_social`;
        sql += ` ORDER BY f.nome`;

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
     * Buscar fazenda por ID com dados completos
     */
    async findByIdWithDetails(id, empresaId = null) {
        let sql = `
            SELECT 
                f.*,
                e.razao_social as empresa_nome,
                COUNT(s.id) as total_setores,
                COUNT(p.id) as total_produtos,
                COUNT(DISTINCT sf.id) as total_safras,
                COALESCE(SUM(s.capacidade_maxima), 0) as capacidade_total_armazenamento,
                COALESCE(SUM(est.valor_total), 0) as valor_total_estoque
            FROM fazendas f
            INNER JOIN empresas e ON f.empresa_id = e.id
            LEFT JOIN setores s ON f.id = s.fazenda_id AND s.ativo = true
            LEFT JOIN produtos p ON f.id = p.fazenda_id AND p.ativo = true
            LEFT JOIN safras sf ON f.id = sf.fazenda_id AND sf.ativo = true
            LEFT JOIN estoque est ON s.id = est.setor_id
            WHERE f.id = $1 AND f.ativo = true
        `;

        const params = [id];

        if (empresaId) {
            sql += ` AND f.empresa_id = $2`;
            params.push(empresaId);
        }

        sql += ` GROUP BY f.id, e.razao_social`;

        const result = await query(sql, params);
        return result.rows.length > 0 ? this.castAttributes(result.rows[0]) : null;
    }

    /**
     * Buscar fazendas com estatísticas
     */
    async findWithStats(empresaId) {
        const sql = `
            SELECT 
                f.id, f.nome, f.codigo, f.area_total_hectares, f.tipo_producao,
                f.cidade, f.estado,
                COUNT(DISTINCT s.id) as total_setores,
                COUNT(DISTINCT p.id) as total_produtos,
                COUNT(DISTINCT sf.id) as safras_ativas,
                COALESCE(SUM(s.capacidade_maxima), 0) as capacidade_armazenamento,
                COALESCE(SUM(est.quantidade_atual), 0) as quantidade_estoque,
                COALESCE(SUM(est.valor_total), 0) as valor_estoque
            FROM fazendas f
            LEFT JOIN setores s ON f.id = s.fazenda_id AND s.ativo = true
            LEFT JOIN produtos p ON f.id = p.fazenda_id AND p.ativo = true
            LEFT JOIN safras sf ON f.id = sf.fazenda_id AND sf.ativo = true 
                AND sf.status IN ('planejamento', 'andamento')
            LEFT JOIN estoque est ON s.id = est.setor_id AND est.quantidade_atual > 0
            WHERE f.empresa_id = $1 AND f.ativo = true
            GROUP BY f.id, f.nome, f.codigo, f.area_total_hectares, f.tipo_producao, f.cidade, f.estado
            ORDER BY f.nome
        `;

        const result = await query(sql, [empresaId]);
        return result.rows.map(row => this.castAttributes(row));
    }

    /**
     * Verificar se código da fazenda é único na empresa
     */
    async isCodigoUnique(codigo, empresaId, excludeId = null) {
        let sql = `
            SELECT id FROM fazendas 
            WHERE codigo = $1 AND empresa_id = $2 AND ativo = true
        `;
        const params = [codigo, empresaId];

        if (excludeId) {
            sql += ` AND id != $3`;
            params.push(excludeId);
        }

        const result = await query(sql, params);
        return result.rows.length === 0;
    }

    /**
     * Buscar setores de uma fazenda
     */
    async getSetores(fazendaId) {
        const sql = `
            SELECT 
                s.id, s.nome, s.tipo, s.capacidade_maxima, s.unidade_capacidade,
                s.observacoes, s.criado_em,
                COUNT(est.id) as produtos_estoque,
                COALESCE(SUM(est.quantidade_atual), 0) as quantidade_total_estoque,
                COALESCE(SUM(est.valor_total), 0) as valor_total_estoque
            FROM setores s
            LEFT JOIN estoque est ON s.id = est.setor_id AND est.quantidade_atual > 0
            WHERE s.fazenda_id = $1 AND s.ativo = true
            GROUP BY s.id, s.nome, s.tipo, s.capacidade_maxima, s.unidade_capacidade, s.observacoes, s.criado_em
            ORDER BY s.nome
        `;

        const result = await query(sql, [fazendaId]);
        return result.rows;
    }

    /**
     * Buscar produtos de uma fazenda
     */
    async getProdutos(fazendaId, options = {}) {
        const { categoria_produto = null, limit = 50 } = options;

        let sql = `
            SELECT 
                p.id, p.nome, p.codigo_interno, p.categoria_produto,
                p.status, p.valor_aquisicao, p.criado_em,
                t.nome as tipo_nome,
                COALESCE(SUM(est.quantidade_atual), 0) as estoque_total
            FROM produtos p
            INNER JOIN tipos t ON p.tipo_id = t.id
            LEFT JOIN estoque est ON p.id = est.produto_id
            WHERE p.fazenda_id = $1 AND p.ativo = true
        `;

        const params = [fazendaId];
        let paramIndex = 2;

        if (categoria_produto) {
            sql += ` AND p.categoria_produto = $${paramIndex}`;
            params.push(categoria_produto);
            paramIndex++;
        }

        sql += ` GROUP BY p.id, p.nome, p.codigo_interno, p.categoria_produto, p.status, p.valor_aquisicao, p.criado_em, t.nome`;
        sql += ` ORDER BY p.nome`;
        sql += ` LIMIT $${paramIndex}`;
        params.push(limit);

        const result = await query(sql, params);
        return result.rows;
    }

    /**
     * Buscar safras de uma fazenda
     */
    async getSafras(fazendaId, options = {}) {
        const { status = null, ano = null } = options;

        let sql = `
            SELECT 
                s.id, s.nome, s.cultura, s.area_hectares,
                s.data_inicio, s.data_fim, s.status,
                s.producao_estimada, s.producao_real,
                s.custo_total, s.receita_total,
                (s.receita_total - s.custo_total) as lucro_estimado
            FROM safras s
            WHERE s.fazenda_id = $1 AND s.ativo = true
        `;

        const params = [fazendaId];
        let paramIndex = 2;

        if (status) {
            sql += ` AND s.status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }

        if (ano) {
            sql += ` AND EXTRACT(YEAR FROM s.data_inicio) = $${paramIndex}`;
            params.push(ano);
            paramIndex++;
        }

        sql += ` ORDER BY s.data_inicio DESC`;

        const result = await query(sql, params);
        return result.rows;
    }

    /**
     * Obter resumo financeiro da fazenda
     */
    async getResumoFinanceiro(fazendaId, periodo = 'ano') {
        let intervalCondition = '';

        switch (periodo) {
            case 'mes':
                intervalCondition = "DATE_TRUNC('month', m.data_movimentacao) = DATE_TRUNC('month', CURRENT_DATE)";
                break;
            case 'ano':
                intervalCondition = "DATE_TRUNC('year', m.data_movimentacao) = DATE_TRUNC('year', CURRENT_DATE)";
                break;
            default:
                intervalCondition = "DATE_TRUNC('year', m.data_movimentacao) = DATE_TRUNC('year', CURRENT_DATE)";
        }

        const sql = `
            SELECT 
                'movimentacoes' as origem,
                COALESCE(SUM(CASE WHEN tm.operacao = '+' THEN m.valor_total ELSE 0 END), 0) as entradas,
                COALESCE(SUM(CASE WHEN tm.operacao = '-' THEN m.valor_total ELSE 0 END), 0) as saidas,
                COUNT(m.id) as total_movimentacoes
            FROM movimentacoes m
            INNER JOIN tipos_movimentacao tm ON m.tipo_movimentacao_id = tm.id
            WHERE m.fazenda_id = $1 
                AND ${intervalCondition}
                AND m.status = 'confirmado'


            UNION ALL

            SELECT 
                'safras' as origem,
                COALESCE(SUM(s.receita_total), 0) as entradas,
                COALESCE(SUM(s.custo_total), 0) as saidas,
                COUNT(s.id) as total_movimentacoes
            FROM safras s
            WHERE s.fazenda_id = $1 
                AND s.ativo = true
                AND s.status = 'finalizada'
        `;

        const result = await query(sql, [fazendaId]);

        // Consolidar resultados
        const resumo = {
            entradas_movimentacoes: 0,
            saidas_movimentacoes: 0,
            receitas_safras: 0,
            custos_safras: 0,
            total_movimentacoes: 0,
            total_safras: 0
        };

        result.rows.forEach(row => {
            if (row.origem === 'movimentacoes') {
                resumo.entradas_movimentacoes = parseFloat(row.entradas);
                resumo.saidas_movimentacoes = parseFloat(row.saidas);
                resumo.total_movimentacoes = parseInt(row.total_movimentacoes);
            } else if (row.origem === 'safras') {
                resumo.receitas_safras = parseFloat(row.entradas);
                resumo.custos_safras = parseFloat(row.saidas);
                resumo.total_safras = parseInt(row.total_movimentacoes);
            }
        });

        // Calcular totais
        resumo.total_entradas = resumo.entradas_movimentacoes + resumo.receitas_safras;
        resumo.total_saidas = resumo.saidas_movimentacoes + resumo.custos_safras;
        resumo.saldo = resumo.total_entradas - resumo.total_saidas;

        return resumo;
    }

    /**
     * Obter capacidade de armazenamento por tipo
     */
    async getCapacidadeArmazenamento(fazendaId) {
        const sql = `
            SELECT 
                s.tipo,
                s.unidade_capacidade,
                COUNT(s.id) as quantidade_setores,
                SUM(s.capacidade_maxima) as capacidade_total,
                COALESCE(SUM(est.quantidade_atual), 0) as ocupacao_atual,
                CASE 
                    WHEN SUM(s.capacidade_maxima) > 0 THEN 
                        (COALESCE(SUM(est.quantidade_atual), 0) / SUM(s.capacidade_maxima)) * 100
                    ELSE 0 
                END as percentual_ocupacao
            FROM setores s
            LEFT JOIN estoque est ON s.id = est.setor_id
            WHERE s.fazenda_id = $1 AND s.ativo = true AND s.capacidade_maxima IS NOT NULL
            GROUP BY s.tipo, s.unidade_capacidade
            ORDER BY capacidade_total DESC
        `;

        const result = await query(sql, [fazendaId]);
        return result.rows;
    }

    /**
     * Buscar fazendas próximas por coordenadas
     */
    async findProximas(latitude, longitude, raioKm = 50, empresaId = null) {
        let sql = `
            SELECT 
                f.id, f.nome, f.cidade, f.estado, f.tipo_producao,
                f.coordenadas_gps,
                ST_Distance(
                    ST_GeogFromText('POINT(' || $1 || ' ' || $2 || ')'),
                    ST_GeogFromText('POINT(' || ST_X(f.coordenadas_gps) || ' ' || ST_Y(f.coordenadas_gps) || ')')
                ) / 1000 as distancia_km
            FROM fazendas f
            WHERE f.ativo = true 
                AND f.coordenadas_gps IS NOT NULL
                AND ST_DWithin(
                    ST_GeogFromText('POINT(' || $1 || ' ' || $2 || ')'),
                    ST_GeogFromText('POINT(' || ST_X(f.coordenadas_gps) || ' ' || ST_Y(f.coordenadas_gps) || ')'),
                    $3 * 1000
                )
        `;

        const params = [longitude, latitude, raioKm];

        if (empresaId) {
            sql += ` AND f.empresa_id != $4`; // Excluir fazendas da mesma empresa
            params.push(empresaId);
        }

        sql += ` ORDER BY distancia_km`;

        const result = await query(sql, params);
        return result.rows;
    }

    /**
     * Validar dados da fazenda
     */
    validate(data) {
        const errors = [];

        if (!data.nome || data.nome.trim().length === 0) {
            errors.push('Nome da fazenda é obrigatório');
        }

        if (!data.empresa_id) {
            errors.push('Empresa é obrigatória');
        }

        if (data.area_total_hectares && data.area_total_hectares <= 0) {
            errors.push('Área total deve ser maior que zero');
        }

        if (data.cep && !/^\d{5}-?\d{3}$/.test(data.cep)) {
            errors.push('CEP deve estar no formato 00000-000');
        }

        const estadosValidos = [
            'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
            'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
            'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
        ];

        if (data.estado && !estadosValidos.includes(data.estado)) {
            errors.push('Estado inválido');
        }

        const tiposProducaoValidos = ['grãos', 'frutas', 'hortaliças', 'pecuária', 'mista', 'outros'];
        if (data.tipo_producao && !tiposProducaoValidos.includes(data.tipo_producao)) {
            errors.push('Tipo de produção inválido');
        }

        return errors;
    }

    /**
     * Gerar código automático para fazenda
     */
    async gerarCodigo(empresaId, nomeFazenda) {
        // Pegar primeiras letras do nome
        const prefixo = nomeFazenda
            .split(' ')
            .map(palavra => palavra.charAt(0).toUpperCase())
            .join('')
            .substring(0, 3);

        // Contar fazendas existentes
        const sql = `
            SELECT COUNT(*) + 1 as proximo_numero
            FROM fazendas 
            WHERE empresa_id = $1 AND ativo = true
        `;

        const result = await query(sql, [empresaId]);
        const numero = String(result.rows[0].proximo_numero).padStart(3, '0');

        return `${prefixo}${numero}`;
    }
}

module.exports = Fazenda;