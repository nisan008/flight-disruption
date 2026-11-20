/**
 * Domino Sky — Flight Disruption Simulation Engine
 * Shared type definitions
 *
 * All times are expressed as minutes from midnight (0–1439).
 * Every type is pure data — no methods, no side-effects.
 */

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

/** Minutes from midnight. Valid range: 0–1439. */
export type TimeMinutes = number;

/** Status a flight can be in after simulation. */
export enum FlightStatus {
  ON_TIME = 'ON_TIME',
  DELAYED = 'DELAYED',
  CANCELLED = 'CANCELLED',
}

/** Root causes that can contribute to a delay. */
export enum DelayCause {
  /** Airport closed due to weather / ATC — departure or arrival blocked. */
  WEATHER_CLOSURE = 'WEATHER_CLOSURE',
  /** Previous leg in aircraft rotation arrived late. */
  ROTATION_KNOCKON = 'ROTATION_KNOCKON',
  /** Crew duty time exceeded legal limit — flight needs replacement crew. */
  CREW_TIMEOUT = 'CREW_TIMEOUT',
  /** Waiting for crew to arrive from a delayed inbound. */
  CREW_WAIT = 'CREW_WAIT',
  /** Onward flight held for connecting passengers. */
  CONNECTION_HOLD = 'CONNECTION_HOLD',
}

// ---------------------------------------------------------------------------
// Domain entities
// ---------------------------------------------------------------------------

/** An airport used in the simulation. */
export interface Airport {
  /** IATA code, e.g. "BOM". */
  code: string;
  /** Full name, e.g. "Chhatrapati Shivaji Maharaj International Airport". */
  name: string;
  /** City name. */
  city: string;
  /** Latitude in decimal degrees. */
  lat: number;
  /** Longitude in decimal degrees. */
  lng: number;
}

/** A single flight in the daily schedule. */
export interface Flight {
  /** Unique identifier, e.g. "AI-612". */
  id: string;
  /** Tail number, e.g. "VT-ABC". */
  aircraftId: string;
  /** Origin airport IATA code. */
  origin: string;
  /** Destination airport IATA code. */
  destination: string;
  /** Scheduled departure (minutes from midnight). */
  scheduledDeparture: TimeMinutes;
  /** Scheduled arrival (minutes from midnight). */
  scheduledArrival: TimeMinutes;
  /** Number of passengers booked on this flight. */
  passengerCount: number;
  /** 0-based position in the aircraft's daily rotation. */
  sequenceInRotation: number;
  /** ID of the crew operating this flight. */
  crewId: string;
}

/** An aircraft with its ordered rotation (list of flight IDs). */
export interface Aircraft {
  /** Tail number, e.g. "VT-ABC". */
  id: string;
  /** Type designation, e.g. "A320". */
  type: string;
  /** Ordered list of flight IDs this aircraft operates today. */
  rotation: string[];
  /** Airport where the aircraft starts the day. */
  baseAirport: string;
}

/** Passengers connecting from one flight to another. */
export interface Connection {
  /** Unique connection identifier. */
  id: string;
  /** ID of the inbound (feeder) flight. */
  feederFlightId: string;
  /** ID of the outbound (onward) flight. */
  onwardFlightId: string;
  /** Number of connecting passengers. */
  passengerCount: number;
  /** Minimum connection time in minutes. */
  minimumConnectTime: number;
  /** Airport where the connection takes place. */
  connectionAirport: string;
}

/** A crew assignment for a set of flights. */
export interface Crew {
  /** Unique crew identifier. */
  id: string;
  /** Ordered list of flight IDs this crew operates. */
  flightIds: string[];
  /** When this crew's duty window opens (minutes from midnight). */
  dutyStartTime: TimeMinutes;
  /** Maximum legal duty time in minutes (typically 660 = 11 h). */
  maxDutyMinutes: number;
  /** Home base airport. */
  baseAirport: string;
}

/** A spare aircraft parked at an airport. */
export interface Spare {
  /** Tail number of the spare aircraft. */
  aircraftId: string;
  /** Airport where the spare is parked. */
  airport: string;
  /** Earliest time the spare can be used (minutes from midnight). */
  availableFrom: TimeMinutes;
  /** Aircraft type designation. */
  type: string;
}

// ---------------------------------------------------------------------------
// Disruption inputs
// ---------------------------------------------------------------------------

/** A period during which an airport is closed. */
export interface AirportClosure {
  /** IATA code of the closed airport. */
  airport: string;
  /** Closure start (inclusive), minutes from midnight. */
  startTime: TimeMinutes;
  /** Closure end (exclusive), minutes from midnight. */
  endTime: TimeMinutes;
}

// ---------------------------------------------------------------------------
// Simulation results
// ---------------------------------------------------------------------------

/** A single link in the delay cause chain. */
export interface CauseChainLink {
  /** The flight that contributed to this link. */
  flightId: string;
  /** Type of delay cause. */
  cause: DelayCause;
  /** Minutes of delay contributed by this link. */
  minutes: number;
  /** Human-readable description. */
  description: string;
}

