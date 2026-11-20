import React from 'react';
import { FlightResult, PatientZero, DelayCause, FlightStatus } from '../../engine/types';
import { formatTime, formatDelay, causeClass, causeLabel } from '../utils';

interface DelayDnaPanelProps {
  flight: FlightResult | null;
  patientZeroList: PatientZero[];
  onSelectFlight: (id: string) => void;
}

export const DelayDnaPanel: React.FC<DelayDnaPanelProps> = ({ flight, patientZeroList, onSelectFlight }) => {
  if (!flight) {
    return (
      <div className="delay-dna">
        <h3>🧬 Delay DNA Trace</h3>
        <div className="empty-state">
          <div className="empty-icon">🔍</div>
          <div>Select any flight in the table or network map to inspect its full causal blame lineage.</div>
        </div>

        {patientZeroList.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <h3 style={{ color: '#f59e0b' }}>🎯 Patient Zero Ranking</h3>
            <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 8 }}>
              Identifies which root disruption caused the most downstream cascading delays.
            </div>
            {patientZeroList.map((pz, idx) => (
              <div key={idx} className="patient-zero-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="pz-rank">#{idx + 1}</span>
                  <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#ef4444' }}>
                    +{pz.totalDownstreamDelayMinutes}m downstream
                  </span>
                </div>
                <div className="pz-desc">{pz.closureDescription}</div>
                <div className="pz-stats">
                  <span>Flights affected: {pz.affectedFlightCount}</span>
                  <span>Stranded pax: {pz.totalStrandedPassengers}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Calculate percentage of delay by cause
  const totalDelay = Math.max(1, flight.delayMinutes);
  const breakdownEntries = Object.entries(flight.delayBreakdown) as [DelayCause, number][];

  return (
    <div className="delay-dna">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>🧬 Delay DNA: {flight.flightId}</h3>
        <span className={`status-badge ${flight.status.toLowerCase().replace('_', '-')}`}>
          {flight.status}
        </span>
      </div>

      <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>
        Route: <strong>{flight.origin} → {flight.destination}</strong> | Aircraft:{' '}
        <strong style={{ color: '#60a5fa' }}>{flight.aircraftId}</strong> | Total Delay:{' '}
        <strong style={{ color: flight.delayMinutes > 0 ? '#f59e0b' : '#22c55e' }}>
          {formatDelay(flight.delayMinutes)}
        </strong>
      </div>

      {/* Proportional Colour-Coded Delay Breakdown Bar */}
      {flight.delayMinutes > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>Delay Composition:</div>
          <div className="delay-bar">
            {breakdownEntries.map(([cause, mins]) => {
              if (mins <= 0) return null;
              const pct = (mins / totalDelay) * 100;
              let bg = '#a855f7';
              if (cause === DelayCause.WEATHER_CLOSURE) bg = '#f97316';
              if (cause === DelayCause.ROTATION_KNOCKON) bg = '#a855f7';
              if (cause === DelayCause.CREW_TIMEOUT) bg = '#ef4444';
              if (cause === DelayCause.CREW_WAIT) bg = '#ec4899';
              if (cause === DelayCause.CONNECTION_HOLD) bg = '#06b6d4';

              return (
                <div
                  key={cause}
                  className="delay-bar-segment"
                  style={{ width: `${pct}%`, background: bg }}
                  title={`${causeLabel(cause)}: ${mins}m (${Math.round(pct)}%)`}
                />
              );
            })}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
            {breakdownEntries.map(([cause, mins]) => {
              if (mins <= 0) return null;
              return (
                <span key={cause} style={{ fontSize: 10, fontFamily: 'monospace', color: '#cbd5e1' }}>
                  {causeLabel(cause)}: <strong>{mins}m</strong>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Causal Lineage Chain */}
      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#93c5fd', textTransform: 'uppercase', marginBottom: 8 }}>
          Lineage Trace (Root → Leaf)
        </div>

        {flight.causeChain.length === 0 ? (
          <div style={{ fontSize: 12, color: '#22c55e', padding: 8, background: 'rgba(34,197,94,0.1)', borderRadius: 4 }}>
            ✓ No delays encountered. Flight operated on-schedule.
          </div>
        ) : (
          <div className="cause-chain">
            {flight.causeChain.map((link, idx) => {
              const isRoot = idx === 0;
              const isDirect = link.flightId === flight.flightId;

              return (
                <div key={idx} className={`cause-chain-link ${causeClass(link.cause)}`}>
                  <div className="link-minutes">+{link.minutes}m</div>
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {isRoot && <span style={{ fontSize: 9, background: '#ef4444', color: '#fff', padding: '1px 4px', borderRadius: 2 }}>ROOT</span>}
                      {link.flightId !== flight.flightId && (
                        <button
                          onClick={() => onSelectFlight(link.flightId)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#60a5fa',
                            cursor: 'pointer',
                            padding: 0,
                            fontFamily: 'monospace',
                            fontWeight: 'bold',
                            textDecoration: 'underline',
                          }}
                        >
                          {link.flightId}
                        </button>
                      )}
                      <span className="link-desc">{link.description}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Patient Zero impact ranking */}
      {patientZeroList.length > 0 && (
        <div style={{ marginTop: 24, borderTop: '1px solid #2d3a4a', paddingTop: 16 }}>
          <h3 style={{ color: '#f59e0b', fontSize: 12 }}>🎯 Patient Zero Blame Attribution</h3>
          {patientZeroList.map((pz, idx) => (
            <div key={idx} className="patient-zero-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="pz-rank">#{idx + 1} Epicenter</span>
                <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#ef4444' }}>
                  +{pz.totalDownstreamDelayMinutes}m total impact
                </span>
              </div>
              <div className="pz-desc" style={{ fontSize: 12 }}>
                {pz.closureDescription}
              </div>
              <div className="pz-stats">
                <span>Direct flights affected: {pz.affectedFlightCount}</span>
                <span>Stranded pax: {pz.totalStrandedPassengers}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
