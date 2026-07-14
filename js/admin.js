/**
 * AeroCheck Simulator — Admin Module
 * Manages flights, passenger manifests, and agent accounts.
 */

/* ── Toast helper ──────────────────────────────────────────────────────────── */
function toast(msg, type = 'info') {
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const c = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `<span class="toast-icon">${icons[type]||'ℹ️'}</span><span class="toast-msg">${msg}</span>`;
  c.appendChild(el);
  el.onclick = () => removeToast(el);
  setTimeout(() => removeToast(el), 4000);
}
function removeToast(el) {
  if (!el.parentNode) return;
  el.classList.add('removing');
  setTimeout(() => el.remove(), 300);
}

/* ── Global Loading Indicator ──────────────────────────────────────────────── */
function showLoading(containerId) {
  const container = document.getElementById(containerId);
  if (container) {
    container.innerHTML = `<div class="empty-state"><div class="spinner"></div><p style="margin-top:1rem;">Memuat data dari server...</p></div>`;
  }
}

/* ── Navigation ────────────────────────────────────────────────────────────── */
async function navigate(page) {
  document.querySelectorAll('.admin-page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`page-${page}`).classList.add('active');
  document.getElementById(`nav-${page}`).classList.add('active');

  const titles = {
    dashboard:  ['📊 DASHBOARD',       'Ringkasan aktivitas hari ini'],
    flights:    ['✈ FLIGHT MASTER',    'Kelola jadwal penerbangan aktif'],
    manifest:   ['📋 PASSENGER MANIFEST','Kelola daftar penumpang per penerbangan'],
    agents:     ['👥 AGENT ACCOUNTS',  'Kelola akun agent check-in siswa'],
  };
  document.getElementById('page-title').textContent = titles[page][0];
  document.getElementById('page-sub').textContent   = titles[page][1];

  if (page === 'dashboard')  await renderDashboard();
  if (page === 'flights')    await renderFlights();
  if (page === 'manifest')   await renderManifest();
  if (page === 'agents')     await renderAgents();
}

/* ── Dashboard ─────────────────────────────────────────────────────────────── */
async function renderDashboard() {
  showLoading('dashboard-flights');
  try {
    const flights   = await DB.getFlights();
    const passengers = await DB.getPassengers();
    const agents_all = await DB.getAgents();
    const agents    = agents_all.filter(a => a.role === 'agent');
    const checkedIn = passengers.filter(p => p.checkedIn);

    document.getElementById('stat-flights').textContent   = flights.length;
    document.getElementById('stat-pax').textContent       = passengers.length;
    document.getElementById('stat-checked').textContent   = checkedIn.length;
    document.getElementById('stat-agents').textContent    = agents.length;

    const container = document.getElementById('dashboard-flights');
    if (!flights.length) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">✈</div><p>Belum ada penerbangan. Buat di menu Flight Master.</p></div>`;
      return;
    }

    let html = '';
    for (const f of flights) {
      const paxForFlight = passengers.filter(p => p.flightId === f.id);
      const total = paxForFlight.length;
      const chkIn = paxForFlight.filter(p => p.checkedIn).length;
      const pct   = total ? Math.round(chkIn / total * 100) : 0;
      const statusClass = f.status.toLowerCase().replace(' ', '-');
      html += `
      <div class="flight-card" style="margin-bottom:0.75rem;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:1rem;">
          <div style="display:flex;align-items:center;gap:1.25rem;">
            <div>
              <div style="font-family:var(--font-mono);font-size:1.1rem;font-weight:700;">${f.flightNumber}</div>
              <div style="font-size:0.7rem;color:var(--text-muted);margin-top:0.1rem;">${f.aircraft} · ${f.gate}</div>
            </div>
            <div style="display:flex;align-items:center;gap:0.75rem;">
              <div style="text-align:center;">
                <div style="font-family:var(--font-mono);font-size:1.3rem;font-weight:700;">${f.origin}</div>
                <div style="font-size:0.65rem;color:var(--text-muted);">${f.originCity}</div>
              </div>
              <div style="display:flex;flex-direction:column;align-items:center;gap:2px;color:var(--text-muted);font-size:0.7rem;">
                <span>✈</span>
                <div style="width:50px;height:1px;background:linear-gradient(90deg,transparent,var(--cyan),transparent);"></div>
              </div>
              <div style="text-align:center;">
                <div style="font-family:var(--font-mono);font-size:1.3rem;font-weight:700;">${f.destination}</div>
                <div style="font-size:0.65rem;color:var(--text-muted);">${f.destinationCity}</div>
              </div>
            </div>
            <div>
              <div style="font-family:var(--font-mono);font-size:0.95rem;color:var(--cyan);">${formatTime(f.std)}</div>
              <div style="font-size:0.65rem;color:var(--text-muted);">STD</div>
            </div>
            <div class="status-badge status-${statusClass}">${f.status}</div>
          </div>
          <div style="text-align:right;min-width:120px;">
            <div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:0.35rem;">CHECK-IN PROGRESS</div>
            <div style="font-family:var(--font-mono);font-size:1rem;color:var(--cyan);margin-bottom:0.35rem;">${chkIn}/${total}</div>
            <div class="progress-bar-wrap"><div class="progress-bar" style="width:${pct}%"></div></div>
          </div>
        </div>
      </div>`;
    }
    container.innerHTML = html;
  } catch(err) {
    console.error(err);
    toast('Gagal memuat dashboard', 'error');
  }
}

