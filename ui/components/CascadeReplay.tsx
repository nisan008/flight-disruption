import React, { useEffect, useState, useMemo } from 'react';
import { TimeMinutes, SimulationResult, FlightStatus } from '../../engine/types';
import { formatTime } from '../utils';

interface CascadeReplayProps {
  currentTime: TimeMinutes;
  onTimeChange: (time: TimeMinutes) => void;
  result: SimulationResult;
}

export const CascadeReplay: React.FC<CascadeReplayProps> = React.memo(({ currentTime, onTimeChange, result }) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [speed, setSpeed] = useState<number>(5);

  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      onTimeChange(Math.min(1439, currentTime + speed));
    }, 100);

    return () => clearInterval(interval);
  }, [isPlaying, speed, currentTime, onTimeChange]);

  const liveStats = useMemo(() => {
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
    <footer className="scrubber-bar" role="region" aria-label="Cascade Replay Timeline Controls">
      <button
        className="play-btn"
        onClick={() => setIsPlaying(!isPlaying)}
        aria-label={isPlaying ? 'Pause simulation replay' : 'Play cascade ripple replay'}
        title={isPlaying ? 'Pause replay (Space)' : 'Play cascade ripple replay (Space)'}
      >
        <span aria-hidden="true">{isPlaying ? '⏸' : '▶'}</span>
      </button>

      <span className="time-display" aria-hidden="true">
        {formatTime(currentTime)}
      </span>

      <input
        type="range"
        min="300"
        max="1440"
        step="5"
        value={currentTime}
        aria-label="Simulation Time Scrubber"
        aria-valuemin={300}
        aria-valuemax={1440}
        aria-valuenow={currentTime}
        aria-valuetext={`Simulated time: ${formatTime(currentTime)}`}
        onChange={(e) => {
          setIsPlaying(false);
          onTimeChange(Number(e.target.value));
        }}
      />

      {/* Speed controls */}
      <div role="group" aria-label="Playback speed" style={{ display: 'flex', gap: 4 }}>
        {[1, 5, 15, 30].map((s) => (
          <button
            key={s}
            className={`btn-ghost btn-sm ${speed === s ? 'btn-primary' : ''}`}
            style={{ padding: '3px 7px', fontSize: 10, borderRadius: 3 }}
            onClick={() => setSpeed(s)}
            aria-pressed={speed === s}
            aria-label={`${s} times real-time speed`}
          >
            {s}x
          </button>
        ))}
      </div>

      {/* Live ripple stats counter with ARIA live region */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          fontSize: 11,
          fontFamily: 'monospace',
          borderLeft: '1px solid #2d3a4a',
          paddingLeft: 12,
          color: '#cbd5e1',
        }}
        aria-live="polite"
        aria-atomic="true"
      >
        <span title="Aircraft currently in flight">
          ✈ In-Air: <strong style={{ color: '#c084fc' }}>{liveStats.inAirCount}</strong>
        </span>
        <span title="Flights delayed at this scrubbed time">
          ⏱ Delayed: <strong style={{ color: '#fbbf24' }}>{liveStats.delayedSoFar}</strong>
        </span>
        <span title="Flights cancelled at this scrubbed time">
          ✕ Cancelled: <strong style={{ color: '#f87171' }}>{liveStats.cancelledSoFar}</strong>
        </span>
        <span title="Stranded connecting passengers at this scrubbed time">
          👥 Stranded: <strong style={{ color: '#f87171' }}>{liveStats.strandedPaxSoFar}</strong>
        </span>
      </div>
    </footer>
  );
});
