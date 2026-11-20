/**
 * Domino Sky — Core Simulation Engine
 *
 * Pure, deterministic simulation of flight disruption cascades.
 * Same input always produces same output — no randomness, no side-effects.
 */

import type {
  Aircraft,
  AirportClosure,
  CauseChainLink,
  Connection,
  ConnectionResult,
  Crew,
  CrewResult,
  Dataset,
  Flight,
  FlightResult,
  PatientZero,
  SimulationConfig,
  SimulationKPIs,
  SimulationResult,
  TimeMinutes,
  TimeSnapshot,
  TimelineEvent,
} from './types';
import { DelayCause, FlightStatus } from './types';

// ---------------------------------------------------------------------------
// Internal working state for a single flight during simulation
// ---------------------------------------------------------------------------

interface FlightWorkingState {
  flight: Flight;
  actualDeparture: TimeMinutes;
  actualArrival: TimeMinutes;
  delayMinutes: number;
  status: FlightStatus;
  causeChain: CauseChainLink[];
  delayBreakdown: Record<DelayCause, number>;
  crewTimedOut: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Flight duration in minutes (scheduled). */
function flightDuration(f: Flight): number {
  return f.scheduledArrival - f.scheduledDeparture;
}

/** Create a zeroed delay breakdown record. */
function emptyBreakdown(): Record<DelayCause, number> {
  return {
    [DelayCause.WEATHER_CLOSURE]: 0,
    [DelayCause.ROTATION_KNOCKON]: 0,
    [DelayCause.CREW_TIMEOUT]: 0,
    [DelayCause.CREW_WAIT]: 0,
    [DelayCause.CONNECTION_HOLD]: 0,
  };
}

/**
 * Check whether a time `t` falls inside the half-open interval [start, end).
 */
function isInClosureWindow(
  t: TimeMinutes,
  start: TimeMinutes,
  end: TimeMinutes,
): boolean {
  return t >= start && t < end;
}

/**
 * Find the first closure that blocks a departure from `airport` at `time`.
 * Returns the closure or undefined.
 */
function findDepartureBlockingClosure(
  airport: string,
  time: TimeMinutes,
  closures: AirportClosure[],
): AirportClosure | undefined {
  return closures.find(
    (c) =>
      c.airport === airport && isInClosureWindow(time, c.startTime, c.endTime),
  );
}

/**
 * Find the first closure that blocks an arrival at `airport` at `time`.
 */
function findArrivalBlockingClosure(
  airport: string,
  time: TimeMinutes,
  closures: AirportClosure[],
): AirportClosure | undefined {
  return closures.find(
    (c) =>
      c.airport === airport && isInClosureWindow(time, c.startTime, c.endTime),
  );
}

// ---------------------------------------------------------------------------
// SimulationEngine
// ---------------------------------------------------------------------------

export class SimulationEngine {
  private readonly flightMap: Map<string, Flight>;
  private readonly aircraftMap: Map<string, Aircraft>;
  private readonly crewMap: Map<string, Crew>;

