/**
 * Domino Sky — AI Dispatcher
 *
 * Sends pre-computed recovery data to a Gemini LLM and parses
 * its recommendation. The AI is a "judge", NOT a calculator:
 * it picks from pre-ranked candidates and explains why.
 *
 * The ONLY network call in the whole app lives in `callDispatcher`.
 * Everything else is pure.
 */

import type {
  SimulationResult,
  RecoveryCandidate,
  CostWeights,
  SimulationKPIs,
} from '../engine/types';

// ---------------------------------------------------------------------------
// Config & wire types
// ---------------------------------------------------------------------------

export interface AIDispatcherConfig {
  apiKey: string;
  model: string; // e.g. 'gemini-2.0-flash'
  apiEndpoint: string; // default to Gemini API
}

export interface AIRequest {
  baseline: {
    kpis: SimulationKPIs;
    topDelayedFlights: Array<{
      flightId: string;
      delayMinutes: number;
      cause: string;
    }>;
    missedConnections: number;
    strandedPassengers: number;
  };
  candidates: Array<{
    rank: number;
    action: string;
    description: string;
    costScore: number;
    deltas: {
      delayMinutesDelta: number;
      cancellationsDelta: number;
      strandedPassengersDelta: number;
      crewViolationsDelta: number;
    };
  }>;
  weights: CostWeights;
}

export interface AIResponse {
  chosenActions: string[]; // action IDs
  reasoning: string; // natural-language explanation
  citedNumbers: Array<{
    value: number;
    context: string; // what the number refers to
    source: string; // which field in the request it comes from
  }>;
  confidence: number;
}

// ---------------------------------------------------------------------------
// Prompt builder (pure)
// ---------------------------------------------------------------------------

/**
 * Build a structured prompt that asks the AI to:
 *  1. Understand the baseline disruption
 *  2. Choose the best recovery action(s) from pre-ranked candidates
 *  3. Explain its reasoning using ONLY numbers from the data
 *  4. Return a strict JSON envelope
 */
