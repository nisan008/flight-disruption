/**
 * Domino Sky — Recovery Candidate Generation Engine
 *
 * Generates, evaluates, and ranks recovery actions by re-simulating
 * modified datasets. Pure and deterministic.
 */

import type {
  CostWeights,
  Dataset,
  RecoveryAction,
  RecoveryCandidate,
  SimulationConfig,
  SimulationResult,
} from './types';
import { FlightStatus, RecoveryActionType } from './types';
import { SimulationEngine } from './engine';

// ---------------------------------------------------------------------------
// RecoveryEngine
// ---------------------------------------------------------------------------

export class RecoveryEngine {
  constructor(
    private readonly engine: SimulationEngine,
    private readonly dataset: Dataset,
  ) {}

  /**
   * Generate all viable recovery candidates, rank them by cost score.
   * Also generates the top paired combinations (best single × best single).
   */
  generateCandidates(
    baselineConfig: SimulationConfig,
    baselineResult: SimulationResult,
    weights: CostWeights,
  ): RecoveryCandidate[] {
    const baselineCost = this.calculateCost(baselineResult, weights);
    const singles: RecoveryCandidate[] = [];

    // 1. Cancel each delayed flight (delay > 60 min)
    for (const fr of baselineResult.flights) {
      if (
        fr.status === FlightStatus.DELAYED &&
        fr.delayMinutes > 60
      ) {
        const action: RecoveryAction = {
          id: `cancel-${fr.flightId}`,
          type: RecoveryActionType.CANCEL_FLIGHT,
          description: `Cancel flight ${fr.flightId} (delayed ${fr.delayMinutes}min)`,
          params: { flightId: fr.flightId },
        };

        const candidate = this.evaluateCandidate(
          action,
          baselineConfig,
          baselineResult,
          weights,
          baselineCost,
        );
        if (candidate) singles.push(candidate);
      }
    }

    // 2. Swap spare aircraft
    for (const spare of this.dataset.spares) {
      for (const fr of baselineResult.flights) {
        if (fr.status !== FlightStatus.DELAYED || fr.delayMinutes <= 0)
          continue;
        if (fr.origin !== spare.airport) continue;
        if (spare.availableFrom > fr.scheduledDeparture) continue;

        // Find the aircraft to get the type match
        const aircraft = this.dataset.aircraft.find(
          (a) => a.id === fr.aircraftId,
        );
        if (!aircraft || aircraft.type !== spare.type) continue;

        const action: RecoveryAction = {
          id: `spare-${spare.aircraftId}-for-${fr.flightId}`,
          type: RecoveryActionType.SWAP_SPARE,
          description: `Assign spare ${spare.aircraftId} to take over ${fr.flightId} and subsequent flights`,
          params: {
            spareAircraftId: spare.aircraftId,
            targetFlightId: fr.flightId,
            originalAircraftId: fr.aircraftId,
          },
        };

        const candidate = this.evaluateCandidate(
          action,
          baselineConfig,
          baselineResult,
          weights,
          baselineCost,
        );
        if (candidate) singles.push(candidate);
      }
    }

    // 3. Swap two rotations
    const aircraftList = this.dataset.aircraft;
    for (let i = 0; i < aircraftList.length; i++) {
      for (let j = i + 1; j < aircraftList.length; j++) {
        const acA = aircraftList[i];
        const acB = aircraftList[j];

        // Only try swaps from each point in the rotation
        for (let swapPoint = 0; swapPoint < Math.min(acA.rotation.length, acB.rotation.length); swapPoint++) {
          const action: RecoveryAction = {
            id: `swap-${acA.id}-${acB.id}-at-${swapPoint}`,
            type: RecoveryActionType.SWAP_AIRCRAFT,
            description: `Swap rotations of ${acA.id} and ${acB.id} from position ${swapPoint}`,
            params: {
              aircraftIdA: acA.id,
              aircraftIdB: acB.id,
              swapFromPosition: swapPoint,
            },
          };

          const candidate = this.evaluateCandidate(
            action,
            baselineConfig,
            baselineResult,
            weights,
            baselineCost,
          );
          if (candidate) singles.push(candidate);
        }
      }
    }

    // 4. Hold connection
    for (const cr of baselineResult.connections) {
      if (!cr.missed) continue;

      const feeder = baselineResult.flights.find(
        (f) => f.flightId === cr.feederFlightId,
      );
      const onward = baselineResult.flights.find(
        (f) => f.flightId === cr.onwardFlightId,
      );
      if (!feeder || !onward) continue;
      if (
        feeder.status === FlightStatus.CANCELLED ||
        onward.status === FlightStatus.CANCELLED
      )
        continue;

      const conn = this.dataset.connections.find(
        (c) => c.id === cr.connectionId,
      );
      if (!conn) continue;

      const neededHoldMinutes =
        feeder.actualArrival + conn.minimumConnectTime - onward.actualDeparture;
      if (neededHoldMinutes <= 0 || neededHoldMinutes > 30) continue;

      const action: RecoveryAction = {
        id: `hold-${cr.connectionId}`,
        type: RecoveryActionType.HOLD_CONNECTION,
        description: `Hold ${cr.onwardFlightId} by ${neededHoldMinutes}min for ${cr.passengerCount} connecting pax from ${cr.feederFlightId}`,
        params: {
          connectionId: cr.connectionId,
          onwardFlightId: cr.onwardFlightId,
          holdMinutes: neededHoldMinutes,
        },
      };

      const candidate = this.evaluateCandidate(
        action,
        baselineConfig,
        baselineResult,
        weights,
        baselineCost,
      );
      if (candidate) singles.push(candidate);
    }

    // 5. Reassign crew
    for (const crew of baselineResult.crews) {
      if (!crew.timedOut) continue;
      if (crew.affectedFlights.length === 0) continue;

      const action: RecoveryAction = {
        id: `crew-reassign-${crew.crewId}`,
        type: RecoveryActionType.REASSIGN_CREW,
        description: `Assign fresh crew to replace ${crew.crewId} (adds 30min crew change)`,
        params: {
          crewId: crew.crewId,
          affectedFlightId: crew.affectedFlights[0],
          crewChangeDelay: 30,
        },
      };

      const candidate = this.evaluateCandidate(
        action,
        baselineConfig,
        baselineResult,
        weights,
        baselineCost,
      );
      if (candidate) singles.push(candidate);
    }

    // Sort singles by cost score (ascending = better)
    singles.sort((a, b) => a.delta.costScore - b.delta.costScore);

    // Generate top pairs (up to 10 best singles paired with each other)
    const topSingles = singles.slice(0, 10);
    const pairs: RecoveryCandidate[] = [];

    for (let i = 0; i < topSingles.length; i++) {
      for (let j = i + 1; j < topSingles.length; j++) {
        const actionA = topSingles[i].action;
        const actionB = topSingles[j].action;

        // Skip conflicting pairs (same flight, same aircraft)
        if (this.actionsConflict(actionA, actionB)) continue;

        const combinedAction: RecoveryAction = {
          id: `pair-${actionA.id}+${actionB.id}`,
          type: actionA.type, // Use first action's type for the pair
          description: `Combined: ${actionA.description} + ${actionB.description}`,
          params: {
            combined: true,
            actionA: actionA,
            actionB: actionB,
          },
        };

        const candidate = this.evaluatePairCandidate(
          actionA,
          actionB,
          combinedAction,
          baselineConfig,
          baselineResult,
          weights,
          baselineCost,
        );
        if (candidate) pairs.push(candidate);
      }
    }

    // Merge and sort
    const all = [...singles, ...pairs];
    all.sort((a, b) => a.delta.costScore - b.delta.costScore);

    return all;
  }

