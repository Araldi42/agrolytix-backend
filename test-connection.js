// backend/test-connection.js
// Script isolado para testar conexão com PostgreSQL

require('dotenv').config();
const { Pool } = require('pg');

console.log('🔍 Testando conexão com PostgreSQL...');
console.log('📋 Configurações:');
console.log(`   Host: ${process.env.DB_HOST}`);
console.log(`   Port: ${process.env.DB_PORT}`);
console.log(`   User: ${process.env.DB_USER}`);
console.log(`   Database: ${process.env.DB_NAME}`);
console.log(`   Password: ${process.env.DB_PASSWORD ? '[DEFINIDA]' : '[NÃO DEFINIDA]'}`);

const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    connectionTimeoutMillis: 5000,
    ssl: false
});

async function testarConexao() {
    let client;
    try {
        console.log('\n🔌 Tentando conectar...');
        client = await pool.connect();

        console.log('✅ Conectado! Executando query de teste...');
        const result = await client.query('SELECT NOW() as agora, current_database() as banco');

        console.log('✅ Query executada com sucesso!');
        console.log(`   Hora: ${result.rows[0].agora}`);
        console.log(`   Banco: ${result.rows[0].banco}`);

        // Testar se as tabelas existem
        const tabelas = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name
        `);

        console.log(`\n📊 Tabelas encontradas (${tabelas.rows.length}):`);
        tabelas.rows.forEach(row => {
            console.log(`   - ${row.table_name}`);
        });

    } catch (error) {
        console.error('\n❌ Erro na conexão:');
        console.error(`   Tipo: ${error.constructor.name}`);
        console.error(`   Código: ${error.code || 'N/A'}`);
        console.error(`   Mensagem: ${error.message}`);

        if (error.code === 'ECONNREFUSED') {
            console.error('\n💡 Possíveis soluções:');
            console.error('   1. Verifique se PostgreSQL está rodando');
            console.error('   2. Verifique se o IP 192.168.0.196 está correto');
            console.error('   3. Verifique se a porta 5432 está aberta');
        } else if (error.message.includes('password') || error.message.includes('SCRAM')) {
            console.error('\n💡 Problema com senha:');
            console.error('   1. Remova aspas da senha no .env');
            console.error('   2. Verifique se a senha está correta');
            console.error('   3. Tente conectar manualmente: psql -h 192.168.0.196 -U postgres -d agrolytix-db');
        }
    } finally {
        if (client) {
            client.release();
        }
        await pool.end();
        console.log('\n🔒 Conexão fechada');
    }
}

testarConexao();