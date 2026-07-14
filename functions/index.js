const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");

admin.initializeApp();
const db = admin.firestore();

// ============================================================================
// INTEGRAÇÃO REDE ITAÚ - E.REDE (CHECKOUT TRANSPARENTE DINÂMICO)
// ============================================================================

exports.processarPagamentoRede = functions.https.onCall(async (data, context) => {
    try {
        // 1. Recebe os dados do cartão vindos do formulário do site de forma segura
        const { numero, nome, mesValidade, anoValidade, cvv, parcelas, dealId, valorEmCentavos } = data;

        // 2. Busca as credenciais dinâmicas do Firestore para e-Rede
        let pv = "80792645"; // Default Sandbox PV
        let token = "0b8a698e49c4428fa79167fc8d715140"; // Default Sandbox Token
        let production = false;

        const configDoc = await db.collection("settings").doc("erede_config").get();
        if (configDoc.exists) {
            const configData = configDoc.data();
            if (configData.pv) pv = configData.pv.trim();
            if (configData.token) token = configData.token.trim();
            if (configData.production !== undefined) production = configData.production;
        }

        // Definir endpoint baseado no ambiente configurado
        const REDE_API_URL = production 
            ? "https://api.userede.com.br/erede/v1/transactions"
            : "https://sandbox-erede.useredecloud.com.br/erede/v1/transactions";

        // 3. Prepara a autorização Básica (Base64 do seu PV : TOKEN)
        const authString = Buffer.from(`${pv}:${token}`).toString('base64');

        // 4. Monta o corpo da requisição exigido pela API da e.Rede
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

        // 5. Envia a requisição para a operadora do cartão (Rede Itaú)
        const response = await axios.post(REDE_API_URL, payloadRede, {
            headers: {
                "Authorization": `Basic ${authString}`,
                "Content-Type": "application/json"
            }
        });

        // 6. Verifica se a transação foi aprovada (código 00 é SUCESSO na Rede)
        if (response.data.returnCode === "00") return { sucesso: true, mensagem: "Pagamento aprovado!" };
        else return { sucesso: false, mensagem: response.data.returnMessage }; // Se deu erro (Ex: Sem limite)
    } catch (error) {
        console.error("Erro E.Rede:", error.response ? error.response.data : error.message);
        return { sucesso: false, mensagem: "Transação negada pela operadora ou erro de comunicação." };
    }
});

// ============================================================================
// INTEGRAÇÃO ASAAS (CHECKOUT TRANSPARENTE E PIX DINÂMICO)
// ============================================================================

