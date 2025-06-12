const bcrypt = require('bcryptjs');

async function generateHash() {
    const password = 'admin123';
    const saltRounds = 10;
    
    try {
        const hash = await bcrypt.hash(password, saltRounds);
        console.log('Senha:', password);
        console.log('Hash:', hash);
        
        // Testar se o hash funciona
        const isValid = await bcrypt.compare(password, hash);
        console.log('Hash válido:', isValid);
        
        // SQL para atualizar
        console.log('\nSQL para atualizar:');
        console.log(`UPDATE usuarios SET senha = '${hash}' WHERE email = 'admin@agrolytix.com';`);
        
    } catch (error) {
        console.error('Erro:', error);
    }
}

generateHash(); 