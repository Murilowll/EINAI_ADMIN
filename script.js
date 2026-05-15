import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, updateDoc, onSnapshot, writeBatch, addDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCWughEoZ0eUB6298L9kpe-u1mzBuV3p3k",
    authDomain: "einia-21bc1.firebaseapp.com",
    projectId: "einia-21bc1",
    storageBucket: "einia-21bc1.firebasestorage.app",
    messagingSenderId: "803375582521",
    appId: "1:803375582521:web:284b60e3b2960e0b7c6ce8",
    measurementId: "G-PNT1Z10N3T"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const state = {
    clients: [],
    classes: [],
    deals: [], // Negócios do CRM
    pipelines: [], // Funis/Quadros Kanban
    currentPipelineId: null,
    selectedClientId: null,
    editingClientId: null,
    editingDealId: null,
    selectedForExport: new Set()
};

// --- CONTROLE DE CARREGAMENTO INICIAL ---
let initialLoadComplete = false;
let classesLoaded = false;
let clientsLoaded = false;
let dealsLoaded = false;
let pipelinesLoaded = false;

function checkInitialLoad() {
    if (!initialLoadComplete && classesLoaded && clientsLoaded && dealsLoaded && pipelinesLoaded) {
        initialLoadComplete = true;
        document.getElementById('loading-view').classList.add('hidden');
        document.getElementById('app-view').classList.remove('hidden');
    }
}

// --- SEED DATABASE (Auto-popula o banco de dados se for o 1º acesso) ---
async function seedDatabaseIfNeeded() {
    const clientsSnap = await getDocs(collection(db, "clients"));
    if (clientsSnap.empty) {
        // Datas simuladas para o gráfico ter um histórico retroativo
        const today = new Date();
        const m1 = new Date(today.getFullYear(), today.getMonth() - 2, 10).toISOString();
        const m2 = new Date(today.getFullYear(), today.getMonth() - 1, 15).toISOString();
        const m3 = new Date(today.getFullYear(), today.getMonth(), 5).toISOString();
        const m4 = new Date().toISOString(); // Hoje

        const defaultClients = [
            { id: 'c1', name: 'Ana Silva', cpf: '111.111.111-11', phone: '11999999999', email: 'ana@email.com', company: 'Tech Inc', role: 'Gerente', tags: ['VIP'], notes: 'Aluna dedicada.', classId: 'unassigned', createdAt: m1 },
            { id: 'c2', name: 'Carlos Eduardo', cpf: '222.222.222-22', phone: '11988888888', email: 'carlos@email.com', company: 'Autônomo', role: 'Designer', tags: ['Pagamento Pendente'], notes: '', classId: 'unassigned', createdAt: m1 },
            { id: 'c3', name: 'Beatriz Souza', cpf: '333.333.333-33', phone: '11977777777', email: 'bia@email.com', company: 'Einai', role: 'Instrutora', tags: ['Iniciante'], notes: '', classId: 't1', createdAt: m2 },
            { id: 'c4', name: 'Lucas Fernandes', cpf: '444.444.444-44', phone: '11966666666', email: 'lucas@email.com', company: 'StartupBR', role: 'Dev', tags: ['Iniciante'], notes: 'Tem dificuldade em falar em público.', classId: 't2', createdAt: m3 },
            { id: 'c5', name: 'Mariana Costa', cpf: '555.555.555-55', phone: '11955555555', email: 'mariana@email.com', company: 'Agência X', role: 'Diretora', tags: ['VIP', 'Confirmada'], notes: 'Excelente networking.', classId: 'unassigned', createdAt: m4 }
        ];
        const defaultClasses = [
            { id: 't1', name: 'Introdução à PNL 55' },
            { id: 't2', name: 'Master em Inteligência Emocional' }
        ];
        const defaultPipelines = [
            { id: 'p1', name: 'Introdução à PNL' },
            { id: 'p2', name: 'Treinamento SER' }
        ];
        
        const defaultDeals = [
            { id: 'd1', title: 'Consultoria In Company - Tech Inc', contactName: 'Ana Silva', value: '5000', crmTags: ['Quente', 'B2B'], stage: 'proposal', pipelineId: 'p1', createdAt: m4 },
            { id: 'd2', title: 'Mentoria Individual', contactName: 'Carlos Eduardo', value: '1500', crmTags: ['Prioridade Alta'], stage: 'contact', pipelineId: 'p1', createdAt: m3 },
            { id: 'd3', title: 'Inscrição Master - Turma 3', contactName: 'João Pedro', value: '2500', crmTags: ['Indicação'], stage: 'lead', pipelineId: 'p2', createdAt: m4 }
        ];

        const batch = writeBatch(db);
        defaultClients.forEach(c => batch.set(doc(db, "clients", c.id), c));
        defaultClasses.forEach(c => batch.set(doc(db, "classes", c.id), c));
        defaultPipelines.forEach(p => batch.set(doc(db, "pipelines", p.id), p));
        defaultDeals.forEach(d => batch.set(doc(db, "deals", d.id), d));
        await batch.commit();
    }
}

// --- REALTIME LISTENERS (Atualiza a tela na hora se mudar no banco) ---
function setupRealtimeListeners() {
    onSnapshot(collection(db, "classes"), (snapshot) => {
        state.classes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        classesLoaded = true;
        updateClassDropdown();
        updateClassFilterDropdown();
        if(document.getElementById('turmas-section').classList.contains('active')) renderClassesList();
        checkInitialLoad();
    }, (error) => console.error("Erro Realtime Turmas:", error));

    onSnapshot(collection(db, "clients"), (snapshot) => {
        state.clients = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        clientsLoaded = true;
        updateDashboard();
        updateTagFilterOptions();
        if(document.getElementById('clientes-section').classList.contains('active')) renderClients();
        if(document.getElementById('turmas-section').classList.contains('active')) renderClassesList();
        checkInitialLoad();
    }, (error) => console.error("Erro Realtime Clientes:", error));
    
    onSnapshot(collection(db, "deals"), (snapshot) => {
        state.deals = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        dealsLoaded = true;
        if(document.getElementById('crm-section').classList.contains('active')) renderKanban();
        checkInitialLoad();
    }, (error) => console.error("Erro Realtime CRM:", error));

    onSnapshot(collection(db, "pipelines"), async (snapshot) => {
        if (snapshot.empty && state.deals.length > 0) {
            // Migração segura para quem já tem CRM rodando
            const batch = writeBatch(db);
            batch.set(doc(db, "pipelines", "p1"), { name: 'Introdução à PNL' });
            batch.set(doc(db, "pipelines", "p2"), { name: 'Treinamento SER' });
            await batch.commit();
            return;
        }
        state.pipelines = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (!state.currentPipelineId && state.pipelines.length > 0) {
            state.currentPipelineId = state.pipelines[0].id;
        }
        pipelinesLoaded = true;
        window.updatePipelineSelector();
        if(document.getElementById('crm-section').classList.contains('active')) renderKanban();
        checkInitialLoad();
    }, (error) => console.error("Erro Realtime Pipelines:", error));
}

