/**
 * Base Controller - Fornece funcionalidades comuns para todos os controllers
 * Implementa padrões de mercado para aplicações em produção
 */

const { query, getClient } = require('../config/database');
const { validarTextoNaoVazio, sanitizarTexto } = require('../utils/validacoes');

class BaseController {
    constructor(tableName, entityName) {
        this.tableName = tableName;
        this.entityName = entityName;
    }

    /**
     * Resposta padrão de sucesso
     */
    sucessoResponse(res, data = null, message = 'Operação realizada com sucesso', statusCode = 200) {
        return res.status(statusCode).json({
            sucesso: true,
            mensagem: message,
            dados: data,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Resposta padrão de erro
     */
    erroResponse(res, message = 'Erro interno do servidor', statusCode = 500, details = null) {
        return res.status(statusCode).json({
            sucesso: false,
            mensagem: message,
            detalhes: details,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Resposta paginada
     */
    respostaPaginada(res, dados, total, pagina, limite, message = 'Dados recuperados com sucesso') {
        const totalPaginas = Math.ceil(total / limite);
        
        return res.json({
            sucesso: true,
            mensagem: message,
            dados,
            paginacao: {
                pagina_atual: parseInt(pagina),
                total_registros: parseInt(total),
                registros_por_pagina: parseInt(limite),
                total_paginas: totalPaginas,
                tem_proxima: pagina < totalPaginas,
                tem_anterior: pagina > 1
            },
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Valida parâmetros obrigatórios
     */
    validarCamposObrigatorios(dados, camposObrigatorios) {
        const erros = [];
        
        for (const campo of camposObrigatorios) {
            if (!dados[campo] || (typeof dados[campo] === 'string' && !validarTextoNaoVazio(dados[campo]))) {
                erros.push(`Campo '${campo}' é obrigatório`);
            }
        }
        
        return erros;
    }

    /**
     * Sanitiza dados de entrada
     */
    sanitizarDados(dados, camposPermitidos = []) {
        const dadosSanitizados = {};
        
        // Filtrar apenas campos permitidos
        camposPermitidos.forEach(campo => {
            if (dados.hasOwnProperty(campo)) {
                let valor = dados[campo];
                
                // Sanitizar strings
                if (typeof valor === 'string') {
                    valor = sanitizarTexto(valor);
                    // Converter strings vazias para null em campos específicos
                    if (valor === '' && (campo.includes('_id') || campo === 'categoria_pai_id')) {
                        valor = null;
                    }
                }
                
                dadosSanitizados[campo] = valor;
            }
        });
        
        return dadosSanitizados;
    }

    /**
     * Constrói parâmetros de paginação
     */
    obterParametrosPaginacao(query) {
        const pagina = Math.max(1, parseInt(query.pagina) || 1);
        const limite = Math.min(100, Math.max(1, parseInt(query.limite) || 20));
        const offset = (pagina - 1) * limite;
        
        return { pagina, limite, offset };
    }

    /**
     * Constrói filtros de busca
     */
    construirFiltrosBusca(query, camposPermitidos = []) {
        const filtros = [];
        const parametros = [];
        let parametroIndex = 1;

        // Filtro de texto geral
        if (query.busca && camposPermitidos.length > 0) {
            const condicoesBusca = camposPermitidos.map(() => `LOWER(${campo}) LIKE LOWER($${parametroIndex})`);
            filtros.push(`(${condicoesBusca.join(' OR ')})`);
            parametros.push(`%${query.busca}%`);
            parametroIndex++;
        }

        // Status ativo/inativo
        if (query.status) {
            filtros.push(`ativo = $${parametroIndex}`);
            parametros.push(query.status === 'true');
            parametroIndex++;
        }

        return { filtros, parametros, parametroIndex };
    }

    /**
     * Verifica se entidade existe e está ativa
     */
    async verificarExistencia(id, empresaId = null) {
        let consulta = `SELECT id FROM ${this.tableName} WHERE id = $1 AND ativo = true`;
        const parametros = [id];

        if (empresaId !== null) {
            consulta += ` AND empresa_id = $2`;
            parametros.push(empresaId);
        }

        const resultado = await query(consulta, parametros);
        return resultado.rows.length > 0;
    }

    /**
     * Verifica permissões do usuário para a empresa
     */
    async verificarPermissaoEmpresa(usuarioId, empresaId) {
        const consulta = `
            SELECT u.id 
            FROM usuarios u 
            WHERE u.id = $1 
            AND (u.empresa_id = $2 OR u.empresa_id IS NULL)
            AND u.ativo = true
        `;
        
        const resultado = await query(consulta, [usuarioId, empresaId]);
        return resultado.rows.length > 0;
    }

    /**
     * Log de auditoria
     */
    async logarAuditoria(usuarioId, acao, tabelaAfetada, registroId, dadosAnteriores = null, dadosNovos = null) {
        try {
            const consulta = `
                INSERT INTO auditoria (
                    usuario_id, acao, tabela_afetada, registro_id, 
                    dados_anteriores, dados_novos, timestamp
                ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
            `;
            
            await query(consulta, [
                usuarioId,
                acao,
                tabelaAfetada,
                registroId,
                dadosAnteriores ? JSON.stringify(dadosAnteriores) : null,
                dadosNovos ? JSON.stringify(dadosNovos) : null
            ]);
        } catch (error) {
            console.error('Erro ao registrar auditoria:', error);
        }
    }

    /**
     * Executa operação em transação
     */
    async executarTransacao(operacoes) {
        const client = await getClient();
        
        try {
            await client.query('BEGIN');
            
            const resultados = [];
            for (const operacao of operacoes) {
                const resultado = await client.query(operacao.sql, operacao.parametros);
                resultados.push(resultado);
            }
            
            await client.query('COMMIT');
            return resultados;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }
}

module.exports = BaseController; 