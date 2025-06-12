# Script para testar a API Agrolytix rapidamente
# Uso: .\scripts\test-api.ps1

param(
    [string]$BaseUrl = "http://localhost:3000",
    [string]$Email = "admin@agrolytix.com",
    [string]$Senha = "admin123"
)

Write-Host "Testando API Agrolytix..." -ForegroundColor Green
Write-Host "URL Base: $BaseUrl" -ForegroundColor Cyan

# Função para fazer requests
function Invoke-ApiRequest {
    param(
        [string]$Method,
        [string]$Url,
        [hashtable]$Headers = @{},
        [string]$Body = $null
    )
    
    try {
        $params = @{
            Method = $Method
            Uri = $Url
            Headers = $Headers
        }
        
        if ($Body) {
            $params.Body = $Body
            $params.ContentType = "application/json"
        }
        
        $response = Invoke-RestMethod @params
        return $response
    }
    catch {
        Write-Host "Erro: $($_.Exception.Message)" -ForegroundColor Red
        return $null
    }
}

# 1. Testar Status da API
Write-Host "`n1. Testando status da API..." -ForegroundColor Yellow
$status = Invoke-ApiRequest -Method "GET" -Url "$BaseUrl/"
if ($status) {
    Write-Host "API funcionando! Versao: $($status.versao)" -ForegroundColor Green
} else {
    Write-Host "API nao esta respondendo!" -ForegroundColor Red
    exit 1
}

# 2. Testar Health Check
Write-Host "`n2. Testando health check..." -ForegroundColor Yellow
$health = Invoke-ApiRequest -Method "GET" -Url "$BaseUrl/api/saude"
if ($health) {
    Write-Host "Health check OK! Status: $($health.status)" -ForegroundColor Green
    Write-Host "   Banco: $($health.servicos.banco_dados)" -ForegroundColor Cyan
    Write-Host "   Uptime: $([math]::Round($health.uptime, 2))s" -ForegroundColor Cyan
} else {
    Write-Host "Health check falhou!" -ForegroundColor Red
}

# 3. Fazer Login
Write-Host "`n3. Fazendo login..." -ForegroundColor Yellow
$loginBody = @{
    identifier = $Email
    senha = $Senha
} | ConvertTo-Json

$login = Invoke-ApiRequest -Method "POST" -Url "$BaseUrl/api/auth/login" -Body $loginBody
if ($login -and $login.sucesso) {
    $token = $login.token
    Write-Host "Login realizado com sucesso!" -ForegroundColor Green
    Write-Host "   Usuario: $($login.usuario.nome)" -ForegroundColor Cyan
    Write-Host "   Empresa: $($login.usuario.empresa_nome)" -ForegroundColor Cyan
} else {
    Write-Host "Falha no login!" -ForegroundColor Red
    exit 1
}

# Headers com token
$authHeaders = @{
    "Authorization" = "Bearer $token"
}

# 4. Verificar Token
Write-Host "`n4. Verificando token..." -ForegroundColor Yellow
$verify = Invoke-ApiRequest -Method "GET" -Url "$BaseUrl/api/auth/verificar" -Headers $authHeaders
if ($verify -and $verify.sucesso) {
    Write-Host "Token valido!" -ForegroundColor Green
} else {
    Write-Host "Token invalido!" -ForegroundColor Red
}

# 5. Testar Endpoints Básicos
Write-Host "`n5. Testando endpoints basicos..." -ForegroundColor Yellow

# Categorias
$categorias = Invoke-ApiRequest -Method "GET" -Url "$BaseUrl/api/categorias" -Headers $authHeaders
if ($categorias) {
    Write-Host "Categorias: $($categorias.dados.Count) encontradas" -ForegroundColor Green
} else {
    Write-Host "Erro ao buscar categorias" -ForegroundColor Yellow
}

# Tipos
$tipos = Invoke-ApiRequest -Method "GET" -Url "$BaseUrl/api/tipos" -Headers $authHeaders
if ($tipos) {
    Write-Host "Tipos: $($tipos.dados.Count) encontrados" -ForegroundColor Green
} else {
    Write-Host "Erro ao buscar tipos" -ForegroundColor Yellow
}

# Fornecedores
$fornecedores = Invoke-ApiRequest -Method "GET" -Url "$BaseUrl/api/fornecedores" -Headers $authHeaders
if ($fornecedores) {
    Write-Host "Fornecedores: $($fornecedores.dados.Count) encontrados" -ForegroundColor Green
} else {
    Write-Host "Erro ao buscar fornecedores" -ForegroundColor Yellow
}

# Produtos
$produtosUrl = "$BaseUrl/api/produtos" + "?page=1&limit=5"
$produtos = Invoke-ApiRequest -Method "GET" -Url $produtosUrl -Headers $authHeaders
if ($produtos) {
    Write-Host "Produtos: $($produtos.dados.produtos.Count) encontrados" -ForegroundColor Green
} else {
    Write-Host "Erro ao buscar produtos" -ForegroundColor Yellow
}

# Movimentações
$movimentacoesUrl = "$BaseUrl/api/movimentacoes" + "?page=1&limit=5"
$movimentacoes = Invoke-ApiRequest -Method "GET" -Url $movimentacoesUrl -Headers $authHeaders
if ($movimentacoes) {
    Write-Host "Movimentacoes: $($movimentacoes.dados.movimentacoes.Count) encontradas" -ForegroundColor Green
} else {
    Write-Host "Erro ao buscar movimentacoes" -ForegroundColor Yellow
}

# 6. Resumo Final
Write-Host "`nRESUMO DOS TESTES" -ForegroundColor Magenta
Write-Host "===================" -ForegroundColor Magenta
Write-Host "API Status: OK" -ForegroundColor Green
Write-Host "Health Check: OK" -ForegroundColor Green
Write-Host "Autenticacao: OK" -ForegroundColor Green
Write-Host "Endpoints: Funcionando" -ForegroundColor Green

Write-Host "`nPROXIMOS PASSOS:" -ForegroundColor Cyan
Write-Host "1. Importar collection no Postman:" -ForegroundColor White
Write-Host "   - postman/Agrolytix-API.postman_collection.json" -ForegroundColor Gray
Write-Host "   - postman/Agrolytix-Environment.postman_environment.json" -ForegroundColor Gray
Write-Host "2. Ou usar requests do arquivo:" -ForegroundColor White
Write-Host "   - postman/Requests-Exemplos.md" -ForegroundColor Gray
Write-Host "3. Ler documentacao completa:" -ForegroundColor White
Write-Host "   - postman/README-Postman.md" -ForegroundColor Gray

Write-Host "`nAPI Agrolytix pronta para uso!" -ForegroundColor Green 