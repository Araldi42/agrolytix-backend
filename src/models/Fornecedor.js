/**
 * Model de Fornecedor
 * Representa fornecedores de produtos/serviços
 */

const BaseModel = require('./BaseModel');
const { query, getClient } = require('../config/database');

class Fornecedor extends BaseModel {
    constructor() {
        super('fornecedores', 'id');

        // Campos que podem ser preenchidos em massa
        this.fillable = [
            'empresa_id', 'nome', 'nome_fantasia', 'tipo_pessoa', 'cnpj', 'cpf', 'inscricao_estadual',
            'contato', 'email', 'telefone', 'whatsapp', 'endereco', 'cep', 'cidade', 'estado',
            'observacoes', 'prazo_pagamento_padrao', 'rating'
        ];

        // Campos que devem ser omitidos nas respostas
        this.hidden = [];

        // Conversões de tipo automáticas
        this.casts = {
            'ativo': 'boolean',
            'prazo_pagamento_padrao': 'int',
            'rating': 'float'
        };

        // Relacionamentos
        this.relationships = {
            produtos: { table: 'produtos', foreign_key: 'fornecedor_id', local_key: 'id' },
            empresa: { table: 'empresas', foreign_key: 'empresa_id', local_key: 'id' },
            movimentacoes: { table: 'movimentacoes', foreign_key: 'fornecedor_id', local_key: 'id' },
            fornecedor_produtos: { table: 'fornecedor_produtos', foreign_key: 'fornecedor_id', local_key: 'id' }
        };
    }

    /**
     * Buscar fornecedores por empresa com estatísticas
     */
    async findByEmpresa(empresaId, options = {}) {
        const {
            search = null,
            tipo_pessoa = null,
            page = 1,
            limit = 20
        } = options;

        const offset = (page - 1) * limit;
        let paramIndex = 1;
        const params = [];
        const conditions = ['f.ativo = true'];

        let sql = `
            SELECT 
                f.id, f.nome, f.tipo_pessoa, f.cnpj, f.cpf, f.contato,
                f.email, f.telefone, f.cidade, f.estado, f.rating,
                f.criado_em, f.atualizado_em,
                u_criado.nome as criado_por_nome,
                u_atualizado.nome as atualizado_por_nome,
                COUNT(p.id) as total_produtos,
                COUNT(CASE WHEN p.status = 'ativo' THEN 1 END) as produtos_ativos,
                COALESCE(SUM(p.valor_aquisicao), 0) as valor_total_produtos,
                COUNT(m.id) as total_movimentacoes
            FROM fornecedores f
            LEFT JOIN produtos p ON f.id = p.fornecedor_id AND p.ativo = true
            LEFT JOIN movimentacoes m ON f.id = m.fornecedor_id AND m.status = 'confirmado'
            LEFT JOIN usuarios u_criado ON f.criado_por = u_criado.id
            LEFT JOIN usuarios u_atualizado ON f.atualizado_por = u_atualizado.id
        `;

        // Filtro por empresa (null = fornecedores globais)
        if (empresaId !== null) {
            conditions.push(`(f.empresa_id = $${paramIndex} OR f.empresa_id IS NULL)`);
            params.push(empresaId);
            paramIndex++;
        } else {
            conditions.push('f.empresa_id IS NULL');
        }

        // Filtros adicionais
        if (search) {
            conditions.push(`(LOWER(f.nome) LIKE LOWER($${paramIndex}) OR f.cnpj LIKE $${paramIndex} OR f.cpf LIKE $${paramIndex})`);
            params.push(`%${search}%`);
            paramIndex++;
        }

        if (tipo_pessoa) {
            conditions.push(`f.tipo_pessoa = $${paramIndex}`);
            params.push(tipo_pessoa);
            paramIndex++;
        }

        sql += ` WHERE ${conditions.join(' AND ')}`;
        sql += ` GROUP BY f.id, f.nome, f.tipo_pessoa, f.cnpj, f.cpf, f.contato, f.email, f.telefone, f.cidade, f.estado, f.rating, f.criado_em, f.atualizado_em, u_criado.nome, u_atualizado.nome`;
        sql += ` ORDER BY f.nome`;

        // Paginação
        sql += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(limit, offset);

        const result = await query(sql, params);
        return result.rows.map(row => this.castAttributes(row));
    }