  constructor(private readonly dataset: Dataset) {
    this.flightMap = new Map(dataset.flights.map((f) => [f.id, f]));
    this.aircraftMap = new Map(dataset.aircraft.map((a) => [a.id, a]));
    this.crewMap = new Map(dataset.crews.map((c) => [c.id, c]));
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Run the full disruption simulation.
   * Returns a complete, deterministic result.
   */
  simulate(config: SimulationConfig): SimulationResult {
    const states = this.initWorkingStates();

    // Phase 1: iterative propagation until convergence
    this.propagateUntilStable(states, config);

    // Phase 2: crew duty checks (may add further delays / cancellations)
    this.applyCrewDutyChecks(states, config);

    // After crew changes, re-converge
    this.propagateUntilStable(states, config);

    // Phase 3: build results
    const flightResults = this.buildFlightResults(states);
    const connectionResults = this.evaluateConnections(states, config);
    const crewResults = this.evaluateCrews(states);
    const kpis = this.computeKPIs(flightResults, connectionResults, crewResults);
    const timelineEvents = this.buildTimeline(flightResults, connectionResults, crewResults);

    return {
      flights: flightResults,
      connections: connectionResults,
      crews: crewResults,
      kpis,
      timelineEvents,
    };
  }

  /**
   * Rank closures by their downstream impact ("patient zero" analysis).
   * For each closure, run the simulation with only that closure removed,
   * and measure the difference vs. the full baseline result.
   */
  getPatientZeroRanking(
    result: SimulationResult,
    config: SimulationConfig,
  ): PatientZero[] {
    const rankings: PatientZero[] = [];

    for (const closure of config.closures) {
      // Run simulation without this single closure
      const reducedConfig: SimulationConfig = {
        ...config,
        closures: config.closures.filter((c) => c !== closure),
      };
      const reducedResult = this.simulate(reducedConfig);

      // Flights that were delayed / cancelled in full but not in reduced
      const affectedFlightIds: string[] = [];
      let totalDownstreamDelay = 0;

      for (const fr of result.flights) {
        const reduced = reducedResult.flights.find(
          (r) => r.flightId === fr.flightId,
        );
        if (!reduced) continue;
        const deltaDelay = fr.delayMinutes - reduced.delayMinutes;
        if (deltaDelay > 0 || (fr.status === FlightStatus.CANCELLED && reduced.status !== FlightStatus.CANCELLED)) {
          affectedFlightIds.push(fr.flightId);
          totalDownstreamDelay += deltaDelay;
        }
      }

      const totalStrandedPassengers =
        result.kpis.strandedPassengers -
        reducedResult.kpis.strandedPassengers;

      rankings.push({
        closureDescription: `${closure.airport} closed ${closure.startTime}–${closure.endTime}`,
        airport: closure.airport,
        startTime: closure.startTime,
        endTime: closure.endTime,
        totalDownstreamDelayMinutes: totalDownstreamDelay,
        totalStrandedPassengers: Math.max(0, totalStrandedPassengers),
        affectedFlightCount: affectedFlightIds.length,
        affectedFlightIds,
      });
    }

    // Sort descending by downstream delay
    rankings.sort(
      (a, b) => b.totalDownstreamDelayMinutes - a.totalDownstreamDelayMinutes,
    );
    return rankings;
  }

  /**
   * Build a point-in-time snapshot for the replay feature.
   */
  getSnapshotAtTime(
    result: SimulationResult,
    time: TimeMinutes,
  ): TimeSnapshot {
    const flightStates = new Map<
      string,
      | 'scheduled'
      | 'boarding'
      | 'departed'
      | 'in-air'
      | 'arrived'
      | 'delayed'
      | 'cancelled'
    >();

    let delayedFlights = 0;
    let cancelledFlights = 0;
    let onTimeFlights = 0;
    let totalDelayMinutes = 0;
    let departedOrArrivedCount = 0;

    for (const fr of result.flights) {
      if (fr.status === FlightStatus.CANCELLED) {
        flightStates.set(fr.flightId, 'cancelled');
        cancelledFlights++;
        continue;
      }

      if (time < fr.actualDeparture) {
        // Not yet departed
        if (fr.delayMinutes > 0 && time >= fr.scheduledDeparture) {
          flightStates.set(fr.flightId, 'delayed');
          delayedFlights++;
        } else if (fr.actualDeparture - time <= 15 && time >= fr.scheduledDeparture - 15) {
          flightStates.set(fr.flightId, 'boarding');
        } else {
          flightStates.set(fr.flightId, 'scheduled');
        }
      } else if (time < fr.actualArrival) {
        // In the air
        flightStates.set(fr.flightId, 'in-air');
        departedOrArrivedCount++;
        if (fr.delayMinutes > 0) {
          delayedFlights++;
          totalDelayMinutes += fr.delayMinutes;
        } else {
          onTimeFlights++;
        }
      } else {
        // Arrived
        flightStates.set(fr.flightId, 'arrived');
        departedOrArrivedCount++;
        if (fr.delayMinutes > 0) {
          delayedFlights++;
          totalDelayMinutes += fr.delayMinutes;
        } else {
          onTimeFlights++;
        }
      }
    }

    // Count missed connections up to this time
    let missedConnections = 0;
    let strandedPassengers = 0;
    for (const cr of result.connections) {
      if (cr.missed) {
        // Check if the feeder has arrived by now
        const feederResult = result.flights.find(
          (f) => f.flightId === cr.feederFlightId,
        );
        if (feederResult && (feederResult.status === FlightStatus.CANCELLED || time >= feederResult.actualArrival)) {
          missedConnections++;
          strandedPassengers += cr.passengerCount;
        }
      }
    }

    let crewViolations = 0;
    for (const crew of result.crews) {
      if (crew.timedOut) crewViolations++;
    }

    const totalFlights = result.flights.length;
    const currentKPIs: SimulationKPIs = {
      totalFlights,
      delayedFlights,
      cancelledFlights,
      onTimeFlights,
      totalDelayMinutes,
      averageDelayMinutes:
        departedOrArrivedCount > 0
          ? Math.round((totalDelayMinutes / departedOrArrivedCount) * 100) / 100
          : 0,
      missedConnections,
      strandedPassengers,
      crewViolations,
    };

    return { time, flightStates, currentKPIs };
  }

  // -----------------------------------------------------------------------
  // Internal: Initialise working states
  // -----------------------------------------------------------------------

  private initWorkingStates(): Map<string, FlightWorkingState> {
    const states = new Map<string, FlightWorkingState>();
    for (const f of this.dataset.flights) {
      states.set(f.id, {
        flight: f,
        actualDeparture: f.scheduledDeparture,
        actualArrival: f.scheduledArrival,
        delayMinutes: 0,
        status: FlightStatus.ON_TIME,
        causeChain: [],
        delayBreakdown: emptyBreakdown(),
        crewTimedOut: false,
      });
    }
    return states;
  }

  // -----------------------------------------------------------------------
  // Internal: Iterative convergence loop
  // -----------------------------------------------------------------------

  private propagateUntilStable(
    states: Map<string, FlightWorkingState>,
    config: SimulationConfig,
  ): void {
    const MAX_ITERATIONS = 50;
    for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
      let changed = false;

      // Process each aircraft rotation in order
      for (const aircraft of this.dataset.aircraft) {
        for (let i = 0; i < aircraft.rotation.length; i++) {
          const flightId = aircraft.rotation[i];
          const state = states.get(flightId);
          if (!state || state.status === FlightStatus.CANCELLED) continue;

          const prevDep = state.actualDeparture;
          const prevArr = state.actualArrival;

          // Step 1: rotation propagation
          if (i > 0) {
            const prevFlightId = aircraft.rotation[i - 1];
            const prevState = states.get(prevFlightId);
            if (prevState && prevState.status !== FlightStatus.CANCELLED) {
              const earliestDep =
                prevState.actualArrival + config.minimumTurnaroundMinutes;
              if (earliestDep > state.actualDeparture) {
                const knockonDelay = earliestDep - state.actualDeparture;
                state.actualDeparture = earliestDep;
                state.actualArrival =
                  state.actualDeparture + flightDuration(state.flight);

                // Record rotation knock-on
                this.addDelay(
                  state,
                  DelayCause.ROTATION_KNOCKON,
                  knockonDelay,
                  prevFlightId,
                  `Rotation knock-on from ${prevFlightId}: +${knockonDelay}min`,
                );
              }
            }
          }

          // Step 2: departure closure check
          const depClosure = findDepartureBlockingClosure(
            state.flight.origin,
            state.actualDeparture,
            config.closures,
          );
          if (depClosure) {
            const newDep = depClosure.endTime;
            if (newDep > state.actualDeparture) {
              const closureDelay = newDep - state.actualDeparture;
              state.actualDeparture = newDep;
              state.actualArrival =
                state.actualDeparture + flightDuration(state.flight);

              this.addDelay(
                state,
                DelayCause.WEATHER_CLOSURE,
                closureDelay,
                state.flight.id,
                `${state.flight.origin} closure ${depClosure.startTime}–${depClosure.endTime}: departure delayed +${closureDelay}min`,
              );
            }
          }

          // Step 3: arrival closure check
          const arrClosure = findArrivalBlockingClosure(
            state.flight.destination,
            state.actualArrival,
            config.closures,
          );
          if (arrClosure) {
            // Delay departure so arrival = closure endTime
            const newArrival = arrClosure.endTime;
            if (newArrival > state.actualArrival) {
              const arrDelay = newArrival - state.actualArrival;
              state.actualArrival = newArrival;
              state.actualDeparture = newArrival - flightDuration(state.flight);

              this.addDelay(
                state,
                DelayCause.WEATHER_CLOSURE,
                arrDelay,
                state.flight.id,
                `${state.flight.destination} closure ${arrClosure.startTime}–${arrClosure.endTime}: arrival delayed +${arrDelay}min`,
              );
            }
          }

          // Update total delay
          state.delayMinutes = Math.max(
            0,
            state.actualDeparture - state.flight.scheduledDeparture,
          );

          // Check cancellation threshold
          if (state.delayMinutes > config.cancellationThresholdMinutes) {
            state.status = FlightStatus.CANCELLED;
            changed = true;
            continue;
          }

          if (state.delayMinutes > 0) {
            state.status = FlightStatus.DELAYED;
          }

          if (
            state.actualDeparture !== prevDep ||
            state.actualArrival !== prevArr
          ) {
            changed = true;
          }
        }
      }

      if (!changed) break;
    }
  }

