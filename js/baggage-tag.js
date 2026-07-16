/**
 * AeroCheck Simulator — Baggage Tag Generator
 * Generates print-ready baggage tags for checked-in passengers with baggage.
 */

const BaggageTag = (() => {

  // ── Barcode (fake, CSS bars) ──────────────────────────────────────────────
  function generateBarcode(seed) {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = ((hash << 3) ^ seed.charCodeAt(i)) | 0;
    }

    const bars = [];
    bars.push({ w: 2, h: 42 }, { w: 4, h: 42 }, { w: 2, h: 42 });
    for (let i = 0; i < 40; i++) {
      const bit = (hash >> (i % 29)) & 1;
      bars.push({ w: bit ? 3 : 1.5, h: 42 });
    }
    bars.push({ w: 2, h: 42 }, { w: 4, h: 42 }, { w: 2, h: 42 });
    return bars;
  }

  // ── Generate the Baggage Tag HTML ─────────────────────────────────────────
  function generateHTML(passenger, flight, itemIndex, totalItems, weight) {
    const paxName  = `${passenger.title} ${passenger.lastName}/${passenger.firstName}`;
    
    let dateStr = '—';
    try {
      const d = new Date(flight.std);
      const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
      dateStr = `${String(d.getDate()).padStart(2,'0')}${months[d.getMonth()]}${String(d.getFullYear()).slice(2)}`;
    } catch(e) {}

    const tagNum = `${passenger.pnr}-${String(itemIndex).padStart(2, '0')}`;
    const barcodeData = `${passenger.pnr}${flight.flightNumber}${itemIndex}`;
    const barBars = generateBarcode(barcodeData);
    
    const barcodeHtml = barBars.map(b =>
      `<div class="bc-bar" style="width:${b.w}px;height:${b.h}px;background:#1a1a2e;border-radius:1px 1px 0 0;"></div>`
    ).join('');

    return `
    <div class="baggage-tag" style="width: 320px; border: 1px solid #ccc; border-radius: 8px; padding: 1.2rem; margin: 10px auto; background: #fff; color: #1a1a2e; font-family: monospace; page-break-inside: avoid; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
      <!-- Header -->
      <div style="display:flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #1a1a2e; padding-bottom: 0.5rem; margin-bottom: 1rem;">
        <div style="font-weight: 800; font-size: 1.1rem; letter-spacing: 0.05em;">✈ TRIESAKTI AIR</div>
        <div style="font-size: 0.75rem; letter-spacing: 0.1em; color: #8090a8; font-weight: 700;">BAGGAGE TAG</div>
      </div>
      
      <!-- Destination -->
      <div style="font-size: 3rem; font-weight: 900; text-align: center; margin: 1rem 0; line-height: 1; letter-spacing: 0.05em;">
        ${flight.destination}
      </div>
      
      <!-- Details Row 1 -->
      <div style="display: flex; justify-content: space-between; margin-bottom: 1rem;">
        <div>
          <div style="font-size: 0.65rem; color: #8090a8; letter-spacing: 0.1em;">FLIGHT</div>
          <div style="font-weight: 800; font-size: 1.2rem;">${flight.flightNumber}</div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 0.65rem; color: #8090a8; letter-spacing: 0.1em;">DATE</div>
          <div style="font-weight: 800; font-size: 1.2rem;">${dateStr}</div>
        </div>
      </div>
      
      <!-- Details Row 2 -->
      <div style="margin-bottom: 1rem;">
        <div style="font-size: 0.65rem; color: #8090a8; letter-spacing: 0.1em;">NAME</div>
        <div style="font-weight: 700; font-size: 1rem;">${paxName}</div>
      </div>
      
      <!-- Details Row 3 -->
      <div style="display: flex; justify-content: space-between; margin-bottom: 1.5rem;">
        <div>
          <div style="font-size: 0.65rem; color: #8090a8; letter-spacing: 0.1em;">PNR</div>
          <div style="font-weight: 800; font-size: 1.1rem; color: #1a4099;">${passenger.pnr}</div>
        </div>
        <div style="text-align: center;">
          <div style="font-size: 0.65rem; color: #8090a8; letter-spacing: 0.1em;">WEIGHT</div>
          <div style="font-weight: 800; font-size: 1.1rem;">${weight ? weight + ' KG' : '—'}</div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 0.65rem; color: #8090a8; letter-spacing: 0.1em;">ITEM</div>
          <div style="font-weight: 800; font-size: 1.1rem;">${itemIndex} OF ${totalItems}</div>
        </div>
      </div>
      
      <!-- Barcode -->
      <div style="display: flex; justify-content: center; gap: 1px; margin-bottom: 0.5rem; height: 42px; align-items: flex-end;">
        ${barcodeHtml}
      </div>
      
      <!-- Tag Number -->
      <div style="text-align: center; font-size: 0.85rem; letter-spacing: 0.2em; font-weight: 800; color: #8090a8;">
        ${tagNum}
      </div>
    </div>
    `;
  }

  // ── Public API ────────────────────────────────────────────────────────────
  function show(passenger, flight) {
    if (!passenger.baggageItems || passenger.baggageItems <= 0) {
      toast('Penumpang tidak memiliki bagasi tercatat.', 'warning');
      return;
    }
    
    let html = '<div style="display: flex; flex-direction: column; gap: 20px; overflow-y: auto; max-height: calc(100vh - 120px); padding: 20px;">';
    for (let i = 1; i <= passenger.baggageItems; i++) {
      const weight = (passenger.baggageDetails && passenger.baggageDetails[i-1]) ? passenger.baggageDetails[i-1] : null;
      html += generateHTML(passenger, flight, i, passenger.baggageItems, weight);
    }
    html += '</div>';
    
    document.getElementById('bt-content').innerHTML = html;
    document.getElementById('baggage-tag-overlay').classList.remove('hidden');
  }

  function hide() {
    document.getElementById('baggage-tag-overlay').classList.add('hidden');
  }

  function print() {
    window.print();
  }

  return { show, hide, print };
})();
