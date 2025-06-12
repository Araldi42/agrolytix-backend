const { query } = require('../config/database');
const { criarErro } = require('../middlewares/tratadorErros');

/**
 * Controller para operações com categorias
 */
const categoriasController = {
    /**
     * Buscar todas as categorias
     */
    async buscarTodas(req, res, next) {
        try {
            const consulta = `
                SELECT 
                    c.id,
                    c.nome,
                    c.descricao,
                    c.ativo,
                    c.criado_em,
                    c.atualizado_em,
                    u1.nome as criado_por_nome,
                    u2.nome as atualizado_por_nome
                FROM categorias c
                LEFT JOIN usuarios u1 ON c.criado_por = u1.id
                LEFT JOIN usuarios u2 ON c.atualizado_por = u2.id
                WHERE c.ativo = true
                ORDER BY c.nome
            `;

            const resultado = await query(consulta);

            res.json({
                sucesso: true,
                dados: resultado.rows,
                total: resultado.rows.length
            });

        } catch (error) {
            next(error);
        }
    },

    /**
     * Buscar categoria por ID
     */
    async buscarPorId(req, res, next) {
        try {
            const { id } = req.params;

            const consulta = `
                SELECT 
                    c.id,
                    c.nome,
                    c.descricao,
                    c.ativo,
                    c.criado_em,
                    c.atualizado_em,
                    u1.nome as criado_por_nome,
                    u2.nome as atualizado_por_nome
                FROM categorias c
                LEFT JOIN usuarios u1 ON c.criado_por = u1.id
                LEFT JOIN usuarios u2 ON c.atualizado_por = u2.id
                WHERE c.id = $1 AND c.ativo = true
            `;

            const resultado = await query(consulta, [id]);

            if (resultado.rows.length === 0) {
                return res.status(404).json({
                    sucesso: false,
                    mensagem: 'Categoria não encontrada'
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
     * Criar nova categoria
     */
    async criar(req, res, next) {
        try {
            const { nome, descricao } = req.body;
            const usuarioId = req.usuario.id;

            // Validação básica
            if (!nome || nome.trim().length === 0) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'Nome da categoria é obrigatório'
                });
            }

            // Verificar se já existe categoria com o mesmo nome
            const consultaExistente = `
                SELECT id FROM categorias 
                WHERE LOWER(nome) = LOWER($1) AND ativo = true
            `;

            const categoriaExistente = await query(consultaExistente, [nome.trim()]);

            if (categoriaExistente.rows.length > 0) {
                return res.status(409).json({
                    sucesso: false,
                    mensagem: 'Já existe uma categoria com este nome'
                });
            }

            // Inserir nova categoria
            const consultaInsercao = `
                INSERT INTO categorias (nome, descricao, criado_por)
                VALUES ($1, $2, $3)
                RETURNING 
                    id, nome, descricao, ativo, 
                    criado_em, criado_por
            `;

            const novaCategoria = await query(consultaInsercao, [
                nome.trim(),
                descricao?.trim() || '',
                usuarioId
            ]);

            res.status(201).json({
                sucesso: true,
                mensagem: 'Categoria criada com sucesso',
                dados: novaCategoria.rows[0]
            });

        } catch (error) {
            next(error);
        }
    },

    /**
     * Atualizar categoria
     */
    async atualizar(req, res, next) {
        try {
            const { id } = req.params;
            const { nome, descricao } = req.body;
            const usuarioId = req.usuario.id;

            // Validação básica
            if (!nome || nome.trim().length === 0) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'Nome da categoria é obrigatório'
                });
            }

            // Verificar se a categoria existe
            const consultaExistencia = `
                SELECT id FROM categorias 
                WHERE id = $1 AND ativo = true
            `;

            const categoriaExiste = await query(consultaExistencia, [id]);

            if (categoriaExiste.rows.length === 0) {
                return res.status(404).json({
                    sucesso: false,
                    mensagem: 'Categoria não encontrada'
                });
            }

            // Verificar se já existe outra categoria com o mesmo nome
            const consultaNomeDuplicado = `
                SELECT id FROM categorias 
                WHERE LOWER(nome) = LOWER($1) AND id != $2 AND ativo = true
            `;

            const nomeDuplicado = await query(consultaNomeDuplicado, [nome.trim(), id]);

            if (nomeDuplicado.rows.length > 0) {
                return res.status(409).json({
                    sucesso: false,
                    mensagem: 'Já existe outra categoria com este nome'
                });
            }

            // Atualizar categoria
            const consultaAtualizacao = `
                UPDATE categorias 
                SET 
                    nome = $1,
                    descricao = $2,
                    atualizado_por = $3,
                    atualizado_em = CURRENT_TIMESTAMP
                WHERE id = $4 AND ativo = true
                RETURNING 
                    id, nome, descricao, ativo,
                    criado_em, atualizado_em,
                    criado_por, atualizado_por
            `;

            const categoriaAtualizada = await query(consultaAtualizacao, [
                nome.trim(),
                descricao?.trim() || '',
                usuarioId,
                id
            ]);

            res.json({
                sucesso: true,
                mensagem: 'Categoria atualizada com sucesso',
                dados: categoriaAtualizada.rows[0]
            });

        } catch (error) {
            next(error);
        }
    },

    /**
     * Excluir categoria (soft delete)
     */
    async excluir(req, res, next) {
        try {
            const { id } = req.params;
            const usuarioId = req.usuario.id;

            // Verificar se a categoria existe
            const consultaExistencia = `
                SELECT id FROM categorias 
                WHERE id = $1 AND ativo = true
            `;

            const categoriaExiste = await query(consultaExistencia, [id]);

            if (categoriaExiste.rows.length === 0) {
                return res.status(404).json({
                    sucesso: false,
                    mensagem: 'Categoria não encontrada'
                });
            }

            // Verificar se há tipos usando esta categoria
            const consultaTipos = `
                SELECT id FROM tipos 
                WHERE categoria_id = $1 AND ativo = true
                LIMIT 1
            `;

            const tiposVinculados = await query(consultaTipos, [id]);

            if (tiposVinculados.rows.length > 0) {
                return res.status(409).json({
                    sucesso: false,
                    mensagem: 'Esta categoria possui tipos vinculados e não pode ser excluída'
                });
            }

            // Verificar se há ativos usando esta categoria
            const consultaAtivos = `
                SELECT id FROM ativos 
                WHERE categoria_id = $1 AND ativo = true
                LIMIT 1
            `;

            const ativosVinculados = await query(consultaAtivos, [id]);

            if (ativosVinculados.rows.length > 0) {
                return res.status(409).json({
                    sucesso: false,
                    mensagem: 'Esta categoria possui ativos vinculados e não pode ser excluída'
                });
            }

            // Soft delete da categoria
            const consultaExclusao = `
                UPDATE categorias 
                SET 
                    ativo = false,
                    atualizado_por = $1,
                    atualizado_em = CURRENT_TIMESTAMP
                WHERE id = $2
            `;

            await query(consultaExclusao, [usuarioId, id]);

            res.json({
                sucesso: true,
                mensagem: 'Categoria excluída com sucesso'
            });

        } catch (error) {
            next(error);
        }
    },

    /**
     * Buscar tipos de uma categoria
     */
    async buscarTipos(req, res, next) {
        try {
            const { id } = req.params;

            // Verificar se a categoria existe
            const consultaCategoria = `
                SELECT id FROM categorias 
                WHERE id = $1 AND ativo = true
            `;

            const categoriaExiste = await query(consultaCategoria, [id]);

            if (categoriaExiste.rows.length === 0) {
                return res.status(404).json({
                    sucesso: false,
                    mensagem: 'Categoria não encontrada'
                });
            }

            // Buscar tipos da categoria
            const consultaTipos = `
                SELECT 
                    t.id,
                    t.nome,
                    t.descricao,
                    t.categoria_id,
                    t.ativo,
                    t.criado_em,
                    t.atualizado_em,
                    c.nome as categoria_nome
                FROM tipos t
                INNER JOIN categorias c ON t.categoria_id = c.id
                WHERE t.categoria_id = $1 AND t.ativo = true
                ORDER BY t.nome
            `;

            const resultado = await query(consultaTipos, [id]);

            res.json({
                sucesso: true,
                dados: resultado.rows,
                total: resultado.rows.length
            });

        } catch (error) {
            next(error);
        }
    }
};

module.exports = categoriasController;