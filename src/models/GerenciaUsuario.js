// ===================================================================
// MODEL: GerenciaUsuario.js - VERSÃO COMPLETA E CORRIGIDA
// ===================================================================
const { query } = require('../config/database');
const bcrypt = require('bcryptjs');

class GerenciaUsuario {
    /**
     * ✅ CORRIGIDO: Listar usuários com query simplificada
     */
    static async listar(filtros = {}, paginacao = {}) {
        const {
            empresa_id,
            fazenda_id,
            perfil_id,
            ativo,
            busca
        } = filtros;

        const {
            pagina = 1,
            limite = 10
        } = paginacao;

        const offset = (pagina - 1) * limite;

        // ✅ QUERY SIMPLIFICADA - SEM ARRAY_AGG COMPLEXO
        let consulta = `
            SELECT 
                u.id,
                u.empresa_id,
                u.perfil_id,
                u.nome,
                u.login,
                u.email,
                u.cpf,
                u.telefone,
                u.cargo,
                u.ultimo_acesso,
                u.ativo,
                u.criado_em,
                u.atualizado_em,
                p.nome as perfil_nome,
                p.nivel_hierarquia,
                e.nome_fantasia as empresa_nome
            FROM usuarios u
            INNER JOIN perfis_usuario p ON u.perfil_id = p.id
            LEFT JOIN empresas e ON u.empresa_id = e.id
            WHERE 1=1
        `;

        const parametros = [];
        let contadorParam = 1;

        // ✅ FILTROS MAIS SEGUROS
        if (empresa_id && empresa_id !== null && empresa_id !== undefined) {
            consulta += ` AND u.empresa_id = $${contadorParam}`;
            parametros.push(empresa_id);
            contadorParam++;
        }

        if (perfil_id) {
            consulta += ` AND u.perfil_id = $${contadorParam}`;
            parametros.push(perfil_id);
            contadorParam++;
        }

        if (typeof ativo === 'boolean') {
            consulta += ` AND u.ativo = $${contadorParam}`;
            parametros.push(ativo);
            contadorParam++;
        }

        if (fazenda_id) {
            consulta += ` AND EXISTS (
                SELECT 1 FROM usuario_fazendas uf2 
                WHERE uf2.usuario_id = u.id 
                AND uf2.fazenda_id = $${contadorParam}
                AND uf2.ativo = true
            )`;
            parametros.push(fazenda_id);
            contadorParam++;
        }

        if (busca && busca.trim()) {
            consulta += ` AND (
                u.nome ILIKE $${contadorParam} OR
                u.email ILIKE $${contadorParam} OR
                u.login ILIKE $${contadorParam} OR
                u.cargo ILIKE $${contadorParam}
            )`;
            parametros.push(`%${busca.trim()}%`);
            contadorParam++;
        }

        // Excluir admin sistema das listagens
        consulta += ` AND p.nivel_hierarquia > 1`;

        // ORDER BY e LIMIT
        consulta += ` 
            ORDER BY u.nome
            LIMIT $${contadorParam} OFFSET $${contadorParam + 1}
        `;

        parametros.push(limite, offset);

        try {
            // Executar consulta principal
            const resultado = await query(consulta, parametros);

            // ✅ QUERY DE CONTAGEM SIMPLIFICADA
            let consultaTotal = `
                SELECT COUNT(u.id) as total
                FROM usuarios u
                INNER JOIN perfis_usuario p ON u.perfil_id = p.id
                WHERE 1=1
            `;

            const parametrosTotal = [];
            let contadorTotal = 1;

            // Aplicar os mesmos filtros para contagem
            if (empresa_id && empresa_id !== null && empresa_id !== undefined) {
                consultaTotal += ` AND u.empresa_id = $${contadorTotal}`;
                parametrosTotal.push(empresa_id);
                contadorTotal++;
            }

            if (perfil_id) {
                consultaTotal += ` AND u.perfil_id = $${contadorTotal}`;
                parametrosTotal.push(perfil_id);
                contadorTotal++;
            }

            if (typeof ativo === 'boolean') {
                consultaTotal += ` AND u.ativo = $${contadorTotal}`;
                parametrosTotal.push(ativo);
                contadorTotal++;
            }

            if (fazenda_id) {
                consultaTotal += ` AND EXISTS (
                    SELECT 1 FROM usuario_fazendas uf2 
                    WHERE uf2.usuario_id = u.id 
                    AND uf2.fazenda_id = $${contadorTotal}
                    AND uf2.ativo = true
                )`;
                parametrosTotal.push(fazenda_id);
                contadorTotal++;
            }

            if (busca && busca.trim()) {
                consultaTotal += ` AND (
                    u.nome ILIKE $${contadorTotal} OR
                    u.email ILIKE $${contadorTotal} OR
                    u.login ILIKE $${contadorTotal} OR
                    u.cargo ILIKE $${contadorTotal}
                )`;
                parametrosTotal.push(`%${busca.trim()}%`);
            }

            consultaTotal += ` AND p.nivel_hierarquia > 1`;

            const resultadoTotal = await query(consultaTotal, parametrosTotal);
            const total = parseInt(resultadoTotal.rows[0].total);

            // ✅ BUSCAR FAZENDAS SEPARADAMENTE PARA CADA USUÁRIO
            const usuariosComFazendas = await Promise.all(
                resultado.rows.map(async (usuario) => {
                    const fazendas = await query(`
                        SELECT 
                            f.id, f.nome, f.codigo
                        FROM usuario_fazendas uf
                        INNER JOIN fazendas f ON uf.fazenda_id = f.id
                        WHERE uf.usuario_id = $1 AND uf.ativo = true AND f.ativo = true
                        ORDER BY f.nome
                    `, [usuario.id]);

                    return {
                        ...usuario,
                        fazendas_acesso: fazendas.rows
                    };
                })
            );

            return {
                usuarios: usuariosComFazendas,
                total,
                pagina: parseInt(pagina),
                limite: parseInt(limite),
                totalPaginas: Math.ceil(total / limite)
            };

        } catch (error) {
            console.error('Erro na query de usuários:', error);
            throw error;
        }
    }

