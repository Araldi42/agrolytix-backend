-- ===================================================================
-- DDL CONSOLIDADO AGROLYTIX - SISTEMA COMPLETO DE GESTÃO AGRÍCOLA
-- ===================================================================

-- ===================================================================
-- 1. ESTRUTURA ORGANIZACIONAL
-- ===================================================================

-- Empresas (clientes do SaaS)
CREATE TABLE empresas (
    id SERIAL PRIMARY KEY,
    razao_social VARCHAR(255) NOT NULL,
    nome_fantasia VARCHAR(255),
    cnpj VARCHAR(18) UNIQUE,
    inscricao_estadual VARCHAR(50),
    email VARCHAR(255),
    telefone VARCHAR(20),
    endereco_completo TEXT,
    cep VARCHAR(10),
    cidade VARCHAR(100),
    estado VARCHAR(2),
    plano_assinatura VARCHAR(50) DEFAULT 'basico', -- basico, premium, enterprise
    data_vencimento_plano DATE,
    ativo BOOLEAN DEFAULT true,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Fazendas/Sedes da empresa
CREATE TABLE fazendas (
    id SERIAL PRIMARY KEY,
    empresa_id INTEGER NOT NULL REFERENCES empresas(id),
    nome VARCHAR(255) NOT NULL,
    codigo VARCHAR(50), -- codigo interno
    endereco_completo TEXT,
    cep VARCHAR(10),
    cidade VARCHAR(100),
    estado VARCHAR(2),
    area_total_hectares DECIMAL(10,2),
    coordenadas_gps POINT, -- latitude, longitude
    tipo_producao VARCHAR(100), -- grãos, frutas, pecuária, mista
    observacoes TEXT,
    ativo BOOLEAN DEFAULT true,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Setores/Galpões/Locais de armazenamento
CREATE TABLE setores (
    id SERIAL PRIMARY KEY,
    fazenda_id INTEGER NOT NULL REFERENCES fazendas(id),
    nome VARCHAR(255) NOT NULL, -- Galpão A, Depósito Central, Campo 1
    tipo VARCHAR(50) DEFAULT 'deposito', -- deposito, galpao, campo, silo, estacao
    capacidade_maxima DECIMAL(10,2),
    unidade_capacidade VARCHAR(20), -- toneladas, litros, m³, unidades
    coordenadas_gps POINT,
    observacoes TEXT,
    ativo BOOLEAN DEFAULT true,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===================================================================
-- 2. GESTÃO DE USUÁRIOS E PERMISSÕES
-- ===================================================================

-- Perfis/Níveis de usuário
CREATE TABLE perfis_usuario (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL UNIQUE,
    descricao TEXT,
    nivel_hierarquia INTEGER, -- 1=admin_sistema, 2=admin_empresa, 3=gerente, 4=operador, 5=readonly
    permissoes JSONB, -- {"categorias": ["criar", "editar"], "ativos": ["visualizar"]}
    ativo BOOLEAN DEFAULT true,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Usuários (EXPANDIDO da tabela original)
CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    empresa_id INTEGER REFERENCES empresas(id), -- null = admin sistema
    perfil_id INTEGER NOT NULL REFERENCES perfis_usuario(id) DEFAULT 4,
    nome VARCHAR(255) NOT NULL,
    login VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    senha VARCHAR(255) NOT NULL,
    cpf VARCHAR(14),
    telefone VARCHAR(20),
    cargo VARCHAR(100),
    ultimo_acesso TIMESTAMP,
    ativo BOOLEAN DEFAULT true,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Usuários x Fazendas (acesso multi-fazenda)
CREATE TABLE usuario_fazendas (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
    fazenda_id INTEGER NOT NULL REFERENCES fazendas(id),
    ativo BOOLEAN DEFAULT true,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(usuario_id, fazenda_id)
);

-- ===================================================================
-- 3. ESTRUTURA DE PRODUTOS E CLASSIFICAÇÃO
-- ===================================================================

-- Unidades de medida
CREATE TABLE unidades_medida (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(50) NOT NULL,
    sigla VARCHAR(10) NOT NULL UNIQUE,
    tipo VARCHAR(20), -- peso, volume, comprimento, quantidade
    fator_conversao_base DECIMAL(10,6) DEFAULT 1, -- para conversões
    ativo BOOLEAN DEFAULT true,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Categorias (MANTIDA compatível com estrutura atual)
CREATE TABLE categorias (
    id SERIAL PRIMARY KEY,
    empresa_id INTEGER REFERENCES empresas(id), -- null = categoria global do sistema
    nome VARCHAR(255) NOT NULL,
    descricao TEXT,
    categoria_pai_id INTEGER REFERENCES categorias(id), -- hierarquia opcional
    icone VARCHAR(50), -- para interface
    cor VARCHAR(7), -- hex color
    ativo BOOLEAN DEFAULT true,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    criado_por INTEGER REFERENCES usuarios(id),
    atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    atualizado_por INTEGER REFERENCES usuarios(id),
    UNIQUE(nome, empresa_id) -- nome único por empresa
);

-- Tipos (EXPANDIDO da estrutura atual)
CREATE TABLE tipos (
    id SERIAL PRIMARY KEY,
    categoria_id INTEGER NOT NULL REFERENCES categorias(id),
    empresa_id INTEGER REFERENCES empresas(id), -- null = tipo global
    nome VARCHAR(255) NOT NULL,
    descricao TEXT,
    unidade_medida_padrao_id INTEGER REFERENCES unidades_medida(id),
    vida_util_meses INTEGER, -- para depreciação de ativos
    perecivel BOOLEAN DEFAULT false,
    validade_dias INTEGER, -- se perecível, validade padrão
    estoque_minimo DECIMAL(10,2),
    estoque_maximo DECIMAL(10,2),
    controla_lote BOOLEAN DEFAULT false,
    controla_serie BOOLEAN DEFAULT false,
    ativo BOOLEAN DEFAULT true,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    criado_por INTEGER REFERENCES usuarios(id),
    atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    atualizado_por INTEGER REFERENCES usuarios(id),
    UNIQUE(nome, categoria_id, empresa_id)
);

-- ===================================================================
-- 4. FORNECEDORES E CLIENTES (EXPANDIDO)
-- ===================================================================

-- Fornecedores (EXPANDIDO da estrutura atual)
CREATE TABLE fornecedores (
    id SERIAL PRIMARY KEY,
    empresa_id INTEGER REFERENCES empresas(id), -- null = fornecedor global
    tipo_pessoa VARCHAR(10) NOT NULL DEFAULT 'juridica', -- fisica, juridica
    nome VARCHAR(255) NOT NULL, -- razão social ou nome
    nome_fantasia VARCHAR(255),
    cnpj VARCHAR(18),
    cpf VARCHAR(14),
    inscricao_estadual VARCHAR(50),
    contato VARCHAR(255), -- pessoa de contato
    email VARCHAR(255),
    telefone VARCHAR(20),
    whatsapp VARCHAR(20),
    endereco TEXT,
    cep VARCHAR(10),
    cidade VARCHAR(100),
    estado VARCHAR(2),
    prazo_pagamento_padrao INTEGER, -- dias
    observacoes TEXT,
    rating DECIMAL(3,2), -- avaliação 0.00 a 5.00
    ativo BOOLEAN DEFAULT true,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    criado_por INTEGER REFERENCES usuarios(id),
    atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    atualizado_por INTEGER REFERENCES usuarios(id)
);

-- Clientes (para vendas da produção)
CREATE TABLE clientes (
    id SERIAL PRIMARY KEY,
    empresa_id INTEGER NOT NULL REFERENCES empresas(id),
    tipo_pessoa VARCHAR(10) NOT NULL DEFAULT 'juridica',
    nome VARCHAR(255) NOT NULL,
    nome_fantasia VARCHAR(255),
    cnpj VARCHAR(18),
    cpf VARCHAR(14),
    email VARCHAR(255),
    telefone VARCHAR(20),
    endereco TEXT,
    cep VARCHAR(10),
    cidade VARCHAR(100),
    estado VARCHAR(2),
    limite_credito DECIMAL(15,2),
    prazo_pagamento_dias INTEGER DEFAULT 30,
    observacoes TEXT,
    ativo BOOLEAN DEFAULT true,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    criado_por INTEGER REFERENCES usuarios(id),
    atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Produtos oferecidos pelos fornecedores
CREATE TABLE fornecedor_produtos (
    id SERIAL PRIMARY KEY,
    fornecedor_id INTEGER NOT NULL REFERENCES fornecedores(id),
    tipo_id INTEGER NOT NULL REFERENCES tipos(id),
    preco_unitario DECIMAL(15,2),
    unidade_medida_id INTEGER REFERENCES unidades_medida(id),
    prazo_entrega_dias INTEGER,
    ativo BOOLEAN DEFAULT true,
    atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(fornecedor_id, tipo_id)
);

-- ===================================================================
-- 5. PRODUTOS E CONTROLE DE ESTOQUE
-- ===================================================================

-- Produtos/Ativos (RENOMEADO e EXPANDIDO da tabela "ativos")
CREATE TABLE produtos (
    id SERIAL PRIMARY KEY,
    empresa_id INTEGER NOT NULL REFERENCES empresas(id),
    fazenda_id INTEGER NOT NULL REFERENCES fazendas(id),
    tipo_id INTEGER NOT NULL REFERENCES tipos(id),
    codigo_interno VARCHAR(100), -- código da empresa/fazenda
    codigo_barras VARCHAR(50),
    nome VARCHAR(255) NOT NULL,
    descricao TEXT,
    numero_serie VARCHAR(255),
    marca VARCHAR(100),
    modelo VARCHAR(100),
    ano_fabricacao INTEGER,
    valor_aquisicao DECIMAL(15,2),
    data_aquisicao DATE,
    fornecedor_id INTEGER REFERENCES fornecedores(id),
    categoria_produto VARCHAR(50) DEFAULT 'insumo', -- insumo, ativo, produto_acabado
    status VARCHAR(50) DEFAULT 'ativo', -- ativo, manutencao, vendido, baixado
    observacoes TEXT,
    ativo BOOLEAN DEFAULT true,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    criado_por INTEGER REFERENCES usuarios(id),
    atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    atualizado_por INTEGER REFERENCES usuarios(id)
);

-- Lotes de produtos (para rastreabilidade)
CREATE TABLE lotes (
    id SERIAL PRIMARY KEY,
    produto_id INTEGER NOT NULL REFERENCES produtos(id),
    numero_lote VARCHAR(100) NOT NULL,
    data_fabricacao DATE,
    data_vencimento DATE,
    quantidade_inicial DECIMAL(15,3),
    fornecedor_id INTEGER REFERENCES fornecedores(id),
    observacoes TEXT,
    ativo BOOLEAN DEFAULT true,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(produto_id, numero_lote)
);

-- Controle de estoque por produto/setor
CREATE TABLE estoque (
    id SERIAL PRIMARY KEY,
    produto_id INTEGER NOT NULL REFERENCES produtos(id),
    setor_id INTEGER NOT NULL REFERENCES setores(id),
    lote_id INTEGER REFERENCES lotes(id),
    quantidade_atual DECIMAL(15,3) NOT NULL DEFAULT 0,
    quantidade_reservada DECIMAL(15,3) DEFAULT 0,
    quantidade_disponivel DECIMAL(15,3) GENERATED ALWAYS AS (quantidade_atual - quantidade_reservada) STORED,
    valor_unitario_medio DECIMAL(15,2), -- custo médio ponderado
    valor_total DECIMAL(15,2) GENERATED ALWAYS AS (quantidade_atual * valor_unitario_medio) STORED,
    data_ultima_movimentacao TIMESTAMP,
    atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(produto_id, setor_id, lote_id)
);

-- ===================================================================
-- 6. MOVIMENTAÇÕES DE ESTOQUE
-- ===================================================================

-- Tipos de movimentação
CREATE TABLE tipos_movimentacao (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(20) NOT NULL UNIQUE,
    nome VARCHAR(100) NOT NULL,
    tipo VARCHAR(20) NOT NULL, -- entrada, saida, transferencia, ajuste, producao
    operacao VARCHAR(10) NOT NULL, -- + (soma) ou - (subtrai)
    afeta_estoque BOOLEAN DEFAULT true,
    requer_aprovacao BOOLEAN DEFAULT false,
    permite_valor_negativo BOOLEAN DEFAULT false,
    ativo BOOLEAN DEFAULT true
);

-- Cabeçalho das movimentações
CREATE TABLE movimentacoes (
    id SERIAL PRIMARY KEY,
    empresa_id INTEGER NOT NULL REFERENCES empresas(id),
    fazenda_id INTEGER NOT NULL REFERENCES fazendas(id),
    tipo_movimentacao_id INTEGER NOT NULL REFERENCES tipos_movimentacao(id),
    numero_documento VARCHAR(100), -- NF, ordem, etc
    data_movimentacao TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    origem_setor_id INTEGER REFERENCES setores(id),
    destino_setor_id INTEGER REFERENCES setores(id),
    fornecedor_id INTEGER REFERENCES fornecedores(id),
    cliente_id INTEGER REFERENCES clientes(id),
    valor_total DECIMAL(15,2),
    observacoes TEXT,
    status VARCHAR(50) DEFAULT 'confirmado', -- pendente, confirmado, cancelado
    usuario_criacao INTEGER NOT NULL REFERENCES usuarios(id),
    usuario_aprovacao INTEGER REFERENCES usuarios(id),
    data_aprovacao TIMESTAMP,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Itens das movimentações
CREATE TABLE movimentacao_itens (
    id SERIAL PRIMARY KEY,
    movimentacao_id INTEGER NOT NULL REFERENCES movimentacoes(id),
    produto_id INTEGER NOT NULL REFERENCES produtos(id),
    lote_id INTEGER REFERENCES lotes(id),
    quantidade DECIMAL(15,3) NOT NULL,
    valor_unitario DECIMAL(15,2),
    valor_total DECIMAL(15,2) GENERATED ALWAYS AS (quantidade * valor_unitario) STORED,
    data_vencimento DATE,
    observacoes TEXT
);

-- ===================================================================
-- 7. SAFRAS E OPERAÇÕES (SIMPLIFICADO)
-- ===================================================================

-- Safras/Ciclos produtivos (versão simplificada)
CREATE TABLE safras (
    id SERIAL PRIMARY KEY,
    fazenda_id INTEGER NOT NULL REFERENCES fazendas(id),
    nome VARCHAR(255) NOT NULL, -- Safra Soja 2024/25
    cultura VARCHAR(100), -- soja, milho, algodão
    area_hectares DECIMAL(10,2),
    data_inicio DATE,
    data_fim DATE,
    status VARCHAR(50) DEFAULT 'planejamento', -- planejamento, andamento, finalizada
    producao_estimada DECIMAL(10,2),
    producao_real DECIMAL(10,2),
    unidade_producao VARCHAR(20) DEFAULT 'toneladas',
    custo_total DECIMAL(15,2),
    receita_total DECIMAL(15,2),
    observacoes TEXT,
    ativo BOOLEAN DEFAULT true,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    criado_por INTEGER REFERENCES usuarios(id)
);

-- ===================================================================
-- 8. MANUTENÇÃO DE ATIVOS (SIMPLIFICADO)
-- ===================================================================

-- Manutenções de equipamentos
CREATE TABLE manutencoes (
    id SERIAL PRIMARY KEY,
    produto_id INTEGER NOT NULL REFERENCES produtos(id),
    tipo_manutencao VARCHAR(50) DEFAULT 'corretiva', -- preventiva, corretiva, periodica
    data_manutencao DATE NOT NULL,
    horas_equipamento INTEGER,
    km_equipamento INTEGER,
    descricao_servico TEXT,
    custo_total DECIMAL(15,2),
    fornecedor_id INTEGER REFERENCES fornecedores(id),
    proximo_servico_horas INTEGER,
    proximo_servico_km INTEGER,
    observacoes TEXT,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    criado_por INTEGER REFERENCES usuarios(id)
);

-- ===================================================================
-- 8222. auditoria
-- ===================================================================

-- auditoria
CREATE TABLE auditoria (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL,
    acao TEXT NOT NULL,
    tabela_afetada TEXT NOT NULL,
    registro_id INTEGER NOT NULL,
    dados_anteriores JSONB,
    dados_novos JSONB,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- ===================================================================
-- 9. ÍNDICES PARA PERFORMANCE
-- ===================================================================

-- Índices básicos (mantidos da estrutura original)
CREATE INDEX idx_usuarios_email ON usuarios(email);
CREATE INDEX idx_usuarios_login ON usuarios(login);
CREATE INDEX idx_usuarios_empresa ON usuarios(empresa_id);

-- Índices para hierarquia
CREATE INDEX idx_fazendas_empresa ON fazendas(empresa_id);
CREATE INDEX idx_setores_fazenda ON setores(fazenda_id);
CREATE INDEX idx_produtos_empresa_fazenda ON produtos(empresa_id, fazenda_id);
CREATE INDEX idx_produtos_tipo ON produtos(tipo_id);

-- Índices para estoque e movimentações
CREATE INDEX idx_estoque_produto_setor ON estoque(produto_id, setor_id);
CREATE INDEX idx_movimentacoes_data ON movimentacoes(data_movimentacao);
CREATE INDEX idx_movimentacoes_empresa_fazenda ON movimentacoes(empresa_id, fazenda_id);
CREATE INDEX idx_movimentacao_itens_produto ON movimentacao_itens(produto_id);

-- Índices para relacionamentos
CREATE INDEX idx_tipos_categoria ON tipos(categoria_id);
CREATE INDEX idx_fornecedores_empresa ON fornecedores(empresa_id);
CREATE INDEX idx_lotes_produto ON lotes(produto_id);

-- Índices geográficos (se usar dados geográficos)
CREATE INDEX idx_fazendas_coordenadas ON fazendas USING GIST (coordenadas_gps);
CREATE INDEX idx_setores_coordenadas ON setores USING GIST (coordenadas_gps);

-- ===================================================================
-- 10. FUNÇÕES E TRIGGERS
-- ===================================================================

-- Função para atualizar timestamp (mantida da estrutura original)
CREATE OR REPLACE FUNCTION atualizar_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.atualizado_em = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para timestamp automático
CREATE TRIGGER trigger_empresas_timestamp BEFORE UPDATE ON empresas
    FOR EACH ROW EXECUTE FUNCTION atualizar_timestamp();

CREATE TRIGGER trigger_fazendas_timestamp BEFORE UPDATE ON fazendas
    FOR EACH ROW EXECUTE FUNCTION atualizar_timestamp();

CREATE TRIGGER trigger_usuarios_timestamp BEFORE UPDATE ON usuarios
    FOR EACH ROW EXECUTE FUNCTION atualizar_timestamp();

CREATE TRIGGER trigger_categorias_timestamp BEFORE UPDATE ON categorias
    FOR EACH ROW EXECUTE FUNCTION atualizar_timestamp();

CREATE TRIGGER trigger_tipos_timestamp BEFORE UPDATE ON tipos
    FOR EACH ROW EXECUTE FUNCTION atualizar_timestamp();

CREATE TRIGGER trigger_fornecedores_timestamp BEFORE UPDATE ON fornecedores
    FOR EACH ROW EXECUTE FUNCTION atualizar_timestamp();

CREATE TRIGGER trigger_produtos_timestamp BEFORE UPDATE ON produtos
    FOR EACH ROW EXECUTE FUNCTION atualizar_timestamp();

CREATE TRIGGER trigger_movimentacoes_timestamp BEFORE UPDATE ON movimentacoes
    FOR EACH ROW EXECUTE FUNCTION atualizar_timestamp();

-- Função para atualizar estoque automaticamente
CREATE OR REPLACE FUNCTION atualizar_estoque_trigger()
RETURNS TRIGGER AS $$
DECLARE
    tipo_op VARCHAR(10);
    setor_origem INTEGER;
    setor_destino INTEGER;
BEGIN
    -- Buscar informações da movimentação
    SELECT tm.operacao, m.origem_setor_id, m.destino_setor_id
    INTO tipo_op, setor_origem, setor_destino
    FROM movimentacoes m
    JOIN tipos_movimentacao tm ON m.tipo_movimentacao_id = tm.id
    WHERE m.id = NEW.movimentacao_id;

    -- Atualizar estoque baseado no tipo de operação
    IF tipo_op = '+' THEN
        -- Entrada de estoque
        INSERT INTO estoque (produto_id, setor_id, lote_id, quantidade_atual, valor_unitario_medio)
        VALUES (NEW.produto_id, setor_destino, NEW.lote_id, NEW.quantidade, NEW.valor_unitario)
        ON CONFLICT (produto_id, setor_id, lote_id)
        DO UPDATE SET 
            quantidade_atual = estoque.quantidade_atual + NEW.quantidade,
            valor_unitario_medio = ((estoque.quantidade_atual * estoque.valor_unitario_medio) + (NEW.quantidade * NEW.valor_unitario)) / (estoque.quantidade_atual + NEW.quantidade),
            atualizado_em = CURRENT_TIMESTAMP;
    
    ELSIF tipo_op = '-' THEN
        -- Saída de estoque
        UPDATE estoque 
        SET quantidade_atual = quantidade_atual - NEW.quantidade,
            atualizado_em = CURRENT_TIMESTAMP
        WHERE produto_id = NEW.produto_id 
        AND setor_id = setor_origem 
        AND (lote_id = NEW.lote_id OR (lote_id IS NULL AND NEW.lote_id IS NULL));
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_atualizar_estoque
    AFTER INSERT ON movimentacao_itens
    FOR EACH ROW EXECUTE FUNCTION atualizar_estoque_trigger();

-- Log de criação das tabelas
DO $$
BEGIN
    RAISE NOTICE 'Sistema Agrolytix - DDL consolidado aplicado com sucesso!';
    RAISE NOTICE 'Todas as tabelas, índices, funções e triggers foram criados.';
END $$; 