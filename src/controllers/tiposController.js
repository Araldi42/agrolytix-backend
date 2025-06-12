const { query } = require('../config/database');
const { criarErro } = require('../middlewares/tratadorErros');

/**
 * Controller para operações com tipos
 */
const tiposController = {
    /**
     * Buscar todos os tipos
     */
    async buscarTodos(req, res, next) {
        try {
            const consulta = `
                SELECT 
                    t.id,
                    t.nome,
                    t.descricao,
                    t.categoria_id,
                    t.ativo,
                    t.criado_em,
                    t.atualizado_em,
                    c.nome as categoria_nome,
                    u1.nome as criado_por_nome,
                    u2.nome as atualizado_por_nome
                FROM tipos t
                INNER JOIN categorias c ON t.categoria_id = c.id
                LEFT JOIN usuarios u1 ON t.criado_por = u1.id
                LEFT JOIN usuarios u2 ON t.atualizado_por = u2.id
                WHERE t.ativo = true AND c.ativo = true
                ORDER BY c.nome, t.nome
            `;

            const resultado = await query(consulta);

            // Enriquecer dados para manter compatibilidade com frontend
            const dadosEnriquecidos = resultado.rows.map(tipo => ({
                ...tipo,
                categoria: {
                    id: tipo.categoria_id,
                    nome: tipo.categoria_nome
                }
            }));

            res.json(dadosEnriquecidos);

        } catch (error) {
            next(error);
        }
    },

    /**
     * Buscar tipo por ID
     */
    async buscarPorId(req, res, next) {
        try {
            const { id } = req.params;

            const consulta = `
                SELECT 
                    t.id,
                    t.nome,
                    t.descricao,
                    t.categoria_id,
                    t.ativo,
                    t.criado_em,
                    t.atualizado_em,
                    c.nome as categoria_nome,
                    u1.nome as criado_por_nome,
                    u2.nome as atualizado_por_nome
                FROM tipos t
                INNER JOIN categorias c ON t.categoria_id = c.id
                LEFT JOIN usuarios u1 ON t.criado_por = u1.id
                LEFT JOIN usuarios u2 ON t.atualizado_por = u2.id
                WHERE t.id = $1 AND t.ativo = true AND c.ativo = true
            `;

            const resultado = await query(consulta, [id]);

            if (resultado.rows.length === 0) {
                return res.status(404).json({
                    message: 'Tipo não encontrado'
                });
            }

            const tipo = resultado.rows[0];

            // Enriquecer dados para manter compatibilidade com frontend
            const dadosEnriquecidos = {
                ...tipo,
                categoria: {
                    id: tipo.categoria_id,
                    nome: tipo.categoria_nome
                }
            };

            res.json(dadosEnriquecidos);

        } catch (error) {
            next(error);
        }
    },

    /**
     * Criar novo tipo
     */
    async criar(req, res, next) {
        try {
            const { nome, categoriaId, descricao } = req.body;
            const usuarioId = req.usuario.id;

            // Validação básica
            if (!nome || nome.trim().length === 0) {
                return res.status(400).json({
                    message: 'Nome do tipo é obrigatório'
                });
            }

            if (!categoriaId) {
                return res.status(400).json({
                    message: 'Categoria é obrigatória'
                });
            }

            // Verificar se a categoria existe
            const consultaCategoria = `
                SELECT id FROM categorias 
                WHERE id = $1 AND ativo = true
            `;

            const categoriaExiste = await query(consultaCategoria, [categoriaId]);

            if (categoriaExiste.rows.length === 0) {
                return res.status(404).json({
                    message: 'Categoria não encontrada'
                });
            }

            // Verificar se já existe tipo com o mesmo nome na mesma categoria
            const consultaExistente = `
                SELECT id FROM tipos 
                WHERE LOWER(nome) = LOWER($1) AND categoria_id = $2 AND ativo = true
            `;

            const tipoExistente = await query(consultaExistente, [nome.trim(), categoriaId]);

            if (tipoExistente.rows.length > 0) {
                return res.status(409).json({
                    message: 'Já existe um tipo com este nome nesta categoria'
                });
            }

            // Inserir novo tipo
            const consultaInsercao = `
                INSERT INTO tipos (nome, categoria_id, descricao, criado_por)
                VALUES ($1, $2, $3, $4)
                RETURNING 
                    id, nome, descricao, categoria_id, ativo, 
                    criado_em, criado_por
            `;

            const novoTipo = await query(consultaInsercao, [
                nome.trim(),
                categoriaId,
                descricao?.trim() || '',
                usuarioId
            ]);

            // Buscar dados da categoria para resposta
            const categoria = await query('SELECT nome FROM categorias WHERE id = $1', [categoriaId]);

            const dadosEnriquecidos = {
                ...novoTipo.rows[0],
                categoria: {
                    id: categoriaId,
                    nome: categoria.rows[0].nome
                }
            };

            res.status(201).json({
                message: 'Tipo criado com sucesso',
                tipo: dadosEnriquecidos
            });

        } catch (error) {
            next(error);
        }
    },

    /**
     * Atualizar tipo
     */
    async atualizar(req, res, next) {
        try {
            const { id } = req.params;
            const { nome, categoriaId, descricao } = req.body;
            const usuarioId = req.usuario.id;

            // Validação básica
            if (!nome || nome.trim().length === 0) {
                return res.status(400).json({
                    message: 'Nome do tipo é obrigatório'
                });
            }

            if (!categoriaId) {
                return res.status(400).json({
                    message: 'Categoria é obrigatória'
                });
            }

            // Verificar se o tipo existe
            const consultaExistencia = `
                SELECT id FROM tipos 
                WHERE id = $1 AND ativo = true
            `;

            const tipoExiste = await query(consultaExistencia, [id]);

            if (tipoExiste.rows.length === 0) {
                return res.status(404).json({
                    message: 'Tipo não encontrado'
                });
            }

            // Verificar se a categoria existe
            const consultaCategoria = `
                SELECT id FROM categorias 
                WHERE id = $1 AND ativo = true
            `;

            const categoriaExiste = await query(consultaCategoria, [categoriaId]);

            if (categoriaExiste.rows.length === 0) {
                return res.status(404).json({
                    message: 'Categoria não encontrada'
                });
            }

            // Verificar se já existe outro tipo com o mesmo nome na mesma categoria
            const consultaNomeDuplicado = `
                SELECT id FROM tipos 
                WHERE LOWER(nome) = LOWER($1) AND categoria_id = $2 AND id != $3 AND ativo = true
            `;

            const nomeDuplicado = await query(consultaNomeDuplicado, [nome.trim(), categoriaId, id]);

            if (nomeDuplicado.rows.length > 0) {
                return res.status(409).json({
                    message: 'Já existe outro tipo com este nome nesta categoria'
                });
            }

            // Atualizar tipo
            const consultaAtualizacao = `
                UPDATE tipos 
                SET 
                    nome = $1,
                    categoria_id = $2,
                    descricao = $3,
                    atualizado_por = $4,
                    atualizado_em = CURRENT_TIMESTAMP
                WHERE id = $5 AND ativo = true
                RETURNING 
                    id, nome, descricao, categoria_id, ativo,
                    criado_em, atualizado_em,
                    criado_por, atualizado_por
            `;

            const tipoAtualizado = await query(consultaAtualizacao, [
                nome.trim(),
                categoriaId,
                descricao?.trim() || '',
                usuarioId,
                id
            ]);

            // Buscar dados da categoria para resposta
            const categoria = await query('SELECT nome FROM categorias WHERE id = $1', [categoriaId]);

            const dadosEnriquecidos = {
                ...tipoAtualizado.rows[0],
                categoria: {
                    id: categoriaId,
                    nome: categoria.rows[0].nome
                }
            };

            res.json({
                message: 'Tipo atualizado com sucesso',
                tipo: dadosEnriquecidos
            });

        } catch (error) {
            next(error);
        }
    },

    /**
     * Excluir tipo (soft delete)
     */
    async excluir(req, res, next) {
        try {
            const { id } = req.params;
            const usuarioId = req.usuario.id;

            // Verificar se o tipo existe
            const consultaExistencia = `
                SELECT id FROM tipos 
                WHERE id = $1 AND ativo = true
            `;

            const tipoExiste = await query(consultaExistencia, [id]);

            if (tipoExiste.rows.length === 0) {
                return res.status(404).json({
                    message: 'Tipo não encontrado'
                });
            }

            // Verificar se há ativos usando este tipo
            const consultaAtivos = `
                SELECT id FROM ativos 
                WHERE tipo_id = $1 AND ativo = true
                LIMIT 1
            `;

            const ativosVinculados = await query(consultaAtivos, [id]);

            if (ativosVinculados.rows.length > 0) {
                return res.status(409).json({
                    message: 'Este tipo está em uso em ativos e não pode ser excluído'
                });
            }

            // Soft delete do tipo
            const consultaExclusao = `
                UPDATE tipos 
                SET 
                    ativo = false,
                    atualizado_por = $1,
                    atualizado_em = CURRENT_TIMESTAMP
                WHERE id = $2
            `;

            await query(consultaExclusao, [usuarioId, id]);

            res.json({
                message: 'Tipo excluído com sucesso'
            });

        } catch (error) {
            next(error);
        }
    }
};

module.exports = tiposController;