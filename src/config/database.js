const { Pool } = require('pg');
require('dotenv').config();

/**
 * Configuração da conexão com PostgreSQL - CORRIGIDA para senhas com caracteres especiais
 */
const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, // Remove aspas se existirem
    database: process.env.DB_NAME,
    max: 20, // Máximo de conexões simultâneas
    idleTimeoutMillis: 30000, // Tempo limite para conexões inativas
    connectionTimeoutMillis: 5000, // Aumentado para 5 segundos
    // Configurações adicionais para resolver problemas de autenticação
    ssl: false, // Desabilitar SSL se não estiver configurado
    allowExitOnIdle: true // Permitir que o processo termine quando idle
});

/**
 * Função para executar queries no banco
 * @param {string} text - Query SQL
 * @param {Array} params - Parâmetros da query
 * @returns {Promise} Resultado da query
 */
const query = async (text, params) => {
    const start = Date.now();
    try {
        const res = await pool.query(text, params);
        const duration = Date.now() - start;
        console.log('Query executada:', { text: text.substring(0, 50) + '...', duration, rows: res.rowCount });
        return res;
    } catch (error) {
        console.error('Erro na query:', { 
            text: text.substring(0, 100) + '...', 
            error: error.message,
            code: error.code,
            detail: error.detail
        });
        throw error;
    }
};

/**
 * Função para obter um cliente do pool (para transações)
 * @returns {Promise} Cliente do pool
 */
const getClient = async () => {
    const client = await pool.connect();
    return client;
};

/**
 * Função para testar a conexão com o banco
 */
const testarConexao = async () => {
    let client;
    try {
        console.log('🔍 Testando conexão com PostgreSQL...');
        console.log(`📍 Host: ${process.env.DB_HOST}:${process.env.DB_PORT}`);
        console.log(`👤 Usuário: ${process.env.DB_USER}`);
        console.log(`🗄️ Banco: ${process.env.DB_NAME}`);
        
        client = await pool.connect();
        const result = await client.query('SELECT NOW() as agora, version() as versao');
        
        console.log('✅ Conexão com PostgreSQL estabelecida!');
        console.log(`🕐 Hora do servidor: ${result.rows[0].agora}`);
        console.log(`📦 Versão: ${result.rows[0].versao.split(' ')[0]}`);
        
        return true;
    } catch (error) {
        console.error('❌ Erro ao conectar com PostgreSQL:');
        console.error(`   Mensagem: ${error.message}`);
        console.error(`   Código: ${error.code || 'N/A'}`);
        
        if (error.code === 'ECONNREFUSED') {
            console.error('   💡 O servidor PostgreSQL não está rodando ou não é acessível');
        } else if (error.code === 'ENOTFOUND') {
            console.error('   💡 Host não encontrado. Verifique o IP do servidor');
        } else if (error.message.includes('password')) {
            console.error('   💡 Problema com autenticação. Verifique usuário/senha');
        }
        
        return false;
    } finally {
        if (client) {
            client.release();
        }
    }
};

/**
 * Função para fechar todas as conexões do pool
 */
const fecharConexoes = async () => {
    try {
        await pool.end();
        console.log('🔒 Pool de conexões fechado');
    } catch (error) {
        console.error('Erro ao fechar conexões:', error.message);
    }
};

// Fechar conexões quando a aplicação for finalizada
process.on('SIGINT', () => {
    console.log('\n🛑 Finalizando aplicação...');
    fecharConexoes().then(() => {
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Finalizando aplicação...');
    fecharConexoes().then(() => {
        process.exit(0);
    });
});

module.exports = {
    query,
    getClient,
    pool,
    testarConexao,
    fecharConexoes
};