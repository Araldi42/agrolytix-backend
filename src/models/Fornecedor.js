// ===================================================================
// models/Fornecedor.js
// ===================================================================

const { query } = require('../config/database');
const BaseModel = require('./BaseModel');

class Fornecedor extends BaseModel {
    constructor() {
        super('fornecedores');
    }

    /**
     * Lista fornecedores da empresa do usuário logado
     */
    static async listarPorEmpresa(empresaId, filtros = {}) {
        try {
            let whereConditions = ['f.ativo = true'];
            let params = [];
            let paramCount = 0;

            // Filtro por empresa (obrigatório para não-admin sistema)
            if (empresaId) {
                paramCount++;
                whereConditions.push(`(f.empresa_id = $${paramCount} OR f.empresa_id IS NULL)`);
                params.push(empresaId);
            }

            // Filtro por nome/razão social
            if (filtros.nome) {
                paramCount++;
                whereConditions.push(`(LOWER(f.nome) LIKE $${paramCount} OR LOWER(f.nome_fantasia) LIKE $${paramCount})`);
                params.push(`%${filtros.nome.toLowerCase()}%`);
            }

            // Filtro por tipo de pessoa
            if (filtros.tipo_pessoa) {
                paramCount++;
                whereConditions.push(`f.tipo_pessoa = $${paramCount}`);
                params.push(filtros.tipo_pessoa);
            }

            // Filtro por cidade
            if (filtros.cidade) {
                paramCount++;
                whereConditions.push(`LOWER(f.cidade) LIKE $${paramCount}`);
                params.push(`%${filtros.cidade.toLowerCase()}%`);
            }

            // Filtro por estado
            if (filtros.estado) {
                paramCount++;
                whereConditions.push(`f.estado = $${paramCount}`);
                params.push(filtros.estado);
            }

            const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

            const consulta = `
                SELECT 
                    f.id,
                    f.empresa_id,
                    f.tipo_pessoa,
                    f.nome,
                    f.nome_fantasia,
                    f.cnpj,
                    f.cpf,
                    f.inscricao_estadual,
                    f.contato,
                    f.email,
                    f.telefone,
                    f.whatsapp,
                    f.endereco,
                    f.cep,
                    f.cidade,
                    f.estado,
                    f.prazo_pagamento_padrao,
                    f.observacoes,
                    f.rating,
                    f.ativo,
                    f.criado_em,
                    f.atualizado_em,
                    uc.nome as criado_por_nome,
                    ua.nome as atualizado_por_nome,
                    e.nome_fantasia as empresa_nome,
                    -- Contagem de produtos oferecidos
                    COUNT(fp.id) as total_produtos
                FROM fornecedores f
                LEFT JOIN usuarios uc ON f.criado_por = uc.id
                LEFT JOIN usuarios ua ON f.atualizado_por = ua.id
                LEFT JOIN empresas e ON f.empresa_id = e.id
                LEFT JOIN fornecedor_produtos fp ON f.id = fp.fornecedor_id AND fp.ativo = true
                ${whereClause}
                GROUP BY f.id, uc.nome, ua.nome, e.nome_fantasia
                ORDER BY f.nome ASC
            `;

            const resultado = await query(consulta, params);
            return resultado.rows;
        } catch (error) {
            console.error('Erro ao listar fornecedores:', error);
            throw error;
        }
    }

    /**
     * Busca fornecedor por ID
     */
    static async buscarPorId(id, empresaId = null) {
        try {
            let whereCondition = 'f.id = $1 AND f.ativo = true';
            let params = [id];

            // Se não for admin sistema, filtrar por empresa
            if (empresaId) {
                whereCondition += ' AND (f.empresa_id = $2 OR f.empresa_id IS NULL)';
                params.push(empresaId);
            }

            const consulta = `
                SELECT 
                    f.*,
                    uc.nome as criado_por_nome,
                    ua.nome as atualizado_por_nome,
                    e.nome_fantasia as empresa_nome
                FROM fornecedores f
                LEFT JOIN usuarios uc ON f.criado_por = uc.id
                LEFT JOIN usuarios ua ON f.atualizado_por = ua.id
                LEFT JOIN empresas e ON f.empresa_id = e.id
                WHERE ${whereCondition}
            `;

            const resultado = await query(consulta, params);
            return resultado.rows[0] || null;
        } catch (error) {
            console.error('Erro ao buscar fornecedor:', error);
            throw error;
        }
    }

    /**
     * Criar novo fornecedor
     */
    static async criar(dadosFornecedor, usuarioId) {
        try {
            const {
                empresa_id,
                tipo_pessoa,
                nome,
                nome_fantasia,
                cnpj,
                cpf,
                inscricao_estadual,
                contato,
                email,
                telefone,
                whatsapp,
                endereco,
                cep,
                cidade,
                estado,
                prazo_pagamento_padrao,
                observacoes,
                rating
            } = dadosFornecedor;

            const consulta = `
                INSERT INTO fornecedores (
                    empresa_id, tipo_pessoa, nome, nome_fantasia, cnpj, cpf,
                    inscricao_estadual, contato, email, telefone, whatsapp,
                    endereco, cep, cidade, estado, prazo_pagamento_padrao,
                    observacoes, rating, criado_por
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
                ) RETURNING id
            `;

            const params = [
                empresa_id, tipo_pessoa, nome, nome_fantasia, cnpj, cpf,
                inscricao_estadual, contato, email, telefone, whatsapp,
                endereco, cep, cidade, estado, prazo_pagamento_padrao,
                observacoes, rating, usuarioId
            ];

            const resultado = await query(consulta, params);
            return resultado.rows[0];
        } catch (error) {
            console.error('Erro ao criar fornecedor:', error);
            throw error;
        }
    }

