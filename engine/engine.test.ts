import { describe, it, expect } from 'vitest';
import { SimulationEngine } from './engine';
import { Dataset, FlightStatus, DelayCause, SimulationConfig } from './types';

// Minimal deterministic test dataset
const createTestDataset = (): Dataset => ({
  airports: [
    { code: 'BOM', name: 'Mumbai Airport', city: 'Mumbai', lat: 19.0896, lng: 72.8656 },
    { code: 'DEL', name: 'Delhi Airport', city: 'Delhi', lat: 28.5562, lng: 77.1000 },
    { code: 'BLR', name: 'Bengaluru Airport', city: 'Bengaluru', lat: 13.1986, lng: 77.7066 },
    { code: 'CCU', name: 'Kolkata Airport', city: 'Kolkata', lat: 22.6520, lng: 88.4463 },
  ],
  flights: [
    // Aircraft 1 rotation: BOM -> DEL -> BLR
    {
      id: 'AI-101',
      aircraftId: 'VT-T1',
      origin: 'BOM',
      destination: 'DEL',
      scheduledDeparture: 600, // 10:00
      scheduledArrival: 720,   // 12:00
      passengerCount: 150,
      sequenceInRotation: 0,
      crewId: 'CR-1',
    },
    {
      id: 'AI-102',
      aircraftId: 'VT-T1',
      origin: 'DEL',
      destination: 'BLR',
      scheduledDeparture: 760, // 12:40 (40m turnaround > 30m min)
      scheduledArrival: 900,   // 15:00
      passengerCount: 160,
      sequenceInRotation: 1,
      crewId: 'CR-1',
    },
    // Aircraft 2 rotation: DEL -> CCU
    {
      id: 'AI-201',
      aircraftId: 'VT-T2',
      origin: 'DEL',
      destination: 'CCU',
      scheduledDeparture: 780, // 13:00
      scheduledArrival: 900,   // 15:00
      passengerCount: 140,
      sequenceInRotation: 0,
      crewId: 'CR-2',
    },
  ],
  aircraft: [
    { id: 'VT-T1', type: 'A320', rotation: ['AI-101', 'AI-102'], baseAirport: 'BOM' },
    { id: 'VT-T2', type: 'A320', rotation: ['AI-201'], baseAirport: 'DEL' },
  ],
  connections: [
    {
      id: 'CONN-1',
      feederFlightId: 'AI-101',
      onwardFlightId: 'AI-201',
      passengerCount: 25,
      minimumConnectTime: 45, // AI-101 arr 720, AI-201 dep 780 (buffer 60m > 45m)
      connectionAirport: 'DEL',
    },
  ],
  crews: [
    {
      id: 'CR-1',
      flightIds: ['AI-101', 'AI-102'],
      dutyStartTime: 540, // 09:00
      maxDutyMinutes: 660, // 11 hours (until 1200 / 20:00)
      baseAirport: 'BOM',
    },
    {
      id: 'CR-2',
      flightIds: ['AI-201'],
      dutyStartTime: 720,
      maxDutyMinutes: 660,
      baseAirport: 'DEL',
    },
  ],
  spares: [
    {
      aircraftId: 'SP-1',
      airport: 'DEL',
      availableFrom: 600,
      type: 'A320',
    },
  ],
});

