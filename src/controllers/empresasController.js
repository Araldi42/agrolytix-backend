/**
 * Controller de Empresas
 * Gerencia as empresas do sistema SaaS multi-tenant
 */

const BaseController = require('./baseController');
const ValidationService = require('../services/validationService');
const { query } = require('../config/database');

class EmpresasController extends BaseController {
    constructor() {
        super('empresas', 'Empresa');
    }

    /**
     * Listar empresas (apenas para admin sistema)
     */
    async listar(req, res, next) {
        try {
            // Apenas admin sistema pode ver todas as empresas
            if (req.usuario.nivel_hierarquia > 1) {
                return this.erroResponse(res, 'Acesso negado', 403);
            }

            const { pagina, limite, offset } = this.obterParametrosPaginacao(req.query);
            
            const filtros = [];
            const parametros = [];
            let paramIndex = 1;

            // Filtro por status ativo
            if (req.query.ativo !== undefined) {
                filtros.push(`ativo = $${paramIndex}`);
                parametros.push(req.query.ativo === 'true');
                paramIndex++;
            } else {
                filtros.push('ativo = true');
            }

            // Busca por texto
            if (req.query.busca) {
                filtros.push(`(LOWER(razao_social) LIKE LOWER($${paramIndex}) OR LOWER(nome_fantasia) LIKE LOWER($${paramIndex}))`);
                parametros.push(`%${req.query.busca}%`);
                paramIndex++;
            }

            const whereClause = filtros.length > 0 ? `WHERE ${filtros.join(' AND ')}` : '';

            const consulta = `
                SELECT 
                    id, razao_social, nome_fantasia, cnpj,
                    email, telefone, cidade, estado,
                    plano_assinatura, data_vencimento_plano,
                    ativo, criado_em
                FROM empresas
                ${whereClause}
                ORDER BY razao_social
                LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
            `;

            parametros.push(limite, offset);
            const resultado = await query(consulta, parametros);

            return this.sucessoResponse(res, resultado.rows);

        } catch (error) {
            console.error('Erro ao listar empresas:', error);
            next(error);
        }
    }

    /**
     * Buscar empresa por ID
     */
    async buscarPorId(req, res, next) {
        try {
            const { id } = req.params;

            // Verificar permissão
            if (req.usuario.nivel_hierarquia > 1 && req.usuario.empresa_id !== parseInt(id)) {
                return this.erroResponse(res, 'Acesso negado', 403);
            }

            const consulta = `
                SELECT 
                    e.*,
                    COUNT(u.id) as total_usuarios,
                    COUNT(f.id) as total_fazendas
                FROM empresas e
                LEFT JOIN usuarios u ON e.id = u.empresa_id AND u.ativo = true
                LEFT JOIN fazendas f ON e.id = f.empresa_id AND f.ativo = true
                WHERE e.id = $1
                GROUP BY e.id
            `;

            const resultado = await query(consulta, [id]);

            if (resultado.rows.length === 0) {
                return this.erroResponse(res, 'Empresa não encontrada', 404);
            }

            return this.sucessoResponse(res, resultado.rows[0]);

        } catch (error) {
            console.error('Erro ao buscar empresa:', error);
            next(error);
        }
    }

    /**
     * Criar nova empresa (apenas admin sistema)
     */
    async criar(req, res, next) {
        try {
            // Apenas admin sistema pode criar empresas
            if (req.usuario.nivel_hierarquia > 1) {
                return this.erroResponse(res, 'Acesso negado', 403);
            }

            const dados = req.body;

            // Validações
            const erros = ValidationService.validarEmpresa(dados);
            if (erros.length > 0) {
                return this.erroResponse(res, 'Dados inválidos', 400, erros);
            }

            // Verificar se CNPJ já existe
            if (dados.cnpj) {
                const consultaCNPJ = `
                    SELECT id FROM empresas WHERE cnpj = $1 AND ativo = true
                `;
                const cnpjResult = await query(consultaCNPJ, [dados.cnpj]);
                
                if (cnpjResult.rows.length > 0) {
                    return this.erroResponse(res, 'CNPJ já cadastrado', 409);
                }
            }

            const consulta = `
                INSERT INTO empresas (
                    razao_social, nome_fantasia, cnpj, inscricao_estadual,
                    email, telefone, endereco_completo, cep, cidade, estado,
                    plano_assinatura, data_vencimento_plano
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
                ) RETURNING id
            `;

            const parametros = [
                dados.razao_social,
                dados.nome_fantasia || null,
                dados.cnpj || null,
                dados.inscricao_estadual || null,
                dados.email || null,
                dados.telefone || null,
                dados.endereco_completo || null,
                dados.cep || null,
                dados.cidade || null,
                dados.estado || null,
                dados.plano_assinatura || 'basico',
                dados.data_vencimento_plano || null
            ];

            const resultado = await query(consulta, parametros);
            const empresaId = resultado.rows[0].id;

            const empresaCriada = await this.buscarEmpresaCompleta(empresaId);

            return this.sucessoResponse(res, empresaCriada, 'Empresa criada com sucesso', 201);

        } catch (error) {
            console.error('Erro ao criar empresa:', error);
            next(error);
        }
    }

