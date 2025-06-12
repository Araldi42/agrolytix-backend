const { query } = require('../config/database');
const { criarErro } = require('../middlewares/tratadorErros');

/**
 * Controller para operações com ativos
 */
const ativosController = {
    /**
     * Buscar todos os ativos
     */
    async buscarTodos(req, res, next) {
        try {
            const consulta = `
                SELECT 
                    a.id,
                    a.nome,
                    a.categoria_id,
                    a.tipo_id,
                    a.valor,
                    a.unidade_medida,
                    a.data_aquisicao,
                    a.fornecedor_id,
                    a.numero_serie,
                    a.localizacao,
                    a.status,
                    a.observacoes,
                    a.ativo,
                    a.criado_em,
                    a.atualizado_em,
                    c.nome as categoria_nome,
                    t.nome as tipo_nome,
                    f.nome as fornecedor_nome,
                    u1.nome as criado_por_nome,
                    u2.nome as atualizado_por_nome
                FROM ativos a
                INNER JOIN categorias c ON a.categoria_id = c.id
                INNER JOIN tipos t ON a.tipo_id = t.id
                INNER JOIN fornecedores f ON a.fornecedor_id = f.id
                LEFT JOIN usuarios u1 ON a.criado_por = u1.id
                LEFT JOIN usuarios u2 ON a.atualizado_por = u2.id
                WHERE a.ativo = true AND c.ativo = true AND t.ativo = true AND f.ativo = true
                ORDER BY a.criado_em DESC
            `;

            const resultado = await query(consulta);

            // Enriquecer dados para manter compatibilidade com frontend
            const dadosEnriquecidos = resultado.rows.map(ativo => ({
                ...ativo,
                categoriaId: ativo.categoria_id,
                tipoId: ativo.tipo_id,
                fornecedorId: ativo.fornecedor_id,
                unidadeMedida: ativo.unidade_medida,
                dataAquisicao: ativo.data_aquisicao,
                numeroSerie: ativo.numero_serie,
                tipo: {
                    id: ativo.tipo_id,
                    nome: ativo.tipo_nome
                },
                categoria: {
                    id: ativo.categoria_id,
                    nome: ativo.categoria_nome
                },
                fornecedor: {
                    id: ativo.fornecedor_id,
                    nome: ativo.fornecedor_nome
                }
            }));

            res.json(dadosEnriquecidos);

        } catch (error) {
            next(error);
        }
    },

    /**
     * Buscar ativo por ID
     */
    async buscarPorId(req, res, next) {
        try {
            const { id } = req.params;

            const consulta = `
                SELECT 
                    a.id,
                    a.nome,
                    a.categoria_id,
                    a.tipo_id,
                    a.valor,
                    a.unidade_medida,
                    a.data_aquisicao,
                    a.fornecedor_id,
                    a.numero_serie,
                    a.localizacao,
                    a.status,
                    a.observacoes,
                    a.ativo,
                    a.criado_em,
                    a.atualizado_em,
                    c.nome as categoria_nome,
                    t.nome as tipo_nome,
                    f.nome as fornecedor_nome,
                    u1.nome as criado_por_nome,
                    u2.nome as atualizado_por_nome
                FROM ativos a
                INNER JOIN categorias c ON a.categoria_id = c.id
                INNER JOIN tipos t ON a.tipo_id = t.id
                INNER JOIN fornecedores f ON a.fornecedor_id = f.id
                LEFT JOIN usuarios u1 ON a.criado_por = u1.id
                LEFT JOIN usuarios u2 ON a.atualizado_por = u2.id
                WHERE a.id = $1 AND a.ativo = true AND c.ativo = true AND t.ativo = true AND f.ativo = true
            `;

            const resultado = await query(consulta, [id]);

            if (resultado.rows.length === 0) {
                return res.status(404).json({
                    message: 'Ativo não encontrado'
                });
            }

            const ativo = resultado.rows[0];

            // Enriquecer dados para manter compatibilidade com frontend
            const dadosEnriquecidos = {
                ...ativo,
                categoriaId: ativo.categoria_id,
                tipoId: ativo.tipo_id,
                fornecedorId: ativo.fornecedor_id,
                unidadeMedida: ativo.unidade_medida,
                dataAquisicao: ativo.data_aquisicao,
                numeroSerie: ativo.numero_serie,
                tipo: {
                    id: ativo.tipo_id,
                    nome: ativo.tipo_nome
                },
                categoria: {
                    id: ativo.categoria_id,
                    nome: ativo.categoria_nome
                },
                fornecedor: {
                    id: ativo.fornecedor_id,
                    nome: ativo.fornecedor_nome
                }
            };

            res.json(dadosEnriquecidos);

        } catch (error) {
            next(error);
        }
    },

    /**
     * Criar novo ativo
     */
    async criar(req, res, next) {
        try {
            const {
                nome,
                categoriaId,
                tipoId,
                valor,
                unidadeMedida,
                dataAquisicao,
                fornecedorId,
                numeroSerie,
                localizacao,
                status,
                observacoes
            } = req.body;
            const usuarioId = req.usuario.id;

            // Validação básica
            if (!nome || !categoriaId || !tipoId || !valor || !unidadeMedida || !dataAquisicao || !fornecedorId) {
                return res.status(400).json({
                    message: 'Campos obrigatórios: nome, categoria, tipo, valor, unidadeMedida, dataAquisicao, fornecedor'
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

            // Verificar se o tipo existe
            const consultaTipo = `
                SELECT id FROM tipos 
                WHERE id = $1 AND ativo = true
            `;

            const tipoExiste = await query(consultaTipo, [tipoId]);

            if (tipoExiste.rows.length === 0) {
                return res.status(404).json({
                    message: 'Tipo não encontrado'
                });
            }

            // Verificar se o fornecedor existe
            const consultaFornecedor = `
                SELECT id FROM fornecedores 
                WHERE id = $1 AND ativo = true
            `;

            const fornecedorExiste = await query(consultaFornecedor, [fornecedorId]);

            if (fornecedorExiste.rows.length === 0) {
                return res.status(404).json({
                    message: 'Fornecedor não encontrado'
                });
            }

            // Inserir novo ativo
            const consultaInsercao = `
                INSERT INTO ativos (
                    nome, categoria_id, tipo_id, valor, unidade_medida, data_aquisicao,
                    fornecedor_id, numero_serie, localizacao, status, observacoes, criado_por
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                RETURNING 
                    id, nome, categoria_id, tipo_id, valor, unidade_medida, data_aquisicao,
                    fornecedor_id, numero_serie, localizacao, status, observacoes, ativo,
                    criado_em, criado_por
            `;

            const novoAtivo = await query(consultaInsercao, [
                nome.trim(),
                categoriaId,
                tipoId,
                parseFloat(valor),
                unidadeMedida.trim(),
                dataAquisicao,
                fornecedorId,
                numeroSerie?.trim() || '',
                localizacao?.trim() || '',
                status || 'Ativo',
                observacoes?.trim() || '',
                usuarioId
            ]);

            // Buscar dados relacionados para resposta enriquecida
            const consultaDadosRelacionados = `
                SELECT 
                    c.nome as categoria_nome,
                    t.nome as tipo_nome,
                    f.nome as fornecedor_nome
                FROM categorias c, tipos t, fornecedores f
                WHERE c.id = $1 AND t.id = $2 AND f.id = $3
            `;

            const dadosRelacionados = await query(consultaDadosRelacionados, [categoriaId, tipoId, fornecedorId]);

            const ativo = novoAtivo.rows[0];
            const relacionados = dadosRelacionados.rows[0];

            const dadosEnriquecidos = {
                ...ativo,
                categoriaId: ativo.categoria_id,
                tipoId: ativo.tipo_id,
                fornecedorId: ativo.fornecedor_id,
                unidadeMedida: ativo.unidade_medida,
                dataAquisicao: ativo.data_aquisicao,
                numeroSerie: ativo.numero_serie,
                tipo: {
                    id: ativo.tipo_id,
                    nome: relacionados.tipo_nome
                },
                categoria: {
                    id: ativo.categoria_id,
                    nome: relacionados.categoria_nome
                },
                fornecedor: {
                    id: ativo.fornecedor_id,
                    nome: relacionados.fornecedor_nome
                }
            };

            res.status(201).json({
                message: 'Ativo criado com sucesso',
                ativo: dadosEnriquecidos
            });

        } catch (error) {
            next(error);
        }
    },

    /**
     * Atualizar ativo
     */
    async atualizar(req, res, next) {
        try {
            const { id } = req.params;
            const {
                nome,
                categoriaId,
                tipoId,
                valor,
                unidadeMedida,
                dataAquisicao,
                fornecedorId,
                numeroSerie,
                localizacao,
                status,
                observacoes
            } = req.body;
            const usuarioId = req.usuario.id;

            // Validação básica
            if (!nome || !categoriaId || !tipoId || !valor || !unidadeMedida || !dataAquisicao || !fornecedorId) {
                return res.status(400).json({
                    message: 'Campos obrigatórios: nome, categoria, tipo, valor, unidadeMedida, dataAquisicao, fornecedor'
                });
            }

            // Verificar se o ativo existe
            const consultaExistencia = `
                SELECT id FROM ativos 
                WHERE id = $1 AND ativo = true
            `;

            const ativoExiste = await query(consultaExistencia, [id]);

            if (ativoExiste.rows.length === 0) {
                return res.status(404).json({
                    message: 'Ativo não encontrado'
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

            // Verificar se o tipo existe
            const consultaTipo = `
                SELECT id FROM tipos 
                WHERE id = $1 AND ativo = true
            `;

            const tipoExiste = await query(consultaTipo, [tipoId]);

            if (tipoExiste.rows.length === 0) {
                return res.status(404).json({
                    message: 'Tipo não encontrado'
                });
            }

            // Verificar se o fornecedor existe
            const consultaFornecedor = `
                SELECT id FROM fornecedores 
                WHERE id = $1 AND ativo = true
            `;

            const fornecedorExiste = await query(consultaFornecedor, [fornecedorId]);

            if (fornecedorExiste.rows.length === 0) {
                return res.status(404).json({
                    message: 'Fornecedor não encontrado'
                });
            }

            // Atualizar ativo
            const consultaAtualizacao = `
                UPDATE ativos 
                SET 
                    nome = $1,
                    categoria_id = $2,
                    tipo_id = $3,
                    valor = $4,
                    unidade_medida = $5,
                    data_aquisicao = $6,
                    fornecedor_id = $7,
                    numero_serie = $8,
                    localizacao = $9,
                    status = $10,
                    observacoes = $11,
                    atualizado_por = $12,
                    atualizado_em = CURRENT_TIMESTAMP
                WHERE id = $13 AND ativo = true
                RETURNING 
                    id, nome, categoria_id, tipo_id, valor, unidade_medida, data_aquisicao,
                    fornecedor_id, numero_serie, localizacao, status, observacoes, ativo,
                    criado_em, atualizado_em, criado_por, atualizado_por
            `;

            const ativoAtualizado = await query(consultaAtualizacao, [
                nome.trim(),
                categoriaId,
                tipoId,
                parseFloat(valor),
                unidadeMedida.trim(),
                dataAquisicao,
                fornecedorId,
                numeroSerie?.trim() || '',
                localizacao?.trim() || '',
                status || 'Ativo',
                observacoes?.trim() || '',
                usuarioId,
                id
            ]);

            // Buscar dados relacionados para resposta enriquecida
            const consultaDadosRelacionados = `
                SELECT 
                    c.nome as categoria_nome,
                    t.nome as tipo_nome,
                    f.nome as fornecedor_nome
                FROM categorias c, tipos t, fornecedores f
                WHERE c.id = $1 AND t.id = $2 AND f.id = $3
            `;

            const dadosRelacionados = await query(consultaDadosRelacionados, [categoriaId, tipoId, fornecedorId]);

            const ativo = ativoAtualizado.rows[0];
            const relacionados = dadosRelacionados.rows[0];

            const dadosEnriquecidos = {
                ...ativo,
                categoriaId: ativo.categoria_id,
                tipoId: ativo.tipo_id,
                fornecedorId: ativo.fornecedor_id,
                unidadeMedida: ativo.unidade_medida,
                dataAquisicao: ativo.data_aquisicao,
                numeroSerie: ativo.numero_serie,
                tipo: {
                    id: ativo.tipo_id,
                    nome: relacionados.tipo_nome
                },
                categoria: {
                    id: ativo.categoria_id,
                    nome: relacionados.categoria_nome
                },
                fornecedor: {
                    id: ativo.fornecedor_id,
                    nome: relacionados.fornecedor_nome
                }
            };

            res.json({
                message: 'Ativo atualizado com sucesso',
                ativo: dadosEnriquecidos
            });

        } catch (error) {
            next(error);
        }
    },

    /**
     * Excluir ativo (soft delete)
     */
    async excluir(req, res, next) {
        try {
            const { id } = req.params;
            const usuarioId = req.usuario.id;

            // Verificar se o ativo existe
            const consultaExistencia = `
                SELECT id FROM ativos 
                WHERE id = $1 AND ativo = true
            `;

            const ativoExiste = await query(consultaExistencia, [id]);

            if (ativoExiste.rows.length === 0) {
                return res.status(404).json({
                    message: 'Ativo não encontrado'
                });
            }

            // Soft delete do ativo
            const consultaExclusao = `
                UPDATE ativos 
                SET 
                    ativo = false,
                    atualizado_por = $1,
                    atualizado_em = CURRENT_TIMESTAMP
                WHERE id = $2
            `;

            await query(consultaExclusao, [usuarioId, id]);

            res.json({
                message: 'Ativo excluído com sucesso'
            });

        } catch (error) {
            next(error);
        }
    }
};

module.exports = ativosController;