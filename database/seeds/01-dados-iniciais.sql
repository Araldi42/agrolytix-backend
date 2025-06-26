-- ===================================================================
-- DADOS INICIAIS - AGROLYTIX SISTEMA COMPLETO
-- ===================================================================

-- 1. PERFIS DE USUÁRIO
INSERT INTO perfis_usuario (id, nome, descricao, nivel_hierarquia, permissoes) VALUES
(1, 'Admin Sistema', 'Administrador do sistema SaaS', 1, '{"all": ["*"]}'),
(2, 'Admin Empresa', 'Administrador da empresa/fazenda', 2, '{"empresas": ["editar"], "usuarios": ["criar", "editar"], "all_modules": ["*"]}'),
(3, 'Gerente', 'Gerente da fazenda', 3, '{"produtos": ["*"], "movimentacoes": ["*"], "relatorios": ["visualizar"]}'),
(4, 'Operador', 'Operador de campo/estoque', 4, '{"produtos": ["visualizar"], "movimentacoes": ["criar", "visualizar"]}'),
(5, 'Somente Leitura', 'Acesso apenas para consulta', 5, '{"all": ["visualizar"]}');

-- 2. UNIDADES DE MEDIDA
INSERT INTO unidades_medida (id, nome, sigla, tipo, fator_conversao_base) VALUES
(1, 'Quilograma', 'kg', 'peso', 1.0),
(2, 'Tonelada', 't', 'peso', 1000.0),
(3, 'Grama', 'g', 'peso', 0.001),
(4, 'Litro', 'l', 'volume', 1.0),
(5, 'Metro Cúbico', 'm³', 'volume', 1000.0),
(6, 'Mililitro', 'ml', 'volume', 0.001),
(7, 'Unidade', 'un', 'quantidade', 1.0),
(8, 'Hectare', 'ha', 'area', 1.0),
(9, 'Metro', 'm', 'comprimento', 1.0),
(10, 'Saca 60kg', 'sc', 'peso', 60.0);

-- 3. TIPOS DE MOVIMENTAÇÃO
INSERT INTO tipos_movimentacao (id, codigo, nome, tipo, operacao, afeta_estoque, requer_aprovacao) VALUES
(1, 'ENT_COMPRA', 'Entrada por Compra', 'entrada', '+', true, false),
(2, 'ENT_PRODUCAO', 'Entrada por Produção', 'entrada', '+', true, false),
(3, 'ENT_DOACAO', 'Entrada por Doação', 'entrada', '+', true, true),
(4, 'SAI_VENDA', 'Saída por Venda', 'saida', '-', true, false),
(5, 'SAI_CONSUMO', 'Saída por Consumo/Uso', 'saida', '-', true, false),
(6, 'SAI_PERDA', 'Saída por Perda/Quebra', 'saida', '-', true, true),
(7, 'TRF_SETOR', 'Transferência entre Setores', 'transferencia', '+', true, false),
(8, 'AJU_POSITIVO', 'Ajuste Positivo de Estoque', 'ajuste', '+', true, true),
(9, 'AJU_NEGATIVO', 'Ajuste Negativo de Estoque', 'ajuste', '-', true, true),
(10, 'SAI_APLICACAO', 'Saída para Aplicação no Campo', 'saida', '-', true, false);

-- 4. EMPRESA E ESTRUTURA EXEMPLO
INSERT INTO empresas (id, razao_social, nome_fantasia, cnpj, email, telefone, cidade, estado, plano_assinatura) VALUES
(1, 'Fazenda Santa Maria Ltda', 'Fazenda Santa Maria', '12.345.678/0001-90', 'contato@fazendasantamaria.com.br', '(11) 99999-9999', 'Sorriso', 'MT', 'premium');

INSERT INTO fazendas (id, empresa_id, nome, codigo, endereco_completo, cidade, estado, area_total_hectares, tipo_producao) VALUES
(1, 1, 'Sede Principal', 'SM001', 'Rod. MT-222, Km 15, Zona Rural', 'Sorriso', 'MT', 2500.00, 'grãos'),
(2, 1, 'Unidade Norte', 'SM002', 'Fazenda São João, Zona Rural', 'Nova Mutum', 'MT', 1800.00, 'grãos');

