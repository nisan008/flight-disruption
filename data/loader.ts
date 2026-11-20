import {
  Dataset,
  Airport,
  Flight,
  Aircraft,
  Connection,
  Crew,
  Spare,
  TimeMinutes,
} from '../engine/types';

export interface DataHealthIssue {
  severity: 'error' | 'warning' | 'info';
  category: string;
  message: string;
  relatedIds?: string[];
}

export interface DataHealthReport {
  isValid: boolean;
  issues: DataHealthIssue[];
  stats: {
    airports: number;
    flights: number;
    aircraft: number;
    connections: number;
    crews: number;
    spares: number;
  };
}

/**
 * Convert time representation (number or "HH:MM") to TimeMinutes
 */
function toMinutes(val: unknown, fallback: number = 0): TimeMinutes {
  if (typeof val === 'number') return Math.max(0, Math.min(1439, Math.round(val)));
  if (typeof val === 'string') {
    const parts = val.trim().split(':');
    if (parts.length === 2) {
      const h = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      if (!isNaN(h) && !isNaN(m)) {
        return Math.max(0, Math.min(1439, h * 60 + m));
      }
    }
    const num = Number(val);
    if (!isNaN(num)) return Math.max(0, Math.min(1439, Math.round(num)));
  }
  return fallback;
}

/**
 * Normalizes any raw dataset input into typed Dataset
 */
export function loadDataset(raw: any): { dataset: Dataset; health: DataHealthReport } {
  if (!raw || typeof raw !== 'object') {
    return {
      dataset: { airports: [], flights: [], aircraft: [], connections: [], crews: [], spares: [] },
      health: {
        isValid: false,
        issues: [{ severity: 'error', category: 'Root', message: 'Dataset input is null or not an object' }],
        stats: { airports: 0, flights: 0, aircraft: 0, connections: 0, crews: 0, spares: 0 },
      },
    };
  }

  // 1. Airports
  const rawAirports = Array.isArray(raw.airports) ? raw.airports : [];
  const airports: Airport[] = rawAirports.map((a: any, idx: number) => ({
    code: String(a.code || a.id || a.iata || `APT${idx}`).toUpperCase().trim(),
    name: String(a.name || a.airportName || a.city || a.code || `Airport ${idx}`),
    city: String(a.city || a.location || a.name || 'Unknown City'),
    lat: Number(a.lat ?? a.latitude ?? 20.0),
    lng: Number(a.lng ?? a.longitude ?? 78.0),
  }));

  // 2. Flights
  const rawFlights = Array.isArray(raw.flights) ? raw.flights : [];
  const flights: Flight[] = rawFlights.map((f: any, idx: number) => ({
    id: String(f.id || f.flightId || f.flightNumber || f.flight_number || `FL-${idx + 1}`),
    aircraftId: String(f.aircraftId || f.aircraft_id || f.tailNumber || f.tail_number || ''),
    origin: String(f.origin || f.from || f.dep || f.departureAirport || '').toUpperCase().trim(),
    destination: String(f.destination || f.to || f.arr || f.arrivalAirport || '').toUpperCase().trim(),
    scheduledDeparture: toMinutes(f.scheduledDeparture ?? f.scheduled_departure ?? f.std ?? f.depTime),
    scheduledArrival: toMinutes(f.scheduledArrival ?? f.scheduled_arrival ?? f.sta ?? f.arrTime),
    passengerCount: Number(f.passengerCount ?? f.passenger_count ?? f.pax ?? f.passengers ?? 150),
    sequenceInRotation: Number(f.sequenceInRotation ?? f.sequence_in_rotation ?? f.sequence ?? f.leg ?? 0),
    crewId: String(f.crewId || f.crew_id || f.crew || ''),
  }));

  // 3. Aircraft
  const rawAircraft = Array.isArray(raw.aircraft) ? raw.aircraft : [];
  const aircraft: Aircraft[] = rawAircraft.map((ac: any, idx: number) => {
    const id = String(ac.id || ac.aircraftId || ac.tailNumber || `AC-${idx + 1}`);
    // If rotation list is not provided, deduce from flights with matching aircraftId sorted by sequence / departure
    let rotation = Array.isArray(ac.rotation) ? ac.rotation.map(String) : [];
    if (rotation.length === 0) {
      rotation = flights
        .filter((fl) => fl.aircraftId === id)
        .sort((a, b) => a.sequenceInRotation - b.sequenceInRotation || a.scheduledDeparture - b.scheduledDeparture)
        .map((fl) => fl.id);
    }
    const baseAirport = String(
      ac.baseAirport || ac.base_airport || ac.base || (flights.find((fl) => fl.aircraftId === id)?.origin) || 'BOM'
    ).toUpperCase().trim();

    return {
      id,
      type: String(ac.type || ac.model || 'A320'),
      rotation,
      baseAirport,
    };
  });

  // If flights specify aircraft that aren't in the aircraft list, auto-synthesize them
  const existingAircraftIds = new Set(aircraft.map((ac) => ac.id));
  flights.forEach((fl) => {
    if (fl.aircraftId && !existingAircraftIds.has(fl.aircraftId)) {
      existingAircraftIds.add(fl.aircraftId);
      const acFlights = flights.filter((f) => f.aircraftId === fl.aircraftId);
      aircraft.push({
        id: fl.aircraftId,
        type: 'A320',
        rotation: acFlights.map((f) => f.id),
        baseAirport: acFlights[0]?.origin || 'BOM',
      });
    }
  });

  // 4. Connections
  const rawConnections = Array.isArray(raw.connections) ? raw.connections : [];
  const connections: Connection[] = rawConnections.map((c: any, idx: number) => ({
    id: String(c.id || c.connectionId || `CONN-${idx + 1}`),
    feederFlightId: String(c.feederFlightId || c.feeder_flight_id || c.inbound || c.fromFlight || ''),
    onwardFlightId: String(c.onwardFlightId || c.onward_flight_id || c.outbound || c.toFlight || ''),
    passengerCount: Number(c.passengerCount ?? c.passenger_count ?? c.pax ?? 15),
    minimumConnectTime: Number(c.minimumConnectTime ?? c.minimum_connect_time ?? c.mct ?? 45),
    connectionAirport: String(c.connectionAirport || c.connection_airport || c.airport || '').toUpperCase().trim(),
  }));

  // 5. Crews
  const rawCrews = Array.isArray(raw.crews) ? raw.crews : [];
  const crews: Crew[] = rawCrews.map((cr: any, idx: number) => {
    const id = String(cr.id || cr.crewId || `CREW-${idx + 1}`);
    let flightIds = Array.isArray(cr.flightIds || cr.flights) ? (cr.flightIds || cr.flights).map(String) : [];
    if (flightIds.length === 0) {
      flightIds = flights.filter((fl) => fl.crewId === id).map((fl) => fl.id);
    }
    const dutyStartTime = toMinutes(cr.dutyStartTime ?? cr.duty_start_time ?? cr.start ?? 300);
    return {
      id,
      flightIds,
      dutyStartTime,
      maxDutyMinutes: Number(cr.maxDutyMinutes ?? cr.max_duty_minutes ?? cr.maxDuty ?? 660),
      baseAirport: String(cr.baseAirport || cr.base_airport || cr.base || 'BOM').toUpperCase().trim(),
    };
  });

  // 6. Spares
  const rawSpares = Array.isArray(raw.spares) ? raw.spares : [];
  const spares: Spare[] = rawSpares.map((sp: any, idx: number) => ({
    aircraftId: String(sp.aircraftId || sp.aircraft_id || sp.id || `SPARE-${idx + 1}`),
    airport: String(sp.airport || sp.location || sp.base || 'BOM').toUpperCase().trim(),
    availableFrom: toMinutes(sp.availableFrom ?? sp.available_from ?? sp.from ?? 360),
    type: String(sp.type || sp.model || 'A320'),
  }));

  const dataset: Dataset = { airports, flights, aircraft, connections, crews, spares };
  const health = validateDataset(dataset);

  return { dataset, health };
}

