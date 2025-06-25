const express = require('express');
const cors = require('cors'); // ← NOVO: Importar CORS
require('dotenv').config();

// Importar middlewares
const { tratadorErros, rotaNaoEncontrada } = require('./middlewares/tratadorErros');

// Importar rotas
const autenticacaoRoutes = require('./routes/autenticacao');
const usuariosRoutes = require('./routes/usuarios');
const categoriasRoutes = require('./routes/categorias');
const tiposRoutes = require('./routes/tipos');
const fornecedoresRoutes = require('./routes/fornecedores');
const produtosRoutes = require('./routes/produtos');
const movimentacoesRoutes = require('./routes/movimentacoes');

// Testar conexão com banco
const { testarConexao } = require('./config/database');

// Inicialização do express
const app = express();
const PORT = process.env.PORT || 3001;

// ← NOVO: Configuração de CORS (DEVE VIR ANTES DOS OUTROS MIDDLEWARES)
const corsOptions = {
    origin: [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:3002',
        'http://localhost:3003',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3001',
        'http://127.0.0.1:3002',
        'http://127.0.0.1:3003'
    ],
    credentials: true, // Permitir cookies e headers de autorização
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'Accept',
        'Origin'
    ],
    optionsSuccessStatus: 200
};

// Aplicar CORS
if (process.env.NODE_ENV === 'development') {
    // Em desenvolvimento, permitir qualquer origem
    app.use(cors({
        origin: true,
        credentials: true
    }));
    console.log('🌐 CORS configurado para desenvolvimento (todas as origens permitidas)');
} else {
    // Em produção, usar configuração específica
    app.use(cors(corsOptions));
    console.log('🌐 CORS configurado para produção');
}

// Configuração de middlewares globais
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Middleware para logs de requisições (desenvolvimento)
if (process.env.NODE_ENV === 'development') {
    app.use((req, res, next) => {
        console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - Origin: ${req.headers.origin || 'no-origin'}`);
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
app.use('/api/produtos', produtosRoutes);
app.use('/api/movimentacoes', movimentacoesRoutes);

// Rota raiz para verificar se o servidor está funcionando
app.get('/', (req, res) => {
    res.json({
        sucesso: true,
        mensagem: 'API Agrolytix funcionando!',
        versao: '2.0.0',
        timestamp: new Date().toISOString(),
        cors_enabled: true, // ← NOVO: Indicar que CORS está habilitado
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
            'GET  /api/produtos - Listar produtos (unifica ativos + insumos)',
            'GET  /api/movimentacoes - Listar movimentações'
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
                banco_dados: conexaoBanco ? 'conectado' : 'desconectado',
                cors: 'habilitado' // ← NOVO: Status do CORS
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
            console.log(`🌐 CORS: ${process.env.NODE_ENV === 'development' ? 'Aberto (dev)' : 'Configurado (prod)'}`);
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