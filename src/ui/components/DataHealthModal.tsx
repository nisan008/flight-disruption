import React, { useState } from 'react';
import { DataHealthReport, loadDataset } from '../../data/loader';
import { Dataset } from '../../engine/types';

interface DataHealthModalProps {
  report: DataHealthReport;
  isOpen: boolean;
  onClose: () => void;
  onLoadCustomDataset: (dataset: Dataset, report: DataHealthReport) => void;
}

export const DataHealthModal: React.FC<DataHealthModalProps> = ({
  report,
  isOpen,
  onClose,
  onLoadCustomDataset,
}) => {
  const [jsonInput, setJsonInput] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handlePasteLoad = () => {
    try {
      setErrorMsg(null);
      const parsed = JSON.parse(jsonInput);
      const { dataset: newDataset, health: newHealth } = loadDataset(parsed);
      onLoadCustomDataset(newDataset, newHealth);
      onClose();
    } catch (e: any) {
      setErrorMsg(`JSON Parse Error: ${e.message}`);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        setErrorMsg(null);
        const text = evt.target?.result as string;
        const parsed = JSON.parse(text);
        const { dataset: newDataset, health: newHealth } = loadDataset(parsed);
        onLoadCustomDataset(newDataset, newHealth);
        onClose();
      } catch (err: any) {
        setErrorMsg(`File Read Error: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        style={{
          background: '#111827',
          border: '1px solid #2d3a4a',
          borderRadius: 12,
          width: '90%',
          maxWidth: 750,
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 20px',
            borderBottom: '1px solid #2d3a4a',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>🩺</span>
            <h2 style={{ fontSize: 16, margin: 0, color: '#f3f4f6' }}>
              Dataset Health &amp; Schema Validation
            </h2>
            <span
              style={{
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: 10,
                background: report.isValid ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                color: report.isValid ? '#22c55e' : '#ef4444',
                fontWeight: 'bold',
              }}
            >
              {report.isValid ? 'VALID' : 'HAS ISSUES'}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#9ca3af',
              fontSize: 20,
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        {/* Content body */}
        <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
          {/* Stats Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(6, 1fr)',
              gap: 8,
              marginBottom: 20,
              background: '#1a2332',
              padding: 12,
              borderRadius: 8,
              textAlign: 'center',
            }}
          >
            <div>
              <div style={{ fontSize: 18, fontWeight: 'bold', color: '#60a5fa' }}>{report.stats.airports}</div>
              <div style={{ fontSize: 10, color: '#9ca3af' }}>Airports</div>
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 'bold', color: '#60a5fa' }}>{report.stats.flights}</div>
              <div style={{ fontSize: 10, color: '#9ca3af' }}>Flights</div>
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 'bold', color: '#60a5fa' }}>{report.stats.aircraft}</div>
              <div style={{ fontSize: 10, color: '#9ca3af' }}>Aircraft</div>
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 'bold', color: '#60a5fa' }}>{report.stats.connections}</div>
              <div style={{ fontSize: 10, color: '#9ca3af' }}>Connections</div>
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 'bold', color: '#60a5fa' }}>{report.stats.crews}</div>
              <div style={{ fontSize: 10, color: '#9ca3af' }}>Crews</div>
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 'bold', color: '#60a5fa' }}>{report.stats.spares}</div>
              <div style={{ fontSize: 10, color: '#9ca3af' }}>Spares</div>
            </div>
          </div>

          {/* Issues List */}
          <div style={{ marginBottom: 20 }}>
            <h4 style={{ fontSize: 12, textTransform: 'uppercase', color: '#9ca3af', marginBottom: 8 }}>
              Validation Findings ({report.issues.length})
            </h4>

            {report.issues.length === 0 ? (
              <div style={{ color: '#22c55e', fontSize: 12, padding: 8, background: 'rgba(34,197,94,0.1)', borderRadius: 6 }}>
                ✓ No errors or warnings detected. All rotations, turnarounds, passenger connections, and crews are clean.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {report.issues.map((iss, idx) => (
                  <div key={idx} className={`health-issue ${iss.severity}`}>
                    <span className="health-icon">
                      {iss.severity === 'error' ? '❌' : iss.severity === 'warning' ? '⚠️' : 'ℹ️'}
                    </span>
                    <div style={{ flex: 1 }}>
                      <strong>[{iss.category}]</strong> {iss.message}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Dataset Adapter / Upload Tool */}
          <div style={{ borderTop: '1px solid #2d3a4a', paddingTop: 16 }}>
            <h4 style={{ fontSize: 12, textTransform: 'uppercase', color: '#9ca3af', marginBottom: 8 }}>
              📥 Load Custom Dataset (JSON Paste or Upload)
            </h4>
            <p style={{ fontSize: 11, color: '#6b7280', marginBottom: 8 }}>
              Adapter normalizes raw inputs into typed objects (Airports, Flights, Aircraft, Connections, Crews, Spares) without hardcoded values.
            </p>

            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                style={{ fontSize: 12, color: '#9ca3af' }}
              />
            </div>

            <textarea
              placeholder="Or paste JSON dataset here..."
              rows={4}
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              style={{
                width: '100%',
                padding: 8,
                background: '#1f2937',
                border: '1px solid #2d3a4a',
                borderRadius: 4,
                color: '#e8edf5',
                fontFamily: 'monospace',
                fontSize: 11,
                outline: 'none',
              }}
            />

            {errorMsg && (
              <div style={{ color: '#ef4444', fontSize: 11, marginTop: 4 }}>
                {errorMsg}
              </div>
            )}

            <button
              className="btn btn-primary btn-sm"
              style={{ marginTop: 8 }}
              onClick={handlePasteLoad}
              disabled={!jsonInput.trim()}
            >
              Parse &amp; Normalize Dataset
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