/* ── Flights CRUD ──────────────────────────────────────────────────────────── */
async function renderFlights() {
  showLoading('flights-list');
  try {
    const flights = await DB.getFlights();
    const container = document.getElementById('flights-list');

    if (!flights.length) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">✈</div><p>Belum ada penerbangan. Klik "+ Tambah Penerbangan".</p></div>`;
      return;
    }
    
    let html = '';
    for (const f of flights) {
      const pax = await DB.getFlightPassengers(f.id);
      const total = pax.length;
      const chkIn = pax.filter(p => p.checkedIn).length;
      const statusClass = f.status.toLowerCase().replace(' ','');
      
      html += `
      <div class="flight-card">
        <div class="flight-card-header">
          <div class="flight-card-route">
            <div>
              <div class="flight-card-iata">${f.origin}</div>
              <div class="flight-card-city">${f.originCity}</div>
            </div>
            <div class="flight-arrow">
              <span style="font-size:0.85rem;">✈</span>
              <div class="arr-line"></div>
              <span style="font-size:0.65rem;">${f.flightNumber}</span>
            </div>
            <div>
              <div class="flight-card-iata">${f.destination}</div>
              <div class="flight-card-city">${f.destinationCity}</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:0.75rem;">
            <span class="status-badge status-${statusClass.replace(' ','-')}">${f.status}</span>
            <div class="flight-card-actions">
              <button class="btn btn-sm btn-secondary" onclick="openFlightModal('${f.id}')">✏ Edit</button>
              <button class="btn btn-sm btn-danger" onclick="deleteFlight('${f.id}','${f.flightNumber}')">🗑</button>
            </div>
          </div>
        </div>
        <div style="display:flex;gap:2rem;flex-wrap:wrap;align-items:center;">
          <div><div class="label">STD</div><div class="value" style="font-size:0.9rem;">${formatTime(f.std)}</div></div>
          <div><div class="label">STA</div><div class="value" style="font-size:0.9rem;">${formatTime(f.sta)}</div></div>
          <div><div class="label">Pesawat</div><div class="value" style="font-size:0.9rem;">${f.aircraft}</div></div>
          <div><div class="label">Gate</div><div class="value" style="font-size:0.9rem;">${f.gate} · ${f.terminal}</div></div>
          <div><div class="label">Counter</div><div class="value" style="font-size:0.9rem;">${f.checkInCounter||'-'}</div></div>
          <div><div class="label">Boarding</div><div class="value" style="font-size:0.9rem;">${formatTime(f.boardingTime)}</div></div>
          <div style="margin-left:auto;text-align:right;">
            <div class="label">Check-In</div>
            <div class="value" style="font-size:0.9rem;color:var(--cyan);">${chkIn}/${total} pax</div>
          </div>
        </div>
      </div>`;
    }
    container.innerHTML = html;
  } catch(err) {
    console.error(err);
    toast('Gagal memuat jadwal penerbangan', 'error');
  }
}

let _editFlightId = null;

