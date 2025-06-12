require('dotenv').config();
const { query } = require('./src/config/database');
const bcrypt = require('bcryptjs');

async function checkUser() {
    try {
        console.log('🔍 Verificando usuário admin...');
        
        // Buscar usuário admin
        const consultaUsuario = `
            SELECT 
                u.id, u.nome, u.login, u.email, u.senha, u.ativo,
                u.empresa_id, u.perfil_id,
                p.nome as perfil_nome, p.nivel_hierarquia, p.permissoes,
                e.razao_social as empresa_nome
            FROM usuarios u
            LEFT JOIN perfis_usuario p ON u.perfil_id = p.id
            LEFT JOIN empresas e ON u.empresa_id = e.id
            WHERE u.email = 'admin@agrolytix.com'
        `;

        const resultado = await query(consultaUsuario);

        if (resultado.rows.length === 0) {
            console.log('❌ Usuário admin não encontrado!');
            console.log('📋 Executando seed...');
            
            // Executar o script de seed
            const fs = require('fs');
            const seedScript = fs.readFileSync('./database/seeds/01-admin-user.sql', 'utf8');
            await query(seedScript);
            
            console.log('✅ Seed executado!');
            
            // Verificar novamente
            const novoResultado = await query(consultaUsuario);
            if (novoResultado.rows.length > 0) {
                console.log('✅ Usuário admin criado com sucesso!');
                console.log('📋 Dados:', novoResultado.rows[0]);
            }
        } else {
            const usuario = resultado.rows[0];
            console.log('✅ Usuário admin encontrado!');
            console.log(`📋 ID: ${usuario.id}`);
            console.log(`📋 Nome: ${usuario.nome}`);
            console.log(`📋 Login: ${usuario.login}`);
            console.log(`📋 Email: ${usuario.email}`);
            console.log(`📋 Ativo: ${usuario.ativo}`);
            console.log(`📋 Empresa: ${usuario.empresa_nome || 'N/A'}`);
            console.log(`📋 Perfil: ${usuario.perfil_nome || 'N/A'}`);
            
            // Testar senha
            console.log('🔒 Testando senha...');
            const senhaCorreta = await bcrypt.compare('admin123', usuario.senha);
            console.log(`🔒 Senha 'admin123': ${senhaCorreta ? '✅ CORRETA' : '❌ INCORRETA'}`);
            
            if (!senhaCorreta) {
                console.log('🔧 Atualizando senha...');
                const novaSenha = await bcrypt.hash('admin123', 10);
                await query('UPDATE usuarios SET senha = $1 WHERE email = $2', [novaSenha, 'admin@agrolytix.com']);
                console.log('✅ Senha atualizada!');
            }
            
            // Verificar se tem perfil e empresa
            if (!usuario.perfil_id || !usuario.empresa_id) {
                console.log('🔧 Configurando perfil e empresa...');
                
                // Buscar empresa padrão
                const empresaResult = await query("SELECT id FROM empresas WHERE cnpj = '12.345.678/0001-90' LIMIT 1");
                const perfilResult = await query("SELECT id FROM perfis_usuario WHERE nome = 'Administrador' LIMIT 1");
                
                if (empresaResult.rows.length > 0 && perfilResult.rows.length > 0) {
                    await query('UPDATE usuarios SET empresa_id = $1, perfil_id = $2 WHERE email = $3', 
                        [empresaResult.rows[0].id, perfilResult.rows[0].id, 'admin@agrolytix.com']);
                    console.log('✅ Perfil e empresa configurados!');
                } else {
                    console.log('❌ Empresa ou perfil não encontrados. Executando seed completo...');
                    const fs = require('fs');
                    const seedScript = fs.readFileSync('./database/seeds/01-admin-user.sql', 'utf8');
                    await query(seedScript);
                    console.log('✅ Seed executado!');
                }
            }
        }
        
        console.log('\n🎯 Resumo para login:');
        console.log('   Email: admin@agrolytix.com');
        console.log('   Senha: admin123');
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
    }
    
    process.exit(0);
}

checkUser(); 