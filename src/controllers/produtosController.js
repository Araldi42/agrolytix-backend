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
                    p.empresa_id,
                    p.fazenda_id,
                    p.tipo_id,
                    p.codigo_interno,
                    p.codigo_barras,
                    p.nome,
                    p.descricao,
                    p.numero_serie,
                    p.marca,
                    p.modelo,
                    p.ano_fabricacao,
                    p.valor_aquisicao,
                    p.data_aquisicao,
                    p.fornecedor_id,
                    p.categoria_produto,
                    p.status,
                    p.observacoes,
                    p.ativo,
                    p.criado_em,
                    p.atualizado_em,
                    f.nome as fazenda_nome,
                    t.nome as tipo_nome,
                    forn.nome as fornecedor_nome
                FROM produtos p
                LEFT JOIN fazendas f ON p.fazenda_id = f.id
                LEFT JOIN tipos t ON p.tipo_id = t.id
                LEFT JOIN fornecedores forn ON p.fornecedor_id = forn.id
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
                    p.empresa_id,
                    p.fazenda_id,
                    p.tipo_id,
                    p.codigo_interno,
                    p.codigo_barras,
                    p.nome,
                    p.descricao,
                    p.numero_serie,
                    p.marca,
                    p.modelo,
                    p.ano_fabricacao,
                    p.valor_aquisicao,
                    p.data_aquisicao,
                    p.fornecedor_id,
                    p.categoria_produto,
                    p.status,
                    p.observacoes,
                    p.ativo,
                    p.criado_em,
                    p.atualizado_em,
                    f.nome as fazenda_nome,
                    t.nome as tipo_nome,
                    forn.nome as fornecedor_nome
                FROM produtos p
                LEFT JOIN fazendas f ON p.fazenda_id = f.id
                LEFT JOIN tipos t ON p.tipo_id = t.id
                LEFT JOIN fornecedores forn ON p.fornecedor_id = forn.id
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
            const { 
                fazenda_id, 
                tipo_id, 
                codigo_interno, 
                codigo_barras,
                nome, 
                descricao,
                numero_serie,
                marca,
                modelo,
                ano_fabricacao,
                valor_aquisicao,
                data_aquisicao,
                fornecedor_id,
                categoria_produto = 'insumo',
                status = 'ativo',
                observacoes
            } = req.body;
            const usuarioId = req.usuario.id;

            // Validação básica
            if (!nome || nome.trim().length === 0) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'Nome do produto é obrigatório'
                });
            }

            if (!fazenda_id) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'Fazenda é obrigatória'
                });
            }

            if (!tipo_id) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'Tipo do produto é obrigatório'
                });
            }

            // Verificar se código interno já existe (se fornecido)
            if (codigo_interno) {
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
            }

            // Inserir novo produto
            const consultaInsercao = `
                INSERT INTO produtos (
                    empresa_id, fazenda_id, tipo_id, codigo_interno, codigo_barras,
                    nome, descricao, numero_serie, marca, modelo, ano_fabricacao,
                    valor_aquisicao, data_aquisicao, fornecedor_id, categoria_produto,
                    status, observacoes, criado_por
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
                RETURNING 
                    id, empresa_id, fazenda_id, tipo_id, codigo_interno, codigo_barras,
                    nome, descricao, numero_serie, marca, modelo, ano_fabricacao,
                    valor_aquisicao, data_aquisicao, fornecedor_id, categoria_produto,
                    status, observacoes, ativo, criado_em
            `;

            const novoProduto = await query(consultaInsercao, [
                empresa_id,
                fazenda_id,
                tipo_id,
                codigo_interno?.trim() || null,
                codigo_barras?.trim() || null,
                nome.trim(),
                descricao?.trim() || null,
                numero_serie?.trim() || null,
                marca?.trim() || null,
                modelo?.trim() || null,
                ano_fabricacao || null,
                valor_aquisicao || null,
                data_aquisicao || null,
                fornecedor_id || null,
                categoria_produto,
                status,
                observacoes?.trim() || null,
                usuarioId
            ]);

            res.status(201).json({
                sucesso: true,
                mensagem: 'Produto criado com sucesso',
                dados: novoProduto.rows[0]
            });

        } catch (error) {
            console.error('Erro ao criar produto:', error);
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
            const { 
                fazenda_id,
                tipo_id,
                codigo_interno,
                codigo_barras,
                nome,
                descricao,
                numero_serie,
                marca,
                modelo,
                ano_fabricacao,
                valor_aquisicao,
                data_aquisicao,
                fornecedor_id,
                categoria_produto,
                status,
                observacoes
            } = req.body;
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
                    fazenda_id = $1,
                    tipo_id = $2,
                    codigo_interno = $3,
                    codigo_barras = $4,
                    nome = $5,
                    descricao = $6,
                    numero_serie = $7,
                    marca = $8,
                    modelo = $9,
                    ano_fabricacao = $10,
                    valor_aquisicao = $11,
                    data_aquisicao = $12,
                    fornecedor_id = $13,
                    categoria_produto = $14,
                    status = $15,
                    observacoes = $16,
                    atualizado_por = $17,
                    atualizado_em = CURRENT_TIMESTAMP
                WHERE id = $18 AND empresa_id = $19 AND ativo = true
                RETURNING 
                    id, empresa_id, fazenda_id, tipo_id, codigo_interno, codigo_barras,
                    nome, descricao, numero_serie, marca, modelo, ano_fabricacao,
                    valor_aquisicao, data_aquisicao, fornecedor_id, categoria_produto,
                    status, observacoes, ativo, criado_em, atualizado_em
            `;

            const produtoAtualizado = await query(consultaAtualizacao, [
                fazenda_id !== undefined ? fazenda_id : produto.fazenda_id,
                tipo_id !== undefined ? tipo_id : produto.tipo_id,
                codigo_interno !== undefined ? codigo_interno?.trim() : produto.codigo_interno,
                codigo_barras !== undefined ? codigo_barras?.trim() : produto.codigo_barras,
                nome !== undefined ? nome?.trim() : produto.nome,
                descricao !== undefined ? descricao?.trim() : produto.descricao,
                numero_serie !== undefined ? numero_serie?.trim() : produto.numero_serie,
                marca !== undefined ? marca?.trim() : produto.marca,
                modelo !== undefined ? modelo?.trim() : produto.modelo,
                ano_fabricacao !== undefined ? ano_fabricacao : produto.ano_fabricacao,
                valor_aquisicao !== undefined ? valor_aquisicao : produto.valor_aquisicao,
                data_aquisicao !== undefined ? data_aquisicao : produto.data_aquisicao,
                fornecedor_id !== undefined ? fornecedor_id : produto.fornecedor_id,
                categoria_produto !== undefined ? categoria_produto : produto.categoria_produto,
                status !== undefined ? status : produto.status,
                observacoes !== undefined ? observacoes?.trim() : produto.observacoes,
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