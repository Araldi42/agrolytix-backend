/**
 * Serviço de Validações Específicas do Domínio Agrolytix - COMPLETO
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

        return erros;
    }

    /**
     * Validar período de datas
     */
    static validarPeriodo(dataInicio, dataFim) {
        const erros = [];

        if (!dataInicio) {
            erros.push('Data de início é obrigatória');
        }

        if (!dataFim) {
            erros.push('Data de fim é obrigatória');
        }

        if (dataInicio && dataFim) {
            const inicio = new Date(dataInicio);
            const fim = new Date(dataFim);

            if (fim <= inicio) {
                erros.push('Data de fim deve ser posterior à data de início');
            }

            // Verificar se o período não é muito grande (ex: máximo 1 ano)
            const umAno = 365 * 24 * 60 * 60 * 1000; // 1 ano em millisegundos
            if (fim - inicio > umAno) {
                erros.push('Período não pode ser superior a 1 ano');
            }
        }

        return erros;
    }

    /**
     * Verificar se código já existe (genérico)
     */
    static async verificarCodigoExistente(tabela, campo, codigo, empresaId = null, excluirId = null) {
        let consulta = `SELECT id FROM ${tabela} WHERE ${campo} = $1 AND ativo = true`;
        const parametros = [codigo];
        let paramIndex = 2;

        if (empresaId) {
            consulta += ` AND empresa_id = ${paramIndex}`;
            parametros.push(empresaId);
            paramIndex++;
        }

        if (excluirId) {
            consulta += ` AND id != ${paramIndex}`;
            parametros.push(excluirId);
        }

        const resultado = await query(consulta, parametros);
        return resultado.rows.length > 0;
    }

    /**
     * Validar upload de arquivo
     */
    static validarUploadArquivo(arquivo, tiposPermitidos = [], tamanhoMaximo = 5 * 1024 * 1024) {
        const erros = [];

        if (!arquivo) {
            erros.push('Arquivo é obrigatório');
            return erros;
        }

        // Verificar tipo de arquivo
        if (tiposPermitidos.length > 0) {
            const tipoArquivo = arquivo.mimetype || arquivo.type;
            if (!tiposPermitidos.includes(tipoArquivo)) {
                erros.push(`Tipo de arquivo não permitido. Permitidos: ${tiposPermitidos.join(', ')}`);
            }
        }

        // Verificar tamanho
        const tamanho = arquivo.size || arquivo.length;
        if (tamanho > tamanhoMaximo) {
            const tamanhoMB = (tamanhoMaximo / (1024 * 1024)).toFixed(2);
            erros.push(`Arquivo muito grande. Tamanho máximo: ${tamanhoMB}MB`);
        }

        // Verificar nome do arquivo
        if (arquivo.originalname || arquivo.name) {
            const nome = arquivo.originalname || arquivo.name;
            if (nome.length > 255) {
                erros.push('Nome do arquivo muito longo');
            }

            // Verificar caracteres perigosos
            if (/[<>:"/\\|?*]/.test(nome)) {
                erros.push('Nome do arquivo contém caracteres inválidos');
            }
        }

        return erros;
    }

    /**
     * Validar dados de manutenção
     */
    static validarManutencao(dados) {
        const erros = [];

        if (!dados.produto_id) {
            erros.push('Produto é obrigatório');
        }

        if (!dados.data_manutencao) {
            erros.push('Data da manutenção é obrigatória');
        }

        if (!dados.descricao_servico?.trim()) {
            erros.push('Descrição do serviço é obrigatória');
        }

        const tiposValidos = ['preventiva', 'corretiva', 'periodica'];
        if (dados.tipo_manutencao && !tiposValidos.includes(dados.tipo_manutencao)) {
            erros.push('Tipo de manutenção inválido');
        }

        if (dados.custo_total && dados.custo_total < 0) {
            erros.push('Custo total não pode ser negativo');
        }

        if (dados.horas_equipamento && dados.horas_equipamento < 0) {
            erros.push('Horas do equipamento não podem ser negativas');
        }

        if (dados.km_equipamento && dados.km_equipamento < 0) {
            erros.push('Quilometragem do equipamento não pode ser negativa');
        }

        return erros;
    }

    /**
     * Verificar se produto está em uso (tem movimentações ou estoque)
     */
    static async verificarProdutoEmUso(produtoId) {
        const consultas = [
            // Verificar movimentações
            `SELECT COUNT(*) as total FROM movimentacao_itens WHERE produto_id = $1`,
            // Verificar estoque atual
            `SELECT COALESCE(SUM(quantidade_atual), 0) as total FROM estoque WHERE produto_id = $1`
        ];

        for (const consulta of consultas) {
            const resultado = await query(consulta, [produtoId]);
            if (parseFloat(resultado.rows[0].total) > 0) {
                return true;
            }
        }

        return false;
    }

    /**
     * Verificar se fornecedor está em uso
     */
    static async verificarFornecedorEmUso(fornecedorId) {
        const consultas = [
            `SELECT COUNT(*) as total FROM produtos WHERE fornecedor_id = $1 AND ativo = true`,
            `SELECT COUNT(*) as total FROM movimentacoes WHERE fornecedor_id = $1 AND ativo = true`
        ];

        for (const consulta of consultas) {
            const resultado = await query(consulta, [fornecedorId]);
            if (parseInt(resultado.rows[0].total) > 0) {
                return true;
            }
        }

        return false;
    }

    /**
     * Validar permissão de exclusão
     */
    static async verificarPermissaoExclusao(usuarioId, entidade, entidadeId) {
        // Admin sistema pode excluir qualquer coisa
        const usuario = await query(`
            SELECT nivel_hierarquia FROM usuarios u
            INNER JOIN perfis_usuario p ON u.perfil_id = p.id
            WHERE u.id = $1 AND u.ativo = true
        `, [usuarioId]);

        if (usuario.rows.length === 0) {
            return false;
        }

        if (usuario.rows[0].nivel_hierarquia === 1) {
            return true;
        }

        // Para outras entidades, verificar regras específicas
        switch (entidade) {
            case 'produto':
                return !(await this.verificarProdutoEmUso(entidadeId));
            case 'fornecedor':
                return !(await this.verificarFornecedorEmUso(entidadeId));
            default:
                return true;
        }
    }

    /**
     * Sanitizar dados de entrada
     */
    static sanitizarDados(dados, camposTexto = []) {
        const dadosSanitizados = { ...dados };

        camposTexto.forEach(campo => {
            if (dadosSanitizados[campo] && typeof dadosSanitizados[campo] === 'string') {
                dadosSanitizados[campo] = dadosSanitizados[campo]
                    .trim()
                    .replace(/[<>\"']/g, '') // Remove caracteres perigosos
                    .substring(0, 1000); // Limita tamanho
            }
        });

        return dadosSanitizados;
    }

    /**
     * Validar paginação
     */
    static validarPaginacao(page, limit) {
        const erros = [];

        const pagina = parseInt(page);
        const limite = parseInt(limit);

        if (isNaN(pagina) || pagina < 1) {
            erros.push('Página deve ser um número maior que 0');
        }

        if (isNaN(limite) || limite < 1 || limite > 1000) {
            erros.push('Limite deve ser um número entre 1 e 1000');
        }

        return erros;
    }

    /**
     * Verificar se usuário pode acessar empresa
     */
    static async verificarAcessoEmpresa(usuarioId, empresaId) {
        const consulta = `
            SELECT u.id FROM usuarios u
            INNER JOIN perfis_usuario p ON u.perfil_id = p.id
            WHERE u.id = $1 AND u.ativo = true
            AND (u.empresa_id = $2 OR p.nivel_hierarquia = 1)
        `;

        const resultado = await query(consulta, [usuarioId, empresaId]);
        return resultado.rows.length > 0;
    }

    /**
     * Validar dados de relatório
     */
    static validarRelatorio(dados) {
        const erros = [];

        if (dados.data_inicio && dados.data_fim) {
            const periodErros = this.validarPeriodo(dados.data_inicio, dados.data_fim);
            erros.push(...periodErros);
        }

        const formatosValidos = ['json', 'csv', 'pdf', 'excel'];
        if (dados.formato && !formatosValidos.includes(dados.formato)) {
            erros.push(`Formato inválido. Válidos: ${formatosValidos.join(', ')}`);
        }

        return erros;
    }

    /**
     * Verificar integridade referencial antes de exclusão
     */
    static async verificarIntegridadeReferencial(tabela, id) {
        const dependencias = {
            empresas: ['fazendas', 'usuarios', 'produtos'],
            fazendas: ['setores', 'produtos', 'safras'],
            setores: ['estoque'],
            produtos: ['estoque', 'movimentacao_itens', 'lotes'],
            fornecedores: ['produtos', 'movimentacoes'],
            categorias: ['tipos'],
            tipos: ['produtos']
        };

        if (!dependencias[tabela]) {
            return []; // Sem dependências conhecidas
        }

        const violacoes = [];

        for (const tabelaDependente of dependencias[tabela]) {
            let campoChave = `${tabela.slice(0, -1)}_id`; // Remove 's' e adiciona '_id'

            // Casos especiais
            if (tabela === 'empresas' && tabelaDependente === 'produtos') {
                campoChave = 'empresa_id';
            }

            const consulta = `
                SELECT COUNT(*) as total FROM ${tabelaDependente} 
                WHERE ${campoChave} = $1 AND ativo = true
            `;

            try {
                const resultado = await query(consulta, [id]);
                const total = parseInt(resultado.rows[0].total);

                if (total > 0) {
                    violacoes.push({
                        tabela: tabelaDependente,
                        registros: total
                    });
                }
            } catch (error) {
                // Tabela ou campo pode não existir - ignorar
                continue;
            }
        }

        return violacoes;
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
     * Valida dados de fazenda
     */
    static validarFazenda(dados) {
        const erros = [];

        if (!dados.nome?.trim()) {
            erros.push('Nome da fazenda é obrigatório');
        }

        if (!dados.empresa_id) {
            erros.push('Empresa é obrigatória');
        }

        if (dados.area_total_hectares && dados.area_total_hectares <= 0) {
            erros.push('Área total deve ser maior que zero');
        }

        if (dados.cep && !/^\d{5}-?\d{3}$/.test(dados.cep)) {
            erros.push('CEP inválido');
        }

        return erros;
    }

    /**
     * Valida dados de setor
     */
    static validarSetor(dados) {
        const erros = [];

        if (!dados.nome?.trim()) {
            erros.push('Nome do setor é obrigatório');
        }

        if (!dados.fazenda_id) {
            erros.push('Fazenda é obrigatória');
        }

        if (dados.capacidade_maxima && dados.capacidade_maxima <= 0) {
            erros.push('Capacidade máxima deve ser maior que zero');
        }

        const tiposValidos = ['deposito', 'galpao', 'campo', 'silo', 'estacao', 'oficina'];
        if (dados.tipo && !tiposValidos.includes(dados.tipo)) {
            erros.push('Tipo de setor inválido');
        }

        return erros;
    }

    /**
     * Verificar se CNPJ já existe
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
     * Verificar se CPF já existe
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
     * Verificar se email já existe (usuários)
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
     * Verificar se login já existe (usuários)
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
     * Verificar se usuário tem permissão para a fazenda
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
     * Verificar se produto pertence à empresa
     */
    static async verificarProdutoEmpresa(produtoId, empresaId) {
        const consulta = `
            SELECT id FROM produtos 
            WHERE id = $1 AND empresa_id = $2 AND ativo = true
        `;

        const resultado = await query(consulta, [produtoId, empresaId]);
        return resultado.rows.length > 0;
    }

    /**
     * Verificar se setor pertence à empresa
     */
    static async verificarSetorEmpresa(setorId, empresaId) {
        const consulta = `
            SELECT s.id FROM setores s
            INNER JOIN fazendas f ON s.fazenda_id = f.id
            WHERE s.id = $1 AND f.empresa_id = $2 AND s.ativo = true
        `;

        const resultado = await query(consulta, [setorId, empresaId]);
        return resultado.rows.length > 0;
    }

    /**
     * Verificar se fazenda pertence à empresa
     */
    static async verificarFazendaEmpresa(fazendaId, empresaId) {
        const consulta = `
            SELECT id FROM fazendas 
            WHERE id = $1 AND empresa_id = $2 AND ativo = true
        `;

        const resultado = await query(consulta, [fazendaId, empresaId]);
        return resultado.rows.length > 0;
    }

    /**
     * Verificar se há estoque suficiente para movimentação de saída
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
     * Verificar se número de lote já existe para o produto
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

    /**
     * Verificar se tipo de movimentação existe e está ativo
     */
    static async verificarTipoMovimentacao(tipoId) {
        const consulta = `
            SELECT id, operacao, nome FROM tipos_movimentacao 
            WHERE id = $1 AND ativo = true
        `;

        const resultado = await query(consulta, [tipoId]);
        return resultado.rows.length > 0 ? resultado.rows[0] : null;
    }

    /**
     * Verificar se categoria existe e está ativa
     */
    static async verificarCategoriaExistente(categoriaId, empresaId = null) {
        let consulta = `
            SELECT id FROM categorias 
            WHERE id = $1 AND ativo = true
        `;
        const parametros = [categoriaId];

        if (empresaId) {
            consulta += ` AND (empresa_id = $2 OR empresa_id IS NULL)`;
            parametros.push(empresaId);
        }

        const resultado = await query(consulta, parametros);
        return resultado.rows.length > 0;
    }

    /**
     * Verificar se tipo existe e está ativo
     */
    static async verificarTipoExistente(tipoId, empresaId = null) {
        let consulta = `
            SELECT t.id FROM tipos t
            LEFT JOIN categorias c ON t.categoria_id = c.id
            WHERE t.id = $1 AND t.ativo = true AND c.ativo = true
        `;
        const parametros = [tipoId];

        if (empresaId) {
            consulta += ` AND (t.empresa_id = $2 OR t.empresa_id IS NULL)`;
            parametros.push(empresaId);
        }

        const resultado = await query(consulta, parametros);
        return resultado.rows.length > 0;
    }

    /**
     * Verificar se fornecedor existe e está ativo
     */
    static async verificarFornecedorExistente(fornecedorId, empresaId = null) {
        let consulta = `
            SELECT id FROM fornecedores 
            WHERE id = $1 AND ativo = true
        `;
        const parametros = [fornecedorId];

        if (empresaId) {
            consulta += ` AND (empresa_id = $2 OR empresa_id IS NULL)`;
            parametros.push(empresaId);
        }

        const resultado = await query(consulta, parametros);
        return resultado.rows.length > 0;
    }

    /**
     * Validar permissões do usuário para operação
     */
    static async verificarPermissaoOperacao(usuarioId, operacao, modulo = null) {
        const consulta = `
            SELECT u.id, p.permissoes, p.nivel_hierarquia
            FROM usuarios u
            INNER JOIN perfis_usuario p ON u.perfil_id = p.id
            WHERE u.id = $1 AND u.ativo = true AND p.ativo = true
        `;

        const resultado = await query(consulta, [usuarioId]);

        if (resultado.rows.length === 0) {
            return false;
        }

        const usuario = resultado.rows[0];

        // Admin sistema tem acesso total
        if (usuario.nivel_hierarquia === 1) {
            return true;
        }

        // Verificar permissões específicas
        const permissoes = usuario.permissoes || {};

        if (permissoes.all?.includes('*')) {
            return true;
        }

        if (modulo && permissoes[modulo]) {
            return permissoes[modulo].includes(operacao) || permissoes[modulo].includes('*');
        }

        return false;
    }

    /**
     * Validar dados de safra
     */
    static validarSafra(dados) {
        const erros = [];

        if (!dados.nome?.trim()) {
            erros.push('Nome da safra é obrigatório');
        }

        if (!dados.fazenda_id) {
            erros.push('Fazenda é obrigatória');
        }

        if (!dados.cultura?.trim()) {
            erros.push('Cultura é obrigatória');
        }

        if (dados.area_hectares && dados.area_hectares <= 0) {
            erros.push('Área em hectares deve ser maior que zero');
        }

        if (dados.data_inicio && dados.data_fim) {
            if (new Date(dados.data_fim) <= new Date(dados.data_inicio)) {
                erros.push('Data de fim deve ser posterior à data de início');
            }
        }

        if (dados.producao_estimada && dados.producao_estimada < 0) {
            erros.push('Produção estimada não pode ser negativa');
        }

        return erros;
    }
}

module.exports = ValidationService; 
