# EINAI - Sistema Integrado (CRM + Landing Pages + Checkout)

Este repositório contém o sistema administrativo (CRM) do Instituto Einai integrado com as Landing Pages dos treinamentos (SER e PNL). O sistema conta com funis de venda dinâmicos, controle de turmas, gestão de acessos de equipe e um **Checkout Transparente** integrado à **e.Rede (Rede Itaú)**.

A arquitetura é 100% Serverless, utilizando o **Firebase** como Banco de Dados, Autenticação e Back-end (Cloud Functions).

---

## 📌 Índice

1. [Pré-requisitos](#1-pré-requisitos)
2. [Configuração Inicial do Firebase](#2-configuração-inicial-do-firebase)
3. [Como Configurar o Pagamento (Rede Itaú)](#3-como-configurar-o-pagamento-rede-itaú)
4. [Onde alterar os Valores dos Cursos](#4-onde-alterar-os-valores-dos-cursos)
5. [Como Publicar o Back-end (Cloud Functions)](#5-como-publicar-o-back-end-cloud-functions)
6. [Acesso Administrativo (Primeiro Login)](#6-acesso-administrativo-primeiro-login)

---

## 1. Pré-requisitos

Para configurar o projeto na sua máquina, você precisa ter instalado:
- **Node.js** (https://nodejs.org) - Recomenda-se a versão LTS.
- **Conta no Firebase** (https://console.firebase.google.com).

Instale as ferramentas de linha de comando do Firebase abrindo o seu Terminal (ou Prompt de Comando) e digitando:
```bash
npm install -g firebase-tools
```
Faça o login com a sua conta do Google:
```bash
firebase login
```

---

## 2. Configuração Inicial do Firebase

Para que tudo funcione perfeitamente:

1. Acesse o console do Firebase e crie um novo projeto (ou utilize o `einia-21bc1`).
2. Habilite o **Firestore Database** (Crie no modo de produção).
3. Habilite o **Authentication** e ative o provedor de **E-mail/Senha**.
4. **IMPORTANTE**: Vá em *Configurações (Engrenagem) > Uso e Faturamento* e faça o upgrade do seu projeto para o plano **Blaze (Pay as you go)**. 
   *O Google exige um cartão de crédito cadastrado para rodar Back-ends (Cloud Functions), mas possui uma cota gratuita mensal de 2 milhões de invocações. Portanto, você só será cobrado se tiver um volume de vendas absurdamente alto no site.*

Se o seu projeto for diferente de `einia-21bc1`, lembre-se de atualizar a variável `firebaseConfig` no topo dos arquivos:
- `script.js`
- `scriptadmin.js`
- `ser.html` (no final do arquivo)
- `introducao-pnl.html` (no final do arquivo)

---

## 3. Como Configurar o Pagamento (Rede Itaú)

A integração de cartão de crédito não pode ficar exposta no código do site por segurança. Por isso, usamos o arquivo `/functions/index.js`.

### Passo A: Como encontrar suas chaves na Rede Itaú
1. Acesse o site da Rede e faça login no seu portal de cliente (Portal e.Rede).
2. No menu lateral, procure por **Venda Online** ou **e-Commerce**.
3. Vá até a aba **Configurações > Geração de Token** (ou Credenciais de Integração).
4. Você precisará de duas informações:
   - **PV (Número de Filiação)**: Geralmente é um número de 8 ou 9 dígitos que identifica a sua "maquininha/loja".
   - **Token**: Uma chave alfanumérica secreta gerada pelo sistema.

### Passo B: Onde inserir as chaves no código
Abra o arquivo `functions/index.js`. Logo no início do arquivo, substitua os valores:

```javascript
// ATENÇÃO: Nunca divulgue estas chaves publicamente.
const REDE_PV = "SEU_PV_AQUI"; // Substitua pelo seu Número de Filiação da Rede
const REDE_TOKEN = "SEU_TOKEN_AQUI"; // Substitua pelo Token gerado no Portal da Rede
```

*Dica para Testes:* A Rede Itaú também fornece chaves de Sandbox (ambiente de testes) caso você queira simular pagamentos com cartões fictícios antes de colocar as chaves reais.

---

## 4. Onde alterar os Valores dos Cursos

A API da e.Rede trabalha exclusivamente em **Centavos** para evitar erros de ponto flutuante. 
Exemplo: R$ 919,00 deve ser escrito como `91900` (sem vírgula).

Para mudar o valor dos cursos, você precisa ir diretamente nos arquivos HTML e localizar a função onde o pagamento é enviado.

### No Treinamento SER (`ser.html`)
Abra o arquivo `ser.html`, desça até o script final, procure por `valorEmCentavos` (aproximadamente na linha 553):
```javascript
const payload = {
    numero: ccNumero,
    nome: ccNome,
    mesValidade: mes,
    anoValidade: ano,
    cvv: ccCvv,
    parcelas: parseInt(selectedOption),
    dealId: currentDealId,
    valorEmCentavos: 91900 // <--- VALOR EM CENTAVOS (R$ 919,00 = 91900)
};
```

### No Treinamento PNL (`introducao-pnl.html`)
Abra o arquivo `introducao-pnl.html`, desça até o script final, procure por `valorEmCentavos` (aproximadamente na linha 551):
```javascript
const payload = {
    // ...
    valorEmCentavos: 47700 // <--- VALOR EM CENTAVOS (R$ 477,00 = 47700)
};
```
> Lembre-se também de alterar os valores textuais que aparecem no HTML visual (na tag `<select id="installments">`).

---

## 5. Como Publicar o Back-end (Cloud Functions)

Toda vez que você alterar as chaves da Rede no arquivo `functions/index.js`, você precisa publicar essas alterações nos servidores do Google.

Abra o terminal na pasta raiz do projeto (`EINAI_ADMIN`) e siga os passos:

**1. Inicializar o Firebase (se for a primeira vez na máquina):**
```bash
firebase init functions
```
*(Se perguntar se deseja sobrescrever os arquivos `package.json` ou `index.js`, diga NÃO "N", pois o código já está pronto).*

**2. Instalar a biblioteca de comunicação (Axios):**
```bash
cd functions
npm install axios
```

**3. Fazer o Deploy (Publicar online):**
Volte para a pasta principal e execute o deploy:
```bash
cd ..
firebase deploy --only functions
```
Aguarde o carregamento. Se aparecer "Deploy complete!", a integração de cartão de crédito no site já está se comunicando de forma real e segura com a Rede Itaú.

---

## 6. Acesso Administrativo (Primeiro Login)

O sistema CRM conta com um controle de permissões. O primeiro usuário a se conectar ganha acesso total (Master).

### Como criar a conta Administradora:
Como o Firebase cuida da autenticação, o primeiro acesso funciona de forma automática pelo e-mail padrão.

1. Pelo próprio console do Firebase na web, vá em **Authentication > Users** e crie um usuário manualmente (ex: `admin@einai.com` e senha `suasenha`).
2. Abra o arquivo `admin.html` no seu navegador.
3. Faça login com o e-mail e senha que acabou de criar.
4. Ao entrar, o sistema detectará que você é o usuário mestre (`admin@einai.com` ou o primeiro da base) e vai criar o seu perfil na aba **"Acessos (Usuários)"** dando permissão total.

### Como adicionar membros à equipe:
1. No painel (já logado), clique no menu lateral **Acessos (Usuários)**.
2. Clique em **+ Novo Acesso**.
3. Insira o nome, e-mail e crie uma senha para o membro da equipe.
4. Marque as "Sessões Liberadas". Se não quiser que ele veja o financeiro, basta desmarcar a aba "CRM". Se não quiser que ele crie usuários, desmarque a aba "Acessos".
5. Salve. O e-mail e senha gerados já podem ser utilizados por ele na tela de login.