  // -----------------------------------------------------------------------
  // Internal: crew duty checks
  // -----------------------------------------------------------------------

  private applyCrewDutyChecks(
    states: Map<string, FlightWorkingState>,
    config: SimulationConfig,
  ): void {
    for (const crew of this.dataset.crews) {
      const activeFlightIds = crew.flightIds.filter((fid) => {
        const s = states.get(fid);
        return s && s.status !== FlightStatus.CANCELLED;
      });

      if (activeFlightIds.length === 0) continue;

      // Find duty start = first flight's actual departure
      const firstState = states.get(activeFlightIds[0]);
      const lastState = states.get(activeFlightIds[activeFlightIds.length - 1]);
      if (!firstState || !lastState) continue;

      const dutyStart = Math.min(crew.dutyStartTime, firstState.actualDeparture);
      const dutyEnd = lastState.actualArrival;
      const totalDuty = dutyEnd - dutyStart;

      if (totalDuty > crew.maxDutyMinutes) {
        // Find the first flight that pushes duty over the limit
        for (let i = 0; i < activeFlightIds.length; i++) {
          const state = states.get(activeFlightIds[i]);
          if (!state) continue;

          const dutyAtFlightEnd = state.actualArrival - dutyStart;
          if (dutyAtFlightEnd > crew.maxDutyMinutes) {
            // This flight causes the overtime — add crew timeout delay
            state.crewTimedOut = true;
            const crewDelay = 60; // replacement crew takes 60 minutes

            state.actualDeparture += crewDelay;
            state.actualArrival =
              state.actualDeparture + flightDuration(state.flight);

            this.addDelay(
              state,
              DelayCause.CREW_TIMEOUT,
              crewDelay,
              state.flight.id,
              `Crew ${crew.id} timed out: replacement crew needed +${crewDelay}min`,
            );

            state.delayMinutes = Math.max(
              0,
              state.actualDeparture - state.flight.scheduledDeparture,
            );

            if (state.delayMinutes > config.cancellationThresholdMinutes) {
              state.status = FlightStatus.CANCELLED;
            } else {
              state.status = FlightStatus.DELAYED;
            }

            // Mark all subsequent flights of this crew as potentially timed out too
            for (let j = i + 1; j < activeFlightIds.length; j++) {
              const subState = states.get(activeFlightIds[j]);
              if (subState) {
                subState.crewTimedOut = true;
              }
            }
            break;
          }
        }
      }
    }
  }

