import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, createUserWithEmailAndPassword, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, collection, getDocs, doc, updateDoc, onSnapshot, writeBatch, addDoc, deleteDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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
const db = initializeFirestore(app, {
    localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
    })
});

// App secundário para criar usuários sem deslogar o admin atual
const secondaryApp = initializeApp(firebaseConfig, "Secondary");
const secondaryAuth = getAuth(secondaryApp);

const state = {
    clients: [],
    classes: [],
    deals: [], // Negócios do CRM
    pipelines: [], // Funis/Quadros Kanban
    users: [], // Membros da equipe com acesso
    currentUser: null, // Usuário atualmente logado
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
let usersLoaded = false;

function checkInitialLoad() {
    if (!initialLoadComplete && classesLoaded && clientsLoaded && dealsLoaded && pipelinesLoaded && usersLoaded) {
        initialLoadComplete = true;
        document.getElementById('loading-view').classList.add('hidden');
        document.getElementById('app-view').classList.remove('hidden');
    }
}

// --- SISTEMA DE ACESSOS (PERMISSÕES) ---
function applyPermissions() {
    if (!state.currentUser) return;
    const perms = state.currentUser.permissions || [];
    
    // Ocultar/mostrar itens do menu conforme permissão
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(link => {
        if (link.id === 'btn-logout' || link.classList.contains('dropdown-toggle')) return;
        const target = link.getAttribute('data-target');
        if (perms.includes(target)) link.style.display = 'flex';
        else link.style.display = 'none';
    });

    // Controlar visibilidade dos dropdowns: só mostra se tiver pelo menos um sub-item visível
    document.querySelectorAll('.sidebar-nav .nav-dropdown').forEach(dropdown => {
        const subItems = Array.from(dropdown.querySelectorAll('.sub-item'));
        const hasVisibleSubItem = subItems.some(item => item.style.display === 'flex');
        
        if (hasVisibleSubItem) {
            dropdown.style.display = 'block';
            dropdown.querySelector('.dropdown-toggle').style.display = 'flex';
        } else {
            dropdown.style.display = 'none';
            dropdown.querySelector('.dropdown-toggle').style.display = 'none';
        }
    });

    // Se o item ativo estiver dentro de um dropdown, abre o dropdown correspondente
    const activeLink = document.querySelector('.sidebar-nav .nav-item.active');
    if (activeLink && activeLink.classList.contains('sub-item')) {
        const dropdown = activeLink.closest('.nav-dropdown');
        if (dropdown) {
            dropdown.classList.add('open');
            const menu = dropdown.querySelector('.dropdown-menu-items');
            if (menu) menu.classList.remove('hidden');
        }
    }

    // Se a seção atual não é permitida, joga para a primeira permitida
    const activeSection = document.querySelector('.content-section.active');
    if (activeSection && !perms.includes(activeSection.id)) {
        const firstAllowed = Array.from(document.querySelectorAll('.sidebar-nav .nav-item'))
            .find(l => l.style.display === 'flex' && !l.classList.contains('dropdown-toggle'));
        if (firstAllowed) firstAllowed.click();
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

    const settingsSnap = await getDocs(collection(db, "settings"));
    if (settingsSnap.empty) {
        const batch = writeBatch(db);
        batch.set(doc(db, "settings", "course_ser"), {
            date: "A definir", location: "Centro Mariápolis – São Leopoldo, RS", 
            priceCentavos: 91900, priceText: "919,00"
        });
        batch.set(doc(db, "settings", "course_pnl"), {
            date: "26, 27 e 28 de Agosto", location: "Centro Mariápolis – São Leopoldo, RS", 
            priceCentavos: 47700, priceText: "477,00"
        });
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
        if(document.getElementById('crm-section')?.classList.contains('active')) renderKanban();
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
        if(document.getElementById('crm-section')?.classList.contains('active')) renderKanban();
        checkInitialLoad();
    }, (error) => console.error("Erro Realtime Pipelines:", error));

    onSnapshot(collection(db, "team"), (snapshot) => {
        state.users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        usersLoaded = true;
        
        if (auth.currentUser) {
            const myRecord = state.users.find(u => u.email === auth.currentUser.email);
            if (myRecord) {
                state.currentUser = myRecord;
                applyPermissions();
            } else if (state.users.length === 0 || auth.currentUser.email === 'admin@einai.com') {
                state.currentUser = { permissions: ['dashboard-section', 'clientes-section', 'turmas-section', 'crm-section', 'site-section', 'usuarios-section', 'configs-section'] };
                applyPermissions();
            } else {
                window.showToast("Sua conta não possui permissões configuradas.", "error");
                signOut(auth);
            }
        }
        if(document.getElementById('usuarios-section')?.classList.contains('active')) renderUsers();
        checkInitialLoad();
    }, (error) => console.error("Erro Realtime Equipe:", error));

    onSnapshot(collection(db, "settings"), (snapshot) => {
        window.siteSettings = {};
        snapshot.docs.forEach(doc => { window.siteSettings[doc.id] = doc.data(); });
        if(document.getElementById('site-section')?.classList.contains('active')) window.renderSiteSettings();
    }, (error) => console.error("Erro Realtime Settings:", error));
}

// --- SISTEMA DE AUTENTICAÇÃO E NAVEGAÇÃO ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        document.getElementById('login-view').classList.add('hidden');
        
        // Exibe o carregamento enquanto busca os dados
        document.getElementById('app-view').classList.add('hidden');
        document.getElementById('loading-view').classList.remove('hidden');

        // Garante a existência do primeiro admin no banco de dados na coleção "team"
        try {
            const teamSnap = await getDocs(collection(db, "team"));
            if (teamSnap.empty) {
                await addDoc(collection(db, "team"), {
                    name: 'Administrador Principal',
                    email: user.email,
                    uid: user.uid,
                    permissions: ['dashboard-section', 'clientes-section', 'turmas-section', 'crm-section', 'site-section', 'usuarios-section', 'configs-section']
                });
            }
        } catch(e) {}

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
        usersLoaded = false;
        state.currentUser = null;
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

// --- DARK MODE ---
const isDarkMode = localStorage.getItem('einai-dark-mode') === 'true';
if (isDarkMode) document.body.classList.add('dark-mode');

document.getElementById('btn-dark-mode')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('einai-dark-mode', document.body.classList.contains('dark-mode'));
});

// --- ESQUECI A SENHA ---
document.getElementById('btn-forgot-password')?.addEventListener('click', async (e) => {
    e.preventDefault();
    const email = document.getElementById('username').value;
    if (!email) {
        window.showToast("Preencha o e-mail primeiro para redefinir a senha.", "error");
        return;
    }
    try {
        await sendPasswordResetEmail(auth, email);
        window.showToast("E-mail de redefinição enviado! Verifique sua caixa de entrada.", "success");
    } catch (error) {
        window.showToast("Erro: E-mail não encontrado ou inválido.", "error");
    }
});