async function openFlightModal(id = null) {
  _editFlightId = id;
  let f = null;
  if (id) {
    f = await DB.getFlight(id);
  }
  const title = id ? `Edit Penerbangan — ${f?.flightNumber}` : 'Tambah Penerbangan Baru';
  document.getElementById('modal-flight-title').textContent = title;

  // Populate form
  const fld = (n) => document.getElementById(`ff-${n}`);
  if (f) {
    fld('num').value    = f.flightNumber;
    fld('org').value    = f.origin;
    fld('orgc').value   = f.originCity;
    fld('dst').value    = f.destination;
    fld('dstc').value   = f.destinationCity;
    fld('std').value    = f.std?.slice(0,16) || '';
    fld('sta').value    = f.sta?.slice(0,16) || '';
    fld('board').value  = f.boardingTime?.slice(0,16) || '';
    fld('status').value = f.status;
    fld('acft').value   = f.aircraft;
    fld('gate').value   = f.gate;
    fld('term').value   = f.terminal;
    fld('ctr').value    = f.checkInCounter || '';
  } else {
    document.getElementById('form-flight').reset();
    fld('status').value = 'ON TIME';
    fld('acft').value   = 'B737-800';
    // Default to today
    const now = new Date();
    // Offset local timezone safely
    const tzOffset = now.getTimezoneOffset() * 60000;
    const local = (new Date(now - tzOffset)).toISOString().slice(0,16);
    fld('std').value  = local;
    fld('sta').value  = local;
    fld('board').value = local;
  }
  openModal('modal-flight');
}

async function saveFlightForm() {
  const fld = (n) => document.getElementById(`ff-${n}`).value.trim();
  const flightNumber  = fld('num').toUpperCase();
  const origin        = fld('org').toUpperCase();
  const originCity    = fld('orgc');
  const destination   = fld('dst').toUpperCase();
  const destinationCity = fld('dstc');
  const std           = fld('std');
  const sta           = fld('sta');
  const boardingTime  = fld('board');
  const status        = fld('status');
  const aircraft      = fld('acft');
  const gate          = fld('gate').toUpperCase();
  const terminal      = fld('term').toUpperCase();
  const checkInCounter = fld('ctr');

  if (!flightNumber || !origin || !destination || !std) {
    toast('Mohon isi nomor penerbangan, rute, dan STD.', 'error');
    return;
  }

  const isNew = !_editFlightId;
  
  try {
    const flight = await DB.saveFlight({
      id: _editFlightId || undefined,
      flightNumber, origin, originCity,
      originName: '', destination, destinationCity, destinationName: '',
      std, sta, boardingTime, status, aircraft, gate, terminal, checkInCounter,
    });

    if (isNew) {
      await DB.initSeatMap(flight.id, aircraft);
    }

    toast(isNew ? `Penerbangan ${flightNumber} berhasil dibuat!` : `Penerbangan ${flightNumber} diperbarui.`, 'success');
    closeModal('modal-flight');
    await renderFlights();
    await updateSidebarBadges();
  } catch(err) {
    console.error(err);
    toast('Gagal menyimpan penerbangan.', 'error');
  }
}

async function deleteFlight(id, num) {
  if (!confirm(`Hapus penerbangan ${num}? Semua data penumpang terkait juga akan dihapus.`)) return;
  try {
    await DB.deleteFlight(id);
    toast(`Penerbangan ${num} dihapus.`, 'warning');
    await renderFlights();
    await updateSidebarBadges();
  } catch (err) {
    toast('Gagal menghapus penerbangan.', 'error');
  }
}

async function changeFlightStatus(id, status) {
  const f = await DB.getFlight(id);
  if (!f) return;
  f.status = status;
  await DB.saveFlight(f);
  await renderFlights();
}

/* ── Manifest ──────────────────────────────────────────────────────────────── */
let _manifestFlightFilter = '';

async function renderManifest() {
  const flights = await DB.getFlights();

  const sel = document.getElementById('manifest-flight-select');
  const prev = sel.value;
  sel.innerHTML = '<option value="">— Pilih Penerbangan —</option>';
  flights.forEach(f => {
    sel.innerHTML += `<option value="${f.id}">${f.flightNumber} | ${f.origin}→${f.destination} | ${formatTime(f.std)}</option>`;
  });
  if (prev) sel.value = prev;
  if (!sel.value && flights.length) sel.value = flights[0].id;

  _manifestFlightFilter = sel.value;
  await renderManifestTable();
}