  // -----------------------------------------------------------------------
  // Internal: add delay to working state
  // -----------------------------------------------------------------------

  private addDelay(
    state: FlightWorkingState,
    cause: DelayCause,
    minutes: number,
    sourceFlightId: string,
    description: string,
  ): void {
    if (minutes <= 0) return;
    state.causeChain.push({
      flightId: sourceFlightId,
      cause,
      minutes,
      description,
    });
    state.delayBreakdown[cause] += minutes;
  }

  // -----------------------------------------------------------------------
  // Internal: build flight results
  // -----------------------------------------------------------------------

  private buildFlightResults(
    states: Map<string, FlightWorkingState>,
  ): FlightResult[] {
    const results: FlightResult[] = [];

    for (const f of this.dataset.flights) {
      const state = states.get(f.id)!;

      // Rebuild the cause chain so the sum always equals delayMinutes
      const causeChain = this.normalizeCauseChain(state);
      const delayBreakdown = this.rebuildBreakdown(causeChain);

      results.push({
        flightId: f.id,
        aircraftId: f.aircraftId,
        origin: f.origin,
        destination: f.destination,
        scheduledDeparture: f.scheduledDeparture,
        scheduledArrival: f.scheduledArrival,
        actualDeparture:
          state.status === FlightStatus.CANCELLED
            ? f.scheduledDeparture
            : state.actualDeparture,
        actualArrival:
          state.status === FlightStatus.CANCELLED
            ? f.scheduledArrival
            : state.actualArrival,
        delayMinutes:
          state.status === FlightStatus.CANCELLED ? 0 : state.delayMinutes,
        status: state.status,
        causeChain,
        delayBreakdown,
        crewId: f.crewId,
        crewTimedOut: state.crewTimedOut,
      });
    }

    return results;
  }

