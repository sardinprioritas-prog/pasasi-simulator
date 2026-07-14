/**
 * AeroCheck Simulator — Database Layer
 * Uses Supabase (PostgreSQL) for online persistence.
 */

const DB = (() => {
  const KEYS = {
    FLIGHTS:    'flights',
    PASSENGERS: 'passengers',
    AGENTS:     'agents',
    SEAT_MAPS:  'seat_maps',
    SYSTEM:     'system_state',
  };

  const _id = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 5);

  // ── Seat layout generators ──────────────────────────────────────────────────
  function _generateSeatMap(aircraft) {
    const map = {};

    if (aircraft === 'A320') {
      for (let r = 1; r <= 3; r++) {
        ['A','B','C','D'].forEach(c => {
          map[`${r}${c}`] = { cls: 'C', occupied: false, passengerId: null, emergency: false };
        });
      }
      for (let r = 5; r <= 30; r++) {
        ['A','B','C','D','E','F'].forEach(c => {
          map[`${r}${c}`] = {
            cls: 'Y', occupied: false, passengerId: null,
            emergency: (r === 14 || r === 15),
          };
        });
      }
    } else {
      for (let r = 1; r <= 4; r++) {
        ['A','B','C','D'].forEach(c => {
          map[`${r}${c}`] = { cls: 'C', occupied: false, passengerId: null, emergency: false };
        });
      }
      for (let r = 6; r <= 33; r++) {
        ['A','B','C','D','E','F'].forEach(c => {
          map[`${r}${c}`] = {
            cls: 'Y', occupied: false, passengerId: null,
            emergency: (r === 12 || r === 13),
          };
        });
      }
    }
    return map;
  }

  // ── Public API (Asynchronous) ───────────────────────────────────────────────
  return {
    // Seed flag
    isSeeded: async () => {
      const { data, error } = await supabaseClient.from(KEYS.SYSTEM).select('seeded').eq('id', 'seed_status').maybeSingle();
      return data ? data.seeded : false;
    },
    markSeeded: async () => {
      await supabaseClient.from(KEYS.SYSTEM).upsert({ id: 'seed_status', seeded: true });
    },
    clearAll: async () => {
      // In Supabase, deleting with a valid condition is required, or calling a stored procedure.
      // Since we just want to clear everything, we delete where id is not null.
      await supabaseClient.from(KEYS.PASSENGERS).delete().neq('id', '');
      await supabaseClient.from(KEYS.SEAT_MAPS).delete().neq('id', '');
      await supabaseClient.from(KEYS.FLIGHTS).delete().neq('id', '');
      await supabaseClient.from(KEYS.AGENTS).delete().neq('id', '');
      await supabaseClient.from(KEYS.SYSTEM).delete().eq('id', 'seed_status');
    },

    // ── Flights ─────────────────────────────────────────────────────────────
    getFlights: async () => {
      const { data } = await supabaseClient.from(KEYS.FLIGHTS).select('*');
      return data || [];
    },
    getFlight: async (id) => {
      const { data } = await supabaseClient.from(KEYS.FLIGHTS).select('*').eq('id', id).maybeSingle();
      return data;
    },
    saveFlight: async (flight) => {
      if (!flight.id) {
        flight.id = 'FL' + _id();
        flight.createdAt = new Date().toISOString();
      }
      await supabaseClient.from(KEYS.FLIGHTS).upsert(flight);
      return flight;
    },
    deleteFlight: async (id) => {
      // Cascading deletes on foreign keys will handle passengers and seatmaps in Supabase
      await supabaseClient.from(KEYS.FLIGHTS).delete().eq('id', id);
    },

    // ── Passengers ──────────────────────────────────────────────────────────
    getPassengers: async () => {
      const { data } = await supabaseClient.from(KEYS.PASSENGERS).select('*');
      return data || [];
    },
    getPassenger: async (id) => {
      const { data } = await supabaseClient.from(KEYS.PASSENGERS).select('*').eq('id', id).maybeSingle();
      return data;
    },
    getFlightPassengers: async (fid) => {
      const { data } = await supabaseClient.from(KEYS.PASSENGERS).select('*').eq('flightId', fid);
      return data || [];
    },
    searchPassengers: async (query) => {
      const q = query.toUpperCase().trim();
      if (!q) return [];
      
      const { data } = await supabaseClient.from(KEYS.PASSENGERS)
        .select('*')
        .or(`pnr.ilike.%${q}%,firstName.ilike.%${q}%,lastName.ilike.%${q}%`);
        
      return data || [];
    },
    savePassenger: async (passenger) => {
      if (!passenger.id) {
        passenger.id = 'PAX' + _id();
        passenger.createdAt = new Date().toISOString();
      }
      await supabaseClient.from(KEYS.PASSENGERS).upsert(passenger);
      return passenger;
    },
    deletePassenger: async (id) => {
      await supabaseClient.from(KEYS.PASSENGERS).delete().eq('id', id);
    },
    isPNRUnique: async (pnr, excludeId = null) => {
      const { data } = await supabaseClient.from(KEYS.PASSENGERS).select('id').eq('pnr', pnr.toUpperCase());
      if (!data || data.length === 0) return true;
      let unique = true;
      data.forEach(p => {
        if (p.id !== excludeId) unique = false;
      });
      return unique;
    },

    // ── Agents ──────────────────────────────────────────────────────────────
    getAgents: async () => {
      const { data } = await supabaseClient.from(KEYS.AGENTS).select('*');
      return data || [];
    },
    getAgent: async (id) => {
      const { data } = await supabaseClient.from(KEYS.AGENTS).select('*').eq('id', id).maybeSingle();
      return data;
    },
    getAgentByCredentials: async (agentId, password) => {
      const { data } = await supabaseClient.from(KEYS.AGENTS)
        .select('*')
        .eq('agentId', agentId.toUpperCase())
        .eq('password', password)
        .limit(1)
        .maybeSingle();
      return data; // will be null/undefined if not found
    },
    saveAgent: async (agent) => {
      if (!agent.id) {
        agent.id = 'AGT' + _id();
        agent.createdAt = new Date().toISOString();
      }
      await supabaseClient.from(KEYS.AGENTS).upsert(agent);
      return agent;
    },
    deleteAgent: async (id) => {
      await supabaseClient.from(KEYS.AGENTS).delete().eq('id', id);
    },
    isAgentIdUnique: async (agentId, excludeId = null) => {
      const { data } = await supabaseClient.from(KEYS.AGENTS).select('id').eq('agentId', agentId.toUpperCase());
      if (!data || data.length === 0) return true;
      let unique = true;
      data.forEach(a => {
        if (a.id !== excludeId) unique = false;
      });
      return unique;
    },

    // ── Seat Map ────────────────────────────────────────────────────────────
    initSeatMap: async (flightId, aircraft) => {
      const map = _generateSeatMap(aircraft);
      await supabaseClient.from(KEYS.SEAT_MAPS).upsert({ id: flightId, map_data: map });
      return map;
    },
    getSeatMap: async (flightId) => {
      const { data } = await supabaseClient.from(KEYS.SEAT_MAPS).select('map_data').eq('id', flightId).maybeSingle();
      return data ? data.map_data : {};
    },
    updateSeat: async (flightId, seatNum, seatData) => {
      const { data: doc } = await supabaseClient.from(KEYS.SEAT_MAPS).select('map_data').eq('id', flightId).maybeSingle();
      if (doc) {
        const map = doc.map_data;
        map[seatNum] = seatData;
        await supabaseClient.from(KEYS.SEAT_MAPS).update({ map_data: map }).eq('id', flightId);
      }
    },
    clearSeat: async (flightId, seatNum) => {
      const { data: doc } = await supabaseClient.from(KEYS.SEAT_MAPS).select('map_data').eq('id', flightId).maybeSingle();
      if (doc) {
        const map = doc.map_data;
        if (map[seatNum]) {
          map[seatNum].occupied = false;
          map[seatNum].passengerId = null;
          await supabaseClient.from(KEYS.SEAT_MAPS).update({ map_data: map }).eq('id', flightId);
        }
      }
    },
  };
})();