INSERT INTO setores (id, fazenda_id, nome, tipo, capacidade_maxima, unidade_capacidade) VALUES
(1, 1, 'Galpão Central', 'deposito', 5000.00, 'toneladas'),
(2, 1, 'Depósito de Defensivos', 'deposito', 200.00, 'litros'),
(3, 1, 'Oficina Mecânica', 'oficina', null, null),
(4, 1, 'Campo A', 'campo', 500.00, 'hectares'),
(5, 2, 'Armazém Norte', 'deposito', 3000.00, 'toneladas'),
(6, 2, 'Campo Norte 1', 'campo', 800.00, 'hectares');

-- 5. USUÁRIOS EXEMPLO
INSERT INTO usuarios (id, empresa_id, perfil_id, nome, login, email, senha, cpf, telefone, cargo) VALUES
(1, null, 1, 'Admin Agrolytix', 'admin', 'admin@agrolytix.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', null, null, 'Administrador Sistema'),
(2, 1, 2, 'João Silva', 'joao.silva', 'joao@fazendasantamaria.com.br', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '123.456.789-00', '(65) 99888-7777', 'Administrador'),
(3, 1, 3, 'Maria Santos', 'maria.santos', 'maria@fazendasantamaria.com.br', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '987.654.321-00', '(65) 99777-6666', 'Gerente de Operações'),
(4, 1, 4, 'Carlos Oliveira', 'carlos.oliveira', 'carlos@fazendasantamaria.com.br', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '456.789.123-00', '(65) 99666-5555', 'Operador de Campo');

-- 6. CATEGORIAS GLOBAIS E DA EMPRESA
INSERT INTO categorias (id, empresa_id, nome, descricao, icone, cor, criado_por) VALUES
(1, null, 'Agrodefensivos', 'Produtos para proteção de plantações', '🛡️', '#FF6B6B', 1),
(2, null, 'Fertilizantes', 'Produtos para nutrição do solo e plantas', '🌱', '#4ECDC4', 1),
(3, null, 'Sementes e Grãos', 'Sementes para plantio e grãos', '🌾', '#45B7D1', 1),
(4, null, 'Corretivos', 'Produtos para correção do solo', '🏔️', '#96CEB4', 1),
(5, null, 'Máquinas e Equipamentos', 'Tratores, implementos e equipamentos', '🚜', '#FFEAA7', 1),
(6, null, 'Ferramentas', 'Ferramentas manuais e equipamentos menores', '🔧', '#DDA0DD', 1),
(7, 1, 'Combustíveis', 'Diesel, gasolina e óleos', '⛽', '#FF7675', 2),
(8, 1, 'Peças e Acessórios', 'Peças de reposição e acessórios', '⚙️', '#74B9FF', 2);

-- 7. TIPOS POR CATEGORIA
INSERT INTO tipos (id, categoria_id, empresa_id, nome, descricao, unidade_medida_padrao_id, vida_util_meses, perecivel, validade_dias, controla_lote, controla_serie, criado_por) VALUES
-- Agrodefensivos
(1, 1, null, 'Herbicida', 'Produto para controle de ervas daninhas', 4, null, true, 1095, true, false, 1),
(2, 1, null, 'Fungicida', 'Produto para controle de fungos', 4, null, true, 1095, true, false, 1),
(3, 1, null, 'Inseticida', 'Produto para controle de insetos', 4, null, true, 1095, true, false, 1),
(4, 1, null, 'Acaricida', 'Produto para controle de ácaros', 4, null, true, 1095, true, false, 1),

-- Fertilizantes
(5, 2, null, 'NPK Formulado', 'Fertilizante com nitrogênio, fósforo e potássio', 1, null, false, null, true, false, 1),
(6, 2, null, 'Ureia', 'Fertilizante nitrogenado', 1, null, false, null, true, false, 1),
(7, 2, null, 'Superfosfato Simples', 'Fertilizante fosfatado', 1, null, false, null, true, false, 1),
(8, 2, null, 'Cloreto de Potássio', 'Fertilizante potássico', 1, null, false, null, true, false, 1),

