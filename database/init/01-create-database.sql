-- Script de inicialização do banco Agrolytix
-- Este arquivo será executado automaticamente quando o container PostgreSQL for criado

-- Configurar encoding e locale
SET client_encoding = 'UTF8';
SET timezone = 'America/Sao_Paulo';

-- Criar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- Função para gerar slugs
CREATE OR REPLACE FUNCTION generate_slug(input_text TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN lower(
        regexp_replace(
            unaccent(trim(input_text)), 
            '[^a-zA-Z0-9\s]', '', 'g'
        )
    );
END;
$$ LANGUAGE plpgsql;

-- Função para atualizar timestamp automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.atualizado_em = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Comentário de inicialização
COMMENT ON DATABASE agrolytix_db IS 'Banco de dados do sistema Agrolytix - Gestão Agrícola SaaS';

-- Log de inicialização
DO $$
BEGIN
    RAISE NOTICE 'Banco de dados Agrolytix inicializado com sucesso!';
    RAISE NOTICE 'Timezone configurado: %', current_setting('timezone');
    RAISE NOTICE 'Encoding configurado: %', current_setting('client_encoding');
END $$; 