    /**
     * Buscar fornecedor por ID com detalhes
     */
    async findByIdWithDetails(id, empresaId = null) {
        let sql = `
            SELECT 
                f.*,
                u_criado.nome as criado_por_nome,
                u_atualizado.nome as atualizado_por_nome,
                e.nome_fantasia as empresa_nome,
                COUNT(p.id) as total_produtos,
                COUNT(CASE WHEN p.status = 'ativo' THEN 1 END) as produtos_ativos,
                COALESCE(SUM(p.valor_aquisicao), 0) as valor_total_produtos,
                COUNT(m.id) as total_movimentacoes
            FROM fornecedores f
            LEFT JOIN usuarios u_criado ON f.criado_por = u_criado.id
            LEFT JOIN usuarios u_atualizado ON f.atualizado_por = u_atualizado.id
            LEFT JOIN empresas e ON f.empresa_id = e.id
            LEFT JOIN produtos p ON f.id = p.fornecedor_id AND p.ativo = true
            LEFT JOIN movimentacoes m ON f.id = m.fornecedor_id AND m.status = 'confirmado'
            WHERE f.id = $1 AND f.ativo = true
        `;

        const params = [id];

        if (empresaId !== null) {
            sql += ` AND (f.empresa_id = $2 OR f.empresa_id IS NULL)`;
            params.push(empresaId);
        }

        sql += ` GROUP BY f.id, u_criado.nome, u_atualizado.nome, e.nome_fantasia`;

        const result = await query(sql, params);
        return result.rows.length > 0 ? this.castAttributes(result.rows[0]) : null;
    }

