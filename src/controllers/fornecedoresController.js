// ===================================================================
// controllers/fornecedoresController.js
// ===================================================================

const Fornecedor = require('../models/Fornecedor');
const { sucessoResponse, erroResponse, respostaPaginada } = require('../utils/responseUtils');
const validacoes = require('../utils/validacoes');

/**
 * Controller para gestão de fornecedores
 */
const fornecedoresController = {
    /**
     * Listar fornecedores da empresa
     */
    listar: async (req, res, next) => {
        try {
            const usuarioLogado = req.usuario;
            const {
                nome,
                tipo_pessoa,
                cidade,
                estado,
                pagina = 1,
                limite = 20
            } = req.query;

            // Apenas admin sistema pode ver fornecedores globais
            const empresaId = usuarioLogado.nivel_hierarquia === 1 ? null : usuarioLogado.empresa_id;

            const filtros = {
                ...(nome && { nome }),
                ...(tipo_pessoa && { tipo_pessoa }),
                ...(cidade && { cidade }),
                ...(estado && { estado })
            };

            const fornecedores = await Fornecedor.listarPorEmpresa(empresaId, filtros);

            // Implementar paginação manual
            const offset = (pagina - 1) * limite;
            const fornecedoresPaginados = fornecedores.slice(offset, offset + limite);

            return respostaPaginada(
                res,
                fornecedoresPaginados,
                fornecedores.length,
                parseInt(pagina),
                parseInt(limite),
                'Fornecedores listados com sucesso'
            );
        } catch (error) {
            next(error);
        }
    },

    /**
     * Buscar fornecedor por ID
     */
    buscarPorId: async (req, res, next) => {
        try {
            const { id } = req.params;
            const usuarioLogado = req.usuario;

            if (!id || isNaN(id)) {
                return erroResponse(res, 'ID do fornecedor inválido', 400);
            }

            const empresaId = usuarioLogado.nivel_hierarquia === 1 ? null : usuarioLogado.empresa_id;
            const fornecedor = await Fornecedor.buscarPorId(parseInt(id), empresaId);

            if (!fornecedor) {
                return erroResponse(res, 'Fornecedor não encontrado', 404);
            }

            return sucessoResponse(res, fornecedor, 'Fornecedor encontrado com sucesso');
        } catch (error) {
            next(error);
        }
    },

    /**
     * Criar novo fornecedor
     */
    criar: async (req, res, next) => {
        try {
            const usuarioLogado = req.usuario;
            const dadosFornecedor = req.body;

            // Verificar permissões - apenas admin empresa, gerente e operador podem criar
            if (usuarioLogado.nivel_hierarquia > 4) {
                return erroResponse(res, 'Permissão insuficiente para criar fornecedores', 403);
            }

            // Validar campos obrigatórios
            const camposObrigatorios = ['tipo_pessoa', 'nome'];
            const validacao = validacoes.validarCamposObrigatorios(dadosFornecedor, camposObrigatorios);

            if (!validacao.valido) {
                return erroResponse(res, 'Campos obrigatórios não preenchidos', 400, {
                    camposFaltando: validacao.camposFaltando
                });
            }

            // Validar tipo de pessoa
            if (!['fisica', 'juridica'].includes(dadosFornecedor.tipo_pessoa)) {
                return erroResponse(res, 'Tipo de pessoa deve ser "fisica" ou "juridica"', 400);
            }

            // Validar CNPJ ou CPF conforme tipo
            if (dadosFornecedor.tipo_pessoa === 'juridica' && dadosFornecedor.cnpj) {
                if (!validacoes.validarCNPJ(dadosFornecedor.cnpj)) {
                    return erroResponse(res, 'CNPJ inválido', 400);
                }
            }

            if (dadosFornecedor.tipo_pessoa === 'fisica' && dadosFornecedor.cpf) {
                if (!validacoes.validarCPF(dadosFornecedor.cpf)) {
                    return erroResponse(res, 'CPF inválido', 400);
                }
            }

            // Validar email se fornecido
            if (dadosFornecedor.email && !validacoes.validarEmail(dadosFornecedor.email)) {
                return erroResponse(res, 'Email inválido', 400);
            }

            // Verificar documento duplicado
            const documento = dadosFornecedor.cnpj || dadosFornecedor.cpf;
            if (documento) {
                const empresaId = usuarioLogado.nivel_hierarquia === 1 ? null : usuarioLogado.empresa_id;
                const documentoExistente = await Fornecedor.verificarDocumento(documento, empresaId);

                if (documentoExistente) {
                    return erroResponse(res, 'CNPJ/CPF já cadastrado para outro fornecedor', 409);
                }
            }

            // Definir empresa_id baseado no usuário
            if (usuarioLogado.nivel_hierarquia === 1) {
                // Admin sistema pode definir empresa_id ou deixar null (global)
                dadosFornecedor.empresa_id = dadosFornecedor.empresa_id || null;
            } else {
                // Outros usuários só podem criar para sua empresa
                dadosFornecedor.empresa_id = usuarioLogado.empresa_id;
            }

            const novoFornecedor = await Fornecedor.criar(dadosFornecedor, usuarioLogado.id);

            return sucessoResponse(res, novoFornecedor, 'Fornecedor criado com sucesso', 201);
        } catch (error) {
            next(error);
        }
    },

    /**
     * Atualizar fornecedor
     */
    atualizar: async (req, res, next) => {
        try {
            const { id } = req.params;
            const usuarioLogado = req.usuario;
            const dadosFornecedor = req.body;

            if (!id || isNaN(id)) {
                return erroResponse(res, 'ID do fornecedor inválido', 400);
            }

            // Verificar permissões
            if (usuarioLogado.nivel_hierarquia > 4) {
                return erroResponse(res, 'Permissão insuficiente para editar fornecedores', 403);
            }

            // Verificar se fornecedor existe e pertence à empresa
            const empresaId = usuarioLogado.nivel_hierarquia === 1 ? null : usuarioLogado.empresa_id;
            const fornecedorExistente = await Fornecedor.buscarPorId(parseInt(id), empresaId);

            if (!fornecedorExistente) {
                return erroResponse(res, 'Fornecedor não encontrado', 404);
            }

            // Validações similares ao criar
            if (dadosFornecedor.tipo_pessoa && !['fisica', 'juridica'].includes(dadosFornecedor.tipo_pessoa)) {
                return erroResponse(res, 'Tipo de pessoa deve ser "fisica" ou "juridica"', 400);
            }

            if (dadosFornecedor.cnpj && !validacoes.validarCNPJ(dadosFornecedor.cnpj)) {
                return erroResponse(res, 'CNPJ inválido', 400);
            }

            if (dadosFornecedor.cpf && !validacoes.validarCPF(dadosFornecedor.cpf)) {
                return erroResponse(res, 'CPF inválido', 400);
            }

            if (dadosFornecedor.email && !validacoes.validarEmail(dadosFornecedor.email)) {
                return erroResponse(res, 'Email inválido', 400);
            }

            // Verificar documento duplicado (excluindo o próprio fornecedor)
            const documento = dadosFornecedor.cnpj || dadosFornecedor.cpf;
            if (documento) {
                const documentoExistente = await Fornecedor.verificarDocumento(documento, empresaId, parseInt(id));

                if (documentoExistente) {
                    return erroResponse(res, 'CNPJ/CPF já cadastrado para outro fornecedor', 409);
                }
            }

            const fornecedorAtualizado = await Fornecedor.atualizar(
                parseInt(id),
                dadosFornecedor,
                usuarioLogado.id,
                empresaId
            );

            if (!fornecedorAtualizado) {
                return erroResponse(res, 'Erro ao atualizar fornecedor', 500);
            }

            return sucessoResponse(res, fornecedorAtualizado, 'Fornecedor atualizado com sucesso');
        } catch (error) {
            next(error);
        }
    },

    /**
     * Excluir fornecedor
     */
    excluir: async (req, res, next) => {
        try {
            const { id } = req.params;
            const usuarioLogado = req.usuario;

            if (!id || isNaN(id)) {
                return erroResponse(res, 'ID do fornecedor inválido', 400);
            }

            // Verificar permissões - apenas admin empresa e gerente podem excluir
            if (usuarioLogado.nivel_hierarquia > 3) {
                return erroResponse(res, 'Permissão insuficiente para excluir fornecedores', 403);
            }

            const empresaId = usuarioLogado.nivel_hierarquia === 1 ? null : usuarioLogado.empresa_id;
            const fornecedorExcluido = await Fornecedor.excluir(parseInt(id), usuarioLogado.id, empresaId);

            if (!fornecedorExcluido) {
                return erroResponse(res, 'Fornecedor não encontrado ou já excluído', 404);
            }

            return sucessoResponse(res, null, 'Fornecedor excluído com sucesso');
        } catch (error) {
            next(error);
        }
    },

    /**
     * Listar produtos do fornecedor
     */
    listarProdutos: async (req, res, next) => {
        try {
            const { id } = req.params;
            const usuarioLogado = req.usuario;

            if (!id || isNaN(id)) {
                return erroResponse(res, 'ID do fornecedor inválido', 400);
            }

            const empresaId = usuarioLogado.nivel_hierarquia === 1 ? null : usuarioLogado.empresa_id;
            const produtos = await Fornecedor.listarProdutos(parseInt(id), empresaId);

            return sucessoResponse(res, produtos, 'Produtos do fornecedor listados com sucesso');
        } catch (error) {
            next(error);
        }
    }
};

module.exports = fornecedoresController;