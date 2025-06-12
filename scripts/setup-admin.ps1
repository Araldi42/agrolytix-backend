# Script para configurar usuário admin
Write-Host "Configurando usuario admin..." -ForegroundColor Green

# Atualizar senha do usuário admin existente
$updateQuery = "UPDATE usuarios SET senha = '`$2a`$10`$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi' WHERE email = 'admin@agrolytix.com';"

Write-Host "Atualizando senha do admin..." -ForegroundColor Yellow
docker-compose exec postgres psql -U agrolytix_user -d agrolytix_db -c $updateQuery

# Verificar se foi atualizado
Write-Host "Verificando usuario..." -ForegroundColor Yellow
docker-compose exec postgres psql -U agrolytix_user -d agrolytix_db -c "SELECT id, nome, email FROM usuarios WHERE email = 'admin@agrolytix.com';"

Write-Host "`nUsuario admin configurado!" -ForegroundColor Green
Write-Host "Email: admin@agrolytix.com" -ForegroundColor Cyan
Write-Host "Senha: admin123" -ForegroundColor Cyan 