// --- MOSTRAR/OCULTAR SENHA ---
document.getElementById('toggle-password')?.addEventListener('click', function() {
    const pwdInput = document.getElementById('password');
    const icon = this.querySelector('i');
    if (pwdInput.type === 'password') {
        pwdInput.type = 'text';
        this.title = 'Ocultar senha';
        icon.className = 'ph ph-eye-slash';
    } else {
        pwdInput.type = 'password';
        this.title = 'Mostrar senha';
        icon.className = 'ph ph-eye';
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
        if(currentLink.id === 'btn-logout' || currentLink.id === 'btn-dark-mode') return;

        // Se for um menu toggle de dropdown
        if (currentLink.classList.contains('dropdown-toggle')) {
            const dropdown = currentLink.parentElement;
            dropdown.classList.toggle('open');
            const menu = dropdown.querySelector('.dropdown-menu-items');
            if (menu) menu.classList.toggle('hidden');
            return;
        }
        
        document.querySelectorAll('.sidebar-nav .nav-item').forEach(l => l.classList.remove('active'));
        currentLink.classList.add('active');

        document.querySelectorAll('.content-section').forEach(sec => sec.classList.remove('active'));
        const targetId = currentLink.getAttribute('data-target');
        document.getElementById(targetId).classList.add('active');

        if(targetId === 'dashboard-section') updateDashboard();
        if(targetId === 'clientes-section') renderClients();
        if(targetId === 'turmas-section') renderClassesList();
        if(targetId === 'crm-section') renderKanban();
        if(targetId === 'site-section') window.renderSiteSettings();
        if(targetId === 'usuarios-section') renderUsers();
        if(targetId === 'cartas-section') window.initLettersTab();
        if(targetId === 'configs-section') window.renderConfigsSettings();

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

    // Contagem de inscrições pelo site
    const countPNL = state.clients.filter(c => c.tags && c.tags.includes('Inscrição PNL')).length;
    const countSER = state.clients.filter(c => c.tags && c.tags.includes('Inscrição SER')).length;
    const elPnl = document.getElementById('dash-source-pnl');
    const elSer = document.getElementById('dash-source-ser');
    if(elPnl) elPnl.innerText = countPNL;
    if(elSer) elSer.innerText = countSER;

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

function validateCPF(cpf) {
    cpf = cpf.replace(/\D/g, '');
    if (cpf.length !== 11) return false;
    if (/^(\d)\1+$/.test(cpf)) return false;
    let soma = 0;
    let resto;
    for (let i = 1; i <= 9; i++) soma = soma + parseInt(cpf.substring(i-1, i)) * (11 - i);
    resto = (soma * 10) % 11;
    if ((resto === 10) || (resto === 11)) resto = 0;
    if (resto !== parseInt(cpf.substring(9, 10))) return false;
    soma = 0;
    for (let i = 1; i <= 10; i++) soma = soma + parseInt(cpf.substring(i-1, i)) * (12 - i);
    resto = (soma * 10) % 11;
    if ((resto === 10) || (resto === 11)) resto = 0;
    if (resto !== parseInt(cpf.substring(10, 11))) return false;
    return true;
}

function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function validatePhone(phone) {
    const clean = phone.replace(/\D/g, '');
    return clean.length >= 10 && clean.length <= 11;
}

// --- UTILITÁRIO PARA TAGS (COR EXCLUSIVA) ---
window.renderTagHtml = function(tagName, removable = false) {
    let style = '';
    if (tagName === 'Inscrição PNL') {
        style = 'background-color: #dbeafe; color: #1e40af; border: 1px solid #bfdbfe;'; // Azul
    } else if (tagName === 'Inscrição SER') {
        style = 'background-color: #fef08a; color: #854d0e; border: 1px solid #fde047;'; // Amarelo
    } else if (tagName && tagName.startsWith('Inscrição')) {
        style = 'background-color: #dbeafe; color: #1e40af; border: 1px solid #bfdbfe;'; // Padrão
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
                classTagHtml = `<span class="tag" style="background-color: #e0e7ff; color: #4338ca;"><i class="ph ph-graduation-cap" style="margin-right: 0.25rem;"></i> ${clientClass.name}</span>`;
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
    const btnExport = document.getElementById('btn-export-selected');
    const btnDelete = document.getElementById('btn-bulk-delete');
    if (!btnExport || !btnDelete) return;
    if (state.selectedForExport.size > 0) {
        btnExport.classList.remove('hidden');
        btnExport.innerText = `Exportar Selecionados (${state.selectedForExport.size})`;
        btnDelete.classList.remove('hidden');
        btnDelete.innerText = `Excluir Selecionados (${state.selectedForExport.size})`;
    } else {
        btnExport.classList.add('hidden');
        btnDelete.classList.add('hidden');
    }
    
    const checkboxes = document.querySelectorAll('.client-select-cb');
    const allChecked = checkboxes.length > 0 && Array.from(checkboxes).every(cb => cb.checked);
    const selectAllCb = document.getElementById('select-all-clients');
    if (selectAllCb) selectAllCb.checked = allChecked;
}

document.getElementById('btn-bulk-delete')?.addEventListener('click', () => {
    if (state.selectedForExport.size === 0) return;
    window.openConfirmModal(
        "Excluir Múltiplos Clientes",
        `Tem certeza que deseja excluir ${state.selectedForExport.size} clientes? Esta ação não pode ser desfeita.`,
        async () => {
            try {
                const batch = writeBatch(db);
                state.selectedForExport.forEach(id => {
                    batch.delete(doc(db, "clients", id));
                });
                await batch.commit();
                state.selectedForExport.clear();
                updateExportSelectedBtn();
                window.showToast("Clientes excluídos com sucesso!", "success");
            } catch (error) {
                console.error("Erro na exclusão em lote:", error);
                window.showToast("Erro ao excluir os clientes.", "error");
            }
        }
    );
});

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

document.getElementById('nc-cep')?.addEventListener('input', function (e) {
    let v = e.target.value.replace(/\D/g, ''); // Remove tudo que não é número
    v = v.replace(/^(\d{5})(\d)/, '$1-$2'); // Hífen após os 5 primeiros
    e.target.value = v.substring(0, 9); // Limita a 9 caracteres
});

document.getElementById('nc-cep')?.addEventListener('blur', async function (e) {
    const cep = e.target.value.replace(/\D/g, '');
    if (cep.length === 8) {
        try {
            const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            const data = await res.json();
            if (!data.erro) {
                const addressInput = document.getElementById('nc-address');
                addressInput.value = `${data.logradouro}, , ${data.bairro}, ${data.localidade} - ${data.uf}`;
                addressInput.focus();
            } else {
                window.showToast('CEP não encontrado.', 'error');
            }
        } catch (err) {
            window.showToast('Erro ao buscar CEP.', 'error');
        }
    }
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
    document.getElementById('nc-cep').value = client.cep || '';
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

    const name = document.getElementById('nc-name').value;
    const email = document.getElementById('nc-email').value.trim();
    const cpf = document.getElementById('nc-cpf').value;
    const phone = document.getElementById('nc-phone').value;

    if (!validateEmail(email)) {
        window.showToast("E-mail com formato inválido.", "error");
        return;
    }

    if (!validateCPF(cpf)) {
        window.showToast("CPF inválido. Verifique os dígitos.", "error");
        return;
    }

    if (!validatePhone(phone)) {
        window.showToast("Telefone inválido. Deve conter DDD e número completo.", "error");
        return;
    }

    const btnSubmit = document.getElementById('btn-submit-client');
    const originalText = btnSubmit.innerText;
    btnSubmit.disabled = true;
    btnSubmit.innerText = 'Salvando...';

    const clientData = {
        name: name,
        email: email,
        cpf: cpf,
        cep: document.getElementById('nc-cep').value,
        birthDate: document.getElementById('nc-birthdate').value,
        phone: phone,
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
    const welcomeMsg = encodeURIComponent(`Olá ${client.name}! Tudo bem? Sou do Instituto EINAI.`);
    const phoneHtml = cleanPhone 
        ? `<a href="https://wa.me/55${cleanPhone}?text=${welcomeMsg}" target="_blank" style="color: var(--primary-color); text-decoration: none; font-weight: 500;" title="Abrir conversa no WhatsApp com mensagem de boas-vindas">${client.phone} ↗</a>` 
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

// --- GESTÃO DE ACESSOS (USUÁRIOS) ---
window.renderUsers = function() {
    const tbody = document.getElementById('users-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const sectionNames = {
        'dashboard-section': 'Dashboard',
        'clientes-section': 'Clientes',
        'turmas-section': 'Turmas',
        'crm-section': 'CRM',
        'site-section': 'Site & Preços',
        'usuarios-section': 'Acessos',
        'cartas-section': 'Carta de Confirmação',
        'configs-section': 'Configurações'
    };

    state.users.forEach(user => {
        const tr = document.createElement('tr');
        const permsHtml = (user.permissions || []).map(p => `<span class="tag">${sectionNames[p] || p}</span>`).join('');
        tr.innerHTML = `
            <td>
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <div class="avatar" style="background-color: ${window.getAvatarColor(user.name)};">${window.getInitials(user.name)}</div>
                    <strong>${user.name}</strong>
                </div>
            </td>
            <td>${user.email}</td>
            <td>${permsHtml || '<span class="text-muted">Nenhuma</span>'}</td>
            <td>
                <button class="btn btn-outline" onclick="openEditUserModal('${user.id}')" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">Editar</button>
                <button class="btn btn-outline text-danger" onclick="deleteUser('${user.id}')" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; border-color: #fca5a5;">Excluir</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
};

let editingUserId = null;

window.openNewUserModal = function() {
    editingUserId = null;
    document.getElementById('form-user-title').innerText = 'Novo Acesso';
    document.getElementById('user-form').reset();
    document.getElementById('nu-password-group').style.display = 'block';
    document.getElementById('nu-password').required = true;
    document.getElementById('user-modal').classList.remove('hidden');
};

window.closeUserModal = function() { document.getElementById('user-modal').classList.add('hidden'); };

window.openEditUserModal = function(id) {
    editingUserId = id;
    const user = state.users.find(u => u.id === id);
    if(!user) return;
    document.getElementById('form-user-title').innerText = 'Editar Permissões';
    document.getElementById('nu-name').value = user.name || '';
    document.getElementById('nu-email').value = user.email || '';
    document.getElementById('nu-password-group').style.display = 'none'; // A senha não pode ser vista na edição
    document.getElementById('nu-password').required = false;
    document.querySelectorAll('.nu-perm').forEach(cb => cb.checked = (user.permissions || []).includes(cb.value));
    document.getElementById('user-modal').classList.remove('hidden');
};

document.getElementById('user-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btnSubmit = document.getElementById('btn-submit-user');
    const originalText = btnSubmit.innerText;
    btnSubmit.disabled = true; btnSubmit.innerText = 'Salvando...';
    
    const name = document.getElementById('nu-name').value;
    const email = document.getElementById('nu-email').value;
    const password = document.getElementById('nu-password').value;
    const permissions = Array.from(document.querySelectorAll('.nu-perm:checked')).map(cb => cb.value);

    try {
        if (editingUserId) {
            await updateDoc(doc(db, "team", editingUserId), { name, email, permissions });
            window.showToast("Acesso atualizado!", "success");
        } else {
            const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
            await signOut(secondaryAuth); // Desloga a conta secundária de criação
            await addDoc(collection(db, "team"), { uid: userCredential.user.uid, name, email, permissions });
            window.showToast("Novo acesso criado com sucesso!", "success");
        }
        window.closeUserModal();
    } catch (error) {
        if (error.code === 'auth/email-already-in-use') window.showToast("Este e-mail já está em uso.", "error");
        else window.showToast("Erro ao salvar acesso.", "error");
    } finally {
        btnSubmit.disabled = false; btnSubmit.innerText = originalText;
    }
});

window.deleteUser = function(id) {
    const user = state.users.find(u => u.id === id);
    if (user && user.email === auth.currentUser.email) return window.showToast("Você não pode excluir a si mesmo.", "error");
    window.openConfirmModal("Excluir Acesso", "O usuário perderá o acesso ao painel imediatamente.", async () => {
        await deleteDoc(doc(db, "team", id)); window.showToast("Acesso removido com sucesso!", "success");
    });
};

window.toggleRedirectInputs = function(courseKey) {
    const mode = document.getElementById(`site-${courseKey}-checkout-mode`).value;
    const container = document.getElementById(`site-${courseKey}-links-container`);
    if(container) {
        container.style.display = mode === 'redirect' ? 'block' : 'none';
    }
};

// --- GESTÃO DE SITE E PREÇOS ---
window.renderSiteSettings = function() {
    const st = window.siteSettings || {};
    if(st['course_ser']) {
        document.getElementById('site-ser-date').value = st['course_ser'].date || '';
        document.getElementById('site-ser-loc').value = st['course_ser'].location || '';
        document.getElementById('site-ser-price').value = ((st['course_ser'].priceCentavos || 0) / 100).toFixed(2);
        document.getElementById('site-ser-old-price').value = st['course_ser'].oldPriceCentavos ? ((st['course_ser'].oldPriceCentavos || 0) / 100).toFixed(2) : '';
        document.getElementById('site-ser-promo-timer').checked = !!st['course_ser'].promoTimer;
        
        document.getElementById('site-ser-installments').value = st['course_ser'].installments || 12;
        document.getElementById('site-ser-installment-price').value = st['course_ser'].installmentPrice ? st['course_ser'].installmentPrice.toFixed(2) : '';
        
        const mode = st['course_ser'].checkoutMode || 'transparent';
        document.getElementById('site-ser-checkout-mode').value = mode;
        const links = st['course_ser'].redirectLinks || {};
        document.getElementById('site-ser-link-1x').value = links.link1x || '';
        document.getElementById('site-ser-link-3x').value = links.link3x || '';
        document.getElementById('site-ser-link-6x').value = links.link6x || '';
        document.getElementById('site-ser-link-10x').value = links.link10x || '';
        document.getElementById('site-ser-link-12x').value = links.link12x || '';
        window.toggleRedirectInputs('ser');
    }
    if(st['course_pnl']) {
        document.getElementById('site-pnl-date').value = st['course_pnl'].date || '';
        document.getElementById('site-pnl-loc').value = st['course_pnl'].location || '';
        document.getElementById('site-pnl-price').value = ((st['course_pnl'].priceCentavos || 0) / 100).toFixed(2);
        document.getElementById('site-pnl-old-price').value = st['course_pnl'].oldPriceCentavos ? ((st['course_pnl'].oldPriceCentavos || 0) / 100).toFixed(2) : '';
        document.getElementById('site-pnl-promo-timer').checked = !!st['course_pnl'].promoTimer;
        
        document.getElementById('site-pnl-installments').value = st['course_pnl'].installments || 12;
        document.getElementById('site-pnl-installment-price').value = st['course_pnl'].installmentPrice ? st['course_pnl'].installmentPrice.toFixed(2) : '';
        
        const mode = st['course_pnl'].checkoutMode || 'transparent';
        document.getElementById('site-pnl-checkout-mode').value = mode;
        const links = st['course_pnl'].redirectLinks || {};
        document.getElementById('site-pnl-link-1x').value = links.link1x || '';
        document.getElementById('site-pnl-link-3x').value = links.link3x || '';
        document.getElementById('site-pnl-link-6x').value = links.link6x || '';
        document.getElementById('site-pnl-link-10x').value = links.link10x || '';
        document.getElementById('site-pnl-link-12x').value = links.link12x || '';
        window.toggleRedirectInputs('pnl');
    }
};

async function saveSiteConfig(courseId, btn, dateId, locId, priceId, oldPriceId, promoTimerId) {
    const originalText = btn.innerText;
    btn.innerText = 'Salvando...'; btn.disabled = true;
    try {
        const priceNum = parseFloat(document.getElementById(priceId).value);
        const oldPriceVal = document.getElementById(oldPriceId).value;
        const oldPriceNum = oldPriceVal ? parseFloat(oldPriceVal) : null;
        const promoTimer = document.getElementById(promoTimerId).checked;
        
        const courseKey = courseId === 'course_ser' ? 'ser' : 'pnl';
        const checkoutMode = document.getElementById(`site-${courseKey}-checkout-mode`).value;
        const redirectLinks = {
            link1x: document.getElementById(`site-${courseKey}-link-1x`).value.trim(),
            link3x: document.getElementById(`site-${courseKey}-link-3x`).value.trim(),
            link6x: document.getElementById(`site-${courseKey}-link-6x`).value.trim(),
            link10x: document.getElementById(`site-${courseKey}-link-10x`).value.trim(),
            link12x: document.getElementById(`site-${courseKey}-link-12x`).value.trim()
        };

        const installmentsNum = parseInt(document.getElementById(`site-${courseKey}-installments`).value) || 12;
        const installmentPriceVal = document.getElementById(`site-${courseKey}-installment-price`).value;
        const installmentPriceNum = installmentPriceVal ? parseFloat(installmentPriceVal) : null;

        const data = {
            date: document.getElementById(dateId).value,
            location: document.getElementById(locId).value,
            priceCentavos: Math.round(priceNum * 100),
            priceText: priceNum.toLocaleString('pt-BR', {minimumFractionDigits: 2}),
            oldPriceCentavos: oldPriceNum ? Math.round(oldPriceNum * 100) : null,
            oldPriceText: oldPriceNum ? oldPriceNum.toLocaleString('pt-BR', {minimumFractionDigits: 2}) : '',
            promoTimer: promoTimer,
            checkoutMode: checkoutMode,
            redirectLinks: redirectLinks,
            installments: installmentsNum,
            installmentPrice: installmentPriceNum
        };
        await setDoc(doc(db, "settings", courseId), data, { merge: true });
        window.showToast("Configurações atualizadas!", "success");
    } catch(e) {
        window.showToast("Erro ao salvar", "error");
    } finally {
        btn.innerText = originalText; btn.disabled = false;
    }
}

document.getElementById('form-site-ser')?.addEventListener('submit', (e) => { e.preventDefault();
    saveSiteConfig('course_ser', e.target.querySelector('button'), 'site-ser-date', 'site-ser-loc', 'site-ser-price', 'site-ser-old-price', 'site-ser-promo-timer'); });
document.getElementById('form-site-pnl')?.addEventListener('submit', (e) => { e.preventDefault();
    saveSiteConfig('course_pnl', e.target.querySelector('button'), 'site-pnl-date', 'site-pnl-loc', 'site-pnl-price', 'site-pnl-old-price', 'site-pnl-promo-timer'); });

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
    
    const csvContent = "Nome,CPF,E-mail,Telefone,Empresa,Tags\n" + clientsToExport.map(c => `"${c.name}","${c.cpf || ''}","${c.email}","${c.phone}","${c.company || ''}","${(c.tags || []).join(', ')}"`).join("\n");
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

    const csvContent = "Nome,CPF,E-mail,Telefone,Empresa,Tags\n" + clientsToExport.map(c => `"${c.name}","${c.cpf || ''}","${c.email}","${c.phone}","${c.company || ''}","${c.tags.join(', ')}"`).join("\n");
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

    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.kanban-card:not(.dragging)')];
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    CRM_STAGES.forEach(stage => {
        const column = document.createElement('div');
        column.className = 'kanban-column';
        column.dataset.stage = stage.id;
        
        // Filtra os negócios pela Pipeline atual. Se vieram do site (sem pipelineId), caem na 1ª pipeline.
        const stageDeals = state.deals.filter(d => d.stage === stage.id && (d.pipelineId === state.currentPipelineId || (!d.pipelineId && state.pipelines.length > 0 && state.currentPipelineId === state.pipelines[0].id)));
        
        // Ordena por posição vertical de forma ascendente (ou createdAt caso não exista posição)
        stageDeals.sort((a, b) => {
            const posA = a.position !== undefined ? a.position : 999999;
            const posB = b.position !== undefined ? b.position : 999999;
            if (posA !== posB) return posA - posB;
            return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
        });
        
        column.innerHTML = `
            <div class="kanban-column-header" style="border-bottom-color: ${stage.color}">
                <span>${stage.title}</span>
                <span class="tag" style="margin:0; background: #e2e8f0; color: var(--text-main);">${stageDeals.length}</span>
            </div>
            <div class="kanban-cards-container" data-stage="${stage.id}">
                ${stageDeals.map(deal => {
                    const client = state.clients.find(c => (deal.email && c.email === deal.email) || c.name === deal.contactName);
                    const phone = client ? client.phone : deal.phone;
                    let whatsappBtn = '';
                    if (phone) {
                        const cleanPhone = phone.replace(/\D/g, '');
                        const pipeline = state.pipelines.find(p => p.id === deal.pipelineId);
                        const pipelineName = pipeline ? pipeline.name : 'treinamento';
                        const welcomeMsg = encodeURIComponent(`Olá ${deal.contactName}! Tudo bem? Sou do Instituto EINAI e gostaria de conversar sobre o seu interesse no ${pipelineName}.`);
                        whatsappBtn = `
                        <a href="https://wa.me/55${cleanPhone}?text=${welcomeMsg}" target="_blank" onclick="event.stopPropagation();" class="kanban-whatsapp-btn" title="Chamar no WhatsApp com mensagem de boas-vindas" style="display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 50%; background: #25d366; color: white; text-decoration: none; border: 1px solid #128c7e; transition: transform 0.2s;">
                            <i class="ph ph-whatsapp-logo" style="font-size: 1rem;"></i>
                        </a>
                        `;
                    }
                    const sellerHtml = deal.responsibleName ? `
                        <div class="kanban-card-seller" style="font-size: 0.75rem; color: var(--text-muted); display: flex; align-items: center; gap: 0.2rem; margin-top: 0.25rem;">
                            <i class="ph ph-user" style="font-size: 0.8rem; color: var(--primary-color);"></i> Vendedor: <strong>${deal.responsibleName}</strong>
                        </div>
                    ` : `
                        <div class="kanban-card-seller text-muted" style="font-size: 0.75rem; font-style: italic; margin-top: 0.25rem;">
                            Sem vendedor designado
                        </div>
                    `;
                    return `
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
                        ${sellerHtml}
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem; border-top: 1px solid var(--border-color); padding-top: 0.5rem;">
                            <div class="kanban-card-contact" style="margin: 0;">
                                <div class="avatar" style="background-color: ${window.getAvatarColor(deal.contactName)}; width: 20px; height: 20px; font-size: 0.55rem;">${window.getInitials(deal.contactName)}</div>
                                <span style="font-size: 0.8rem; font-weight: 500;">${deal.contactName || 'Sem Contato'}</span>
                            </div>
                            ${whatsappBtn}
                        </div>
                        ${deal.stage === 'won' ? `
                            <button type="button" class="btn btn-outline w-100" onclick="openDealDetails('${deal.id}')" style="margin-top: 0.5rem; padding: 0.35rem; font-size: 0.75rem; border-color: #10b981; color: #10b981; font-weight: 600;">✉️ Enviar Carta por E-mail</button>
                        ` : ''}
                    </div>
                `}).join('')}
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
            const draggingCard = board.querySelector('.dragging');
            if (draggingCard) {
                const afterElement = getDragAfterElement(container, e.clientY);
                if (afterElement == null) {
                    container.appendChild(draggingCard);
                } else {
                    container.insertBefore(draggingCard, afterElement);
                }
            }
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
                
                // Mapeia todos os cards na coluna de destino para salvar a ordem
                const cardsInColumn = [...container.querySelectorAll('.kanban-card')];
                
                try {
                    const batch = writeBatch(db);
                    cardsInColumn.forEach((cardEl, index) => {
                        const cardIdInCol = cardEl.dataset.id;
                        const dealRef = doc(db, "deals", cardIdInCol);
                        if (cardIdInCol === dealId) {
                            batch.update(dealRef, { stage: newStage, position: index });
                        } else {
                            batch.update(dealRef, { position: index });
                        }
                    });
                    await batch.commit();
                } catch(err) {
                    console.error("Erro ao reordenar negócios:", err);
                    window.showToast("Erro ao atualizar ordenação do funil.", "error");
                    renderKanban(); // Reverte caso falhe
                }
            }
        });
    });
};

window.copySubscriptionLink = function() {
    const url = window.location.origin + window.location.pathname.replace('admin.html', '') + 'inscricao.html';
    window.copyToClipboard(url, "Link de inscrição copiado com sucesso!");
};

window.exportarCarta = async function(dealId) {
    const deal = state.deals.find(d => d.id === dealId);
    if (!deal) return;

    window.showToast("Gerando PDF da carta...", "info");

    try {
        const pipeline = state.pipelines.find(p => p.id === deal.pipelineId);
        const isPnl = pipeline && pipeline.name.toLowerCase().includes("pnl");
        const courseDocId = isPnl ? "course_pnl" : "course_ser";

        // Busca configurações do curso para caso não haja data/local definidos no negócio
        let fallbackDate = "";
        let fallbackLoc = "";
        try {
            const docSnap = await getDoc(doc(db, "settings", courseDocId));
            if (docSnap.exists()) {
                const data = docSnap.data();
                fallbackDate = data.date || "";
                fallbackLoc = data.location || "";
            }
        } catch(e) {
            console.error("Erro ao buscar configurações do curso:", e);
        }

        const letterDate = deal.letterDate || fallbackDate || (isPnl ? "24, 25 e 26 de fevereiro de 2026" : "a definir");
        const letterLoc = deal.letterLoc || fallbackLoc || (isPnl ? "Centro Mariápolis Arnold\nAv. Theodomiro Porto da Fonseca, 3555, Bairro Cristo Rei, São Leopoldo, RS\nO horário de início será das 18h59min e o término está previsto para 23h.\nA recepção será feita após as 18h29min." : "a definir");

        const templates = window.siteSettings && window.siteSettings['letter_templates'] || {};
        const templateText = isPnl 
            ? (templates.pnlTemplate || getDefaultPnlTemplate())
            : (templates.serTemplate || getDefaultSerTemplate());

        const parsedText = templateText
            .replace(/{nome}/g, deal.contactName)
            .replace(/{data}/g, letterDate)
            .replace(/{local}/g, letterLoc);

        // Gerar PDF usando jsPDF
        const { jsPDF } = window.jspdf;
        const docPdf = new jsPDF();
        
        await drawLetterPDF(docPdf, parsedText, isPnl);
        
        docPdf.save(`Carta_Confirmacao_${deal.contactName.replace(/\s+/g, '_')}.pdf`);
        window.showToast("Carta de confirmação exportada com sucesso!", "success");
    } catch(err) {
        console.error("Erro ao exportar carta:", err);
        window.showToast("Erro ao gerar PDF da carta de confirmação.", "error");
    }
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
    
    const responsibleSelect = document.getElementById('nd-responsible');
    responsibleSelect.innerHTML = '<option value="">Ninguém designado</option>';
    state.users.forEach(u => {
        const opt = document.createElement('option');
        opt.value = u.name;
        opt.textContent = u.name;
        responsibleSelect.appendChild(opt);
    });
    responsibleSelect.value = deal.responsibleName || '';
    
    const classSelect = document.getElementById('nd-class');
    classSelect.innerHTML = '<option value="unassigned">Não matricular ainda</option>';
    state.classes.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.name;
        classSelect.appendChild(opt);
    });
    
    const client = state.clients.find(c => (deal.email && c.email === deal.email) || c.name === deal.contactName);
    
    const clientInfoCard = document.getElementById('nd-client-info-card');
    if (client) {
        document.getElementById('nd-client-email').innerText = client.email || 'Não informado';
        
        const phoneLink = document.getElementById('nd-client-phone');
        if (client.phone) {
            phoneLink.innerText = client.phone;
            const cleanPhone = client.phone.replace(/\D/g, '');
            const pipeline = state.pipelines.find(p => p.id === deal.pipelineId);
            const pipelineName = pipeline ? pipeline.name : 'treinamento';
            const welcomeMsg = encodeURIComponent(`Olá ${deal.contactName}! Tudo bem? Sou do Instituto EINAI e gostaria de conversar sobre o seu interesse no ${pipelineName}.`);
            phoneLink.href = `https://wa.me/55${cleanPhone}?text=${welcomeMsg}`;
        } else {
            phoneLink.innerText = 'Não informado';
            phoneLink.href = '#';
        }
        
        clientInfoCard.classList.remove('hidden');
        classSelect.value = client.classId || 'unassigned';
    } else {
        clientInfoCard.classList.add('hidden');
        classSelect.value = 'unassigned';
    }
    
    // Configura painel condicional de carta para estágio won (pago)
    const letterPanel = document.getElementById('nd-letter-panel');
    if (deal.stage === 'won' || classSelect.value !== 'unassigned') {
        letterPanel.classList.remove('hidden');
        
        const isPnl = pipelineSelect.selectedOptions[0]?.text.toLowerCase().includes("pnl");
        const settingsKey = isPnl ? 'course_pnl' : 'course_ser';
        const courseSettings = window.siteSettings && window.siteSettings[settingsKey];
        
        document.getElementById('nd-letter-date').value = (deal.letterDate || (courseSettings ? courseSettings.date : '')) || '';
        document.getElementById('nd-letter-loc').value = (deal.letterLoc || (courseSettings ? courseSettings.location : '')) || '';
    } else {
        letterPanel.classList.add('hidden');
        document.getElementById('nd-letter-date').value = '';
        document.getElementById('nd-letter-loc').value = '';
    }

    const togglePanel = () => {
        if (classSelect.value !== 'unassigned') {
            letterPanel.classList.remove('hidden');
            const isPnl = pipelineSelect.selectedOptions[0]?.text.toLowerCase().includes("pnl");
            const settingsKey = isPnl ? 'course_pnl' : 'course_ser';
            const courseSettings = window.siteSettings && window.siteSettings[settingsKey];
            if (!document.getElementById('nd-letter-date').value) {
                document.getElementById('nd-letter-date').value = (courseSettings ? courseSettings.date : '') || '';
            }
            if (!document.getElementById('nd-letter-loc').value) {
                document.getElementById('nd-letter-loc').value = (courseSettings ? courseSettings.location : '') || '';
            }
        } else if (deal.stage !== 'won') {
            letterPanel.classList.add('hidden');
        }
    };
    classSelect.onchange = togglePanel;
    pipelineSelect.onchange = togglePanel;
    
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
    const responsibleName = document.getElementById('nd-responsible').value;
    const letterDate = document.getElementById('nd-letter-date').value;
    const letterLoc = document.getElementById('nd-letter-loc').value;

    const dealData = {
        title: document.getElementById('nd-title').value,
        contactName: document.getElementById('nd-contact').value,
        value: document.getElementById('nd-value').value || 0,
        crmTags: crmTags,
        pipelineId: selectedPipeline,
        responsibleName: responsibleName,
        letterDate: letterDate,
        letterLoc: letterLoc
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

// --- CONFIGURAÇÕES DE EMAILJS E CARTAS ---
window.renderConfigsSettings = function() {
    const emailConfig = window.siteSettings && window.siteSettings['email_config'] || {};
    const eredeConfig = window.siteSettings && window.siteSettings['erede_config'] || {};
    const asaasConfig = window.siteSettings && window.siteSettings['asaas_config'] || {};
    const templates = window.siteSettings && window.siteSettings['letter_templates'] || {};

    document.getElementById('config-service-id').value = emailConfig.serviceId || '';
    document.getElementById('config-template-id').value = emailConfig.templateId || '';
    document.getElementById('config-public-key').value = emailConfig.publicKey || '';

    // Fill e-Rede Configs
    const eredePvInput = document.getElementById('config-erede-pv');
    const eredeTokenInput = document.getElementById('config-erede-token');
    const eredeEnvSelect = document.getElementById('config-erede-env');
    
    if (eredePvInput) eredePvInput.value = eredeConfig.pv || '';
    if (eredeTokenInput) eredeTokenInput.value = eredeConfig.token || '';
    if (eredeEnvSelect) eredeEnvSelect.value = eredeConfig.production ? 'production' : 'sandbox';

    // Fill Asaas Configs
    const asaasTokenInput = document.getElementById('config-asaas-token');
    const asaasWalletInput = document.getElementById('config-asaas-wallet');
    const asaasEnvSelect = document.getElementById('config-asaas-env');

    if (asaasTokenInput) asaasTokenInput.value = asaasConfig.token || '';
    if (asaasWalletInput) asaasWalletInput.value = asaasConfig.walletId || '';
    if (asaasEnvSelect) asaasEnvSelect.value = asaasConfig.production ? 'production' : 'sandbox';

    const pnlInput = document.getElementById('config-template-pnl');
    const serInput = document.getElementById('config-template-ser');
    if (pnlInput) pnlInput.value = templates.pnlTemplate || getDefaultPnlTemplate();
    if (serInput) serInput.value = templates.serTemplate || getDefaultSerTemplate();
};

document.getElementById('form-email-config')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    const originalText = btn.innerText;
    btn.innerText = 'Salvando...'; btn.disabled = true;

    try {
        const serviceId = document.getElementById('config-service-id').value;
        const templateId = document.getElementById('config-template-id').value;
        const publicKey = document.getElementById('config-public-key').value;

        await setDoc(doc(db, "settings", "email_config"), { serviceId, templateId, publicKey }, { merge: true });
        window.showToast("Configurações do EmailJS salvas com sucesso!", "success");
    } catch (err) {
        console.error("Erro ao salvar config de e-mail:", err);
        window.showToast("Erro ao salvar configurações.", "error");
    } finally {
        btn.innerText = originalText; btn.disabled = false;
    }
});

document.getElementById('form-erede-config')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    const originalText = btn.innerText;
    btn.innerText = 'Salvando...'; btn.disabled = true;

    try {
        const pv = document.getElementById('config-erede-pv').value.trim();
        const token = document.getElementById('config-erede-token').value.trim();
        const env = document.getElementById('config-erede-env').value;
        const production = env === 'production';

        await setDoc(doc(db, "settings", "erede_config"), { pv, token, production }, { merge: true });
        
        if (!window.siteSettings) window.siteSettings = {};
        window.siteSettings['erede_config'] = { pv, token, production };

        window.showToast("Configurações da e.Rede salvas com sucesso!", "success");
    } catch(err) {
        console.error("Erro ao salvar config e-Rede:", err);
        window.showToast("Erro ao salvar configurações da e.Rede.", "error");
    } finally {
        btn.innerText = originalText; btn.disabled = false;
    }
});

