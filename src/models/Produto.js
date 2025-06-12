/**
 * Model Produto
 * Representa produtos/ativos da empresa
 */

const BaseModel = require('./BaseModel');

class Produto extends BaseModel {
    constructor() {
        super('produtos', 'id');
        
        // Campos que podem ser preenchidos em massa
        this.fillable = [
            'empresa_id', 'fazenda_id', 'tipo_id', 'codigo_interno',
            'codigo_barras', 'nome', 'descricao', 'numero_serie',
            'marca', 'modelo', 'ano_fabricacao', 'valor_aquisicao',
            'data_aquisicao', 'fornecedor_id', 'categoria_produto',
            'status', 'observacoes'
        ];

        // Conversões automáticas de tipo
        this.casts = {
            ativo: 'boolean',
            valor_aquisicao: 'number',
            ano_fabricacao: 'number',
            data_aquisicao: 'date',
            criado_em: 'date',
            atualizado_em: 'date'
        };
    }

    /**
     * Buscar produtos com relacionamentos
     */
    async findWithRelations(filters = {}, options = {}) {
        const joins = [
            'INNER JOIN tipos t ON produtos.tipo_id = t.id',
            'INNER JOIN categorias c ON t.categoria_id = c.id',
            'INNER JOIN fazendas f ON produtos.fazenda_id = f.id',
            'INNER JOIN empresas e ON produtos.empresa_id = e.id',
            'LEFT JOIN fornecedores fo ON produtos.fornecedor_id = fo.id'
        ];

        const select = `
            produtos.*,
            t.nome as tipo_nome,
            c.nome as categoria_nome,
            f.nome as fazenda_nome,
            e.nome_fantasia as empresa_nome,
            fo.nome as fornecedor_nome
        `;

        return await this.findAll(filters, {
            ...options,
            joins,
            select
        });
    }

    /**
     * Buscar produto com estoque
     */
    async findWithEstoque(id) {
        const sql = `
            SELECT 
                p.*,
                t.nome as tipo_nome,
                c.nome as categoria_nome,
                COALESCE(SUM(e.quantidade_atual), 0) as estoque_total,
                COALESCE(SUM(e.quantidade_disponivel), 0) as estoque_disponivel,
                COALESCE(AVG(e.valor_unitario_medio), 0) as valor_medio
            FROM produtos p
            INNER JOIN tipos t ON p.tipo_id = t.id
            INNER JOIN categorias c ON t.categoria_id = c.id
            LEFT JOIN estoque e ON p.id = e.produto_id
            WHERE p.id = $1 AND p.ativo = true
            GROUP BY p.id, t.nome, c.nome
        `;

        const result = await this.customQuery(sql, [id]);
        return result.length > 0 ? result[0] : null;
    }

    /**
     * Buscar produtos por empresa
     */
    async findByEmpresa(empresaId, options = {}) {
        return await this.findWithRelations({ empresa_id: empresaId, ativo: true }, options);
    }

    /**
     * Buscar produtos por fazenda
     */
    async findByFazenda(fazendaId, options = {}) {
        return await this.findWithRelations({ fazenda_id: fazendaId, ativo: true }, options);
    }

    /**
     * Buscar produtos por categoria
     */
    async findByCategoria(categoriaId, options = {}) {
        const sql = `
            SELECT p.*, t.nome as tipo_nome, c.nome as categoria_nome
            FROM produtos p
            INNER JOIN tipos t ON p.tipo_id = t.id
            INNER JOIN categorias c ON t.categoria_id = c.id
            WHERE c.id = $1 AND p.ativo = true
            ORDER BY p.nome
        `;

        return await this.customQuery(sql, [categoriaId]);
    }

    /**
     * Buscar produtos com estoque baixo
     */
    async findComEstoqueBaixo(empresaId, limite = 10) {
        const sql = `
            SELECT 
                p.id, p.nome, p.codigo_interno,
                t.nome as tipo_nome,
                COALESCE(SUM(e.quantidade_atual), 0) as estoque_atual,
                t.estoque_minimo,
                CASE 
                    WHEN COALESCE(SUM(e.quantidade_atual), 0) <= COALESCE(t.estoque_minimo, 0) THEN 'CRÍTICO'
                    WHEN COALESCE(SUM(e.quantidade_atual), 0) <= COALESCE(t.estoque_minimo, 0) * 1.5 THEN 'BAIXO'
                    ELSE 'OK'
                END as status_estoque
            FROM produtos p
            INNER JOIN tipos t ON p.tipo_id = t.id
            LEFT JOIN estoque e ON p.id = e.produto_id
            WHERE p.empresa_id = $1 AND p.ativo = true
            GROUP BY p.id, p.nome, p.codigo_interno, t.nome, t.estoque_minimo
            HAVING COALESCE(SUM(e.quantidade_atual), 0) <= COALESCE(t.estoque_minimo, 0) * 2
            ORDER BY status_estoque, p.nome
            LIMIT $2
        `;

        return await this.customQuery(sql, [empresaId, limite]);
    }

    /**
     * Verificar se código interno é único
     */
    async isCodigoInternoUnique(codigoInterno, empresaId, excludeId = null) {
        const where = { 
            codigo_interno: codigoInterno, 
            empresa_id: empresaId, 
            ativo: true 
        };

        if (excludeId) {
            where.id = { operator: '!=', value: excludeId };
        }

        return !(await this.exists(where));
    }

    /**
     * Obter estatísticas de produtos por empresa
     */
    async getEstatisticasPorEmpresa(empresaId) {
        const sql = `
            SELECT 
                COUNT(*) as total_produtos,
                COUNT(CASE WHEN categoria_produto = 'insumo' THEN 1 END) as total_insumos,
                COUNT(CASE WHEN categoria_produto = 'ativo' THEN 1 END) as total_ativos,
                COUNT(CASE WHEN status = 'ativo' THEN 1 END) as produtos_ativos,
                COALESCE(SUM(valor_aquisicao), 0) as valor_total_ativos
            FROM produtos 
            WHERE empresa_id = $1 AND ativo = true
        `;

        const result = await this.customQuery(sql, [empresaId]);
        return result[0];
    }

    /**
     * Buscar histórico de movimentações do produto
     */
    async getHistoricoMovimentacoes(produtoId, limite = 20) {
        const sql = `
            SELECT 
                m.id, m.data_movimentacao, m.numero_documento,
                tm.nome as tipo_movimentacao, tm.operacao,
                mi.quantidade, mi.valor_unitario,
                so.nome as setor_origem,
                sd.nome as setor_destino,
                u.nome as usuario_nome
            FROM movimentacoes m
            INNER JOIN movimentacao_itens mi ON m.id = mi.movimentacao_id
            INNER JOIN tipos_movimentacao tm ON m.tipo_movimentacao_id = tm.id
            LEFT JOIN setores so ON m.origem_setor_id = so.id
            LEFT JOIN setores sd ON m.destino_setor_id = sd.id
            LEFT JOIN usuarios u ON m.usuario_criacao = u.id
            WHERE mi.produto_id = $1
            ORDER BY m.data_movimentacao DESC
            LIMIT $2
        `;

        return await this.customQuery(sql, [produtoId, limite]);
    }
}

module.exports = new Produto(); 