    /**
     * ✅ CORRIGIDO: Buscar usuário por ID com query simplificada
     */
    static async buscarPorId(id) {
        try {
            // Query principal do usuário
            const consultaUsuario = `
                SELECT 
                    u.id,
                    u.empresa_id,
                    u.perfil_id,
                    u.nome,
                    u.login,
                    u.email,
                    u.cpf,
                    u.telefone,
                    u.cargo,
                    u.ultimo_acesso,
                    u.ativo,
                    u.criado_em,
                    u.atualizado_em,
                    p.nome as perfil_nome,
                    p.nivel_hierarquia,
                    e.nome_fantasia as empresa_nome
                FROM usuarios u
                INNER JOIN perfis_usuario p ON u.perfil_id = p.id
                LEFT JOIN empresas e ON u.empresa_id = e.id
                WHERE u.id = $1
            `;

            const resultadoUsuario = await query(consultaUsuario, [id]);

            if (resultadoUsuario.rows.length === 0) {
                return null;
            }

            const usuario = resultadoUsuario.rows[0];

            // Buscar fazendas do usuário separadamente
            const consultaFazendas = `
                SELECT 
                    f.id, f.nome, f.codigo
                FROM usuario_fazendas uf
                INNER JOIN fazendas f ON uf.fazenda_id = f.id
                WHERE uf.usuario_id = $1 AND uf.ativo = true AND f.ativo = true
                ORDER BY f.nome
            `;

            const resultadoFazendas = await query(consultaFazendas, [id]);

            return {
                ...usuario,
                fazendas_acesso: resultadoFazendas.rows
            };

        } catch (error) {
            console.error('Erro ao buscar usuário por ID:', error);
            throw error;
        }
    }

