import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { SAMPLE_DATASET } from './data/sampleDataset';
import { loadDataset, DataHealthReport } from './data/loader';
import { SimulationEngine } from './engine/engine';
import { RecoveryEngine } from './engine/recovery';
import {
  Dataset,
  AirportClosure,
  SimulationConfig,
  SimulationResult,
  TimeMinutes,
  CostWeights,
  RecoveryCandidate,
} from './engine/types';

import { ErrorBoundary } from './ui/components/ErrorBoundary';
import { NetworkMap } from './ui/components/NetworkMap';
import { KpiStrip } from './ui/components/KpiStrip';
import { DisruptionControls } from './ui/components/DisruptionControls';
import { CascadeReplay } from './ui/components/CascadeReplay';
import { FlightTable } from './ui/components/FlightTable';
import { DelayDnaPanel } from './ui/components/DelayDnaPanel';
import { GanttChart } from './ui/components/GanttChart';
import { CrewMeters } from './ui/components/CrewMeters';
import { RecoveryPanel } from './ui/components/RecoveryPanel';
import { DataHealthModal } from './ui/components/DataHealthModal';

const DEFAULT_WEIGHTS: CostWeights = {
  delayMinuteWeight: 1,
  cancellationWeight: 500,
  strandedPassengerWeight: 50,
  crewViolationWeight: 300,
};