exports.processarPagamentoAsaas = functions.https.onCall(async (data, context) => {
    try {
        const {
            nome, email, telefone, cpf, cep, logradouro, numeroEndereco, bairro, cidade, uf,
            billingType, valorEmCentavos, parcelas, card
        } = data;

        // 1. Obter credenciais do Asaas (Firestore com fallback)
        let token = "$aact_prod_000MzkwODA2MWY2OGM3MWRlMDU2NWM3MzJlNzZmNGZhZGY6OjdjNjhjYWY4LTM5MmUtNGIwMC1iMjU5LTFiZGEzOTg2NGRiNDo6JGFhY2hfNWU3N2IyZTctNTE0Yy00NDdkLWJiM2YtNWI2NTExZDc5ODc2";
        let production = true;
        let walletId = null;

        const configDoc = await db.collection("settings").doc("asaas_config").get();
        if (configDoc.exists) {
            const configData = configDoc.data();
            if (configData.token) token = configData.token.trim();
            if (configData.production !== undefined) production = configData.production;
            if (configData.walletId) walletId = configData.walletId.trim();
        }

        const ASAAS_API_URL = production 
            ? "https://api.asaas.com/v3"
            : "https://sandbox.asaas.com/v3";

        const headers = {
            "access_token": token,
            "Content-Type": "application/json"
        };

        // Limpar CPF e Telefone (somente números) para o Asaas
        const cleanCpf = cpf.replace(/\D/g, "");
        const cleanPhone = telefone.replace(/\D/g, "");

        // 2. Buscar ou Criar o Cliente no Asaas
        let customerId = null;
        try {
            const searchResponse = await axios.get(`${ASAAS_API_URL}/customers?cpfCnpj=${cleanCpf}`, { headers });
            if (searchResponse.data && searchResponse.data.data && searchResponse.data.data.length > 0) {
                customerId = searchResponse.data.data[0].id;
            }
        } catch (err) {
            console.error("Erro ao buscar cliente Asaas:", err.response ? err.response.data : err.message);
        }

        if (!customerId) {
            // Criar novo cliente
            try {
                const customerPayload = {
                    name: nome,
                    email: email,
                    phone: cleanPhone,
                    mobilePhone: cleanPhone,
                    cpfCnpj: cleanCpf,
                    notificationDisabled: true
                };
                const createResponse = await axios.post(`${ASAAS_API_URL}/customers`, customerPayload, { headers });
                customerId = createResponse.data.id;
            } catch (err) {
                console.error("Erro ao criar cliente Asaas:", err.response ? err.response.data : err.message);
                const apiMsg = err.response && err.response.data && err.response.data.errors 
                    ? err.response.data.errors[0].description 
                    : "Falha ao registrar cliente no gateway.";
                return { sucesso: false, mensagem: `Erro ao criar cliente no Asaas: ${apiMsg}` };
            }
        }

        // 3. Montar dados da cobrança
        const valor = valorEmCentavos / 100;
        
        // Hoje formatado como YYYY-MM-DD
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, "0");
        const dd = String(today.getDate()).padStart(2, "0");
        const dueDate = `${yyyy}-${mm}-${dd}`;

        const paymentPayload = {
            customer: customerId,
            billingType: billingType, // "CREDIT_CARD" ou "PIX"
            value: valor,
            dueDate: dueDate
        };

        if (walletId) {
            paymentPayload.walletId = walletId;
        }

        if (billingType === "CREDIT_CARD") {
            const cleanCardNumber = card.number.replace(/\s+/g, "");
            paymentPayload.creditCard = {
                holderName: card.holderName,
                number: cleanCardNumber,
                expiryMonth: card.expiryMonth,
                expiryYear: card.expiryYear.length === 2 ? `20${card.expiryYear}` : card.expiryYear,
                ccv: card.cvv
            };

            const cleanCep = cep.replace(/\D/g, "");
            paymentPayload.creditCardHolderInfo = {
                name: card.holderName,
                email: email,
                cpfCnpj: cleanCpf,
                postalCode: cleanCep,
                addressNumber: numeroEndereco,
                phone: cleanPhone,
                mobilePhone: cleanPhone
            };

            if (parcelas > 1) {
                paymentPayload.installmentCount = parcelas;
            }
        }

        // 4. Criar Cobrança
        const payResponse = await axios.post(`${ASAAS_API_URL}/payments`, paymentPayload, { headers });
        const paymentData = payResponse.data;

        if (billingType === "PIX") {
            // Se for Pix, precisamos obter o QR Code
            const pixResponse = await axios.get(`${ASAAS_API_URL}/payments/${paymentData.id}/pixQrCode`, { headers });
            return {
                sucesso: true,
                paymentId: paymentData.id,
                billingType: "PIX",
                copiaecola: pixResponse.data.payload,
                qrCodeBase64: `data:image/png;base64,${pixResponse.data.encodedImage}`
            };
        } else if (billingType === "CREDIT_CARD") {
            // Para cartão, verificamos se foi aprovado imediatamente
            if (["CONFIRMED", "RECEIVED"].includes(paymentData.status)) {
                return { sucesso: true, paymentId: paymentData.id, billingType: "CREDIT_CARD", status: paymentData.status };
            } else {
                return { sucesso: false, mensagem: `Transação com status inesperado: ${paymentData.status}` };
            }
        }

        return { sucesso: false, mensagem: "Método de pagamento não suportado." };

    } catch (error) {
        console.error("Erro Asaas:", error.response ? error.response.data : error.message);
        let msg = "Erro na comunicação com o Asaas.";
        if (error.response && error.response.data && error.response.data.errors) {
            msg = error.response.data.errors.map(e => e.description).join(" | ");
        }
        return { sucesso: false, mensagem: msg };
    }
});

exports.consultarStatusPagamentoAsaas = functions.https.onCall(async (data, context) => {
    try {
        const { paymentId } = data;

        let token = "$aact_prod_000MzkwODA2MWY2OGM3MWRlMDU2NWM3MzJlNzZmNGZhZGY6OjdjNjhjYWY4LTM5MmUtNGIwMC1iMjU5LTFiZGEzOTg2NGRiNDo6JGFhY2hfNWU3N2IyZTctNTE0Yy00NDdkLWJiM2YtNWI2NTExZDc5ODc2";
        let production = true;

        const configDoc = await db.collection("settings").doc("asaas_config").get();
        if (configDoc.exists) {
            const configData = configDoc.data();
            if (configData.token) token = configData.token.trim();
            if (configData.production !== undefined) production = configData.production;
        }

        const ASAAS_API_URL = production 
            ? "https://api.asaas.com/v3"
            : "https://sandbox.asaas.com/v3";

        const headers = {
            "access_token": token,
            "Content-Type": "application/json"
        };

        const response = await axios.get(`${ASAAS_API_URL}/payments/${paymentId}`, { headers });
        const status = response.data.status;
        const pago = ["RECEIVED", "CONFIRMED"].includes(status);

        return { sucesso: true, status, pago };
    } catch (error) {
        console.error("Erro ao consultar pagamento Asaas:", error.response ? error.response.data : error.message);
        return { sucesso: false, mensagem: "Erro ao consultar status do pagamento." };
    }
});