  /**
   * Normalize the cause chain so the sum of all link minutes exactly
   * equals the flight's total departure delay. If there is a remainder
   * (due to overlapping causes or rounding), adjust the last link.
   */
  private normalizeCauseChain(state: FlightWorkingState): CauseChainLink[] {
    if (
      state.status === FlightStatus.CANCELLED ||
      state.delayMinutes === 0
    ) {
      return [];
    }

    const chain = [...state.causeChain];
    if (chain.length === 0 && state.delayMinutes > 0) {
      // Delay with no recorded cause — attribute to weather closure by default
      chain.push({
        flightId: state.flight.id,
        cause: DelayCause.WEATHER_CLOSURE,
        minutes: state.delayMinutes,
        description: `Unattributed delay: ${state.delayMinutes}min`,
      });
      return chain;
    }

    const totalChainMinutes = chain.reduce((sum, link) => sum + link.minutes, 0);
    const diff = state.delayMinutes - totalChainMinutes;

    if (diff !== 0 && chain.length > 0) {
      // Adjust the last link to make the sum exact
      const lastLink = chain[chain.length - 1];
      chain[chain.length - 1] = {
        ...lastLink,
        minutes: Math.max(0, lastLink.minutes + diff),
      };
    }

    // Filter out zero-minute links
    return chain.filter((link) => link.minutes > 0);
  }

  private rebuildBreakdown(
    chain: CauseChainLink[],
  ): Record<DelayCause, number> {
    const bd = emptyBreakdown();
    for (const link of chain) {
      bd[link.cause] += link.minutes;
    }
    return bd;
  }

