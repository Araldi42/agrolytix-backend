/**
 * Controller de Fazendas
 * Gerencia as propriedades/unidades da empresa
 * Integra com setores, produtos e safras
 */

const BaseController = require('./baseController');
const Fazenda = require('../models/Fazenda');
const ValidationService = require('../services/validationService');

class FazendasController extends BaseController {
    constructor() {
        super('fazendas', 'Fazenda');
        this.fazendaModel = new Fazenda();
    }

    /**
     * Listar fazendas da empresa
     */
    async listar(req, res, next) {
        try {
            const empresaId = req.usuario.empresa_id;

            if (!empresaId && !req.query.empresa_id) {
                return this.erroResponse(res, 'Empresa deve ser especificada', 400);
            }

            const options = {
                search: req.query.search,
                tipo_producao: req.query.tipo_producao,
                estado: req.query.estado,
                page: parseInt(req.query.page) || 1,
                limit: Math.min(parseInt(req.query.limit) || 20, 100)
            };

            const targetEmpresaId = empresaId || req.query.empresa_id;

            // Verificar permissão se admin sistema especificou empresa
            if (!empresaId && req.query.empresa_id) {
                const temAcesso = await ValidationService.verificarAcessoEmpresa(
                    req.usuario.id,
                    req.query.empresa_id
                );
                if (!temAcesso) {
                    return this.erroResponse(res, 'Acesso negado a esta empresa', 403);
                }
            }

            const fazendas = await this.fazendaModel.findByEmpresa(targetEmpresaId, options);

            // Contar total para paginação
            const total = await this.fazendaModel.count({ empresa_id: targetEmpresaId });

            return this.respostaPaginada(
                res,
                fazendas,
                total,
                options.page,
                options.limit,
                'Fazendas listadas com sucesso'
            );

        } catch (error) {
            console.error('Erro ao listar fazendas:', error);
            next(error);
        }
    }

    /**
     * Buscar fazenda por ID com detalhes
     */
    async buscarPorId(req, res, next) {
        try {
            const { id } = req.params;
            const empresaId = req.usuario.empresa_id;

            const fazenda = await this.fazendaModel.findByIdWithDetails(id, empresaId);

            if (!fazenda) {
                return this.erroResponse(res, 'Fazenda não encontrada', 404);
            }

            // Verificar permissão de acesso
            if (empresaId && fazenda.empresa_id !== empresaId) {
                return this.erroResponse(res, 'Acesso negado a esta fazenda', 403);
            }

            return this.sucessoResponse(res, fazenda, 'Fazenda encontrada');

        } catch (error) {
            console.error('Erro ao buscar fazenda:', error);
            next(error);
        }
    }

    /**
     * Criar nova fazenda
     */
    async criar(req, res, next) {
        try {
            const dadosLimpos = this.sanitizarDados(req.body, [
                'nome', 'codigo', 'endereco_completo', 'cidade', 'observacoes'
            ]);

            // Definir empresa automaticamente se usuário não for admin sistema
            if (req.usuario.empresa_id) {
                dadosLimpos.empresa_id = req.usuario.empresa_id;
            } else if (!dadosLimpos.empresa_id) {
                return this.erroResponse(res, 'Empresa é obrigatória', 400);
            }

            // Validações básicas
            const errosValidacao = this.fazendaModel.validate(dadosLimpos);
            if (errosValidacao.length > 0) {
                return this.erroResponse(res, 'Dados inválidos', 400, errosValidacao);
            }

            // Validações de negócio
            const errosNegocio = ValidationService.validarFazenda(dadosLimpos);
            if (errosNegocio.length > 0) {
                return this.erroResponse(res, 'Validação de negócio falhou', 400, errosNegocio);
            }

            // Verificar se código é único (se fornecido)
            if (dadosLimpos.codigo) {
                const isUnique = await this.fazendaModel.isCodigoUnique(
                    dadosLimpos.codigo,
                    dadosLimpos.empresa_id
                );

                if (!isUnique) {
                    return this.erroResponse(res, 'Código já existe nesta empresa', 409);
                }
            } else {
                // Gerar código automático se não fornecido
                dadosLimpos.codigo = await this.fazendaModel.gerarCodigo(
                    dadosLimpos.empresa_id,
                    dadosLimpos.nome
                );
            }

            // Verificar se usuário tem acesso à empresa
            if (req.usuario.empresa_id && req.usuario.empresa_id !== dadosLimpos.empresa_id) {
                return this.erroResponse(res, 'Acesso negado a esta empresa', 403);
            }

            // Criar fazenda
            dadosLimpos.criado_por = req.usuario.id;
            const fazenda = await this.fazendaModel.create(dadosLimpos);

            // Buscar fazenda criada com detalhes
            const fazendaCriada = await this.fazendaModel.findByIdWithDetails(
                fazenda.id,
                dadosLimpos.empresa_id
            );

            // Log de auditoria
            await this.logarAuditoria(
                req.usuario.id,
                'CREATE',
                'fazendas',
                fazenda.id,
                null,
                fazendaCriada
            );

            return this.sucessoResponse(
                res,
                fazendaCriada,
                'Fazenda criada com sucesso',
                201
            );

        } catch (error) {
            console.error('Erro ao criar fazenda:', error);
            next(error);
        }
    }

