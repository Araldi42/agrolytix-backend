const express = require('express');
require('dotenv').config();

// Importar middlewares
const { tratadorErros, rotaNaoEncontrada } = require('./middlewares/tratadorErros');

// Importar rotas
const autenticacaoRoutes = require('./routes/autenticacao');
const usuariosRoutes = require('./routes/usuarios');
const categoriasRoutes = require('./routes/categorias');
const tiposRoutes = require('./routes/tipos');
const fornecedoresRoutes = require('./routes/fornecedores');
const ativosRoutes = require('./routes/ativos');
const produtosRoutes = require('./routes/produtos');
const movimentacoesRoutes = require('./routes/movimentacoes');

// Testar conexão com banco
const { testarConexao } = require('./config/database');

// Inicialização do express
const app = express();
const PORT = process.env.PORT || 3001;

// Configuração de middlewares globais
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Middleware para logs de requisições (desenvolvimento)
if (process.env.NODE_ENV === 'development') {
    app.use((req, res, next) => {
        console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
        next();
    });
}

// Configuração de headers de segurança básica
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
});

// Rotas da API
app.use('/api/auth', autenticacaoRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/categorias', categoriasRoutes);
app.use('/api/tipos', tiposRoutes);
app.use('/api/fornecedores', fornecedoresRoutes);
app.use('/api/ativos', ativosRoutes);
app.use('/api/produtos', produtosRoutes);
app.use('/api/movimentacoes', movimentacoesRoutes);

// Rota raiz para verificar se o servidor está funcionando
app.get('/', (req, res) => {
    res.json({
        sucesso: true,
        mensagem: 'API Agrolytix funcionando!',
        versao: '1.0.0',
        timestamp: new Date().toISOString(),
        endpoints: [
            'GET  / - Status da API',
            'POST /api/auth/login - Login',
            'POST /api/auth/cadastro - Cadastro',
            'GET  /api/auth/verificar - Verificar autenticação',
            'POST /api/auth/logout - Logout',
            'GET  /api/usuarios - Listar usuários',
            'GET  /api/categorias - Listar categorias',
            'GET  /api/tipos - Listar tipos',
            'GET  /api/fornecedores - Listar fornecedores',
            'GET  /api/ativos - Listar ativos'
        ]
    });
});

// Rota para verificar saúde da API e conexão com banco
app.get('/api/saude', async (req, res) => {
    try {
        const conexaoBanco = await testarConexao();

        res.json({
            sucesso: true,
            status: 'saudavel',
            timestamp: new Date().toISOString(),
            servicos: {
                api: 'funcionando',
                banco_dados: conexaoBanco ? 'conectado' : 'desconectado'
            },
            uptime: process.uptime(),
            memoria: {
                usada: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`,
                total: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)} MB`
            }
        });
    } catch (error) {
        res.status(500).json({
            sucesso: false,
            status: 'com_problemas',
            mensagem: 'Erro ao verificar saúde da API',
            timestamp: new Date().toISOString()
        });
    }
});

// Middleware para rotas não encontradas
app.use(rotaNaoEncontrada);

// Middleware de tratamento de erros (deve ser o último)
app.use(tratadorErros);

// Iniciar o servidor
const iniciarServidor = async () => {
    try {
        // Testar conexão com banco antes de iniciar
        const conexaoOk = await testarConexao();

        if (!conexaoOk) {
            console.error('❌ Não foi possível conectar ao banco de dados');
            process.exit(1);
        }

        app.listen(PORT, () => {
            console.log('🚀 Servidor iniciado com sucesso!');
            console.log(`📍 Rodando em: http://localhost:${PORT}`);
            console.log(`🌍 Ambiente: ${process.env.NODE_ENV || 'development'}`);
            console.log(`💾 Banco: ${process.env.DB_NAME} em ${process.env.DB_HOST}`);
            console.log('⏰ Iniciado em:', new Date().toISOString());
            console.log('=====================================');
        });
    } catch (error) {
        console.error('❌ Erro ao iniciar servidor:', error.message);
        process.exit(1);
    }
};

// Iniciar servidor
iniciarServidor();