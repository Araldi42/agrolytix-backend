// PADRÃO DE RESPOSTA BACKEND - DEVE SER USADO EM TODOS OS CONTROLLERS

/**
 * Resposta de Sucesso Padrão
 */
const sucessoResponse = (res, dados, mensagem = 'Operação realizada com sucesso', status = 200) => {
    return res.status(status).json({
        sucesso: true,
        mensagem,
        dados,
        timestamp: new Date().toISOString()
    });
};

/**
 * Resposta de Sucesso com Paginação
 */
const respostaPaginada = (res, dados, total, pagina, limite, mensagem = 'Dados listados com sucesso') => {
    return res.status(200).json({
        sucesso: true,
        mensagem,
        dados,
        paginacao: {
            total,
            pagina_atual: pagina,
            limite,
            total_paginas: Math.ceil(total / limite),
            tem_proxima: pagina < Math.ceil(total / limite),
            tem_anterior: pagina > 1
        },
        timestamp: new Date().toISOString()
    });
};

/**
 * Resposta de Erro Padrão
 */
const erroResponse = (res, mensagem, status = 400, detalhes = null) => {
    return res.status(status).json({
        sucesso: false,
        mensagem,
        ...(detalhes && { detalhes }),
        timestamp: new Date().toISOString()
    });
};

module.exports = {
    sucessoResponse,
    respostaPaginada,
    erroResponse
};