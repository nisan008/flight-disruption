import React, { useState } from 'react';
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
  const [startTime, setStartTime] = useState<number>(840); // 14:00 default
  const [duration, setDuration] = useState<number>(90); // 90 min default

  const handleAdd = () => {
    onAddClosure({
      airport: selectedAirport,
      startTime,
      endTime: startTime + duration,
    });
  };

  return (
    <div className="disruption-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>⚡ Inject Disruption</h3>
        <button
          className="btn btn-sm btn-ghost"
          onClick={onSeedDemo}
          title="Pre-seeds Mumbai 14:00 90-min storm for rapid 2-minute demonstration"
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
        <label>Target Airport</label>
        <select value={selectedAirport} onChange={(e) => onSelectAirport(e.target.value)}>
          {airports.map((apt) => (
            <option key={apt.code} value={apt.code}>
              {apt.code} - {apt.city} ({apt.name.split(' ')[0]})
            </option>
          ))}
        </select>
      </div>

      <div className="control-group">
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <label>Closure Start</label>
          <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#60a5fa' }}>{formatTime(startTime)}</span>
        </div>
        <input
          type="range"
          min="360"
          max="1320"
          step="15"
          value={startTime}
          onChange={(e) => setStartTime(Number(e.target.value))}
        />
      </div>

      <div className="control-group">
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <label>Duration</label>
          <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#f59e0b' }}>{duration} mins</span>
        </div>
        <input
          type="range"
          min="15"
          max="360"
          step="15"
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value))}
        />
        <div className="preset-buttons">
          {[30, 60, 90, 120, 180].map((mins) => (
            <button
              key={mins}
              type="button"
              className={`preset-btn ${duration === mins ? 'active' : ''}`}
              onClick={() => setDuration(mins)}
            >
              {mins}m
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button className="btn btn-danger" style={{ flex: 1 }} onClick={handleAdd}>
          ⚡ Disrupt {selectedAirport}
        </button>
        {closures.length > 0 && (
          <button className="btn btn-ghost" onClick={onClearClosures} title="Clear all closures">
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
          <div className="closure-list">
            {closures.map((c, idx) => (
              <div key={idx} className="closure-tag">
                <span>
                  <strong>{c.airport}</strong>: {formatTime(c.startTime)} – {formatTime(c.endTime)} ({c.endTime - c.startTime}m)
                </span>
                <button className="remove-btn" onClick={() => onRemoveClosure(idx)}>
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
          <label style={{ fontSize: 10, textTransform: 'uppercase', color: '#9ca3af' }}>Cancel Threshold</label>
          <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#ef4444' }}>{cancellationThreshold}m</span>
        </div>
        <input
          type="range"
          min="60"
          max="360"
          step="30"
          value={cancellationThreshold}
          onChange={(e) => onChangeCancellationThreshold(Number(e.target.value))}
          style={{ width: '100%' }}
        />
      </div>
    </div>
  );
};
