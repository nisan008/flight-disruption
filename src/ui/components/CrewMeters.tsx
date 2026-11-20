import React from 'react';
import { CrewResult, Crew } from '../../engine/types';

interface CrewMetersProps {
  crews: CrewResult[];
  datasetCrews: Crew[];
}

export const CrewMeters: React.FC<CrewMetersProps> = ({ crews, datasetCrews }) => {
  const datasetCrewMap = React.useMemo(() => new Map(datasetCrews.map((c) => [c.id, c])), [datasetCrews]);

  return (
    <div style={{ padding: 12, overflowY: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, color: '#9ca3af', margin: 0 }}>
          👨‍✈️ Crew Duty Legal Limit Monitors
        </h3>
        <span style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'monospace' }}>
          Limit: <strong>11 hrs (660m)</strong>
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {crews.map((cr) => {
          const dsCrew = datasetCrewMap.get(cr.crewId);
          const pct = Math.min(100, (cr.actualDutyMinutes / cr.maxDutyMinutes) * 100);

          let fillClass = 'safe';
          if (cr.timedOut) fillClass = 'danger';
          else if (pct > 80) fillClass = 'warning';

          const hours = (cr.actualDutyMinutes / 60).toFixed(1);
          const maxHours = (cr.maxDutyMinutes / 60).toFixed(0);

          return (
            <div key={cr.crewId} className="crew-meter">
              <div className="crew-meter-header">
                <span className="crew-meter-id" style={{ color: cr.timedOut ? '#ef4444' : '#e8edf5' }}>
                  {cr.crewId} {dsCrew?.baseAirport ? `(${dsCrew.baseAirport})` : ''}
                  {cr.timedOut && (
                    <span
                      style={{
                        marginLeft: 6,
                        fontSize: 9,
                        background: 'rgba(239,68,68,0.2)',
                        color: '#ef4444',
                        padding: '1px 4px',
                        borderRadius: 3,
                        fontWeight: 'bold',
                      }}
                    >
                      TIMED OUT
                    </span>
                  )}
                </span>
                <span className="crew-meter-time">
                  <strong style={{ color: cr.timedOut ? '#ef4444' : '#cbd5e1' }}>{hours}h</strong> / {maxHours}h ({cr.actualDutyMinutes}m)
                </span>
              </div>

              <div className="crew-meter-bar">
                <div className={`crew-meter-fill ${fillClass}`} style={{ width: `${pct}%` }} />
                <div className="crew-meter-limit" title="Legal Maximum Limit (660m)" />
              </div>

              {dsCrew && (
                <div style={{ fontSize: 10, color: '#64748b', marginTop: 4, fontFamily: 'monospace' }}>
                  Legs: {dsCrew.flightIds.join(' → ')}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
