const API_URL = 'http://localhost:5000/api';
const socket = io('http://localhost:5000');

let state = {
    token: localStorage.getItem('token'),
    user: localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')) : null,
    patients: [],
    doctors: [],
    selectedId: null,
    view: 'dashboard',
    charts: { bpm: null, spo2: null },
    chartData: { bpm: Array(30).fill(null), spo2: Array(30).fill(null) }, 
    isDark: localStorage.getItem('theme') !== 'light'
};

const app = document.getElementById('app');

document.addEventListener('DOMContentLoaded', () => {
    applyTheme();
    if (state.token && state.user) {
        if(state.user.role === 'DOCTOR') renderDoctorLayout();
        else renderPatientLayout();
    } else {
        document.getElementById('auth-container').classList.remove('hidden');
    }
    bindAuthEvents();
});

// --- AUTH ---
function bindAuthEvents() {
    document.getElementById('go-to-signup').onclick = (e) => { e.preventDefault(); toggleAuth('signup'); };
    document.getElementById('go-to-login').onclick = (e) => { e.preventDefault(); toggleAuth('login'); };
    document.getElementById('signup-role').onchange = (e) => { document.getElementById('doc-fields').classList.toggle('hidden', e.target.value !== 'DOCTOR'); };
    document.getElementById('login-form').onsubmit = async (e) => { e.preventDefault(); await apiLogin(document.getElementById('email').value, document.getElementById('password').value); };
    document.getElementById('signup-form').onsubmit = async (e) => { e.preventDefault(); await apiSignup(); };
    const bookingForm = document.getElementById('booking-form-real');
    if(bookingForm) bookingForm.onsubmit = handleBookingSubmit;
    
    // PAYMENT TOGGLE
    const payMethod = document.getElementById('pay-method');
    if(payMethod) {
        payMethod.onchange = (e) => {
            const method = e.target.value;
            document.getElementById('pay-card-fields').classList.toggle('hidden', method !== 'Card');
            document.getElementById('pay-ehs-fields').classList.toggle('hidden', method !== 'EHS');
        };
    }
}

function toggleAuth(view) {
    document.getElementById('login-template').classList.toggle('hidden', view !== 'login');
    document.getElementById('signup-template').classList.toggle('hidden', view !== 'signup');
}

async function apiLogin(email, password) {
    try {
        const res = await fetch(`${API_URL}/login`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ email, password }) });
        const data = await res.json();
        if (res.ok) {
            state.token = data.token; state.user = data.user;
            localStorage.setItem('token', data.token); localStorage.setItem('user', JSON.stringify(data.user));
            if(state.user.role === 'DOCTOR') renderDoctorLayout(); else renderPatientLayout();
        } else alert(data.message);
    } catch(e) { alert('Server error'); }
}