describe('SimulationEngine', () => {
  const defaultConfig: SimulationConfig = {
    cancellationThresholdMinutes: 180,
    minimumTurnaroundMinutes: 30,
    closures: [],
  };

  it('1. Zero-disruption baseline: matches schedule, 0 delays, 0 cancellations', () => {
    const dataset = createTestDataset();
    const engine = new SimulationEngine(dataset);
    const result = engine.simulate(defaultConfig);

    expect(result.kpis.totalFlights).toBe(3);
    expect(result.kpis.delayedFlights).toBe(0);
    expect(result.kpis.cancelledFlights).toBe(0);
    expect(result.kpis.onTimeFlights).toBe(3);
    expect(result.kpis.totalDelayMinutes).toBe(0);
    expect(result.kpis.missedConnections).toBe(0);
    expect(result.kpis.strandedPassengers).toBe(0);
    expect(result.kpis.crewViolations).toBe(0);

    for (const flight of result.flights) {
      expect(flight.status).toBe(FlightStatus.ON_TIME);
      expect(flight.actualDeparture).toBe(flight.scheduledDeparture);
      expect(flight.actualArrival).toBe(flight.scheduledArrival);
      expect(flight.delayMinutes).toBe(0);
      expect(flight.causeChain.length).toBe(0);
    }
  });

  it('2. Determinism: identical outputs across multiple simulation runs', () => {
    const dataset = createTestDataset();
    const engine = new SimulationEngine(dataset);
    const configWithClosure: SimulationConfig = {
      ...defaultConfig,
      closures: [{ airport: 'BOM', startTime: 580, endTime: 660 }], // 60m closure blocks AI-101 departure at 600
    };

    const run1 = engine.simulate(configWithClosure);
    const run2 = engine.simulate(configWithClosure);

    expect(JSON.stringify(run1)).toBe(JSON.stringify(run2));
  });

  it('3. Sum of cause-chain minutes equals total delay for every delayed flight', () => {
    const dataset = createTestDataset();
    const engine = new SimulationEngine(dataset);
    // Closure at BOM blocks departure from 580 to 660 (causes 60m delay on AI-101)
    // AI-101 actual arr becomes 720 + 60 = 780. Turnaround 30m -> AI-102 actual dep 810 (sched 760 -> 50m knock-on)
    const configWithClosure: SimulationConfig = {
      ...defaultConfig,
      closures: [{ airport: 'BOM', startTime: 580, endTime: 660 }],
    };

    const result = engine.simulate(configWithClosure);

    for (const flight of result.flights) {
      if (flight.delayMinutes > 0 && flight.status === FlightStatus.DELAYED) {
        const sumCauseMinutes = flight.causeChain.reduce((sum, link) => sum + link.minutes, 0);
        expect(sumCauseMinutes).toBe(flight.delayMinutes);
      }
    }
  });

  it('4. Propagation & knock-on delays across rotation legs', () => {
    const dataset = createTestDataset();
    const engine = new SimulationEngine(dataset);
    // BOM closed 580-660
    const config: SimulationConfig = {
      ...defaultConfig,
      closures: [{ airport: 'BOM', startTime: 580, endTime: 660 }],
    };

    const result = engine.simulate(config);
    const f1 = result.flights.find((f) => f.flightId === 'AI-101')!;
    const f2 = result.flights.find((f) => f.flightId === 'AI-102')!;

    expect(f1.status).toBe(FlightStatus.DELAYED);
    expect(f1.delayMinutes).toBe(60); // 660 - 600
    expect(f1.causeChain[0].cause).toBe(DelayCause.WEATHER_CLOSURE);

    // f2 is delayed due to rotation knock-on
    expect(f2.status).toBe(FlightStatus.DELAYED);
    expect(f2.delayMinutes).toBe(50); // 810 - 760
    const hasKnockon = f2.causeChain.some((link) => link.cause === DelayCause.ROTATION_KNOCKON);
    expect(hasKnockon).toBe(true);
  });

  it('5. Passenger connections: feeder arrival delay breaks connection', () => {
    const dataset = createTestDataset();
    const engine = new SimulationEngine(dataset);
    // AI-101 arr moves from 720 to 780.
    // AI-201 dep is 780.
    // Available connect time = 780 - 780 = 0 < 45m min connect time -> Missed!
    const config: SimulationConfig = {
      ...defaultConfig,
      closures: [{ airport: 'BOM', startTime: 580, endTime: 660 }],
    };

    const result = engine.simulate(config);
    const conn = result.connections.find((c) => c.connectionId === 'CONN-1')!;

    expect(conn.missed).toBe(true);
    expect(result.kpis.missedConnections).toBe(1);
    expect(result.kpis.strandedPassengers).toBe(25);
  });

  it('6. Cancellation threshold: delay exceeding limit cancels flight', () => {
    const dataset = createTestDataset();
    const engine = new SimulationEngine(dataset);
    // 200m closure exceeds 180m threshold
    const config: SimulationConfig = {
      ...defaultConfig,
      cancellationThresholdMinutes: 180,
      closures: [{ airport: 'BOM', startTime: 580, endTime: 820 }],
    };

    const result = engine.simulate(config);
    const f1 = result.flights.find((f) => f.flightId === 'AI-101')!;

    expect(f1.status).toBe(FlightStatus.CANCELLED);
    expect(result.kpis.cancelledFlights).toBeGreaterThanOrEqual(1);
  });

  it('7. Patient Zero ranking identifies root closure', () => {
    const dataset = createTestDataset();
    const engine = new SimulationEngine(dataset);
    const closure = { airport: 'BOM', startTime: 580, endTime: 660 };
    const config: SimulationConfig = {
      ...defaultConfig,
      closures: [closure],
    };

    const result = engine.simulate(config);
    const pz = engine.getPatientZeroRanking(result, config);

    expect(pz.length).toBe(1);
    expect(pz[0].airport).toBe('BOM');
    expect(pz[0].totalDownstreamDelayMinutes).toBeGreaterThan(0);
  });
});