/**
 * Validate dataset integrity and health
 */
export function validateDataset(dataset: Dataset): DataHealthReport {
  const issues: DataHealthIssue[] = [];
  const airportCodes = new Set(dataset.airports.map((a) => a.code));
  const flightMap = new Map(dataset.flights.map((f) => [f.id, f]));
  const aircraftMap = new Map(dataset.aircraft.map((ac) => [ac.id, ac]));
  const crewMap = new Map(dataset.crews.map((c) => [c.id, c]));

  // Check 1: Duplicate flight IDs
  const seenFlightIds = new Set<string>();
  dataset.flights.forEach((f) => {
    if (seenFlightIds.has(f.id)) {
      issues.push({
        severity: 'error',
        category: 'Flights',
        message: `Duplicate flight ID: ${f.id}`,
        relatedIds: [f.id],
      });
    }
    seenFlightIds.add(f.id);
  });

  // Check 2: Orphan flights (aircraft ID not in aircraft list)
  dataset.flights.forEach((f) => {
    if (!f.aircraftId || !aircraftMap.has(f.aircraftId)) {
      issues.push({
        severity: 'error',
        category: 'Flights',
        message: `Flight ${f.id} has invalid or unassigned aircraft: "${f.aircraftId}"`,
        relatedIds: [f.id],
      });
    }
  });

  // Check 3: Invalid Airport references
  dataset.flights.forEach((f) => {
    if (!airportCodes.has(f.origin)) {
      issues.push({
        severity: 'error',
        category: 'Routes',
        message: `Flight ${f.id} origin "${f.origin}" is not in airports list`,
        relatedIds: [f.id, f.origin],
      });
    }
    if (!airportCodes.has(f.destination)) {
      issues.push({
        severity: 'error',
        category: 'Routes',
        message: `Flight ${f.id} destination "${f.destination}" is not in airports list`,
        relatedIds: [f.id, f.destination],
      });
    }
    if (f.origin === f.destination) {
      issues.push({
        severity: 'warning',
        category: 'Routes',
        message: `Flight ${f.id} has same origin and destination: ${f.origin}`,
        relatedIds: [f.id],
      });
    }
  });

  // Check 4: Chronological flight order (departure before arrival)
  dataset.flights.forEach((f) => {
    if (f.scheduledDeparture >= f.scheduledArrival) {
      issues.push({
        severity: 'error',
        category: 'Schedule',
        message: `Flight ${f.id} departure (${f.scheduledDeparture}) >= arrival (${f.scheduledArrival})`,
        relatedIds: [f.id],
      });
    }
    if (f.passengerCount <= 0) {
      issues.push({
        severity: 'warning',
        category: 'Passengers',
        message: `Flight ${f.id} has 0 or negative passengers (${f.passengerCount})`,
        relatedIds: [f.id],
      });
    }
  });

  // Check 5: Aircraft Rotations and Turnarounds
  dataset.aircraft.forEach((ac) => {
    const rotationFlights = ac.rotation
      .map((fId) => flightMap.get(fId))
      .filter((f): f is Flight => f !== undefined);

    for (let i = 0; i < rotationFlights.length - 1; i++) {
      const current = rotationFlights[i];
      const next = rotationFlights[i + 1];

      // Route continuity: current destination must equal next origin
      if (current.destination !== next.origin) {
        issues.push({
          severity: 'error',
          category: 'Rotations',
          message: `Aircraft ${ac.id} route mismatch: ${current.id} lands at ${current.destination} but next flight ${next.id} departs from ${next.origin}`,
          relatedIds: [ac.id, current.id, next.id],
        });
      }

      // Turnaround time: next departure - current arrival >= 30 min
      const turnaround = next.scheduledDeparture - current.scheduledArrival;
      if (turnaround < 30) {
        issues.push({
          severity: turnaround < 0 ? 'error' : 'warning',
          category: 'Turnarounds',
          message: `Aircraft ${ac.id}: Tight/impossible turnaround of ${turnaround}m between ${current.id} and ${next.id} (min recommended: 30m)`,
          relatedIds: [ac.id, current.id, next.id],
        });
      }
    }
  });

  // Check 6: Connections
  dataset.connections.forEach((conn) => {
    const feeder = flightMap.get(conn.feederFlightId);
    const onward = flightMap.get(conn.onwardFlightId);

    if (!feeder) {
      issues.push({
        severity: 'error',
        category: 'Connections',
        message: `Connection ${conn.id}: Feeder flight "${conn.feederFlightId}" not found`,
        relatedIds: [conn.id],
      });
    }
    if (!onward) {
      issues.push({
        severity: 'error',
        category: 'Connections',
        message: `Connection ${conn.id}: Onward flight "${conn.onwardFlightId}" not found`,
        relatedIds: [conn.id],
      });
    }

    if (feeder && onward) {
      // Connect airport mismatch
      if (feeder.destination !== onward.origin) {
        issues.push({
          severity: 'error',
          category: 'Connections',
          message: `Connection ${conn.id}: Location mismatch. Feeder arrives at ${feeder.destination}, onward departs from ${onward.origin}`,
          relatedIds: [conn.id, feeder.id, onward.id],
        });
      }
      // Scheduled connect time check
      const buffer = onward.scheduledDeparture - feeder.scheduledArrival;
      if (buffer < conn.minimumConnectTime) {
        issues.push({
          severity: 'warning',
          category: 'Connections',
          message: `Connection ${conn.id}: Scheduled connect time (${buffer}m) is less than minimum connect time (${conn.minimumConnectTime}m)`,
          relatedIds: [conn.id, feeder.id, onward.id],
        });
      }
    }
  });

  // Check 7: Crews
  dataset.crews.forEach((cr) => {
    cr.flightIds.forEach((fId) => {
      if (!flightMap.has(fId)) {
        issues.push({
          severity: 'warning',
          category: 'Crews',
          message: `Crew ${cr.id} is assigned to non-existent flight "${fId}"`,
          relatedIds: [cr.id, fId],
        });
      }
    });
  });

  // Check 8: Spares
  dataset.spares.forEach((sp) => {
    if (!airportCodes.has(sp.airport)) {
      issues.push({
        severity: 'error',
        category: 'Spares',
        message: `Spare aircraft ${sp.aircraftId} parked at unknown airport "${sp.airport}"`,
        relatedIds: [sp.aircraftId, sp.airport],
      });
    }
  });

  const errorCount = issues.filter((i) => i.severity === 'error').length;

  return {
    isValid: errorCount === 0,
    issues,
    stats: {
      airports: dataset.airports.length,
      flights: dataset.flights.length,
      aircraft: dataset.aircraft.length,
      connections: dataset.connections.length,
      crews: dataset.crews.length,
      spares: dataset.spares.length,
    },
  };
}