    /**
     * Atualizar fazenda existente
     */
    async atualizar(req, res, next) {
        try {
            const { id } = req.params;
            const empresaId = req.usuario.empresa_id;

            // Buscar fazenda atual
            const fazendaAtual = await this.fazendaModel.findByIdWithDetails(id, empresaId);
            if (!fazendaAtual) {
                return this.erroResponse(res, 'Fazenda não encontrada', 404);
            }

            // Verificar permissão
            if (empresaId && fazendaAtual.empresa_id !== empresaId) {
                return this.erroResponse(res, 'Acesso negado a esta fazenda', 403);
            }

            const dadosLimpos = this.sanitizarDados(req.body, [
                'nome', 'codigo', 'endereco_completo', 'cidade', 'observacoes'
            ]);

            // Validações básicas
            const dadosCompletos = { ...fazendaAtual, ...dadosLimpos };
            const errosValidacao = this.fazendaModel.validate(dadosCompletos);
            if (errosValidacao.length > 0) {
                return this.erroResponse(res, 'Dados inválidos', 400, errosValidacao);
            }

            // Verificar código único (se alterado)
            if (dadosLimpos.codigo && dadosLimpos.codigo !== fazendaAtual.codigo) {
                const isUnique = await this.fazendaModel.isCodigoUnique(
                    dadosLimpos.codigo,
                    fazendaAtual.empresa_id,
                    id
                );

                if (!isUnique) {
                    return this.erroResponse(res, 'Código já existe nesta empresa', 409);
                }
            }

            // Atualizar fazenda
            dadosLimpos.atualizado_por = req.usuario.id;
            await this.fazendaModel.update(id, dadosLimpos);

            // Buscar fazenda atualizada
            const fazendaAtualizada = await this.fazendaModel.findByIdWithDetails(
                id,
                empresaId
            );

            // Log de auditoria
            await this.logarAuditoria(
                req.usuario.id,
                'UPDATE',
                'fazendas',
                id,
                fazendaAtual,
                fazendaAtualizada
            );

            return this.sucessoResponse(
                res,
                fazendaAtualizada,
                'Fazenda atualizada com sucesso'
            );

        } catch (error) {
            console.error('Erro ao atualizar fazenda:', error);
            next(error);
        }
    }

    /**
     * Excluir fazenda (soft delete)
     */
    async excluir(req, res, next) {
        try {
            const { id } = req.params;
            const empresaId = req.usuario.empresa_id;

            // Buscar fazenda
            const fazenda = await this.fazendaModel.findByIdWithDetails(id, empresaId);
            if (!fazenda) {
                return this.erroResponse(res, 'Fazenda não encontrada', 404);
            }

            // Verificar permissão
            if (empresaId && fazenda.empresa_id !== empresaId) {
                return this.erroResponse(res, 'Acesso negado a esta fazenda', 403);
            }

            // Verificar integridade referencial
            const violacoes = await ValidationService.verificarIntegridadeReferencial('fazendas', id);
            if (violacoes.length > 0) {
                const mensagem = violacoes
                    .map(v => `${v.registros} registro(s) em ${v.tabela}`)
                    .join(', ');

                return this.erroResponse(
                    res,
                    `Fazenda não pode ser excluída. Possui dependências: ${mensagem}`,
                    409
                );
            }

            // Soft delete
            await this.fazendaModel.softDelete(id, req.usuario.id);

            // Log de auditoria
            await this.logarAuditoria(
                req.usuario.id,
                'DELETE',
                'fazendas',
                id,
                fazenda,
                null
            );

            return this.sucessoResponse(res, null, 'Fazenda excluída com sucesso');

        } catch (error) {
            console.error('Erro ao excluir fazenda:', error);
            next(error);
        }
    }

