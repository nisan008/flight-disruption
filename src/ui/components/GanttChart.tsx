import React from 'react';
import { Aircraft, FlightResult, TimeMinutes, FlightStatus } from '../../engine/types';
import { formatTime } from '../utils';

interface GanttChartProps {
  aircraft: Aircraft[];
  flights: FlightResult[];
  currentTime: TimeMinutes;
  selectedFlightId: string | null;
  onSelectFlight: (id: string) => void;
}

const START_MIN = 360; // 06:00
const END_MIN = 1440;  // 24:00
const TOTAL_MIN = END_MIN - START_MIN;

export const GanttChart: React.FC<GanttChartProps> = ({
  aircraft,
  flights,
  currentTime,
  selectedFlightId,
  onSelectFlight,
}) => {
  const flightMap = React.useMemo(() => new Map(flights.map((f) => [f.flightId, f])), [flights]);

  // Generate hour tick marks
  const hourTicks = React.useMemo(() => {
    const ticks: number[] = [];
    for (let h = 6; h <= 24; h += 2) {
      ticks.push(h * 60);
    }
    return ticks;
  }, []);

  const getLeftPct = (time: number) => {
    return Math.max(0, Math.min(100, ((time - START_MIN) / TOTAL_MIN) * 100));
  };

  const getWidthPct = (start: number, end: number) => {
    const width = ((end - start) / TOTAL_MIN) * 100;
    return Math.max(0.5, width);
  };

  return (
    <div className="gantt-container" style={{ background: '#111827', position: 'relative' }}>
      {/* Time header markers */}
      <div className="gantt-time-markers">
        {hourTicks.map((tick) => (
          <div
            key={tick}
            className="gantt-time-marker"
            style={{ width: `${(120 / TOTAL_MIN) * 100}%`, textAlign: 'left' }}
          >
            {formatTime(tick)}
          </div>
        ))}
      </div>

      <div className="gantt-chart" style={{ position: 'relative' }}>
        {/* Scrubber vertical current time cursor */}
        {currentTime >= START_MIN && currentTime <= END_MIN && (
          <div
            style={{
              position: 'absolute',
              left: `calc(70px + ${getLeftPct(currentTime)}% * (100% - 70px) / 100)`,
              top: 0,
              bottom: 0,
              width: 2,
              background: '#60a5fa',
              zIndex: 20,
              pointerEvents: 'none',
              boxShadow: '0 0 8px #3b82f6',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: -16,
                left: -20,
                background: '#3b82f6',
                color: 'white',
                fontSize: 9,
                padding: '1px 4px',
                borderRadius: 2,
                fontFamily: 'monospace',
              }}
            >
              {formatTime(currentTime)}
            </div>
          </div>
        )}

        {/* Rows for each aircraft rotation */}
        {aircraft.map((ac) => {
          return (
            <div key={ac.id} className="gantt-row">
              <div className="gantt-label" title={`${ac.id} (${ac.baseAirport})`}>
                {ac.id}
              </div>

              <div className="gantt-timeline">
                {ac.rotation.map((fId) => {
                  const flight = flightMap.get(fId);
                  if (!flight) return null;

                  const isSelected = flight.flightId === selectedFlightId;
                  const isCancelled = flight.status === FlightStatus.CANCELLED;

                  // Scheduled flight block
                  const schedLeft = getLeftPct(flight.scheduledDeparture);
                  const schedWidth = getWidthPct(flight.scheduledDeparture, flight.scheduledArrival);

                  // Actual flight block
                  const actLeft = getLeftPct(flight.actualDeparture);
                  const actWidth = getWidthPct(flight.actualDeparture, flight.actualArrival);

                  let blockClass = 'on-time';
                  if (isCancelled) blockClass = 'cancelled';
                  else if (flight.delayMinutes > 15) blockClass = 'delayed';

                  return (
                    <React.Fragment key={flight.flightId}>
                      {/* Ghost bar of original schedule if delayed */}
                      {flight.delayMinutes > 0 && !isCancelled && (
                        <div
                          style={{
                            position: 'absolute',
                            left: `${schedLeft}%`,
                            width: `${schedWidth}%`,
                            top: 8,
                            height: 16,
                            border: '1px dashed rgba(255,255,255,0.2)',
                            borderRadius: 3,
                            pointerEvents: 'none',
                          }}
                        />
                      )}

                      {/* Actual flight bar */}
                      <div
                        className={`gantt-block ${blockClass}`}
                        style={{
                          left: `${isCancelled ? schedLeft : actLeft}%`,
                          width: `${isCancelled ? schedWidth : actWidth}%`,
                          outline: isSelected ? '2px solid #38bdf8' : undefined,
                          boxShadow: isSelected ? '0 0 10px rgba(56, 189, 248, 0.5)' : undefined,
                        }}
                        onClick={() => onSelectFlight(flight.flightId)}
                        title={`${flight.flightId} (${flight.origin}→${flight.destination})
Sched: ${formatTime(flight.scheduledDeparture)} - ${formatTime(flight.scheduledArrival)}
Actual: ${isCancelled ? 'CANCELLED' : `${formatTime(flight.actualDeparture)} - ${formatTime(flight.actualArrival)}`}
Delay: +${flight.delayMinutes}m`}
                      >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 2px' }}>
                          {flight.flightId}
                        </span>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