// --- SISTEMA DE AUTENTICAÇÃO E NAVEGAÇÃO ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        document.getElementById('login-view').classList.add('hidden');
        
        // Exibe o carregamento enquanto busca os dados
        document.getElementById('app-view').classList.add('hidden');
        document.getElementById('loading-view').classList.remove('hidden');

        setupRealtimeListeners(); // INICIA A TELA PRIMEIRO!
        try {
            await seedDatabaseIfNeeded();
        } catch (error) {
            console.error("Erro ao auto-popular o banco:", error);
        }
    } else {
        document.getElementById('app-view').classList.add('hidden');
        document.getElementById('loading-view').classList.add('hidden');
        document.getElementById('login-view').classList.remove('hidden');
        
        // Reseta o estado para o próximo login
        initialLoadComplete = false;
        classesLoaded = false;
        clientsLoaded = false;
        dealsLoaded = false;
        pipelinesLoaded = false;
    }
});

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('username').value;
    const pass = document.getElementById('password').value;
    try {
        await signInWithEmailAndPassword(auth, email, pass);
    } catch (error) {
        document.getElementById('login-error').classList.remove('hidden');
        document.getElementById('login-error').innerText = 'Credenciais inválidas ou e-mail inexistente.';
    }
});

document.getElementById('btn-logout').addEventListener('click', () => {
    signOut(auth);
});

// --- MOSTRAR/OCULTAR SENHA ---
document.getElementById('toggle-password')?.addEventListener('click', function() {
    const pwdInput = document.getElementById('password');
    const icon = this.querySelector('svg');
    if (pwdInput.type === 'password') {
        pwdInput.type = 'text';
        this.title = 'Ocultar senha';
        icon.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>';
    } else {
        pwdInput.type = 'password';
        this.title = 'Mostrar senha';
        icon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
    }
});

// --- SISTEMA DE NOTIFICAÇÕES (TOASTS) ---
window.showToast = function(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerText = message;

    container.appendChild(toast);

    // Dispara a animação de entrada (pequeno atraso pro DOM renderizar)
    setTimeout(() => toast.classList.add('show'), 10);

    // Remove o toast automaticamente após 3.5 segundos
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400); // Aguarda a transição de saída acabar
    }, 3500);
};

// --- MODAL DE CONFIRMAÇÃO ---
let confirmActionCallback = null;

window.openConfirmModal = function(title, message, onConfirm) {
    document.getElementById('confirm-title').innerText = title;
    document.getElementById('confirm-message').innerText = message;
    confirmActionCallback = onConfirm;
    document.getElementById('confirm-modal').classList.remove('hidden');
};

window.closeConfirmModal = function() {
    document.getElementById('confirm-modal').classList.add('hidden');
    confirmActionCallback = null;
};

document.getElementById('btn-confirm-action')?.addEventListener('click', async () => {
    if (confirmActionCallback) {
        const btn = document.getElementById('btn-confirm-action');
        const originalText = btn.innerText;
        btn.disabled = true;
        btn.innerText = 'Aguarde...';
        try {
            await confirmActionCallback();
        } finally {
            btn.disabled = false;
            btn.innerText = originalText;
            window.closeConfirmModal();
        }
    }
});

// --- FUNÇÃO PARA COPIAR TEXTO ---
window.copyToClipboard = async function(text, successMsg = "Copiado com sucesso!") {
    try {
        await navigator.clipboard.writeText(text);
        window.showToast(successMsg, "success");
    } catch (err) {
        console.error("Erro ao copiar:", err);
        window.showToast("Erro ao copiar o texto.", "error");
    }
};

// Navegação Sidebar
document.querySelectorAll('.sidebar-nav .nav-item').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const currentLink = e.currentTarget;
        if(currentLink.id === 'btn-logout') return;
        
        document.querySelectorAll('.sidebar-nav .nav-item').forEach(l => l.classList.remove('active'));
        currentLink.classList.add('active');

        document.querySelectorAll('.content-section').forEach(sec => sec.classList.remove('active'));
        const targetId = currentLink.getAttribute('data-target');
        document.getElementById(targetId).classList.add('active');

        if(targetId === 'dashboard-section') updateDashboard();
        if(targetId === 'clientes-section') renderClients();
        if(targetId === 'turmas-section') renderClassesList();
        if(targetId === 'crm-section') renderKanban();

        // Fecha a sidebar no celular ao clicar em um link
        if (window.innerWidth <= 768) {
            document.querySelector('.sidebar').classList.remove('open');
            document.getElementById('sidebar-overlay').classList.remove('active');
        }
    });
});