    /**
     * Listar fazendas com estatísticas
     */
    async comEstatisticas(req, res, next) {
        try {
            const empresaId = req.usuario.empresa_id;

            if (!empresaId) {
                return this.erroResponse(res, 'Acesso negado', 403);
            }

            const fazendas = await this.fazendaModel.findWithStats(empresaId);

            return this.sucessoResponse(
                res,
                fazendas,
                'Fazendas com estatísticas listadas'
            );

        } catch (error) {
            console.error('Erro ao listar fazendas com estatísticas:', error);
            next(error);
        }
    }

    /**
     * Buscar setores de uma fazenda
     */
    async setores(req, res, next) {
        try {
            const { id } = req.params;
            const empresaId = req.usuario.empresa_id;

            // Verificar se fazenda existe e usuário tem acesso
            const fazenda = await this.fazendaModel.findById(id);
            if (!fazenda) {
                return this.erroResponse(res, 'Fazenda não encontrada', 404);
            }

            if (empresaId && fazenda.empresa_id !== empresaId) {
                return this.erroResponse(res, 'Acesso negado a esta fazenda', 403);
            }

            const setores = await this.fazendaModel.getSetores(id);

            return this.sucessoResponse(
                res,
                setores,
                'Setores da fazenda listados'
            );

        } catch (error) {
            console.error('Erro ao buscar setores da fazenda:', error);
            next(error);
        }
    }

    /**
     * Buscar produtos de uma fazenda
     */
    async produtos(req, res, next) {
        try {
            const { id } = req.params;
            const empresaId = req.usuario.empresa_id;
            const { categoria_produto, limit } = req.query;

            // Verificar se fazenda existe e usuário tem acesso
            const fazenda = await this.fazendaModel.findById(id);
            if (!fazenda) {
                return this.erroResponse(res, 'Fazenda não encontrada', 404);
            }

            if (empresaId && fazenda.empresa_id !== empresaId) {
                return this.erroResponse(res, 'Acesso negado a esta fazenda', 403);
            }

            const options = {
                categoria_produto,
                limit: parseInt(limit) || 50
            };

            const produtos = await this.fazendaModel.getProdutos(id, options);

            return this.sucessoResponse(
                res,
                produtos,
                'Produtos da fazenda listados'
            );

        } catch (error) {
            console.error('Erro ao buscar produtos da fazenda:', error);
            next(error);
        }
    }

    /**
     * Buscar safras de uma fazenda
     */
    async safras(req, res, next) {
        try {
            const { id } = req.params;
            const empresaId = req.usuario.empresa_id;
            const { status, ano } = req.query;

            // Verificar se fazenda existe e usuário tem acesso
            const fazenda = await this.fazendaModel.findById(id);
            if (!fazenda) {
                return this.erroResponse(res, 'Fazenda não encontrada', 404);
            }

            if (empresaId && fazenda.empresa_id !== empresaId) {
                return this.erroResponse(res, 'Acesso negado a esta fazenda', 403);
            }

            const options = { status, ano: parseInt(ano) };
            const safras = await this.fazendaModel.getSafras(id, options);

            return this.sucessoResponse(
                res,
                safras,
                'Safras da fazenda listadas'
            );

        } catch (error) {
            console.error('Erro ao buscar safras da fazenda:', error);
            next(error);
        }
    }

