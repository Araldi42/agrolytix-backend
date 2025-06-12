const { query } = require('../config/database');
const { criarErro } = require('../middlewares/tratadorErros');

/**
 * Controller para operações com fornecedores
 */
const fornecedoresController = {
    /**
     * Buscar todos os fornecedores
     */
    async buscarTodos(req, res, next) {
        try {
            const consulta = `
                SELECT 
                    f.id,
                    f.nome,
                    f.cnpj,
                    f.contato,
                    f.email,
                    f.telefone,
                    f.endereco,
                    f.ativo,
                    f.criado_em,
                    f.atualizado_em,
                    u1.nome as criado_por_nome,
                    u2.nome as atualizado_por_nome
                FROM fornecedores f
                LEFT JOIN usuarios u1 ON f.criado_por = u1.id
                LEFT JOIN usuarios u2 ON f.atualizado_por = u2.id
                WHERE f.ativo = true
                ORDER BY f.nome
            `;

            const resultado = await query(consulta);

            res.json(resultado.rows);

        } catch (error) {
            next(error);
        }
    },

    /**
     * Buscar fornecedor por ID
     */
    async buscarPorId(req, res, next) {
        try {
            const { id } = req.params;

            const consulta = `
                SELECT 
                    f.id,
                    f.nome,
                    f.cnpj,
                    f.contato,
                    f.email,
                    f.telefone,
                    f.endereco,
                    f.ativo,
                    f.criado_em,
                    f.atualizado_em,
                    u1.nome as criado_por_nome,
                    u2.nome as atualizado_por_nome
                FROM fornecedores f
                LEFT JOIN usuarios u1 ON f.criado_por = u1.id
                LEFT JOIN usuarios u2 ON f.atualizado_por = u2.id
                WHERE f.id = $1 AND f.ativo = true
            `;

            const resultado = await query(consulta, [id]);

            if (resultado.rows.length === 0) {
                return res.status(404).json({
                    message: 'Fornecedor não encontrado'
                });
            }

            res.json(resultado.rows[0]);

        } catch (error) {
            next(error);
        }
    },

    /**
     * Criar novo fornecedor
     */
    async criar(req, res, next) {
        try {
            const { nome, cnpj, contato, email, telefone, endereco } = req.body;
            const usuarioId = req.usuario.id;

            // Validação básica
            if (!nome || nome.trim().length === 0) {
                return res.status(400).json({
                    message: 'Nome do fornecedor é obrigatório'
                });
            }

            // Verificar se já existe fornecedor com o mesmo CNPJ (se fornecido)
            if (cnpj && cnpj.trim().length > 0) {
                const consultaExistenteCNPJ = `
                    SELECT id FROM fornecedores 
                    WHERE cnpj = $1 AND ativo = true
                `;

                const fornecedorExistente = await query(consultaExistenteCNPJ, [cnpj.trim()]);

                if (fornecedorExistente.rows.length > 0) {
                    return res.status(409).json({
                        message: 'Já existe um fornecedor com este CNPJ'
                    });
                }
            }

            // Inserir novo fornecedor
            const consultaInsercao = `
                INSERT INTO fornecedores (nome, cnpj, contato, email, telefone, endereco, criado_por)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING 
                    id, nome, cnpj, contato, email, telefone, endereco, ativo, 
                    criado_em, criado_por
            `;

            const novoFornecedor = await query(consultaInsercao, [
                nome.trim(),
                cnpj?.trim() || '',
                contato?.trim() || '',
                email?.trim() || '',
                telefone?.trim() || '',
                endereco?.trim() || '',
                usuarioId
            ]);

            res.status(201).json({
                message: 'Fornecedor criado com sucesso',
                fornecedor: novoFornecedor.rows[0]
            });

        } catch (error) {
            next(error);
        }
    },

    /**
     * Atualizar fornecedor
     */
    async atualizar(req, res, next) {
        try {
            const { id } = req.params;
            const { nome, cnpj, contato, email, telefone, endereco } = req.body;
            const usuarioId = req.usuario.id;

            // Validação básica
            if (!nome || nome.trim().length === 0) {
                return res.status(400).json({
                    message: 'Nome do fornecedor é obrigatório'
                });
            }

            // Verificar se o fornecedor existe
            const consultaExistencia = `
                SELECT id FROM fornecedores 
                WHERE id = $1 AND ativo = true
            `;

            const fornecedorExiste = await query(consultaExistencia, [id]);

            if (fornecedorExiste.rows.length === 0) {
                return res.status(404).json({
                    message: 'Fornecedor não encontrado'
                });
            }

            // Verificar se já existe outro fornecedor com o mesmo CNPJ (se fornecido)
            if (cnpj && cnpj.trim().length > 0) {
                const consultaCNPJDuplicado = `
                    SELECT id FROM fornecedores 
                    WHERE cnpj = $1 AND id != $2 AND ativo = true
                `;

                const cnpjDuplicado = await query(consultaCNPJDuplicado, [cnpj.trim(), id]);

                if (cnpjDuplicado.rows.length > 0) {
                    return res.status(409).json({
                        message: 'Já existe outro fornecedor com este CNPJ'
                    });
                }
            }

            // Atualizar fornecedor
            const consultaAtualizacao = `
                UPDATE fornecedores 
                SET 
                    nome = $1,
                    cnpj = $2,
                    contato = $3,
                    email = $4,
                    telefone = $5,
                    endereco = $6,
                    atualizado_por = $7,
                    atualizado_em = CURRENT_TIMESTAMP
                WHERE id = $8 AND ativo = true
                RETURNING 
                    id, nome, cnpj, contato, email, telefone, endereco, ativo,
                    criado_em, atualizado_em,
                    criado_por, atualizado_por
            `;

            const fornecedorAtualizado = await query(consultaAtualizacao, [
                nome.trim(),
                cnpj?.trim() || '',
                contato?.trim() || '',
                email?.trim() || '',
                telefone?.trim() || '',
                endereco?.trim() || '',
                usuarioId,
                id
            ]);

            res.json({
                message: 'Fornecedor atualizado com sucesso',
                fornecedor: fornecedorAtualizado.rows[0]
            });

        } catch (error) {
            next(error);
        }
    },

    /**
     * Excluir fornecedor (soft delete)
     */
    async excluir(req, res, next) {
        try {
            const { id } = req.params;
            const usuarioId = req.usuario.id;

            // Verificar se o fornecedor existe
            const consultaExistencia = `
                SELECT id FROM fornecedores 
                WHERE id = $1 AND ativo = true
            `;

            const fornecedorExiste = await query(consultaExistencia, [id]);

            if (fornecedorExiste.rows.length === 0) {
                return res.status(404).json({
                    message: 'Fornecedor não encontrado'
                });
            }

            // Verificar se há ativos usando este fornecedor
            const consultaAtivos = `
                SELECT id FROM ativos 
                WHERE fornecedor_id = $1 AND ativo = true
                LIMIT 1
            `;

            const ativosVinculados = await query(consultaAtivos, [id]);

            if (ativosVinculados.rows.length > 0) {
                return res.status(409).json({
                    message: 'Este fornecedor está vinculado a ativos e não pode ser excluído'
                });
            }

            // Soft delete do fornecedor
            const consultaExclusao = `
                UPDATE fornecedores 
                SET 
                    ativo = false,
                    atualizado_por = $1,
                    atualizado_em = CURRENT_TIMESTAMP
                WHERE id = $2
            `;

            await query(consultaExclusao, [usuarioId, id]);

            res.json({
                message: 'Fornecedor excluído com sucesso'
            });

        } catch (error) {
            next(error);
        }
    }
};

module.exports = fornecedoresController;