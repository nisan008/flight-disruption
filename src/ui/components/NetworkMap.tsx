import React, { useMemo } from 'react';
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
  // Invert Y because latitude increases northward while SVG Y increases downward
  const y = SVG_HEIGHT - (PADDING + ((lat - MIN_LAT) / (MAX_LAT - MIN_LAT)) * (SVG_HEIGHT - 2 * PADDING));
  return [x, y];
}

export const NetworkMap: React.FC<NetworkMapProps> = ({
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

  // Determine which airports are closed right now at currentTime
  const activeClosures = useMemo(() => {
    return closures.filter((c) => currentTime >= c.startTime && currentTime < c.endTime);
  }, [closures, currentTime]);

  const activeClosureAirports = useMemo(
    () => new Set(activeClosures.map((c) => c.airport)),
    [activeClosures]
  );

  return (
    <div className="network-map" style={{ width: '100%', height: '100%', position: 'relative' }}>
      <svg
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ width: '100%', height: '100%', background: '#0a0e17' }}
      >
        <defs>
          {/* Subtle grid pattern */}
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
          </pattern>

          {/* Radar sweep glow */}
          <radialGradient id="radarPulse" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(239, 68, 68, 0.4)" />
            <stop offset="70%" stopColor="rgba(239, 68, 68, 0.15)" />
            <stop offset="100%" stopColor="rgba(239, 68, 68, 0)" />
          </radialGradient>

          {/* Glow filter for active aircraft */}
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        <rect width="100%" height="100%" fill="url(#grid)" />

        {/* 1. Closed Airport Ripple Animations */}
        {airports.map((apt) => {
          const isClosedNow = activeClosureAirports.has(apt.code);
          if (!isClosedNow) return null;
          const [cx, cy] = project(apt.lat, apt.lng);
          return (
            <g key={`ripple-${apt.code}`}>
              <circle cx={cx} cy={cy} r="25" fill="url(#radarPulse)">
                <animate attributeName="r" values="10;45;60" dur="2s" repeatCount="indefinite" />
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

          // Quadratic curve midpoint with perpendicular curvature offset
          const dx = x2 - x1;
          const dy = y2 - y1;
          const dist = Math.hypot(dx, dy);
          const mx = (x1 + x2) / 2;
          const my = (y1 + y2) / 2;
          // Perpendicular offset proportional to distance
          const offset = Math.min(60, dist * 0.15);
          const cx = mx - (dy / dist) * offset;
          const cy = my + (dx / dist) * offset;

          const pathD = `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;

          // Temporal state relative to currentTime
          const isCancelled = flight.status === FlightStatus.CANCELLED;
          const hasDeparted = !isCancelled && currentTime >= flight.actualDeparture;
          const hasArrived = !isCancelled && currentTime >= flight.actualArrival;
          const isInAir = hasDeparted && !hasArrived;
          const isSelected = flight.flightId === selectedFlightId;

          let strokeColor = 'rgba(74, 144, 217, 0.2)'; // future scheduled
          let strokeWidth = 1.2;
          let strokeDasharray = undefined;

          if (isCancelled) {
            strokeColor = 'rgba(239, 68, 68, 0.4)';
            strokeDasharray = '4 4';
          } else if (isInAir) {
            strokeColor = '#a855f7'; // purple glow for active in-air flight
            strokeWidth = 2.5;
          } else if (hasArrived) {
            strokeColor = flight.delayMinutes > 15 ? 'rgba(245, 158, 11, 0.4)' : 'rgba(34, 197, 94, 0.35)';
          }

          if (isSelected) {
            strokeColor = '#38bdf8';
            strokeWidth = 3;
          }

          // Calculate current aircraft position along the Bezier curve if in-air
          let planeX = 0;
          let planeY = 0;
          if (isInAir) {
            const flightTime = flight.actualArrival - flight.actualDeparture;
            const progress = flightTime > 0 ? (currentTime - flight.actualDeparture) / flightTime : 0;
            const t = Math.max(0, Math.min(1, progress));
            // Bézier curve equation B(t) = (1-t)^2 P0 + 2(1-t)t P1 + t^2 P2
            planeX = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * cx + t * t * x2;
            planeY = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * cy + t * t * y2;
          }

          return (
            <g key={flight.flightId} onClick={() => onSelectFlight(flight.flightId)} style={{ cursor: 'pointer' }}>
              <path
                d={pathD}
                fill="none"
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                strokeDasharray={strokeDasharray}
                className="flight-arc"
              />

              {/* If flight is currently in air, render moving aircraft icon */}
              {isInAir && (
                <g transform={`translate(${planeX}, ${planeY})`} filter="url(#glow)">
                  <circle r="4" fill="#c084fc" />
                  <circle r="7" fill="none" stroke="#a855f7" strokeWidth="1.5">
                    <animate attributeName="r" values="4;8;12" dur="1.5s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="1;0.4;0" dur="1.5s" repeatCount="indefinite" />
                  </circle>
                  <text
                    x="8"
                    y="3"
                    fill="#e0e7ff"
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

          // Count flights related to this airport
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
              style={{ cursor: 'pointer' }}
            >
              {/* Outer selection ring */}
              {isSelected && (
                <circle r="12" fill="none" stroke="#60a5fa" strokeWidth="2" strokeDasharray="3 3" />
              )}

              {/* Airport dot */}
              <circle
                r={isClosed ? 6 : 5}
                fill={dotColor}
                stroke="#0a0e17"
                strokeWidth="1.5"
                className="airport-dot"
              />

              {/* Label */}
              <text
                x="0"
                y="-9"
                fill={isClosed ? '#f87171' : isSelected ? '#93c5fd' : '#cbd5e1'}
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

      {/* Floating map status overlay */}
      <div
        style={{
          position: 'absolute',
          bottom: 12,
          left: 12,
          background: 'rgba(17, 24, 39, 0.85)',
          padding: '6px 12px',
          borderRadius: 6,
          border: '1px solid #2d3a4a',
          fontSize: 11,
          fontFamily: 'monospace',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          gap: 12,
          alignItems: 'center',
        }}
      >
        <span>
          Simulated Clock: <strong style={{ color: '#60a5fa' }}>{formatTime(currentTime)}</strong>
        </span>
        {activeClosures.length > 0 && (
          <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#ef4444' }} />
            {activeClosures.map((c) => c.airport).join(', ')} Closed
          </span>
        )}
      </div>
    </div>
  );
};
