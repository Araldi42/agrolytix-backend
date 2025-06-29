// ===================================================================
// routes/fornecedores.js
// ===================================================================

const express = require('express');
const router = express.Router();
const fornecedoresController = require('../controllers/fornecedoresController');
const { autenticacao } = require('../middlewares/authorizationMiddleware');

// Aplicar autenticação em todas as rotas
router.use(autenticacao);

/**
 * @route GET /api/fornecedores
 * @desc Listar fornecedores da empresa
 * @access Todos os usuários autenticados
 * @query {string} nome - Filtro por nome/razão social
 * @query {string} tipo_pessoa - Filtro por tipo (fisica/juridica)
 * @query {string} cidade - Filtro por cidade
 * @query {string} estado - Filtro por estado
 * @query {number} pagina - Página atual (padrão: 1)
 * @query {number} limite - Itens por página (padrão: 20)
 */
router.get('/', fornecedoresController.listar);

/**
 * @route GET /api/fornecedores/:id
 * @desc Buscar fornecedor por ID
 * @access Todos os usuários autenticados
 * @param {number} id - ID do fornecedor
 */
router.get('/:id', fornecedoresController.buscarPorId);

/**
 * @route POST /api/fornecedores
 * @desc Criar novo fornecedor
 * @access Admin Empresa (2), Gerente (3), Operador (4)
 * @body {object} dadosFornecedor - Dados do fornecedor
 */
router.post('/', fornecedoresController.criar);

/**
 * @route PUT /api/fornecedores/:id
 * @desc Atualizar fornecedor
 * @access Admin Empresa (2), Gerente (3), Operador (4)
 * @param {number} id - ID do fornecedor
 * @body {object} dadosFornecedor - Dados atualizados
 */
router.put('/:id', fornecedoresController.atualizar);

/**
 * @route DELETE /api/fornecedores/:id
 * @desc Excluir fornecedor (soft delete)
 * @access Admin Empresa (2), Gerente (3)
 * @param {number} id - ID do fornecedor
 */
router.delete('/:id', fornecedoresController.excluir);

/**
 * @route GET /api/fornecedores/:id/produtos
 * @desc Listar produtos oferecidos pelo fornecedor
 * @access Todos os usuários autenticados
 * @param {number} id - ID do fornecedor
 */
router.get('/:id/produtos', fornecedoresController.listarProdutos);

module.exports = router;

// ===================================================================
// EXEMPLOS DE USO PARA O FRONTEND REACT/NEXT.JS
// ===================================================================