async function renderManifestTable() {
  const flightId = document.getElementById('manifest-flight-select').value;
  _manifestFlightFilter = flightId;
  
  if (!flightId) {
    document.getElementById('manifest-pax-count').textContent = `0 penumpang`;
    document.getElementById('manifest-table-body').innerHTML =
      `<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:2rem;">Pilih penerbangan di atas.</td></tr>`;
    return;
  }

  showLoading('manifest-table-body');
  
  try {
    const pax = await DB.getFlightPassengers(flightId);
    document.getElementById('manifest-pax-count').textContent = `${pax.length} penumpang`;

    if (!pax.length) {
      document.getElementById('manifest-table-body').innerHTML =
        `<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:2rem;">Belum ada penumpang. Klik "Tambah Penumpang".</td></tr>`;
      return;
    }

    document.getElementById('manifest-table-body').innerHTML = pax.map((p, i) => `
      <tr>
        <td style="font-family:var(--font-mono);color:var(--text-muted);">${String(i+1).padStart(3,'0')}</td>
        <td><span class="mono" style="color:var(--cyan);font-weight:600;letter-spacing:0.1em;">${p.pnr}</span></td>
        <td style="font-weight:500;color:var(--text-primary);">${p.title} ${p.lastName}/${p.firstName}</td>
        <td><span class="badge ${p.cabinClass==='C'?'badge-amber':'badge-muted'}">${p.cabinClass==='C'?'BUSINESS':'ECONOMY'}</span></td>
        <td>${p.fba} kg</td>
        <td>${p.ssr?.length ? p.ssr.map(s=>`<span class="badge ssr-${s}" style="font-size:0.6rem;">${s}</span>`).join(' ') : '<span style="color:var(--text-muted);font-size:0.8rem;">—</span>'}</td>
        <td>
          <span class="checkin-indicator ${p.checkedIn?'checked':'pending'}">
            <span class="dot"></span>${p.checkedIn?'CHECKED IN':'PENDING'}
          </span>
        </td>
        <td>
          <div style="display:flex;gap:0.4rem;">
            <button class="btn btn-sm btn-secondary" onclick="openPaxModal('${p.id}')">✏</button>
            <button class="btn btn-sm btn-danger" onclick="deletePax('${p.id}','${p.firstName} ${p.lastName}')">🗑</button>
            ${p.checkedIn ? `<button class="btn btn-sm btn-amber" onclick="resetPax('${p.id}')">↺</button>` : ''}
          </div>
        </td>
      </tr>
    `).join('');
  } catch(err) {
    console.error(err);
    toast('Gagal memuat manifest.', 'error');
  }
}

let _editPaxId = null;

async function openPaxModal(id = null) {
  _editPaxId = id;
  const p = id ? await DB.getPassenger(id) : null;
  const flights = await DB.getFlights();

  document.getElementById('modal-pax-title').textContent = id ? 'Edit Penumpang' : 'Tambah Penumpang';

  const flSel = document.getElementById('fp-flight');
  flSel.innerHTML = flights.map(f => `<option value="${f.id}">${f.flightNumber} | ${f.origin}→${f.destination}</option>`).join('');

  const fld = (n) => document.getElementById(`fp-${n}`);
  if (p) {
    flSel.value       = p.flightId;
    fld('pnr').value  = p.pnr;
    fld('title').value= p.title;
    fld('first').value= p.firstName;
    fld('last').value = p.lastName;
    fld('class').value= p.cabinClass;
    fld('fba').value  = p.fba;
    document.querySelectorAll('.ssr-cb').forEach(cb => {
      cb.checked = p.ssr?.includes(cb.value);
      cb.closest('.ssr-checkbox').classList.toggle('checked', cb.checked);
    });
  } else {
    document.getElementById('form-pax').reset();
    if (_manifestFlightFilter) flSel.value = _manifestFlightFilter;
    fld('title').value = 'MR';
    fld('class').value = 'Y';
    fld('fba').value   = 20;
    document.querySelectorAll('.ssr-cb').forEach(cb => {
      cb.checked = false;
      cb.closest('.ssr-checkbox').classList.remove('checked');
    });
  }

  fld('class').onchange = () => {
    fld('fba').value = fld('class').value === 'C' ? 30 : 20;
  };

  openModal('modal-pax');
}