  /**
   * Calculate the total cost score for a simulation result.
   */
  calculateCost(result: SimulationResult, weights: CostWeights): number {
    return (
      result.kpis.totalDelayMinutes * weights.delayMinuteWeight +
      result.kpis.cancelledFlights * weights.cancellationWeight +
      result.kpis.strandedPassengers * weights.strandedPassengerWeight +
      result.kpis.crewViolations * weights.crewViolationWeight
    );
  }

  /**
   * Apply a recovery action to the dataset and re-simulate.
   */
  applyAndSimulate(
    action: RecoveryAction,
    config: SimulationConfig,
  ): SimulationResult {
    const modifiedDataset = this.applyAction(action, this.dataset);
    const modifiedEngine = new SimulationEngine(modifiedDataset);
    return modifiedEngine.simulate(config);
  }

  // -----------------------------------------------------------------------
  // Internal helpers
  // -----------------------------------------------------------------------

  private evaluateCandidate(
    action: RecoveryAction,
    config: SimulationConfig,
    baseline: SimulationResult,
    weights: CostWeights,
    baselineCost: number,
  ): RecoveryCandidate | null {
    const result = this.applyAndSimulate(action, config);
    const newCost = this.calculateCost(result, weights);

    const delta = {
      delayMinutesDelta:
        result.kpis.totalDelayMinutes - baseline.kpis.totalDelayMinutes,
      cancellationsDelta:
        result.kpis.cancelledFlights - baseline.kpis.cancelledFlights,
      strandedPassengersDelta:
        result.kpis.strandedPassengers - baseline.kpis.strandedPassengers,
      crewViolationsDelta:
        result.kpis.crewViolations - baseline.kpis.crewViolations,
      costScore: newCost - baselineCost,
    };

    return { action, resultAfter: result, delta };
  }

