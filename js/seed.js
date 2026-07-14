/**
 * AeroCheck Simulator — Demo Data Seeder
 * Seeds 2 flights + 15 passengers + 4 user accounts on first launch.
 */

const Seed = {
  async run() {
    if (await DB.isSeeded()) return;

    console.log('%c[AeroCheck] Seeding demo data...', 'color:#00d4ff;font-weight:bold');

    // ── Users ─────────────────────────────────────────────────────────────────
    await DB.saveAgent({ agentId: 'ADMIN',    password: 'admin123', name: 'Instruktur Utama',  role: 'admin' });
    await DB.saveAgent({ agentId: 'AGENT001', password: 'agent123', name: 'Dewi Rahayu',       role: 'agent' });
    await DB.saveAgent({ agentId: 'AGENT002', password: 'agent123', name: 'Bima Pratama',      role: 'agent' });
    await DB.saveAgent({ agentId: 'AGENT003', password: 'agent123', name: 'Sari Indah Lestari',role: 'agent' });

    // ── Flights ───────────────────────────────────────────────────────────────
    const f1 = await DB.saveFlight({
      flightNumber:    'NU-101',
      origin:          'CGK',
      originCity:      'Jakarta',
      originName:      'Soekarno-Hatta Intl Airport',
      destination:     'DPS',
      destinationCity: 'Denpasar',
      destinationName: 'Ngurah Rai Intl Airport',
      std:             '2026-07-14T09:00:00',
      sta:             '2026-07-14T10:20:00',
      boardingTime:    '2026-07-14T08:30:00',
      status:          'ON TIME',
      aircraft:        'B737-800',
      gate:            'G7',
      terminal:        'T3',
      checkInCounter:  'D3 – D6',
    });

    const f2 = await DB.saveFlight({
      flightNumber:    'NU-202',
      origin:          'DPS',
      originCity:      'Denpasar',
      originName:      'Ngurah Rai Intl Airport',
      destination:     'SUB',
      destinationCity: 'Surabaya',
      destinationName: 'Juanda Intl Airport',
      std:             '2026-07-14T13:30:00',
      sta:             '2026-07-14T14:20:00',
      boardingTime:    '2026-07-14T13:00:00',
      status:          'ON TIME',
      aircraft:        'A320',
      gate:            'A12',
      terminal:        'T2',
      checkInCounter:  'B7 – B9',
    });

    // Init seat maps
    await DB.initSeatMap(f1.id, f1.aircraft);
    await DB.initSeatMap(f2.id, f2.aircraft);

    // ── Passengers — Flight 1 (NU-101) ───────────────────────────────────────
    const pax1 = [
      { pnr:'ABC123', title:'MR',  firstName:'BUDI',    lastName:'SANTOSO',   cabinClass:'Y', fba:20, ssr:[] },
      { pnr:'DEF456', title:'MRS', firstName:'SITI',    lastName:'AMINAH',    cabinClass:'Y', fba:20, ssr:['VGML'] },
      { pnr:'GHI789', title:'MR',  firstName:'AHMAD',   lastName:'FAUZI',     cabinClass:'C', fba:30, ssr:[] },
      { pnr:'JKL012', title:'MS',  firstName:'NINA',    lastName:'KUSUMA',    cabinClass:'Y', fba:20, ssr:['WCHR'] },
      { pnr:'MNO345', title:'MR',  firstName:'RUDI',    lastName:'HERMAWAN',  cabinClass:'Y', fba:20, ssr:[] },
      { pnr:'PQR678', title:'MS',  firstName:'DEWI',    lastName:'LESTARI',   cabinClass:'Y', fba:20, ssr:['HNML'] },
      { pnr:'STU901', title:'MR',  firstName:'HENDRA',  lastName:'WIJAYA',    cabinClass:'C', fba:30, ssr:[] },
      { pnr:'VWX234', title:'MRS', firstName:'MAYA',    lastName:'PUTRI',     cabinClass:'Y', fba:20, ssr:[] },
      { pnr:'YZA567', title:'MR',  firstName:'DONI',    lastName:'SETIAWAN',  cabinClass:'Y', fba:20, ssr:[] },
      { pnr:'BCD890', title:'MS',  firstName:'RINA',    lastName:'MARLINA',   cabinClass:'Y', fba:20, ssr:['VGML','BLND'] },
    ];

    for (const p of pax1) {
      await DB.savePassenger({
        ...p, flightId: f1.id,
        seatNumber: null, checkedIn: false,
        baggageItems: 0, baggageWeight: 0, excessBaggage: 0, boardingPassIssued: false,
      });
    }

    // ── Passengers — Flight 2 (NU-202) ───────────────────────────────────────
    const pax2 = [
      { pnr:'EFG123', title:'MR',  firstName:'TONO',    lastName:'SUPARMAN',  cabinClass:'Y', fba:20, ssr:[] },
      { pnr:'HIJ456', title:'MRS', firstName:'WATI',    lastName:'SULISTYO',  cabinClass:'Y', fba:20, ssr:['VGML'] },
      { pnr:'KLM789', title:'MR',  firstName:'BAGUS',   lastName:'PRASETYO',  cabinClass:'C', fba:30, ssr:[] },
      { pnr:'NOP012', title:'MS',  firstName:'FITRI',   lastName:'HANDAYANI', cabinClass:'Y', fba:20, ssr:[] },
      { pnr:'QRS345', title:'MR',  firstName:'YOGA',    lastName:'NUGRAHA',   cabinClass:'Y', fba:20, ssr:['MEDA'] },
    ];

    for (const p of pax2) {
      await DB.savePassenger({
        ...p, flightId: f2.id,
        seatNumber: null, checkedIn: false,
        baggageItems: 0, baggageWeight: 0, excessBaggage: 0, boardingPassIssued: false,
      });
    }

    await DB.markSeeded();
    console.log('%c[AeroCheck] Seed complete! 2 flights, 15 passengers, 4 accounts.', 'color:#00ff88;font-weight:bold');
  },
};
