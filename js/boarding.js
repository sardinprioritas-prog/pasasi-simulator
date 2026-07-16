/**
 * AeroCheck Simulator — Boarding Pass Generator
 * Generates a print-ready boarding pass for a checked-in passenger.
 */

const BoardingPass = (() => {

  const EXCESS_RATE = 50000; // IDR per kg

  // ── QR code (fake, CSS-based) ─────────────────────────────────────────────
  function generateQR(seed) {
    // Pseudo-random pattern based on seed string
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash << 5) - hash + seed.charCodeAt(i);
      hash |= 0;
    }

    const SIZE = 7;
    const cells = [];
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        // Fixed corner finder patterns
        const inTL = (r < 3 && c < 3) || (r === 0 || c === 0 || r === 2 || c === 2) && r <= 2 && c <= 2;
        const inTR = (r < 3 && c > SIZE-4) || (r === 0 || c === SIZE-1 || r === 2 || c === SIZE-3) && r <= 2 && c >= SIZE-3;
        const inBL = (r > SIZE-4 && c < 3) || (r === SIZE-1 || c === 0 || r === SIZE-3 || c === 2) && r >= SIZE-3 && c <= 2;

        let isBlack;
        if (inTL || inTR || inBL) {
          // Finder pattern — solid borders
          isBlack = (r === 0 || r === 2 || c === 0 || c === 2 ||
                    (r >= SIZE-3 && c <= 2 && (r === SIZE-1 || r === SIZE-3 || c === 0 || c === 2)));
        } else {
          const bit = ((hash >> ((r * SIZE + c) % 29)) & 1);
          isBlack = bit === 0;
        }
        cells.push(isBlack ? 'b' : 'w');
      }
    }
    return cells;
  }

  // ── Barcode (fake, CSS bars) ──────────────────────────────────────────────
  function generateBarcode(seed) {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = ((hash << 3) ^ seed.charCodeAt(i)) | 0;
    }

    const bars = [];
    // Fixed start/end guards
    bars.push({ w: 1, h: 42 }, { w: 3, h: 42 }, { w: 1, h: 42 });
    for (let i = 0; i < 40; i++) {
      const bit = (hash >> (i % 29)) & 1;
      bars.push({ w: bit ? 2 : 1, h: 30 + (i % 3) * 4 });
    }
    bars.push({ w: 1, h: 42 }, { w: 3, h: 42 }, { w: 1, h: 42 });
    return bars;
  }

  // ── Format helpers ────────────────────────────────────────────────────────
  function formatBoardingTime(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });
    } catch { return '—'; }
  }

  function formatDateShort(iso) {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
      return `${String(d.getDate()).padStart(2,'0')}${months[d.getMonth()]}${String(d.getFullYear()).slice(2)}`;
    } catch { return '—'; }
  }

  function formatCurrency(amount) {
    return 'Rp ' + amount.toLocaleString('id-ID');
  }

  // ── Sequence number (simulated) ───────────────────────────────────────────
  async function getSequenceNum(flightId) {
    const paxAll = await DB.getFlightPassengers(flightId);
    const pax = paxAll.filter(p => p.checkedIn);
    return String(pax.length + 1).padStart(3, '0');
  }

  // ── Generate the boarding pass HTML ──────────────────────────────────────
  async function generateHTML(passenger, flight) {
    const paxName  = `${passenger.title} ${passenger.lastName}/${passenger.firstName}`;
    const seatNum  = passenger.seatNumber || '—';
    const cabinFull = passenger.cabinClass === 'C' ? 'BUSINESS' : 'ECONOMY';
    const cabinCode = passenger.cabinClass === 'C' ? 'C' : 'Y';
    const seqNum   = await getSequenceNum(flight.id);
    const boardingTime = formatBoardingTime(flight.boardingTime);
    const flightDate   = formatDateShort(flight.std);
    const stdTime      = formatBoardingTime(flight.std);

    const barcodeData = `${passenger.pnr}${seatNum}${flight.flightNumber}`;
    const qrCells     = generateQR(barcodeData);
    const barBars     = generateBarcode(barcodeData);

    const excessInfo = passenger.excessBaggage > 0
      ? `<div style="margin-top:0.5rem;padding:0.4rem 0.65rem;background:#fff3cd;border-radius:4px;font-size:0.65rem;color:#856404;font-weight:600;">
           ⚠ EXCESS BAGGAGE: ${passenger.excessBaggage} kg · ${formatCurrency(passenger.excessBaggage * EXCESS_RATE)}
         </div>`
      : '';

    const ssrTags = (passenger.ssr || []).length
      ? `<div style="margin-top:0.5rem;display:flex;gap:0.3rem;flex-wrap:wrap;">
           ${passenger.ssr.map(s =>
             `<span style="padding:0.1rem 0.35rem;background:#e8f0fe;border-radius:3px;font-size:0.6rem;font-weight:700;color:#1a4099;letter-spacing:0.08em;">${s}</span>`
           ).join('')}
         </div>` : '';

    // QR code grid
    const qrHtml = qrCells.map((c, i) =>
      `<div class="bp-qr-cell ${c}"></div>`
    ).join('');

    // Barcode
    const barcodeHtml = barBars.map(b =>
      `<div class="bc-bar" style="width:${b.w}px;height:${b.h}px;"></div>`
    ).join('');

    // Barcode number string
    const barcodeNum = `${passenger.pnr} ${flight.flightNumber.replace('-','')} ${seatNum.padEnd(4)} ${seqNum} ${flight.origin}${flight.destination}`;

    let finalHtml = `
    <div class="boarding-pass" id="boarding-pass-printable">
      <!-- Header -->
      <div class="bp-header">
        <div>
          <div class="bp-airline-name">✈ TRIESAKTI AIR</div>
          <div class="bp-airline-sub">TRIESAKTI AIR — PASSENGER SERVICE</div>
        </div>
        <div style="text-align:right;">
          <div class="bp-type">BOARDING PASS</div>
          <div style="font-size:0.65rem;color:rgba(255,255,255,0.4);margin-top:0.25rem;letter-spacing:0.08em;">FOR TRAINING USE ONLY</div>
        </div>
      </div>

      <!-- Main body -->
      <div class="bp-main">
        <!-- Left side -->
        <div class="bp-left">
          <div class="bp-pnr-label">PASSENGER NAME</div>
          <div class="bp-passenger-name">${paxName}</div>
          <div style="margin-top:0.4rem;display:flex;align-items:center;gap:0.75rem;">
            <div>
              <div class="bp-pnr-label">BOOKING REFERENCE</div>
              <div class="bp-pnr-val">${passenger.pnr}</div>
            </div>
            ${(passenger.ssr||[]).length ? `<div>${ssrTags}</div>` : ''}
          </div>

          <!-- Route -->
          <div class="bp-route-row">
            <div>
              <div class="bp-iata">${flight.origin}</div>
              <div class="bp-city">${flight.originCity || '—'}</div>
            </div>
            <div class="bp-flight-arrow">
              <div class="bp-fa-fn">✈ ${flight.flightNumber}</div>
              <div class="bp-fa-line"></div>
              <div style="font-size:0.6rem;color:#8090a8;">${flight.aircraft}</div>
            </div>
            <div style="text-align:right;">
              <div class="bp-iata">${flight.destination}</div>
              <div class="bp-city">${flight.destinationCity || '—'}</div>
            </div>
          </div>

          <!-- Details grid -->
          <div class="bp-details-grid">
            <div class="bp-detail-item">
              <div class="bd-label">DATE</div>
              <div class="bd-val">${flightDate}</div>
            </div>
            <div class="bp-detail-item">
              <div class="bd-label">STD</div>
              <div class="bd-val">${stdTime}</div>
            </div>
            <div class="bp-detail-item">
              <div class="bd-label">BOARDING</div>
              <div class="bd-val">${boardingTime}</div>
            </div>
            <div class="bp-detail-item">
              <div class="bd-label">GATE</div>
              <div class="bd-val">${flight.gate || '—'}</div>
            </div>
            <div class="bp-detail-item">
              <div class="bd-label">TERMINAL</div>
              <div class="bd-val">${flight.terminal || '—'}</div>
            </div>
            <div class="bp-detail-item">
              <div class="bd-label">SEQUENCE</div>
              <div class="bd-val">${seqNum}</div>
            </div>
          </div>

          ${excessInfo}
        </div>

        <!-- Right side -->
        <div class="bp-right">
          <div class="bp-seat-display">
            <div class="bp-seat-label">SEAT</div>
            <div class="bp-seat-num">${seatNum}</div>
            <div class="bp-seat-class">${cabinFull} · ${cabinCode}</div>
          </div>

          <div class="bp-mini-details">
            <div class="bp-mini-item">
              <span class="bp-mini-label">BAGGAGE</span>
              <span class="bp-mini-val">${passenger.baggageWeight > 0 ? passenger.baggageWeight + ' KG' : '—'}</span>
            </div>
            <div class="bp-mini-item">
              <span class="bp-mini-label">PIECES</span>
              <span class="bp-mini-val">${passenger.baggageItems > 0 ? passenger.baggageItems : '—'}</span>
            </div>
            <div class="bp-mini-item">
              <span class="bp-mini-label">FBA</span>
              <span class="bp-mini-val">${passenger.fba} KG</span>
            </div>
          </div>

          <!-- QR Code -->
          <div class="bp-qr">${qrHtml}</div>
        </div>
      </div>

      <!-- Barcode -->
      <div class="bp-barcode-section">
        <div class="bp-barcode">${barcodeHtml}</div>
        <div class="bp-barcode-num">${barcodeNum}</div>
      </div>

      <!-- Footer -->
      <div class="bp-footer">
        <div class="bp-footer-text">TRIESAKTI AIR — ${flight.flightNumber} — ${flightDate} — VALID FOR ONE JOURNEY ONLY</div>
        <div class="bp-footer-sim">⚠ SIMULATOR — NOT FOR ACTUAL TRAVEL</div>
      </div>
    </div>`;

    if (passenger.excessBaggage > 0 && passenger.excessPaid) {
      const fee = (passenger.excessBaggage * EXCESS_RATE).toLocaleString('id-ID');
      const dateObj = new Date();
      const printDate = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
      const printTime = dateObj.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      
      finalHtml += `
      <div class="excess-receipt" style="width:100%; max-width:800px; margin: 2rem auto; border:2px dashed #8090a8; padding:1.5rem; background:#fff; color:#1a1a2e; font-family:monospace; page-break-inside:avoid; position:relative; border-radius:8px; box-sizing:border-box;">
        <div style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%) rotate(-15deg); font-size:6rem; color:rgba(0,230,118,0.08); font-weight:900; pointer-events:none; z-index:1; border:8px solid rgba(0,230,118,0.08); border-radius:12px; padding:0 20px;">PAID</div>
        <div style="text-align:center; margin-bottom:1.5rem; position:relative; z-index:2;">
          <div style="font-size:1.5rem; font-weight:900; letter-spacing:0.05em;">✈ TRIESAKTI AIR</div>
          <div style="font-size:1rem; font-weight:700; color:#8090a8; margin-top:0.25rem;">EXCESS BAGGAGE RECEIPT</div>
        </div>
        
        <div style="display:flex; justify-content:space-between; margin-bottom:1rem; position:relative; z-index:2;">
          <div>
            <div style="font-size:0.75rem; color:#8090a8;">PASSENGER NAME</div>
            <div style="font-size:1.1rem; font-weight:700;">${paxName}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:0.75rem; color:#8090a8;">PNR</div>
            <div style="font-size:1.2rem; font-weight:900; color:#1a4099;">${passenger.pnr}</div>
          </div>
        </div>
        
        <div style="display:flex; justify-content:space-between; margin-bottom:1rem; position:relative; z-index:2;">
          <div>
            <div style="font-size:0.75rem; color:#8090a8;">FLIGHT</div>
            <div style="font-size:1rem; font-weight:700;">${flight.flightNumber}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:0.75rem; color:#8090a8;">DATE / TIME</div>
            <div style="font-size:1rem; font-weight:700;">${printDate} ${printTime}</div>
          </div>
        </div>
        
        <div style="border-top:1px dashed #ccc; border-bottom:1px dashed #ccc; padding:1rem 0; margin-bottom:1rem; position:relative; z-index:2;">
          <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem; font-size:0.9rem;">
            <div>FREE BAGGAGE ALLOWANCE</div>
            <div style="font-weight:700;">${passenger.fba} KG</div>
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem; font-size:0.9rem;">
            <div>ACTUAL WEIGHT (${passenger.baggageItems} PIECE${passenger.baggageItems > 1 ? 'S' : ''})</div>
            <div style="font-weight:700;">${passenger.baggageWeight} KG</div>
          </div>
          <div style="display:flex; justify-content:space-between; color:#d32f2f; margin-top:0.75rem; font-size:1rem;">
            <div>EXCESS WEIGHT</div>
            <div style="font-weight:900;">${passenger.excessBaggage} KG</div>
          </div>
        </div>
        
        <div style="display:flex; justify-content:space-between; align-items:center; position:relative; z-index:2;">
          <div style="font-size:1.2rem; font-weight:900;">TOTAL PAID</div>
          <div style="font-size:1.5rem; font-weight:900; color:#00e676;">IDR ${fee}</div>
        </div>
      </div>`;
    }
    
    return finalHtml;
  }

  // ── Public API ────────────────────────────────────────────────────────────
  async function show(passenger, flight) {
    const overlay = document.getElementById('boarding-pass-overlay');
    document.getElementById('bp-content').innerHTML = await generateHTML(passenger, flight);
    overlay.classList.remove('hidden');
  }

  function hide() {
    document.getElementById('boarding-pass-overlay').classList.add('hidden');
  }

  function print() {
    window.print();
  }

  return { show, hide, print, EXCESS_RATE };
})();
