// Simple auth/session management for Elderly Care
// Helper de rutas para soportar carga desde raíz o /pages
function inPagesDir() {
  try {
    return (window.location.pathname || '').toLowerCase().includes('/pages/');
  } catch { return true; }
}
function routeTo(file) {
  return inPagesDir() ? file : `pages/${file}`;
}
// Mock users con datos adicionales
const USERS = {
  carlos: { id: 'carlos', name: 'Carlos', role: 'paciente', age: 70, condition: 'Diabetes', conditionFull: 'Diabetes tipo 2', relationToCaregiver: 'papá' },
  andres: { id: 'andres', name: 'Andrés', role: 'cuidador', age: 30, patientId: 'carlos', relation: 'hijo' }
};

function login(userId) {
  const user = USERS[userId];
  if (!user) {
    alert('Usuario no válido');
    return;
  }
  const session = {
    userId: user.id,
    name: user.name,
    role: user.role,
    patientId: user.role === 'cuidador' ? user.patientId : user.id
  };
  localStorage.setItem('session', JSON.stringify(session));
  // Entrar a la app
  window.location.href = routeTo('home.html');
}

function logout() {
  localStorage.removeItem('session');
  window.location.href = routeTo('login.html');
}

function getSession() {
  try {
    const raw = localStorage.getItem('session');
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function requireAuth() {
  const session = getSession();
  if (!session) {
    window.location.href = routeTo('login.html');
    return;
  }
  applyRoleUI(session);
  startNotifications(session);
}

function getPatientInfo(session) {
  const sid = session || getSession();
  const pid = sid?.patientId || 'carlos';
  return USERS[pid];
}

// Minimal role-aware UI updates
function applyRoleUI(session) {
  // Si pasan un objeto sin datos de sesión válidos, usa getSession()
  const hasValidSession = session && (session.userId || session.role || session.patientId);
  const s = hasValidSession ? session : getSession();
  // Saludo dinámico si existe el contenedor
  const saludo = document.getElementById('saludo-usuario');
  if (saludo && s?.name) {
    saludo.textContent = `Hola, ${s.name}`;
  }
  const tituloSalud = document.getElementById('titulo-salud');
  if (tituloSalud) {
    tituloSalud.textContent = s?.role === 'cuidador' ? 'Salud del paciente' : 'Tu salud';
  }

  // Sub-datos dinámicos en header
  const patient = getPatientInfo(s);
  const subEdadRol = document.getElementById('sub-edad-rol');
  const subCondicion = document.getElementById('sub-condicion');
  const subParentesco = document.getElementById('sub-parentesco');
  if (subEdadRol) {
    if (s?.role === 'cuidador') {
      // Mostrar datos del cuidador
      const caregiverAge = USERS[s.userId]?.age ?? '';
      subEdadRol.textContent = `${caregiverAge} años • Cuidador`;
    } else {
      subEdadRol.textContent = `${patient?.age ?? ''} años • Paciente`;
    }
  }
  if (subCondicion) {
    subCondicion.textContent = patient?.conditionFull || patient?.condition || '';
  }
  if (subParentesco) {
    if (s?.role === 'cuidador') {
      // Mostrar el paciente que cuida y su relación hacia el cuidador
      const relToCaregiver = patient?.relationToCaregiver || 'paciente';
      subParentesco.textContent = `Paciente: ${patient?.name || ''} (${relToCaregiver})`;
    } else {
      // Para el paciente, muestra su cuidador si existe
      const caregiver = Object.values(USERS).find(u => u.role === 'cuidador' && u.patientId === patient?.id);
      if (caregiver) {
        subParentesco.textContent = `Cuidador: ${caregiver.name} (${caregiver.relation || 'cuidador'})`;
      }
    }
  }

  // Mostrar banner de contexto si es cuidador
  if (s?.role === 'cuidador') {
    const bannerText = `Cuidando a ${patient?.name || 'Paciente'}${patient?.condition ? ' — ' + patient.condition : ''}`;
    let banner = document.getElementById('banner-contexto');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'banner-contexto';
      banner.className = 'px-4 py-2 bg-icon-bg-light dark:bg-icon-bg-dark text-text-light-secondary dark:text-text-dark-secondary text-sm';
      const header = document.querySelector('header') || document.querySelector('.sticky.top-0');
      if (header && header.parentElement) {
        header.parentElement.insertBefore(banner, header.nextSibling);
      } else {
        document.body.insertBefore(banner, document.body.firstChild);
      }
    }
    banner.textContent = bannerText;

    // Panel de acciones de cuidador
    let acciones = document.getElementById('acciones-cuidador');
    if (!acciones) {
      acciones = document.createElement('div');
      acciones.id = 'acciones-cuidador';
      acciones.className = 'mx-4 my-3 p-3 rounded-xl bg-card-light dark:bg-card-dark shadow-[0_4px_12px_rgba(0,0,0,0.05)]';
      acciones.innerHTML = `
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p class="text-sm text-text-light-secondary dark:text-text-dark-secondary">Acciones de cuidador</p>
          <div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button id="btn-recordatorio-med" class="w-full sm:w-auto px-3 py-2 rounded-lg bg-primary text-white text-sm font-medium">Enviar recordatorio</button>
            <button id="btn-solicitud-med" class="w-full sm:w-auto px-3 py-2 rounded-lg border border-black/5 dark:border-white/5 text-sm font-medium">Control de medicamento</button>
          </div>
        </div>
      `;
      banner.parentElement.insertBefore(acciones, banner.nextSibling);
      const btnRec = acciones.querySelector('#btn-recordatorio-med');
      const btnCtrl = acciones.querySelector('#btn-solicitud-med');
      btnRec?.addEventListener('click', () => sendMedicationReminder());
      btnCtrl?.addEventListener('click', () => {
        window.location.href = routeTo('control_medicamentos.html');
      });
    }
  }

  // Mostrar solicitud del paciente (recordatorio importante) si existe
  const req = localStorage.getItem('patient_request');
  const recordatorio = document.getElementById('recordatorio');
  if (recordatorio && req && s?.role === 'cuidador') {
    const contenido = recordatorio.querySelector('p');
    if (contenido) {
      contenido.innerHTML = `<strong>Solicitud del paciente:</strong> ${req}`;
    }
  }
}

// Notificaciones y eventos entre paciente/cuidador
const EVENTS_KEY = 'events';

function getEvents() {
  try {
    const raw = localStorage.getItem(EVENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function setEvents(evts) {
  localStorage.setItem(EVENTS_KEY, JSON.stringify(evts));
}

function publishEvent(evt) {
  const events = getEvents();
  events.push({ id: Date.now(), ...evt });
  setEvents(events);
}

function startNotifications(session) {
  const s = session || getSession();
  function notifyFor(evt) {
    const msgMap = {
      medication_reminder: 'Recordatorio enviado al paciente para tomar medicamento',
      medication_missed: 'Carlos no ha tomado su medicamento',
      emergency: '⚠️ Emergencia activada por el paciente',
      patient_request: 'Nueva solicitud del paciente',
      restock_request: 'Se solicitó reposición de medicamentos'
    };
    const msg = msgMap[evt.type] || 'Nuevo evento';
    if (typeof window.mostrarNotificacion === 'function') {
      window.mostrarNotificacion(msg, evt.type === 'emergency' ? 'error' : 'info', 3000);
    } else {
      console.log('[Notificación]', msg);
    }
  }
  // Notificar eventos pertinentes al cuidador
  window.addEventListener('storage', (e) => {
    if (e.key === EVENTS_KEY && s?.role === 'cuidador') {
      const events = getEvents();
      const last = events[events.length - 1];
      if (last && last.to === s.patientId) notifyFor(last);
    }
  });
}

// Helpers de flujo
function sendMedicationReminder() {
  const s = getSession();
  if (!s) return;
  publishEvent({ type: 'medication_reminder', from: s.userId, to: s.patientId });
}

function markMedicationTaken(nombreMed) {
  const s = getSession();
  if (!s) return;
  publishEvent({ type: 'medication_taken', from: s.userId, to: s.patientId || s.userId, payload: { med: nombreMed } });
  localStorage.setItem('medication_status', JSON.stringify({ lastTaken: Date.now(), med: nombreMed }));
}

function triggerEmergency() {
  const s = getSession();
  if (s?.role === 'paciente') publishEvent({ type: 'emergency', from: s.userId, to: s.userId });
}

function patientRequest(message) {
  localStorage.setItem('patient_request', message);
  const s = getSession();
  publishEvent({ type: 'patient_request', from: s?.userId, to: s?.patientId || s?.userId, payload: { message } });
}

// Expose helpers globally
window.Auth = { login, logout, getSession, requireAuth, applyRoleUI, getPatientInfo, startNotifications, sendMedicationReminder, markMedicationTaken, triggerEmergency, patientRequest };