document.getElementById('form-asaas-config')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    const originalText = btn.innerText;
    btn.innerText = 'Salvando...'; btn.disabled = true;

    try {
        const token = document.getElementById('config-asaas-token').value.trim();
        const walletId = document.getElementById('config-asaas-wallet').value.trim();
        const env = document.getElementById('config-asaas-env').value;
        const production = env === 'production';

        await setDoc(doc(db, "settings", "asaas_config"), { token, walletId, production }, { merge: true });
        
        if (!window.siteSettings) window.siteSettings = {};
        window.siteSettings['asaas_config'] = { token, walletId, production };

        window.showToast("Configurações do Asaas salvas com sucesso!", "success");
    } catch(err) {
        console.error("Erro ao salvar config Asaas:", err);
        window.showToast("Erro ao salvar configurações do Asaas.", "error");
    } finally {
        btn.innerText = originalText; btn.disabled = false;
    }
});

document.getElementById('form-letter-templates')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    const originalText = btn.innerText;
    btn.innerText = 'Salvando...'; btn.disabled = true;

    try {
        const pnlTemplate = document.getElementById('config-template-pnl').value;
        const serTemplate = document.getElementById('config-template-ser').value;

        await setDoc(doc(db, "settings", "letter_templates"), { pnlTemplate, serTemplate }, { merge: true });
        window.showToast("Modelos de cartas salvos com sucesso!", "success");
    } catch (err) {
        console.error("Erro ao salvar templates de carta:", err);
        window.showToast("Erro ao salvar modelos.", "error");
    } finally {
        btn.innerText = originalText; btn.disabled = false;
    }
});