    /**
     * Atualizar empresa
     */
    async atualizar(req, res, next) {
        try {
            const { id } = req.params;
            const dados = req.body;

            // Verificar permissão
            if (req.usuario.nivel_hierarquia > 2) {
                return this.erroResponse(res, 'Acesso negado', 403);
            }

            if (req.usuario.nivel_hierarquia === 2 && req.usuario.empresa_id !== parseInt(id)) {
                return this.erroResponse(res, 'Acesso negado', 403);
            }

            // Verificar se empresa existe
            const empresaExiste = await this.verificarExistencia(id);
            if (!empresaExiste) {
                return this.erroResponse(res, 'Empresa não encontrada', 404);
            }

            // Verificar CNPJ único
            if (dados.cnpj) {
                const consultaCNPJ = `
                    SELECT id FROM empresas 
                    WHERE cnpj = $1 AND id != $2 AND ativo = true
                `;
                const cnpjResult = await query(consultaCNPJ, [dados.cnpj, id]);
                
                if (cnpjResult.rows.length > 0) {
                    return this.erroResponse(res, 'CNPJ já cadastrado', 409);
                }
            }

            const consulta = `
                UPDATE empresas 
                SET razao_social = $1, nome_fantasia = $2, cnpj = $3,
                    email = $4, telefone = $5, endereco_completo = $6,
                    cidade = $7, estado = $8, atualizado_em = NOW()
                WHERE id = $9 AND ativo = true
            `;

            const parametros = [
                dados.razao_social,
                dados.nome_fantasia || null,
                dados.cnpj || null,
                dados.email || null,
                dados.telefone || null,
                dados.endereco_completo || null,
                dados.cidade || null,
                dados.estado || null,
                id
            ];

            await query(consulta, parametros);

            const empresaAtualizada = await this.buscarEmpresaCompleta(id);

            return this.sucessoResponse(res, empresaAtualizada, 'Empresa atualizada com sucesso');

        } catch (error) {
            console.error('Erro ao atualizar empresa:', error);
            next(error);
        }
    }

    /**
     * Buscar empresa completa
     */
    async buscarEmpresaCompleta(id) {
        const consulta = `
            SELECT * FROM empresas WHERE id = $1
        `;

        const resultado = await query(consulta, [id]);
        return resultado.rows[0];
    }

    /**
     * Obter estatísticas da empresa
     */
    async obterEstatisticas(req, res, next) {
        try {
            const { id } = req.params;

            // Verificar permissão
            if (req.usuario.nivel_hierarquia > 1 && req.usuario.empresa_id !== parseInt(id)) {
                return this.erroResponse(res, 'Acesso negado', 403);
            }

            const consulta = `
                SELECT 
                    (SELECT COUNT(*) FROM usuarios WHERE empresa_id = $1 AND ativo = true) as total_usuarios,
                    (SELECT COUNT(*) FROM fazendas WHERE empresa_id = $1 AND ativo = true) as total_fazendas,
                    (SELECT COUNT(*) FROM produtos WHERE empresa_id = $1 AND ativo = true) as total_produtos,
                    (SELECT COALESCE(SUM(quantidade_atual), 0) FROM estoque e 
                     INNER JOIN produtos p ON e.produto_id = p.id 
                     WHERE p.empresa_id = $1) as total_estoque
            `;

            const resultado = await query(consulta, [id]);

            return this.sucessoResponse(res, resultado.rows[0]);

        } catch (error) {
            console.error('Erro ao obter estatísticas:', error);
            next(error);
        }
    }
}

module.exports = new EmpresasController(); 