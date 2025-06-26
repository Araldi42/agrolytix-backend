const bcrypt = require('bcryptjs');

async function testPassword() {
    const password = 'admin123';
    const hash = '$2a$12$.L9w5D0r..vwyHxxg55kmOe/WSD1gXC.6K4Vk8a3.n.UWJ1sVOHdy';
    
    console.log('Testando senha...');
    console.log('Senha:', password);
    console.log('Hash:', hash);
    
    try {
        const isValid = await bcrypt.compare(password, hash);
        console.log('Senha válida:', isValid);
        
        // Gerar um novo hash para comparação
        const newHash = await bcrypt.hash(password, 10);
        console.log('Novo hash:', newHash);
        
        const isNewValid = await bcrypt.compare(password, newHash);
        console.log('Novo hash válido:', isNewValid);
        
    } catch (error) {
        console.error('Erro:', error);
    }
}

testPassword(); 