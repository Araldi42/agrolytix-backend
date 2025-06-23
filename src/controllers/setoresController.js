/**
 * Controller de Setores
 * Gerencia setores/galpões/depósitos das fazendas
 * Integra com estoque e movimentações
 */

const BaseController = require('./baseController');
const Setor = require('../models/Setor');
const ValidationService = require('../services/validationService');

class SetoresController extends BaseController {
    constructor() {
        super('setores', 'Setor');
        this.setorModel = new Setor();
    }

    /**
     * Listar setores por fazenda
     */
    async listar(req, res, next) {
        try {
            const { fazenda_id } = req.query;

            if (!fazenda_id) {
                return this.erroResponse(res, 'ID da fazenda é obrigatório', 400);
            }

            // Verificar se usuário tem acesso à fazenda
            const temAcesso = await ValidationService.verificarPermissaoFazenda(
                req.usuario.id,
                fazenda_id
            );

            if (!temAcesso) {
                return this.erroResponse(res, 'Acesso negado a esta fazenda', 403);
            }

            const options = {
                search: req.query.search,
                tipo: req.query.tipo,
                com_estoque: req.query.com_estoque === 'true',
                page: parseInt(req.query.page) || 1,
                limit: Math.min(parseInt(req.query.limit) || 20, 100)
            };

            const setores = await this.setorModel.findByFazenda(fazenda_id, options);

            // Contar total para paginação
            const total = await this.setorModel.count({ fazenda_id });

            return this.respostaPaginada(
                res,
                setores,
                total,
                options.page,
                options.limit,
                'Setores listados com sucesso'
            );

        } catch (error) {
            console.error('Erro ao listar setores:', error);
            next(error);
        }
    }

    /**
     * Buscar setor por ID com detalhes
     */
    async buscarPorId(req, res, next) {
        try {
            const { id } = req.params;
            const empresaId = req.usuario.empresa_id;

            const setor = await this.setorModel.findByIdWithDetails(id, empresaId);

            if (!setor) {
                return this.erroResponse(res, 'Setor não encontrado', 404);
            }

            // Verificar permissão de acesso à fazenda
            const temAcesso = await ValidationService.verificarPermissaoFazenda(
                req.usuario.id,
                setor.fazenda_id
            );

            if (!temAcesso) {
                return this.erroResponse(res, 'Acesso negado a este setor', 403);
            }

            return this.sucessoResponse(res, setor, 'Setor encontrado');

        } catch (error) {
            console.error('Erro ao buscar setor:', error);
            next(error);
        }
    }

    /**
     * Criar novo setor
     */
    async criar(req, res, next) {
        try {
            const dadosLimpos = this.sanitizarDados(req.body, [
                'nome', 'observacoes'
            ]);

            // Validações básicas
            const errosValidacao = this.setorModel.validate(dadosLimpos);
            if (errosValidacao.length > 0) {
                return this.erroResponse(res, 'Dados inválidos', 400, errosValidacao);
            }

            // Validações de negócio
            const errosNegocio = ValidationService.validarSetor(dadosLimpos);
            if (errosNegocio.length > 0) {
                return this.erroResponse(res, 'Validação de negócio falhou', 400, errosNegocio);
            }

            // Verificar se usuário tem acesso à fazenda
            const temAcesso = await ValidationService.verificarPermissaoFazenda(
                req.usuario.id,
                dadosLimpos.fazenda_id
            );

            if (!temAcesso) {
                return this.erroResponse(res, 'Acesso negado a esta fazenda', 403);
            }

            // Verificar se nome é único na fazenda
            const isUnique = await this.setorModel.isNomeUnique(
                dadosLimpos.nome,
                dadosLimpos.fazenda_id
            );

            if (!isUnique) {
                return this.erroResponse(res, 'Nome do setor já existe nesta fazenda', 409);
            }

            // Criar setor
            dadosLimpos.criado_por = req.usuario.id;
            const setor = await this.setorModel.create(dadosLimpos);

            // Buscar setor criado com detalhes
            const setorCriado = await this.setorModel.findByIdWithDetails(setor.id);

            // Log de auditoria
            await this.logarAuditoria(
                req.usuario.id,
                'CREATE',
                'setores',
                setor.id,
                null,
                setorCriado
            );

            return this.sucessoResponse(
                res,
                setorCriado,
                'Setor criado com sucesso',
                201
            );

        } catch (error) {
            console.error('Erro ao criar setor:', error);
            next(error);
        }
    }

