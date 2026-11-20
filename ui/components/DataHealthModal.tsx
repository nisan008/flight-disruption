import React, { useState, useEffect } from 'react';
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

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

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
      role="dialog"
      aria-modal="true"
      aria-labelledby="data-health-title"
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
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
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
            <span style={{ fontSize: 20 }} aria-hidden="true">🩺</span>
            <h2 id="data-health-title" style={{ fontSize: 16, margin: 0, color: '#f3f4f6' }}>
              Dataset Health &amp; Schema Validation
            </h2>
            <span
              style={{
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: 10,
                background: report.isValid ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                color: report.isValid ? '#4ade80' : '#f87171',
                fontWeight: 700,
              }}
              role="status"
            >
              {report.isValid ? 'VALID' : 'HAS ISSUES'}
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dataset health dialog (Escape)"
            style={{
              background: 'none',
              border: 'none',
              color: '#9ca3af',
              fontSize: 20,
              cursor: 'pointer',
              padding: 4,
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
            role="region"
            aria-label="Dataset entity statistics"
          >
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#60a5fa' }}>{report.stats.airports}</div>
              <div style={{ fontSize: 10, color: '#9ca3af' }}>Airports</div>
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#60a5fa' }}>{report.stats.flights}</div>
              <div style={{ fontSize: 10, color: '#9ca3af' }}>Flights</div>
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#60a5fa' }}>{report.stats.aircraft}</div>
              <div style={{ fontSize: 10, color: '#9ca3af' }}>Aircraft</div>
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#60a5fa' }}>{report.stats.connections}</div>
              <div style={{ fontSize: 10, color: '#9ca3af' }}>Connections</div>
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#60a5fa' }}>{report.stats.crews}</div>
              <div style={{ fontSize: 10, color: '#9ca3af' }}>Crews</div>
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#60a5fa' }}>{report.stats.spares}</div>
              <div style={{ fontSize: 10, color: '#9ca3af' }}>Spares</div>
            </div>
          </div>

          {/* Issues List */}
          <div style={{ marginBottom: 20 }}>
            <h4 style={{ fontSize: 12, textTransform: 'uppercase', color: '#9ca3af', marginBottom: 8 }}>
              Validation Findings ({report.issues.length})
            </h4>

            {report.issues.length === 0 ? (
              <div style={{ color: '#4ade80', fontSize: 12, padding: 8, background: 'rgba(34,197,94,0.1)', borderRadius: 6 }} role="status">
                ✓ No errors or warnings detected. All rotations, turnarounds, passenger connections, and crews are clean.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }} role="list" aria-label="List of dataset health issues">
                {report.issues.map((iss, idx) => (
                  <div key={idx} className={`health-issue ${iss.severity}`} role="listitem">
                    <span className="health-icon" aria-hidden="true">
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
            <p style={{ fontSize: 11, color: '#9ca3af', marginBottom: 8 }}>
              Adapter normalizes raw inputs into typed objects (Airports, Flights, Aircraft, Connections, Crews, Spares) without hardcoded values.
            </p>

            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <label htmlFor="dataset-file-input" className="sr-only">Upload JSON dataset file</label>
              <input
                id="dataset-file-input"
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                style={{ fontSize: 12, color: '#cbd5e1' }}
              />
            </div>

            <label htmlFor="dataset-json-textarea" className="sr-only">Paste JSON dataset text</label>
            <textarea
              id="dataset-json-textarea"
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
                color: '#f3f4f6',
                fontFamily: 'monospace',
                fontSize: 11,
                outline: 'none',
              }}
            />

            {errorMsg && (
              <div style={{ color: '#f87171', fontSize: 11, marginTop: 4 }} role="alert">
                {errorMsg}
              </div>
            )}

            <button
              className="btn btn-primary btn-sm"
              style={{ marginTop: 8 }}
              onClick={handlePasteLoad}
              disabled={!jsonInput.trim()}
              aria-label="Parse and normalize pasted JSON dataset"
            >
              Parse &amp; Normalize Dataset
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
