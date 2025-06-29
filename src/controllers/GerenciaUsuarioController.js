// ===================================================================
// CONTROLLER: GerenciaUsuarioController.js - VERSÃO CORRIGIDA SEM THIS
// ===================================================================
const GerenciaUsuario = require('../models/GerenciaUsuario');
const { sucessoResponse, respostaPaginada, erroResponse } = require('../utils/responseUtils');
const validacoes = require('../utils/validacoes');

class GerenciaUsuariosController {
    /**
     * ✅ CORRIGIDO: Determinar empresa_id baseado no usuário
     */
    static determinarEmpresaId(usuarioLogado, queryEmpresaId) {
        if (usuarioLogado.nivel_hierarquia === 1) {
            // Admin sistema: usar empresa_id da query string (empresa selecionada)
            return queryEmpresaId ? parseInt(queryEmpresaId) : undefined;
        } else {
            // Usuário normal: sempre usar sua própria empresa
            return usuarioLogado.empresa_id;
        }
    }

    /**
     * Listar usuários com filtros
     */
    static async listar(req, res) {
        try {
            const usuarioLogado = req.usuario;

            // Verificar se usuário pode gerenciar usuários
            if (usuarioLogado.nivel_hierarquia > 2) {
                return erroResponse(res, 'Acesso negado. Apenas administradores e gerentes podem listar usuários', 403);
            }

            // ✅ CORREÇÃO: Usar nome da classe em vez de this
            const empresaIdFiltro = GerenciaUsuariosController.determinarEmpresaId(usuarioLogado, req.query.empresa_id);

            // Se admin sistema não selecionou empresa, retornar erro
            if (usuarioLogado.nivel_hierarquia === 1 && !empresaIdFiltro) {
                return erroResponse(res, 'Selecione uma empresa para listar usuários', 400);
            }

            // Filtros da query string
            const filtros = {
                empresa_id: empresaIdFiltro,
                perfil_id: req.query.perfil_id ? parseInt(req.query.perfil_id) : undefined,
                fazenda_id: req.query.fazenda_id ? parseInt(req.query.fazenda_id) : undefined,
                ativo: req.query.ativo !== undefined ? req.query.ativo === 'true' : undefined,
                busca: req.query.busca || undefined
            };

            // Paginação
            const paginacao = {
                pagina: parseInt(req.query.pagina) || 1,
                limite: parseInt(req.query.limite) || 10
            };

            // Validar limite máximo
            if (paginacao.limite > 50) {
                paginacao.limite = 50;
            }

            const resultado = await GerenciaUsuario.listar(filtros, paginacao);

            return respostaPaginada(
                res,
                resultado.usuarios,
                resultado.total,
                resultado.pagina,
                resultado.limite,
                'Usuários listados com sucesso'
            );

        } catch (error) {
            console.error('Erro ao listar usuários:', error);
            return erroResponse(res, 'Erro interno do servidor', 500);
        }
    }

    /**
     * Buscar usuário por ID
     */
    static async buscarPorId(req, res) {
        try {
            const usuarioLogado = req.usuario;
            const { id } = req.params;

            // Verificar se usuário pode gerenciar usuários
            if (usuarioLogado.nivel_hierarquia > 2) {
                return erroResponse(res, 'Acesso negado', 403);
            }

            const usuario = await GerenciaUsuario.buscarPorId(id);

            if (!usuario) {
                return erroResponse(res, 'Usuário não encontrado', 404);
            }

            // ✅ CORREÇÃO: Verificar empresa apenas se não for admin sistema
            if (usuarioLogado.nivel_hierarquia > 1 && usuario.empresa_id !== usuarioLogado.empresa_id) {
                return erroResponse(res, 'Acesso negado a usuários de outras empresas', 403);
            }

            return sucessoResponse(res, usuario, 'Usuário encontrado');

        } catch (error) {
            console.error('Erro ao buscar usuário:', error);
            return erroResponse(res, 'Erro interno do servidor', 500);
        }
    }