// Lógica do botão Menu (Mobile)
document.getElementById('mobile-menu-btn')?.addEventListener('click', () => {
    document.querySelector('.sidebar').classList.add('open');
    document.getElementById('sidebar-overlay').classList.add('active');
});
document.getElementById('sidebar-overlay')?.addEventListener('click', () => {
    document.querySelector('.sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('active');
});

// --- DASHBOARD ---
function updateDashboard() {
    const dashDate = document.getElementById('dash-date');
    if(dashDate) {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        dashDate.innerText = new Date().toLocaleDateString('pt-BR', options).replace(/^\w/, (c) => c.toUpperCase());
    }

    document.getElementById('dash-total-clients').innerText = state.clients.length;
    document.getElementById('dash-total-classes').innerText = state.classes.length;
    document.getElementById('dash-active-students').innerText = state.clients.filter(c => c.classId !== 'unassigned').length;
    updateGrowthChart();
}

// --- UTILITÁRIOS PARA AVATAR ---
window.getInitials = function(name) {
    if (!name) return '??';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

window.getAvatarColor = function(name) {
    const colors = ['#0ea5e9', '#8b5cf6', '#f59e0b', '#ef4444', '#10b981', '#f43f5e', '#6366f1', '#0d9488'];
    let hash = 0;
    for (let i = 0; i < (name || '').length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
};

// --- UTILITÁRIO PARA TAGS (COR EXCLUSIVA) ---
window.renderTagHtml = function(tagName, removable = false) {
    let style = '';
    if (tagName === 'Inscrição Site') {
        style = 'background-color: #dbeafe; color: #1e40af; border: 1px solid #bfdbfe;'; // Azul destacado
    }
    const removeHtml = removable ? ` <span class="tag-remove" onclick="removeTag('${tagName}')">&times;</span>` : '';
    return `<span class="tag" style="${style}">${tagName}${removeHtml}</span>`;
};

// --- UTILITÁRIO PARA CALCULAR IDADE ---
window.calculateAge = function(birthDateString) {
    if (!birthDateString || birthDateString.length !== 10) return null;
    const [day, month, year] = birthDateString.split('/');
    if (!day || !month || !year) return null;
    
    const today = new Date();
    const birthDate = new Date(year, month - 1, day);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
};

// --- GESTÃO DE CLIENTES ---
let currentClientPage = 1;
const clientsPerPage = 20;

function renderClients() {
    const searchTerm = document.getElementById('search-client').value.toLowerCase();
    const selectedTag = document.getElementById('filter-tag').value;
    const selectedClass = document.getElementById('filter-class').value;
    const sortBy = document.getElementById('sort-client')?.value || 'newest';

    const tbody = document.getElementById('clients-tbody');
    tbody.innerHTML = '';

    let filtered = state.clients.filter(c => {
        const name = c.name || '';
        const email = c.email || '';
        
        const matchesSearch = name.toLowerCase().includes(searchTerm) || email.toLowerCase().includes(searchTerm);
        const matchesTag = selectedTag === '' || (c.tags && c.tags.includes(selectedTag));
        const matchesClass = selectedClass === '' || c.classId === selectedClass;
        return matchesSearch && matchesTag && matchesClass;
    });

    filtered.sort((a, b) => {
        if (sortBy === 'newest') return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        if (sortBy === 'oldest') return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
        if (sortBy === 'az') return (a.name || '').localeCompare(b.name || '');
        return 0;
    });

    // Lógica da Paginação: Separa apenas 20 clientes para exibir
    const totalPages = Math.ceil(filtered.length / clientsPerPage);
    if (currentClientPage > totalPages) currentClientPage = totalPages || 1;
    const paginatedClients = filtered.slice((currentClientPage - 1) * clientsPerPage, currentClientPage * clientsPerPage);

    paginatedClients.forEach(client => {
        const tr = document.createElement('tr');
        const tags = client.tags || [];
        const clientName = client.name || 'Sem Nome';
        const initials = window.getInitials(clientName);
        const avatarColor = window.getAvatarColor(clientName);
        
        let classTagHtml = '';
        if (client.classId && client.classId !== 'unassigned') {
            const clientClass = state.classes.find(cls => cls.id === client.classId);
            if (clientClass) {
                classTagHtml = `<span class="tag" style="background-color: #e0e7ff; color: #4338ca;">🎓 ${clientClass.name}</span>`;
            }
        }

        tr.innerHTML = `
            <td onclick="event.stopPropagation();" style="text-align: center;">
                <input type="checkbox" class="client-select-cb" value="${client.id}" ${state.selectedForExport.has(client.id) ? 'checked' : ''} style="cursor: pointer; width: 1.1rem; height: 1.1rem;">
            </td>
            <td>
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <div class="avatar" style="background-color: ${avatarColor};">${initials}</div>
                    <strong>${clientName}</strong>
                </div>
            </td>
            <td>${client.email || '-'}</td>
            <td>${client.phone || '-'}</td>
            <td>${classTagHtml}${tags.map(t => window.renderTagHtml(t)).join('')}</td>
        `;
        tr.addEventListener('click', () => window.openClientModal(client.id));
        tbody.appendChild(tr);
    });

    renderPagination(totalPages);
    updateExportSelectedBtn();
}

function renderPagination(totalPages) {
    const container = document.getElementById('pagination-container');
    container.innerHTML = '';
    if (totalPages <= 1) return; // Oculta a paginação se houver apenas 1 página

    const prevBtn = document.createElement('button');
    prevBtn.className = 'page-btn';
    prevBtn.innerText = 'Anterior';
    prevBtn.disabled = currentClientPage === 1;
    prevBtn.onclick = () => { currentClientPage--; renderClients(); };
    container.appendChild(prevBtn);

    // Exibe no máximo 5 botões de página (inteligente caso você tenha dezenas de páginas)
    let startPage = Math.max(1, currentClientPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);
    if (endPage - startPage < 4) startPage = Math.max(1, endPage - 4);

    for (let i = startPage; i <= endPage; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.className = `page-btn ${i === currentClientPage ? 'active' : ''}`;
        pageBtn.innerText = i;
        pageBtn.onclick = () => { currentClientPage = i; renderClients(); };
        container.appendChild(pageBtn);
    }

    const nextBtn = document.createElement('button');
    nextBtn.className = 'page-btn';
    nextBtn.innerText = 'Próxima';
    nextBtn.disabled = currentClientPage === totalPages;
    nextBtn.onclick = () => { currentClientPage++; renderClients(); };
    container.appendChild(nextBtn);
}

// --- LÓGICA DE SELEÇÃO DE CLIENTES (CHECKBOXES) ---
document.getElementById('clients-tbody')?.addEventListener('change', (e) => {
    if (e.target.classList.contains('client-select-cb')) {
        if (e.target.checked) state.selectedForExport.add(e.target.value);
        else state.selectedForExport.delete(e.target.value);
        updateExportSelectedBtn();
    }
});

document.getElementById('select-all-clients')?.addEventListener('change', (e) => {
    const isChecked = e.target.checked;
    const checkboxes = document.querySelectorAll('.client-select-cb');
    checkboxes.forEach(cb => {
        cb.checked = isChecked;
        if (isChecked) state.selectedForExport.add(cb.value);
        else state.selectedForExport.delete(cb.value);
    });
    updateExportSelectedBtn();
});

function updateExportSelectedBtn() {
    const btn = document.getElementById('btn-export-selected');
    if (!btn) return;
    if (state.selectedForExport.size > 0) {
        btn.classList.remove('hidden');
        btn.innerText = `Exportar Selecionados (${state.selectedForExport.size})`;
    } else {
        btn.classList.add('hidden');
    }
    
    const checkboxes = document.querySelectorAll('.client-select-cb');
    const allChecked = checkboxes.length > 0 && Array.from(checkboxes).every(cb => cb.checked);
    const selectAllCb = document.getElementById('select-all-clients');
    if (selectAllCb) selectAllCb.checked = allChecked;
}

const resetPaginationAndRender = () => { currentClientPage = 1; renderClients(); };
document.getElementById('search-client').addEventListener('input', resetPaginationAndRender);
document.getElementById('filter-tag').addEventListener('change', resetPaginationAndRender);
document.getElementById('filter-class')?.addEventListener('change', resetPaginationAndRender);
document.getElementById('sort-client')?.addEventListener('change', resetPaginationAndRender);

function updateTagFilterOptions() {
    const select = document.getElementById('filter-tag');
    if (!select) return;

    const currentVal = select.value;
    const allTags = new Set();

    state.clients.forEach(c => {
        if (c.tags) c.tags.forEach(t => allTags.add(t));
    });

    select.innerHTML = '<option value="">Todas as Tags</option>';
    Array.from(allTags).sort().forEach(tag => {
        const option = document.createElement('option');
        option.value = tag;
        option.textContent = tag;
        select.appendChild(option);
    });

    if (allTags.has(currentVal)) select.value = currentVal;
}

// --- MÁSCARAS DE FORMATAÇÃO (CPF E TELEFONE) ---
document.getElementById('nc-cpf').addEventListener('input', function (e) {
    let v = e.target.value.replace(/\D/g, ''); // Remove tudo que não é número
    v = v.replace(/(\d{3})(\d)/, '$1.$2'); // Ponto após os 3 primeiros
    v = v.replace(/(\d{3})(\d)/, '$1.$2'); // Ponto após os 6 primeiros
    v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2'); // Hífen antes dos últimos 2 dígitos
    e.target.value = v.substring(0, 14); // Limita a 14 caracteres
});

document.getElementById('nc-phone').addEventListener('input', function (e) {
    let v = e.target.value.replace(/\D/g, ''); // Remove tudo que não é número
    v = v.replace(/(\d{2})(\d)/, '($1) $2'); // Parênteses no DDD
    v = v.replace(/(\d{5})(\d)/, '$1-$2'); // Hífen após o 5º dígito
    e.target.value = v.substring(0, 15); // Limita a 15 caracteres
});

document.getElementById('nc-birthdate')?.addEventListener('input', function (e) {
    let v = e.target.value.replace(/\D/g, ""); // Remove tudo que não é número
    if (v.length > 8) v = v.slice(0,8);
    v = v.replace(/(\d{2})(\d)/, "$1/$2"); 
    v = v.replace(/(\d{2})(\d)/, "$1/$2"); 
    e.target.value = v;
});

// --- CADASTRAR NOVO CLIENTE ---
window.openNewClientModal = function() {
    state.editingClientId = null;
    document.getElementById('form-client-title').innerText = 'Novo Cliente';
    document.getElementById('btn-submit-client').innerText = 'Cadastrar Cliente';
    document.getElementById('new-client-modal').classList.remove('hidden');
};

window.closeNewClientModal = function() {
    document.getElementById('new-client-modal').classList.add('hidden');
    document.getElementById('new-client-form').reset();
};

window.openEditClientModal = function() {
    const client = state.clients.find(c => c.id === state.selectedClientId);
    if (!client) return;

    state.editingClientId = client.id;
    document.getElementById('form-client-title').innerText = 'Editar Cliente';
    document.getElementById('btn-submit-client').innerText = 'Salvar Alterações';

    // Preenche os campos com os dados atuais
    document.getElementById('nc-name').value = client.name || '';
    document.getElementById('nc-email').value = client.email || '';
    document.getElementById('nc-cpf').value = client.cpf || '';
    document.getElementById('nc-birthdate').value = client.birthDate || '';
    document.getElementById('nc-phone').value = client.phone || '';
    document.getElementById('nc-company').value = client.company || '';
    document.getElementById('nc-role').value = client.role || '';
    document.getElementById('nc-class').value = client.classId || 'unassigned';
    document.getElementById('nc-address').value = client.address || '';

    // Esconde o perfil e mostra o formulário
    document.getElementById('client-modal').classList.add('hidden');
    document.getElementById('new-client-modal').classList.remove('hidden');
};

document.getElementById('new-client-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btnSubmit = document.getElementById('btn-submit-client');
    const originalText = btnSubmit.innerText;
    btnSubmit.disabled = true;
    btnSubmit.innerText = 'Salvando...';

    const clientData = {
        name: document.getElementById('nc-name').value,
        email: document.getElementById('nc-email').value,
        cpf: document.getElementById('nc-cpf').value,
        birthDate: document.getElementById('nc-birthdate').value,
        phone: document.getElementById('nc-phone').value,
        company: document.getElementById('nc-company').value,
        role: document.getElementById('nc-role').value,
        classId: document.getElementById('nc-class').value,
        address: document.getElementById('nc-address').value
    };

    try {
        if (state.editingClientId) {
            await updateDoc(doc(db, "clients", state.editingClientId), clientData);
            window.showToast("Cliente atualizado com sucesso!", "success");
            window.openClientModal(state.editingClientId); // Volta para a visualização do perfil atualizado
        } else {
            clientData.tags = [];
            clientData.notes = '';
            clientData.createdAt = new Date().toISOString();
            await addDoc(collection(db, "clients"), clientData);
            window.showToast("Cliente cadastrado com sucesso!", "success");
        }
        document.getElementById('new-client-modal').classList.add('hidden');
        e.target.reset();
    } catch (error) {
        console.error("Erro ao salvar cliente:", error);
        window.showToast("Erro ao salvar os dados do cliente.", "error");
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerText = originalText;
    }
});

// --- MODAL DE PERFIL, TAGS E ANOTAÇÕES ---
window.openClientModal = function(clientId) {
    state.selectedClientId = clientId;
    const client = state.clients.find(c => c.id === clientId);
    
    document.getElementById('modal-client-name').innerText = `Perfil: ${client.name}`;
    
    // Limpa o telefone para o link do WhatsApp (apenas números) e adiciona o 55 (Brasil)
    const cleanPhone = client.phone ? client.phone.replace(/\D/g, '') : '';
    const phoneHtml = cleanPhone 
        ? `<a href="https://wa.me/55${cleanPhone}" target="_blank" style="color: var(--primary-color); text-decoration: none; font-weight: 500;" title="Abrir conversa no WhatsApp">${client.phone} ↗</a>` 
        : '-';

    let ageText = '';
    if (client.birthDate) {
        const age = window.calculateAge(client.birthDate);
        if (age !== null && !isNaN(age)) {
            ageText = ` <span class="text-muted">(${age} anos)</span>`;
        }
    }

    const body = document.getElementById('modal-body');
    body.innerHTML = `
        <div>
            <p class="text-muted mb-2">DADOS PESSOAIS</p>
            <p><strong>CPF:</strong> ${client.cpf}</p>
            <p><strong>Nascimento:</strong> ${client.birthDate ? client.birthDate + ageText : '-'}</p>
            <p style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
                <strong>E-mail:</strong> <span style="word-break: break-all;">${client.email}</span>
                ${client.email ? `<button class="btn btn-outline" onclick="window.copyToClipboard('${client.email}', 'E-mail copiado com sucesso!')" style="padding: 0.15rem 0.5rem; font-size: 0.7rem; border-radius: 0.25rem;">Copiar</button>` : ''}
            </p>
            <p><strong>Telefone:</strong> ${phoneHtml}</p>
            <p><strong>Empresa:</strong> ${client.company} - ${client.role}</p>
            <p><strong>Endereço:</strong> ${client.address || '-'}</p>
        </div>
        <div>
            <p class="text-muted mb-2">TAGS</p>
            <div id="tags-container" style="margin-bottom: 0.5rem;">
                ${client.tags.map(t => window.renderTagHtml(t, true)).join('')}
            </div>
            <input type="text" id="new-tag-input" placeholder="Nova tag + Enter...">
        </div>
        <div class="col-span-2 mt-2">
            <p class="text-muted mb-2">ANOTAÇÕES INTERNAS</p>
            <textarea id="client-notes" placeholder="Deixe anotações...">${client.notes}</textarea>
        </div>
    `;

    document.getElementById('client-modal').classList.remove('hidden');

    document.getElementById('new-tag-input').addEventListener('keypress', async (e) => {
        if (e.key === 'Enter' && e.target.value.trim() !== '') {
            const newTags = [...client.tags, e.target.value.trim()];
            await updateDoc(doc(db, "clients", client.id), { tags: newTags });
            window.openClientModal(clientId);
        }
    });

    // Salva ao clicar fora da caixa (evita excesso de gravação no banco)
    document.getElementById('client-notes').addEventListener('change', async (e) => {
        await updateDoc(doc(db, "clients", client.id), { notes: e.target.value });
    });
}

window.removeTag = async function(tag) {
    const client = state.clients.find(c => c.id === state.selectedClientId);
    const newTags = client.tags.filter(t => t !== tag);
    await updateDoc(doc(db, "clients", client.id), { tags: newTags });
    window.openClientModal(client.id);
};

window.deleteClient = function() {
    if (!state.selectedClientId) return;
    
    window.openConfirmModal(
        "Excluir Cliente",
        "Tem certeza que deseja excluir este cliente? Esta ação não pode ser desfeita.",
        async () => {
            try {
                await deleteDoc(doc(db, "clients", state.selectedClientId));
                document.getElementById('client-modal').classList.add('hidden');
                state.selectedClientId = null;
                window.showToast("Cliente excluído com sucesso!", "success");
            } catch (error) {
                console.error("Erro ao deletar cliente:", error);
                window.showToast("Erro ao excluir o cliente.", "error");
            }
        }
    );
};

document.getElementById('close-modal').addEventListener('click', () => {
    document.getElementById('client-modal').classList.add('hidden');
    state.selectedClientId = null;
});

// --- GESTÃO DE TURMAS (LISTA ACORDEON) ---
function updateClassDropdown() {
    const select = document.getElementById('nc-class');
    if(!select) return;
    const currentVal = select.value;
    select.innerHTML = '<option value="unassigned">Sem Turma</option>';
    state.classes.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.name;
        select.appendChild(opt);
    });
    if([...select.options].some(o => o.value === currentVal)) {
        select.value = currentVal;
    }
}

