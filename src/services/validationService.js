/**
 * Serviço de Validações Específicas do Domínio Agrolytix
 * Centraliza todas as validações complexas de negócio
 */

const { query } = require('../config/database');
const { validarCNPJ, validarCPF, validarEmail } = require('../utils/validacoes');

class ValidationService {
    
    /**
     * Valida dados de empresa
     */
    static validarEmpresa(dados) {
        const erros = [];

        if (!dados.razao_social?.trim()) {
            erros.push('Razão social é obrigatória');
        }

        if (dados.cnpj && !validarCNPJ(dados.cnpj)) {
            erros.push('CNPJ inválido');
        }

        if (dados.email && !validarEmail(dados.email)) {
            erros.push('Email inválido');
        }

        if (dados.area_total_hectares && dados.area_total_hectares < 0) {
            erros.push('Área total não pode ser negativa');
        }

        return erros;
    }

    /**
     * Valida dados de usuário
     */
    static validarUsuario(dados) {
        const erros = [];

        if (!dados.nome?.trim()) {
            erros.push('Nome é obrigatório');
        }

        if (!dados.login?.trim()) {
            erros.push('Login é obrigatório');
        } else if (dados.login.length < 3) {
            erros.push('Login deve ter pelo menos 3 caracteres');
        }

        if (!dados.email?.trim()) {
            erros.push('Email é obrigatório');
        } else if (!validarEmail(dados.email)) {
            erros.push('Email inválido');
        }

        if (dados.cpf && !validarCPF(dados.cpf)) {
            erros.push('CPF inválido');
        }

        if (dados.senha && dados.senha.length < 6) {
            erros.push('Senha deve ter pelo menos 6 caracteres');
        }

        return erros;
    }

    /**
     * Valida dados de produto
     */
    static validarProduto(dados) {
        const erros = [];

        if (!dados.nome?.trim()) {
            erros.push('Nome do produto é obrigatório');
        }

        if (!dados.tipo_id) {
            erros.push('Tipo do produto é obrigatório');
        }

        if (!dados.empresa_id) {
            erros.push('Empresa é obrigatória');
        }

        if (!dados.fazenda_id) {
            erros.push('Fazenda é obrigatória');
        }

        if (dados.valor_aquisicao && dados.valor_aquisicao < 0) {
            erros.push('Valor de aquisição não pode ser negativo');
        }

        if (dados.ano_fabricacao) {
            const anoAtual = new Date().getFullYear();
            if (dados.ano_fabricacao < 1900 || dados.ano_fabricacao > anoAtual + 1) {
                erros.push('Ano de fabricação inválido');
            }
        }

        return erros;
    }

    /**
     * Valida dados de movimentação
     */
    static validarMovimentacao(dados) {
        const erros = [];

        if (!dados.empresa_id) {
            erros.push('Empresa é obrigatória');
        }

        if (!dados.fazenda_id) {
            erros.push('Fazenda é obrigatória');
        }

        if (!dados.tipo_movimentacao_id) {
            erros.push('Tipo de movimentação é obrigatório');
        }

        if (!dados.data_movimentacao) {
            erros.push('Data da movimentação é obrigatória');
        }

        if (dados.valor_total && dados.valor_total < 0) {
            erros.push('Valor total não pode ser negativo');
        }

        return erros;
    }

    /**
     * Valida item de movimentação
     */
    static validarItemMovimentacao(dados) {
        const erros = [];

        if (!dados.produto_id) {
            erros.push('Produto é obrigatório');
        }

        if (!dados.quantidade || dados.quantidade <= 0) {
            erros.push('Quantidade deve ser maior que zero');
        }

        if (dados.valor_unitario && dados.valor_unitario < 0) {
            erros.push('Valor unitário não pode ser negativo');
        }

        return erros;
    }

    /**
     * Valida dados de fornecedor
     */
    static validarFornecedor(dados) {
        const erros = [];

        if (!dados.nome?.trim()) {
            erros.push('Nome do fornecedor é obrigatório');
        }

        if (dados.tipo_pessoa === 'juridica' && dados.cnpj && !validarCNPJ(dados.cnpj)) {
            erros.push('CNPJ inválido');
        }

        if (dados.tipo_pessoa === 'fisica' && dados.cpf && !validarCPF(dados.cpf)) {
            erros.push('CPF inválido');
        }

        if (dados.email && !validarEmail(dados.email)) {
            erros.push('Email inválido');
        }

        if (dados.prazo_pagamento_padrao && dados.prazo_pagamento_padrao < 0) {
            erros.push('Prazo de pagamento não pode ser negativo');
        }

        if (dados.rating && (dados.rating < 0 || dados.rating > 5)) {
            erros.push('Rating deve estar entre 0 e 5');
        }

        return erros;
    }