    /**
     * Criar novo usuário
     */
    static async criar(req, res) {
        try {
            const usuarioLogado = req.usuario;

            // Verificar se usuário pode criar usuários
            if (usuarioLogado.nivel_hierarquia > 2) {
                return erroResponse(res, 'Acesso negado. Apenas administradores e gerentes podem criar usuários', 403);
            }

            const {
                perfil_id,
                nome,
                login,
                email,
                senha,
                cpf,
                telefone,
                cargo,
                fazendas_acesso = []
            } = req.body;

            // Validações obrigatórias
            const camposObrigatorios = ['perfil_id', 'nome', 'login', 'email', 'senha'];
            const validacaoCampos = validacoes.validarCamposObrigatorios(req.body, camposObrigatorios);

            if (!validacaoCampos.valido) {
                return erroResponse(res, `Campos obrigatórios: ${validacaoCampos.camposFaltando.join(', ')}`);
            }

            // Validar email
            if (!validacoes.validarEmail(email)) {
                return erroResponse(res, 'Email inválido');
            }

            // Validar senha
            const validacaoSenha = validacoes.validarSenha(senha);
            if (!validacaoSenha.valida) {
                return erroResponse(res, validacaoSenha.mensagens.join('. '));
            }

            // Validar CPF se fornecido
            if (cpf && !validacoes.validarCPF(cpf)) {
                return erroResponse(res, 'CPF inválido');
            }

            // Validar telefone se fornecido
            if (telefone && !validacoes.validarTelefone(telefone)) {
                return erroResponse(res, 'Telefone inválido');
            }

            // Verificar duplicatas
            const duplicata = await GerenciaUsuario.verificarDuplicatas(email, login);
            if (duplicata) {
                return erroResponse(res, `${duplicata.campo_duplicado} já está em uso`);
            }

            // ✅ CORREÇÃO: Usar nome da classe em vez de this
            const empresaIdParaCriacao = GerenciaUsuariosController.determinarEmpresaId(usuarioLogado, req.body.empresa_id);

            if (!empresaIdParaCriacao) {
                return erroResponse(res, 'Empresa é obrigatória para criar usuário');
            }

            // Preparar dados do usuário
            const dadosUsuario = {
                empresa_id: empresaIdParaCriacao,
                perfil_id: parseInt(perfil_id),
                nome: validacoes.sanitizarTexto(nome),
                login: login.trim().toLowerCase(),
                email: email.trim().toLowerCase(),
                senha,
                cpf: cpf ? cpf.replace(/[^\d]/g, '') : null,
                telefone: telefone ? telefone.replace(/[^\d]/g, '') : null,
                cargo: cargo ? validacoes.sanitizarTexto(cargo) : null
            };

            // Validar fazendas de acesso
            const fazendasValidadas = [];
            if (fazendas_acesso && fazendas_acesso.length > 0) {
                for (const fazendaId of fazendas_acesso) {
                    if (Number.isInteger(fazendaId) && fazendaId > 0) {
                        fazendasValidadas.push(fazendaId);
                    }
                }
            }

            const novoUsuario = await GerenciaUsuario.criar(dadosUsuario, fazendasValidadas);

            return sucessoResponse(res, novoUsuario, 'Usuário criado com sucesso', 201);

        } catch (error) {
            console.error('Erro ao criar usuário:', error);

            // Tratar erros específicos do banco
            if (error.code === '23505') {
                return erroResponse(res, 'Email ou login já estão em uso');
            }

            return erroResponse(res, 'Erro interno do servidor', 500);
        }
    }