  // -----------------------------------------------------------------------
  // Internal: evaluate connections
  // -----------------------------------------------------------------------

  private evaluateConnections(
    states: Map<string, FlightWorkingState>,
    _config: SimulationConfig,
  ): ConnectionResult[] {
    return this.dataset.connections.map((conn) => {
      const feeder = states.get(conn.feederFlightId);
      const onward = states.get(conn.onwardFlightId);

      // If either flight is cancelled, connection is missed
      if (
        !feeder ||
        !onward ||
        feeder.status === FlightStatus.CANCELLED ||
        onward.status === FlightStatus.CANCELLED
      ) {
        const reason =
          feeder?.status === FlightStatus.CANCELLED
            ? `Feeder flight ${conn.feederFlightId} cancelled`
            : onward?.status === FlightStatus.CANCELLED
              ? `Onward flight ${conn.onwardFlightId} cancelled`
              : 'Flight not found';

        return {
          connectionId: conn.id,
          feederFlightId: conn.feederFlightId,
          onwardFlightId: conn.onwardFlightId,
          passengerCount: conn.passengerCount,
          missed: true,
          reason,
        };
      }

      // Check minimum connect time
      const availableTime =
        onward.actualDeparture - feeder.actualArrival;
      const missed = availableTime < conn.minimumConnectTime;

      return {
        connectionId: conn.id,
        feederFlightId: conn.feederFlightId,
        onwardFlightId: conn.onwardFlightId,
        passengerCount: conn.passengerCount,
        missed,
        reason: missed
          ? `Insufficient connection time: ${availableTime}min available, ${conn.minimumConnectTime}min required`
          : 'Connection made',
      };
    });
  }

  // -----------------------------------------------------------------------
  // Internal: evaluate crews
  // -----------------------------------------------------------------------

  private evaluateCrews(
    states: Map<string, FlightWorkingState>,
  ): CrewResult[] {
    return this.dataset.crews.map((crew) => {
      const activeFlights = crew.flightIds.filter((fid) => {
        const s = states.get(fid);
        return s && s.status !== FlightStatus.CANCELLED;
      });

      if (activeFlights.length === 0) {
        return {
          crewId: crew.id,
          actualDutyMinutes: 0,
          maxDutyMinutes: crew.maxDutyMinutes,
          timedOut: false,
          affectedFlights: [],
        };
      }

      const firstState = states.get(activeFlights[0])!;
      const lastState = states.get(activeFlights[activeFlights.length - 1])!;

      const dutyStart = Math.min(crew.dutyStartTime, firstState.actualDeparture);
      const dutyEnd = lastState.actualArrival;
      const actualDuty = dutyEnd - dutyStart;
      const timedOut = actualDuty > crew.maxDutyMinutes;

      const affectedFlights = timedOut
        ? activeFlights.filter((fid) => {
            const s = states.get(fid);
            return s && s.crewTimedOut;
          })
        : [];

      return {
        crewId: crew.id,
        actualDutyMinutes: actualDuty,
        maxDutyMinutes: crew.maxDutyMinutes,
        timedOut,
        affectedFlights,
      };
    });
  }

  // -----------------------------------------------------------------------
  // Internal: KPI computation
  // -----------------------------------------------------------------------

  private computeKPIs(
    flights: FlightResult[],
    connections: ConnectionResult[],
    crews: CrewResult[],
  ): SimulationKPIs {
    let delayed = 0;
    let cancelled = 0;
    let onTime = 0;
    let totalDelay = 0;

    for (const f of flights) {
      switch (f.status) {
        case FlightStatus.ON_TIME:
          onTime++;
          break;
        case FlightStatus.DELAYED:
          delayed++;
          totalDelay += f.delayMinutes;
          break;
        case FlightStatus.CANCELLED:
          cancelled++;
          break;
      }
    }

    const missedConnections = connections.filter((c) => c.missed).length;
    const strandedPassengers = connections
      .filter((c) => c.missed)
      .reduce((sum, c) => sum + c.passengerCount, 0);
    const crewViolations = crews.filter((c) => c.timedOut).length;

    const nonCancelledCount = flights.length - cancelled;

    return {
      totalFlights: flights.length,
      delayedFlights: delayed,
      cancelledFlights: cancelled,
      onTimeFlights: onTime,
      totalDelayMinutes: totalDelay,
      averageDelayMinutes:
        nonCancelledCount > 0
          ? Math.round((totalDelay / nonCancelledCount) * 100) / 100
          : 0,
      missedConnections,
      strandedPassengers,
      crewViolations,
    };
  }

