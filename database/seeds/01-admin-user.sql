-- Script para criar usuário admin inicial
-- Senha: admin123 (hash bcrypt)

-- Primeiro, vamos garantir que existe uma empresa padrão
INSERT INTO empresas (razao_social, nome_fantasia, cnpj, email, telefone, endereco_completo, cidade, estado, cep, ativo)
VALUES (
    'Agrolytix Ltda',
    'Agrolytix',
    '12.345.678/0001-90',
    'contato@agrolytix.com',
    '(11) 3333-4444',
    'Rua da Agricultura, 123',
    'São Paulo',
    'SP',
    '01234-567',
    true
) ON CONFLICT (cnpj) DO NOTHING;

-- Criar perfil admin se não existir
INSERT INTO perfis_usuario (nome, descricao, nivel_hierarquia, permissoes, ativo)
VALUES (
    'Administrador',
    'Perfil com acesso total ao sistema',
    1,
    '{"usuarios": {"criar": true, "visualizar": true, "editar": true, "excluir": true}, "produtos": {"criar": true, "visualizar": true, "editar": true, "excluir": true}, "movimentacoes": {"criar": true, "visualizar": true, "editar": true, "excluir": true}, "relatorios": {"visualizar": true, "exportar": true}}',
    true
) ON CONFLICT (nome) DO NOTHING;

-- Remover usuário admin existente se houver
DELETE FROM usuarios WHERE email = 'admin@agrolytix.com';

-- Criar usuário admin
-- Senha: admin123 (hash bcrypt com salt 10)
INSERT INTO usuarios (
    nome, 
    login, 
    email, 
    senha, 
    empresa_id, 
    perfil_id, 
    ativo
) VALUES (
    'Admin Agrolytix',
    'admin',
    'admin@agrolytix.com',
    '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- admin123
    (SELECT id FROM empresas WHERE cnpj = '12.345.678/0001-90' LIMIT 1),
    (SELECT id FROM perfis_usuario WHERE nome = 'Administrador' LIMIT 1),
    true
);

-- Verificar se foi criado
SELECT 
    u.id, 
    u.nome, 
    u.login, 
    u.email, 
    u.ativo,
    e.nome_fantasia as empresa,
    p.nome as perfil
FROM usuarios u
LEFT JOIN empresas e ON u.empresa_id = e.id
LEFT JOIN perfis_usuario p ON u.perfil_id = p.id
WHERE u.email = 'admin@agrolytix.com'; 