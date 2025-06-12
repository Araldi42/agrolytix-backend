/**
 * Controller de Movimentações de Estoque
 * Gerencia todas as movimentações de entrada, saída, transferência e ajustes
 */

const BaseController = require('./baseController');
const ValidationService = require('../services/validationService');
const { query, getClient } = require('../config/database');

class MovimentacoesController extends BaseController {
    constructor() {
        super('movimentacoes', 'Movimentação');
    }

    /**
     * Listar movimentações com paginação e filtros
     */
    async listar(req, res, next) {
        try {
            const { pagina, limite, offset } = this.obterParametrosPaginacao(req.query);
            
            const filtros = [];
            const parametros = [];
            let paramIndex = 1;

            // Filtro obrigatório por empresa
            if (req.usuario.nivel_hierarquia > 1) {
                filtros.push(`m.empresa_id = $${paramIndex}`);
                parametros.push(req.usuario.empresa_id);
                paramIndex++;
            }

            // Filtros opcionais
            if (req.query.fazenda_id) {
                filtros.push(`m.fazenda_id = $${paramIndex}`);
                parametros.push(req.query.fazenda_id);
                paramIndex++;
            }

            if (req.query.data_inicio) {
                filtros.push(`m.data_movimentacao >= $${paramIndex}`);
                parametros.push(req.query.data_inicio);
                paramIndex++;
            }

            const whereClause = filtros.length > 0 ? `WHERE ${filtros.join(' AND ')}` : '';

            const consulta = `
                SELECT 
                    m.id, m.numero_documento, m.data_movimentacao,
                    m.valor_total, m.status, m.observacoes,
                    tm.nome as tipo_movimentacao, tm.operacao,
                    f.nome as fazenda_nome,
                    u.nome as usuario_nome
                FROM movimentacoes m
                INNER JOIN tipos_movimentacao tm ON m.tipo_movimentacao_id = tm.id
                INNER JOIN fazendas f ON m.fazenda_id = f.id
                LEFT JOIN usuarios u ON m.usuario_criacao = u.id
                ${whereClause}
                ORDER BY m.data_movimentacao DESC
                LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
            `;

            parametros.push(limite, offset);
            const resultado = await query(consulta, parametros);

            return this.sucessoResponse(res, resultado.rows);

        } catch (error) {
            console.error('Erro ao listar movimentações:', error);
            next(error);
        }
    }

    /**
     * Buscar movimentação por ID
     */
    async buscarPorId(req, res, next) {
        try {
            const { id } = req.params;

            const consulta = `
                SELECT 
                    m.*, 
                    tm.nome as tipo_movimentacao, tm.operacao,
                    f.nome as fazenda_nome,
                    u.nome as usuario_nome
                FROM movimentacoes m
                INNER JOIN tipos_movimentacao tm ON m.tipo_movimentacao_id = tm.id
                INNER JOIN fazendas f ON m.fazenda_id = f.id
                LEFT JOIN usuarios u ON m.usuario_criacao = u.id
                WHERE m.id = $1
            `;

            const resultado = await query(consulta, [id]);

            if (resultado.rows.length === 0) {
                return this.erroResponse(res, 'Movimentação não encontrada', 404);
            }

            return this.sucessoResponse(res, resultado.rows[0]);

        } catch (error) {
            console.error('Erro ao buscar movimentação:', error);
            next(error);
        }
    }

    /**
     * Criar nova movimentação
     */
    async criar(req, res, next) {
        try {
            const dados = req.body;

            // Validações básicas
            const erros = ValidationService.validarMovimentacao(dados);
            if (erros.length > 0) {
                return this.erroResponse(res, 'Dados inválidos', 400, erros);
            }

            // Definir empresa_id
            if (req.usuario.nivel_hierarquia > 1) {
                dados.empresa_id = req.usuario.empresa_id;
            }

            const consulta = `
                INSERT INTO movimentacoes (
                    empresa_id, fazenda_id, tipo_movimentacao_id,
                    numero_documento, data_movimentacao, origem_setor_id,
                    destino_setor_id, valor_total, observacoes,
                    status, usuario_criacao
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
                ) RETURNING id
            `;

            const parametros = [
                dados.empresa_id,
                dados.fazenda_id,
                dados.tipo_movimentacao_id,
                dados.numero_documento || null,
                dados.data_movimentacao || new Date(),
                dados.origem_setor_id || null,
                dados.destino_setor_id || null,
                dados.valor_total || 0,
                dados.observacoes || null,
                dados.status || 'confirmado',
                req.usuario.id
            ];

            const resultado = await query(consulta, parametros);
            const movimentacaoId = resultado.rows[0].id;

            const movimentacaoCriada = await this.buscarMovimentacaoCompleta(movimentacaoId);

            return this.sucessoResponse(res, movimentacaoCriada, 'Movimentação criada com sucesso', 201);

        } catch (error) {
            console.error('Erro ao criar movimentação:', error);
            next(error);
        }
    }

    /**
     * Buscar movimentação completa
     */
    async buscarMovimentacaoCompleta(id) {
        const consulta = `
            SELECT 
                m.*, 
                tm.nome as tipo_movimentacao,
                f.nome as fazenda_nome
            FROM movimentacoes m
            INNER JOIN tipos_movimentacao tm ON m.tipo_movimentacao_id = tm.id
            INNER JOIN fazendas f ON m.fazenda_id = f.id
            WHERE m.id = $1
        `;

        const resultado = await query(consulta, [id]);
        return resultado.rows[0];
    }
}

module.exports = new MovimentacoesController(); 