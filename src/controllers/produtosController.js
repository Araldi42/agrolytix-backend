/**
 * Controller de Produtos
 * Gerencia produtos/ativos da empresa com controle completo de estoque
 */

const { query } = require('../config/database');
const { criarErro } = require('../middlewares/tratadorErros');

/**
 * Controller para operações com produtos
 */
const produtosController = {
    /**
     * Listar produtos
     */
    async listar(req, res, next) {
        try {
            const { empresa_id } = req.usuario;
            const { 
                page = 1, 
                limit = 10, 
                search, 
                categoria, 
                tipo_id, 
                fazenda_id,
                status = 'ativo'
            } = req.query;

            let consulta = `
                SELECT 
                    p.id,
                    p.nome,
                    p.codigo_interno,
                    p.descricao,
                    p.unidade_medida,
                    p.preco_unitario,
                    p.categoria_id,
                    p.tipo_id,
                    p.ativo,
                    p.criado_em,
                    p.atualizado_em,
                    c.nome as categoria_nome,
                    t.nome as tipo_nome
                FROM produtos p
                LEFT JOIN categorias c ON p.categoria_id = c.id
                LEFT JOIN tipos t ON p.tipo_id = t.id
                WHERE p.empresa_id = $1 AND p.ativo = true
            `;

            const parametros = [empresa_id];
            let paramIndex = 2;

            // Adicionar filtros
            if (search) {
                consulta += ` AND (LOWER(p.nome) LIKE LOWER($${paramIndex}) OR LOWER(p.codigo_interno) LIKE LOWER($${paramIndex}))`;
                parametros.push(`%${search}%`);
                paramIndex++;
            }

            if (tipo_id) {
                consulta += ` AND p.tipo_id = $${paramIndex}`;
                parametros.push(tipo_id);
                paramIndex++;
            }

            consulta += ` ORDER BY p.nome`;

            // Paginação
            const offset = (parseInt(page) - 1) * parseInt(limit);
            consulta += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            parametros.push(parseInt(limit), offset);

            const resultado = await query(consulta, parametros);

            // Contar total
            let consultaTotal = `
                SELECT COUNT(*) as total
                FROM produtos p
                WHERE p.empresa_id = $1 AND p.ativo = true
            `;
            const parametrosTotal = [empresa_id];
            let paramIndexTotal = 2;

            if (search) {
                consultaTotal += ` AND (LOWER(p.nome) LIKE LOWER($${paramIndexTotal}) OR LOWER(p.codigo_interno) LIKE LOWER($${paramIndexTotal}))`;
                parametrosTotal.push(`%${search}%`);
                paramIndexTotal++;
            }

            if (tipo_id) {
                consultaTotal += ` AND p.tipo_id = $${paramIndexTotal}`;
                parametrosTotal.push(tipo_id);
            }

            const resultadoTotal = await query(consultaTotal, parametrosTotal);
            const total = parseInt(resultadoTotal.rows[0].total);

            res.json({
                sucesso: true,
                dados: {
                    produtos: resultado.rows,
                    paginacao: {
                        pagina_atual: parseInt(page),
                        total_registros: total,
                        registros_por_pagina: parseInt(limit),
                        total_paginas: Math.ceil(total / parseInt(limit))
                    }
                }
            });

        } catch (error) {
            next(error);
        }
    },

    /**
     * Buscar produto por ID
     */
    async buscarPorId(req, res, next) {
        try {
            const { id } = req.params;
            const { empresa_id } = req.usuario;

            const consulta = `
                SELECT 
                    p.id,
                    p.nome,
                    p.codigo_interno,
                    p.descricao,
                    p.unidade_medida,
                    p.preco_unitario,
                    p.categoria_id,
                    p.tipo_id,
                    p.ativo,
                    p.criado_em,
                    p.atualizado_em,
                    c.nome as categoria_nome,
                    t.nome as tipo_nome
                FROM produtos p
                LEFT JOIN categorias c ON p.categoria_id = c.id
                LEFT JOIN tipos t ON p.tipo_id = t.id
                WHERE p.id = $1 AND p.empresa_id = $2 AND p.ativo = true
            `;

            const resultado = await query(consulta, [id, empresa_id]);

            if (resultado.rows.length === 0) {
                return res.status(404).json({
                    sucesso: false,
                    mensagem: 'Produto não encontrado'
                });
            }

            res.json({
                sucesso: true,
                dados: resultado.rows[0]
            });

        } catch (error) {
            next(error);
        }
    },

    /**
     * Criar produto
     */
    async criar(req, res, next) {
        try {
            const { empresa_id } = req.usuario;
            const { nome, codigo_interno, descricao, unidade_medida, preco_unitario, categoria_id, tipo_id } = req.body;
            const usuarioId = req.usuario.id;

            // Validação básica
            if (!nome || nome.trim().length === 0) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'Nome do produto é obrigatório'
                });
            }

            if (!codigo_interno || codigo_interno.trim().length === 0) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'Código interno é obrigatório'
                });
            }

            // Verificar se código interno já existe
            const consultaExistente = `
                SELECT id FROM produtos 
                WHERE codigo_interno = $1 AND empresa_id = $2 AND ativo = true
            `;

            const produtoExistente = await query(consultaExistente, [codigo_interno.trim(), empresa_id]);

            if (produtoExistente.rows.length > 0) {
                return res.status(409).json({
                    sucesso: false,
                    mensagem: 'Código interno já existe para esta empresa'
                });
            }

            // Inserir novo produto
            const consultaInsercao = `
                INSERT INTO produtos (
                    nome, codigo_interno, descricao, unidade_medida, 
                    preco_unitario, categoria_id, tipo_id, empresa_id, criado_por
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING 
                    id, nome, codigo_interno, descricao, unidade_medida,
                    preco_unitario, categoria_id, tipo_id, ativo, criado_em
            `;

            const novoProduto = await query(consultaInsercao, [
                nome.trim(),
                codigo_interno.trim(),
                descricao?.trim() || '',
                unidade_medida?.trim() || 'UN',
                preco_unitario || 0,
                categoria_id || null,
                tipo_id || null,
                empresa_id,
                usuarioId
            ]);

            res.status(201).json({
                sucesso: true,
                mensagem: 'Produto criado com sucesso',
                dados: novoProduto.rows[0]
            });

        } catch (error) {
            next(error);
        }
    },

    /**
     * Atualizar produto
     */
    async atualizar(req, res, next) {
        try {
            const { id } = req.params;
            const { empresa_id } = req.usuario;
            const { nome, codigo_interno, descricao, unidade_medida, preco_unitario, categoria_id, tipo_id } = req.body;
            const usuarioId = req.usuario.id;

            // Verificar se o produto existe
            const consultaExistencia = `
                SELECT * FROM produtos 
                WHERE id = $1 AND empresa_id = $2 AND ativo = true
            `;

            const produtoExistente = await query(consultaExistencia, [id, empresa_id]);

            if (produtoExistente.rows.length === 0) {
                return res.status(404).json({
                    sucesso: false,
                    mensagem: 'Produto não encontrado'
                });
            }

            const produto = produtoExistente.rows[0];

            // Verificar código interno duplicado se foi alterado
            if (codigo_interno && codigo_interno !== produto.codigo_interno) {
                const consultaCodigoDuplicado = `
                    SELECT id FROM produtos 
                    WHERE codigo_interno = $1 AND empresa_id = $2 AND id != $3 AND ativo = true
                `;

                const codigoDuplicado = await query(consultaCodigoDuplicado, [codigo_interno.trim(), empresa_id, id]);

                if (codigoDuplicado.rows.length > 0) {
                    return res.status(409).json({
                        sucesso: false,
                        mensagem: 'Código interno já existe para esta empresa'
                    });
                }
            }

            // Atualizar produto
            const consultaAtualizacao = `
                UPDATE produtos 
                SET 
                    nome = $1,
                    codigo_interno = $2,
                    descricao = $3,
                    unidade_medida = $4,
                    preco_unitario = $5,
                    categoria_id = $6,
                    tipo_id = $7,
                    atualizado_por = $8,
                    atualizado_em = CURRENT_TIMESTAMP
                WHERE id = $9 AND empresa_id = $10 AND ativo = true
                RETURNING 
                    id, nome, codigo_interno, descricao, unidade_medida,
                    preco_unitario, categoria_id, tipo_id, ativo, 
                    criado_em, atualizado_em
            `;

            const produtoAtualizado = await query(consultaAtualizacao, [
                nome?.trim() || produto.nome,
                codigo_interno?.trim() || produto.codigo_interno,
                descricao?.trim() || produto.descricao || '',
                unidade_medida?.trim() || produto.unidade_medida || 'UN',
                preco_unitario !== undefined ? preco_unitario : produto.preco_unitario,
                categoria_id !== undefined ? categoria_id : produto.categoria_id,
                tipo_id !== undefined ? tipo_id : produto.tipo_id,
                usuarioId,
                id,
                empresa_id
            ]);

            res.json({
                sucesso: true,
                mensagem: 'Produto atualizado com sucesso',
                dados: produtoAtualizado.rows[0]
            });

        } catch (error) {
            next(error);
        }
    },

    /**
     * Excluir produto (soft delete)
     */
    async excluir(req, res, next) {
        try {
            const { id } = req.params;
            const { empresa_id } = req.usuario;
            const usuarioId = req.usuario.id;

            // Verificar se o produto existe
            const consultaExistencia = `
                SELECT id FROM produtos 
                WHERE id = $1 AND empresa_id = $2 AND ativo = true
            `;

            const produtoExiste = await query(consultaExistencia, [id, empresa_id]);

            if (produtoExiste.rows.length === 0) {
                return res.status(404).json({
                    sucesso: false,
                    mensagem: 'Produto não encontrado'
                });
            }

            // Verificar se tem estoque (se a tabela existir)
            try {
                const consultaEstoque = `
                    SELECT SUM(quantidade_atual) as total
                    FROM estoque WHERE produto_id = $1
                `;
                const estoqueResult = await query(consultaEstoque, [id]);
                
                if (parseFloat(estoqueResult.rows[0].total || 0) > 0) {
                    return res.status(400).json({
                        sucesso: false,
                        mensagem: 'Produto com estoque não pode ser excluído'
                    });
                }
            } catch (error) {
                // Se a tabela estoque não existir, continua
                console.log('Tabela estoque não encontrada, continuando...');
            }

            // Soft delete do produto
            const consulta = `
                UPDATE produtos 
                SET ativo = false, atualizado_por = $1, atualizado_em = CURRENT_TIMESTAMP
                WHERE id = $2 AND empresa_id = $3
            `;

            await query(consulta, [usuarioId, id, empresa_id]);

            res.json({
                sucesso: true,
                mensagem: 'Produto excluído com sucesso'
            });

        } catch (error) {
            next(error);
        }
    }
};

module.exports = produtosController; 