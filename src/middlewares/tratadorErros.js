/**
 * Middleware para tratar erros na API
 */
const tratadorErros = (err, req, res, next) => {
    console.error('Erro capturado:', {
        message: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        timestamp: new Date().toISOString()
    });

    // Verificar se já enviou resposta
    if (res.headersSent) {
        return next(err);
    }

    // Determinar código de status baseado no tipo de erro
    let statusCode = err.statusCode || 500;
    let mensagem = err.message || 'Erro interno do servidor';

    // Tratar erros específicos do PostgreSQL
    if (err.code) {
        switch (err.code) {
            case '23505': // Violação de unicidade
                statusCode = 409;
                mensagem = 'Registro já existe. Verifique os dados únicos.';
                break;
            case '23503': // Violação de chave estrangeira
                statusCode = 400;
                mensagem = 'Referência inválida. Verifique os dados relacionados.';
                break;
            case '23502': // Violação de NOT NULL
                statusCode = 400;
                mensagem = 'Campo obrigatório não fornecido.';
                break;
            case '42P01': // Tabela não existe
                statusCode = 500;
                mensagem = 'Erro de configuração do banco de dados.';
                break;
            case '42703': // Coluna não existe
                statusCode = 500;
                mensagem = 'Erro de configuração do banco de dados.';
                break;
            case '08006': // Falha na conexão
                statusCode = 503;
                mensagem = 'Serviço temporariamente indisponível.';
                break;
            default:
                if (err.code.startsWith('23')) {
                    statusCode = 400;
                    mensagem = 'Violação de integridade dos dados.';
                } else if (err.code.startsWith('42')) {
                    statusCode = 500;
                    mensagem = 'Erro de configuração do sistema.';
                }
        }
    }

    // Tratar erros de validação
    if (err.name === 'ValidationError') {
        statusCode = 400;
        mensagem = err.message;
    }

    // Tratar erros de JWT
    if (err.name === 'JsonWebTokenError') {
        statusCode = 401;
        mensagem = 'Token inválido.';
    }

    if (err.name === 'TokenExpiredError') {
        statusCode = 401;
        mensagem = 'Token expirado.';
    }

    // Resposta padronizada de erro
    const resposta = {
        sucesso: false,
        mensagem,
        timestamp: new Date().toISOString(),
        caminho: req.path
    };

    // Incluir stack trace apenas em desenvolvimento
    if (process.env.NODE_ENV === 'development') {
        resposta.stack = err.stack;
        resposta.detalhes = {
            codigo_erro: err.code,
            nome_erro: err.name
        };
    }

    res.status(statusCode).json(resposta);
};

/**
 * Middleware para capturar rotas não encontradas
 */
const rotaNaoEncontrada = (req, res) => {
    res.status(404).json({
        sucesso: false,
        mensagem: `Rota ${req.method} ${req.path} não encontrada`,
        timestamp: new Date().toISOString()
    });
};

/**
 * Função para criar erro personalizado
 */
const criarErro = (mensagem, statusCode = 500) => {
    const erro = new Error(mensagem);
    erro.statusCode = statusCode;
    return erro;
};

module.exports = {
    tratadorErros,
    rotaNaoEncontrada,
    criarErro
};