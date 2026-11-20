import React, { useState, useId, useCallback } from 'react';
import {
  RecoveryCandidate,
  CostWeights,
  SimulationResult,
  SimulationKPIs,
} from '../../engine/types';
import { AIRequest, AIResponse, generateTemplateFallback } from '../../ai/dispatcher';
import { extractNumbers, verifyNumbers, injectTamperNumber, VerificationResult } from '../../ai/numberGuard';
import { formatNumber } from '../utils';

interface RecoveryPanelProps {
  baselineResult: SimulationResult;
  candidates: RecoveryCandidate[];
  selectedCandidate: RecoveryCandidate | null;
  onSelectCandidate: (candidate: RecoveryCandidate | null) => void;
  appliedCandidate: RecoveryCandidate | null;
  onApplyCandidate: (candidate: RecoveryCandidate) => void;
  onRevertCandidate: () => void;
  weights: CostWeights;
  onChangeWeights: (newWeights: CostWeights) => void;
}

export const RecoveryPanel: React.FC<RecoveryPanelProps> = ({
  baselineResult,
  candidates,
  selectedCandidate,
  onSelectCandidate,
  appliedCandidate,
  onApplyCandidate,
  onRevertCandidate,
  weights,
  onChangeWeights,
}) => {
  const [aiResponse, setAiResponse] = useState<AIResponse | null>(null);
  const [verification, setVerification] = useState<VerificationResult | null>(null);
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [isTampered, setIsTampered] = useState<boolean>(false);

  const delayWeightId = useId();
  const cancelWeightId = useId();
  const paxWeightId = useId();
  const crewWeightId = useId();

  const buildAIRequestData = useCallback((): AIRequest => {
    const topDelayed = baselineResult.flights
      .filter((f) => f.delayMinutes > 0)
      .sort((a, b) => b.delayMinutes - a.delayMinutes)
      .slice(0, 5)
      .map((f) => ({
        flightId: f.flightId,
        delayMinutes: f.delayMinutes,
        cause: f.causeChain[0]?.cause ?? 'ROTATION_KNOCKON',
      }));

    const candList = candidates.slice(0, 5).map((c, idx) => ({
      rank: idx + 1,
      action: c.action.type,
      description: c.action.description,
      costScore: c.delta.costScore,
      deltas: {
        delayMinutesDelta: c.delta.delayMinutesDelta,
        cancellationsDelta: c.delta.cancellationsDelta,
        strandedPassengersDelta: c.delta.strandedPassengersDelta,
        crewViolationsDelta: c.delta.crewViolationsDelta,
      },
    }));

    return {
      baseline: {
        kpis: baselineResult.kpis,
        topDelayedFlights: topDelayed,
        missedConnections: baselineResult.kpis.missedConnections,
        strandedPassengers: baselineResult.kpis.strandedPassengers,
      },
      candidates: candList,
      weights,
    };
  }, [baselineResult, candidates, weights]);

  const handleAskAI = async () => {
    setIsAiLoading(true);
    setIsTampered(false);
    try {
      const requestData = buildAIRequestData();
      const res = generateTemplateFallback(requestData);
      setAiResponse(res);

      const claims = extractNumbers(res.reasoning);
      const vResult = verifyNumbers(claims, requestData, baselineResult);
      setVerification(vResult);

      if (res.chosenActions.length > 0) {
        const recommended = candidates.find(
          (c) => c.action.type === res.chosenActions[0] || c.action.id.includes(res.chosenActions[0])
        );
        if (recommended) onSelectCandidate(recommended);
      }
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleTamperTest = () => {
    if (!aiResponse) {
      handleAskAI();
      return;
    }
    const tampered = injectTamperNumber(aiResponse);
    setAiResponse(tampered);
    setIsTampered(true);

    const requestData = buildAIRequestData();
    const claims = extractNumbers(tampered.reasoning);
    const vResult = verifyNumbers(claims, requestData, baselineResult);
    setVerification(vResult);
  };

  const handleCandidateKeyDown = (e: React.KeyboardEvent, cand: RecoveryCandidate) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelectCandidate(cand);
    }
  };

  const activeAfterKPIs: SimulationKPIs | undefined = selectedCandidate?.resultAfter.kpis;

  return (
    <section className="recovery-panel" aria-label="Recovery Candidate Optimization and AI Dispatcher">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, color: '#38bdf8', margin: 0 }}>
          🛡️ Recovery Dispatcher
        </h3>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            className="btn btn-sm btn-primary"
            onClick={handleAskAI}
            disabled={isAiLoading || candidates.length === 0}
            aria-label="Invoke AI dispatcher recommendation with Number Guard verification"
          >
            {isAiLoading ? 'Analyzing...' : '🤖 AI Dispatcher'}
          </button>
          <button
            className="btn btn-sm btn-danger"
            onClick={handleTamperTest}
            title="Inject deliberate incorrect number to test Number Guard trust layer"
            aria-label="Inject deliberate hallucinated number to test Number Guard validator"
          >
            ⚠️ AI Tamper Test
          </button>
        </div>
      </div>

      {/* AI Recommendation Box with Number Guard */}
      {aiResponse && verification && (
        <div className={`ai-response animate-in ${isTampered ? 'pulse-warning' : ''}`} style={{ marginBottom: 16 }}>
          <div className="ai-header">
            <span className="ai-label">
              🤖 AI Recovery Decision {isTampered ? '(Tampered)' : ''}
            </span>
            <span
              className={`number-guard-badge ${verification.allVerified ? 'verified' : 'warning'}`}
              role="status"
              aria-live="polite"
              title="Verified against deterministic engine data"
            >
              {verification.allVerified ? (
                <>✓ Verified by engine: {verification.verifiedNumbers}/{verification.totalNumbers} numbers</>
              ) : (
                <>⚠️ Number Guard Blocked: {verification.mismatches.length} mismatch</>
              )}
            </span>
          </div>

          <div className="ai-text">
            {verification.allVerified ? (
              <p>{aiResponse.reasoning}</p>
            ) : (
              <div>
                <div className="blocked-sentence" style={{ marginBottom: 8 }} role="alert">
                  <strong>[NUMBER GUARD BLOCKED CLAIM]:</strong> One or more figures in the AI explanation
                  did not match calculated engine baseline. Hallucinated sentence quarantined:
                </div>
                <p style={{ opacity: 0.85 }}>{verification.sanitizedText}</p>
                {verification.mismatches.map((m, i) => (
                  <div key={i} style={{ fontSize: 11, color: '#f87171', marginTop: 4 }}>
                    • Claimed {m.claimed} {m.expected !== null ? `(expected: ${m.expected})` : '(unverified source)'} in context: "{m.context}"
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Side-by-Side Before vs After Comparison */}
      {selectedCandidate && activeAfterKPIs && (
        <div style={{ marginBottom: 16 }} aria-label="Before vs After recovery outcome comparison">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 11, textTransform: 'uppercase', color: '#9ca3af', fontWeight: 700 }}>
              Before vs After Comparison
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              {appliedCandidate?.action.id === selectedCandidate.action.id ? (
                <button
                  className="btn btn-sm btn-ghost"
                  onClick={onRevertCandidate}
                  aria-label="Revert applied candidate action and restore baseline"
                >
                  Revert Applied
                </button>
              ) : (
                <button
                  className="btn btn-sm btn-success"
                  onClick={() => onApplyCandidate(selectedCandidate)}
                  aria-label={`Apply recovery action: ${selectedCandidate.action.description}`}
                >
                  ✓ Apply Recovery
                </button>
              )}
            </div>
          </div>

          <div className="before-after" style={{ borderRadius: 6, overflow: 'hidden' }}>
            <div className="ba-column">
              <div className="ba-label before">Before (Disrupted)</div>
              <div className="ba-row">
                <span className="ba-key">Total Delay:</span>
                <span className="ba-val" style={{ color: '#fbbf24' }}>
                  {formatNumber(baselineResult.kpis.totalDelayMinutes)}m
                </span>
              </div>
              <div className="ba-row">
                <span className="ba-key">Delayed Flights:</span>
                <span className="ba-val">{baselineResult.kpis.delayedFlights}</span>
              </div>
              <div className="ba-row">
                <span className="ba-key">Cancellations:</span>
                <span className="ba-val">{baselineResult.kpis.cancelledFlights}</span>
              </div>
              <div className="ba-row">
                <span className="ba-key">Stranded Pax:</span>
                <span className="ba-val">{baselineResult.kpis.strandedPassengers}</span>
              </div>
              <div className="ba-row">
                <span className="ba-key">Crew Timeouts:</span>
                <span className="ba-val">{baselineResult.kpis.crewViolations}</span>
              </div>
            </div>

            <div className="ba-column">
              <div className="ba-label after">After Action</div>
              <div className="ba-row">
                <span className="ba-key">Total Delay:</span>
                <span className="ba-val" style={{ color: '#4ade80' }}>
                  {formatNumber(activeAfterKPIs.totalDelayMinutes)}m ({selectedCandidate.delta.delayMinutesDelta}m)
                </span>
              </div>
              <div className="ba-row">
                <span className="ba-key">Delayed Flights:</span>
                <span className="ba-val">{activeAfterKPIs.delayedFlights}</span>
              </div>
              <div className="ba-row">
                <span className="ba-key">Cancellations:</span>
                <span className="ba-val">{activeAfterKPIs.cancelledFlights}</span>
              </div>
              <div className="ba-row">
                <span className="ba-key">Stranded Pax:</span>
                <span className="ba-val" style={{ color: selectedCandidate.delta.strandedPassengersDelta < 0 ? '#4ade80' : undefined }}>
                  {activeAfterKPIs.strandedPassengers} ({selectedCandidate.delta.strandedPassengersDelta})
                </span>
              </div>
              <div className="ba-row">
                <span className="ba-key">Crew Timeouts:</span>
                <span className="ba-val">{activeAfterKPIs.crewViolations}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cost Weight Sliders */}
      <fieldset style={{ background: '#111827', padding: 10, borderRadius: 6, marginBottom: 16, border: '1px solid #2d3a4a' }}>
        <legend style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: '#9ca3af', padding: '0 4px' }}>
          ⚖️ Cost Objective Function Weights
        </legend>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
          <div className="weight-slider">
            <label htmlFor={delayWeightId}>
              <span>Delay (per min)</span>
              <span aria-hidden="true">{weights.delayMinuteWeight}</span>
            </label>
            <input
              id={delayWeightId}
              type="range"
              min="0.5"
              max="10"
              step="0.5"
              value={weights.delayMinuteWeight}
              aria-label="Cost weight per minute of flight delay"
              onChange={(e) => onChangeWeights({ ...weights, delayMinuteWeight: Number(e.target.value) })}
            />
          </div>
          <div className="weight-slider">
            <label htmlFor={cancelWeightId}>
              <span>Cancellation</span>
              <span aria-hidden="true">{weights.cancellationWeight}</span>
            </label>
            <input
              id={cancelWeightId}
              type="range"
              min="100"
              max="2000"
              step="100"
              value={weights.cancellationWeight}
              aria-label="Cost weight per flight cancellation"
              onChange={(e) => onChangeWeights({ ...weights, cancellationWeight: Number(e.target.value) })}
            />
          </div>
          <div className="weight-slider">
            <label htmlFor={paxWeightId}>
              <span>Stranded Pax</span>
              <span aria-hidden="true">{weights.strandedPassengerWeight}</span>
            </label>
            <input
              id={paxWeightId}
              type="range"
              min="10"
              max="200"
              step="10"
              value={weights.strandedPassengerWeight}
              aria-label="Cost weight per stranded passenger"
              onChange={(e) => onChangeWeights({ ...weights, strandedPassengerWeight: Number(e.target.value) })}
            />
          </div>
          <div className="weight-slider">
            <label htmlFor={crewWeightId}>
              <span>Crew Violation</span>
              <span aria-hidden="true">{weights.crewViolationWeight}</span>
            </label>
            <input
              id={crewWeightId}
              type="range"
              min="50"
              max="1000"
              step="50"
              value={weights.crewViolationWeight}
              aria-label="Cost weight per crew duty timeout violation"
              onChange={(e) => onChangeWeights({ ...weights, crewViolationWeight: Number(e.target.value) })}
            />
          </div>
        </div>
      </fieldset>

      {/* Ranked Candidate List */}
      <div>
        <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#9ca3af', fontWeight: 700, marginBottom: 8 }}>
          Engine Computed Candidates ({candidates.length})
        </div>

        {candidates.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon" aria-hidden="true">✓</div>
            <div>No disruption active or no viable recovery actions found.</div>
          </div>
        ) : (
          <div role="list" aria-label="Ranked recovery action candidates">
            {candidates.map((cand, idx) => {
              const isSelected = selectedCandidate?.action.id === cand.action.id;
              const isApplied = appliedCandidate?.action.id === cand.action.id;

              return (
                <div
                  key={cand.action.id}
                  className={`recovery-candidate ${isSelected ? 'selected' : ''}`}
                  onClick={() => onSelectCandidate(cand)}
                  onKeyDown={(e) => handleCandidateKeyDown(e, cand)}
                  tabIndex={0}
                  role="button"
                  aria-pressed={isSelected}
                  aria-label={`Rank ${idx + 1}: ${cand.action.description}. Cost score: ${Math.round(cand.delta.costScore)}. Delay delta: ${cand.delta.delayMinutesDelta} minutes. Stranded passengers delta: ${cand.delta.strandedPassengersDelta}.`}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="candidate-rank">
                      #{idx + 1} • {cand.action.type.replace('_', ' ')}
                    </span>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {isApplied && (
                        <span style={{ fontSize: 9, background: '#22c55e', color: 'black', padding: '1px 4px', borderRadius: 2, fontWeight: 700 }} role="status">
                          ACTIVE
                        </span>
                      )}
                      <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#c084fc' }}>
                        Cost: {Math.round(cand.delta.costScore)}
                      </span>
                    </div>
                  </div>

                  <div className="candidate-action">{cand.action.description}</div>

                  <div className="candidate-deltas">
                    <span className={cand.delta.delayMinutesDelta <= 0 ? 'delta-negative' : 'delta-positive'}>
                      Delay: {cand.delta.delayMinutesDelta > 0 ? `+${cand.delta.delayMinutesDelta}` : cand.delta.delayMinutesDelta}m
                    </span>
                    <span className={cand.delta.strandedPassengersDelta <= 0 ? 'delta-negative' : 'delta-positive'}>
                      Pax: {cand.delta.strandedPassengersDelta > 0 ? `+${cand.delta.strandedPassengersDelta}` : cand.delta.strandedPassengersDelta}
                    </span>
                    {cand.delta.cancellationsDelta !== 0 && (
                      <span className={cand.delta.cancellationsDelta <= 0 ? 'delta-negative' : 'delta-positive'}>
                        Cancel: {cand.delta.cancellationsDelta > 0 ? `+${cand.delta.cancellationsDelta}` : cand.delta.cancellationsDelta}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