// --- GERAÇÃO DE PDF E ENVIO DO EMAILJS ---
document.getElementById('btn-send-letter')?.addEventListener('click', async () => {
    const dealId = state.editingDealId;
    const deal = state.deals.find(d => d.id === dealId);
    if (!deal) return;

    const emailConfig = window.siteSettings && window.siteSettings['email_config'];
    const templates = window.siteSettings && window.siteSettings['letter_templates'];

    if (!emailConfig || !emailConfig.serviceId || !emailConfig.templateId || !emailConfig.publicKey) {
        window.showToast("Configure as credenciais do EmailJS na aba de Configurações antes de enviar.", "error");
        return;
    }

    const btn = document.getElementById('btn-send-letter');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="ph ph-spinner" style="margin-right: 0.5rem; animation: spin 1s linear infinite;"></i> Enviando...';

    try {
        const email = deal.email || (state.clients.find(c => c.name === deal.contactName)?.email);
        if (!email) {
            window.showToast("E-mail do cliente não encontrado.", "error");
            btn.disabled = false; btn.innerHTML = originalText;
            return;
        }

        const pipeline = state.pipelines.find(p => p.id === deal.pipelineId);
        const isPnl = pipeline && pipeline.name.toLowerCase().includes("pnl");
        
        const letterDate = document.getElementById('nd-letter-date').value;
        const letterLoc = document.getElementById('nd-letter-loc').value;

        // Obter o template e substituir os marcadores
        const templateText = isPnl 
            ? (templates?.pnlTemplate || getDefaultPnlTemplate())
            : (templates?.serTemplate || getDefaultSerTemplate());

        const parsedText = templateText
            .replace(/{nome}/g, deal.contactName)
            .replace(/{data}/g, letterDate)
            .replace(/{local}/g, letterLoc);

        // Gerar PDF usando jsPDF
        const { jsPDF } = window.jspdf;
        const docPdf = new jsPDF();
        
        await drawLetterPDF(docPdf, parsedText, isPnl);

        const pdfDataUri = docPdf.output('datauristring'); // data:application/pdf;base64,JVBERi0xLjQK...

        // Inicializar EmailJS com a chave pública
        emailjs.init(emailConfig.publicKey);

        const templateParams = {
            to_email: email,
            to_name: deal.contactName,
            subject: `Confirmado: Sua vaga no ${isPnl ? 'Introdução à PNL' : 'Treinamento SER'}!`,
            message: `Olá ${deal.contactName},\n\nSua confirmação foi emitida com sucesso. O documento em PDF contendo as informações de data e local está em anexo a este e-mail.\n\nAtenciosamente,\nInstituto EINAI`,
            attachment: pdfDataUri
        };

        await emailjs.send(emailConfig.serviceId, emailConfig.templateId, templateParams);
        
        // Atualiza o deal com os valores de data e local enviados na carta
        await updateDoc(doc(db, "deals", dealId), {
            letterDate: letterDate,
            letterLoc: letterLoc,
            letterSentAt: new Date().toISOString()
        });

        window.showToast("Carta de confirmação enviada com sucesso!", "success");
    } catch (err) {
        console.error("Erro ao gerar/enviar carta:", err);
        window.showToast("Erro ao enviar e-mail. Verifique as credenciais e tente novamente.", "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
});

// Função auxiliar para carregar a imagem do logotipo
function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = (e) => reject(e);
        img.src = src;
    });
}

