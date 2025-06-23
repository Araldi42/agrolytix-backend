/**
 * Controller de Empresas Refatorado
 * Gerencia as empresas clientes do SaaS multi-tenant
 * Usa Repository Pattern para abstração de dados
 */

const BaseController = require('./baseController');
const Empresa = require('../models/Empresa');
const ValidationService = require('../services/validationService');

class EmpresasController extends BaseController {
    constructor() {
        super('empresas', 'Empresa');
        this.empresaModel = new Empresa();
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

            const options = {
                search: req.query.search,
                plano: req.query.plano,
                ativo: req.query.ativo !== undefined ? req.query.ativo === 'true' : true,
                vencimento_proximo: req.query.vencimento_proximo === 'true',
                page: parseInt(req.query.page) || 1,
                limit: Math.min(parseInt(req.query.limit) || 20, 100)
            };

            const empresas = await this.empresaModel.findAll(options);

            // Contar total para paginação
            const total = await this.empresaModel.count({ ativo: options.ativo });

            return this.respostaPaginada(
                res,
                empresas,
                total,
                options.page,
                options.limit,
                'Empresas listadas com sucesso'
            );

        } catch (error) {
            console.error('Erro ao listar empresas:', error);
            next(error);
        }
    }

    /**
     * Buscar empresa por ID com estatísticas
     */
    async buscarPorId(req, res, next) {
        try {
            const { id } = req.params;

            // Verificar permissão
            if (req.usuario.nivel_hierarquia > 1 && req.usuario.empresa_id !== parseInt(id)) {
                return this.erroResponse(res, 'Acesso negado', 403);
            }

            const empresa = await this.empresaModel.findByIdWithStats(id);

            if (!empresa) {
                return this.erroResponse(res, 'Empresa não encontrada', 404);
            }

            return this.sucessoResponse(res, empresa, 'Empresa encontrada');

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

            const dadosLimpos = this.sanitizarDados(req.body, [
                'razao_social', 'nome_fantasia', 'endereco_completo', 'cidade'
            ]);

            // Validações básicas
            const errosValidacao = this.empresaModel.validate(dadosLimpos);
            if (errosValidacao.length > 0) {
                return this.erroResponse(res, 'Dados inválidos', 400, errosValidacao);
            }

            // Validações de negócio
            const errosNegocio = ValidationService.validarEmpresa(dadosLimpos);
            if (errosNegocio.length > 0) {
                return this.erroResponse(res, 'Validação de negócio falhou', 400, errosNegocio);
            }

            // Verificar CNPJ único
            if (dadosLimpos.cnpj) {
                const isUnique = await this.empresaModel.isCNPJUnique(dadosLimpos.cnpj);
                if (!isUnique) {
                    return this.erroResponse(res, 'CNPJ já cadastrado', 409);
                }
            }

            // Definir plano padrão se não especificado
            if (!dadosLimpos.plano_assinatura) {
                dadosLimpos.plano_assinatura = 'basico';
            }

            // Definir data de vencimento padrão (30 dias)
            if (!dadosLimpos.data_vencimento_plano) {
                const dataVencimento = new Date();
                dataVencimento.setDate(dataVencimento.getDate() + 30);
                dadosLimpos.data_vencimento_plano = dataVencimento;
            }

            // Criar empresa
            const empresa = await this.empresaModel.create(dadosLimpos);

            // Buscar empresa criada com estatísticas
            const empresaCriada = await this.empresaModel.findByIdWithStats(empresa.id);

            // Log de auditoria
            await this.logarAuditoria(
                req.usuario.id,
                'CREATE',
                'empresas',
                empresa.id,
                null,
                empresaCriada
            );

            return this.sucessoResponse(
                res,
                empresaCriada,
                'Empresa criada com sucesso',
                201
            );

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

            // Verificar permissão
            if (req.usuario.nivel_hierarquia > 2) {
                return this.erroResponse(res, 'Acesso negado', 403);
            }

            if (req.usuario.nivel_hierarquia === 2 && req.usuario.empresa_id !== parseInt(id)) {
                return this.erroResponse(res, 'Acesso negado', 403);
            }

            // Buscar empresa atual
            const empresaAtual = await this.empresaModel.findById(id);
            if (!empresaAtual) {
                return this.erroResponse(res, 'Empresa não encontrada', 404);
            }

            const dadosLimpos = this.sanitizarDados(req.body, [
                'razao_social', 'nome_fantasia', 'endereco_completo', 'cidade'
            ]);

            // Validações básicas
            const dadosCompletos = { ...empresaAtual, ...dadosLimpos };
            const errosValidacao = this.empresaModel.validate(dadosCompletos);
            if (errosValidacao.length > 0) {
                return this.erroResponse(res, 'Dados inválidos', 400, errosValidacao);
            }

            // Verificar CNPJ único (se alterado)
            if (dadosLimpos.cnpj && dadosLimpos.cnpj !== empresaAtual.cnpj) {
                const isUnique = await this.empresaModel.isCNPJUnique(dadosLimpos.cnpj, id);
                if (!isUnique) {
                    return this.erroResponse(res, 'CNPJ já cadastrado', 409);
                }
            }

            // Admin empresa não pode alterar dados de assinatura
            if (req.usuario.nivel_hierarquia === 2) {
                delete dadosLimpos.plano_assinatura;
                delete dadosLimpos.data_vencimento_plano;
            }

            // Atualizar empresa
            await this.empresaModel.update(id, dadosLimpos);

            // Buscar empresa atualizada
            const empresaAtualizada = await this.empresaModel.findByIdWithStats(id);

            // Log de auditoria
            await this.logarAuditoria(
                req.usuario.id,
                'UPDATE',
                'empresas',
                id,
                empresaAtual,
                empresaAtualizada
            );

            return this.sucessoResponse(
                res,
                empresaAtualizada,
                'Empresa atualizada com sucesso'
            );

        } catch (error) {
            console.error('Erro ao atualizar empresa:', error);
            next(error);
        }
    }

    /**
     * Excluir empresa (soft delete - apenas admin sistema)
     */
    async excluir(req, res, next) {
        try {
            const { id } = req.params;

            // Apenas admin sistema pode excluir empresas
            if (req.usuario.nivel_hierarquia > 1) {
                return this.erroResponse(res, 'Acesso negado', 403);
            }

            // Buscar empresa
            const empresa = await this.empresaModel.findById(id);
            if (!empresa) {
                return this.erroResponse(res, 'Empresa não encontrada', 404);
            }

            // Verificar integridade referencial
            const violacoes = await ValidationService.verificarIntegridadeReferencial('empresas', id);
            if (violacoes.length > 0) {
                const mensagem = violacoes
                    .map(v => `${v.registros} registro(s) em ${v.tabela}`)
                    .join(', ');

                return this.erroResponse(
                    res,
                    `Empresa não pode ser excluída. Possui dependências: ${mensagem}`,
                    409
                );
            }

            // Soft delete
            await this.empresaModel.softDelete(id, req.usuario.id);

            // Log de auditoria
            await this.logarAuditoria(
                req.usuario.id,
                'DELETE',
                'empresas',
                id,
                empresa,
                null
            );

            return this.sucessoResponse(res, null, 'Empresa excluída com sucesso');

        } catch (error) {
            console.error('Erro ao excluir empresa:', error);
            next(error);
        }
    }

    /**
     * Obter estatísticas da empresa
     */
    async estatisticas(req, res, next) {
        try {
            const { id } = req.params;

            // Verificar permissão
            if (req.usuario.nivel_hierarquia > 1 && req.usuario.empresa_id !== parseInt(id)) {
                return this.erroResponse(res, 'Acesso negado', 403);
            }

            const empresa = await this.empresaModel.findByIdWithStats(id);
            if (!empresa) {
                return this.erroResponse(res, 'Empresa não encontrada', 404);
            }

            // Buscar dados adicionais
            const [fazendas, usuarios] = await Promise.all([
                this.empresaModel.getFazendas(id, 5),
                this.empresaModel.getUsuarios(id, 5)
            ]);

            const estatisticas = {
                resumo_geral: {
                    total_fazendas: empresa.total_fazendas,
                    total_usuarios: empresa.total_usuarios,
                    total_produtos: empresa.total_produtos,
                    total_setores: empresa.total_setores,
                    valor_total_estoque: empresa.valor_total_estoque,
                    status_assinatura: empresa.status_assinatura
                },
                fazendas_recentes: fazendas,
                usuarios_recentes: usuarios
            };

            return this.sucessoResponse(res, estatisticas, 'Estatísticas obtidas');

        } catch (error) {
            console.error('Erro ao obter estatísticas:', error);
            next(error);
        }
    }

    /**
     * Renovar assinatura (apenas admin sistema)
     */
    async renovarAssinatura(req, res, next) {
        try {
            const { id } = req.params;
            const { novo_plano, dias_renovacao = 365 } = req.body;

            // Apenas admin sistema pode renovar assinaturas
            if (req.usuario.nivel_hierarquia > 1) {
                return this.erroResponse(res, 'Acesso negado', 403);
            }

            if (!novo_plano) {
                return this.erroResponse(res, 'Novo plano é obrigatório', 400);
            }

            const planosValidos = ['basico', 'premium', 'enterprise'];
            if (!planosValidos.includes(novo_plano)) {
                return this.erroResponse(res, 'Plano inválido', 400);
            }

            const empresaRenovada = await this.empresaModel.renovarAssinatura(
                id,
                novo_plano,
                dias_renovacao
            );

            if (!empresaRenovada) {
                return this.erroResponse(res, 'Empresa não encontrada', 404);
            }

            // Log de auditoria
            await this.logarAuditoria(
                req.usuario.id,
                'RENEW_SUBSCRIPTION',
                'empresas',
                id,
                null,
                { novo_plano, dias_renovacao, data_vencimento: empresaRenovada.data_vencimento_plano }
            );

            return this.sucessoResponse(
                res,
                empresaRenovada,
                'Assinatura renovada com sucesso'
            );

        } catch (error) {
            console.error('Erro ao renovar assinatura:', error);
            next(error);
        }
    }

    /**
     * Suspender empresa por vencimento (apenas admin sistema)
     */
    async suspender(req, res, next) {
        try {
            const { id } = req.params;
            const { motivo = 'Suspensão administrativa' } = req.body;

            // Apenas admin sistema pode suspender empresas
            if (req.usuario.nivel_hierarquia > 1) {
                return this.erroResponse(res, 'Acesso negado', 403);
            }

            const sucesso = await this.empresaModel.suspenderPorVencimento(id, motivo);

            if (!sucesso) {
                return this.erroResponse(res, 'Erro ao suspender empresa', 500);
            }

            // Log de auditoria
            await this.logarAuditoria(
                req.usuario.id,
                'SUSPEND',
                'empresas',
                id,
                null,
                { motivo, data_suspensao: new Date() }
            );

            return this.sucessoResponse(res, null, 'Empresa suspensa com sucesso');

        } catch (error) {
            console.error('Erro ao suspender empresa:', error);
            next(error);
        }
    }

    /**
     * Reativar empresa (apenas admin sistema)
     */
    async reativar(req, res, next) {
        try {
            const { id } = req.params;
            const { nova_data_vencimento } = req.body;

            // Apenas admin sistema pode reativar empresas
            if (req.usuario.nivel_hierarquia > 1) {
                return this.erroResponse(res, 'Acesso negado', 403);
            }

            if (!nova_data_vencimento) {
                return this.erroResponse(res, 'Nova data de vencimento é obrigatória', 400);
            }

            const empresaReativada = await this.empresaModel.reativar(id, nova_data_vencimento);

            if (!empresaReativada) {
                return this.erroResponse(res, 'Empresa não encontrada', 404);
            }

            // Log de auditoria
            await this.logarAuditoria(
                req.usuario.id,
                'REACTIVATE',
                'empresas',
                id,
                null,
                { nova_data_vencimento, data_reativacao: new Date() }
            );

            return this.sucessoResponse(
                res,
                empresaReativada,
                'Empresa reativada com sucesso'
            );

        } catch (error) {
            console.error('Erro ao reativar empresa:', error);
            next(error);
        }
    }

    /**
     * Buscar empresas com vencimento próximo (apenas admin sistema)
     */
    async vencimentoProximo(req, res, next) {
        try {
            // Apenas admin sistema pode ver vencimentos
            if (req.usuario.nivel_hierarquia > 1) {
                return this.erroResponse(res, 'Acesso negado', 403);
            }

            const dias = parseInt(req.query.dias) || 30;
            const empresas = await this.empresaModel.findComVencimentoProximo(dias);

            return this.sucessoResponse(
                res,
                empresas,
                `Empresas com vencimento em ${dias} dias listadas`
            );

        } catch (error) {
            console.error('Erro ao buscar empresas com vencimento próximo:', error);
            next(error);
        }
    }

    /**
     * Buscar empresas vencidas (apenas admin sistema)
     */
    async vencidas(req, res, next) {
        try {
            // Apenas admin sistema pode ver vencimentos
            if (req.usuario.nivel_hierarquia > 1) {
                return this.erroResponse(res, 'Acesso negado', 403);
            }

            const empresas = await this.empresaModel.findVencidas();

            return this.sucessoResponse(
                res,
                empresas,
                'Empresas vencidas listadas'
            );

        } catch (error) {
            console.error('Erro ao buscar empresas vencidas:', error);
            next(error);
        }
    }

    /**
     * Dashboard de empresas (apenas admin sistema)
     */
    async dashboard(req, res, next) {
        try {
            // Apenas admin sistema pode ver dashboard geral
            if (req.usuario.nivel_hierarquia > 1) {
                return this.erroResponse(res, 'Acesso negado', 403);
            }

            // Buscar dados em paralelo
            const [
                estatisticasGerais,
                estatisticasPeriodo,
                vencimentoProximo,
                empresasVencidas
            ] = await Promise.all([
                this.empresaModel.getEstatisticasGerais(),
                this.empresaModel.getEstatisticasPorPeriodo('mes'),
                this.empresaModel.findComVencimentoProximo(30),
                this.empresaModel.findVencidas()
            ]);

            const dashboard = {
                estatisticas_gerais: estatisticasGerais,
                cadastros_mes_atual: estatisticasPeriodo,
                alertas: {
                    vencimento_proximo: vencimentoProximo.slice(0, 5), // Primeiras 5
                    empresas_vencidas: empresasVencidas.slice(0, 5)    // Primeiras 5
                },
                timestamp: new Date().toISOString()
            };

            return this.sucessoResponse(res, dashboard, 'Dashboard carregado');

        } catch (error) {
            console.error('Erro ao carregar dashboard:', error);
            next(error);
        }
    }

    /**
     * Relatório de empresas (apenas admin sistema)
     */
    async relatorio(req, res, next) {
        try {
            // Apenas admin sistema pode gerar relatórios
            if (req.usuario.nivel_hierarquia > 1) {
                return this.erroResponse(res, 'Acesso negado', 403);
            }

            const { formato = 'json', incluir_inativas = false } = req.query;

            const options = {
                ativo: !incluir_inativas,
                page: 1,
                limit: 10000 // Limite alto para relatório
            };

            const empresas = await this.empresaModel.findAll(options);

            if (formato === 'csv') {
                // TODO: Implementar exportação CSV
                return this.erroResponse(res, 'Exportação CSV em desenvolvimento', 501);
            }

            // Adicionar estatísticas no topo do relatório
            const estatisticas = await this.empresaModel.getEstatisticasGerais();

            const relatorio = {
                resumo: estatisticas,
                empresas: empresas,
                filtros: {
                    incluir_inativas,
                    data_geracao: new Date().toISOString()
                }
            };

            return this.sucessoResponse(res, relatorio, 'Relatório gerado');

        } catch (error) {
            console.error('Erro ao gerar relatório:', error);
            next(error);
        }
    }

    /**
     * Buscar fazendas da empresa
     */
    async fazendas(req, res, next) {
        try {
            const { id } = req.params;

            // Verificar permissão
            if (req.usuario.nivel_hierarquia > 1 && req.usuario.empresa_id !== parseInt(id)) {
                return this.erroResponse(res, 'Acesso negado', 403);
            }

            const limite = parseInt(req.query.limite) || 50;
            const fazendas = await this.empresaModel.getFazendas(id, limite);

            return this.sucessoResponse(res, fazendas, 'Fazendas da empresa listadas');

        } catch (error) {
            console.error('Erro ao buscar fazendas da empresa:', error);
            next(error);
        }
    }

    /**
     * Buscar usuários da empresa
     */
    async usuarios(req, res, next) {
        try {
            const { id } = req.params;

            // Verificar permissão
            if (req.usuario.nivel_hierarquia > 1 && req.usuario.empresa_id !== parseInt(id)) {
                return this.erroResponse(res, 'Acesso negado', 403);
            }

            const limite = parseInt(req.query.limite) || 50;
            const usuarios = await this.empresaModel.getUsuarios(id, limite);

            return this.sucessoResponse(res, usuarios, 'Usuários da empresa listados');

        } catch (error) {
            console.error('Erro ao buscar usuários da empresa:', error);
            next(error);
        }
    }
}

module.exports = new EmpresasController();