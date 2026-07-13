const functions = require("firebase-functions");
const axios = require("axios");

// ============================================================================
// INTEGRAÇÃO REDE ITAÚ - E.REDE (CHECKOUT TRANSPARENTE)
// ============================================================================
// ATENÇÃO: Nunca divulgue estas chaves publicamente.
const REDE_PV = "80792645"; 
const REDE_TOKEN = "0b8a698e49c4428fa79167fc8d715140"; 

// Ambiente: Sandbox (Testes). Para produção, altere para "https://api.userede.com.br/erede/v1/transactions"
const REDE_API_URL = "https://sandbox-erede.useredecloud.com.br/erede/v1/transactions"; 
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
