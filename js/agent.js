/**
 * AeroCheck Simulator — Agent Check-In Logic
 * Handles PNR search, passenger loading, seat assignment,
 * baggage processing, and boarding pass issuance.
 */

/* ── State ──────────────────────────────────────────────────────────────────── */
let _currentPax    = null;
let _currentFlight = null;
let _currentStep   = 0;    // 0=idle, 1=seat, 2=baggage, 3=done
let _pendingSeat   = null;
let _searchMode    = 'pnr'; // pnr | flight | name

/* ── Toast ──────────────────────────────────────────────────────────────────── */
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

/* ── Clock & Ticker ─────────────────────────────────────────────────────────── */
function startClock() {
  const clockEl = document.getElementById('topbar-clock-time');
  const dateEl  = document.getElementById('topbar-clock-date');
  function update() {
    const now = new Date();
    clockEl.textContent = now.toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false });
    dateEl.textContent  = now.toLocaleDateString('id-ID', { weekday:'short', day:'2-digit', month:'short', year:'numeric' });
  }
  update();
  setInterval(update, 1000);
}

async function buildTicker() {
  const ticker  = document.getElementById('ticker-inner');
  try {
    const flights = await DB.getFlights();
    if (!flights.length) { ticker.innerHTML = '<span class="ticker-item" style="color:var(--text-muted);">Tidak ada penerbangan hari ini</span>'; return; }

    const items = [...flights, ...flights].map(f => {
      const statusClass = `status-${f.status.toLowerCase().replace(' ','-')}`;
      return `
      <span class="ticker-item">
        <span class="t-fn">${f.flightNumber}</span>
        <span class="t-rt">${f.origin}→${f.destination}</span>
        <span class="t-sep">|</span>
        <span class="t-time">${formatTime(f.std)}</span>
        <span class="t-sep">|</span>
        <span class="status-badge ${statusClass}" style="font-size:0.62rem;padding:0.1rem 0.45rem;">${f.status}</span>
      </span>`;
    }).join('');
    ticker.innerHTML = items;
  } catch(e) {
    ticker.innerHTML = '<span class="ticker-item" style="color:var(--red);">Gagal memuat ticker</span>';
  }
}

