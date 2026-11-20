import React, { useState, useId } from 'react';
import { Airport, AirportClosure } from '../../engine/types';
import { formatTime } from '../utils';

interface DisruptionControlsProps {
  airports: Airport[];
  selectedAirport: string;
  onSelectAirport: (code: string) => void;
  closures: AirportClosure[];
  onAddClosure: (closure: AirportClosure) => void;
  onRemoveClosure: (index: number) => void;
  onClearClosures: () => void;
  onSeedDemo: () => void;
  cancellationThreshold: number;
  onChangeCancellationThreshold: (val: number) => void;
}

export const DisruptionControls: React.FC<DisruptionControlsProps> = ({
  airports,
  selectedAirport,
  onSelectAirport,
  closures,
  onAddClosure,
  onRemoveClosure,
  onClearClosures,
  onSeedDemo,
  cancellationThreshold,
  onChangeCancellationThreshold,
}) => {
  const [startTime, setStartTime] = useState<number>(840);
  const [duration, setDuration] = useState<number>(90);

  const airportSelectId = useId();
  const startTimeId = useId();
  const durationId = useId();
  const thresholdId = useId();

  const handleAdd = () => {
    onAddClosure({
      airport: selectedAirport,
      startTime,
      endTime: startTime + duration,
    });
  };

  return (
    <section className="disruption-panel" aria-label="Disruption Injection Controls">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>⚡ Inject Disruption</h3>
        <button
          className="btn btn-sm btn-ghost"
          onClick={onSeedDemo}
          title="Pre-seeds Mumbai 14:00 90-min storm for rapid 2-minute demonstration"
          aria-label="Seed demo scenario: Mumbai storm at 14:00 for 90 minutes"
          style={{
            background: 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(168,85,247,0.2))',
            borderColor: '#60a5fa',
            color: '#93c5fd',
          }}
        >
          ★ Seed Demo (BOM 14:00)
        </button>
      </div>

      <div className="control-group">
        <label htmlFor={airportSelectId}>Target Airport</label>
        <select
          id={airportSelectId}
          value={selectedAirport}
          onChange={(e) => onSelectAirport(e.target.value)}
          aria-label="Select airport to inject weather closure"
        >
          {airports.map((apt) => (
            <option key={apt.code} value={apt.code}>
              {apt.code} - {apt.city} ({apt.name.split(' ')[0]})
            </option>
          ))}
        </select>
      </div>

      <div className="control-group">
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <label htmlFor={startTimeId}>Closure Start Time</label>
          <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#38bdf8' }} aria-hidden="true">
            {formatTime(startTime)}
          </span>
        </div>
        <input
          id={startTimeId}
          type="range"
          min="360"
          max="1320"
          step="15"
          value={startTime}
          aria-label="Closure start time"
          aria-valuemin={360}
          aria-valuemax={1320}
          aria-valuenow={startTime}
          aria-valuetext={formatTime(startTime)}
          onChange={(e) => setStartTime(Number(e.target.value))}
        />
      </div>

      <div className="control-group">
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <label htmlFor={durationId}>Duration (Minutes)</label>
          <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#fbbf24' }} aria-hidden="true">
            {duration} mins
          </span>
        </div>
        <input
          id={durationId}
          type="range"
          min="15"
          max="360"
          step="15"
          value={duration}
          aria-label="Closure duration in minutes"
          aria-valuemin={15}
          aria-valuemax={360}
          aria-valuenow={duration}
          aria-valuetext={`${duration} minutes`}
          onChange={(e) => setDuration(Number(e.target.value))}
        />
        <div className="preset-buttons" role="group" aria-label="Duration preset options">
          {[30, 60, 90, 120, 180].map((mins) => (
            <button
              key={mins}
              type="button"
              className={`preset-btn ${duration === mins ? 'active' : ''}`}
              onClick={() => setDuration(mins)}
              aria-pressed={duration === mins}
              aria-label={`Set duration to ${mins} minutes`}
            >
              {mins}m
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button
          className="btn btn-danger"
          style={{ flex: 1 }}
          onClick={handleAdd}
          aria-label={`Inject closure at ${selectedAirport} starting at ${formatTime(startTime)} for ${duration} minutes`}
        >
          ⚡ Disrupt {selectedAirport}
        </button>
        {closures.length > 0 && (
          <button
            className="btn btn-ghost"
            onClick={onClearClosures}
            aria-label="Clear all active airport closures"
            title="Clear all closures"
          >
            Reset
          </button>
        )}
      </div>

      {/* Active closures list */}
      {closures.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <label style={{ fontSize: 10, textTransform: 'uppercase', color: '#9ca3af', letterSpacing: 0.5 }}>
            Active Airport Closures ({closures.length})
          </label>
          <div className="closure-list" role="list" aria-label="List of active airport closures">
            {closures.map((c, idx) => (
              <div key={idx} className="closure-tag" role="listitem">
                <span>
                  <strong>{c.airport}</strong>: {formatTime(c.startTime)} – {formatTime(c.endTime)} ({c.endTime - c.startTime}m)
                </span>
                <button
                  className="remove-btn"
                  onClick={() => onRemoveClosure(idx)}
                  aria-label={`Remove closure at ${c.airport} from ${formatTime(c.startTime)} to ${formatTime(c.endTime)}`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Threshold configuration */}
      <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #2d3a4a' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <label htmlFor={thresholdId} style={{ fontSize: 10, textTransform: 'uppercase', color: '#9ca3af' }}>
            Cancel Threshold
          </label>
          <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#f87171' }} aria-hidden="true">
            {cancellationThreshold}m
          </span>
        </div>
        <input
          id={thresholdId}
          type="range"
          min="60"
          max="360"
          step="30"
          value={cancellationThreshold}
          aria-label="Flight cancellation threshold in minutes"
          aria-valuemin={60}
          aria-valuemax={360}
          aria-valuenow={cancellationThreshold}
          aria-valuetext={`${cancellationThreshold} minutes`}
          onChange={(e) => onChangeCancellationThreshold(Number(e.target.value))}
          style={{ width: '100%' }}
        />
      </div>
    </section>
  );
};