async function savePaxForm() {
  const fld = (n) => document.getElementById(`fp-${n}`).value.trim();
  const flightId  = document.getElementById('fp-flight').value;
  const pnr       = fld('pnr').toUpperCase();
  const title     = fld('title');
  const firstName = fld('first').toUpperCase();
  const lastName  = fld('last').toUpperCase();
  const cabinClass = fld('class');
  const fba       = parseFloat(fld('fba')) || 20;
  const ssr       = Array.from(document.querySelectorAll('.ssr-cb:checked')).map(c => c.value);

  if (!flightId || !pnr || !firstName || !lastName) {
    toast('Mohon isi semua field wajib.', 'error');
    return;
  }
  if (pnr.length < 6) { toast('Kode PNR minimal 6 karakter.', 'error'); return; }
  
  const isUnique = await DB.isPNRUnique(pnr, _editPaxId);
  if (!isUnique) { toast(`PNR ${pnr} sudah digunakan oleh penumpang lain.`, 'error'); return; }

  const existing = _editPaxId ? await DB.getPassenger(_editPaxId) : null;

  try {
    await DB.savePassenger({
      id:          _editPaxId || undefined,
      flightId, pnr, title, firstName, lastName, cabinClass, fba, ssr,
      seatNumber:  existing?.seatNumber || null,
      checkedIn:   existing?.checkedIn || false,
      baggageItems:existing?.baggageItems || 0,
      baggageWeight:existing?.baggageWeight || 0,
      excessBaggage:existing?.excessBaggage || 0,
      boardingPassIssued: existing?.boardingPassIssued || false,
    });

    toast(_editPaxId ? 'Data penumpang diperbarui.' : `Penumpang ${firstName}/${lastName} ditambahkan!`, 'success');
    closeModal('modal-pax');
    await renderManifestTable();
    await updateSidebarBadges();
  } catch(err) {
    toast('Gagal menyimpan penumpang.', 'error');
  }
}

async function deletePax(id, name) {
  if (!confirm(`Hapus penumpang ${name}?`)) return;
  await DB.deletePassenger(id);
  toast(`Penumpang ${name} dihapus.`, 'warning');
  await renderManifestTable();
}

async function resetPax(id) {
  const p = await DB.getPassenger(id);
  if (!p) return;
  if (!confirm(`Reset check-in ${p.firstName}/${p.lastName}? Seat dan boarding pass akan dikosongkan.`)) return;

  if (p.seatNumber) await DB.clearSeat(p.flightId, p.seatNumber);

  p.seatNumber  = null;
  p.checkedIn   = false;
  p.baggageItems   = 0;
  p.baggageWeight  = 0;
  p.excessBaggage  = 0;
  p.boardingPassIssued = false;
  
  await DB.savePassenger(p);
  toast(`Check-in ${p.firstName}/${p.lastName} direset.`, 'info');
  await renderManifestTable();
}

/* ── Agents CRUD ───────────────────────────────────────────────────────────── */
async function renderAgents() {
  showLoading('agents-table-body');
  try {
    const agents_all = await DB.getAgents();
    const agents = agents_all.filter(a => a.role === 'agent');
    const tbody  = document.getElementById('agents-table-body');

    if (!agents.length) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:2rem;">Belum ada agent.</td></tr>`;
      return;
    }

    tbody.innerHTML = agents.map(a => `
      <tr>
        <td><span class="mono" style="color:var(--cyan);font-weight:600;">${a.agentId}</span></td>
        <td style="font-weight:500;color:var(--text-primary);">${a.name}</td>
        <td><span class="badge badge-cyan">AGENT</span></td>
        <td style="color:var(--text-muted);font-size:0.75rem;">${new Date(a.createdAt).toLocaleDateString('id-ID')}</td>
        <td>
          <div style="display:flex;gap:0.4rem;">
            <button class="btn btn-sm btn-secondary" onclick="openAgentModal('${a.id}')">✏ Edit</button>
            <button class="btn btn-sm btn-danger" onclick="deleteAgent('${a.id}','${a.agentId}')">🗑 Hapus</button>
          </div>
        </td>
      </tr>
    `).join('');
  } catch(err) {
    toast('Gagal memuat agen.', 'error');
  }
}

let _editAgentId = null;