/** Simulation result for a single flight. */
export interface FlightResult {
  flightId: string;
  aircraftId: string;
  origin: string;
  destination: string;
  scheduledDeparture: TimeMinutes;
  scheduledArrival: TimeMinutes;
  actualDeparture: TimeMinutes;
  actualArrival: TimeMinutes;
  delayMinutes: number;
  status: FlightStatus;
  causeChain: CauseChainLink[];
  /** Minutes of delay attributed to each cause type. */
  delayBreakdown: Record<DelayCause, number>;
  crewId: string;
  crewTimedOut: boolean;
}

/** Result for a single passenger connection. */
export interface ConnectionResult {
  connectionId: string;
  feederFlightId: string;
  onwardFlightId: string;
  passengerCount: number;
  missed: boolean;
  reason: string;
}

/** Crew duty outcome. */
export interface CrewResult {
  crewId: string;
  actualDutyMinutes: number;
  maxDutyMinutes: number;
  timedOut: boolean;
  affectedFlights: string[];
}

/** Aggregate KPIs for a simulation run. */
export interface SimulationKPIs {
  totalFlights: number;
  delayedFlights: number;
  cancelledFlights: number;
  onTimeFlights: number;
  totalDelayMinutes: number;
  averageDelayMinutes: number;
  missedConnections: number;
  strandedPassengers: number;
  crewViolations: number;
}

/** An event on the replay timeline. */
export interface TimelineEvent {
  time: TimeMinutes;
  flightId: string;
  eventType:
    | 'DEPARTURE'
    | 'ARRIVAL'
    | 'DELAYED'
    | 'CANCELLED'
    | 'CONNECTION_MISSED'
    | 'CREW_TIMEOUT';
  description: string;
}

/** Full output of a simulation run. */
export interface SimulationResult {
  flights: FlightResult[];
  connections: ConnectionResult[];
  crews: CrewResult[];
  kpis: SimulationKPIs;
  timelineEvents: TimelineEvent[];
}

// ---------------------------------------------------------------------------
// Simulation configuration
// ---------------------------------------------------------------------------

/** Configuration knobs for a simulation run. */
export interface SimulationConfig {
  /** Delay (minutes) beyond which a flight is cancelled instead of delayed. Default 180. */
  cancellationThresholdMinutes: number;
  /** Minimum turnaround time between consecutive flights in a rotation. Default 30. */
  minimumTurnaroundMinutes: number;
  /** Airport closures to inject into the simulation. */
  closures: AirportClosure[];
}

// ---------------------------------------------------------------------------
// Dataset (complete input)
// ---------------------------------------------------------------------------

/** The full dataset consumed by the simulation engine. */
export interface Dataset {
  airports: Airport[];
  flights: Flight[];
  aircraft: Aircraft[];
  connections: Connection[];
  crews: Crew[];
  spares: Spare[];
}

// ---------------------------------------------------------------------------
// Recovery types
// ---------------------------------------------------------------------------

/** Types of recovery actions. */
export enum RecoveryActionType {
  CANCEL_FLIGHT = 'CANCEL_FLIGHT',
  SWAP_SPARE = 'SWAP_SPARE',
  SWAP_AIRCRAFT = 'SWAP_AIRCRAFT',
  HOLD_CONNECTION = 'HOLD_CONNECTION',
  REASSIGN_CREW = 'REASSIGN_CREW',
}

/** A single recovery action to apply before re-simulation. */
export interface RecoveryAction {
  id: string;
  type: RecoveryActionType;
  description: string;
  /** Action-specific parameters. */
  params: Record<string, unknown>;
}

/** A candidate action with its simulated outcome and delta metrics. */
export interface RecoveryCandidate {
  action: RecoveryAction;
  resultAfter: SimulationResult;
  delta: {
    delayMinutesDelta: number;
    cancellationsDelta: number;
    strandedPassengersDelta: number;
    crewViolationsDelta: number;
    costScore: number;
  };
}

/** Weights for the multi-dimensional cost function. */
export interface CostWeights {
  /** Cost per minute of delay. Default 1. */
  delayMinuteWeight: number;
  /** Cost per cancellation. Default 500. */
  cancellationWeight: number;
  /** Cost per stranded passenger. Default 50. */
  strandedPassengerWeight: number;
  /** Cost per crew violation. Default 300. */
  crewViolationWeight: number;
}

/** "Patient Zero" — ranking of closures by downstream impact. */
export interface PatientZero {
  closureDescription: string;
  airport: string;
  startTime: TimeMinutes;
  endTime: TimeMinutes;
  totalDownstreamDelayMinutes: number;
  totalStrandedPassengers: number;
  affectedFlightCount: number;
  affectedFlightIds: string[];
}

// ---------------------------------------------------------------------------
// Snapshot (for replay)
// ---------------------------------------------------------------------------

/** Point-in-time snapshot of the simulation state. */
export interface TimeSnapshot {
  time: TimeMinutes;
  flightStates: Map<
    string,
    | 'scheduled'
    | 'boarding'
    | 'departed'
    | 'in-air'
    | 'arrived'
    | 'delayed'
    | 'cancelled'
  >;
  currentKPIs: SimulationKPIs;
}
