require('dotenv').config();

async function testProducts() {
    try {
        console.log('🧪 Testando endpoint de produtos...');
        
        // Fazer login primeiro
        const loginResponse = await fetch('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                identifier: 'admin@agrolytix.com',
                senha: 'admin123'
            })
        });

        const loginData = await loginResponse.json();
        
        if (!loginData.sucesso) {
            console.log('❌ Falha no login:', loginData.mensagem);
            return;
        }

        console.log('✅ Login realizado com sucesso!');
        console.log('🔑 Token:', loginData.token.substring(0, 20) + '...');

        // Testar endpoint de produtos
        console.log('\n📦 Testando GET /api/produtos...');
        
        const produtosResponse = await fetch('http://localhost:3000/api/produtos', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${loginData.token}`,
                'Content-Type': 'application/json'
            }
        });

        const produtosData = await produtosResponse.json();
        
        console.log('📊 Status:', produtosResponse.status);
        console.log('📊 Response:', JSON.stringify(produtosData, null, 2));

        if (produtosData.sucesso) {
            console.log('✅ Endpoint funcionando!');
            console.log('📋 Produtos encontrados:', produtosData.dados?.produtos?.length || 0);
        } else {
            console.log('❌ Erro no endpoint:', produtosData.mensagem);
        }

    } catch (error) {
        console.error('❌ Erro:', error.message);
    }
}

testProducts(); 