async function openAgentModal(id = null) {
  _editAgentId = id;
  const a = id ? await DB.getAgent(id) : null;
  document.getElementById('modal-agent-title').textContent = id ? 'Edit Agent' : 'Tambah Agent Baru';

  const fld = (n) => document.getElementById(`fa-${n}`);
  if (a) {
    fld('id').value  = a.agentId;
    fld('name').value = a.name;
    fld('pwd').value = a.password;
  } else {
    document.getElementById('form-agent').reset();
  }
  openModal('modal-agent');
}

async function saveAgentForm() {
  const agentId  = document.getElementById('fa-id').value.trim().toUpperCase();
  const name     = document.getElementById('fa-name').value.trim();
  const password = document.getElementById('fa-pwd').value.trim();

  if (!agentId || !name || !password) { toast('Semua field wajib diisi.', 'error'); return; }
  if (agentId.length < 4) { toast('Agent ID minimal 4 karakter.', 'error'); return; }
  if (password.length < 6) { toast('Password minimal 6 karakter.', 'error'); return; }
  
  const isUnique = await DB.isAgentIdUnique(agentId, _editAgentId);
  if (!isUnique) { toast(`Agent ID "${agentId}" sudah digunakan.`, 'error'); return; }

  await DB.saveAgent({ id: _editAgentId||undefined, agentId, name, password, role: 'agent' });
  toast(_editAgentId ? `Agent ${agentId} diperbarui.` : `Agent ${agentId} berhasil dibuat!`, 'success');
  closeModal('modal-agent');
  await renderAgents();
}

async function deleteAgent(id, agentId) {
  if (!confirm(`Hapus agent ${agentId}?`)) return;
  await DB.deleteAgent(id);
  toast(`Agent ${agentId} dihapus.`, 'warning');
  await renderAgents();
  await updateSidebarBadges();
}

/* ── Modal helpers ─────────────────────────────────────────────────────────── */
function openModal(id) {
  const overlay = document.getElementById(`${id}-overlay`);
  overlay.classList.remove('hidden');
  requestAnimationFrame(() => overlay.classList.add('active'));
}
function closeModal(id) {
  const overlay = document.getElementById(`${id}-overlay`);
  overlay.classList.remove('active');
  setTimeout(() => overlay.classList.add('hidden'), 300);
}

/* ── SSR checkbox toggle ───────────────────────────────────────────────────── */
function toggleSSR(cb) {
  cb.closest('.ssr-checkbox').classList.toggle('checked', cb.checked);
}

/* ── Sidebar badges ────────────────────────────────────────────────────────── */
async function updateSidebarBadges() {
  try {
    const flights  = await DB.getFlights();
    const pax      = await DB.getPassengers();
    const agents_all = await DB.getAgents();
    const agents   = agents_all.filter(a => a.role === 'agent');
    
    const el_f  = document.getElementById('badge-flights');
    const el_p  = document.getElementById('badge-pax');
    const el_a  = document.getElementById('badge-agents');
    
    if (el_f) el_f.textContent = flights.length;
    if (el_p) el_p.textContent = pax.length;
    if (el_a) el_a.textContent = agents.length;
  } catch(e) {}
}

/* ── Utilities ─────────────────────────────────────────────────────────────── */
function formatTime(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit', hour12:false });
  } catch { return '—'; }
}
function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' });
  } catch { return '—'; }
}

/* ── Reset all data ────────────────────────────────────────────────────────── */
async function resetAllData() {
  if (!confirm('⚠️ PERHATIAN! Ini akan menghapus SEMUA data (penerbangan, penumpang, akun agent) dan muat ulang data demo dari Supabase. Lanjutkan?')) return;
  if (!confirm('Yakin? Tindakan ini akan membutuhkan waktu beberapa saat (bergantung koneksi internet) dan tidak dapat dibatalkan.')) return;
  
  toast('Sedang me-reset data... Harap tunggu.', 'info');
  try {
    await DB.clearAll();
    await Seed.run();
    toast('Data direset dan demo data dimuat ulang!', 'success');
    await navigate('dashboard');
    await updateSidebarBadges();
  } catch(err) {
    toast('Gagal me-reset data.', 'error');
  }
}

// ── Mobile Responsive ──
function toggleSidebar() {
  const sidebar = document.querySelector('.sidebar');
  if (sidebar) sidebar.classList.toggle('open');
}