    /**
     * Verificar se CNPJ é único
     */
    async isCNPJUnique(cnpj, empresaId = null, excludeId = null) {
        if (!cnpj) return true;

        let sql = `
            SELECT id FROM fornecedores 
            WHERE cnpj = $1 AND ativo = true
        `;
        const params = [cnpj];
        let paramIndex = 2;

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
     * Verificar se CPF é único
     */
    async isCPFUnique(cpf, empresaId = null, excludeId = null) {
        if (!cpf) return true;

        let sql = `
            SELECT id FROM fornecedores 
            WHERE cpf = $1 AND ativo = true
        `;
        const params = [cpf];
        let paramIndex = 2;

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
     * Verificar se email é único
     */
    async isEmailUnique(email, empresaId = null, excludeId = null) {
        if (!email) return true;

        let sql = `
            SELECT id FROM fornecedores 
            WHERE email = $1 AND ativo = true
        `;
        const params = [email];
        let paramIndex = 2;

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
     * Verificar se fornecedor pode ser excluído
     */
    async canDelete(id) {
        const sql = `
            SELECT 
                COUNT(p.id) as produtos,
                COUNT(m.id) as movimentacoes,
                COUNT(fp.id) as produtos_oferecidos
            FROM fornecedores f
            LEFT JOIN produtos p ON f.id = p.fornecedor_id AND p.ativo = true
            LEFT JOIN movimentacoes m ON f.id = m.fornecedor_id AND m.status = 'confirmado'
            LEFT JOIN fornecedor_produtos fp ON f.id = fp.fornecedor_id AND fp.ativo = true
            WHERE f.id = $1
            GROUP BY f.id
        `;

        const result = await query(sql, [id]);

        if (result.rows.length === 0) return true;

        const counts = result.rows[0];
        return parseInt(counts.produtos) === 0 &&
            parseInt(counts.movimentacoes) === 0 &&
            parseInt(counts.produtos_oferecidos) === 0;
    }

    /**
     * Buscar produtos do fornecedor
     */
    async getProdutos(fornecedorId, options = {}) {
        const {
            categoria_produto = null,
            status = 'ativo',
            limit = 50
        } = options;

        let sql = `
            SELECT 
                p.id, p.nome, p.codigo_interno, p.categoria_produto,
                p.status, p.valor_aquisicao, p.data_aquisicao,
                t.nome as tipo_nome,
                f.nome as fazenda_nome,
                COALESCE(SUM(e.quantidade_atual), 0) as estoque_atual
            FROM produtos p
            LEFT JOIN tipos t ON p.tipo_id = t.id
            LEFT JOIN fazendas f ON p.fazenda_id = f.id
            LEFT JOIN estoque e ON p.id = e.produto_id
            WHERE p.fornecedor_id = $1 AND p.ativo = true
        `;

        const params = [fornecedorId];
        let paramIndex = 2;

        if (categoria_produto) {
            sql += ` AND p.categoria_produto = $${paramIndex}`;
            params.push(categoria_produto);
            paramIndex++;
        }

        if (status) {
            sql += ` AND p.status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }

        sql += ` GROUP BY p.id, p.nome, p.codigo_interno, p.categoria_produto, p.status, p.valor_aquisicao, p.data_aquisicao, t.nome, f.nome`;
        sql += ` ORDER BY p.nome`;
        sql += ` LIMIT $${paramIndex}`;
        params.push(limit);

        const result = await query(sql, params);
        return result.rows;
    }

    /**
     * Buscar produtos oferecidos pelo fornecedor (catálogo)
     */
    async getProdutosOferecidos(fornecedorId, options = {}) {
        const {
            categoria_id = null,
            limit = 50
        } = options;

        let sql = `
            SELECT 
                fp.id, fp.preco_unitario, fp.prazo_entrega_dias,
                t.id as tipo_id, t.nome as tipo_nome, t.descricao as tipo_descricao,
                c.nome as categoria_nome,
                um.nome as unidade_medida_nome, um.sigla as unidade_medida_sigla,
                fp.atualizado_em
            FROM fornecedor_produtos fp
            INNER JOIN tipos t ON fp.tipo_id = t.id
            INNER JOIN categorias c ON t.categoria_id = c.id
            LEFT JOIN unidades_medida um ON fp.unidade_medida_id = um.id
            WHERE fp.fornecedor_id = $1 AND fp.ativo = true AND t.ativo = true
        `;

        const params = [fornecedorId];
        let paramIndex = 2;

        if (categoria_id) {
            sql += ` AND t.categoria_id = $${paramIndex}`;
            params.push(categoria_id);
            paramIndex++;
        }

        sql += ` ORDER BY c.nome, t.nome`;
        sql += ` LIMIT $${paramIndex}`;
        params.push(limit);

        const result = await query(sql, params);
        return result.rows;
    }

    /**
     * Buscar fornecedores mais utilizados
     */
    async findMostUsed(empresaId = null, limit = 10) {
        let sql = `
            SELECT 
                f.id, f.nome, f.tipo_pessoa, f.cidade, f.estado,
                f.rating,
                COUNT(p.id) as total_produtos,
                COUNT(m.id) as total_movimentacoes,
                COALESCE(SUM(p.valor_aquisicao), 0) as valor_total
            FROM fornecedores f
            LEFT JOIN produtos p ON f.id = p.fornecedor_id AND p.ativo = true
            LEFT JOIN movimentacoes m ON f.id = m.fornecedor_id AND m.status = 'confirmado'
            WHERE f.ativo = true
        `;

        const params = [];

        if (empresaId !== null) {
            sql += ` AND (f.empresa_id = $1 OR f.empresa_id IS NULL)`;
            params.push(empresaId);
        }

        sql += ` GROUP BY f.id, f.nome, f.tipo_pessoa, f.cidade, f.estado, f.rating`;
        sql += ` HAVING (COUNT(p.id) > 0 OR COUNT(m.id) > 0)`;
        sql += ` ORDER BY (COUNT(p.id) + COUNT(m.id)) DESC, f.nome`;
        sql += ` LIMIT $${params.length + 1}`;
        params.push(limit);

        const result = await query(sql, params);
        return result.rows;
    }

    /**
     * Buscar fornecedores por localização
     */
    async findByLocalizacao(estado = null, cidade = null, empresaId = null) {
        let sql = `
            SELECT 
                f.id, f.nome, f.tipo_pessoa, f.cidade, f.estado,
                f.telefone, f.email, f.rating,
                COUNT(p.id) as total_produtos
            FROM fornecedores f
            LEFT JOIN produtos p ON f.id = p.fornecedor_id AND p.ativo = true
            WHERE f.ativo = true
        `;

        const params = [];
        let paramIndex = 1;

        if (empresaId !== null) {
            sql += ` AND (f.empresa_id = $${paramIndex} OR f.empresa_id IS NULL)`;
            params.push(empresaId);
            paramIndex++;
        }

        if (estado) {
            sql += ` AND UPPER(f.estado) = UPPER($${paramIndex})`;
            params.push(estado);
            paramIndex++;
        }

        if (cidade) {
            sql += ` AND UPPER(f.cidade) = UPPER($${paramIndex})`;
            params.push(cidade);
            paramIndex++;
        }

        sql += ` GROUP BY f.id, f.nome, f.tipo_pessoa, f.cidade, f.estado, f.telefone, f.email, f.rating`;
        sql += ` ORDER BY f.rating DESC NULLS LAST, f.nome`;

        const result = await query(sql, params);
        return result.rows;
    }

    /**
     * Atualizar rating do fornecedor
     */
    async updateRating(fornecedorId, novoRating, observacoes = null) {
        if (novoRating < 0 || novoRating > 5) {
            throw new Error('Rating deve estar entre 0 e 5');
        }

        const sql = `
            UPDATE fornecedores 
            SET rating = $1, atualizado_em = NOW()
            WHERE id = $2 AND ativo = true
            RETURNING id, nome, rating
        `;

        const result = await query(sql, [novoRating, fornecedorId]);
        return result.rows.length > 0 ? result.rows[0] : null;
    }

    /**
     * Obter estatísticas dos fornecedores
     */
    async getEstatisticas(empresaId = null) {
        let sql = `
            SELECT 
                COUNT(*) as total_fornecedores,
                COUNT(CASE WHEN tipo_pessoa = 'juridica' THEN 1 END) as pessoas_juridicas,
                COUNT(CASE WHEN tipo_pessoa = 'fisica' THEN 1 END) as pessoas_fisicas,
                COUNT(CASE WHEN empresa_id IS NULL THEN 1 END) as fornecedores_globais,
                ROUND(AVG(rating), 2) as rating_medio,
                COUNT(CASE WHEN rating >= 4 THEN 1 END) as fornecedores_bem_avaliados
            FROM fornecedores
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
     * Buscar fornecedores com rating baixo
     */
    async findComRatingBaixo(empresaId = null, ratingMaximo = 2.5) {
        let sql = `
            SELECT 
                f.id, f.nome, f.tipo_pessoa, f.rating,
                f.contato, f.telefone, f.email,
                COUNT(p.id) as total_produtos
            FROM fornecedores f
            LEFT JOIN produtos p ON f.id = p.fornecedor_id AND p.ativo = true
            WHERE f.ativo = true 
                AND f.rating IS NOT NULL 
                AND f.rating <= $1
        `;

        const params = [ratingMaximo];

        if (empresaId !== null) {
            sql += ` AND (f.empresa_id = $2 OR f.empresa_id IS NULL)`;
            params.push(empresaId);
        }

        sql += ` GROUP BY f.id, f.nome, f.tipo_pessoa, f.rating, f.contato, f.telefone, f.email`;
        sql += ` ORDER BY f.rating ASC, f.nome`;

        const result = await query(sql, params);
        return result.rows;
    }

    /**
     * Buscar fornecedores por documento (CPF/CNPJ)
     */
    async findByDocumento(documento, empresaId = null) {
        let sql = `
            SELECT f.* FROM fornecedores f
            WHERE f.ativo = true 
                AND (f.cnpj = $1 OR f.cpf = $1)
        `;

        const params = [documento];

        if (empresaId !== null) {
            sql += ` AND (f.empresa_id = $2 OR f.empresa_id IS NULL)`;
            params.push(empresaId);
        }

        const result = await query(sql, params);
        return result.rows.length > 0 ? this.castAttributes(result.rows[0]) : null;
    }

    /**
     * Obter histórico de movimentações do fornecedor
     */
    async getHistoricoMovimentacoes(fornecedorId, options = {}) {
        const {
            data_inicio = null,
            data_fim = null,
            limit = 50
        } = options;

        let sql = `
            SELECT 
                m.id, m.numero_documento, m.data_movimentacao,
                m.valor_total, m.observacoes, m.status,
                tm.nome as tipo_movimentacao,
                m.fazenda_id, f.nome as fazenda_nome,
                COUNT(mi.id) as total_itens
            FROM movimentacoes m
            INNER JOIN tipos_movimentacao tm ON m.tipo_movimentacao_id = tm.id
            LEFT JOIN fazendas f ON m.fazenda_id = f.id
            LEFT JOIN movimentacao_itens mi ON m.id = mi.movimentacao_id
            WHERE m.fornecedor_id = $1
        `;

        const params = [fornecedorId];
        let paramIndex = 2;

        if (data_inicio) {
            sql += ` AND m.data_movimentacao >= ${paramIndex}`;
            params.push(data_inicio);
            paramIndex++;
        }

        if (data_fim) {
            sql += ` AND m.data_movimentacao <= ${paramIndex}`;
            params.push(data_fim);
            paramIndex++;
        }

        sql += ` GROUP BY m.id, m.numero_documento, m.data_movimentacao, m.valor_total, m.observacoes, m.status, tm.nome, f.nome`;
        sql += ` ORDER BY m.data_movimentacao DESC`;
        sql += ` LIMIT ${paramIndex}`;
        params.push(limit);

        const result = await query(sql, params);
        return result.rows;
    }

    /**
     * Calcular score do fornecedor baseado em critérios
     */
    async calculateScore(fornecedorId) {
        const sql = `
            SELECT 
                f.rating,
                COUNT(p.id) as total_produtos,
                COUNT(m.id) as total_movimentacoes,
                COUNT(CASE WHEN m.status = 'confirmado' THEN 1 END) as movimentacoes_confirmadas,
                EXTRACT(DAYS FROM (NOW() - f.criado_em)) as dias_cadastrado
            FROM fornecedores f
            LEFT JOIN produtos p ON f.id = p.fornecedor_id AND p.ativo = true
            LEFT JOIN movimentacoes m ON f.id = m.fornecedor_id
            WHERE f.id = $1
            GROUP BY f.id, f.rating, f.criado_em
        `;

        const result = await query(sql, [fornecedorId]);

        if (result.rows.length === 0) return 0;

        const dados = result.rows[0];

        // Cálculo do score (0-100)
        let score = 0;

        // Rating (40% do score)
        if (dados.rating) {
            score += (dados.rating / 5) * 40;
        }

        // Histórico de movimentações (30% do score)
        if (dados.total_movimentacoes > 0) {
            score += Math.min(dados.total_movimentacoes / 10, 1) * 30;
        }

        // Taxa de confirmação (20% do score)
        if (dados.total_movimentacoes > 0) {
            const taxaConfirmacao = dados.movimentacoes_confirmadas / dados.total_movimentacoes;
            score += taxaConfirmacao * 20;
        }

        // Tempo de cadastro (10% do score)
        if (dados.dias_cadastrado > 0) {
            score += Math.min(dados.dias_cadastrado / 365, 1) * 10;
        }

        return Math.round(score);
    }

    /**
     * Adicionar produto ao catálogo do fornecedor
     */
    async adicionarProdutoOfertado(fornecedorId, tipoId, dados) {
        const {
            preco_unitario,
            unidade_medida_id = null,
            prazo_entrega_dias = null
        } = dados;

        const sql = `
            INSERT INTO fornecedor_produtos (
                fornecedor_id, tipo_id, preco_unitario, 
                unidade_medida_id, prazo_entrega_dias
            ) VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (fornecedor_id, tipo_id) 
            DO UPDATE SET 
                preco_unitario = EXCLUDED.preco_unitario,
                unidade_medida_id = EXCLUDED.unidade_medida_id,
                prazo_entrega_dias = EXCLUDED.prazo_entrega_dias,
                atualizado_em = NOW(),
                ativo = true
            RETURNING *
        `;

        const result = await query(sql, [
            fornecedorId, tipoId, preco_unitario,
            unidade_medida_id, prazo_entrega_dias
        ]);

        return result.rows[0];
    }

    /**
     * Remover produto do catálogo do fornecedor
     */
    async removerProdutoOfertado(fornecedorId, tipoId) {
        const sql = `
            UPDATE fornecedor_produtos 
            SET ativo = false, atualizado_em = NOW()
            WHERE fornecedor_id = $1 AND tipo_id = $2
            RETURNING *
        `;

        const result = await query(sql, [fornecedorId, tipoId]);
        return result.rows.length > 0;
    }

    /**
     * Buscar fornecedores que oferecem um tipo específico
     */
    async findByTipoOfertado(tipoId, empresaId = null, options = {}) {
        const {
            preco_max = null,
            prazo_max = null,
            rating_min = null
        } = options;

        let sql = `
            SELECT 
                f.id, f.nome, f.tipo_pessoa, f.cidade, f.estado,
                f.telefone, f.email, f.rating,
                fp.preco_unitario, fp.prazo_entrega_dias,
                um.nome as unidade_medida_nome, um.sigla as unidade_medida_sigla
            FROM fornecedores f
            INNER JOIN fornecedor_produtos fp ON f.id = fp.fornecedor_id
            LEFT JOIN unidades_medida um ON fp.unidade_medida_id = um.id
            WHERE f.ativo = true 
                AND fp.ativo = true 
                AND fp.tipo_id = $1
        `;

        const params = [tipoId];
        let paramIndex = 2;

        if (empresaId !== null) {
            sql += ` AND (f.empresa_id = ${paramIndex} OR f.empresa_id IS NULL)`;
            params.push(empresaId);
            paramIndex++;
        }

        if (preco_max) {
            sql += ` AND fp.preco_unitario <= ${paramIndex}`;
            params.push(preco_max);
            paramIndex++;
        }

        if (prazo_max) {
            sql += ` AND (fp.prazo_entrega_dias IS NULL OR fp.prazo_entrega_dias <= ${paramIndex})`;
            params.push(prazo_max);
            paramIndex++;
        }

        if (rating_min) {
            sql += ` AND (f.rating IS NULL OR f.rating >= ${paramIndex})`;
            params.push(rating_min);
            paramIndex++;
        }

        sql += ` ORDER BY fp.preco_unitario ASC, f.rating DESC NULLS LAST`;

        const result = await query(sql, params);
        return result.rows;
    }

    /**
     * Obter ranking de fornecedores por critérios
     */
    async getRanking(empresaId = null, criterio = 'score') {
        let orderBy = '';

        switch (criterio) {
            case 'rating':
                orderBy = 'f.rating DESC NULLS LAST';
                break;
            case 'produtos':
                orderBy = 'total_produtos DESC';
                break;
            case 'movimentacoes':
                orderBy = 'total_movimentacoes DESC';
                break;
            case 'valor':
                orderBy = 'valor_total DESC';
                break;
            default:
                orderBy = 'score DESC';
        }

        let sql = `
            SELECT 
                f.id, f.nome, f.tipo_pessoa, f.rating,
                COUNT(p.id) as total_produtos,
                COUNT(m.id) as total_movimentacoes,
                COALESCE(SUM(p.valor_aquisicao), 0) as valor_total,
                (
                    COALESCE(f.rating / 5 * 40, 0) +
                    LEAST(COUNT(m.id) / 10.0 * 30, 30) +
                    CASE 
                        WHEN COUNT(m.id) > 0 THEN 
                            (COUNT(CASE WHEN m.status = 'confirmado' THEN 1 END)::float / COUNT(m.id)) * 20
                        ELSE 0 
                    END +
                    LEAST(EXTRACT(DAYS FROM (NOW() - f.criado_em)) / 365.0 * 10, 10)
                ) as score
            FROM fornecedores f
            LEFT JOIN produtos p ON f.id = p.fornecedor_id AND p.ativo = true
            LEFT JOIN movimentacoes m ON f.id = m.fornecedor_id
            WHERE f.ativo = true
        `;

        const params = [];

        if (empresaId !== null) {
            sql += ` AND (f.empresa_id = $1 OR f.empresa_id IS NULL)`;
            params.push(empresaId);
        }

        sql += ` GROUP BY f.id, f.nome, f.tipo_pessoa, f.rating, f.criado_em`;
        sql += ` ORDER BY ${orderBy}, f.nome`;
        sql += ` LIMIT 50`;

        const result = await query(sql, params);
        return result.rows;
    }

    /**
     * Validar dados antes de salvar
     */
    validate(data) {
        const errors = [];

        if (!data.nome || data.nome.trim().length === 0) {
            errors.push('Nome do fornecedor é obrigatório');
        }

        if (data.nome && data.nome.length > 255) {
            errors.push('Nome deve ter no máximo 255 caracteres');
        }

        if (data.tipo_pessoa && !['fisica', 'juridica'].includes(data.tipo_pessoa)) {
            errors.push('Tipo de pessoa deve ser "fisica" ou "juridica"');
        }

        if (data.cnpj) {
            // Validação básica de CNPJ (14 dígitos)
            const cnpjLimpo = data.cnpj.replace(/[^\d]/g, '');
            if (cnpjLimpo.length !== 14) {
                errors.push('CNPJ deve ter 14 dígitos');
            }
        }

        if (data.cpf) {
            // Validação básica de CPF (11 dígitos)
            const cpfLimpo = data.cpf.replace(/[^\d]/g, '');
            if (cpfLimpo.length !== 11) {
                errors.push('CPF deve ter 11 dígitos');
            }
        }

        if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
            errors.push('Email inválido');
        }

        if (data.rating && (data.rating < 0 || data.rating > 5)) {
            errors.push('Rating deve estar entre 0 e 5');
        }

        if (data.prazo_pagamento_padrao && data.prazo_pagamento_padrao < 0) {
            errors.push('Prazo de pagamento não pode ser negativo');
        }

        return errors;
    }

    /**
     * Formatar dados para exibição
     */
    format(data) {
        if (!data) return null;

        const formatted = { ...data };

        // Formatar CNPJ
        if (formatted.cnpj) {
            const cnpj = formatted.cnpj.replace(/[^\d]/g, '');
            if (cnpj.length === 14) {
                formatted.cnpj_formatado = cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
            }
        }

        // Formatar CPF
        if (formatted.cpf) {
            const cpf = formatted.cpf.replace(/[^\d]/g, '');
            if (cpf.length === 11) {
                formatted.cpf_formatado = cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
            }
        }

        // Formatar telefone
        if (formatted.telefone) {
            const telefone = formatted.telefone.replace(/[^\d]/g, '');
            if (telefone.length === 10) {
                formatted.telefone_formatado = telefone.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
            } else if (telefone.length === 11) {
                formatted.telefone_formatado = telefone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
            }
        }

        // Formatar CEP
        if (formatted.cep) {
            const cep = formatted.cep.replace(/[^\d]/g, '');
            if (cep.length === 8) {
                formatted.cep_formatado = cep.replace(/(\d{5})(\d{3})/, '$1-$2');
            }
        }

        return formatted;
    }

    /**
     * Buscar fornecedores duplicados (mesmo nome ou documento)
     */
    async findDuplicates(empresaId = null) {
        let sql = `
            SELECT 
                array_agg(f.id) as ids,
                array_agg(f.nome) as nomes,
                COALESCE(f.cnpj, f.cpf) as documento,
                COUNT(*) as total_duplicatas
            FROM fornecedores f
            WHERE f.ativo = true
                AND (f.cnpj IS NOT NULL OR f.cpf IS NOT NULL)
        `;

        const params = [];

        if (empresaId !== null) {
            sql += ` AND (f.empresa_id = $1 OR f.empresa_id IS NULL)`;
            params.push(empresaId);
        }

        sql += ` GROUP BY COALESCE(f.cnpj, f.cpf)`;
        sql += ` HAVING COUNT(*) > 1`;
        sql += ` ORDER BY COUNT(*) DESC`;

        const result = await query(sql, params);
        return result.rows;
    }

    /**
     * Buscar fornecedores sem atividade recente
     */
    async findInativos(empresaId = null, diasSemAtividade = 365) {
        let sql = `
            SELECT 
                f.id, f.nome, f.tipo_pessoa, f.telefone, f.email,
                f.criado_em,
                MAX(m.data_movimentacao) as ultima_movimentacao,
                COUNT(m.id) as total_movimentacoes
            FROM fornecedores f
            LEFT JOIN movimentacoes m ON f.id = m.fornecedor_id
            WHERE f.ativo = true
        `;

        const params = [diasSemAtividade];

        if (empresaId !== null) {
            sql += ` AND (f.empresa_id = $2 OR f.empresa_id IS NULL)`;
            params.push(empresaId);
        }

        sql += ` GROUP BY f.id, f.nome, f.tipo_pessoa, f.telefone, f.email, f.criado_em`;
        sql += ` HAVING (MAX(m.data_movimentacao) IS NULL OR MAX(m.data_movimentacao) < NOW() - INTERVAL '$1 days')`;
        sql += ` ORDER BY MAX(m.data_movimentacao) ASC NULLS FIRST, f.nome`;

        const result = await query(sql, params);
        return result.rows;
    }
}

module.exports = Fornecedor;