    /**
     * Obter resumo financeiro da fazenda
     */
    async resumoFinanceiro(req, res, next) {
        try {
            const { id } = req.params;
            const empresaId = req.usuario.empresa_id;
            const { periodo = 'ano' } = req.query;

            // Verificar se fazenda existe e usuário tem acesso
            const fazenda = await this.fazendaModel.findById(id);
            if (!fazenda) {
                return this.erroResponse(res, 'Fazenda não encontrada', 404);
            }

            if (empresaId && fazenda.empresa_id !== empresaId) {
                return this.erroResponse(res, 'Acesso negado a esta fazenda', 403);
            }

            const resumo = await this.fazendaModel.getResumoFinanceiro(id, periodo);

            return this.sucessoResponse(
                res,
                resumo,
                'Resumo financeiro da fazenda obtido'
            );

        } catch (error) {
            console.error('Erro ao obter resumo financeiro:', error);
            next(error);
        }
    }

    /**
     * Obter capacidade de armazenamento
     */
    async capacidadeArmazenamento(req, res, next) {
        try {
            const { id } = req.params;
            const empresaId = req.usuario.empresa_id;

            // Verificar se fazenda existe e usuário tem acesso
            const fazenda = await this.fazendaModel.findById(id);
            if (!fazenda) {
                return this.erroResponse(res, 'Fazenda não encontrada', 404);
            }

            if (empresaId && fazenda.empresa_id !== empresaId) {
                return this.erroResponse(res, 'Acesso negado a esta fazenda', 403);
            }

            const capacidade = await this.fazendaModel.getCapacidadeArmazenamento(id);

            return this.sucessoResponse(
                res,
                capacidade,
                'Capacidade de armazenamento obtida'
            );

        } catch (error) {
            console.error('Erro ao obter capacidade de armazenamento:', error);
            next(error);
        }
    }

    /**
     * Buscar fazendas próximas (por geolocalização)
     */
    async proximasPorLocalizacao(req, res, next) {
        try {
            const { latitude, longitude, raio = 50 } = req.query;
            const empresaId = req.usuario.empresa_id;

            if (!latitude || !longitude) {
                return this.erroResponse(res, 'Latitude e longitude são obrigatórias', 400);
            }

            const lat = parseFloat(latitude);
            const lng = parseFloat(longitude);

            if (isNaN(lat) || isNaN(lng)) {
                return this.erroResponse(res, 'Coordenadas inválidas', 400);
            }

            const fazendas = await this.fazendaModel.findProximas(
                lat,
                lng,
                parseInt(raio),
                empresaId
            );

            return this.sucessoResponse(
                res,
                fazendas,
                'Fazendas próximas listadas'
            );

        } catch (error) {
            console.error('Erro ao buscar fazendas próximas:', error);
            next(error);
        }
    }

    /**
     * Dashboard da fazenda
     */
    async dashboard(req, res, next) {
        try {
            const { id } = req.params;
            const empresaId = req.usuario.empresa_id;

            // Verificar se fazenda existe e usuário tem acesso
            const fazenda = await this.fazendaModel.findById(id);
            if (!fazenda) {
                return this.erroResponse(res, 'Fazenda não encontrada', 404);
            }

            if (empresaId && fazenda.empresa_id !== empresaId) {
                return this.erroResponse(res, 'Acesso negado a esta fazenda', 403);
            }

            // Buscar dados em paralelo
            const [
                detalhes,
                setores,
                resumoFinanceiro,
                capacidadeArmazenamento,
                safrasAtivas
            ] = await Promise.all([
                this.fazendaModel.findByIdWithDetails(id),
                this.fazendaModel.getSetores(id),
                this.fazendaModel.getResumoFinanceiro(id, 'ano'),
                this.fazendaModel.getCapacidadeArmazenamento(id),
                this.fazendaModel.getSafras(id, { status: 'andamento' })
            ]);

            const dashboard = {
                fazenda: detalhes,
                setores: setores.slice(0, 5), // Primeiros 5 setores
                resumo_financeiro: resumoFinanceiro,
                capacidade_armazenamento: capacidadeArmazenamento,
                safras_ativas: safrasAtivas,
                timestamp: new Date().toISOString()
            };

            return this.sucessoResponse(
                res,
                dashboard,
                'Dashboard da fazenda carregado'
            );

        } catch (error) {
            console.error('Erro ao carregar dashboard da fazenda:', error);
            next(error);
        }
    }
}

module.exports = new FazendasController();