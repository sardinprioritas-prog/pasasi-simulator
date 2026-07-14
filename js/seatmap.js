/**
 * AeroCheck Simulator — Interactive Seat Map
 * Renders a visual aircraft cabin layout with B737-800 and A320 support.
 */

const SeatMap = (() => {

  let _flightId   = null;
  let _aircraft   = null;
  let _cabinClass = 'Y';
  let _selected   = null;
  let _onSelect   = null;
  let _containerId = null;

  // ── Layout configs ────────────────────────────────────────────────────────
  const LAYOUTS = {
    'B737-800': {
      businessRows: [1, 2, 3, 4],
      economyRows:  Array.from({ length: 28 }, (_, i) => i + 6),  // 6-33
      businessCols: ['A', 'B', 'C', 'D'],
      economyCols:  ['A', 'B', 'C', 'D', 'E', 'F'],
      businessAisle: 2,  // after col index 2 (B | C)
      economyAisle:  3,  // after col index 3 (C | D)
      emergencyRows: [12, 13],
    },
    'A320': {
      businessRows: [1, 2, 3],
      economyRows:  Array.from({ length: 26 }, (_, i) => i + 5),  // 5-30
      businessCols: ['A', 'B', 'C', 'D'],
      economyCols:  ['A', 'B', 'C', 'D', 'E', 'F'],
      businessAisle: 2,
      economyAisle:  3,
      emergencyRows: [14, 15],
    },
    'ATR72': {
      businessRows: [],
      economyRows:  Array.from({ length: 18 }, (_, i) => i + 1),
      businessCols: [],
      economyCols:  ['A', 'B', 'C', 'D'],
      businessAisle: 0,
      economyAisle:  2,
      emergencyRows: [8],
    },
  };

  function getLayout(aircraft) {
    return LAYOUTS[aircraft] || LAYOUTS['B737-800'];
  }

  // ── Render ────────────────────────────────────────────────────────────────
  async function render(flightId, aircraft, cabinClass, containerId, onSelect) {
    _flightId    = flightId;
    _aircraft    = aircraft;
    _cabinClass  = cabinClass;
    _onSelect    = onSelect;
    _containerId = containerId;

    const container = document.getElementById(containerId);
    if (!container) return;

    const layout  = getLayout(aircraft);
    const seatMap = await DB.getSeatMap(flightId);

    const allRows    = [...layout.businessRows, ...layout.economyRows];
    const businessSet = new Set(layout.businessRows);
    const emergencySet = new Set(layout.emergencyRows);

    // Collect occupied seats into a Set for quick lookup
    const occupiedByPax = {};
    Object.entries(seatMap).forEach(([seatNum, info]) => {
      if (info.occupied) occupiedByPax[seatNum] = info.passengerId;
    });

    // Build HTML
    let html = `<div class="seatmap-container">`;
    html += `<div class="seatmap-legend">
      <span class="legend-item"><span class="legend-box lb-available"></span>Tersedia</span>
      <span class="legend-item"><span class="legend-box lb-occupied"></span>Terisi</span>
      <span class="legend-item"><span class="legend-box lb-selected"></span>Dipilih</span>
      ${layout.businessRows.length ? `<span class="legend-item"><span class="legend-box lb-business"></span>Business</span>` : ''}
      <span class="legend-item"><span class="legend-box lb-emergency"></span>Emergency Exit</span>
    </div>`;

    html += `<div class="aircraft-nose">🛩</div>`;
    html += `<div class="seatmap-scroll"><div class="seatmap-grid" id="seatmap-inner">`;

    let prevIsEcon = false;

    allRows.forEach((rowNum, rowIdx) => {
      const isBusiness = businessSet.has(rowNum);
      const isEconomy  = !isBusiness;
      const cols = isBusiness ? layout.businessCols : layout.economyCols;
      const aisleIdx = isBusiness ? layout.businessAisle : layout.economyAisle;
      const isEmergency = emergencySet.has(rowNum);

      // Column header (first row of each cabin)
      if (rowIdx === 0 || (isEconomy && !prevIsEcon)) {
        // Column headers
        html += `<div class="col-headers" id="col-header-${rowNum}" style="padding-left:${isBusiness?'27px':'27px'}">`;
        cols.forEach((col, i) => {
          if (i === aisleIdx) html += `<span class="col-aisle-h"></span>`;
          html += `<span class="col-header${isBusiness?' business':''}">${col}</span>`;
        });
        html += `</div>`;
      }

      // Cabin divider
      if (isEconomy && !prevIsEcon && layout.businessRows.length > 0) {
        html += `<div class="cabin-divider">✈ ECONOMY CLASS</div>`;
      } else if (isBusiness && rowIdx === 0 && layout.businessRows.length > 0) {
        html += `<div class="cabin-divider">💼 BUSINESS CLASS</div>`;
      }

      prevIsEcon = isEconomy;

      // Seat row
      if (isEmergency) {
        html += `<div style="font-size:0.6rem;color:var(--amber);letter-spacing:0.1em;text-align:center;width:100%;margin:1px 0;opacity:0.7;">⚠ EMERGENCY EXIT ROW ${rowNum}</div>`;
      }

      html += `<div class="seat-row" data-row="${rowNum}">`;
      html += `<span class="row-num">${rowNum}</span>`;

      cols.forEach((col, i) => {
        if (i === aisleIdx) {
          html += `<span class="seat-aisle"></span>`;
        }

        const seatNum  = `${rowNum}${col}`;
        const seatData = seatMap[seatNum] || {};
        const isOcc    = seatData.occupied === true;
        const isBiz    = seatData.cls === 'C' || isBusiness;
        const isEmerg  = seatData.emergency;

        // Disable business seats if passenger is economy and vice versa
        const paxIsEcon = cabinClass === 'Y';
        const isDisabled = (paxIsEcon && isBiz) || (!paxIsEcon && !isBiz);

        let classes = 'seat';
        if (isBiz)      classes += ' business';
        if (isOcc)      classes += ' occupied';
        if (isEmerg)    classes += ' emergency';
        if (isDisabled) classes += ' disabled';

        const tooltip = isOcc ? 'Terisi' : isDisabled ? 'Tidak tersedia untuk kelas ini' : seatNum;
        const clickHandler = (!isOcc && !isDisabled)
          ? `onclick="SeatMap._handleClick('${seatNum}')"` : '';

        html += `<div class="${classes}" id="seat-${seatNum}" data-seat="${seatNum}"
          title="${tooltip}" ${clickHandler}>
          ${isOcc ? '×' : ''}
        </div>`;
      });

      html += `</div>`; // .seat-row
    });

    html += `</div></div></div>`; // .seatmap-grid, .seatmap-scroll, .seatmap-container
    container.innerHTML = html;

    // Highlight previously selected seat
    if (_selected) {
      const el = document.getElementById(`seat-${_selected}`);
      if (el && !el.classList.contains('occupied')) el.classList.add('selected');
    }
  }

  function _handleClick(seatNum) {
    // Deselect previous
    if (_selected) {
      const prev = document.getElementById(`seat-${_selected}`);
      if (prev) prev.classList.remove('selected');
    }

    if (_selected === seatNum) {
      // Clicked same seat = deselect
      _selected = null;
      if (_onSelect) _onSelect(null);
      return;
    }

    _selected = seatNum;
    const el = document.getElementById(`seat-${seatNum}`);
    if (el) el.classList.add('selected');
    if (_onSelect) _onSelect(seatNum);
  }

  function setSelected(seatNum) {
    if (_selected) {
      const prev = document.getElementById(`seat-${_selected}`);
      if (prev) prev.classList.remove('selected');
    }
    _selected = seatNum;
    if (seatNum) {
      const el = document.getElementById(`seat-${seatNum}`);
      if (el) el.classList.add('selected');
    }
  }

  function getSelected() { return _selected; }

  function clearSelection() {
    if (_selected) {
      const el = document.getElementById(`seat-${_selected}`);
      if (el) el.classList.remove('selected');
    }
    _selected = null;
  }

  async function getSeatStats(flightId) {
    const map = await DB.getSeatMap(flightId);
    const total    = Object.keys(map).length;
    const occupied = Object.values(map).filter(s => s.occupied).length;
    return { total, occupied, available: total - occupied };
  }

  return {
    render,
    setSelected,
    getSelected,
    clearSelection,
    getSeatStats,
    _handleClick,  // exposed for onclick
  };
})();
