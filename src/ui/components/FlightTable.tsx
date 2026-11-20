import React, { useState } from 'react';
import { FlightResult, FlightStatus, DelayCause } from '../../engine/types';
import { formatTime, formatDelay, causeLabel } from '../utils';

interface FlightTableProps {
  flights: FlightResult[];
  selectedFlightId: string | null;
  onSelectFlight: (id: string) => void;
}

type SortField = 'id' | 'origin' | 'destination' | 'scheduledDeparture' | 'actualDeparture' | 'delayMinutes' | 'status' | 'primaryCause';

export const FlightTable: React.FC<FlightTableProps> = ({ flights, selectedFlightId, onSelectFlight }) => {
  const [sortField, setSortField] = useState<SortField>('delayMinutes');
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [statusFilter, setStatusFilter] = useState<'ALL' | FlightStatus>('ALL');
  const [search, setSearch] = useState<string>('');

  const getPrimaryCause = (f: FlightResult): DelayCause | 'NONE' => {
    if (f.causeChain.length === 0) return 'NONE';
    return f.causeChain[0].cause;
  };

  const filteredAndSorted = React.useMemo(() => {
    return flights
      .filter((f) => {
        if (statusFilter !== 'ALL' && f.status !== statusFilter) return false;
        if (search) {
          const s = search.toLowerCase();
          return (
            f.flightId.toLowerCase().includes(s) ||
            f.origin.toLowerCase().includes(s) ||
            f.destination.toLowerCase().includes(s) ||
            f.aircraftId.toLowerCase().includes(s)
          );
        }
        return true;
      })
      .sort((a, b) => {
        let valA: any = a[sortField as keyof FlightResult];
        let valB: any = b[sortField as keyof FlightResult];

        if (sortField === 'id') {
          valA = a.flightId;
          valB = b.flightId;
        } else if (sortField === 'primaryCause') {
          valA = getPrimaryCause(a);
          valB = getPrimaryCause(b);
        }

        if (valA < valB) return sortAsc ? -1 : 1;
        if (valA > valB) return sortAsc ? 1 : -1;
        return 0;
      });
  }, [flights, sortField, sortAsc, statusFilter, search]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Search and filters */}
      <div style={{ display: 'flex', gap: 8, padding: '8px 12px', borderBottom: '1px solid #2d3a4a', background: '#111827' }}>
        <input
          type="text"
          placeholder="Search flight, route, aircraft..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1,
            padding: '4px 8px',
            background: '#1f2937',
            border: '1px solid #2d3a4a',
            color: '#e8edf5',
            borderRadius: 4,
            fontSize: 12,
            outline: 'none',
          }}
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          style={{
            padding: '4px 8px',
            background: '#1f2937',
            border: '1px solid #2d3a4a',
            color: '#e8edf5',
            borderRadius: 4,
            fontSize: 12,
            outline: 'none',
          }}
        >
          <option value="ALL">All Statuses ({flights.length})</option>
          <option value={FlightStatus.DELAYED}>Delayed Only</option>
          <option value={FlightStatus.CANCELLED}>Cancelled Only</option>
          <option value={FlightStatus.ON_TIME}>On-Time Only</option>
        </select>
      </div>

      {/* Flights list table */}
      <div className="flight-table-container">
        <table className="flight-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('id')} className={sortField === 'id' ? 'sorted' : ''}>
                Flight {sortField === 'id' ? (sortAsc ? '▲' : '▼') : ''}
              </th>
              <th>Tail</th>
              <th onClick={() => handleSort('origin')}>Route</th>
              <th onClick={() => handleSort('scheduledDeparture')}>Sched Dep</th>
              <th onClick={() => handleSort('actualDeparture')}>Act Dep</th>
              <th onClick={() => handleSort('delayMinutes')} className={sortField === 'delayMinutes' ? 'sorted' : ''}>
                Delay {sortField === 'delayMinutes' ? (sortAsc ? '▲' : '▼') : ''}
              </th>
              <th onClick={() => handleSort('status')}>Status</th>
              <th onClick={() => handleSort('primaryCause')}>Root Cause</th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSorted.map((f) => {
              const isSelected = f.flightId === selectedFlightId;
              const primaryCause = getPrimaryCause(f);

              return (
                <tr
                  key={f.flightId}
                  className={isSelected ? 'selected' : ''}
                  onClick={() => onSelectFlight(f.flightId)}
                >
                  <td style={{ fontWeight: 'bold', color: '#60a5fa' }}>{f.flightId}</td>
                  <td style={{ color: '#9ca3af' }}>{f.aircraftId}</td>
                  <td>
                    {f.origin} → {f.destination}
                  </td>
                  <td>{formatTime(f.scheduledDeparture)}</td>
                  <td style={{ color: f.delayMinutes > 0 ? '#f59e0b' : '#9ca3af' }}>
                    {f.status === FlightStatus.CANCELLED ? '--:--' : formatTime(f.actualDeparture)}
                  </td>
                  <td style={{ fontWeight: 'bold' }}>
                    {f.status === FlightStatus.CANCELLED ? (
                      <span style={{ color: '#ef4444' }}>CANCELLED</span>
                    ) : (
                      <span style={{ color: f.delayMinutes > 0 ? '#f59e0b' : '#22c55e' }}>
                        {formatDelay(f.delayMinutes)}
                      </span>
                    )}
                  </td>
                  <td>
                    <span className={`status-badge ${f.status.toLowerCase().replace('_', '-')}`}>
                      {f.status}
                    </span>
                  </td>
                  <td style={{ fontSize: 10, color: '#94a3b8' }}>
                    {primaryCause === 'NONE' ? '—' : causeLabel(primaryCause)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