    /**
     * Criar novo usuário
     */
    static async criar(dadosUsuario, fazendasAcesso = []) {
        const {
            empresa_id,
            perfil_id,
            nome,
            login,
            email,
            senha,
            cpf,
            telefone,
            cargo
        } = dadosUsuario;

        // Hash da senha
        const senhaHash = await bcrypt.hash(senha, 12);

        // Iniciar transação
        const client = await require('../config/database').getClient();

        try {
            await client.query('BEGIN');

            // Inserir usuário
            const consultaUsuario = `
                INSERT INTO usuarios (
                    empresa_id, perfil_id, nome, login, email, senha, 
                    cpf, telefone, cargo, ativo
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
                RETURNING id
            `;

            const resultadoUsuario = await client.query(consultaUsuario, [
                empresa_id, perfil_id, nome, login, email, senhaHash,
                cpf, telefone, cargo
            ]);

            const usuarioId = resultadoUsuario.rows[0].id;

            // Inserir acesso às fazendas
            if (fazendasAcesso && fazendasAcesso.length > 0) {
                const consultaFazendas = `
                    INSERT INTO usuario_fazendas (usuario_id, fazenda_id, ativo)
                    VALUES ($1, $2, true)
                `;

                for (const fazendaId of fazendasAcesso) {
                    await client.query(consultaFazendas, [usuarioId, fazendaId]);
                }
            }

            await client.query('COMMIT');

            // Buscar usuário completo criado
            return await this.buscarPorId(usuarioId);

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Atualizar usuário
     */
    static async atualizar(id, dadosUsuario, fazendasAcesso = []) {
        const {
            perfil_id,
            nome,
            login,
            email,
            senha,
            cpf,
            telefone,
            cargo,
            ativo
        } = dadosUsuario;

        const client = await require('../config/database').getClient();

        try {
            await client.query('BEGIN');

            // Preparar campos para atualização
            const campos = [];
            const valores = [];
            let contador = 1;

            if (perfil_id !== undefined) {
                campos.push(`perfil_id = $${contador}`);
                valores.push(perfil_id);
                contador++;
            }

            if (nome !== undefined) {
                campos.push(`nome = $${contador}`);
                valores.push(nome);
                contador++;
            }

            if (login !== undefined) {
                campos.push(`login = $${contador}`);
                valores.push(login);
                contador++;
            }

            if (email !== undefined) {
                campos.push(`email = $${contador}`);
                valores.push(email);
                contador++;
            }

            if (senha) {
                const senhaHash = await bcrypt.hash(senha, 12);
                campos.push(`senha = $${contador}`);
                valores.push(senhaHash);
                contador++;
            }

            if (cpf !== undefined) {
                campos.push(`cpf = $${contador}`);
                valores.push(cpf);
                contador++;
            }

            if (telefone !== undefined) {
                campos.push(`telefone = $${contador}`);
                valores.push(telefone);
                contador++;
            }

            if (cargo !== undefined) {
                campos.push(`cargo = $${contador}`);
                valores.push(cargo);
                contador++;
            }

            if (typeof ativo === 'boolean') {
                campos.push(`ativo = $${contador}`);
                valores.push(ativo);
                contador++;
            }

            // Atualizar usuário se há campos para atualizar
            if (campos.length > 0) {
                campos.push(`atualizado_em = CURRENT_TIMESTAMP`);
                valores.push(id);

                const consultaAtualizar = `
                    UPDATE usuarios 
                    SET ${campos.join(', ')}
                    WHERE id = $${contador}
                `;

                await client.query(consultaAtualizar, valores);
            }

            // Atualizar acesso às fazendas se fornecido
            if (fazendasAcesso !== undefined) {
                // Remover acessos antigos
                await client.query(
                    'DELETE FROM usuario_fazendas WHERE usuario_id = $1',
                    [id]
                );

                // Inserir novos acessos
                if (fazendasAcesso.length > 0) {
                    const consultaFazendas = `
                        INSERT INTO usuario_fazendas (usuario_id, fazenda_id, ativo)
                        VALUES ($1, $2, true)
                    `;

                    for (const fazendaId of fazendasAcesso) {
                        await client.query(consultaFazendas, [id, fazendaId]);
                    }
                }
            }

            await client.query('COMMIT');

            // Buscar usuário atualizado
            return await this.buscarPorId(id);

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Excluir usuário (soft delete)
     */
    static async excluir(id) {
        const consulta = `
            UPDATE usuarios 
            SET ativo = false, atualizado_em = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING id
        `;

        const resultado = await query(consulta, [id]);
        return resultado.rows[0];
    }

    /**
     * Verificar se email/login já existe
     */
    static async verificarDuplicatas(email, login, idExcluir = null) {
        let consulta = `
            SELECT 
                CASE WHEN email = $1 THEN 'email' ELSE 'login' END as campo_duplicado
            FROM usuarios 
            WHERE (email = $1 OR login = $2)
        `;

        const parametros = [email, login];

        if (idExcluir) {
            consulta += ` AND id != $3`;
            parametros.push(idExcluir);
        }

        const resultado = await query(consulta, parametros);
        return resultado.rows[0];
    }

    /**
     * Listar perfis disponíveis
     */
    static async listarPerfis() {
        const consulta = `
            SELECT id, nome, descricao, nivel_hierarquia
            FROM perfis_usuario 
            WHERE ativo = true AND nivel_hierarquia > 1
            ORDER BY nivel_hierarquia
        `;

        const resultado = await query(consulta);
        return resultado.rows;
    }

    /**
     * Listar fazendas da empresa
     */
    static async listarFazendas(empresaId) {
        const consulta = `
            SELECT id, nome, codigo, cidade, estado, area_total_hectares
            FROM fazendas 
            WHERE empresa_id = $1 AND ativo = true
            ORDER BY nome
        `;

        const resultado = await query(consulta, [empresaId]);
        return resultado.rows;
    }
}

module.exports = GerenciaUsuario;