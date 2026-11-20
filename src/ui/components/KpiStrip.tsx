import React from 'react';
import { SimulationKPIs } from '../../engine/types';
import { formatNumber } from '../utils';

interface KpiStripProps {
  currentKpis: SimulationKPIs;
  baselineKpis?: SimulationKPIs;
}

export const KpiStrip: React.FC<KpiStripProps> = ({ currentKpis, baselineKpis }) => {
  const getDelta = (curr: number, base?: number) => {
    if (base === undefined) return null;
    const diff = curr - base;
    if (diff === 0) return <span className="kpi-delta zero">0</span>;
    if (diff > 0) return <span className="kpi-delta positive">+{diff}</span>;
    return <span className="kpi-delta negative">{diff}</span>;
  };

  return (
    <div className="kpi-strip">
      <div className="kpi-card">
        <div className="kpi-value neutral">{currentKpis.totalFlights}</div>
        <div className="kpi-label">Total Flights</div>
      </div>

      <div className="kpi-card">
        <div className="kpi-value on-time">{currentKpis.onTimeFlights}</div>
        <div className="kpi-label">On Time</div>
        {getDelta(currentKpis.onTimeFlights, baselineKpis?.onTimeFlights)}
      </div>

      <div className="kpi-card">
        <div className={`kpi-value ${currentKpis.delayedFlights > 0 ? 'delayed' : 'on-time'}`}>
          {currentKpis.delayedFlights}
        </div>
        <div className="kpi-label">Delayed</div>
        {getDelta(currentKpis.delayedFlights, baselineKpis?.delayedFlights)}
      </div>

      <div className="kpi-card">
        <div className={`kpi-value ${currentKpis.cancelledFlights > 0 ? 'cancelled' : 'on-time'}`}>
          {currentKpis.cancelledFlights}
        </div>
        <div className="kpi-label">Cancelled</div>
        {getDelta(currentKpis.cancelledFlights, baselineKpis?.cancelledFlights)}
      </div>

      <div className="kpi-card">
        <div className={`kpi-value ${currentKpis.totalDelayMinutes > 0 ? 'delayed' : 'on-time'}`}>
          {formatNumber(currentKpis.totalDelayMinutes)}m
        </div>
        <div className="kpi-label">Total Delay</div>
        {getDelta(currentKpis.totalDelayMinutes, baselineKpis?.totalDelayMinutes)}
      </div>

      <div className="kpi-card">
        <div className={`kpi-value ${currentKpis.missedConnections > 0 ? 'delayed' : 'on-time'}`}>
          {currentKpis.missedConnections}
        </div>
        <div className="kpi-label">Missed Connects</div>
        {getDelta(currentKpis.missedConnections, baselineKpis?.missedConnections)}
      </div>

      <div className="kpi-card">
        <div className={`kpi-value ${currentKpis.strandedPassengers > 0 ? 'stranded' : 'on-time'}`}>
          {formatNumber(currentKpis.strandedPassengers)}
        </div>
        <div className="kpi-label">Stranded Pax</div>
        {getDelta(currentKpis.strandedPassengers, baselineKpis?.strandedPassengers)}
      </div>

      <div className="kpi-card">
        <div className={`kpi-value ${currentKpis.crewViolations > 0 ? 'cancelled' : 'on-time'}`}>
          {currentKpis.crewViolations}
        </div>
        <div className="kpi-label">Crew Timeouts</div>
        {getDelta(currentKpis.crewViolations, baselineKpis?.crewViolations)}
      </div>
    </div>
  );
};