-- Sementes e Grãos
(9, 3, null, 'Soja', 'Sementes e grãos de soja', 1, null, false, null, true, false, 1),
(10, 3, null, 'Milho', 'Sementes e grãos de milho', 1, null, false, null, true, false, 1),
(11, 3, null, 'Algodão', 'Sementes de algodão', 1, null, false, null, true, false, 1),
(12, 3, null, 'Milheto', 'Sementes de milheto para cobertura', 1, null, false, null, true, false, 1),

-- Corretivos
(13, 4, null, 'Calcário Dolomítico', 'Corretivo de acidez do solo', 2, null, false, null, true, false, 1),
(14, 4, null, 'Gesso Agrícola', 'Condicionador de solo', 2, null, false, null, true, false, 1),

-- Máquinas e Equipamentos
(15, 5, null, 'Trator', 'Trator agrícola', 7, 120, false, null, false, true, 1),
(16, 5, null, 'Pulverizador', 'Equipamento para aplicação de defensivos', 7, 60, false, null, false, true, 1),
(17, 5, null, 'Plantadeira', 'Equipamento para plantio', 7, 84, false, null, false, true, 1),
(18, 5, null, 'Colheitadeira', 'Equipamento para colheita', 7, 120, false, null, false, true, 1),

-- Combustíveis (específico da empresa)
(19, 7, 1, 'Diesel S10', 'Combustível diesel S10', 4, null, false, null, true, false, 2),
(20, 7, 1, 'Óleo Hidráulico', 'Óleo para sistema hidráulico', 4, null, false, null, true, false, 2);

-- 8. FORNECEDORES EXEMPLO
INSERT INTO fornecedores (id, empresa_id, tipo_pessoa, nome, nome_fantasia, cnpj, email, telefone, cidade, estado, prazo_pagamento_padrao, rating, criado_por) VALUES
(1, null, 'juridica', 'Bayer S.A.', 'Bayer', '18.459.628/0001-15', 'vendas@bayer.com.br', '(11) 2173-8000', 'São Paulo', 'SP', 30, 4.5, 1),
(2, null, 'juridica', 'Syngenta Seeds Ltda', 'Syngenta', '60.768.077/0001-90', 'atendimento@syngenta.com', '(11) 3037-6100', 'São Paulo', 'SP', 28, 4.8, 1),
(3, 1, 'juridica', 'Distribuidora Agrícola Sorriso Ltda', 'Agro Sorriso', '12.345.678/0001-11', 'vendas@agrosorriso.com.br', '(65) 3544-5000', 'Sorriso', 'MT', 21, 4.2, 2),
(4, 1, 'fisica', 'José da Silva Santos', 'Seu José Sementes', '123.456.789-00', 'josesilva@email.com', '(65) 99123-4567', 'Nova Mutum', 'MT', 15, 3.8, 2),
(5, 1, 'juridica', 'Posto Rota Verde Ltda', 'Posto Rota Verde', '98.765.432/0001-22', 'vendas@rotaverde.com.br', '(65) 3333-4444', 'Sorriso', 'MT', 7, 4.0, 2);

-- 9. CLIENTES EXEMPLO
INSERT INTO clientes (id, empresa_id, tipo_pessoa, nome, nome_fantasia, cnpj, email, telefone, cidade, estado, limite_credito, prazo_pagamento_dias, criado_por) VALUES
(1, 1, 'juridica', 'Cargill Agrícola S.A.', 'Cargill', '60.498.706/0001-57', 'compras@cargill.com', '(11) 3575-8000', 'São Paulo', 'SP', 5000000.00, 45, 2),
(2, 1, 'juridica', 'ADM do Brasil Ltda', 'ADM', '60.542.797/0001-43', 'comercial@adm.com', '(11) 2136-2000', 'São Paulo', 'SP', 3000000.00, 30, 2),
(3, 1, 'juridica', 'Cooperativa Agrícola de Sorriso', 'Coop Sorriso', '15.234.567/0001-88', 'recebimento@coopsorriso.com.br', '(65) 3544-2000', 'Sorriso', 'MT', 2000000.00, 21, 2);

