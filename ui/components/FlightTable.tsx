import React, { useState, useMemo, useCallback } from 'react';
import { FlightResult, FlightStatus, DelayCause } from '../../engine/types';
import { formatTime, formatDelay, causeLabel } from '../utils';

interface FlightTableProps {
  flights: FlightResult[];
  selectedFlightId: string | null;
  onSelectFlight: (id: string) => void;
}

type SortField = 'id' | 'origin' | 'destination' | 'scheduledDeparture' | 'actualDeparture' | 'delayMinutes' | 'status' | 'primaryCause';

export const FlightTable: React.FC<FlightTableProps> = React.memo(({ flights, selectedFlightId, onSelectFlight }) => {
  const [sortField, setSortField] = useState<SortField>('delayMinutes');
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [statusFilter, setStatusFilter] = useState<'ALL' | FlightStatus>('ALL');
  const [search, setSearch] = useState<string>('');

  const getPrimaryCause = (f: FlightResult): DelayCause | 'NONE' => {
    if (f.causeChain.length === 0) return 'NONE';
    return f.causeChain[0].cause;
  };

  const filteredAndSorted = useMemo(() => {
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
        let valA: string | number = a[sortField as keyof FlightResult] as string | number;
        let valB: string | number = b[sortField as keyof FlightResult] as string | number;

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

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  }, [sortField, sortAsc]);

  const handleRowKeyDown = useCallback((e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelectFlight(id);
    }
  }, [onSelectFlight]);

  const getAriaSort = (field: SortField): 'ascending' | 'descending' | 'none' => {
    if (sortField !== field) return 'none';
    return sortAsc ? 'ascending' : 'descending';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Search and filters */}
      <div style={{ display: 'flex', gap: 8, padding: '8px 12px', borderBottom: '1px solid #2d3a4a', background: '#111827' }}>
        <label htmlFor="flight-search" className="sr-only">Search flights, routes, or aircraft tail numbers</label>
        <input
          id="flight-search"
          type="text"
          placeholder="Search flight, route, aircraft tail..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search flights by flight ID, route, or aircraft tail"
          style={{
            flex: 1,
            padding: '6px 10px',
            background: '#1f2937',
            border: '1px solid #2d3a4a',
            color: '#f3f4f6',
            borderRadius: 4,
            fontSize: 12,
            outline: 'none',
          }}
        />

        <label htmlFor="status-filter" className="sr-only">Filter flights by status</label>
        <select
          id="status-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          aria-label="Filter flight list by status"
          style={{
            padding: '6px 10px',
            background: '#1f2937',
            border: '1px solid #2d3a4a',
            color: '#f3f4f6',
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
        <table className="flight-table" aria-label="Flight schedule and disruption status table">
          <thead>
            <tr>
              <th
                onClick={() => handleSort('id')}
                aria-sort={getAriaSort('id')}
                className={sortField === 'id' ? 'sorted' : ''}
              >
                Flight {sortField === 'id' ? (sortAsc ? '▲' : '▼') : ''}
              </th>
              <th>Tail</th>
              <th onClick={() => handleSort('origin')} aria-sort={getAriaSort('origin')}>
                Route
              </th>
              <th onClick={() => handleSort('scheduledDeparture')} aria-sort={getAriaSort('scheduledDeparture')}>
                Sched Dep
              </th>
              <th onClick={() => handleSort('actualDeparture')} aria-sort={getAriaSort('actualDeparture')}>
                Act Dep
              </th>
              <th
                onClick={() => handleSort('delayMinutes')}
                aria-sort={getAriaSort('delayMinutes')}
                className={sortField === 'delayMinutes' ? 'sorted' : ''}
              >
                Delay {sortField === 'delayMinutes' ? (sortAsc ? '▲' : '▼') : ''}
              </th>
              <th onClick={() => handleSort('status')} aria-sort={getAriaSort('status')}>
                Status
              </th>
              <th onClick={() => handleSort('primaryCause')} aria-sort={getAriaSort('primaryCause')}>
                Root Cause
              </th>
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
                  onKeyDown={(e) => handleRowKeyDown(e, f.flightId)}
                  tabIndex={0}
                  role="row"
                  aria-selected={isSelected}
                  aria-label={`Flight ${f.flightId}, ${f.origin} to ${f.destination}. Delay: ${f.delayMinutes} minutes. Status: ${f.status}.`}
                >
                  <td style={{ fontWeight: 700, color: '#60a5fa' }}>{f.flightId}</td>
                  <td style={{ color: '#9ca3af' }}>{f.aircraftId}</td>
                  <td>
                    {f.origin} → {f.destination}
                  </td>
                  <td>{formatTime(f.scheduledDeparture)}</td>
                  <td style={{ color: f.delayMinutes > 0 ? '#fbbf24' : '#9ca3af' }}>
                    {f.status === FlightStatus.CANCELLED ? '--:--' : formatTime(f.actualDeparture)}
                  </td>
                  <td style={{ fontWeight: 700 }}>
                    {f.status === FlightStatus.CANCELLED ? (
                      <span style={{ color: '#f87171' }}>CANCELLED</span>
                    ) : (
                      <span style={{ color: f.delayMinutes > 0 ? '#fbbf24' : '#4ade80' }}>
                        {formatDelay(f.delayMinutes)}
                      </span>
                    )}
                  </td>
                  <td>
                    <span className={`status-badge ${f.status.toLowerCase().replace('_', '-')}`}>
                      {f.status}
                    </span>
                  </td>
                  <td style={{ fontSize: 10, color: '#cbd5e1' }}>
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
});
