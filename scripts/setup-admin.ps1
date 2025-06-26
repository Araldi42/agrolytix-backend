# Script para configurar usuário admin
Write-Host "Configurando usuario admin..." -ForegroundColor Green

# Atualizar senha do usuário admin existente
$updateQuery = "UPDATE usuarios SET senha = '$2a$12$.L9w5D0r..vwyHxxg55kmOe/WSD1gXC.6K4Vk8a3.n.UWJ1sVOHdy';"

Write-Host "Atualizando senha do admin..." -ForegroundColor Yellow
docker-compose exec postgres psql -U agrolytix_user -d agrolytix_db -c $updateQuery

# Verificar se foi atualizado
Write-Host "Verificando usuario..." -ForegroundColor Yellow
docker-compose exec postgres psql -U agrolytix_user -d agrolytix_db -c "SELECT id, nome, email FROM usuarios WHERE email = 'admin@agrolytix.com';"

# Atualizar perfil do usuário admin
Write-Host "Atualizando perfil do admin..." -ForegroundColor Yellow
docker-compose exec postgres psql -U agrolytix_user -d agrolytix_db -c "UPDATE usuarios SET perfil_id = 1 WHERE email = 'admin@agrolytix.com';"

Write-Host "`nUsuario admin configurado!" -ForegroundColor Green
Write-Host "Email: admin@agrolytix.com" -ForegroundColor Cyan
Write-Host "Senha: admin123" -ForegroundColor Cyan 