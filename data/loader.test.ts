import { describe, it, expect } from 'vitest';
import { loadDataset, validateDataset } from './loader';
import { SAMPLE_DATASET } from './sampleDataset';

describe('Dataset Loader and Health Validator', () => {
  it('1. Loads and validates SAMPLE_DATASET with 16 airports, 70 flights, 16 aircraft', () => {
    const { dataset, health } = loadDataset(SAMPLE_DATASET);

    expect(dataset.airports.length).toBe(16);
    expect(dataset.flights.length).toBe(70);
    expect(dataset.aircraft.length).toBe(16);
    expect(dataset.connections.length).toBeGreaterThanOrEqual(25);
    expect(dataset.spares.length).toBe(4);
    expect(health.isValid).toBe(true);
    expect(health.stats.flights).toBe(70);
  });

  it('2. Detects orphan flights (unassigned or missing aircraft)', () => {
    const faultyData = {
      airports: [{ code: 'BOM', name: 'Mumbai', city: 'Mumbai', lat: 19.0, lng: 72.8 }],
      flights: [
        {
          id: 'ORPHAN-1',
          aircraftId: 'NONEXISTENT-AC',
          origin: 'BOM',
          destination: 'BOM',
          scheduledDeparture: 600,
          scheduledArrival: 700,
          passengerCount: 100,
          sequenceInRotation: 0,
          crewId: 'CR-1',
        },
      ],
      aircraft: [], // No aircraft provided
    };

    const { health } = loadDataset(faultyData);
    // Since loader auto-synthesizes missing aircraft to keep pipeline running, let's test validateDataset directly
    const directHealth = validateDataset({
      airports: faultyData.airports,
      flights: faultyData.flights,
      aircraft: [],
      connections: [],
      crews: [],
      spares: [],
    });

    expect(directHealth.isValid).toBe(false);
    expect(directHealth.issues.some((i) => i.category === 'Flights')).toBe(true);
  });

  it('3. Detects route mismatch in aircraft rotation', () => {
    const faultyDataset = {
      airports: [
        { code: 'BOM', name: 'Mumbai', city: 'Mumbai', lat: 19.0, lng: 72.8 },
        { code: 'DEL', name: 'Delhi', city: 'Delhi', lat: 28.5, lng: 77.1 },
        { code: 'BLR', name: 'Bengaluru', city: 'Bengaluru', lat: 13.2, lng: 77.7 },
      ],
      flights: [
        {
          id: 'F-1',
          aircraftId: 'VT-X',
          origin: 'BOM',
          destination: 'DEL', // lands at DEL
          scheduledDeparture: 600,
          scheduledArrival: 720,
          passengerCount: 150,
          sequenceInRotation: 0,
          crewId: 'CR-1',
        },
        {
          id: 'F-2',
          aircraftId: 'VT-X',
          origin: 'BLR', // departs from BLR! (impossible jump)
          destination: 'BOM',
          scheduledDeparture: 780,
          scheduledArrival: 900,
          passengerCount: 150,
          sequenceInRotation: 1,
          crewId: 'CR-1',
        },
      ],
      aircraft: [{ id: 'VT-X', type: 'A320', rotation: ['F-1', 'F-2'], baseAirport: 'BOM' }],
      connections: [],
      crews: [],
      spares: [],
    };

    const report = validateDataset(faultyDataset);
    expect(report.isValid).toBe(false);
    expect(report.issues.some((i) => i.category === 'Rotations')).toBe(true);
  });
});