async function apiSignup() {
    const role = document.getElementById('signup-role').value;
    const payload = {
        name: document.getElementById('signup-name').value,
        email: document.getElementById('signup-email').value,
        password: document.getElementById('signup-password').value,
        age: document.getElementById('signup-age').value,
        gender: document.getElementById('signup-gender').value,
        role
    };
    if(role === 'DOCTOR') {
        payload.specialization = document.getElementById('signup-spec').value;
        payload.hospital = document.getElementById('signup-hosp').value;
    }
    const res = await fetch(`${API_URL}/signup`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
    if(res.ok) { alert('Success! Login now.'); toggleAuth('login'); } else alert('Error creating account');
}

// --- BOOKING ---
async function handleBookingSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-pay-confirm');
    btn.innerHTML = `<span>Processing...</span>`; btn.disabled = true;

    const method = document.getElementById('pay-method').value;
    let details = 'N/A';
    if(method === 'Card') {
        const card = document.getElementById('pay-card').value;
        if(card.length !== 16) { alert("Invalid Card"); btn.innerHTML = "Confirm"; btn.disabled = false; return; }
        details = card.slice(-4);
    }
    if(method === 'EHS') {
        const pol = document.getElementById('pay-policy').value;
        if(pol.length < 3) { alert("Invalid Policy"); btn.innerHTML = "Confirm"; btn.disabled = false; return; }
        details = pol;
    }

    const payload = { 
        doctorId: document.getElementById('b-doctor').value, 
        doctorName: document.getElementById('b-doctor').options[document.getElementById('b-doctor').selectedIndex].text, 
        date: document.getElementById('b-date').value,
        payMethod: method,
        payDetails: details
    };

    try {
        const res = await fetch(`${API_URL}/appointments`, { method: 'POST', headers: { 'Authorization': `Bearer ${state.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if(res.ok) {
            document.getElementById('booking-modal').classList.add('hidden');
            document.getElementById('success-modal').classList.remove('hidden');
            if(state.view === 'appointments') loadAppointments();
            if(state.view === 'dashboard' && state.user.role === 'PATIENT') loadAppointmentsMini();
        } else alert("Booking Failed");
    } catch(e) { alert("Error"); }
    btn.innerHTML = "Confirm Booking"; btn.disabled = false;
}

// --- DEMO FEATURE: FORCE CRITICAL ---
window.triggerCritical = async () => {
    if(!state.patients[0]) return;
    const p = state.patients[0]; // Current Patient (Me)
    
    // Force a High Heart Rate call
    await fetch(`${API_URL}/vitals/${p._id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bpm: 155, spo2: 88, temp: 39.5 }) // CRITICAL VALUES
    });
    
    alert("⚠️ Critical Data Sent! \n1. Check Doctor Dashboard for Red Alert.\n2. Check Email for Notification.");
};

// ... (Layouts, Logic) ...

function renderDoctorLayout() {
    app.innerHTML = `
    <header class="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex justify-between items-center sticky top-0 z-50 transition-colors">
        <div class="flex items-center gap-3"><div class="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div><h1 class="font-bold text-xl text-slate-900 dark:text-white">PulseGuard</h1></div>
        <div class="flex items-center gap-4"><button onclick="toggleTheme()" class="text-xl">${state.isDark ? '☀️' : '🌙'}</button><div class="text-right"><p class="text-sm font-bold text-slate-900 dark:text-white">${state.user.name}</p><p class="text-xs text-slate-500">DOCTOR</p></div><button onclick="logout()" class="text-red-500 border border-red-200 dark:border-red-900/30 px-3 py-1 rounded text-sm hover:bg-red-50 dark:hover:bg-red-900/10">Logout</button></div>
    </header>
    <main class="flex-1 flex overflow-hidden bg-slate-50 dark:bg-slate-900 transition-colors">
        <aside class="w-72 bg-white/50 dark:bg-slate-800/30 border-r border-slate-200 dark:border-slate-700 flex flex-col backdrop-blur-sm transition-colors">
            <div class="p-4 border-b border-slate-200 dark:border-slate-700/50"><h3 class="font-bold text-slate-900 dark:text-white">Active Patients</h3><p class="text-xs text-slate-500 mt-1" id="active-count">Loading...</p></div>
            <div id="patient-list" class="flex-1 overflow-y-auto p-2 space-y-1"></div>
        </aside>
        <section class="flex-1 p-6 overflow-y-auto relative flex flex-col">
            <div id="no-patient-view" class="flex flex-col items-center justify-center flex-1 text-slate-400"><div class="p-6 bg-slate-200 dark:bg-slate-800 rounded-full mb-4 opacity-50"><svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg></div><p class="text-lg font-medium text-slate-600 dark:text-slate-300">Select a patient from the list to view vitals.</p></div>
            <div id="charts-view" class="hidden flex-col gap-6 max-w-5xl mx-auto w-full">
                <div class="flex justify-between items-center bg-white dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm"><div><h2 class="text-2xl font-bold text-slate-900 dark:text-white" id="p-name">--</h2><p class="text-slate-500 dark:text-slate-400 text-sm" id="p-detail">--</p></div><button onclick="showAI()" class="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-5 py-2.5 rounded-lg text-sm font-bold shadow-lg hover:shadow-purple-500/20 hover:scale-105 transition-all"><span>✨</span> AI Analysis</button></div>
                <div class="grid gap-6"><div class="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm"><div class="flex justify-between items-center mb-4"><h3 class="text-slate-600 dark:text-slate-300 font-medium">Heart Rate</h3><span class="text-4xl font-bold text-blue-600 dark:text-blue-500"><span id="val-bpm">--</span> <span class="text-lg text-slate-400 font-normal">BPM</span></span></div><div class="h-64 w-full"><canvas id="chart-bpm"></canvas></div></div><div class="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm"><div class="flex justify-between items-center mb-4"><h3 class="text-slate-600 dark:text-slate-300 font-medium">SpO2 Level</h3><span class="text-4xl font-bold text-teal-500 dark:text-teal-400"><span id="val-spo2">--</span> <span class="text-lg text-slate-400 font-normal">%</span></span></div><div class="h-64 w-full"><canvas id="chart-spo2"></canvas></div></div></div>
            </div>
        </section>
        <aside class="w-80 bg-white/50 dark:bg-slate-800/30 border-l border-slate-200 dark:border-slate-700 flex flex-col backdrop-blur-sm transition-colors">
            <div class="p-4 border-b border-slate-200 dark:border-slate-700/50"><h3 class="font-bold text-slate-900 dark:text-white">Alerts</h3></div>
            <div id="alerts-list" class="flex-1 overflow-y-auto p-4 space-y-2 h-1/2 border-b border-slate-200 dark:border-slate-700/50"><p class="text-xs text-slate-500 text-center">No active alerts</p></div>
            <div class="p-4 border-b border-slate-200 dark:border-slate-700/50"><h3 class="font-bold text-slate-900 dark:text-white">Upcoming</h3></div>
            <div id="doc-appt-list" class="flex-1 overflow-y-auto p-4 space-y-2 h-1/2"><p class="text-xs text-slate-500 text-center">Loading...</p></div>
        </aside>
    </main>`;
    fetchPatients(); loadDoctorAppointments();
}

function renderPatientLayout() {
    app.innerHTML = `
    <header class="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex justify-between items-center sticky top-0 z-50">
        <div class="flex items-center gap-3"><div class="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div><h1 class="font-bold text-xl text-slate-900 dark:text-white">PulseGuard</h1></div>
        <div class="flex items-center gap-4">
            <!-- DEMO BUTTON ADDED HERE -->
            <button onclick="triggerCritical()" class="text-xs bg-red-600 hover:bg-red-500 text-white px-3 py-1 rounded font-bold animate-pulse">⚠️ Simulate Event</button>
            
            <button onclick="toggleTheme()" class="text-slate-500 hover:text-slate-800 dark:hover:text-white text-xl">${state.isDark ? '☀️' : '🌙'}</button>
            <div class="text-right"><p class="text-sm font-bold text-slate-900 dark:text-white">${state.user.name}</p><p class="text-xs text-slate-500">PATIENT</p></div>
            <button onclick="logout()" class="text-red-500 border border-red-200 dark:border-red-900/30 px-3 py-1 rounded text-sm hover:bg-red-50 dark:hover:bg-red-900/10">Logout</button>
        </div>
    </header>
    <div class="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-0 flex gap-8">
        <button onclick="setPatientView('dashboard')" id="nav-dash" class="py-4 text-sm font-medium border-b-2 border-blue-500 text-blue-500">My Health</button>
        <button onclick="setPatientView('doctors')" id="nav-docs" class="py-4 text-sm font-medium border-b-2 border-transparent text-slate-500 hover:text-slate-300">Find Doctors</button>
        <button onclick="setPatientView('appointments')" id="nav-appts" class="py-4 text-sm font-medium border-b-2 border-transparent text-slate-500 hover:text-slate-300">Appointments</button>
    </div>
    <main id="patient-content" class="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900 p-6"></main>`;
    setPatientView('dashboard');
}

// ... (Rest of logic: setPatientView, fetchPatients, etc. remains the same as previous) ...
window.setPatientView = async (view) => {
    state.view = view;
    ['dash', 'docs', 'appts'].forEach(v => { const el = document.getElementById(`nav-${v}`); if(el) el.className = `py-4 text-sm font-medium border-b-2 transition-colors ${view === (v === 'dash' ? 'dashboard' : v === 'docs' ? 'doctors' : 'appointments') ? 'border-blue-500 text-blue-500' : 'border-transparent text-slate-500 hover:text-slate-300'}`; });
    const container = document.getElementById('patient-content');
    if (view === 'dashboard') {
        await fetchPatients();
        const p = state.patients[0];
        if(!p) { container.innerHTML = 'Loading...'; return; }
        state.selectedId = p._id; 
        container.innerHTML = `<div class="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6"><div class="lg:col-span-2 space-y-6"><div class="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-8 text-white shadow-lg"><h2 class="text-3xl font-bold mb-2">Welcome back, ${state.user.name}</h2><p class="text-blue-100">Your vitals are being monitored.</p></div><div class="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm"><div class="flex justify-between mb-4"><h3 class="text-slate-500 dark:text-slate-400 font-medium">Heart Rate</h3><span class="text-2xl font-bold text-blue-500" id="val-bpm">--</span></div><div class="h-64 w-full"><canvas id="chart-bpm"></canvas></div></div><div class="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm"><div class="flex justify-between mb-4"><h3 class="text-slate-500 dark:text-slate-400 font-medium">SpO2</h3><span class="text-2xl font-bold text-teal-400" id="val-spo2">--</span></div><div class="h-64 w-full"><canvas id="chart-spo2"></canvas></div></div></div><div class="lg:col-span-1 space-y-6"><div class="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 p-6"><div class="flex justify-between items-center mb-4"><h3 class="font-bold text-slate-900 dark:text-white">Appointments</h3><button onclick="setPatientView('doctors')" class="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded">+ Book New</button></div><div id="appt-list-mini" class="space-y-3"><p class="text-sm text-slate-500">Loading...</p></div></div></div></div>`;
        initCharts(); loadAppointmentsMini();
    }
    if (view === 'doctors') {
        const res = await fetch(`${API_URL}/doctors`, { headers: { 'Authorization': `Bearer ${state.token}` } });
        const doctors = await res.json();
        container.innerHTML = `<div class="max-w-5xl mx-auto"><h2 class="text-2xl font-bold text-slate-900 dark:text-white mb-6">Find Nearby Doctors</h2><div class="grid grid-cols-1 md:grid-cols-2 gap-6">${doctors.map(doc => `<div class="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 p-6 flex flex-col md:flex-row gap-6 hover:border-blue-500 transition-colors group shadow-sm"><div class="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-xl font-bold text-slate-500 dark:text-slate-400 group-hover:text-white group-hover:bg-blue-600 transition-colors">${doc.name.charAt(0).toUpperCase()}</div><div class="flex-1"><h3 class="text-lg font-bold text-slate-900 dark:text-white">${doc.name}</h3><p class="text-blue-500 text-sm font-medium mb-1">${doc.specialization}</p><p class="text-slate-500 dark:text-slate-400 text-sm mb-4">🏥 ${doc.hospital}</p><button onclick="window.openBookingModal('${doc._id}', '${doc.name}')" class="w-full bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg text-sm font-bold transition">Book Appointment</button></div></div>`).join('')}</div></div>`;
    }
    if (view === 'appointments') {
        container.innerHTML = `<div class="max-w-4xl mx-auto"><h2 class="text-2xl font-bold text-slate-900 dark:text-white mb-6">My Appointments</h2><div id="appointment-list" class="space-y-3"></div><p id="no-appt-msg" class="text-slate-500 text-center mt-4 hidden">No upcoming appointments.</p></div>`;
        loadAppointments();
    }
};

async function fetchPatients() { const res = await fetch(`${API_URL}/patients`, { headers: { 'Authorization': `Bearer ${state.token}` } }); state.patients = await res.json(); if(state.user.role === 'DOCTOR') { renderDoctorList(); document.getElementById('active-count').innerText = `${state.patients.length} Monitored`; } startDataStream(); }
function renderDoctorList() { const list = document.getElementById('patient-list'); list.innerHTML = state.patients.map(p => `<div onclick="selectPatient('${p._id}')" id="row-${p._id}" class="p-3 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent transition flex justify-between items-center group"><div><p class="font-bold text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white">${p.name}</p><p class="text-xs text-slate-500">${p.gender}, ${p.age}</p></div><div class="text-right"><p class="text-sm font-mono text-blue-500 font-bold" id="mini-bpm-${p._id}">--</p><p class="text-[10px] text-slate-600">BPM</p></div></div>`).join(''); }
async function loadAppointments() { const res = await fetch(`${API_URL}/appointments`, { headers: { 'Authorization': `Bearer ${state.token}` } }); const apps = await res.json(); const list = document.getElementById('appointment-list'); list.innerHTML = ''; if(apps.length > 0) { document.getElementById('no-appt-msg')?.classList.add('hidden'); apps.forEach(a => { const displayName = state.user.role === 'DOCTOR' ? `Patient: ${a.patientName}` : `Dr. ${a.doctorName}`; const niceDate = new Date(a.date).toLocaleString(); let statusColor = a.status === 'Completed' ? "text-green-600 bg-green-100 dark:bg-green-900/30" : "text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30"; let payBadge = a.payment.status === 'Paid' ? `<span class="text-green-500 ml-2 text-xs">● Paid</span>` : `<span class="text-orange-500 ml-2 text-xs">● ${a.payment.status}</span>`; list.innerHTML += `<div class="bg-white dark:bg-slate-800/60 p-4 rounded-lg border border-slate-200 dark:border-slate-700 flex justify-between items-center transition-colors"><div><div class="font-bold text-slate-900 dark:text-white">${displayName}</div><div class="text-sm text-slate-500 dark:text-slate-400">${niceDate}</div><div class="text-xs text-slate-400 mt-1">${a.payment.method} ${payBadge}</div></div><div class="flex items-center gap-2"><span class="${statusColor} px-2 py-1 rounded text-xs border border-transparent font-medium">${a.status}</span><button onclick="window.cancelAppt('${a._id}')" class="text-slate-400 hover:text-red-500 transition-colors" title="Cancel">✕</button></div></div>`; }); } else { document.getElementById('no-appt-msg')?.classList.remove('hidden'); } }
async function loadDoctorAppointments() { const res = await fetch(`${API_URL}/appointments`, { headers: { 'Authorization': `Bearer ${state.token}` } }); const apps = await res.json(); const list = document.getElementById('doc-appt-list'); if(apps.length === 0) list.innerHTML = '<p class="text-xs text-slate-500 text-center">No upcoming appointments.</p>'; else list.innerHTML = apps.map(a => `<div class="bg-slate-100 dark:bg-slate-800 p-3 rounded border border-slate-200 dark:border-slate-700"><p class="font-bold text-sm text-slate-900 dark:text-white">${a.patientName}</p><p class="text-xs text-slate-500">${new Date(a.date).toLocaleDateString()}</p></div>`).join(''); }
window.selectPatient = (id) => { state.selectedId = id; const p = state.patients.find(x => x._id === id); if(document.getElementById('no-patient-view')) { document.getElementById('no-patient-view').classList.add('hidden'); document.getElementById('charts-view').classList.remove('hidden'); document.getElementById('charts-view').classList.add('flex'); } document.getElementById('p-name').innerText = p.name; document.getElementById('p-detail').innerText = `ID: #${p._id.substr(-6).toUpperCase()} • ${p.gender}, ${p.age} yrs`; document.querySelectorAll('[id^="row-"]').forEach(el => el.classList.remove('bg-blue-50', 'dark:bg-blue-900/20', 'border-blue-500')); const row = document.getElementById(`row-${id}`); if(row) row.classList.add('bg-blue-50', 'dark:bg-blue-900/20', 'border-blue-500'); state.chartData.bpm = Array(30).fill(null); state.chartData.spo2 = Array(30).fill(null); initCharts(); };
window.openBookingModal = (docId, docName) => { document.getElementById('booking-modal').classList.remove('hidden'); document.getElementById('b-doctor-id').value = docId; document.getElementById('b-doctor-name').value = docName; const select = document.getElementById('b-doctor'); select.innerHTML = `<option value="${docId}">${docName}</option>`; };
window.cancelAppt = async (id) => { if(!confirm('Cancel?')) return; await fetch(`${API_URL}/appointments/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${state.token}` } }); };
async function loadAppointmentsMini() { const res = await fetch(`${API_URL}/appointments`, { headers: { 'Authorization': `Bearer ${state.token}` } }); const apps = await res.json(); const list = document.getElementById('appt-list-mini'); if(apps.length === 0) list.innerHTML = '<p class="text-sm text-slate-500">No upcoming appointments.</p>'; else list.innerHTML = apps.map(a => `<div class="bg-slate-50 dark:bg-slate-900 p-3 rounded border border-slate-200 dark:border-slate-700"><p class="font-bold text-sm dark:text-white">${a.doctorName}</p><p class="text-xs text-slate-500">${new Date(a.date).toLocaleDateString()}</p></div>`).join(''); }
window.showAI = () => { document.getElementById('ai-modal').classList.remove('hidden'); const bpm = document.getElementById('val-bpm').innerText; setTimeout(() => { document.getElementById('ai-content').innerHTML = `<p class="mb-2"><strong class="text-green-500">Analysis Complete</strong></p><p class="text-slate-600 dark:text-slate-300">Based on current vitals (HR: ${bpm} BPM), the patient appears <strong>stable</strong>.</p><p class="mt-2 text-xs text-slate-400">Recommendation: Continue monitoring.</p>`; }, 1500); };
function initCharts() { const common = { responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { display: false } }, scales: { x: { display: false }, y: { grid: { color: state.isDark ? '#334155' : '#e2e8f0', tickLength: 0 }, border: { display: false } } }, elements: { point: { radius: 0 }, line: { tension: 0.4 } } }; const ctxBpm = document.getElementById('chart-bpm'); if(ctxBpm) { const grad = ctxBpm.getContext('2d').createLinearGradient(0, 0, 0, 400); grad.addColorStop(0, 'rgba(59, 130, 246, 0.5)'); grad.addColorStop(1, 'rgba(59, 130, 246, 0)'); state.charts.bpm = new Chart(ctxBpm, { type: 'line', data: { labels: Array(30).fill(''), datasets: [{ data: state.chartData.bpm, borderColor: '#3b82f6', backgroundColor: grad, borderWidth: 3, fill: true }] }, options: { ...common, scales: { ...common.scales, y: { min: 40, max: 180, grid: common.scales.y.grid } } } }); } const ctxSpo2 = document.getElementById('chart-spo2'); if(ctxSpo2) { const grad = ctxSpo2.getContext('2d').createLinearGradient(0, 0, 0, 400); grad.addColorStop(0, 'rgba(45, 212, 191, 0.5)'); grad.addColorStop(1, 'rgba(45, 212, 191, 0)'); state.charts.spo2 = new Chart(ctxSpo2, { type: 'line', data: { labels: Array(30).fill(''), datasets: [{ data: state.chartData.spo2, borderColor: '#2dd4bf', backgroundColor: grad, borderWidth: 3, fill: true }] }, options: { ...common, scales: { ...common.scales, y: { min: 85, max: 100, grid: common.scales.y.grid } } } }); } }
socket.on('vital_update', (data) => { const mini = document.getElementById(`mini-bpm-${data.id}`); if(mini) mini.innerText = data.bpm.toFixed(0); if (state.selectedId === data.id) { if(document.getElementById('val-bpm')) document.getElementById('val-bpm').innerText = data.bpm.toFixed(0); if(document.getElementById('val-spo2')) document.getElementById('val-spo2').innerText = data.spo2.toFixed(0) + '%'; updateChart(state.charts.bpm, state.chartData.bpm, data.bpm); updateChart(state.charts.spo2, state.chartData.spo2, data.spo2); } });
socket.on('alert_new', (alert) => { const list = document.getElementById('alerts-list'); if(list) { if(list.innerText.includes('No active')) list.innerHTML = ''; const div = document.createElement('div'); div.className = "bg-red-500/10 border-l-4 border-red-500 p-3 rounded text-sm mb-2 animate-pulse"; div.innerHTML = `<strong class="text-red-500">CRITICAL</strong><p class="text-slate-500 dark:text-slate-300">${alert.message}</p><p class="text-xs text-slate-400 mt-1">${alert.patientName || 'Patient'}</p>`; list.prepend(div); } });
socket.on('appt_update', () => { if(state.view === 'appointments' || state.user.role === 'DOCTOR') { if(state.user.role === 'DOCTOR') loadDoctorAppointments(); else loadAppointments(); } if(state.view === 'dashboard' && state.user.role === 'PATIENT') loadAppointmentsMini(); });
function updateChart(c, d, v) { if(!c) return; d.push(v); d.shift(); c.data.datasets[0].data = d; c.update('none'); }
function startDataStream() { if (window.simInterval) clearInterval(window.simInterval); window.simInterval = setInterval(() => { state.patients.forEach(p => { let old = p.currentVitals?.bpm || 70; let newV = old + (Math.random()-0.5)*5; if(newV>160) newV=158; if(newV<50) newV=55; fetch(`${API_URL}/vitals/${p._id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bpm: newV, spo2: 96+(Math.random()*3), temp: 36.6 }) }).catch(()=>{}); }); }, 1000); }
window.toggleTheme = () => { state.isDark = !state.isDark; localStorage.setItem('theme', state.isDark ? 'dark' : 'light'); applyTheme(); };
function applyTheme() { const html = document.documentElement; if (state.isDark) html.classList.add('dark'); else html.classList.remove('dark'); if(state.charts.bpm) { updateChartTheme(state.charts.bpm); updateChartTheme(state.charts.spo2); } }
function updateChartTheme(chart) { const color = state.isDark ? '#334155' : '#e2e8f0'; chart.options.scales.y.grid.color = color; chart.update('none'); }
window.logout = () => { localStorage.clear(); window.location.reload(); };