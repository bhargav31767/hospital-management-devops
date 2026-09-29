// API Base URL - relative path allows Nginx reverse proxying to backend
const API_BASE = '/api';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  checkHealth();
  loadStats();
  loadPatients();
  loadDoctors();
  loadAppointments();

  // Poll status periodically
  setInterval(checkHealth, 15000);
});

// Switch Tabs
function switchTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach((btn) => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach((content) => content.classList.remove('active'));

  event.target.classList.add('active');
  const target = document.getElementById(`tab-${tabId}`);
  if (target) target.classList.add('active');
}

// Toggle Modal
function toggleModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.classList.toggle('active');

  if (modalId === 'appointmentModal' && modal.classList.contains('active')) {
    populateAppointmentDropdowns();
  }
}

// System Health
async function checkHealth() {
  const indicator = document.getElementById('statusIndicator');
  const statusText = document.getElementById('statusText');

  try {
    const res = await fetch('/health');
    if (res.ok) {
      indicator.className = 'status-indicator online';
      statusText.innerText = 'All Services Healthy (DB Connected)';
    } else {
      indicator.className = 'status-indicator offline';
      statusText.innerText = 'Service Degraded';
    }
  } catch (err) {
    indicator.className = 'status-indicator offline';
    statusText.innerText = 'Backend Unreachable';
  }
}

// Fetch Metrics
async function loadStats() {
  try {
    const res = await fetch(`${API_BASE}/stats`);
    if (!res.ok) return;
    const data = await res.json();
    document.getElementById('countPatients').innerText = data.patients || 0;
    document.getElementById('countDoctors').innerText = data.doctors || 0;
    document.getElementById('countAppointments').innerText = data.appointments || 0;
  } catch (err) {
    console.error('Failed to load stats:', err);
  }
}

// Fetch Patients
async function loadPatients() {
  const tbody = document.getElementById('patientTableBody');
  try {
    const res = await fetch(`${API_BASE}/patients`);
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center">No patients registered.</td></tr>';
      return;
    }
    tbody.innerHTML = data
      .map(
        (p) => `
      <tr>
        <td>#${p.id}</td>
        <td><strong>${escapeHtml(p.name)}</strong></td>
        <td>${p.age}</td>
        <td>${escapeHtml(p.gender)}</td>
        <td>${escapeHtml(p.diagnosis)}</td>
        <td>${new Date(p.created_at).toLocaleDateString()}</td>
      </tr>
    `
      )
      .join('');
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">Failed to load patients.</td></tr>';
  }
}

// Handle Patient Submit
async function handlePatientSubmit(e) {
  e.preventDefault();
  const payload = {
    name: document.getElementById('pName').value,
    age: document.getElementById('pAge').value,
    gender: document.getElementById('pGender').value,
    diagnosis: document.getElementById('pDiagnosis').value,
  };

  try {
    const res = await fetch(`${API_BASE}/patients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      document.getElementById('addPatientForm').reset();
      toggleModal('patientModal');
      loadPatients();
      loadStats();
    }
  } catch (err) {
    alert('Error saving patient: ' + err.message);
  }
}

// Fetch Doctors
async function loadDoctors() {
  const tbody = document.getElementById('doctorTableBody');
  try {
    const res = await fetch(`${API_BASE}/doctors`);
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="text-center">No doctors registered.</td></tr>';
      return;
    }
    tbody.innerHTML = data
      .map(
        (d) => `
      <tr>
        <td>#${d.id}</td>
        <td><strong>${escapeHtml(d.name)}</strong></td>
        <td><span class="badge badge-scheduled">${escapeHtml(d.specialization)}</span></td>
        <td>${escapeHtml(d.email)}</td>
      </tr>
    `
      )
      .join('');
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center">Failed to load doctors.</td></tr>';
  }
}

// Handle Doctor Submit
async function handleDoctorSubmit(e) {
  e.preventDefault();
  const payload = {
    name: document.getElementById('dName').value,
    specialization: document.getElementById('dSpecialization').value,
    email: document.getElementById('dEmail').value,
  };

  try {
    const res = await fetch(`${API_BASE}/doctors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      document.getElementById('addDoctorForm').reset();
      toggleModal('doctorModal');
      loadDoctors();
      loadStats();
    }
  } catch (err) {
    alert('Error saving doctor: ' + err.message);
  }
}

// Fetch Appointments
async function loadAppointments() {
  const tbody = document.getElementById('appointmentTableBody');
  try {
    const res = await fetch(`${API_BASE}/appointments`);
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center">No appointments scheduled.</td></tr>';
      return;
    }
    tbody.innerHTML = data
      .map(
        (a) => `
      <tr>
        <td>#${a.id}</td>
        <td><strong>${escapeHtml(a.patient_name)}</strong></td>
        <td>${escapeHtml(a.doctor_name)}</td>
        <td>${escapeHtml(a.specialization)}</td>
        <td>${a.appointment_date}</td>
        <td><span class="badge badge-${(a.status || '').toLowerCase()}">${escapeHtml(a.status)}</span></td>
      </tr>
    `
      )
      .join('');
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">Failed to load appointments.</td></tr>';
  }
}

// Populate appointment selects
async function populateAppointmentDropdowns() {
  const pSelect = document.getElementById('aPatientSelect');
  const dSelect = document.getElementById('aDoctorSelect');

  try {
    const [pRes, dRes] = await Promise.all([
      fetch(`${API_BASE}/patients`),
      fetch(`${API_BASE}/doctors`),
    ]);
    const patients = await pRes.json();
    const doctors = await dRes.json();

    pSelect.innerHTML = patients.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
    dSelect.innerHTML = doctors.map((d) => `<option value="${d.id}">${escapeHtml(d.name)} (${escapeHtml(d.specialization)})</option>`).join('');
  } catch (err) {
    console.error('Error populating dropdowns:', err);
  }
}

// Handle Appointment Submit
async function handleAppointmentSubmit(e) {
  e.preventDefault();
  const payload = {
    patient_id: document.getElementById('aPatientSelect').value,
    doctor_id: document.getElementById('aDoctorSelect').value,
    appointment_date: document.getElementById('aDate').value,
    status: 'Scheduled',
  };

  try {
    const res = await fetch(`${API_BASE}/appointments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      document.getElementById('addAppointmentForm').reset();
      toggleModal('appointmentModal');
      loadAppointments();
      loadStats();
    }
  } catch (err) {
    alert('Error scheduling appointment: ' + err.message);
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