function updateClassFilterDropdown() {
    const select = document.getElementById('filter-class');
    if (!select) return;
    const currentVal = select.value;
    select.innerHTML = '<option value="">Todas as Turmas</option><option value="unassigned">Sem Turma</option>';
    state.classes.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.name;
        select.appendChild(opt);
    });
    if ([...select.options].some(o => o.value === currentVal)) {
        select.value = currentVal;
    }
}

function renderClassesList() {
    const container = document.getElementById('classes-accordion');
    if(!container) return;
    
    const searchTerm = (document.getElementById('search-class')?.value || '').toLowerCase();
    container.innerHTML = '';

    const filteredClasses = state.classes.filter(c => c.name.toLowerCase().includes(searchTerm));
    
    const allCategories = [
        { id: 'unassigned', name: 'Clientes sem turma' },
        ...filteredClasses
    ];

    allCategories.forEach(cls => {
        const classClients = state.clients.filter(c => c.classId === cls.id);
        
        if (cls.id === 'unassigned' && searchTerm !== '' && !cls.name.toLowerCase().includes(searchTerm)) {
            return; 
        }

        const item = document.createElement('div');
        item.className = 'accordion-item';
        
        const isUnassigned = cls.id === 'unassigned';
        const actionsHtml = isUnassigned ? 
            `<button class="btn btn-outline" onclick="exportCSV('${cls.id}', '${cls.name}'); event.stopPropagation();" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">Exportar</button>` :
            `
            <button class="btn btn-outline" onclick="openAddClientsToClassModal('${cls.id}'); event.stopPropagation();" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; color: var(--primary-color); border-color: var(--primary-color);">+ Alunos</button>
            <button class="btn btn-outline" onclick="openEditClassModal('${cls.id}'); event.stopPropagation();" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">Editar</button>
            <button class="btn btn-outline text-danger" onclick="deleteClass('${cls.id}'); event.stopPropagation();" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; border-color: #fca5a5;">Excluir</button>
            <button class="btn btn-outline" onclick="exportCSV('${cls.id}', '${cls.name}'); event.stopPropagation();" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">Exportar</button>
            `;

        item.innerHTML = `
            <div class="accordion-header" onclick="this.nextElementSibling.classList.toggle('hidden')">
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <h3 style="font-size: 1.1rem; color: var(--text-main);">${cls.name}</h3>
                    <span class="tag" style="margin:0">${classClients.length} alunos</span>
                </div>
                <div style="display: flex; gap: 0.5rem;">
                    ${actionsHtml}
                </div>
            </div>
            <div class="accordion-content hidden">
                ${classClients.length === 0 ? '<p class="text-muted" style="margin:0;">Nenhum aluno nesta turma.</p>' : 
                classClients.map(c => {
                    const cName = c.name || 'Sem Nome';
                    const inits = window.getInitials(cName);
                    const bg = window.getAvatarColor(cName);
                    const removeBtnHtml = isUnassigned ? '' : `<button class="btn-icon" onclick="removeClientFromClass('${c.id}', '${cls.name.replace(/'/g, "\\'")}'); event.stopPropagation();" title="Remover da turma" style="color: var(--danger); font-size: 1.5rem; margin-left: 0.5rem; line-height: 1;">&times;</button>`;
                    return `
                    <div class="client-list-item" style="cursor: pointer;" onclick="window.openClientModal('${c.id}')">
                        <div style="display: flex; align-items: center; gap: 0.75rem;">
                            <div class="avatar" style="background-color: ${bg}; width: 32px; height: 32px; font-size: 0.75rem;">${inits}</div>
                            <div>
                                <strong style="color: var(--text-main);">${cName}</strong><br>
                                <span class="text-muted" style="font-size: 0.8rem;">${c.email}</span>
                            </div>
                        </div>
                        <div style="display: flex; align-items: center;">
                            <div>${(c.tags || []).map(t => window.renderTagHtml(t)).join('')}</div>
                            ${removeBtnHtml}
                        </div>
                    </div>
                `}).join('')}
            </div>
        `;
        container.appendChild(item);
    });
}

document.getElementById('search-class')?.addEventListener('input', renderClassesList);

let editingClassId = null;

window.openNewClassModal = function() {
    editingClassId = null;
    document.getElementById('form-class-title').innerText = 'Nova Turma';
    document.getElementById('btn-submit-class').innerText = 'Salvar Turma';
    document.getElementById('class-form').reset();
    document.getElementById('class-modal').classList.remove('hidden');
};

window.closeClassModal = function() {
    document.getElementById('class-modal').classList.add('hidden');
};

window.openEditClassModal = function(id) {
    editingClassId = id;
    const cls = state.classes.find(c => c.id === id);
    if(!cls) return;
    document.getElementById('form-class-title').innerText = 'Editar Turma';
    document.getElementById('btn-submit-class').innerText = 'Salvar Alterações';
    document.getElementById('class-name').value = cls.name;
    document.getElementById('class-modal').classList.remove('hidden');
};

document.getElementById('class-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('class-name').value;
    const btnSubmit = document.getElementById('btn-submit-class');
    const originalText = btnSubmit.innerText;
    btnSubmit.disabled = true;
    btnSubmit.innerText = 'Salvando...';

    try {
        if (editingClassId) {
            await updateDoc(doc(db, "classes", editingClassId), { name });
        } else {
            await addDoc(collection(db, "classes"), { name });
        }
        window.closeClassModal();
        window.showToast("Turma salva com sucesso!", "success");
    } catch (error) {
        console.error("Erro ao salvar turma:", error);
        window.showToast("Erro ao salvar turma.", "error");
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerText = originalText;
    }
});

window.deleteClass = function(id) {
    window.openConfirmModal(
        "Excluir Turma",
        "Tem certeza que deseja excluir esta turma? Os alunos nela ficarão 'Sem Turma'.",
        async () => {
            try {
                await deleteDoc(doc(db, "classes", id));
                const classClients = state.clients.filter(c => c.classId === id);
                for (const c of classClients) {
                    await updateDoc(doc(db, "clients", c.id), { classId: 'unassigned' });
                }
                window.showToast("Turma excluída com sucesso!", "success");
            } catch (error) {
                console.error("Erro ao deletar turma:", error);
                window.showToast("Erro ao excluir turma.", "error");
            }
        }
    );
};

window.removeClientFromClass = function(clientId, className) {
    window.openConfirmModal(
        "Remover da Turma",
        `Deseja remover este aluno da turma "${className}"? Ele ficará 'Sem Turma'.`,
        async () => {
            try {
                await updateDoc(doc(db, "clients", clientId), { classId: 'unassigned' });
                window.showToast("Aluno removido da turma.", "success");
            } catch (error) {
                console.error("Erro ao remover aluno da turma:", error);
                window.showToast("Erro ao remover aluno.", "error");
            }
        }
    );
};

// --- EXPORTAÇÃO CSV GLOBAL ---
document.getElementById('btn-export-clients')?.addEventListener('click', () => {
    window.exportCSV(null, 'Todos_Os_Clientes');
});

document.getElementById('btn-export-selected')?.addEventListener('click', () => {
    if (state.selectedForExport.size === 0) return;
    const clientsToExport = state.clients.filter(c => state.selectedForExport.has(c.id));
    
    const csvContent = "Nome,E-mail,Telefone,Tags\n" + clientsToExport.map(c => `"${c.name}","${c.email}","${c.phone}","${(c.tags || []).join(', ')}"`).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Einai_Selecionados.csv`;
    link.click();
    
    state.selectedForExport.clear();
    renderClients(); // Re-renderiza para limpar as marcações
    window.showToast("Clientes exportados com sucesso!", "success");
});