  // -----------------------------------------------------------------------
  // Internal: timeline event generation
  // -----------------------------------------------------------------------

  private buildTimeline(
    flights: FlightResult[],
    connections: ConnectionResult[],
    crews: CrewResult[],
  ): TimelineEvent[] {
    const events: TimelineEvent[] = [];

    for (const f of flights) {
      if (f.status === FlightStatus.CANCELLED) {
        events.push({
          time: f.scheduledDeparture,
          flightId: f.flightId,
          eventType: 'CANCELLED',
          description: `${f.flightId} ${f.origin}→${f.destination} CANCELLED`,
        });
        continue;
      }

      if (f.delayMinutes > 0) {
        events.push({
          time: f.scheduledDeparture,
          flightId: f.flightId,
          eventType: 'DELAYED',
          description: `${f.flightId} ${f.origin}→${f.destination} delayed by ${f.delayMinutes}min`,
        });
      }

      events.push({
        time: f.actualDeparture,
        flightId: f.flightId,
        eventType: 'DEPARTURE',
        description: `${f.flightId} departs ${f.origin} → ${f.destination}`,
      });

      events.push({
        time: f.actualArrival,
        flightId: f.flightId,
        eventType: 'ARRIVAL',
        description: `${f.flightId} arrives at ${f.destination}`,
      });
    }

    // Connection miss events
    for (const c of connections) {
      if (c.missed) {
        const feederResult = flights.find(
          (f) => f.flightId === c.feederFlightId,
        );
        const time = feederResult
          ? feederResult.status === FlightStatus.CANCELLED
            ? feederResult.scheduledArrival
            : feederResult.actualArrival
          : 0;

        events.push({
          time,
          flightId: c.onwardFlightId,
          eventType: 'CONNECTION_MISSED',
          description: `${c.passengerCount} pax missed connection ${c.feederFlightId}→${c.onwardFlightId}: ${c.reason}`,
        });
      }
    }

    // Crew timeout events
    for (const crew of crews) {
      if (crew.timedOut && crew.affectedFlights.length > 0) {
        const firstAffectedResult = flights.find(
          (f) => f.flightId === crew.affectedFlights[0],
        );
        events.push({
          time: firstAffectedResult
            ? firstAffectedResult.actualDeparture
            : 0,
          flightId: crew.affectedFlights[0],
          eventType: 'CREW_TIMEOUT',
          description: `Crew ${crew.crewId} exceeded duty limit (${crew.actualDutyMinutes}/${crew.maxDutyMinutes}min)`,
        });
      }
    }

    // Sort by time, then by event type priority for determinism
    const eventTypeOrder: Record<TimelineEvent['eventType'], number> = {
      CANCELLED: 0,
      DELAYED: 1,
      CREW_TIMEOUT: 2,
      DEPARTURE: 3,
      ARRIVAL: 4,
      CONNECTION_MISSED: 5,
    };
    events.sort((a, b) => {
      if (a.time !== b.time) return a.time - b.time;
      if (eventTypeOrder[a.eventType] !== eventTypeOrder[b.eventType])
        return eventTypeOrder[a.eventType] - eventTypeOrder[b.eventType];
      return a.flightId.localeCompare(b.flightId);
    });

    return events;
  }
}