    /**
     * Verifica se CNPJ já existe
     */
    static async verificarCNPJExistente(cnpj, empresaId = null, excluirId = null) {
        if (!cnpj) return false;

        let consulta = `
            SELECT id FROM fornecedores 
            WHERE cnpj = $1 AND ativo = true
        `;
        const parametros = [cnpj];
        let paramIndex = 2;

        if (empresaId) {
            consulta += ` AND (empresa_id = $${paramIndex} OR empresa_id IS NULL)`;
            parametros.push(empresaId);
            paramIndex++;
        }

        if (excluirId) {
            consulta += ` AND id != $${paramIndex}`;
            parametros.push(excluirId);
        }

        const resultado = await query(consulta, parametros);
        return resultado.rows.length > 0;
    }

    /**
     * Verifica se CPF já existe
     */
    static async verificarCPFExistente(cpf, empresaId = null, excluirId = null) {
        if (!cpf) return false;

        let consulta = `
            SELECT id FROM fornecedores 
            WHERE cpf = $1 AND ativo = true
        `;
        const parametros = [cpf];
        let paramIndex = 2;

        if (empresaId) {
            consulta += ` AND (empresa_id = $${paramIndex} OR empresa_id IS NULL)`;
            parametros.push(empresaId);
            paramIndex++;
        }

        if (excluirId) {
            consulta += ` AND id != $${paramIndex}`;
            parametros.push(excluirId);
        }

        const resultado = await query(consulta, parametros);
        return resultado.rows.length > 0;
    }

    /**
     * Verifica se email já existe (usuários)
     */
    static async verificarEmailUsuarioExistente(email, excluirId = null) {
        let consulta = `SELECT id FROM usuarios WHERE email = $1 AND ativo = true`;
        const parametros = [email];

        if (excluirId) {
            consulta += ` AND id != $2`;
            parametros.push(excluirId);
        }

        const resultado = await query(consulta, parametros);
        return resultado.rows.length > 0;
    }

    /**
     * Verifica se login já existe (usuários)
     */
    static async verificarLoginExistente(login, excluirId = null) {
        let consulta = `SELECT id FROM usuarios WHERE login = $1 AND ativo = true`;
        const parametros = [login];

        if (excluirId) {
            consulta += ` AND id != $2`;
            parametros.push(excluirId);
        }

        const resultado = await query(consulta, parametros);
        return resultado.rows.length > 0;
    }

    /**
     * Verifica se usuário tem permissão para a fazenda
     */
    static async verificarPermissaoFazenda(usuarioId, fazendaId) {
        const consulta = `
            SELECT u.id 
            FROM usuarios u
            LEFT JOIN usuario_fazendas uf ON u.id = uf.usuario_id
            WHERE u.id = $1 AND u.ativo = true
            AND (
                u.empresa_id IS NULL OR
                uf.fazenda_id = $2 OR
                EXISTS (
                    SELECT 1 FROM fazendas f 
                    WHERE f.id = $2 AND f.empresa_id = u.empresa_id
                )
            )
        `;

        const resultado = await query(consulta, [usuarioId, fazendaId]);
        return resultado.rows.length > 0;
    }

    /**
     * Verifica se há estoque suficiente para movimentação de saída
     */
    static async verificarEstoqueSuficiente(produtoId, setorId, quantidade, loteId = null) {
        let consulta = `
            SELECT quantidade_disponivel 
            FROM estoque 
            WHERE produto_id = $1 AND setor_id = $2
        `;
        const parametros = [produtoId, setorId];

        if (loteId) {
            consulta += ` AND lote_id = $3`;
            parametros.push(loteId);
        } else {
            consulta += ` AND lote_id IS NULL`;
        }

        const resultado = await query(consulta, parametros);
        
        if (resultado.rows.length === 0) {
            return false;
        }

        return resultado.rows[0].quantidade_disponivel >= quantidade;
    }

    /**
     * Valida dados de lote
     */
    static validarLote(dados) {
        const erros = [];

        if (!dados.produto_id) {
            erros.push('Produto é obrigatório');
        }

        if (!dados.numero_lote?.trim()) {
            erros.push('Número do lote é obrigatório');
        }

        if (!dados.quantidade_inicial || dados.quantidade_inicial <= 0) {
            erros.push('Quantidade inicial deve ser maior que zero');
        }

        if (dados.data_vencimento && dados.data_fabricacao) {
            if (new Date(dados.data_vencimento) <= new Date(dados.data_fabricacao)) {
                erros.push('Data de vencimento deve ser posterior à data de fabricação');
            }
        }

        return erros;
    }

    /**
     * Verifica se número de lote já existe para o produto
     */
    static async verificarLoteExistente(produtoId, numeroLote, excluirId = null) {
        let consulta = `
            SELECT id FROM lotes 
            WHERE produto_id = $1 AND numero_lote = $2 AND ativo = true
        `;
        const parametros = [produtoId, numeroLote];

        if (excluirId) {
            consulta += ` AND id != $3`;
            parametros.push(excluirId);
        }

        const resultado = await query(consulta, parametros);
        return resultado.rows.length > 0;
    }
}

module.exports = ValidationService; 