window.exportCSV = function(classId, className) {
    const clientsToExport = classId ? state.clients.filter(c => c.classId === classId) : state.clients;
    if(clientsToExport.length === 0) return alert('Nenhum aluno para exportar.');

    const csvContent = "Nome,E-mail,Telefone,Tags\n" + clientsToExport.map(c => `"${c.name}","${c.email}","${c.phone}","${c.tags.join(', ')}"`).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Einai_${className.replace(/\s+/g, '_')}.csv`;
    link.click();
};

// --- GRÁFICO DO DASHBOARD ---
let clientsChartInstance = null;

function updateGrowthChart() {
    const ctx = document.getElementById('clientsChart');
    if (!ctx) return;

    // Agrupa os clientes por Ano-Mês
    const countsByMonth = {};
    state.clients.forEach(c => {
        const d = new Date(c.createdAt || new Date().toISOString());
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        countsByMonth[key] = (countsByMonth[key] || 0) + 1;
    });

    // Ordena os meses e calcula o valor cumulativo (crescimento ao longo do tempo)
    const sortedKeys = Object.keys(countsByMonth).sort();
    const labels = [];
    const data = [];
    let cumulative = 0;

    sortedKeys.forEach(key => {
        const [year, month] = key.split('-');
        // Formata para algo como "out. de 2023"
        const monthName = new Date(year, month - 1).toLocaleString('pt-BR', { month: 'short', year: 'numeric' });
        labels.push(monthName);
        cumulative += countsByMonth[key];
        data.push(cumulative);
    });

    // Atualiza ou cria o gráfico
    if (clientsChartInstance) {
        clientsChartInstance.data.labels = labels;
        clientsChartInstance.data.datasets[0].data = data;
        clientsChartInstance.update();
    } else {
        clientsChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Total de Clientes',
                    data: data,
                    borderColor: '#0d9488', // Azul esverdeado (Teal)
                    backgroundColor: 'rgba(13, 148, 136, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.3, // Curva suave
                    pointBackgroundColor: '#0d9488'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
            }
        });
    }
}

// --- ADICIONAR ALUNOS À TURMA ---
let currentAddingClassId = null;
let selectedClientsToAdd = new Set();

window.openAddClientsToClassModal = function(classId) {
    currentAddingClassId = classId;
    selectedClientsToAdd.clear();
    const cls = state.classes.find(c => c.id === classId);
    if (!cls) return;
    
    document.getElementById('add-clients-modal-title').innerText = `Adicionar Alunos: ${cls.name}`;
    document.getElementById('search-client-for-class').value = '';
    
    renderClientsToAddList();
    
    document.getElementById('add-clients-to-class-modal').classList.remove('hidden');
};

window.closeAddClientsToClassModal = function() {
    document.getElementById('add-clients-to-class-modal').classList.add('hidden');
    currentAddingClassId = null;
};

function renderClientsToAddList() {
    const listContainer = document.getElementById('add-clients-list');
    const searchTerm = (document.getElementById('search-client-for-class')?.value || '').toLowerCase();
    
    listContainer.innerHTML = '';
    
    // Mostra clientes que NÃO estão nesta turma
    const availableClients = state.clients.filter(c => c.classId !== currentAddingClassId && (c.name || '').toLowerCase().includes(searchTerm));
    
    if (availableClients.length === 0) {
        listContainer.innerHTML = '<div style="padding: 1rem; text-align: center; color: var(--text-muted);">Nenhum aluno encontrado ou todos já estão nesta turma.</div>';
        return;
    }
    
    availableClients.forEach(c => {
        const item = document.createElement('label');
        item.style.display = 'flex';
        item.style.alignItems = 'center';
        item.style.gap = '1rem';
        item.style.padding = '0.75rem 1rem';
        item.style.borderBottom = '1px solid var(--border-color)';
        item.style.cursor = 'pointer';
        item.style.transition = 'background 0.2s';
        
        item.onmouseover = () => item.style.backgroundColor = '#f9fafb';
        item.onmouseout = () => item.style.backgroundColor = 'transparent';
        
        const isChecked = selectedClientsToAdd.has(c.id);
        
        // Se o cliente já está em outra turma, mostra um aviso
        let currentClassTag = '';
        if (c.classId && c.classId !== 'unassigned') {
            const currentClass = state.classes.find(cls => cls.id === c.classId);
            if (currentClass) {
                currentClassTag = `<span class="tag" style="background-color: #fee2e2; color: #ef4444; margin-left: auto;">Já está em: ${currentClass.name}</span>`;
            }
        }
        
        item.innerHTML = `
            <input type="checkbox" value="${c.id}" class="add-client-cb" style="width: 1.2rem; height: 1.2rem; cursor: pointer; flex-shrink: 0;" ${isChecked ? 'checked' : ''}>
            <div style="display: flex; align-items: center; width: 100%;">
                <div>
                    <div style="font-weight: 500; color: var(--text-main);">${c.name || 'Sem Nome'}</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted);">${c.email || '-'}</div>
                </div>
                ${currentClassTag}
            </div>
        `;
        
        const cb = item.querySelector('.add-client-cb');
        cb.addEventListener('change', (e) => {
            if (e.target.checked) selectedClientsToAdd.add(c.id);
            else selectedClientsToAdd.delete(c.id);
        });
        
        listContainer.appendChild(item);
    });
}

document.getElementById('search-client-for-class')?.addEventListener('input', renderClientsToAddList);

document.getElementById('btn-save-clients-to-class')?.addEventListener('click', async () => {
    if (!currentAddingClassId) return;
    if (selectedClientsToAdd.size === 0) {
        window.showToast("Nenhum aluno selecionado.", "error");
        return;
    }
    
    const btn = document.getElementById('btn-save-clients-to-class');
    const originalText = btn.innerText;
    btn.disabled = true;
    btn.innerText = 'Salvando...';
    
    try {
        const batch = writeBatch(db);
        selectedClientsToAdd.forEach(clientId => {
            const clientRef = doc(db, "clients", clientId);
            batch.update(clientRef, { classId: currentAddingClassId });
        });
        
        await batch.commit();
        window.showToast(`${selectedClientsToAdd.size} aluno(s) adicionado(s) à turma!`, "success");
        window.closeAddClientsToClassModal();
    } catch (error) {
        console.error("Erro ao adicionar alunos à turma:", error);
        window.showToast("Erro ao adicionar alunos.", "error");
    } finally {
        btn.disabled = false;
        btn.innerText = originalText;
    }
});

// --- CRM (KANBAN DE VENDAS) ---

const CRM_STAGES = [
    { id: 'lead', title: 'Novos Leads', color: '#3b82f6' },        // Azul
    { id: 'contact', title: 'Em Contato', color: '#f59e0b' },     // Laranja
    { id: 'proposal', title: 'Em Negociação', color: '#8b5cf6' }, // Roxo
    { id: 'won', title: 'Pago', color: '#10b981' },               // Verde
    { id: 'lost', title: 'Perdidos', color: '#ef4444' }           // Vermelho
];

window.renderKanban = function() {
    const board = document.getElementById('kanban-board');
    if (!board) return;
    board.innerHTML = '';

    CRM_STAGES.forEach(stage => {
        const column = document.createElement('div');
        column.className = 'kanban-column';
        column.dataset.stage = stage.id;
        
        // Filtra os negócios pela Pipeline atual. Se vieram do site (sem pipelineId), caem na 1ª pipeline.
        const stageDeals = state.deals.filter(d => d.stage === stage.id && (d.pipelineId === state.currentPipelineId || (!d.pipelineId && state.pipelines.length > 0 && state.currentPipelineId === state.pipelines[0].id)));
        
        column.innerHTML = `
            <div class="kanban-column-header" style="border-bottom-color: ${stage.color}">
                <span>${stage.title}</span>
                <span class="tag" style="margin:0; background: #e2e8f0; color: var(--text-main);">${stageDeals.length}</span>
            </div>
            <div class="kanban-cards-container" data-stage="${stage.id}">
                ${stageDeals.map(deal => `
                    <div class="kanban-card" draggable="true" data-id="${deal.id}">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem;">
                            <div class="kanban-card-title">${deal.title}</div>
                            <button type="button" class="btn-icon" onclick="openDealDetails('${deal.id}')" title="Ver Detalhes" style="font-size: 1rem; color: var(--text-muted); padding: 0; margin-top: -2px;">
                                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                            </button>
                        </div>
                        <div class="kanban-card-value">${deal.value ? 'R$ ' + parseFloat(deal.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '--'}</div>
                        ${deal.crmTags && deal.crmTags.length > 0 ? `
                            <div style="display: flex; gap: 0.25rem; flex-wrap: wrap;">
                                ${deal.crmTags.map(t => `<span class="crm-tag">${t}</span>`).join('')}
                            </div>
                        ` : ''}
                        <div class="kanban-card-contact">
                            <div class="avatar" style="background-color: ${window.getAvatarColor(deal.contactName)}; width: 20px; height: 20px; font-size: 0.55rem;">${window.getInitials(deal.contactName)}</div>
                            <span>${deal.contactName || 'Sem Contato'}</span>
                        </div>
                        ${deal.stage === 'won' ? `
                            <button type="button" class="btn btn-outline w-100" onclick="exportarCarta('${deal.id}')" style="margin-top: 0.5rem; padding: 0.35rem; font-size: 0.75rem; border-color: #10b981; color: #10b981;">📄 Exportar Carta</button>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
        `;
        board.appendChild(column);
    });

    // Configuração do Drag and Drop
    const cards = board.querySelectorAll('.kanban-card');
    const containers = board.querySelectorAll('.kanban-cards-container');

    cards.forEach(card => {
        card.addEventListener('dragstart', () => {
            card.classList.add('dragging');
        });
        card.addEventListener('dragend', () => {
            card.classList.remove('dragging');
        });
    });

    containers.forEach(container => {
        container.addEventListener('dragover', e => {
            e.preventDefault();
            container.parentElement.classList.add('drag-over');
        });
        container.addEventListener('dragleave', () => {
            container.parentElement.classList.remove('drag-over');
        });
        container.addEventListener('drop', async e => {
            e.preventDefault();
            container.parentElement.classList.remove('drag-over');
            
            const draggingCard = board.querySelector('.dragging');
            if (draggingCard) {
                const dealId = draggingCard.dataset.id;
                const newStage = container.dataset.stage;
                const deal = state.deals.find(d => d.id === dealId);
                
                if (deal && deal.stage !== newStage) {
                    // Movemos localmente para feedback visual imediato
                    container.appendChild(draggingCard);
                    
                    // Atualizamos no Firestore
                    try {
                        await updateDoc(doc(db, "deals", dealId), { stage: newStage });
                    } catch(err) {
                        console.error("Erro ao mover negócio", err);
                        window.showToast("Erro ao atualizar o funil", "error");
                        renderKanban(); // Reverte caso falhe
                    }
                }
            }
        });
    });
};

window.copySubscriptionLink = function() {
    const url = window.location.origin + window.location.pathname.replace('index.html', '') + 'inscricao.html';
    window.copyToClipboard(url, "Link de inscrição copiado com sucesso!");
};

window.exportarCarta = function(dealId) {
    // Função temporária até implementarmos a lógica da carta
    window.showToast("A funcionalidade 'Exportar Carta' será implementada em breve!", "success");
};

window.updatePipelineSelector = function() {
    const select = document.getElementById('pipeline-selector');
    if (!select) return;
    select.innerHTML = '';
    state.pipelines.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name;
        select.appendChild(opt);
    });
    if (state.currentPipelineId) select.value = state.currentPipelineId;
};

document.getElementById('pipeline-selector')?.addEventListener('change', (e) => {
    state.currentPipelineId = e.target.value;
    renderKanban();
});

window.openNewPipelineModal = function() {
    document.getElementById('new-pipeline-form').reset();
    document.getElementById('new-pipeline-modal').classList.remove('hidden');
};
window.closeNewPipelineModal = function() {
    document.getElementById('new-pipeline-modal').classList.add('hidden');
};
document.getElementById('new-pipeline-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('np-name').value;
    const docRef = await addDoc(collection(db, "pipelines"), { name });
    state.currentPipelineId = docRef.id; // Troca direto pro funil novo
    window.closeNewPipelineModal();
    window.showToast("Kanban criado com sucesso!", "success");
});

window.openDealDetails = function(dealId) {
    state.editingDealId = dealId;
    const deal = state.deals.find(d => d.id === dealId);
    if (!deal) return;
    
    document.getElementById('form-deal-title').innerText = 'Detalhes da Oportunidade';
    document.getElementById('btn-submit-deal').innerText = 'Salvar Alterações';
    document.getElementById('btn-delete-deal').classList.remove('hidden');
    
    document.getElementById('nd-title').value = deal.title || '';
    document.getElementById('nd-contact').value = deal.contactName || '';
    document.getElementById('nd-value').value = deal.value || '';
    document.getElementById('nd-tags').value = (deal.crmTags || []).join(', ');
    
    const pipelineSelect = document.getElementById('nd-pipeline');
    pipelineSelect.innerHTML = '';
    state.pipelines.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name;
        pipelineSelect.appendChild(opt);
    });
    pipelineSelect.value = deal.pipelineId || (state.pipelines.length > 0 ? state.pipelines[0].id : '');
    
    const classSelect = document.getElementById('nd-class');
    classSelect.innerHTML = '<option value="unassigned">Não matricular ainda</option>';
    state.classes.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.name;
        classSelect.appendChild(opt);
    });
    
    const client = state.clients.find(c => c.email === deal.email || c.name === deal.contactName);
    if (client && client.classId) {
        classSelect.value = client.classId;
    } else {
        classSelect.value = 'unassigned';
    }
    
    document.getElementById('new-deal-modal').classList.remove('hidden');
};

window.closeNewDealModal = function() {
    document.getElementById('new-deal-modal').classList.add('hidden');
};

document.getElementById('new-deal-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btnSubmit = document.getElementById('btn-submit-deal');
    const originalText = btnSubmit.innerText;
    btnSubmit.disabled = true;
    btnSubmit.innerText = 'Salvando...';

    const rawTags = document.getElementById('nd-tags').value;
    const crmTags = rawTags.split(',').map(t => t.trim()).filter(t => t.length > 0);
    const selectedClass = document.getElementById('nd-class').value;
    const selectedPipeline = document.getElementById('nd-pipeline').value;

    const dealData = {
        title: document.getElementById('nd-title').value,
        contactName: document.getElementById('nd-contact').value,
        value: document.getElementById('nd-value').value || 0,
        crmTags: crmTags,
        pipelineId: selectedPipeline
    };

    try {
        if (state.editingDealId) {
            const deal = state.deals.find(d => d.id === state.editingDealId);
            if (selectedClass !== 'unassigned') {
                dealData.stage = 'won'; // Se matriculou, ganha a oportunidade automaticamente no funil
                const client = state.clients.find(c => c.email === deal.email || c.name === deal.contactName);
                if (client && client.classId !== selectedClass) {
                    await updateDoc(doc(db, "clients", client.id), { classId: selectedClass });
                }
            }
            await updateDoc(doc(db, "deals", state.editingDealId), dealData);
            window.showToast("Oportunidade atualizada!", "success");
        }
        window.closeNewDealModal();
    } catch (error) {
        console.error("Erro ao salvar oportunidade:", error);
        window.showToast("Erro ao salvar oportunidade.", "error");
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerText = originalText;
    }
});

window.deleteDeal = function() {
    if (!state.editingDealId) return;
    
    window.openConfirmModal(
        "Excluir Negócio",
        "Tem certeza que deseja excluir esta oportunidade? Esta ação não pode ser desfeita.",
        async () => {
            try {
                await deleteDoc(doc(db, "deals", state.editingDealId));
                window.closeNewDealModal();
                window.showToast("Negócio excluído com sucesso!", "success");
            } catch (error) {
                console.error("Erro ao deletar negócio:", error);
                window.showToast("Erro ao excluir negócio.", "error");
            }
        }
    );
};