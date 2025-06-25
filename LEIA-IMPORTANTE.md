Tem que criar a tabela de auditoria:
CREATE TABLE auditoria (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL,
    acao TEXT NOT NULL,
    tabela_afetada TEXT NOT NULL,
    registro_id INTEGER NOT NULL,
    dados_anteriores JSONB,
    dados_novos JSONB,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

faz isso também:
update usuarios set senha = '$2a$12$.L9w5D0r..vwyHxxg55kmOe/WSD1gXC.6K4Vk8a3.n.UWJ1sVOHdy';
que seria a senha "admin123"

Ajustar as rotas para pegar esse padrão:
router.post('/login', autenticacaoController.login.bind(autenticacaoController));

As demais rotas vão dar erro bem provavelmente, por conta que no Model tem o this. 
Se eles usam controllers com classes, aplique o mesmo padrão .bind(nomeController)
Se eles já exportam funções, deixe como está
Daí pra ti verificar, tenha como base (olha no controller):
module.exports = new NomeController(); // ← Precisa de bind
module.exports = { funcao1, funcao2 }; // ← Não precisa de bind

Outro erro que pode vir acontecer, é que no model tem uma função com um nome no Controller se chama de outro jeito
exemplo:
No model estará assim:        async createWithPassword(data, senha)
Daí no controller tem isso:   const novoUsuario = await this.usuarioModel.createPassword(dadosUsuario, senha); 
no caso deveria ser:          const novoUsuario = await this.usuarioModel.createWithPassword(dadosUsuario, senha); (note o With no create password)