export function buildDispatcherPrompt(request: AIRequest): string {
  const baselineBlock = [
    `## Current disruption baseline`,
    `- Total flights: ${request.baseline.kpis.totalFlights}`,
    `- Delayed flights: ${request.baseline.kpis.delayedFlights}`,
    `- Cancelled flights: ${request.baseline.kpis.cancelledFlights}`,
    `- On-time flights: ${request.baseline.kpis.onTimeFlights}`,
    `- Total delay: ${request.baseline.kpis.totalDelayMinutes} minutes`,
    `- Average delay: ${request.baseline.kpis.averageDelayMinutes} minutes`,
    `- Missed connections: ${request.baseline.missedConnections}`,
    `- Stranded passengers: ${request.baseline.strandedPassengers}`,
    `- Crew violations: ${request.baseline.kpis.crewViolations}`,
  ].join('\n');

  const flightsBlock = request.baseline.topDelayedFlights
    .map(
      (f, i) =>
        `  ${i + 1}. Flight ${f.flightId}: ${f.delayMinutes} min delay (cause: ${f.cause})`,
    )
    .join('\n');

  const candidatesBlock = request.candidates
    .map(
      (c) =>
        [
          `### Candidate rank ${c.rank} — "${c.action}"`,
          `  Description: ${c.description}`,
          `  Cost score: ${c.costScore}`,
          `  Deltas vs baseline:`,
          `    - Delay minutes delta: ${c.deltas.delayMinutesDelta}`,
          `    - Cancellations delta: ${c.deltas.cancellationsDelta}`,
          `    - Stranded passengers delta: ${c.deltas.strandedPassengersDelta}`,
          `    - Crew violations delta: ${c.deltas.crewViolationsDelta}`,
        ].join('\n'),
    )
    .join('\n\n');

  const weightsBlock = [
    `## Cost weights`,
    `- Delay minute weight: ${request.weights.delayMinuteWeight}`,
    `- Cancellation weight: ${request.weights.cancellationWeight}`,
    `- Stranded passenger weight: ${request.weights.strandedPassengerWeight}`,
    `- Crew violation weight: ${request.weights.crewViolationWeight}`,
  ].join('\n');

  const responseFormat = JSON.stringify(
    {
      chosenActions: ['action_id_1'],
      reasoning: 'I recommend cancelling flight DS-142 because...',
      citedNumbers: [
        {
          value: 45,
          context: 'delay reduction in minutes',
          source: 'candidate_1.deltas.delayMinutesDelta',
        },
      ],
      confidence: 0.85,
    },
    null,
    2,
  );

  return [
    `You are a flight-disruption recovery advisor for the Domino Sky simulator.`,
    ``,
    `# RULES`,
    `1. You are a JUDGE, not a calculator. All numbers have been pre-computed.`,
    `2. You must ONLY cite numbers that appear in the data below. Do NOT invent, estimate, or calculate new numbers.`,
    `3. For every number you mention in your reasoning, you MUST include an entry in "citedNumbers" with the exact value, what it means, and which field it comes from.`,
    `4. Choose one or more recovery actions from the candidates list. Prefer lower cost scores.`,
    `5. Explain your reasoning in plain language, referencing the data.`,
    `6. Set "confidence" between 0 and 1 based on how clearly one option dominates.`,
    ``,
    baselineBlock,
    ``,
    `### Top delayed flights`,
    flightsBlock,
    ``,
    `## Recovery candidates`,
    candidatesBlock,
    ``,
    weightsBlock,
    ``,
    `# RESPONSE FORMAT`,
    `Respond with ONLY valid JSON in this exact shape (no markdown fences, no extra text):`,
    responseFormat,
    ``,
    `Important: "source" must reference a real field path from the data above, e.g.`,
    `"baseline.kpis.totalDelayMinutes", "candidate_1.deltas.delayMinutesDelta",`,
    `"baseline.topDelayedFlights[0].delayMinutes", etc.`,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// API caller (sole network boundary)
// ---------------------------------------------------------------------------

/**
 * Call the configured AI endpoint, parse the response, and return
 * a structured `AIResponse`. Falls back to `generateTemplateFallback`
 * on any failure.
 */
export async function callDispatcher(
  request: AIRequest,
  config: AIDispatcherConfig,
): Promise<AIResponse> {
  const prompt = buildDispatcherPrompt(request);

  try {
    const url = config.apiEndpoint.replace('{model}', config.model);

    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        topP: 0.8,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json',
      },
    };

    const res = await fetch(`${url}?key=${config.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`AI API error ${res.status}: ${errText}`);
      return generateTemplateFallback(request);
    }

    const json = await res.json();

    // Gemini wraps response in candidates[0].content.parts[0].text
    const rawText: string | undefined =
      json?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      console.error('AI API returned empty content');
      return generateTemplateFallback(request);
    }

    const parsed = parseAIResponseJSON(rawText);
    if (!parsed) {
      console.error('Failed to parse AI JSON response');
      return generateTemplateFallback(request);
    }

    return normalizeAIResponse(parsed);
  } catch (err) {
    console.error('AI dispatcher call failed:', err);
    return generateTemplateFallback(request);
  }
}

// ---------------------------------------------------------------------------
// Response parsing helpers
// ---------------------------------------------------------------------------

/**
 * Attempt to parse the AI's raw text into a valid JSON object.
 * Strips markdown fences if the model wraps them despite instructions.
 */
function parseAIResponseJSON(raw: string): Record<string, unknown> | null {
  let cleaned = raw.trim();

  // Strip ```json ... ``` wrappers
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

/**
 * Coerce a parsed JSON blob into a well-typed `AIResponse`,
 * filling defaults for missing fields.
 */
function normalizeAIResponse(raw: Record<string, unknown>): AIResponse {
  const chosenActions: string[] = Array.isArray(raw.chosenActions)
    ? (raw.chosenActions as string[]).filter((a) => typeof a === 'string')
    : [];

  const reasoning =
    typeof raw.reasoning === 'string' ? raw.reasoning : '';

  const citedNumbers: AIResponse['citedNumbers'] = Array.isArray(
    raw.citedNumbers,
  )
    ? (raw.citedNumbers as Array<Record<string, unknown>>)
        .filter(
          (n) =>
            typeof n.value === 'number' &&
            typeof n.context === 'string' &&
            typeof n.source === 'string',
        )
        .map((n) => ({
          value: n.value as number,
          context: n.context as string,
          source: n.source as string,
        }))
    : [];

  const confidence =
    typeof raw.confidence === 'number'
      ? Math.max(0, Math.min(1, raw.confidence))
      : 0.5;

  return { chosenActions, reasoning, citedNumbers, confidence };
}

// ---------------------------------------------------------------------------
// Template-based fallback (pure, offline, always verifiable)
// ---------------------------------------------------------------------------

/**
 * Generate a deterministic, template-based response with NO AI.
 * Every number in the output comes directly from `request`, so
 * verification is trivially guaranteed.
 */
export function generateTemplateFallback(request: AIRequest): AIResponse {
  // Sort candidates by cost score (ascending = best first)
  const sorted = [...request.candidates].sort(
    (a, b) => a.costScore - b.costScore,
  );

  if (sorted.length === 0) {
    return {
      chosenActions: [],
      reasoning:
        'No recovery candidates were provided. The simulation baseline stands as-is.',
      citedNumbers: [],
      confidence: 1,
    };
  }

  const best = sorted[0];
  const citedNumbers: AIResponse['citedNumbers'] = [];

  // Helper to record a cited number
  const cite = (value: number, context: string, source: string) => {
    citedNumbers.push({ value, context, source });
  };

  // --- Build reasoning ---
  const lines: string[] = [];

  lines.push(
    `The best recovery action is "${best.action}" (rank ${best.rank}): ${best.description}.`,
  );
  cite(best.rank, 'candidate rank', `candidate_${best.rank}.rank`);
  cite(best.costScore, 'cost score of chosen action', `candidate_${best.rank}.costScore`);

  if (best.deltas.delayMinutesDelta !== 0) {
    const absDelay = Math.abs(best.deltas.delayMinutesDelta);
    const direction = best.deltas.delayMinutesDelta < 0 ? 'reduce' : 'increase';
    lines.push(
      `This would ${direction} total delay by ${absDelay} minutes.`,
    );
    cite(
      best.deltas.delayMinutesDelta,
      `delay minutes delta`,
      `candidate_${best.rank}.deltas.delayMinutesDelta`,
    );
  }

  if (best.deltas.strandedPassengersDelta !== 0) {
    const absPax = Math.abs(best.deltas.strandedPassengersDelta);
    const direction =
      best.deltas.strandedPassengersDelta < 0 ? 'save' : 'strand';
    lines.push(`It would ${direction} ${absPax} passengers.`);
    cite(
      best.deltas.strandedPassengersDelta,
      'stranded passengers delta',
      `candidate_${best.rank}.deltas.strandedPassengersDelta`,
    );
  }

  if (best.deltas.cancellationsDelta !== 0) {
    lines.push(
      `Cancellations would change by ${best.deltas.cancellationsDelta}.`,
    );
    cite(
      best.deltas.cancellationsDelta,
      'cancellations delta',
      `candidate_${best.rank}.deltas.cancellationsDelta`,
    );
  }

  if (best.deltas.crewViolationsDelta !== 0) {
    lines.push(
      `Crew violations would change by ${best.deltas.crewViolationsDelta}.`,
    );
    cite(
      best.deltas.crewViolationsDelta,
      'crew violations delta',
      `candidate_${best.rank}.deltas.crewViolationsDelta`,
    );
  }

  // Compare with the next-best if available
  if (sorted.length > 1) {
    const runner = sorted[1];
    lines.push(
      `The next-best option "${runner.action}" has a cost score of ${runner.costScore}, ` +
        `compared to ${best.costScore} for the chosen action.`,
    );
    cite(
      runner.costScore,
      'cost score of next-best action',
      `candidate_${runner.rank}.costScore`,
    );
  }

  // Add baseline context
  lines.push(
    `The current baseline shows ${request.baseline.kpis.totalDelayMinutes} total delay minutes ` +
      `across ${request.baseline.kpis.delayedFlights} delayed flights, ` +
      `with ${request.baseline.strandedPassengers} stranded passengers.`,
  );
  cite(
    request.baseline.kpis.totalDelayMinutes,
    'baseline total delay minutes',
    'baseline.kpis.totalDelayMinutes',
  );
  cite(
    request.baseline.kpis.delayedFlights,
    'baseline delayed flights',
    'baseline.kpis.delayedFlights',
  );
  cite(
    request.baseline.strandedPassengers,
    'baseline stranded passengers',
    'baseline.strandedPassengers',
  );

  return {
    chosenActions: [best.action],
    reasoning: lines.join(' '),
    citedNumbers,
    confidence: 1, // template output is deterministic
  };
}
