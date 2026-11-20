import React, { useState } from 'react';
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

  // Build AI Request object from current baseline and candidates
  const buildAIRequestData = (): AIRequest => {
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
  };

  const handleAskAI = async () => {
    setIsAiLoading(true);
    setIsTampered(false);
    try {
      const requestData = buildAIRequestData();
      // Generate response (deterministic fallback runs offline instantly)
      const res = generateTemplateFallback(requestData);
      setAiResponse(res);

      // Verify with Number Guard
      const claims = extractNumbers(res.reasoning);
      const vResult = verifyNumbers(claims, requestData, baselineResult);
      setVerification(vResult);

      // Auto-select the candidate recommended by AI
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
    // Inject a deliberate hallucinated/tampered number
    const tampered = injectTamperNumber(aiResponse);
    setAiResponse(tampered);
    setIsTampered(true);

    // Run Number Guard on tampered response
    const requestData = buildAIRequestData();
    const claims = extractNumbers(tampered.reasoning);
    const vResult = verifyNumbers(claims, requestData, baselineResult);
    setVerification(vResult);
  };

  const activeAfterKPIs: SimulationKPIs | undefined = selectedCandidate?.resultAfter.kpis;

  return (
    <div className="recovery-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, color: '#60a5fa', margin: 0 }}>
          🛡️ Recovery Dispatcher
        </h3>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            className="btn btn-sm btn-primary"
            onClick={handleAskAI}
            disabled={isAiLoading || candidates.length === 0}
          >
            {isAiLoading ? 'Analyzing...' : '🤖 AI Dispatcher'}
          </button>
          <button
            className="btn btn-sm btn-danger"
            onClick={handleTamperTest}
            title="Inject deliberate incorrect number to test Number Guard trust layer"
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
                <div className="blocked-sentence" style={{ marginBottom: 8 }}>
                  <strong>[NUMBER GUARD BLOCKED HALLUCINATION]:</strong> One or more figures in the AI explanation
                  did not match calculated engine baseline. Untrusted claim quarantined:
                </div>
                <p style={{ opacity: 0.8 }}>{verification.sanitizedText}</p>
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
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 11, textTransform: 'uppercase', color: '#9ca3af', fontWeight: 700 }}>
              Before vs After Comparison
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              {appliedCandidate?.action.id === selectedCandidate.action.id ? (
                <button className="btn btn-sm btn-ghost" onClick={onRevertCandidate}>
                  Revert Applied
                </button>
              ) : (
                <button
                  className="btn btn-sm btn-success"
                  onClick={() => onApplyCandidate(selectedCandidate)}
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
                <span className="ba-val" style={{ color: '#f59e0b' }}>
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
                <span className="ba-val" style={{ color: '#22c55e' }}>
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
                <span className="ba-val" style={{ color: selectedCandidate.delta.strandedPassengersDelta < 0 ? '#22c55e' : undefined }}>
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
      <div style={{ background: '#111827', padding: 10, borderRadius: 6, marginBottom: 16, border: '1px solid #2d3a4a' }}>
        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: '#9ca3af', marginBottom: 8 }}>
          ⚖️ Cost Objective Function Weights
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
          <div className="weight-slider">
            <label>
              <span>Delay (per min)</span>
              <span>{weights.delayMinuteWeight}</span>
            </label>
            <input
              type="range"
              min="0.5"
              max="10"
              step="0.5"
              value={weights.delayMinuteWeight}
              onChange={(e) => onChangeWeights({ ...weights, delayMinuteWeight: Number(e.target.value) })}
            />
          </div>
          <div className="weight-slider">
            <label>
              <span>Cancellation</span>
              <span>{weights.cancellationWeight}</span>
            </label>
            <input
              type="range"
              min="100"
              max="2000"
              step="100"
              value={weights.cancellationWeight}
              onChange={(e) => onChangeWeights({ ...weights, cancellationWeight: Number(e.target.value) })}
            />
          </div>
          <div className="weight-slider">
            <label>
              <span>Stranded Pax</span>
              <span>{weights.strandedPassengerWeight}</span>
            </label>
            <input
              type="range"
              min="10"
              max="200"
              step="10"
              value={weights.strandedPassengerWeight}
              onChange={(e) => onChangeWeights({ ...weights, strandedPassengerWeight: Number(e.target.value) })}
            />
          </div>
          <div className="weight-slider">
            <label>
              <span>Crew Violation</span>
              <span>{weights.crewViolationWeight}</span>
            </label>
            <input
              type="range"
              min="50"
              max="1000"
              step="50"
              value={weights.crewViolationWeight}
              onChange={(e) => onChangeWeights({ ...weights, crewViolationWeight: Number(e.target.value) })}
            />
          </div>
        </div>
      </div>

      {/* Ranked Candidate List */}
      <div>
        <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#9ca3af', fontWeight: 700, marginBottom: 8 }}>
          Engine Computed Candidates ({candidates.length})
        </div>

        {candidates.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">✓</div>
            <div>No disruption active or no viable recovery actions found.</div>
          </div>
        ) : (
          candidates.map((cand, idx) => {
            const isSelected = selectedCandidate?.action.id === cand.action.id;
            const isApplied = appliedCandidate?.action.id === cand.action.id;

            return (
              <div
                key={cand.action.id}
                className={`recovery-candidate ${isSelected ? 'selected' : ''}`}
                onClick={() => onSelectCandidate(cand)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="candidate-rank">
                    #{idx + 1} • {cand.action.type.replace('_', ' ')}
                  </span>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {isApplied && (
                      <span style={{ fontSize: 9, background: '#22c55e', color: 'black', padding: '1px 4px', borderRadius: 2, fontWeight: 'bold' }}>
                        ACTIVE
                      </span>
                    )}
                    <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#a855f7' }}>
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
          })
        )}
      </div>
    </div>
  );
};