    /**
     * Atualizar setor existente
     */
    async atualizar(req, res, next) {
        try {
            const { id } = req.params;

            // Buscar setor atual
            const setorAtual = await this.setorModel.findByIdWithDetails(id);
            if (!setorAtual) {
                return this.erroResponse(res, 'Setor não encontrado', 404);
            }

            // Verificar permissão
            const temAcesso = await ValidationService.verificarPermissaoFazenda(
                req.usuario.id,
                setorAtual.fazenda_id
            );

            if (!temAcesso) {
                return this.erroResponse(res, 'Acesso negado a este setor', 403);
            }

            const dadosLimpos = this.sanitizarDados(req.body, [
                'nome', 'observacoes'
            ]);

            // Validações básicas
            const dadosCompletos = { ...setorAtual, ...dadosLimpos };
            const errosValidacao = this.setorModel.validate(dadosCompletos);
            if (errosValidacao.length > 0) {
                return this.erroResponse(res, 'Dados inválidos', 400, errosValidacao);
            }

            // Verificar nome único (se alterado)
            if (dadosLimpos.nome && dadosLimpos.nome !== setorAtual.nome) {
                const isUnique = await this.setorModel.isNomeUnique(
                    dadosLimpos.nome,
                    setorAtual.fazenda_id,
                    id
                );

                if (!isUnique) {
                    return this.erroResponse(res, 'Nome do setor já existe nesta fazenda', 409);
                }
            }

            // Atualizar setor
            dadosLimpos.atualizado_por = req.usuario.id;
            await this.setorModel.update(id, dadosLimpos);

            // Buscar setor atualizado
            const setorAtualizado = await this.setorModel.findByIdWithDetails(id);

            // Log de auditoria
            await this.logarAuditoria(
                req.usuario.id,
                'UPDATE',
                'setores',
                id,
                setorAtual,
                setorAtualizado
            );

            return this.sucessoResponse(
                res,
                setorAtualizado,
                'Setor atualizado com sucesso'
            );

        } catch (error) {
            console.error('Erro ao atualizar setor:', error);
            next(error);
        }
    }

    /**
     * Excluir setor (soft delete)
     */
    async excluir(req, res, next) {
        try {
            const { id } = req.params;

            // Buscar setor
            const setor = await this.setorModel.findByIdWithDetails(id);
            if (!setor) {
                return this.erroResponse(res, 'Setor não encontrado', 404);
            }

            // Verificar permissão
            const temAcesso = await ValidationService.verificarPermissaoFazenda(
                req.usuario.id,
                setor.fazenda_id
            );

            if (!temAcesso) {
                return this.erroResponse(res, 'Acesso negado a este setor', 403);
            }

            // Verificar se tem estoque
            if (parseFloat(setor.quantidade_total_estoque) > 0) {
                return this.erroResponse(
                    res,
                    'Setor com estoque não pode ser excluído. Transfira o estoque primeiro.',
                    409
                );
            }

            // Verificar integridade referencial
            const violacoes = await ValidationService.verificarIntegridadeReferencial('setores', id);
            if (violacoes.length > 0) {
                const mensagem = violacoes
                    .map(v => `${v.registros} registro(s) em ${v.tabela}`)
                    .join(', ');

                return this.erroResponse(
                    res,
                    `Setor não pode ser excluído. Possui dependências: ${mensagem}`,
                    409
                );
            }

            // Soft delete
            await this.setorModel.softDelete(id, req.usuario.id);

            // Log de auditoria
            await this.logarAuditoria(
                req.usuario.id,
                'DELETE',
                'setores',
                id,
                setor,
                null
            );

            return this.sucessoResponse(res, null, 'Setor excluído com sucesso');

        } catch (error) {
            console.error('Erro ao excluir setor:', error);
            next(error);
        }
    }