    /**
     * Atualizar usuário
     */
    static async atualizar(req, res) {
        try {
            const usuarioLogado = req.usuario;
            const { id } = req.params;

            // Verificar se usuário pode editar usuários
            if (usuarioLogado.nivel_hierarquia > 2) {
                return erroResponse(res, 'Acesso negado', 403);
            }

            // Buscar usuário existente
            const usuarioExistente = await GerenciaUsuario.buscarPorId(id);
            if (!usuarioExistente) {
                return erroResponse(res, 'Usuário não encontrado', 404);
            }

            // ✅ CORREÇÃO: Verificar empresa apenas se não for admin sistema
            if (usuarioLogado.nivel_hierarquia > 1 && usuarioExistente.empresa_id !== usuarioLogado.empresa_id) {
                return erroResponse(res, 'Acesso negado a usuários de outras empresas', 403);
            }

            const {
                perfil_id,
                nome,
                login,
                email,
                senha,
                cpf,
                telefone,
                cargo,
                ativo,
                fazendas_acesso
            } = req.body;

            // Validações opcionais (apenas se fornecidas)
            if (email && !validacoes.validarEmail(email)) {
                return erroResponse(res, 'Email inválido');
            }

            if (senha) {
                const validacaoSenha = validacoes.validarSenha(senha);
                if (!validacaoSenha.valida) {
                    return erroResponse(res, validacaoSenha.mensagens.join('. '));
                }
            }

            if (cpf && !validacoes.validarCPF(cpf)) {
                return erroResponse(res, 'CPF inválido');
            }

            if (telefone && !validacoes.validarTelefone(telefone)) {
                return erroResponse(res, 'Telefone inválido');
            }

            // Verificar duplicatas se email/login foram alterados
            if (email || login) {
                const emailVerificar = email || usuarioExistente.email;
                const loginVerificar = login || usuarioExistente.login;

                const duplicata = await GerenciaUsuario.verificarDuplicatas(emailVerificar, loginVerificar, id);
                if (duplicata) {
                    return erroResponse(res, `${duplicata.campo_duplicado} já está em uso`);
                }
            }

            // Preparar dados para atualização
            const dadosAtualizacao = {};

            if (perfil_id !== undefined) dadosAtualizacao.perfil_id = parseInt(perfil_id);
            if (nome !== undefined) dadosAtualizacao.nome = validacoes.sanitizarTexto(nome);
            if (login !== undefined) dadosAtualizacao.login = login.trim().toLowerCase();
            if (email !== undefined) dadosAtualizacao.email = email.trim().toLowerCase();
            if (senha !== undefined) dadosAtualizacao.senha = senha;
            if (cpf !== undefined) dadosAtualizacao.cpf = cpf ? cpf.replace(/[^\d]/g, '') : null;
            if (telefone !== undefined) dadosAtualizacao.telefone = telefone ? telefone.replace(/[^\d]/g, '') : null;
            if (cargo !== undefined) dadosAtualizacao.cargo = cargo ? validacoes.sanitizarTexto(cargo) : null;
            if (typeof ativo === 'boolean') dadosAtualizacao.ativo = ativo;

            // Validar fazendas de acesso se fornecidas
            let fazendasValidadas;
            if (fazendas_acesso !== undefined) {
                fazendasValidadas = [];
                if (Array.isArray(fazendas_acesso)) {
                    for (const fazendaId of fazendas_acesso) {
                        if (Number.isInteger(fazendaId) && fazendaId > 0) {
                            fazendasValidadas.push(fazendaId);
                        }
                    }
                }
            }

            const usuarioAtualizado = await GerenciaUsuario.atualizar(id, dadosAtualizacao, fazendasValidadas);

            return sucessoResponse(res, usuarioAtualizado, 'Usuário atualizado com sucesso');

        } catch (error) {
            console.error('Erro ao atualizar usuário:', error);

            if (error.code === '23505') {
                return erroResponse(res, 'Email ou login já estão em uso');
            }

            return erroResponse(res, 'Erro interno do servidor', 500);
        }
    }

    /**
     * Excluir usuário (soft delete)
     */
    static async excluir(req, res) {
        try {
            const usuarioLogado = req.usuario;
            const { id } = req.params;

            // Verificar se usuário pode excluir usuários
            if (usuarioLogado.nivel_hierarquia > 2) {
                return erroResponse(res, 'Acesso negado', 403);
            }

            // Verificar se não está tentando excluir a si mesmo
            if (parseInt(id) === usuarioLogado.id) {
                return erroResponse(res, 'Não é possível excluir seu próprio usuário');
            }

            // Buscar usuário existente
            const usuarioExistente = await GerenciaUsuario.buscarPorId(id);
            if (!usuarioExistente) {
                return erroResponse(res, 'Usuário não encontrado', 404);
            }

            // ✅ CORREÇÃO: Verificar empresa apenas se não for admin sistema
            if (usuarioLogado.nivel_hierarquia > 1 && usuarioExistente.empresa_id !== usuarioLogado.empresa_id) {
                return erroResponse(res, 'Acesso negado a usuários de outras empresas', 403);
            }

            await GerenciaUsuario.excluir(id);

            return sucessoResponse(res, null, 'Usuário excluído com sucesso');

        } catch (error) {
            console.error('Erro ao excluir usuário:', error);
            return erroResponse(res, 'Erro interno do servidor', 500);
        }
    }

    /**
     * Listar perfis disponíveis
     */
    static async listarPerfis(req, res) {
        try {
            const perfis = await GerenciaUsuario.listarPerfis();
            return sucessoResponse(res, perfis, 'Perfis listados com sucesso');

        } catch (error) {
            console.error('Erro ao listar perfis:', error);
            return erroResponse(res, 'Erro interno do servidor', 500);
        }
    }

    /**
     * Listar fazendas da empresa
     */
    static async listarFazendas(req, res) {
        try {
            const usuarioLogado = req.usuario;

            // ✅ CORREÇÃO: Usar nome da classe em vez de this
            const empresaIdFiltro = GerenciaUsuariosController.determinarEmpresaId(usuarioLogado, req.query.empresa_id);

            if (!empresaIdFiltro) {
                return erroResponse(res, 'Empresa é obrigatória para listar fazendas', 400);
            }

            const fazendas = await GerenciaUsuario.listarFazendas(empresaIdFiltro);
            return sucessoResponse(res, fazendas, 'Fazendas listadas com sucesso');

        } catch (error) {
            console.error('Erro ao listar fazendas:', error);
            return erroResponse(res, 'Erro interno do servidor', 500);
        }
    }
}

module.exports = GerenciaUsuariosController;