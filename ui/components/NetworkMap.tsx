import React, { useMemo, useCallback } from 'react';
import { Airport, FlightResult, AirportClosure, TimeMinutes, FlightStatus } from '../../engine/types';
import { formatTime } from '../utils';

interface NetworkMapProps {
  airports: Airport[];
  flights: FlightResult[];
  closures: AirportClosure[];
  currentTime: TimeMinutes;
  selectedAirport: string;
  onSelectAirport: (code: string) => void;
  selectedFlightId: string | null;
  onSelectFlight: (id: string) => void;
}

// Bounding box for Indian airspace projection
const MIN_LAT = 7.5;
const MAX_LAT = 33.0;
const MIN_LNG = 68.0;
const MAX_LNG = 94.0;
const SVG_WIDTH = 800;
const SVG_HEIGHT = 650;
const PADDING = 40;

function project(lat: number, lng: number): [number, number] {
  const x = PADDING + ((lng - MIN_LNG) / (MAX_LNG - MIN_LNG)) * (SVG_WIDTH - 2 * PADDING);
  const y = SVG_HEIGHT - (PADDING + ((lat - MIN_LAT) / (MAX_LAT - MIN_LAT)) * (SVG_HEIGHT - 2 * PADDING));
  return [x, y];
}

export const NetworkMap: React.FC<NetworkMapProps> = React.memo(({
  airports,
  flights,
  closures,
  currentTime,
  selectedAirport,
  onSelectAirport,
  selectedFlightId,
  onSelectFlight,
}) => {
  const airportMap = useMemo(() => new Map(airports.map((a) => [a.code, a])), [airports]);

  const activeClosures = useMemo(() => {
    return closures.filter((c) => currentTime >= c.startTime && currentTime < c.endTime);
  }, [closures, currentTime]);

  const activeClosureAirports = useMemo(
    () => new Set(activeClosures.map((c) => c.airport)),
    [activeClosures]
  );

  const handleAirportKeyDown = useCallback((e: React.KeyboardEvent, code: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelectAirport(code);
    }
  }, [onSelectAirport]);

  const handleFlightKeyDown = useCallback((e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelectFlight(id);
    }
  }, [onSelectFlight]);

  return (
    <section
      className="network-map"
      aria-label="Interactive Airspace Radar Map of India"
      style={{ width: '100%', height: '100%', position: 'relative' }}
    >
      <svg
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ width: '100%', height: '100%', background: '#0a0e17' }}
        role="img"
        aria-labelledby="radar-map-title radar-map-desc"
      >
        <title id="radar-map-title">Indian Domestic Airspace Radar Map</title>
        <desc id="radar-map-desc">
          Geographical map displaying 16 Indian airports, active flight paths, simulated closures, and delay ripples.
        </desc>

        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
          </pattern>

          <radialGradient id="radarPulse" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(239, 68, 68, 0.45)" />
            <stop offset="70%" stopColor="rgba(239, 68, 68, 0.15)" />
            <stop offset="100%" stopColor="rgba(239, 68, 68, 0)" />
          </radialGradient>

          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        <rect width="100%" height="100%" fill="url(#grid)" />

        {/* 1. Closed Airport Disruption Ripples */}
        {airports.map((apt) => {
          const isClosedNow = activeClosureAirports.has(apt.code);
          if (!isClosedNow) return null;
          const [cx, cy] = project(apt.lat, apt.lng);
          return (
            <g key={`ripple-${apt.code}`} aria-hidden="true">
              <circle cx={cx} cy={cy} r="25" fill="url(#radarPulse)">
                <animate attributeName="r" values="10;45;65" dur="2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.8;0.3;0" dur="2s" repeatCount="indefinite" />
              </circle>
              <circle cx={cx} cy={cy} r="18" fill="none" stroke="#ef4444" strokeWidth="1.5" opacity="0.6">
                <animate attributeName="r" values="8;30;45" dur="2s" begin="0.5s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.7;0.2;0" dur="2s" begin="0.5s" repeatCount="indefinite" />
              </circle>
            </g>
          );
        })}

        {/* 2. Flight Arcs */}
        {flights.map((flight) => {
          const orig = airportMap.get(flight.origin);
          const dest = airportMap.get(flight.destination);
          if (!orig || !dest) return null;

          const [x1, y1] = project(orig.lat, orig.lng);
          const [x2, y2] = project(dest.lat, dest.lng);

          const dx = x2 - x1;
          const dy = y2 - y1;
          const dist = Math.hypot(dx, dy);
          const mx = (x1 + x2) / 2;
          const my = (y1 + y2) / 2;
          const offset = Math.min(60, dist * 0.15);
          const cx = mx - (dy / dist) * offset;
          const cy = my + (dx / dist) * offset;

          const pathD = `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;

          const isCancelled = flight.status === FlightStatus.CANCELLED;
          const hasDeparted = !isCancelled && currentTime >= flight.actualDeparture;
          const hasArrived = !isCancelled && currentTime >= flight.actualArrival;
          const isInAir = hasDeparted && !hasArrived;
          const isSelected = flight.flightId === selectedFlightId;

          let strokeColor = 'rgba(74, 144, 217, 0.25)';
          let strokeWidth = 1.2;
          let strokeDasharray = undefined;

          if (isCancelled) {
            strokeColor = 'rgba(239, 68, 68, 0.45)';
            strokeDasharray = '4 4';
          } else if (isInAir) {
            strokeColor = '#c084fc';
            strokeWidth = 2.5;
          } else if (hasArrived) {
            strokeColor = flight.delayMinutes > 15 ? 'rgba(245, 158, 11, 0.45)' : 'rgba(34, 197, 94, 0.4)';
          }

          if (isSelected) {
            strokeColor = '#38bdf8';
            strokeWidth = 3.5;
          }

          let planeX = 0;
          let planeY = 0;
          if (isInAir) {
            const flightTime = flight.actualArrival - flight.actualDeparture;
            const progress = flightTime > 0 ? (currentTime - flight.actualDeparture) / flightTime : 0;
            const t = Math.max(0, Math.min(1, progress));
            planeX = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * cx + t * t * x2;
            planeY = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * cy + t * t * y2;
          }

          return (
            <g
              key={flight.flightId}
              onClick={() => onSelectFlight(flight.flightId)}
              onKeyDown={(e) => handleFlightKeyDown(e, flight.flightId)}
              tabIndex={0}
              role="button"
              aria-label={`Flight ${flight.flightId} from ${flight.origin} to ${flight.destination}. Status: ${flight.status}, Delay: ${flight.delayMinutes} minutes.`}
              style={{ cursor: 'pointer' }}
            >
              <path
                d={pathD}
                fill="none"
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                strokeDasharray={strokeDasharray}
                className="flight-arc"
              />

              {isInAir && (
                <g transform={`translate(${planeX}, ${planeY})`} filter="url(#glow)" aria-hidden="true">
                  <circle r="4" fill="#e9d5ff" />
                  <circle r="7" fill="none" stroke="#c084fc" strokeWidth="1.5">
                    <animate attributeName="r" values="4;8;12" dur="1.5s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="1;0.4;0" dur="1.5s" repeatCount="indefinite" />
                  </circle>
                  <text
                    x="8"
                    y="3"
                    fill="#f3f4f6"
                    fontSize="9"
                    fontFamily="monospace"
                    fontWeight="bold"
                    style={{ pointerEvents: 'none' }}
                  >
                    {flight.flightId}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* 3. Airports */}
        {airports.map((apt) => {
          const [x, y] = project(apt.lat, apt.lng);
          const isSelected = apt.code === selectedAirport;
          const isClosed = activeClosureAirports.has(apt.code);

          const relatedDelayed = flights.filter(
            (f) => (f.origin === apt.code || f.destination === apt.code) && f.status === FlightStatus.DELAYED
          ).length;

          let dotColor = '#3b82f6';
          if (isClosed) dotColor = '#ef4444';
          else if (relatedDelayed > 2) dotColor = '#f59e0b';
          else dotColor = '#22c55e';

          return (
            <g
              key={apt.code}
              className="airport-node"
              transform={`translate(${x}, ${y})`}
              onClick={() => onSelectAirport(apt.code)}
              onKeyDown={(e) => handleAirportKeyDown(e, apt.code)}
              tabIndex={0}
              role="button"
              aria-label={`${apt.code} - ${apt.city} Airport (${apt.name}). Status: ${isClosed ? 'Closed due to weather/ATC' : 'Operational'}. Click to target for disruption.`}
            >
              {isSelected && (
                <circle r="13" fill="none" stroke="#38bdf8" strokeWidth="2" strokeDasharray="3 3" />
              )}

              <circle
                r={isClosed ? 6.5 : 5}
                fill={dotColor}
                stroke="#0a0e17"
                strokeWidth="1.5"
                className="airport-dot"
              />

              <text
                x="0"
                y="-9"
                fill={isClosed ? '#fca5a5' : isSelected ? '#93c5fd' : '#f3f4f6'}
                fontSize="10"
                fontFamily="monospace"
                fontWeight="700"
                textAnchor="middle"
              >
                {apt.code}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Map status overlay */}
      <div
        style={{
          position: 'absolute',
          bottom: 12,
          left: 12,
          background: 'rgba(17, 24, 39, 0.9)',
          padding: '6px 12px',
          borderRadius: 6,
          border: '1px solid #2d3a4a',
          fontSize: 11,
          fontFamily: 'monospace',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          color: '#e5e7eb',
        }}
        aria-live="polite"
      >
        <span>
          Clock: <strong style={{ color: '#38bdf8' }}>{formatTime(currentTime)}</strong>
        </span>
        {activeClosures.length > 0 ? (
          <span style={{ color: '#f87171', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#ef4444' }} />
            {activeClosures.map((c) => c.airport).join(', ')} Closed
          </span>
        ) : (
          <span style={{ color: '#4ade80' }}>All 16 Airports Open</span>
        )}
      </div>
    </section>
  );
});
