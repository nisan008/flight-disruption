import { describe, it, expect } from 'vitest';
import { extractNumbers, verifyNumbers, injectTamperNumber } from './numberGuard';
import type { AIRequest, AIResponse } from './dispatcher';
import type { SimulationResult } from '../engine/types';

describe('Number Guard', () => {
  it('1. Extracts numbers while ignoring flight numbers and clock times', () => {
    const text = 'Flight AI-612 was delayed by 90 minutes after the 14:00 closure. It affected 150 passengers.';
    const claims = extractNumbers(text);

    // AI-612 and 14:00 should be ignored
    const values = claims.map((c) => c.value);
    expect(values).toContain(90);
    expect(values).toContain(150);
    expect(values).not.toContain(612);
    expect(values).not.toContain(14);
  });

  it('2. Verifies accurate claims against engine data pool', () => {
    const aiRequest: AIRequest = {
      baseline: {
        kpis: {
          totalFlights: 70,
          delayedFlights: 12,
          cancelledFlights: 2,
          onTimeFlights: 56,
          totalDelayMinutes: 540,
          averageDelayMinutes: 45,
          missedConnections: 4,
          strandedPassengers: 85,
          crewViolations: 1,
        },
        topDelayedFlights: [{ flightId: 'DS-101', delayMinutes: 90, cause: 'WEATHER_CLOSURE' }],
        missedConnections: 4,
        strandedPassengers: 85,
      },
      candidates: [
        {
          rank: 1,
          action: 'CANCEL_FLIGHT',
          description: 'Cancel DS-101',
          costScore: 250,
          deltas: {
            delayMinutesDelta: -90,
            cancellationsDelta: 1,
            strandedPassengersDelta: -10,
            crewViolationsDelta: 0,
          },
        },
      ],
      weights: {
        delayMinuteWeight: 1,
        cancellationWeight: 500,
        strandedPassengerWeight: 50,
        crewViolationWeight: 300,
      },
    };

    const mockResult: SimulationResult = {
      flights: [],
      connections: [],
      crews: [],
      kpis: aiRequest.baseline.kpis,
      timelineEvents: [],
    };

    const claims = extractNumbers('There are 85 stranded passengers and 4 missed connections.');
    const verification = verifyNumbers(claims, aiRequest, mockResult);

    expect(verification.allVerified).toBe(true);
    expect(verification.verifiedNumbers).toBe(2);
    expect(verification.mismatches.length).toBe(0);
  });

  it('3. Flags fabricated numbers as mismatches and sanitizes text', () => {
    const aiRequest: AIRequest = {
      baseline: {
        kpis: {
          totalFlights: 70,
          delayedFlights: 12,
          cancelledFlights: 2,
          onTimeFlights: 56,
          totalDelayMinutes: 540,
          averageDelayMinutes: 45,
          missedConnections: 4,
          strandedPassengers: 85,
          crewViolations: 1,
        },
        topDelayedFlights: [],
        missedConnections: 4,
        strandedPassengers: 85,
      },
      candidates: [],
      weights: {
        delayMinuteWeight: 1,
        cancellationWeight: 500,
        strandedPassengerWeight: 50,
        crewViolationWeight: 300,
      },
    };

    const mockResult: SimulationResult = {
      flights: [],
      connections: [],
      crews: [],
      kpis: aiRequest.baseline.kpis,
      timelineEvents: [],
    };

    // 9999 is hallucinated
    const text = 'There are 9999 stranded passengers in the terminal.';
    const claims = extractNumbers(text);
    const verification = verifyNumbers(claims, aiRequest, mockResult);

    expect(verification.allVerified).toBe(false);
    expect(verification.mismatches.length).toBeGreaterThan(0);
    expect(verification.sanitizedText).toContain('[BLOCKED:');
  });

  it('4. Tamper injection alters response so Number Guard catches it', () => {
    const validResponse: AIResponse = {
      chosenActions: ['action-1'],
      reasoning: 'We reduce 90 minutes of delay for 150 passengers.',
      citedNumbers: [
        { value: 90, context: 'minutes of delay', source: 'candidate.deltas.delayMinutesDelta' },
        { value: 150, context: 'passengers', source: 'baseline.strandedPassengers' },
      ],
      confidence: 0.95,
    };

    const tampered = injectTamperNumber(validResponse);
    expect(tampered).toBeDefined();

    // Check that at least one cited number changed
    const hasChanged = tampered.citedNumbers.some(
      (cn, idx) => cn.value !== validResponse.citedNumbers[idx].value
    );
    expect(hasChanged).toBe(true);
  });
});