  private evaluatePairCandidate(
    actionA: RecoveryAction,
    actionB: RecoveryAction,
    combinedAction: RecoveryAction,
    config: SimulationConfig,
    baseline: SimulationResult,
    weights: CostWeights,
    baselineCost: number,
  ): RecoveryCandidate | null {
    // Apply both actions sequentially
    let modifiedDataset = this.applyAction(actionA, this.dataset);
    modifiedDataset = this.applyAction(actionB, modifiedDataset);

    const modifiedEngine = new SimulationEngine(modifiedDataset);
    const result = modifiedEngine.simulate(config);
    const newCost = this.calculateCost(result, weights);

    const delta = {
      delayMinutesDelta:
        result.kpis.totalDelayMinutes - baseline.kpis.totalDelayMinutes,
      cancellationsDelta:
        result.kpis.cancelledFlights - baseline.kpis.cancelledFlights,
      strandedPassengersDelta:
        result.kpis.strandedPassengers - baseline.kpis.strandedPassengers,
      crewViolationsDelta:
        result.kpis.crewViolations - baseline.kpis.crewViolations,
      costScore: newCost - baselineCost,
    };

    return { action: combinedAction, resultAfter: result, delta };
  }

  /**
   * Apply a single recovery action to a dataset, returning a modified copy.
   */
  private applyAction(action: RecoveryAction, dataset: Dataset): Dataset {
    const ds: Dataset = structuredClone(dataset);

    switch (action.type) {
      case RecoveryActionType.CANCEL_FLIGHT: {
        const flightId = action.params['flightId'] as string;
        // Remove the flight from the dataset
        ds.flights = ds.flights.filter((f) => f.id !== flightId);
        // Remove from aircraft rotation
        for (const ac of ds.aircraft) {
          ac.rotation = ac.rotation.filter((fid) => fid !== flightId);
        }
        // Remove from crew assignments
        for (const crew of ds.crews) {
          crew.flightIds = crew.flightIds.filter((fid) => fid !== flightId);
        }
        // Remove connections involving this flight
        ds.connections = ds.connections.filter(
          (c) =>
            c.feederFlightId !== flightId &&
            c.onwardFlightId !== flightId,
        );
        break;
      }

      case RecoveryActionType.SWAP_SPARE: {
        const spareAircraftId = action.params['spareAircraftId'] as string;
        const targetFlightId = action.params['targetFlightId'] as string;
        const originalAircraftId = action.params['originalAircraftId'] as string;

        // Find the original aircraft and the target flight's position
        const origAircraft = ds.aircraft.find(
          (a) => a.id === originalAircraftId,
        );
        if (!origAircraft) break;

        const targetIdx = origAircraft.rotation.indexOf(targetFlightId);
        if (targetIdx === -1) break;

        // Split: flights from targetIdx onward go to spare
        const flightsToSpare = origAircraft.rotation.splice(targetIdx);

        // Create a new aircraft entry for the spare
        const spareEntry = ds.spares.find(
          (s) => s.aircraftId === spareAircraftId,
        );
        ds.aircraft.push({
          id: spareAircraftId,
          type: spareEntry?.type ?? origAircraft.type,
          rotation: flightsToSpare,
          baseAirport: spareEntry?.airport ?? origAircraft.baseAirport,
        });

        // Update flight records to point to spare aircraft
        for (const fid of flightsToSpare) {
          const flight = ds.flights.find((f) => f.id === fid);
          if (flight) {
            flight.aircraftId = spareAircraftId;
            flight.sequenceInRotation =
              flightsToSpare.indexOf(fid);
          }
        }

        // Remove the spare from spares pool
        ds.spares = ds.spares.filter(
          (s) => s.aircraftId !== spareAircraftId,
        );
        break;
      }

      case RecoveryActionType.SWAP_AIRCRAFT: {
        const acIdA = action.params['aircraftIdA'] as string;
        const acIdB = action.params['aircraftIdB'] as string;
        const swapFrom = action.params['swapFromPosition'] as number;

        const acA = ds.aircraft.find((a) => a.id === acIdA);
        const acB = ds.aircraft.find((a) => a.id === acIdB);
        if (!acA || !acB) break;

        // Swap tails from swapFrom position onward
        const tailA = acA.rotation.slice(swapFrom);
        const tailB = acB.rotation.slice(swapFrom);

        acA.rotation = [...acA.rotation.slice(0, swapFrom), ...tailB];
        acB.rotation = [...acB.rotation.slice(0, swapFrom), ...tailA];

        // Update flight records
        for (let i = swapFrom; i < acA.rotation.length; i++) {
          const f = ds.flights.find((fl) => fl.id === acA.rotation[i]);
          if (f) {
            f.aircraftId = acIdA;
            f.sequenceInRotation = i;
          }
        }
        for (let i = swapFrom; i < acB.rotation.length; i++) {
          const f = ds.flights.find((fl) => fl.id === acB.rotation[i]);
          if (f) {
            f.aircraftId = acIdB;
            f.sequenceInRotation = i;
          }
        }
        break;
      }

      case RecoveryActionType.HOLD_CONNECTION: {
        const onwardFlightId = action.params['onwardFlightId'] as string;
        const holdMinutes = action.params['holdMinutes'] as number;

        const flight = ds.flights.find((f) => f.id === onwardFlightId);
        if (flight) {
          flight.scheduledDeparture += holdMinutes;
          flight.scheduledArrival += holdMinutes;
        }
        break;
      }

      case RecoveryActionType.REASSIGN_CREW: {
        const crewId = action.params['crewId'] as string;
        const affectedFlightId = action.params['affectedFlightId'] as string;
        const crewChangeDelay = (action.params['crewChangeDelay'] as number) ?? 30;

        // Create a fresh crew that takes over from the affected flight onward
        const originalCrew = ds.crews.find((c) => c.id === crewId);
        if (!originalCrew) break;

        const affectedIdx = originalCrew.flightIds.indexOf(affectedFlightId);
        if (affectedIdx === -1) break;

        // Split flights: original crew keeps flights before the affected one
        const reassignedFlights = originalCrew.flightIds.splice(affectedIdx);

        // Add crew change delay to the affected flight
        const affectedFlight = ds.flights.find(
          (f) => f.id === affectedFlightId,
        );
        if (affectedFlight) {
          affectedFlight.scheduledDeparture += crewChangeDelay;
          affectedFlight.scheduledArrival += crewChangeDelay;
        }

        // Create fresh crew
        const freshCrewId = `${crewId}-FRESH`;
        ds.crews.push({
          id: freshCrewId,
          flightIds: reassignedFlights,
          dutyStartTime: affectedFlight
            ? affectedFlight.scheduledDeparture
            : originalCrew.dutyStartTime,
          maxDutyMinutes: originalCrew.maxDutyMinutes,
          baseAirport: originalCrew.baseAirport,
        });

        // Update flight records
        for (const fid of reassignedFlights) {
          const f = ds.flights.find((fl) => fl.id === fid);
          if (f) f.crewId = freshCrewId;
        }
        break;
      }
    }

    return ds;
  }

  /**
   * Check if two actions conflict (target the same flight or aircraft).
   */
  private actionsConflict(
    a: RecoveryAction,
    b: RecoveryAction,
  ): boolean {
    const aFlight =
      (a.params['flightId'] as string) ??
      (a.params['targetFlightId'] as string) ??
      (a.params['onwardFlightId'] as string) ??
      '';
    const bFlight =
      (b.params['flightId'] as string) ??
      (b.params['targetFlightId'] as string) ??
      (b.params['onwardFlightId'] as string) ??
      '';

    if (aFlight && bFlight && aFlight === bFlight) return true;

    const aAircraft =
      (a.params['originalAircraftId'] as string) ??
      (a.params['aircraftIdA'] as string) ??
      '';
    const bAircraft =
      (b.params['originalAircraftId'] as string) ??
      (b.params['aircraftIdA'] as string) ??
      '';

    if (aAircraft && bAircraft && aAircraft === bAircraft) return true;

    return false;
  }
}
