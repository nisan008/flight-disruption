import React, { useMemo } from 'react';
import { CrewResult, Crew } from '../../engine/types';

interface CrewMetersProps {
  crews: CrewResult[];
  datasetCrews: Crew[];
}

export const CrewMeters: React.FC<CrewMetersProps> = React.memo(({ crews, datasetCrews }) => {
  const datasetCrewMap = useMemo(() => new Map(datasetCrews.map((c) => [c.id, c])), [datasetCrews]);

  return (
    <section className="crew-meters-panel" aria-label="Crew Duty Legal Limit Meters" style={{ padding: 12, overflowY: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, color: '#9ca3af', margin: 0 }}>
          👨‍✈️ Crew Duty Legal Limit Monitors
        </h3>
        <span style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'monospace' }}>
          Limit: <strong>11 hrs (660m)</strong>
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }} role="list" aria-label="Crew assignments duty progress">
        {crews.map((cr) => {
          const dsCrew = datasetCrewMap.get(cr.crewId);
          const pct = Math.min(100, (cr.actualDutyMinutes / cr.maxDutyMinutes) * 100);

          let fillClass = 'safe';
          if (cr.timedOut) fillClass = 'danger';
          else if (pct > 80) fillClass = 'warning';

          const hours = (cr.actualDutyMinutes / 60).toFixed(1);
          const maxHours = (cr.maxDutyMinutes / 60).toFixed(0);

          return (
            <div
              key={cr.crewId}
              className="crew-meter"
              role="listitem"
              aria-label={`Crew ${cr.crewId}. Duty elapsed: ${hours} hours out of ${maxHours} hour limit. ${cr.timedOut ? 'Status: Timed out exceeding legal limit' : 'Status: Legal duty active'}.`}
            >
              <div className="crew-meter-header">
                <span className="crew-meter-id" style={{ color: cr.timedOut ? '#f87171' : '#f3f4f6' }}>
                  {cr.crewId} {dsCrew?.baseAirport ? `(${dsCrew.baseAirport})` : ''}
                  {cr.timedOut && (
                    <span
                      style={{
                        marginLeft: 6,
                        fontSize: 9,
                        background: 'rgba(239,68,68,0.2)',
                        color: '#f87171',
                        padding: '1px 4px',
                        borderRadius: 3,
                        fontWeight: 700,
                      }}
                      role="status"
                    >
                      TIMED OUT
                    </span>
                  )}
                </span>
                <span className="crew-meter-time">
                  <strong style={{ color: cr.timedOut ? '#f87171' : '#f3f4f6' }}>{hours}h</strong> / {maxHours}h ({cr.actualDutyMinutes}m)
                </span>
              </div>

              <div
                className="crew-meter-bar"
                role="progressbar"
                aria-valuenow={cr.actualDutyMinutes}
                aria-valuemin={0}
                aria-valuemax={cr.maxDutyMinutes}
                aria-valuetext={`${hours} hours of ${maxHours} hours maximum duty`}
              >
                <div className={`crew-meter-fill ${fillClass}`} style={{ width: `${pct}%` }} />
                <div className="crew-meter-limit" title="Legal Maximum Limit (660m)" aria-hidden="true" />
              </div>

              {dsCrew && (
                <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4, fontFamily: 'monospace' }}>
                  Legs: {dsCrew.flightIds.join(' → ')}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
});
