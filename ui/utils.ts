import { DelayCause, FlightStatus, TimeMinutes } from '../engine/types';

/** Convert minutes-from-midnight to "HH:MM" string */
export function formatTime(minutes: TimeMinutes): string {
  if (minutes < 0) return '--:--';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Parse "HH:MM" string to minutes-from-midnight */
export function parseTime(time: string): TimeMinutes {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
}

/** Format delay as "+Xm" or "On time" */
export function formatDelay(minutes: number): string {
  if (minutes <= 0) return 'On time';
  if (minutes < 60) return `+${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `+${h}h ${m}m` : `+${h}h`;
}

/** Get CSS class for flight status */
export function statusClass(status: FlightStatus): string {
  switch (status) {
    case FlightStatus.ON_TIME: return 'on-time';
    case FlightStatus.DELAYED: return 'delayed';
    case FlightStatus.CANCELLED: return 'cancelled';
    default: return '';
  }
}

/** Get CSS class for delay cause */
export function causeClass(cause: DelayCause): string {
  switch (cause) {
    case DelayCause.WEATHER_CLOSURE: return 'weather';
    case DelayCause.ROTATION_KNOCKON: return 'rotation';
    case DelayCause.CREW_TIMEOUT: return 'crew-timeout';
    case DelayCause.CREW_WAIT: return 'crew-wait';
    case DelayCause.CONNECTION_HOLD: return 'connection';
    default: return '';
  }
}

/** Get CSS colour variable for delay cause */
export function causeColor(cause: DelayCause): string {
  switch (cause) {
    case DelayCause.WEATHER_CLOSURE: return 'var(--cause-weather)';
    case DelayCause.ROTATION_KNOCKON: return 'var(--cause-rotation)';
    case DelayCause.CREW_TIMEOUT: return 'var(--cause-crew-timeout)';
    case DelayCause.CREW_WAIT: return 'var(--cause-crew-wait)';
    case DelayCause.CONNECTION_HOLD: return 'var(--cause-connection)';
    default: return 'var(--text-muted)';
  }
}

/** Human-readable cause label */
export function causeLabel(cause: DelayCause): string {
  switch (cause) {
    case DelayCause.WEATHER_CLOSURE: return 'Weather Closure';
    case DelayCause.ROTATION_KNOCKON: return 'Rotation Knock-on';
    case DelayCause.CREW_TIMEOUT: return 'Crew Timeout';
    case DelayCause.CREW_WAIT: return 'Crew Wait';
    case DelayCause.CONNECTION_HOLD: return 'Connection Hold';
    default: return 'Unknown';
  }
}

/** Human-readable status label */
export function statusLabel(status: FlightStatus): string {
  switch (status) {
    case FlightStatus.ON_TIME: return 'On Time';
    case FlightStatus.DELAYED: return 'Delayed';
    case FlightStatus.CANCELLED: return 'Cancelled';
    default: return 'Unknown';
  }
}

/** Colour for KPI value based on context */
export function kpiValueClass(value: number, thresholds: { warn: number; danger: number }, invert = false): string {
  if (invert) {
    if (value >= thresholds.danger) return 'on-time';
    if (value >= thresholds.warn) return 'delayed';
    return 'cancelled';
  }
  if (value >= thresholds.danger) return 'cancelled';
  if (value >= thresholds.warn) return 'delayed';
  return 'on-time';
}

/** Format a number with commas */
export function formatNumber(n: number): string {
  return n.toLocaleString();
}

/** Clamp a value between min and max */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
