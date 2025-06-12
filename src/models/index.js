/**
 * Index dos Models
 * Centraliza e exporta todos os models da aplicação
 */

// Models principais
const BaseModel = require('./BaseModel');
const Produto = require('./Produto');
const Movimentacao = require('./Movimentacao');
const Empresa = require('./Empresa');

// DTOs
const ProdutoDTO = require('./dtos/ProdutoDTO');

module.exports = {
    // Models
    BaseModel,
    Produto,
    Movimentacao,
    Empresa,

    // DTOs
    ProdutoDTO
}; 