-- 10. PRODUTOS EXEMPLO
INSERT INTO produtos (id, empresa_id, fazenda_id, tipo_id, codigo_interno, nome, marca, modelo, valor_aquisicao, data_aquisicao, fornecedor_id, categoria_produto, status, criado_por) VALUES
-- Insumos
(1, 1, 1, 1, 'HERB001', 'Roundup Original DI', 'Bayer', 'Glifosato 480g/L', 45.50, '2024-01-15', 1, 'insumo', 'ativo', 2),
(2, 1, 1, 2, 'FUNG001', 'Fox Xpro', 'Bayer', 'Trifloxistrobina + Protioconazol', 85.90, '2024-01-20', 1, 'insumo', 'ativo', 2),
(3, 1, 1, 5, 'FERT001', 'NPK 04-14-08', 'Yara', 'Formulado NPK', 1850.00, '2024-02-10', 3, 'insumo', 'ativo', 2),
(4, 1, 1, 9, 'SOJA001', 'Semente Soja RR', 'Syngenta', 'Variedade NK7059', 180.00, '2024-03-01', 2, 'insumo', 'ativo', 2),
(5, 1, 1, 19, 'DIES001', 'Diesel S10', 'Petrobras', 'Combustível', 5.50, '2024-06-01', 5, 'insumo', 'ativo', 2),

-- Ativos/Equipamentos
(6, 1, 1, 15, 'TRAT001', 'Trator John Deere 6155R', 'John Deere', '6155R', 450000.00, '2023-05-15', 3, 'ativo', 'ativo', 2),
(7, 1, 1, 16, 'PULV001', 'Pulverizador Jacto Uniport 2030', 'Jacto', 'Uniport 2030', 180000.00, '2023-08-20', 3, 'ativo', 'ativo', 2),
(8, 1, 2, 15, 'TRAT002', 'Trator Case Magnum 340', 'Case', 'Magnum 340', 520000.00, '2024-01-10', 3, 'ativo', 'ativo', 2);

-- 11. LOTES EXEMPLO
INSERT INTO lotes (id, produto_id, numero_lote, data_fabricacao, data_vencimento, quantidade_inicial, fornecedor_id) VALUES
(1, 1, 'HERB001-L2024001', '2024-01-10', '2027-01-10', 500.00, 1),
(2, 2, 'FUNG001-L2024002', '2024-01-15', '2027-01-15', 200.00, 1),
(3, 3, 'FERT001-L2024003', '2024-02-05', null, 2000.00, 3),
(4, 4, 'SOJA001-L2024004', '2023-12-20', null, 1000.00, 2),
(5, 5, 'DIES001-L2024005', '2024-06-01', null, 10000.00, 5);

-- 12. ESTOQUE INICIAL
INSERT INTO estoque (produto_id, setor_id, lote_id, quantidade_atual, valor_unitario_medio) VALUES
-- Galpão Central
(1, 1, 1, 450.00, 45.50),  -- Herbicida
(2, 1, 2, 180.00, 85.90),  -- Fungicida
(3, 1, 3, 1800.00, 1850.00), -- NPK
(4, 1, 4, 900.00, 180.00),  -- Soja

-- Depósito de Defensivos
(1, 2, 1, 50.00, 45.50),   -- Herbicida
(2, 2, 2, 20.00, 85.90),   -- Fungicida

-- Depósito de combustível (setor seria criado separadamente)
(5, 1, 5, 8500.00, 5.50),  -- Diesel

-- Equipamentos na oficina
(6, 3, null, 1.00, 450000.00), -- Trator 1
(7, 3, null, 1.00, 180000.00), -- Pulverizador
(8, 5, null, 1.00, 520000.00); -- Trator 2 (na unidade norte)

-- 13. MOVIMENTAÇÕES EXEMPLO
INSERT INTO movimentacoes (id, empresa_id, fazenda_id, tipo_movimentacao_id, numero_documento, data_movimentacao, destino_setor_id, fornecedor_id, valor_total, observacoes, usuario_criacao) VALUES
(1, 1, 1, 1, 'NF-12345', '2024-01-15 14:30:00', 1, 1, 22750.00, 'Compra de herbicida para safra 2024/25', 2),
(2, 1, 1, 1, 'NF-12346', '2024-01-20 09:15:00', 1, 1, 17180.00, 'Compra de fungicida', 2),
(3, 1, 1, 1, 'NF-54321', '2024-02-10 16:20:00', 1, 3, 3700000.00, 'Compra de fertilizante NPK', 2),
(4, 1, 1, 5, '', '2024-06-15 08:00:00', null, null, 0.00, 'Aplicação de herbicida no campo A', 4),
(5, 1, 1, 7, 'TRF-001', '2024-01-16 10:30:00', 2, null, 0.00, 'Transferência de defensivos para depósito específico', 3);