/* ── Search ─────────────────────────────────────────────────────────────────── */
function setSearchMode(mode) {
  _searchMode = mode;
  document.querySelectorAll('.search-type-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`stype-${mode}`).classList.add('active');

  const input = document.getElementById('search-input');
  const placeholders = {
    pnr:    'Masukkan Kode Booking / PNR (contoh: ABC123)',
    flight: 'Masukkan Nomor Penerbangan (contoh: NU-101)',
    name:   'Masukkan Nama Belakang Penumpang',
  };
  input.placeholder = placeholders[mode];
  input.value = '';
  hideDropdown();
}

async function onSearchInput() {
  const q = document.getElementById('search-input').value.trim();
  if (q.length < 2) { hideDropdown(); return; }
  if (_searchMode === 'pnr') await showPNRDropdown(q);
  else if (_searchMode === 'name') await showNameDropdown(q);
  else hideDropdown();
}

async function showPNRDropdown(q) {
  const results = await DB.searchPassengers(q);
  if (!results.length) { hideDropdown(); return; }
  await showDropdown(results);
}

async function showNameDropdown(q) {
  const results = await DB.searchPassengers(q);
  if (!results.length) { hideDropdown(); return; }
  await showDropdown(results);
}

async function showDropdown(results) {
  let html = '';
  
  // Cache flights to avoid repeated DB calls
  const flightsCache = {};
  
  for (const p of results.slice(0, 8)) {
    if (!flightsCache[p.flightId]) {
      flightsCache[p.flightId] = await DB.getFlight(p.flightId);
    }
    const f = flightsCache[p.flightId];
    const status = p.checkedIn
      ? `<span class="badge badge-green" style="font-size:0.6rem;">CHECKED IN</span>`
      : `<span class="badge badge-muted" style="font-size:0.6rem;">PENDING</span>`;
    html += `
    <div class="srd-item" onclick="selectPassenger('${p.id}')">
      <div>
        <div style="display:flex;align-items:center;gap:0.5rem;">
          <span class="srd-pnr">${p.pnr}</span>
          <span style="font-size:0.8rem;color:var(--text-secondary);">${p.title} ${p.lastName}/${p.firstName}</span>
        </div>
        <div class="srd-flight">${f ? `${f.flightNumber} · ${f.origin}→${f.destination} · ${formatTime(f.std)}` : '—'}</div>
      </div>
      <div class="srd-status">${status}</div>
    </div>`;
  }

  const dd = document.getElementById('search-dropdown');
  dd.innerHTML = html;
  dd.classList.remove('hidden');
}

function hideDropdown() {
  document.getElementById('search-dropdown').classList.add('hidden');
}

async function executeSearch(e) {
  if (e) e.preventDefault();
  const q = document.getElementById('search-input').value.trim().toUpperCase();
  hideDropdown();
  if (!q) { toast('Masukkan PNR, nomor penerbangan, atau nama penumpang.', 'warning'); return; }

  if (_searchMode === 'flight') {
    await searchByFlight(q);
    return;
  }

  const results = await DB.searchPassengers(q);
  if (!results.length) {
    toast(`Data tidak ditemukan untuk "${q}". Periksa kembali kode booking.`, 'error');
    showIdleWithMsg(`❌ Tidak ditemukan: "${q}"`);
    return;
  }
  if (results.length === 1) {
    await selectPassenger(results[0].id);
  } else {
    await showDropdown(results);
  }
}

async function searchByFlight(flightNum) {
  const flightsAll = await DB.getFlights();
  const flights = flightsAll.filter(f =>
    f.flightNumber.toUpperCase().replace('-','') === flightNum.replace('-','') ||
    f.flightNumber.toUpperCase() === flightNum
  );
  if (!flights.length) {
    toast(`Penerbangan "${flightNum}" tidak ditemukan.`, 'error');
    return;
  }
  const flight = flights[0];
  const pax    = await DB.getFlightPassengers(flight.id);
  showManifestList(flight, pax);
}

/* ── Load Passenger ─────────────────────────────────────────────────────────── */
async function selectPassenger(paxId) {
  hideDropdown();
  const pax    = await DB.getPassenger(paxId);
  const flight = pax ? await DB.getFlight(pax.flightId) : null;

  if (!pax || !flight) {
    toast('Data penumpang tidak valid.', 'error');
    return;
  }

  _currentPax    = pax;
  _currentFlight = flight;
  _pendingSeat   = pax.seatNumber;

  // Show search input value
  document.getElementById('search-input').value = pax.pnr;

  renderPassengerInfo();
  renderFlightInfo();
  renderStatusPanel();

  if (pax.checkedIn && pax.boardingPassIssued) {
    // Already done
    setStep(3);
    toast(`${pax.firstName}/${pax.lastName} sudah check-in. Boarding pass bisa dicetak ulang.`, 'info');
  } else if (pax.seatNumber) {
    // Seat assigned, go to baggage
    setStep(2);
    renderBaggagePanel();
  } else {
    // Start fresh
    setStep(1);
    await renderSeatMapPanel();
  }
}

/* ── Render panels ──────────────────────────────────────────────────────────── */
function renderFlightInfo() {
  const f = _currentFlight;
  const statusClass = `status-${f.status.toLowerCase().replace(' ','-')}`;
  document.getElementById('flight-info-card').innerHTML = `
  <div class="flight-info-card" id="fic-inner">
    <div class="fic-header">
      <span class="fic-fn">${f.flightNumber}</span>
      <span class="status-badge ${statusClass}">${f.status}</span>
    </div>
    <div class="fic-route">
      <div>
        <div class="fic-iata">${f.origin}</div>
        <div class="fic-city">${f.originCity}</div>
      </div>
      <div class="fic-arrow">
        <div class="fic-plane">✈</div>
        <div class="fic-arr-line"></div>
      </div>
      <div style="text-align:right;">
        <div class="fic-iata">${f.destination}</div>
        <div class="fic-city">${f.destinationCity}</div>
      </div>
    </div>
    <div class="fic-meta">
      <div class="fic-item"><span class="label">STD</span><span class="val">${formatTime(f.std)}</span></div>
      <div class="fic-item"><span class="label">STA</span><span class="val">${formatTime(f.sta)}</span></div>
      <div class="fic-item"><span class="label">Gate</span><span class="val">${f.gate} · ${f.terminal}</span></div>
      <div class="fic-item"><span class="label">Boarding</span><span class="val">${formatTime(f.boardingTime)}</span></div>
      <div class="fic-item"><span class="label">Pesawat</span><span class="val">${f.aircraft}</span></div>
      <div class="fic-item"><span class="label">Counter</span><span class="val">${f.checkInCounter||'—'}</span></div>
    </div>
  </div>`;
}

function renderPassengerInfo() {
  const p = _currentPax;
  const cabinBadge = p.cabinClass === 'C'
    ? `<span class="badge badge-amber">BUSINESS</span>`
    : `<span class="badge badge-muted">ECONOMY</span>`;
  const ssrHtml = (p.ssr||[]).length
    ? `<div class="ssr-section"><div class="ssr-title">Special Service Request</div>
        <div class="ssr-tags">${p.ssr.map(s => `<span class="badge ssr-${s}">${s}</span>`).join('')}</div></div>`
    : '';

  document.getElementById('pax-info-card').innerHTML = `
  <div class="pax-info-card">
    <div class="pic-header">
      <div>
        <div class="pic-name">${p.title} ${p.lastName}/${p.firstName}</div>
        <div class="pic-pnr">PNR: ${p.pnr}</div>
      </div>
      ${cabinBadge}
    </div>
    <div class="pic-meta">
      <div class="fic-item"><span class="label">Kelas</span><span class="val">${p.cabinClass === 'C' ? 'Business (C)' : 'Economy (Y)'}</span></div>
      <div class="fic-item"><span class="label">FBA</span><span class="val">${p.fba} kg</span></div>
    </div>
    ${ssrHtml}
  </div>`;
}

function renderStatusPanel() {
  const p = _currentPax;
  const seatVal   = p.seatNumber
    ? `<span class="s-val done">${p.seatNumber}</span>`
    : `<span class="s-val pending">Belum ditentukan</span>`;
  const bagVal    = p.baggageWeight > 0
    ? `<span class="s-val ${p.excessBaggage > 0 ? 'excess' : 'done'}">${p.baggageWeight} kg · ${p.baggageItems} koli</span>`
    : `<span class="s-val pending">Belum diinput</span>`;
  const boardVal  = p.boardingPassIssued
    ? `<span class="s-val done">✓ ISSUED</span>`
    : `<span class="s-val pending">Belum diterbitkan</span>`;
  const checkinVal = p.checkedIn
    ? `<span class="s-val done">✓ CHECKED IN</span>`
    : `<span class="s-val pending">OPEN</span>`;

  document.getElementById('status-panel').innerHTML = `
  <div class="status-panel">
    <div style="font-size:0.65rem;font-weight:700;letter-spacing:0.12em;color:var(--text-muted);margin-bottom:0.25rem;">STATUS CHECK-IN</div>
    <div class="status-row"><span class="s-label">Kursi</span>${seatVal}</div>
    <div class="status-row"><span class="s-label">Bagasi</span>${bagVal}</div>
    ${p.excessBaggage > 0 ? `<div class="status-row"><span class="s-label">Excess</span><span class="s-val excess">${p.excessBaggage} kg — Rp${(p.excessBaggage * BoardingPass.EXCESS_RATE).toLocaleString('id-ID')}</span></div>` : ''}
    <div class="status-row"><span class="s-label">Check-In</span>${checkinVal}</div>
    <div class="status-row"><span class="s-label">Boarding Pass</span>${boardVal}</div>
  </div>`;
}

/* ── Manifest list (by flight) ──────────────────────────────────────────────── */
function showManifestList(flight, pax) {
  _currentFlight = flight;
  _currentPax    = null;
  renderFlightInfo();
  document.getElementById('pax-info-card').innerHTML = '';
  document.getElementById('status-panel').innerHTML  = '';

  const listHtml = pax.map(p => {
    const checked = p.checkedIn;
    return `
    <div class="manifest-pax-item${p.id === _currentPax?.id ? ' active-pax' : ''}" onclick="selectPassenger('${p.id}')">
      <div>
        <div class="mpi-name">${p.title} ${p.lastName}/${p.firstName}</div>
        <div class="mpi-pnr">${p.pnr} · ${p.cabinClass==='C'?'BUS':'ECO'}</div>
      </div>
      <span class="mpi-status ${checked?'checked':'pending'}">${checked?'✓ CI':'OPEN'}</span>
    </div>`;
  }).join('');

  document.getElementById('flight-info-card').innerHTML += `
  <div class="manifest-list-panel" id="manifest-list-panel">
    <div class="manifest-list-title">Manifest Penumpang · ${pax.length} pax</div>
    ${listHtml || '<div style="font-size:0.78rem;color:var(--text-muted);">Belum ada penumpang.</div>'}
  </div>`;

  showIdleWithMsg('Pilih penumpang dari manifest di atas.');
  toast(`Penerbangan ${flight.flightNumber} ditemukan. ${pax.length} penumpang.`, 'info');
}

/* ── Step management ────────────────────────────────────────────────────────── */
function setStep(step) {
  _currentStep = step;

  // Update step indicators
  ['seat', 'baggage', 'issue'].forEach((s, i) => {
    const el    = document.getElementById(`step-${s}`);
    const isDone   = i < step - 1;
    const isActive = i === step - 1;
    el.className = 'step-item' + (isDone ? ' done' : isActive ? ' active' : '');
    const numEl = el.querySelector('.step-num');
    if (numEl) numEl.textContent = isDone ? '✓' : i + 1;
  });

  // Show correct panel
  document.getElementById('step-panel-seat').classList.toggle('active', step === 1);
  document.getElementById('step-panel-baggage').classList.toggle('active', step === 2);
  document.getElementById('step-panel-done').classList.toggle('active', step === 3);
  document.getElementById('panel-idle').classList.toggle('active', step === 0);

  // Update action bar
  updateActionBar();
}

function showIdleWithMsg(msg = null) {
  setStep(0);
  if (msg) {
    document.getElementById('idle-msg').textContent = msg;
  }
}

/* ── Seat Map Panel ─────────────────────────────────────────────────────────── */
async function renderSeatMapPanel() {
  _pendingSeat = _currentPax.seatNumber;

  document.getElementById('seatmap-render-area').innerHTML = '<div style="padding: 2rem; text-align:center;"><div class="spinner"></div><p>Memuat seat map...</p></div>';

  await SeatMap.render(
    _currentFlight.id,
    _currentFlight.aircraft,
    _currentPax.cabinClass,
    'seatmap-render-area',
    (seatNum) => {
      _pendingSeat = seatNum;
      updateActionBar();

      // Show seat info
      const infoEl = document.getElementById('seat-selected-info');
      if (seatNum) {
        const row = seatNum.match(/\d+/)[0];
        const col = seatNum.match(/[A-Z]/)[0];
        const isWin = col === 'A' || col === 'F';
        const isMid = col === 'B' || col === 'E';
        const isAis = col === 'C' || col === 'D';
        const pos   = isWin ? '🪟 Window' : isMid ? '🪑 Middle' : '🚶 Aisle';
        infoEl.innerHTML = `<div class="fba-ok">✅ Kursi <strong>${seatNum}</strong> dipilih &nbsp;·&nbsp; ${pos}</div>`;
      } else {
        infoEl.innerHTML = '';
      }
    }
  );

  if (_pendingSeat) {
    SeatMap.setSelected(_pendingSeat);
    document.getElementById('seat-selected-info').innerHTML =
      `<div class="fba-ok">✅ Kursi sebelumnya: <strong>${_pendingSeat}</strong>. Klik kursi lain untuk mengubah.</div>`;
  }
  updateActionBar();
}

async function confirmSeat() {
  const seat = _pendingSeat || SeatMap.getSelected();
  if (!seat) {
    toast('Pilih kursi terlebih dahulu.', 'warning');
    return;
  }

  // Free old seat if any
  if (_currentPax.seatNumber && _currentPax.seatNumber !== seat) {
    await DB.clearSeat(_currentFlight.id, _currentPax.seatNumber);
  }

  // Assign new seat
  await DB.updateSeat(_currentFlight.id, seat, { occupied: true, passengerId: _currentPax.id });
  _currentPax.seatNumber = seat;
  await DB.savePassenger(_currentPax);

  toast(`Kursi ${seat} berhasil ditetapkan untuk ${_currentPax.firstName}/${_currentPax.lastName}.`, 'success');
  setStep(2);
  renderBaggagePanel();
  renderStatusPanel();
}

/* ── Baggage Panel ──────────────────────────────────────────────────────────── */
function renderBaggagePanel() {
  const p = _currentPax;
  document.getElementById('baggage-weight-display').textContent = p.baggageWeight || 0;
  document.getElementById('baggage-input-pieces').value  = p.baggageItems  || '';
  document.getElementById('baggage-fba-info').textContent = `FBA: ${p.fba} kg`;
  generateBaggageItemInputs(p.baggageDetails);
  updateBaggageCalc();
}

function generateBaggageItemInputs(existingDetails = null) {
  const pieces = parseInt(document.getElementById('baggage-input-pieces').value) || 0;
  const container = document.getElementById('baggage-items-container');
  
  // Clear if pieces is 0
  if (pieces <= 0) {
    container.innerHTML = '';
    updateBaggageCalc();
    return;
  }

  // Preserve existing user inputs if just adding/removing pieces
  let currentVals = [];
  if (existingDetails) {
    currentVals = existingDetails;
  } else {
    document.querySelectorAll('.baggage-koli-input').forEach(inp => currentVals.push(inp.value));
  }

  let html = '';
  for (let i = 1; i <= pieces; i++) {
    const val = currentVals[i-1] || '';
    html += `
      <div class="form-group" style="margin-bottom: 0;">
        <label class="form-label">Koli ${i} (kg)</label>
        <input type="number" class="form-control mono baggage-koli-input" min="0" max="999" step="0.1" value="${val}" oninput="updateBaggageCalc()" placeholder="0.0">
      </div>
    `;
  }
  container.innerHTML = html;
  updateBaggageCalc();
}

function updateBaggageCalc() {
  const pieces = parseInt(document.getElementById('baggage-input-pieces').value) || 0;
  
  let weight = 0;
  document.querySelectorAll('.baggage-koli-input').forEach(inp => {
    weight += parseFloat(inp.value) || 0;
  });
  
  weight = Math.round(weight * 10) / 10;
  
  const fba     = _currentPax ? _currentPax.fba : 20;
  const excess  = Math.max(0, weight - fba);

  // Animated weight display
  document.getElementById('baggage-weight-display').textContent = weight;
  document.getElementById('baggage-weight-display').style.color =
    excess > 0 ? 'var(--red)' : weight > 0 ? 'var(--green)' : 'var(--cyan)';

  const alertEl = document.getElementById('excess-alert');
  const fbaOkEl = document.getElementById('fba-ok-banner');

  if (excess > 0) {
    const fee = excess * BoardingPass.EXCESS_RATE;
    alertEl.innerHTML = `
      <span class="ea-icon">⚠️</span>
      <div>
        <div class="ea-title">EXCESS BAGGAGE</div>
        <div class="ea-body">
          Berat: <strong>${weight} kg</strong> — FBA: <strong>${fba} kg</strong><br>
          Kelebihan: <span class="excess-amount">${excess} kg</span><br>
          Tarif: Rp ${BoardingPass.EXCESS_RATE.toLocaleString('id-ID')}/kg<br>
          <strong>Total Excess Fee: Rp ${fee.toLocaleString('id-ID')}</strong>
        </div>
      </div>`;
    alertEl.classList.remove('hidden');
    fbaOkEl.classList.add('hidden');
  } else if (weight > 0) {
    fbaOkEl.innerHTML = `✅ Bagasi OK · ${weight} kg dari ${fba} kg FBA (sisa: ${fba - weight} kg)`;
    fbaOkEl.classList.remove('hidden');
    alertEl.classList.add('hidden');
  } else {
    alertEl.classList.add('hidden');
    fbaOkEl.classList.add('hidden');
  }
  updateActionBar();
}

async function confirmBaggage() {
  const pieces = parseInt(document.getElementById('baggage-input-pieces').value)   || 0;
  let weight = 0;
  let details = [];
  
  document.querySelectorAll('.baggage-koli-input').forEach(inp => {
    const w = parseFloat(inp.value) || 0;
    weight += w;
    details.push(w);
  });
  weight = Math.round(weight * 10) / 10;

  if (pieces > 0 && weight <= 0) { toast('Masukkan berat untuk setiap koli bagasi.', 'warning'); return; }

  const fba    = _currentPax.fba;
  const excess = Math.max(0, weight - fba);

  _currentPax.baggageItems   = pieces;
  _currentPax.baggageWeight  = weight;
  _currentPax.baggageDetails = details;
  _currentPax.excessBaggage  = excess;
  await DB.savePassenger(_currentPax);

  if (excess > 0) {
    const fee = excess * BoardingPass.EXCESS_RATE;
    toast(`Bagasi dikonfirmasi. Excess ${excess} kg — Fee: Rp ${fee.toLocaleString('id-ID')}`, 'warning');
  } else {
    toast('Bagasi dikonfirmasi. Dalam batas FBA.', 'success');
  }

  setStep(3);
  renderStatusPanel();
  renderDonePanel();
}

async function skipBaggage() {
  _currentPax.baggageItems  = 0;
  _currentPax.baggageWeight = 0;
  _currentPax.excessBaggage = 0;
  await DB.savePassenger(_currentPax);
  setStep(3);
  renderDonePanel();
  renderStatusPanel();
}

/* ── Done / Issue Panel ─────────────────────────────────────────────────────── */
function renderDonePanel() {
  const p = _currentPax;
  const f = _currentFlight;
  document.getElementById('step-panel-done').innerHTML = `
  <div style="text-align:center;max-width:480px;margin:0 auto;padding:1.5rem 0;">
    <div style="font-size:3.5rem;margin-bottom:1rem;animation:idle-float 3s ease-in-out infinite;">🎫</div>
    <h2 style="font-size:1.1rem;font-weight:700;margin-bottom:0.35rem;color:var(--text-primary);">
      Siap Menerbitkan Boarding Pass
    </h2>
    <p style="font-size:0.85rem;color:var(--text-muted);line-height:1.6;margin-bottom:1.5rem;">
      ${p.title} ${p.lastName}/${p.firstName} · ${f.flightNumber} · Seat ${p.seatNumber || '—'}<br>
      ${f.origin} → ${f.destination} · ${formatTime(f.std)} · Gate ${f.gate}
    </p>
    ${p.excessBaggage > 0 ? `
    <div class="excess-alert" style="text-align:left;margin-bottom:1.25rem;">
      <span class="ea-icon">⚠️</span>
      <div>
        <div class="ea-title">EXCESS BAGGAGE — TAGIH SEBELUM ISSUE</div>
        <div class="ea-body">Kelebihan: ${p.excessBaggage} kg · Fee: <strong>Rp ${(p.excessBaggage * BoardingPass.EXCESS_RATE).toLocaleString('id-ID')}</strong></div>
      </div>
    </div>` : ''}
    <div style="display:flex;flex-direction:column;gap:0.75rem;align-items:center;">
      <button class="btn-issue" onclick="issueBoardingPass()" id="btn-issue-final">
        🎫 ISSUE BOARDING PASS
      </button>
      ${p.boardingPassIssued ? `
      <button class="btn btn-secondary" onclick="reprintBoardingPass()">
        🖨 Cetak Ulang BP
      </button>` : ''}
      ${p.baggageItems > 0 ? `
      <button class="btn btn-secondary" onclick="printBaggageTags()">
        🖨 Cetak Label Bagasi
      </button>` : ''}
    </div>
    ${p.boardingPassIssued ? `
    <div class="fba-ok" style="margin-top:1rem;justify-content:center;">
      ✅ Boarding pass sudah diterbitkan. Status: CHECKED IN
    </div>` : ''}
  </div>`;
}

/* ── Issue Boarding Pass ─────────────────────────────────────────────────────── */
async function issueBoardingPass() {
  if (!_currentPax.seatNumber) {
    toast('Seat belum ditentukan. Kembali ke Step 1.', 'error');
    return;
  }

  const btn = document.getElementById('btn-issue-final');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner" style="width:16px;height:16px;border-width:2px;"></span> &nbsp;PROCESSING...';
  }

  try {
    _currentPax.checkedIn         = true;
    _currentPax.boardingPassIssued = true;
    await DB.savePassenger(_currentPax);

    toast(`✈ Boarding pass ${_currentPax.pnr} berhasil diterbitkan!`, 'success');
    renderStatusPanel();
    renderDonePanel();

    // Show boarding pass
    BoardingPass.show(_currentPax, _currentFlight);
  } catch(err) {
    toast('Gagal menerbitkan boarding pass', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '🎫 ISSUE BOARDING PASS';
    }
  }
}