    /**
     * Listar setores por empresa
     */
    async porEmpresa(req, res, next) {
        try {
            const empresaId = req.usuario.empresa_id;

            if (!empresaId) {
                return this.erroResponse(res, 'Acesso negado', 403);
            }

            const options = {
                fazenda_id: req.query.fazenda_id,
                tipo: req.query.tipo,
                limit: parseInt(req.query.limit) || 50
            };

            const setores = await this.setorModel.findByEmpresa(empresaId, options);

            return this.sucessoResponse(
                res,
                setores,
                'Setores da empresa listados'
            );

        } catch (error) {
            console.error('Erro ao listar setores da empresa:', error);
            next(error);
        }
    }

    /**
     * Buscar setores por tipo
     */
    async porTipo(req, res, next) {
        try {
            const { tipo } = req.params;
            const empresaId = req.usuario.empresa_id;

            const setores = await this.setorModel.findByTipo(tipo, empresaId);

            return this.sucessoResponse(
                res,
                setores,
                `Setores do tipo ${tipo} listados`
            );

        } catch (error) {
            console.error('Erro ao buscar setores por tipo:', error);
            next(error);
        }
    }

    /**
     * Buscar setores com capacidade disponível
     */
    async comCapacidadeDisponivel(req, res, next) {
        try {
            const empresaId = req.usuario.empresa_id;
            const { tipo_setor, capacidade_minima = 0 } = req.query;

            if (!empresaId) {
                return this.erroResponse(res, 'Acesso negado', 403);
            }

            const setores = await this.setorModel.findComCapacidadeDisponivel(
                empresaId,
                tipo_setor,
                parseFloat(capacidade_minima)
            );

            return this.sucessoResponse(
                res,
                setores,
                'Setores com capacidade disponível listados'
            );

        } catch (error) {
            console.error('Erro ao buscar setores com capacidade:', error);
            next(error);
        }
    }

    /**
     * Buscar estoque do setor
     */
    async estoque(req, res, next) {
        try {
            const { id } = req.params;
            const { apenas_com_estoque = true, limit = 50 } = req.query;

            // Verificar se setor existe e usuário tem acesso
            const setor = await this.setorModel.findById(id);
            if (!setor) {
                return this.erroResponse(res, 'Setor não encontrado', 404);
            }

            const temAcesso = await ValidationService.verificarPermissaoFazenda(
                req.usuario.id,
                setor.fazenda_id
            );

            if (!temAcesso) {
                return this.erroResponse(res, 'Acesso negado a este setor', 403);
            }

            const options = {
                apenas_com_estoque: apenas_com_estoque === 'true',
                limit: parseInt(limit)
            };

            const estoque = await this.setorModel.getEstoque(id, options);

            return this.sucessoResponse(
                res,
                estoque,
                'Estoque do setor listado'
            );

        } catch (error) {
            console.error('Erro ao buscar estoque do setor:', error);
            next(error);
        }
    }

    /**
     * Buscar movimentações do setor
     */
    async movimentacoes(req, res, next) {
        try {
            const { id } = req.params;
            const { limite = 20, data_inicio } = req.query;

            // Verificar se setor existe e usuário tem acesso
            const setor = await this.setorModel.findById(id);
            if (!setor) {
                return this.erroResponse(res, 'Setor não encontrado', 404);
            }

            const temAcesso = await ValidationService.verificarPermissaoFazenda(
                req.usuario.id,
                setor.fazenda_id
            );

            if (!temAcesso) {
                return this.erroResponse(res, 'Acesso negado a este setor', 403);
            }

            const options = {
                limite: parseInt(limite),
                data_inicio
            };

            const movimentacoes = await this.setorModel.getMovimentacoes(id, options);

            return this.sucessoResponse(
                res,
                movimentacoes,
                'Movimentações do setor listadas'
            );

        } catch (error) {
            console.error('Erro ao buscar movimentações do setor:', error);
            next(error);
        }
    }

