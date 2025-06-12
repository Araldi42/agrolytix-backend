/**
 * Model Usuario
 * Representa usuários do sistema
 */

const BaseModel = require('./BaseModel');
const bcrypt = require('bcrypt');

class Usuario extends BaseModel {
    constructor() {
        super('usuarios', 'id');
        
        this.fillable = [
            'empresa_id', 'nome', 'email', 'senha', 'cpf',
            'telefone', 'cargo', 'nivel_hierarquia', 'foto_url',
            'configuracoes_usuario', 'status'
        ];

        this.hidden = ['senha'];

        this.casts = {
            ativo: 'boolean',
            nivel_hierarquia: 'number',
            configuracoes_usuario: 'json',
            ultimo_acesso: 'date',
            criado_em: 'date',
            atualizado_em: 'date'
        };
    }

    /**
     * Criar usuário com senha criptografada
     */
    async create(data, userId = null) {
        if (data.senha) {
            data.senha = await bcrypt.hash(data.senha, 10);
        }

        return await super.create(data, userId);
    }

    /**
     * Atualizar usuário (criptografar senha se fornecida)
     */
    async update(id, data, userId = null) {
        if (data.senha) {
            data.senha = await bcrypt.hash(data.senha, 10);
        }

        return await super.update(id, data, userId);
    }

    /**
     * Buscar usuário por email
     */
    async findByEmail(email) {
        return await this.findOne({ email, ativo: true });
    }

    /**
     * Verificar senha
     */
    async verificarSenha(senhaDigitada, senhaHash) {
        return await bcrypt.compare(senhaDigitada, senhaHash);
    }

    /**
     * Buscar usuários por empresa
     */
    async findByEmpresa(empresaId, options = {}) {
        const sql = `
            SELECT 
                u.id, u.nome, u.email, u.cpf, u.telefone,
                u.cargo, u.nivel_hierarquia, u.status, u.ultimo_acesso,
                u.criado_em, u.atualizado_em,
                e.nome_fantasia as empresa_nome
            FROM usuarios u
            INNER JOIN empresas e ON u.empresa_id = e.id
            WHERE u.empresa_id = $1 AND u.ativo = true
            ORDER BY u.nome
        `;

        return await this.customQuery(sql, [empresaId]);
    }

    /**
     * Atualizar último acesso
     */
    async updateUltimoAcesso(id) {
        const sql = `
            UPDATE usuarios 
            SET ultimo_acesso = CURRENT_TIMESTAMP
            WHERE id = $1
        `;

        await this.customQuery(sql, [id]);
    }

    /**
     * Verificar se email é único
     */
    async isEmailUnique(email, excludeId = null) {
        const where = { email, ativo: true };

        if (excludeId) {
            where.id = { operator: '!=', value: excludeId };
        }

        return !(await this.exists(where));
    }

    /**
     * Verificar se CPF é único
     */
    async isCpfUnique(cpf, excludeId = null) {
        const where = { cpf, ativo: true };

        if (excludeId) {
            where.id = { operator: '!=', value: excludeId };
        }

        return !(await this.exists(where));
    }
}

module.exports = new Usuario(); 