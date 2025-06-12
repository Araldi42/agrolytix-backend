/**
 * Controller de Produtos
 * Gerencia produtos/ativos da empresa com controle completo de estoque
 */

const BaseController = require('./baseController');
const ValidationService = require('../services/validationService');
const { query } = require('../config/database');
const { Produto, ProdutoDTO } = require('../models');

class ProdutosController extends BaseController {
    constructor() {
        super('produtos', 'Produto');
    }

    /**
     * Listar produtos
     */
    async listar(req, res) {
        try {
            const { empresa_id } = req.user;
            const { 
                page = 1, 
                limit = 10, 
                search, 
                categoria, 
                tipo_id, 
                fazenda_id,
                status = 'ativo'
            } = req.query;

            // Construir filtros
            const filters = { empresa_id, status };
            if (search) filters.nome = { operator: 'ILIKE', value: `%${search}%` };
            if (tipo_id) filters.tipo_id = tipo_id;
            if (fazenda_id) filters.fazenda_id = fazenda_id;

            const options = {
                limit: parseInt(limit),
                offset: (parseInt(page) - 1) * parseInt(limit)
            };

            // Buscar produtos com relacionamentos
            const produtos = await Produto.findWithRelations(filters, options);
            const total = await Produto.count(filters);

            // Aplicar DTO
            const produtosFormatados = ProdutoDTO.listResponse(produtos);

            return this.success(res, {
                produtos: produtosFormatados,
                ...this.buildPaginationMeta(total, parseInt(page), parseInt(limit))
            });

        } catch (error) {
            return this.handleError(res, error, 'Erro ao listar produtos');
        }
    }

    /**
     * Buscar produto por ID
     */
    async buscarPorId(req, res) {
        try {
            const { id } = req.params;
            const { empresa_id } = req.user;

            const produto = await Produto.findWithEstoque(id);

            if (!produto || produto.empresa_id !== empresa_id) {
                return this.notFound(res, 'Produto não encontrado');
            }

            return this.success(res, {
                produto: ProdutoDTO.responseWithEstoque(produto)
            });

        } catch (error) {
            return this.handleError(res, error, 'Erro ao buscar produto');
        }
    }

    /**
     * Criar produto
     */
    async criar(req, res) {
        try {
            const { empresa_id } = req.user;
            const dadosProduto = ProdutoDTO.createRequest({
                ...req.body,
                empresa_id
            });

            // Validar código interno único
            const codigoExiste = !(await Produto.isCodigoInternoUnique(
                dadosProduto.codigo_interno, 
                empresa_id
            ));

            if (codigoExiste) {
                return this.badRequest(res, 'Código interno já existe para esta empresa');
            }

            const produto = await Produto.create(dadosProduto, req.user.usuario_id);

            return this.created(res, {
                produto: ProdutoDTO.response(produto)
            }, 'Produto criado com sucesso');

        } catch (error) {
            return this.handleError(res, error, 'Erro ao criar produto');
        }
    }

    /**
     * Atualizar produto
     */
    async atualizar(req, res) {
        try {
            const { id } = req.params;
            const { empresa_id } = req.user;
            
            const produtoExistente = await Produto.findById(id);
            if (!produtoExistente || produtoExistente.empresa_id !== empresa_id) {
                return this.notFound(res, 'Produto não encontrado');
            }

            const dadosAtualizacao = ProdutoDTO.updateRequest(req.body);

            // Validar código interno se foi alterado
            if (dadosAtualizacao.codigo_interno && 
                dadosAtualizacao.codigo_interno !== produtoExistente.codigo_interno) {
                
                const codigoExiste = !(await Produto.isCodigoInternoUnique(
                    dadosAtualizacao.codigo_interno, 
                    empresa_id, 
                    id
                ));

                if (codigoExiste) {
                    return this.badRequest(res, 'Código interno já existe para esta empresa');
                }
            }

            const produto = await Produto.update(id, dadosAtualizacao, req.user.usuario_id);

            return this.success(res, {
                produto: ProdutoDTO.response(produto)
            }, 'Produto atualizado com sucesso');

        } catch (error) {
            return this.handleError(res, error, 'Erro ao atualizar produto');
        }
    }

    /**
     * Excluir produto (soft delete)
     */
    async excluir(req, res, next) {
        try {
            const { id } = req.params;

            // Verificar se tem estoque
            const consultaEstoque = `
                SELECT SUM(quantidade_atual) as total
                FROM estoque WHERE produto_id = $1
            `;
            const estoqueResult = await query(consultaEstoque, [id]);
            
            if (parseFloat(estoqueResult.rows[0].total || 0) > 0) {
                return this.erroResponse(res, 'Produto com estoque não pode ser excluído', 400);
            }

            const consulta = `
                UPDATE produtos 
                SET ativo = false, atualizado_por = $1, atualizado_em = NOW()
                WHERE id = $2
            `;

            await query(consulta, [req.usuario.id, id]);

            return this.sucessoResponse(res, null, 'Produto excluído com sucesso');

        } catch (error) {
            console.error('Erro ao excluir produto:', error);
            next(error);
        }
    }

    /**
     * Método auxiliar para buscar produto completo
     */
    async buscarProdutoCompleto(id) {
        const consulta = `
            SELECT 
                p.*, 
                t.nome as tipo_nome,
                c.nome as categoria_nome
            FROM produtos p
            INNER JOIN tipos t ON p.tipo_id = t.id
            INNER JOIN categorias c ON t.categoria_id = c.id
            WHERE p.id = $1
        `;

        const resultado = await query(consulta, [id]);
        return resultado.rows[0];
    }
}

module.exports = new ProdutosController(); 