    /**
     * Obter resumo do setor
     */
    async resumo(req, res, next) {
        try {
            const { id } = req.params;

            // Verificar se setor existe e usuário tem acesso
            const setor = await this.setorModel.findById(id);
            if (!setor) {
                return this.erroResponse(res, 'Setor não encontrado', 404);
            }

            const temAcesso = await ValidationService.verificarPermissaoFazenda(
                req.usuario.id,
                setor.fazenda_id
            );

            if (!temAcesso) {
                return this.erroResponse(res, 'Acesso negado a este setor', 403);
            }

            const resumo = await this.setorModel.getResumo(id);

            return this.sucessoResponse(
                res,
                resumo,
                'Resumo do setor obtido'
            );

        } catch (error) {
            console.error('Erro ao obter resumo do setor:', error);
            next(error);
        }
    }

    /**
     * Buscar setores próximos (por geolocalização)
     */
    async proximosPorLocalizacao(req, res, next) {
        try {
            const { latitude, longitude, raio = 10 } = req.query;
            const empresaId = req.usuario.empresa_id;

            if (!latitude || !longitude) {
                return this.erroResponse(res, 'Latitude e longitude são obrigatórias', 400);
            }

            const lat = parseFloat(latitude);
            const lng = parseFloat(longitude);

            if (isNaN(lat) || isNaN(lng)) {
                return this.erroResponse(res, 'Coordenadas inválidas', 400);
            }

            const setores = await this.setorModel.findProximos(
                lat,
                lng,
                parseInt(raio),
                empresaId
            );

            return this.sucessoResponse(
                res,
                setores,
                'Setores próximos listados'
            );

        } catch (error) {
            console.error('Erro ao buscar setores próximos:', error);
            next(error);
        }
    }

    /**
     * Obter estatísticas por tipo de setor
     */
    async estatisticasPorTipo(req, res, next) {
        try {
            const empresaId = req.usuario.empresa_id;

            if (!empresaId) {
                return this.erroResponse(res, 'Acesso negado', 403);
            }

            const estatisticas = await this.setorModel.getEstatisticasPorTipo(empresaId);

            return this.sucessoResponse(
                res,
                estatisticas,
                'Estatísticas por tipo de setor obtidas'
            );

        } catch (error) {
            console.error('Erro ao obter estatísticas por tipo:', error);
            next(error);
        }
    }

    /**
     * Dashboard do setor
     */
    async dashboard(req, res, next) {
        try {
            const { id } = req.params;

            // Verificar se setor existe e usuário tem acesso
            const setor = await this.setorModel.findById(id);
            if (!setor) {
                return this.erroResponse(res, 'Setor não encontrado', 404);
            }

            const temAcesso = await ValidationService.verificarPermissaoFazenda(
                req.usuario.id,
                setor.fazenda_id
            );

            if (!temAcesso) {
                return this.erroResponse(res, 'Acesso negado a este setor', 403);
            }

            // Buscar dados em paralelo
            const [
                detalhes,
                resumo,
                estoque,
                movimentacoesRecentes
            ] = await Promise.all([
                this.setorModel.findByIdWithDetails(id),
                this.setorModel.getResumo(id),
                this.setorModel.getEstoque(id, { limit: 10 }),
                this.setorModel.getMovimentacoes(id, { limite: 5 })
            ]);

            const dashboard = {
                setor: detalhes,
                resumo: resumo,
                estoque_recente: estoque,
                movimentacoes_recentes: movimentacoesRecentes,
                timestamp: new Date().toISOString()
            };

            return this.sucessoResponse(
                res,
                dashboard,
                'Dashboard do setor carregado'
            );

        } catch (error) {
            console.error('Erro ao carregar dashboard do setor:', error);
            next(error);
        }
    }
}

module.exports = new SetoresController();