INSERT INTO movimentacao_itens (id, movimentacao_id, produto_id, lote_id, quantidade, valor_unitario) VALUES
-- Entrada de herbicida
(1, 1, 1, 1, 500.00, 45.50),
-- Entrada de fungicida
(2, 2, 2, 2, 200.00, 85.90),
-- Entrada de NPK
(3, 3, 3, 3, 2000.00, 1850.00),
-- Aplicação no campo (saída)
(4, 4, 1, 1, 50.00, 45.50),
-- Transferência entre setores
(5, 5, 1, 1, 50.00, 45.50),
(6, 5, 2, 2, 20.00, 85.90);

-- 14. SAFRA EXEMPLO
INSERT INTO safras (id, fazenda_id, nome, cultura, area_hectares, data_inicio, data_fim, status, producao_estimada, unidade_producao, custo_total, observacoes, criado_por) VALUES
(1, 1, 'Safra Soja 2024/25', 'Soja', 1200.00, '2024-09-15', '2025-02-28', 'andamento', 4200.00, 'toneladas', 2800000.00, 'Safra principal com expectativa de alta produtividade', 2),
(2, 1, 'Safrinha Milho 2025', 'Milho', 800.00, '2025-03-01', '2025-07-31', 'planejamento', 5600.00, 'toneladas', 1500000.00, 'Plantio de milho após colheita da soja', 2),
(3, 2, 'Safra Soja Norte 2024/25', 'Soja', 1600.00, '2024-09-20', '2025-03-10', 'andamento', 5440.00, 'toneladas', 3200000.00, 'Safra na unidade norte', 2);

-- 15. MANUTENÇÕES EXEMPLO
INSERT INTO manutencoes (id, produto_id, tipo_manutencao, data_manutencao, horas_equipamento, descricao_servico, custo_total, fornecedor_id, proximo_servico_horas, observacoes, criado_por) VALUES
(1, 6, 'preventiva', '2024-05-15', 250, 'Troca de óleo do motor e filtros', 850.00, 3, 500, 'Manutenção conforme manual do fabricante', 3),
(2, 7, 'corretiva', '2024-04-20', 180, 'Reparo no sistema hidráulico do pulverizador', 1200.00, 3, null, 'Vazamento identificado durante operação', 4),
(3, 6, 'periodica', '2024-03-10', 200, 'Revisão dos 200 horas', 1500.00, 3, 450, 'Revisão programada', 3);

-- ===================================================================
-- ATUALIZAÇÃO DA SENHA DO ADMIN
-- ===================================================================

-- Atualizar senha do usuário admin para "admin123" com o hash especificado
UPDATE usuarios 
SET senha = '$2a$12$.L9w5D0r..vwyHxxg55kmOe/WSD1gXC.6K4Vk8a3.n.UWJ1sVOHdy'
WHERE email = 'admin@agrolytix.com' OR login = 'admin';

-- ===================================================================
-- RESET DAS SEQUENCES
-- ===================================================================

-- Reset das sequences para evitar conflitos de ID
SELECT setval('empresas_id_seq', 1, true);
SELECT setval('fazendas_id_seq', 2, true);
SELECT setval('setores_id_seq', 6, true);
SELECT setval('usuarios_id_seq', 4, true);
SELECT setval('categorias_id_seq', 8, true);
SELECT setval('tipos_id_seq', 20, true);
SELECT setval('fornecedores_id_seq', 5, true);
SELECT setval('clientes_id_seq', 3, true);
SELECT setval('produtos_id_seq', 8, true);
SELECT setval('lotes_id_seq', 5, true);
SELECT setval('movimentacoes_id_seq', 5, true);
SELECT setval('movimentacao_itens_id_seq', 6, true);
SELECT setval('safras_id_seq', 3, true);
SELECT setval('manutencoes_id_seq', 3, true);

-- Log de conclusão
DO $$
BEGIN
    RAISE NOTICE 'Dados iniciais do Agrolytix inseridos com sucesso!';
    RAISE NOTICE 'Senha do admin atualizada: admin123';
    RAISE NOTICE 'Sistema pronto para uso!';
END $$; 