    /**
     * Atualizar fornecedor
     */
    static async atualizar(id, dadosFornecedor, usuarioId, empresaId = null) {
        try {
            const {
                tipo_pessoa,
                nome,
                nome_fantasia,
                cnpj,
                cpf,
                inscricao_estadual,
                contato,
                email,
                telefone,
                whatsapp,
                endereco,
                cep,
                cidade,
                estado,
                prazo_pagamento_padrao,
                observacoes,
                rating
            } = dadosFornecedor;

            let whereCondition = 'id = $1 AND ativo = true';
            let params = [
                id, tipo_pessoa, nome, nome_fantasia, cnpj, cpf,
                inscricao_estadual, contato, email, telefone, whatsapp,
                endereco, cep, cidade, estado, prazo_pagamento_padrao,
                observacoes, rating, usuarioId
            ];

            // Se não for admin sistema, verificar empresa
            if (empresaId) {
                whereCondition += ' AND (empresa_id = $20 OR empresa_id IS NULL)';
                params.push(empresaId);
            }

            const consulta = `
                UPDATE fornecedores SET
                    tipo_pessoa = $2,
                    nome = $3,
                    nome_fantasia = $4,
                    cnpj = $5,
                    cpf = $6,
                    inscricao_estadual = $7,
                    contato = $8,
                    email = $9,
                    telefone = $10,
                    whatsapp = $11,
                    endereco = $12,
                    cep = $13,
                    cidade = $14,
                    estado = $15,
                    prazo_pagamento_padrao = $16,
                    observacoes = $17,
                    rating = $18,
                    atualizado_por = $19,
                    atualizado_em = CURRENT_TIMESTAMP
                WHERE ${whereCondition}
                RETURNING id
            `;

            const resultado = await query(consulta, params);
            return resultado.rows[0] || null;
        } catch (error) {
            console.error('Erro ao atualizar fornecedor:', error);
            throw error;
        }
    }

    /**
     * Excluir fornecedor (soft delete)
     */
    static async excluir(id, usuarioId, empresaId = null) {
        try {
            let whereCondition = 'id = $1 AND ativo = true';
            let params = [id, usuarioId];

            // Se não for admin sistema, verificar empresa
            if (empresaId) {
                whereCondition += ' AND (empresa_id = $3 OR empresa_id IS NULL)';
                params.push(empresaId);
            }

            const consulta = `
                UPDATE fornecedores SET
                    ativo = false,
                    atualizado_por = $2,
                    atualizado_em = CURRENT_TIMESTAMP
                WHERE ${whereCondition}
                RETURNING id
            `;

            const resultado = await query(consulta, params);
            return resultado.rows[0] || null;
        } catch (error) {
            console.error('Erro ao excluir fornecedor:', error);
            throw error;
        }
    }

    /**
     * Verificar se CNPJ/CPF já existe
     */
    static async verificarDocumento(documento, empresaId = null, fornecedorId = null) {
        try {
            let whereConditions = ['ativo = true'];
            let params = [documento];
            let paramCount = 1;

            whereConditions.push(`(cnpj = $1 OR cpf = $1)`);

            // Se fornecedorId for fornecido, excluir da verificação (para edição)
            if (fornecedorId) {
                paramCount++;
                whereConditions.push(`id != $${paramCount}`);
                params.push(fornecedorId);
            }

            // Verificar na empresa específica
            if (empresaId) {
                paramCount++;
                whereConditions.push(`(empresa_id = $${paramCount} OR empresa_id IS NULL)`);
                params.push(empresaId);
            }

            const whereClause = whereConditions.join(' AND ');

            const consulta = `
                SELECT id, nome, cnpj, cpf 
                FROM fornecedores 
                WHERE ${whereClause}
                LIMIT 1
            `;

            const resultado = await query(consulta, params);
            return resultado.rows[0] || null;
        } catch (error) {
            console.error('Erro ao verificar documento:', error);
            throw error;
        }
    }

    /**
     * Listar produtos oferecidos pelo fornecedor
     */
    static async listarProdutos(fornecedorId, empresaId = null) {
        try {
            let whereCondition = 'fp.fornecedor_id = $1 AND fp.ativo = true';
            let params = [fornecedorId];

            if (empresaId) {
                whereCondition += ' AND f.empresa_id = $2';
                params.push(empresaId);
            }

            const consulta = `
                SELECT 
                    fp.id,
                    fp.preco_unitario,
                    fp.prazo_entrega_dias,
                    t.nome as tipo_nome,
                    c.nome as categoria_nome,
                    um.nome as unidade_nome,
                    um.sigla as unidade_sigla
                FROM fornecedor_produtos fp
                INNER JOIN fornecedores f ON fp.fornecedor_id = f.id
                INNER JOIN tipos t ON fp.tipo_id = t.id
                INNER JOIN categorias c ON t.categoria_id = c.id
                LEFT JOIN unidades_medida um ON fp.unidade_medida_id = um.id
                WHERE ${whereCondition}
                ORDER BY c.nome, t.nome
            `;

            const resultado = await query(consulta, params);
            return resultado.rows;
        } catch (error) {
            console.error('Erro ao listar produtos do fornecedor:', error);
            throw error;
        }
    }
}

module.exports = Fornecedor;