function getDefaultPnlTemplate() {
    return `<p>Olá {nome},</p><p>Seja muito bem-vindo(a) ao <strong>INTRODUÇÃO À PNL</strong>.</p><p>Informamos que a sua participação no curso que acontecerá nos dias {data} já está confirmada.</p><p>Lembramos que o Introdução à PNL se trata da iniciação das ferramentas da programação neurolinguísticas. Três dias que permitirão você entender um pouco mais da estrutura mental de comportamentos, crenças, ações e reações, bem como ampliar suas capacidades de comunicação e relacionamento intrapessoal e interpessoal.</p><p style="color: rgb(49, 130, 206);"><strong><em>Local e Horário</em></strong></p><p><strong>Centro Mariápolis Arnold</strong><br>Av. Theodomiro Porto da Fonseca, 3555, Bairro Cristo Rei, São Leopoldo, RS<br>O horário de início será das 18h59min e o término está previsto para 23h.<br>A recepção será feita após as 18h29min.</p><p style="color: rgb(49, 130, 206);"><strong><em>Mensagem para você</em></strong></p><p><strong>Evolução do Ser Humano:</strong> acreditamos que as pessoas são as únicas responsáveis por esse processo, e que a busca pela excelência da qualidade de vida esteja em oferecer caminhos para que as pessoas interajam e tenham tempo umas para as outras.</p><p>Para nós é fator primordial poder modificar nossos pensamentos e comportamentos, buscar a evolução pessoal e aprimorar o melhor do ser humano. Nossas capacidades devem ser estimuladas, e por isso desenvolvemos técnicas que nos possibilitam aperfeiçoar a forma de nos comunicarmos, expressarmos e realizarmos escolhas.</p><p>Muito obrigado pela confiança depositada em nosso trabalho. Temos a certeza que estamos preparados para surpreendê-la.</p><p>Desejamos a você um excelente curso.</p><p>Grande abraço,<br>Equipe Einai</p>`;
}