function reprintBoardingPass() {
  if (_currentPax && _currentFlight) {
    BoardingPass.show(_currentPax, _currentFlight);
  }
}

function printBaggageTags() {
  if (_currentPax && _currentFlight) {
    BaggageTag.show(_currentPax, _currentFlight);
  }
}

/* ── Update Action Bar ──────────────────────────────────────────────────────── */
function updateActionBar() {
  const backBtn  = document.getElementById('ab-back');
  const nextBtn  = document.getElementById('ab-next');
  const stepInfo = document.getElementById('ab-step-info');

  if (_currentStep === 0) {
    backBtn.classList.add('hidden');
    nextBtn.classList.add('hidden');
    stepInfo.textContent = '';
    return;
  }

  backBtn.classList.remove('hidden');
  nextBtn.classList.remove('hidden');

  if (_currentStep === 1) {
    backBtn.textContent = '← Batal';
    backBtn.onclick = () => clearWorkspace();
    const hasSeat = _pendingSeat || SeatMap.getSelected();
    nextBtn.textContent  = 'Konfirmasi Kursi →';
    nextBtn.className    = 'btn ' + (hasSeat ? 'btn-primary' : 'btn-secondary');
    nextBtn.onclick      = confirmSeat;
    nextBtn.disabled     = !hasSeat;
    stepInfo.textContent = hasSeat ? `Kursi dipilih: ${hasSeat}` : 'Pilih kursi di peta di atas';
  } else if (_currentStep === 2) {
    backBtn.textContent = '← Ubah Kursi';
    backBtn.onclick = () => { setStep(1); renderSeatMapPanel(); };
    nextBtn.textContent = 'Konfirmasi Bagasi →';
    nextBtn.className   = 'btn btn-primary';
    nextBtn.onclick     = confirmBaggage;
    nextBtn.disabled    = false;
    stepInfo.innerHTML  = `<button class="btn btn-sm btn-secondary" onclick="skipBaggage()">Lewati (Tanpa Bagasi)</button>`;
  } else if (_currentStep === 3) {
    backBtn.textContent = '← Ubah Bagasi';
    backBtn.onclick = () => { setStep(2); renderBaggagePanel(); };
    nextBtn.classList.add('hidden');
    stepInfo.textContent = _currentPax?.checkedIn ? '✓ Check-in selesai' : 'Klik Issue Boarding Pass';
  }
}

/* ── Clear workspace ────────────────────────────────────────────────────────── */
function clearWorkspace() {
  _currentPax    = null;
  _currentFlight = null;
  _currentStep   = 0;
  _pendingSeat   = null;

  document.getElementById('search-input').value = '';
  document.getElementById('flight-info-card').innerHTML = '';
  document.getElementById('pax-info-card').innerHTML    = '';
  document.getElementById('status-panel').innerHTML     = '';
  document.getElementById('seatmap-render-area').innerHTML = '';

  setStep(0);
  document.getElementById('idle-msg').textContent = 'Masukkan Kode Booking untuk memulai check-in.';
}

/* ── Utilities ──────────────────────────────────────────────────────────────── */
function formatTime(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit', hour12:false });
  } catch { return '—'; }
}

// ── Mobile Responsive ──
function toggleSidebar() {
  const panel = document.querySelector('.left-panel');
  if (panel) panel.classList.toggle('open');
}