/*
ESTRUTURA DE DADOS RETORNADA:

1. GET /api/fornecedores
Response:
{
  "sucesso": true,
  "mensagem": "Fornecedores listados com sucesso",
  "dados": [
    {
      "id": 1,
      "empresa_id": 1,
      "tipo_pessoa": "juridica",
      "nome": "Bayer S.A.",
      "nome_fantasia": "Bayer",
      "cnpj": "18.459.628/0001-15",
      "cpf": null,
      "inscricao_estadual": null,
      "contato": "João Silva",
      "email": "vendas@bayer.com.br",
      "telefone": "(11) 2173-8000",
      "whatsapp": null,
      "endereco": "Rua das Indústrias, 123",
      "cep": "01234-567",
      "cidade": "São Paulo",
      "estado": "SP",
      "prazo_pagamento_padrao": 30,
      "observacoes": "Fornecedor principal de defensivos",
      "rating": 4.5,
      "ativo": true,
      "criado_em": "2024-01-15T10:30:00.000Z",
      "atualizado_em": "2024-01-15T10:30:00.000Z",
      "criado_por_nome": "João Silva",
      "atualizado_por_nome": null,
      "empresa_nome": "Fazenda Santa Maria",
      "total_produtos": 5
    }
  ],
  "paginacao": {
    "total": 50,
    "pagina_atual": 1,
    "limite": 20,
    "total_paginas": 3,
    "tem_proxima": true,
    "tem_anterior": false
  },
  "timestamp": "2024-12-28T10:00:00.000Z"
}

2. POST /api/fornecedores
Request Body:
{
  "tipo_pessoa": "juridica",
  "nome": "Distribuidora Agrícola ABC Ltda",
  "nome_fantasia": "Agro ABC",
  "cnpj": "12.345.678/0001-90",
  "inscricao_estadual": "123.456.789.123",
  "contato": "Maria Santos",
  "email": "contato@agroabc.com.br",
  "telefone": "(11) 99999-9999",
  "whatsapp": "(11) 99999-9999",
  "endereco": "Rod. BR-101, Km 50",
  "cep": "12345-678",
  "cidade": "Campinas",
  "estado": "SP",
  "prazo_pagamento_padrao": 28,
  "observacoes": "Fornecedor regional de fertilizantes",
  "rating": 4.2
}

PERMISSÕES POR NÍVEL:
- Admin Sistema (1): Pode ver/criar/editar fornecedores globais e de qualquer empresa
- Admin Empresa (2): Pode ver/criar/editar/excluir fornecedores da sua empresa
- Gerente (3): Pode ver/criar/editar/excluir fornecedores da sua empresa
- Operador (4): Pode ver/criar/editar fornecedores da sua empresa
- Somente Leitura (5): Pode apenas visualizar fornecedores

FILTROS DISPONÍVEIS:
- nome: Busca por nome ou nome fantasia (LIKE)
- tipo_pessoa: "fisica" ou "juridica"
- cidade: Busca por cidade (LIKE)
- estado: Sigla do estado (igual)
- pagina: Número da página (padrão: 1)
- limite: Itens por página (padrão: 20)

VALIDAÇÕES IMPLEMENTADAS:
- CNPJ válido para pessoa jurídica
- CPF válido para pessoa física
- Email válido se fornecido
- Campos obrigatórios: tipo_pessoa, nome
- Documento único por empresa
- Permissões por nível hierárquico

ENDPOINTS PARA O FRONTEND:

1. Listar fornecedores:
GET /api/fornecedores?nome=bayer&tipo_pessoa=juridica&pagina=1&limite=20

2. Buscar fornecedor específico:
GET /api/fornecedores/1

3. Criar fornecedor:
POST /api/fornecedores
Content-Type: application/json
Authorization: Bearer {token}

4. Editar fornecedor:
PUT /api/fornecedores/1
Content-Type: application/json
Authorization: Bearer {token}

5. Excluir fornecedor:
DELETE /api/fornecedores/1
Authorization: Bearer {token}

6. Listar produtos do fornecedor:
GET /api/fornecedores/1/produtos

COMPONENTES REACT SUGERIDOS:

1. ListaFornecedores.jsx - Tabela com filtros e paginação
2. FormularioFornecedor.jsx - Formulário para criar/editar
3. DetalheFornecedor.jsx - Modal/página com detalhes
4. FiltrosFornecedores.jsx - Componente de filtros
5. CardFornecedor.jsx - Card para exibição em grid

ESTADOS PARA GERENCIAR NO FRONTEND:

const [fornecedores, setFornecedores] = useState([]);
const [loading, setLoading] = useState(false);
const [filtros, setFiltros] = useState({
  nome: '',
  tipo_pessoa: '',
  cidade: '',
  estado: '',
  pagina: 1,
  limite: 20
});
const [paginacao, setPaginacao] = useState({});
const [fornecedorSelecionado, setFornecedorSelecionado] = useState(null);
const [modalAberto, setModalAberto] = useState(false);

EXEMPLO DE FUNÇÃO PARA BUSCAR FORNECEDORES:

const buscarFornecedores = async () => {
  setLoading(true);
  try {
    const params = new URLSearchParams();
    Object.keys(filtros).forEach(key => {
      if (filtros[key]) params.append(key, filtros[key]);
    });

    const response = await fetch(`/api/fornecedores?${params}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    
    if (data.sucesso) {
      setFornecedores(data.dados);
      setPaginacao(data.paginacao);
    } else {
      console.error(data.mensagem);
    }
  } catch (error) {
    console.error('Erro ao buscar fornecedores:', error);
  } finally {
    setLoading(false);
  }
};

EXEMPLO DE FUNÇÃO PARA CRIAR FORNECEDOR:

const criarFornecedor = async (dadosFornecedor) => {
  try {
    const response = await fetch('/api/fornecedores', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(dadosFornecedor)
    });

    const data = await response.json();
    
    if (data.sucesso) {
      toast.success('Fornecedor criado com sucesso!');
      buscarFornecedores(); // Recarregar lista
      setModalAberto(false);
    } else {
      toast.error(data.mensagem);
    }
  } catch (error) {
    toast.error('Erro ao criar fornecedor');
    console.error(error);
  }
};

CAMPOS DO FORMULÁRIO PARA O FRONTEND:

OBRIGATÓRIOS:
- tipo_pessoa: select com opções "fisica" e "juridica"
- nome: input text (razão social ou nome completo)

OPCIONAIS:
- nome_fantasia: input text
- cnpj: input text com máscara (apenas se juridica)
- cpf: input text com máscara (apenas se fisica)
- inscricao_estadual: input text
- contato: input text (pessoa de contato)
- email: input email
- telefone: input text com máscara
- whatsapp: input text com máscara
- endereco: textarea
- cep: input text com máscara
- cidade: input text
- estado: select com estados brasileiros
- prazo_pagamento_padrao: input number (dias)
- observacoes: textarea
- rating: input number (0-5) ou componente de estrelas

MÁSCARAS SUGERIDAS:
- CNPJ: 99.999.999/9999-99
- CPF: 999.999.999-99
- Telefone: (99) 99999-9999
- CEP: 99999-999

VALIDAÇÕES NO FRONTEND:
- Validar CNPJ em tempo real
- Validar CPF em tempo real
- Validar email
- Mostrar/ocultar campos CPF/CNPJ conforme tipo_pessoa
- Rating entre 0 e 5
- Prazo de pagamento positivo

TRATAMENTO DE ERROS:
- Erro 400: Mostrar mensagem de validação
- Erro 403: Redirecionar ou mostrar "Sem permissão"
- Erro 404: "Fornecedor não encontrado"
- Erro 409: "CNPJ/CPF já cadastrado"
- Erro 500: "Erro interno do servidor"

*/