function getDefaultSerTemplate() {
    return `<p>Prezado(a) {nome},</p><p>Sua inscrição no treinamento <strong>SER - Evolução e Liderança</strong> foi confirmada com sucesso!</p><p>Informações do Treinamento:<br>Data: {data}<br>Local: {local}</p><p>Esperamos você lá!</p><p>Abraços,<br>Instituto EINAI</p>`;
}

async function drawLetterPDF(docPdf, parsedText, isPnl) {
    const printDiv = document.createElement('div');
    printDiv.id = 'letter-print-container';
    printDiv.style.width = '794px';
    printDiv.style.minHeight = '1123px';
    printDiv.style.padding = '70px 60px';
    printDiv.style.boxSizing = 'border-box';
    printDiv.style.fontFamily = 'Arial, sans-serif';
    printDiv.style.fontSize = '14px';
    printDiv.style.lineHeight = '1.6';
    printDiv.style.color = '#1e293b';
    printDiv.style.background = 'white';
    printDiv.style.position = 'fixed';
    printDiv.style.left = '-9999px';
    printDiv.style.top = '-9999px';
    
    const templates = window.siteSettings && window.siteSettings['letter_templates'] || {};
    const savedCustomLogo = isPnl ? templates.pnlLogo : templates.serLogo;
    
    const logoSrc = savedCustomLogo || (isPnl ? 'assets/img/CHAVE.png' : 'assets/img/ser-logo.png');
    const logoHeight = isPnl && !savedCustomLogo ? '90px' : '50px';
    
    printDiv.innerHTML = `
        <div style="text-align: center; margin-bottom: 25px;">
            <img src="${logoSrc}" style="max-height: ${logoHeight}; display: inline-block;">
        </div>
        <div style="text-align: center; margin-bottom: 35px;">
            <h2 style="margin: 0; font-size: 20px; font-weight: 700; color: #1e3a8a; font-style: italic; font-family: Arial, sans-serif;">CARTA DE CONFIRMAÇÃO</h2>
        </div>
        <div style="text-align: justify; font-size: 14px; color: #334155; font-family: Arial, sans-serif;">
            ${parsedText}
        </div>
    `;
    
    document.body.appendChild(printDiv);
    
    await new Promise(r => setTimeout(r, 300));
    
    try {
        const canvas = await html2canvas(printDiv, {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff'
        });
        
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        docPdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);
    } finally {
        document.body.removeChild(printDiv);
    }
}

