import React, { useEffect, useState } from 'react';
import { TimeMinutes, SimulationResult, FlightStatus } from '../../engine/types';
import { formatTime } from '../utils';

interface CascadeReplayProps {
  currentTime: TimeMinutes;
  onTimeChange: (time: TimeMinutes) => void;
  result: SimulationResult;
}

export const CascadeReplay: React.FC<CascadeReplayProps> = ({ currentTime, onTimeChange, result }) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [speed, setSpeed] = useState<number>(5); // minutes per tick

  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      onTimeChange(Math.min(1439, currentTime + speed));
    }, 100);

    return () => clearInterval(interval);
  }, [isPlaying, speed, onTimeChange]);

  // Compute live point-in-time metrics at currentTime
  const liveStats = React.useMemo(() => {
    let inAirCount = 0;
    let delayedSoFar = 0;
    let cancelledSoFar = 0;
    let strandedPaxSoFar = 0;
    let missedConnSoFar = 0;

    result.flights.forEach((f) => {
      if (f.status === FlightStatus.CANCELLED) {
        if (currentTime >= f.scheduledDeparture) {
          cancelledSoFar++;
        }
      } else {
        if (currentTime >= f.actualDeparture && currentTime < f.actualArrival) {
          inAirCount++;
        }
        if (currentTime >= f.actualDeparture && f.delayMinutes > 15) {
          delayedSoFar++;
        }
      }
    });

    result.connections.forEach((c) => {
      if (c.missed) {
        const feeder = result.flights.find((f) => f.flightId === c.feederFlightId);
        if (feeder && currentTime >= feeder.actualArrival) {
          missedConnSoFar++;
          strandedPaxSoFar += c.passengerCount;
        }
      }
    });

    return { inAirCount, delayedSoFar, cancelledSoFar, missedConnSoFar, strandedPaxSoFar };
  }, [result, currentTime]);

  return (
    <div className="scrubber-bar">
      <button
        className="play-btn"
        onClick={() => setIsPlaying(!isPlaying)}
        title={isPlaying ? 'Pause simulation replay' : 'Play cascade ripple replay'}
      >
        {isPlaying ? '⏸' : '▶'}
      </button>

      <span className="time-display">{formatTime(currentTime)}</span>

      <input
        type="range"
        min="300"
        max="1440"
        step="5"
        value={currentTime}
        onChange={(e) => {
          setIsPlaying(false);
          onTimeChange(Number(e.target.value));
        }}
      />

      {/* Speed controls */}
      <div style={{ display: 'flex', gap: 4 }}>
        {[1, 5, 15, 30].map((s) => (
          <button
            key={s}
            className={`btn-ghost btn-sm ${speed === s ? 'btn-primary' : ''}`}
            style={{ padding: '2px 6px', fontSize: 10, borderRadius: 3 }}
            onClick={() => setSpeed(s)}
          >
            {s}x
          </button>
        ))}
      </div>

      {/* Live ripple stats counter */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          fontSize: 11,
          fontFamily: 'monospace',
          borderLeft: '1px solid #2d3a4a',
          paddingLeft: 12,
          color: '#9ca3af',
        }}
      >
        <span title="Aircraft currently in flight">
          ✈ In-Air: <strong style={{ color: '#a855f7' }}>{liveStats.inAirCount}</strong>
        </span>
        <span title="Flights delayed at this scrubbed time">
          ⏱ Delayed: <strong style={{ color: '#f59e0b' }}>{liveStats.delayedSoFar}</strong>
        </span>
        <span title="Flights cancelled at this scrubbed time">
          ✕ Cancelled: <strong style={{ color: '#ef4444' }}>{liveStats.cancelledSoFar}</strong>
        </span>
        <span title="Stranded connecting passengers at this scrubbed time">
          👥 Stranded: <strong style={{ color: '#f87171' }}>{liveStats.strandedPaxSoFar}</strong>
        </span>
      </div>
    </div>
  );
};
