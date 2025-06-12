# Configurações do Servidor
PORT=3001
NODE_ENV=development

# Configurações do Banco de Dados PostgreSQL
DB_HOST=192.168.0.196
DB_PORT=5432
# MUDANÇA: Usar 'postgres' em vez de 'admin'
DB_USER=postgres
DB_PASSWORD=bpm@2025!
DB_NAME=agrolytix-db

# Configurações JWT
JWT_SECRET=sua_chave_secreta_agrolytix_2024_super_segura
JWT_EXPIRES_IN=7d

# Configurações da Aplicação
BCRYPT_SALT_ROUNDS=10