let quillInstance = null;
let currentCustomLogoBase64 = null;

window.initLettersTab = function() {
    if (!quillInstance) {
        quillInstance = new Quill('#quill-editor', {
            theme: 'snow',
            modules: {
                toolbar: [
                    ['bold', 'italic', 'underline'],
                    [{ 'color': [] }],
                    ['clean']
                ]
            }
        });

        quillInstance.on('text-change', () => {
            updateLetterPreview();
        });

        document.getElementById('letter-course-select').addEventListener('change', (e) => {
            currentCustomLogoBase64 = null;
            loadTemplateToEditor(e.target.value);
        });

        // Logo Upload Handler
        document.getElementById('letter-logo-upload')?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                currentCustomLogoBase64 = event.target.result;
                updateLetterPreview();
                
                const btnRemove = document.getElementById('btn-remove-letter-logo');
                if (btnRemove) btnRemove.style.display = 'inline-flex';
            };
            reader.readAsDataURL(file);
        });

        // Logo Remove Handler
        document.getElementById('btn-remove-letter-logo')?.addEventListener('click', () => {
            currentCustomLogoBase64 = 'REMOVE';
            updateLetterPreview();
            
            const btnRemove = document.getElementById('btn-remove-letter-logo');
            if (btnRemove) btnRemove.style.display = 'none';
            
            const fileInput = document.getElementById('letter-logo-upload');
            if (fileInput) fileInput.value = '';
        });

        document.getElementById('btn-save-letter-templates').addEventListener('click', async () => {
            const course = document.getElementById('letter-course-select').value;
            const htmlContent = quillInstance.root.innerHTML;
            
            const btn = document.getElementById('btn-save-letter-templates');
            const originalText = btn.innerText;
            btn.innerText = 'Salvando...'; btn.disabled = true;
            
            try {
                const docRef = doc(db, "settings", "letter_templates");
                const dataToSave = {};
                
                if (course === 'pnl') {
                    dataToSave.pnlTemplate = htmlContent;
                    if (currentCustomLogoBase64 === 'REMOVE') {
                        dataToSave.pnlLogo = null;
                    } else if (currentCustomLogoBase64) {
                        dataToSave.pnlLogo = currentCustomLogoBase64;
                    }
                } else {
                    dataToSave.serTemplate = htmlContent;
                    if (currentCustomLogoBase64 === 'REMOVE') {
                        dataToSave.serLogo = null;
                    } else if (currentCustomLogoBase64) {
                        dataToSave.serLogo = currentCustomLogoBase64;
                    }
                }
                
                await setDoc(docRef, dataToSave, { merge: true });
                
                // Update local cache
                if (!window.siteSettings) window.siteSettings = {};
                if (!window.siteSettings['letter_templates']) window.siteSettings['letter_templates'] = {};
                
                if (course === 'pnl') {
                    window.siteSettings['letter_templates'].pnlTemplate = htmlContent;
                    if (dataToSave.pnlLogo !== undefined) {
                        window.siteSettings['letter_templates'].pnlLogo = dataToSave.pnlLogo;
                    }
                } else {
                    window.siteSettings['letter_templates'].serTemplate = htmlContent;
                    if (dataToSave.serLogo !== undefined) {
                        window.siteSettings['letter_templates'].serLogo = dataToSave.serLogo;
                    }
                }
                
                currentCustomLogoBase64 = null;
                window.showToast("Modelo e logotipo salvos com sucesso!", "success");
                loadTemplateToEditor(course);
            } catch(err) {
                console.error("Erro ao salvar template:", err);
                window.showToast("Erro ao salvar modelo.", "error");
            } finally {
                btn.innerText = originalText; btn.disabled = false;
            }
        });
    }

    const activeCourse = document.getElementById('letter-course-select').value || 'pnl';
    loadTemplateToEditor(activeCourse);
};

