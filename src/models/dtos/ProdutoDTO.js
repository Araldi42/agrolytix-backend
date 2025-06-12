/**
 * Data Transfer Objects (DTOs) para Produto
 * Padroniza entrada e saída de dados
 */

class ProdutoDTO {
    /**
     * DTO para criação de produto
     */
    static createRequest(data) {
        return {
            empresa_id: data.empresa_id,
            fazenda_id: data.fazenda_id,
            tipo_id: data.tipo_id,
            codigo_interno: data.codigo_interno?.trim(),
            codigo_barras: data.codigo_barras?.trim() || null,
            nome: data.nome?.trim(),
            descricao: data.descricao?.trim() || null,
            numero_serie: data.numero_serie?.trim() || null,
            marca: data.marca?.trim() || null,
            modelo: data.modelo?.trim() || null,
            ano_fabricacao: data.ano_fabricacao ? parseInt(data.ano_fabricacao) : null,
            valor_aquisicao: data.valor_aquisicao ? parseFloat(data.valor_aquisicao) : null,
            data_aquisicao: data.data_aquisicao || null,
            fornecedor_id: data.fornecedor_id || null,
            categoria_produto: data.categoria_produto || 'produto',
            status: data.status || 'ativo',
            observacoes: data.observacoes?.trim() || null
        };
    }

    /**
     * DTO para atualização de produto
     */
    static updateRequest(data) {
        const updateData = {};
        
        if (data.tipo_id !== undefined) updateData.tipo_id = data.tipo_id;
        if (data.codigo_interno !== undefined) updateData.codigo_interno = data.codigo_interno?.trim();
        if (data.codigo_barras !== undefined) updateData.codigo_barras = data.codigo_barras?.trim() || null;
        if (data.nome !== undefined) updateData.nome = data.nome?.trim();
        if (data.descricao !== undefined) updateData.descricao = data.descricao?.trim() || null;
        if (data.numero_serie !== undefined) updateData.numero_serie = data.numero_serie?.trim() || null;
        if (data.marca !== undefined) updateData.marca = data.marca?.trim() || null;
        if (data.modelo !== undefined) updateData.modelo = data.modelo?.trim() || null;
        if (data.ano_fabricacao !== undefined) updateData.ano_fabricacao = data.ano_fabricacao ? parseInt(data.ano_fabricacao) : null;
        if (data.valor_aquisicao !== undefined) updateData.valor_aquisicao = data.valor_aquisicao ? parseFloat(data.valor_aquisicao) : null;
        if (data.data_aquisicao !== undefined) updateData.data_aquisicao = data.data_aquisicao || null;
        if (data.fornecedor_id !== undefined) updateData.fornecedor_id = data.fornecedor_id || null;
        if (data.categoria_produto !== undefined) updateData.categoria_produto = data.categoria_produto;
        if (data.status !== undefined) updateData.status = data.status;
        if (data.observacoes !== undefined) updateData.observacoes = data.observacoes?.trim() || null;

        return updateData;
    }

    /**
     * DTO para resposta simples
     */
    static response(produto) {
        if (!produto) return null;

        return {
            id: produto.id,
            codigo_interno: produto.codigo_interno,
            codigo_barras: produto.codigo_barras,
            nome: produto.nome,
            descricao: produto.descricao,
            numero_serie: produto.numero_serie,
            marca: produto.marca,
            modelo: produto.modelo,
            ano_fabricacao: produto.ano_fabricacao,
            valor_aquisicao: produto.valor_aquisicao,
            data_aquisicao: produto.data_aquisicao,
            categoria_produto: produto.categoria_produto,
            status: produto.status,
            ativo: produto.ativo,
            criado_em: produto.criado_em,
            atualizado_em: produto.atualizado_em
        };
    }

    /**
     * DTO para resposta com relacionamentos
     */
    static responseWithRelations(produto) {
        if (!produto) return null;

        return {
            ...this.response(produto),
            tipo: {
                id: produto.tipo_id,
                nome: produto.tipo_nome
            },
            categoria: {
                nome: produto.categoria_nome
            },
            fazenda: {
                id: produto.fazenda_id,
                nome: produto.fazenda_nome
            },
            empresa: {
                id: produto.empresa_id,
                nome: produto.empresa_nome
            },
            fornecedor: produto.fornecedor_nome ? {
                id: produto.fornecedor_id,
                nome: produto.fornecedor_nome
            } : null
        };
    }

    /**
     * DTO para resposta com estoque
     */
    static responseWithEstoque(produto) {
        if (!produto) return null;

        return {
            ...this.responseWithRelations(produto),
            estoque: {
                quantidade_total: produto.estoque_total || 0,
                quantidade_disponivel: produto.estoque_disponivel || 0,
                valor_unitario_medio: produto.valor_medio || 0,
                valor_total_estoque: (produto.estoque_total || 0) * (produto.valor_medio || 0)
            }
        };
    }

    /**
     * DTO para lista de produtos
     */
    static listResponse(produtos) {
        if (!Array.isArray(produtos)) return [];

        return produtos.map(produto => this.responseWithRelations(produto));
    }

    /**
     * DTO para produtos com estoque baixo
     */
    static lowStockResponse(produtos) {
        if (!Array.isArray(produtos)) return [];

        return produtos.map(produto => ({
            id: produto.id,
            nome: produto.nome,
            codigo_interno: produto.codigo_interno,
            tipo_nome: produto.tipo_nome,
            estoque_atual: produto.estoque_atual || 0,
            estoque_minimo: produto.estoque_minimo || 0,
            status_estoque: produto.status_estoque,
            necessita_reposicao: produto.estoque_atual <= produto.estoque_minimo,
            quantidade_sugerida: Math.max(0, (produto.estoque_minimo || 0) * 2 - (produto.estoque_atual || 0))
        }));
    }

    /**
     * DTO para estatísticas de produtos
     */
    static statsResponse(stats) {
        if (!stats) return null;

        return {
            totais: {
                produtos: parseInt(stats.total_produtos) || 0,
                insumos: parseInt(stats.total_insumos) || 0,
                ativos: parseInt(stats.total_ativos) || 0,
                produtos_ativos: parseInt(stats.produtos_ativos) || 0
            },
            valores: {
                valor_total_ativos: parseFloat(stats.valor_total_ativos) || 0
            },
            percentuais: {
                produtos_ativos: stats.total_produtos > 0 
                    ? ((parseInt(stats.produtos_ativos) || 0) / (parseInt(stats.total_produtos) || 1) * 100).toFixed(1)
                    : '0.0',
                insumos: stats.total_produtos > 0
                    ? ((parseInt(stats.total_insumos) || 0) / (parseInt(stats.total_produtos) || 1) * 100).toFixed(1)
                    : '0.0',
                ativos: stats.total_produtos > 0
                    ? ((parseInt(stats.total_ativos) || 0) / (parseInt(stats.total_produtos) || 1) * 100).toFixed(1)
                    : '0.0'
            }
        };
    }

    /**
     * DTO para histórico de movimentações
     */
    static historicoResponse(historico) {
        if (!Array.isArray(historico)) return [];

        return historico.map(item => ({
            movimentacao_id: item.id,
            data_movimentacao: item.data_movimentacao,
            numero_documento: item.numero_documento,
            tipo_movimentacao: item.tipo_movimentacao,
            operacao: item.operacao,
            quantidade: item.quantidade,
            valor_unitario: item.valor_unitario,
            valor_total: item.quantidade * item.valor_unitario,
            setor_origem: item.setor_origem,
            setor_destino: item.setor_destino,
            usuario: item.usuario_nome
        }));
    }
}

module.exports = ProdutoDTO; 