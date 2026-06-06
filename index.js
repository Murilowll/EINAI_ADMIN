const functions = require("firebase-functions");
const axios = require("axios");

// ============================================================================
// INTEGRAÇÃO REDE ITAÚ - E.REDE (CHECKOUT TRANSPARENTE)
// ============================================================================
// ATENÇÃO: Nunca divulgue estas chaves publicamente.
// Você obtém o PV (Número de Filiação) e o TOKEN no portal da e.Rede.
const REDE_PV = "SEU_PV_AQUI"; 
const REDE_TOKEN = "SEU_TOKEN_AQUI"; 

// Ambiente: Produção. Para testes sem cobrança real, a Rede fornece um Sandbox na documentação.
const REDE_API_URL = "https://api.userede.com.br/erede/v1/transactions"; 
// ============================================================================

exports.processarPagamentoRede = functions.https.onCall(async (data, context) => {
    try {
        // 1. Recebe os dados do cartão vindos do formulário do site de forma segura
        const { numero, nome, mesValidade, anoValidade, cvv, parcelas, dealId, valorEmCentavos } = data;

        // 2. Prepara a autorização Básica (Base64 do seu PV : TOKEN)
        const authString = Buffer.from(`${REDE_PV}:${REDE_TOKEN}`).toString('base64');

        // 3. Monta o corpo da requisição exigido pela API da e.Rede
        const payloadRede = {
            capture: true, // "true" significa que autoriza e já captura (debita) na mesma hora
            reference: dealId || `pedido_${Date.now()}`,
            amount: valorEmCentavos, // Exemplo: R$ 919,00 = 91900
            installments: parcelas,
            cardHolderName: nome,
            cardNumber: numero,
            expirationMonth: mesValidade,
            expirationYear: `20${anoValidade}`, // Transforma "25" em "2025"
            securityCode: cvv,
            kind: "credit" // Tipo da transação: Crédito
        };

        // 4. Envia a requisição para a operadora do cartão (Rede Itaú)
        const response = await axios.post(REDE_API_URL, payloadRede, {
            headers: {
                "Authorization": `Basic ${authString}`,
                "Content-Type": "application/json"
            }
        });

        // 5. Verifica se a transação foi aprovada (código 00 é SUCESSO na Rede)
        if (response.data.returnCode === "00") return { sucesso: true, mensagem: "Pagamento aprovado!" };
        else return { sucesso: false, mensagem: response.data.returnMessage }; // Se deu erro (Ex: Sem limite)
    } catch (error) {
        console.error("Erro E.Rede:", error.response ? error.response.data : error.message);
        return { sucesso: false, mensagem: "Transação negada pela operadora ou erro de comunicação." };
    }
});