export const AppContent: React.FC = () => {
  // 1. Initial dataset loading through the adapter
  const [{ dataset, health }, setDatasetState] = useState(() => loadDataset(SAMPLE_DATASET));
  const [isHealthOpen, setIsHealthOpen] = useState(false);

  // 2. Simulation knobs
  const [closures, setClosures] = useState<AirportClosure[]>([]);
  const [cancellationThreshold, setCancellationThreshold] = useState<number>(180);
  const [currentTime, setCurrentTime] = useState<TimeMinutes>(840);
  const [selectedAirport, setSelectedAirport] = useState<string>('BOM');
  const [selectedFlightId, setSelectedFlightId] = useState<string | null>(null);

  // 3. Recovery and cost function weights
  const [weights, setWeights] = useState<CostWeights>(DEFAULT_WEIGHTS);
  const [selectedCandidate, setSelectedCandidate] = useState<RecoveryCandidate | null>(null);
  const [appliedCandidate, setAppliedCandidate] = useState<RecoveryCandidate | null>(null);

  // 4. Active view tab in center panel
  const [activeTab, setActiveTab] = useState<'MAP' | 'GANTT' | 'TABLE' | 'CREW'>('MAP');

  // Engines
  const simEngine = useMemo(() => new SimulationEngine(dataset), [dataset]);
  const recEngine = useMemo(() => new RecoveryEngine(simEngine, dataset), [simEngine, dataset]);

  // Baseline config
  const baselineConfig: SimulationConfig = useMemo(
    () => ({
      cancellationThresholdMinutes: cancellationThreshold,
      minimumTurnaroundMinutes: 30,
      closures,
    }),
    [cancellationThreshold, closures]
  );

  // Run baseline simulation (under 50ms)
  const baselineResult: SimulationResult = useMemo(() => {
    return simEngine.simulate(baselineConfig);
  }, [simEngine, baselineConfig]);

  // If a recovery candidate has been permanently applied, simulate that
  const activeResult: SimulationResult = useMemo(() => {
    if (appliedCandidate) {
      return appliedCandidate.resultAfter;
    }
    return baselineResult;
  }, [appliedCandidate, baselineResult]);

  // Patient Zero rankings
  const patientZeroRankings = useMemo(() => {
    if (closures.length === 0) return [];
    return simEngine.getPatientZeroRanking(baselineResult, baselineConfig);
  }, [simEngine, baselineResult, baselineConfig, closures]);

  // Generate recovery candidates from engine
  const recoveryCandidates = useMemo(() => {
    if (baselineResult.kpis.delayedFlights === 0 && baselineResult.kpis.cancelledFlights === 0) {
      return [];
    }
    return recEngine.generateCandidates(baselineConfig, baselineResult, weights);
  }, [recEngine, baselineConfig, baselineResult, weights]);

  // Selected flight object for Delay DNA trace
  const selectedFlight = useMemo(() => {
    if (!selectedFlightId) return null;
    return activeResult.flights.find((f) => f.flightId === selectedFlightId) || null;
  }, [activeResult, selectedFlightId]);

  // Handlers
  const handleAddClosure = useCallback((c: AirportClosure) => {
    setClosures((prev) => [...prev, c]);
    setAppliedCandidate(null);
  }, []);

  const handleRemoveClosure = useCallback((idx: number) => {
    setClosures((prev) => prev.filter((_, i) => i !== idx));
    setAppliedCandidate(null);
  }, []);

  const handleClearClosures = useCallback(() => {
    setClosures([]);
    setAppliedCandidate(null);
    setSelectedCandidate(null);
  }, []);

  const handleSeedDemo = useCallback(() => {
    setClosures([
      {
        airport: 'BOM',
        startTime: 840,
        endTime: 930,
      },
    ]);
    setSelectedAirport('BOM');
    setCurrentTime(840);
    setAppliedCandidate(null);
    setSelectedCandidate(null);
    setSelectedFlightId('DS-103');
  }, []);

  const handleApplyCandidate = useCallback((candidate: RecoveryCandidate) => {
    setAppliedCandidate(candidate);
  }, []);

  const handleRevertCandidate = useCallback(() => {
    setAppliedCandidate(null);
  }, []);

  const handleLoadCustomDataset = useCallback((newDataset: Dataset, newHealth: DataHealthReport) => {
    setDatasetState({ dataset: newDataset, health: newHealth });
    setClosures([]);
    setAppliedCandidate(null);
    setSelectedCandidate(null);
    setSelectedFlightId(null);
  }, []);

  // Global Keyboard Shortcuts (Space to trigger demo / Escape to clear selection)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is currently typing in an input or textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        return;
      }
      if (e.key === 'Escape') {
        setSelectedFlightId(null);
        setSelectedCandidate(null);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  return (
    <div className="app">
      {/* Skip Link for WCAG Accessibility */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {/* Header Bar */}
      <header className="app-header" role="banner">
        <div className="logo">
          <span className="logo-icon" aria-hidden="true">✈️</span>
          <div>
            <h1 className="logo-text" style={{ margin: 0, fontSize: 18 }}>DOMINO SKY</h1>
            <div className="logo-subtitle">Flight Disruption Cascade &amp; Recovery Simulator</div>
          </div>
        </div>

        <div className="header-actions">
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => setIsHealthOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={isHealthOpen}
            aria-label={`Inspect dataset health. Currently ${health.stats.flights} flights loaded.`}
            title="Inspect dataset health or upload custom dataset"
          >
            🩺 Data Health ({health.stats.flights} flights)
          </button>
          <button
            className="btn btn-sm btn-primary demo-button"
            onClick={handleSeedDemo}
            aria-label="Seed demo scenario: Mumbai storm at 14:00 for 90 minutes"
            title="Start instant 2-minute demo: Mumbai Storm (14:00, 90m)"
          >
            ★ Seed Demo Scenario
          </button>
        </div>
      </header>

      {/* Top KPI Strip with Delta Tracking */}
      <section role="region" aria-label="Key Performance Indicators">
        <KpiStrip
          currentKpis={activeResult.kpis}
          baselineKpis={appliedCandidate ? baselineResult.kpis : undefined}
        />
      </section>

      {/* Main 3-Column Layout */}
      <main id="main-content" className="app-main" role="main">
        {/* Left Column: Disruption Controls + Delay DNA */}
        <aside className="panel-left" aria-label="Disruption controls and Delay DNA lineage">
          <DisruptionControls
            airports={dataset.airports}
            selectedAirport={selectedAirport}
            onSelectAirport={setSelectedAirport}
            closures={closures}
            onAddClosure={handleAddClosure}
            onRemoveClosure={handleRemoveClosure}
            onClearClosures={handleClearClosures}
            onSeedDemo={handleSeedDemo}
            cancellationThreshold={cancellationThreshold}
            onChangeCancellationThreshold={setCancellationThreshold}
          />

          <div style={{ flex: 1, overflowY: 'auto' }}>
            <DelayDnaPanel
              flight={selectedFlight}
              patientZeroList={patientZeroRankings}
              onSelectFlight={setSelectedFlightId}
            />
          </div>
        </aside>

        {/* Center Column: Network Map / Gantt / Table / Replay */}
        <section className="panel-center" aria-label="Airspace radar visualizer and schedule views">
          {/* View Tabs */}
          <nav className="tabs" role="tablist" aria-label="Simulator views">
            <button
              role="tab"
              id="tab-map"
              aria-selected={activeTab === 'MAP'}
              aria-controls="panel-view"
              className={`tab ${activeTab === 'MAP' ? 'active' : ''}`}
              onClick={() => setActiveTab('MAP')}
            >
              🗺️ Airspace Radar
            </button>
            <button
              role="tab"
              id="tab-gantt"
              aria-selected={activeTab === 'GANTT'}
              aria-controls="panel-view"
              className={`tab ${activeTab === 'GANTT' ? 'active' : ''}`}
              onClick={() => setActiveTab('GANTT')}
            >
              📊 Rotation Gantt
            </button>
            <button
              role="tab"
              id="tab-table"
              aria-selected={activeTab === 'TABLE'}
              aria-controls="panel-view"
              className={`tab ${activeTab === 'TABLE' ? 'active' : ''}`}
              onClick={() => setActiveTab('TABLE')}
            >
              📋 Flight Schedule ({dataset.flights.length})
            </button>
            <button
              role="tab"
              id="tab-crew"
              aria-selected={activeTab === 'CREW'}
              aria-controls="panel-view"
              className={`tab ${activeTab === 'CREW' ? 'active' : ''}`}
              onClick={() => setActiveTab('CREW')}
            >
              👨‍✈️ Crew Duty Meters ({dataset.crews.length})
            </button>
          </nav>

          {/* Active View */}
          <div id="panel-view" role="tabpanel" aria-labelledby={`tab-${activeTab.toLowerCase()}`} style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            {activeTab === 'MAP' && (
              <NetworkMap
                airports={dataset.airports}
                flights={activeResult.flights}
                closures={closures}
                currentTime={currentTime}
                selectedAirport={selectedAirport}
                onSelectAirport={setSelectedAirport}
                selectedFlightId={selectedFlightId}
                onSelectFlight={setSelectedFlightId}
              />
            )}

            {activeTab === 'GANTT' && (
              <GanttChart
                aircraft={dataset.aircraft}
                flights={activeResult.flights}
                currentTime={currentTime}
                selectedFlightId={selectedFlightId}
                onSelectFlight={setSelectedFlightId}
              />
            )}

            {activeTab === 'TABLE' && (
              <FlightTable
                flights={activeResult.flights}
                selectedFlightId={selectedFlightId}
                onSelectFlight={setSelectedFlightId}
              />
            )}

            {activeTab === 'CREW' && (
              <CrewMeters crews={activeResult.crews} datasetCrews={dataset.crews} />
            )}
          </div>

          {/* Bottom Cascade Replay Scrubber */}
          <CascadeReplay
            currentTime={currentTime}
            onTimeChange={setCurrentTime}
            result={activeResult}
          />
        </section>

        {/* Right Column: Recovery Candidate Ranking & AI Dispatcher */}
        <aside className="panel-right" aria-label="Recovery candidate ranking and AI Dispatcher">
          <RecoveryPanel
            baselineResult={baselineResult}
            candidates={recoveryCandidates}
            selectedCandidate={selectedCandidate}
            onSelectCandidate={setSelectedCandidate}
            appliedCandidate={appliedCandidate}
            onApplyCandidate={handleApplyCandidate}
            onRevertCandidate={handleRevertCandidate}
            weights={weights}
            onChangeWeights={setWeights}
          />
        </aside>
      </main>

      {/* Dataset Health Modal */}
      <DataHealthModal
        report={health}
        isOpen={isHealthOpen}
        onClose={() => setIsHealthOpen(false)}
        onLoadCustomDataset={handleLoadCustomDataset}
      />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
};

export default App;