window.insertPlaceholder = function(placeholder) {
    if (!quillInstance) return;
    const range = quillInstance.getSelection(true);
    quillInstance.insertText(range.index, placeholder);
    quillInstance.setSelection(range.index + placeholder.length);
};

function updateLetterPreview() {
    if (!quillInstance) return;
    const course = document.getElementById('letter-course-select').value;
    const logoImg = document.getElementById('letter-preview-logo');
    
    if (logoImg) {
        const templates = window.siteSettings && window.siteSettings['letter_templates'] || {};
        const savedCustomLogo = course === 'pnl' ? templates.pnlLogo : templates.serLogo;
        
        if (currentCustomLogoBase64 === 'REMOVE') {
            logoImg.src = course === 'pnl' ? 'assets/img/CHAVE.png' : 'assets/img/ser-logo.png';
        } else if (currentCustomLogoBase64) {
            logoImg.src = currentCustomLogoBase64;
        } else if (savedCustomLogo) {
            logoImg.src = savedCustomLogo;
        } else {
            logoImg.src = course === 'pnl' ? 'assets/img/CHAVE.png' : 'assets/img/ser-logo.png';
        }
        
        const isDefaultPnlLogo = logoImg.src.includes('CHAVE.png');
        logoImg.style.maxHeight = isDefaultPnlLogo ? '40px' : '35px';
    }
    
    let html = quillInstance.root.innerHTML;
    html = html
        .replace(/{nome}/g, '<strong>Kelly da Silva</strong>')
        .replace(/{data}/g, '<strong>24, 25 e 26 de fevereiro de 2026</strong>')
        .replace(/{local}/g, '<strong>Centro Mariápolis Arnold, São Leopoldo, RS</strong>');
        
    const previewContent = document.getElementById('letter-preview-content');
    if (previewContent) previewContent.innerHTML = html;
}

function loadTemplateToEditor(course) {
    if (!quillInstance) return;
    const templates = window.siteSettings && window.siteSettings['letter_templates'] || {};
    
    if (course === 'pnl') {
        quillInstance.root.innerHTML = templates.pnlTemplate || getDefaultPnlTemplate();
    } else {
        quillInstance.root.innerHTML = templates.serTemplate || getDefaultSerTemplate();
    }
    
    const savedCustomLogo = course === 'pnl' ? templates.pnlLogo : templates.serLogo;
    const btnRemove = document.getElementById('btn-remove-letter-logo');
    if (btnRemove) {
        btnRemove.style.display = savedCustomLogo ? 'inline-flex' : 'none';
    }
    
    updateLetterPreview();
}