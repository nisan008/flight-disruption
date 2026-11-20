/**
 * Domino Sky — Number Guard
 *
 * Extracts every numeric claim from AI-generated text, verifies it
 * against the engine data that was sent to the AI, and produces
 * annotated / sanitized output.
 *
 * Pure functions only — no side effects, no network calls.
 */

import type { SimulationResult } from '../engine/types';
import type { AIRequest, AIResponse } from './dispatcher';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface NumberClaim {
  value: number;
  position: number; // character position in the text
  sentence: string; // the sentence containing the number
  context: string; // surrounding words for matching
}

export interface VerificationResult {
  totalNumbers: number;
  verifiedNumbers: number;
  mismatches: NumberMismatch[];
  allVerified: boolean;
  sanitizedText: string; // text with mismatched sentences blocked
  annotations: NumberAnnotation[];
}

export interface NumberMismatch {
  claimed: number;
  expected: number | null; // null if number has no matching source
  sentence: string;
  context: string;
}

export interface NumberAnnotation {
  value: number;
  position: number;
  verified: boolean;
  source: string; // what engine data point this matches
  mismatch?: { expected: number };
}

// ---------------------------------------------------------------------------
// Number extraction
// ---------------------------------------------------------------------------

/**
 * Patterns to SKIP when extracting numbers:
 * - Flight numbers like DS-142, AI-612
 * - 24-hour time like 14:00
 * - Ordinals like 1st, 2nd, 3rd, 4th
 * - Standalone "0" or "1" that are likely articles/grammar
 */
const SKIP_PATTERNS: RegExp[] = [
  /[A-Z]{1,3}-\d+/g, // flight numbers: DS-142, AI-612
  /\d{1,2}:\d{2}/g, // times: 14:00, 9:30
  /\d+(?:st|nd|rd|th)\b/gi, // ordinals: 1st, 2nd
];

/**
 * Extract all numeric claims from free text.
 *
 * Skips flight numbers, clock times, and ordinals.
 * Includes integers and decimals that represent delay minutes,
 * passenger counts, cost scores, etc.
 */
export function extractNumbers(text: string): NumberClaim[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  // Build a set of character ranges to skip
  const skipRanges: Array<[number, number]> = [];
  for (const pattern of SKIP_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      skipRanges.push([match.index, match.index + match[0].length]);
    }
  }

  const isSkipped = (pos: number, len: number): boolean =>
    skipRanges.some(
      ([start, end]) =>
        // The number overlaps with a skip range
        (pos >= start && pos < end) || (pos + len > start && pos + len <= end),
    );

  // Split text into sentences for context
  const sentences = splitSentences(text);

  // Find all numbers: integers and decimals, possibly negative
  const numberRegex = /-?\d+(?:\.\d+)?/g;
  const claims: NumberClaim[] = [];

  let match: RegExpExecArray | null;
  while ((match = numberRegex.exec(text)) !== null) {
    const raw = match[0];
    const pos = match.index;

    if (isSkipped(pos, raw.length)) {
      continue;
    }

    // Skip percentages (number followed by %)
    if (text[pos + raw.length] === '%') {
      continue;
    }

    const value = parseFloat(raw);

    // Skip NaN results
    if (Number.isNaN(value)) {
      continue;
    }

    const sentence = findContainingSentence(sentences, pos, text);
    const context = extractContext(text, pos, raw.length);

    claims.push({ value, position: pos, sentence, context });
  }

  return claims;
}

// ---------------------------------------------------------------------------
// Number verification
// ---------------------------------------------------------------------------

/** A categorised pool entry with a numeric value and what it represents. */
interface PoolEntry {
  value: number;
  source: string;
  category: NumberCategory;
}

/** Categories for context-aware matching. */
type NumberCategory =
  | 'delay'
  | 'passenger'
  | 'cancellation'
  | 'crew'
  | 'flight_count'
  | 'cost'
  | 'connection'
  | 'general';

/** Keywords that map to categories for NLP-lite context matching. */
const CATEGORY_KEYWORDS: Record<NumberCategory, string[]> = {
  delay: ['delay', 'minute', 'minutes', 'min', 'late', 'behind'],
  passenger: ['passenger', 'passengers', 'pax', 'stranded', 'people'],
  cancellation: ['cancel', 'cancellation', 'cancellations', 'cancelled'],
  crew: ['crew', 'violation', 'violations', 'duty', 'timed out'],
  flight_count: ['flight', 'flights', 'total flights', 'on-time', 'on time'],
  cost: ['cost', 'score', 'weight'],
  connection: ['connection', 'connections', 'missed', 'connecting'],
  general: [],
};

/**
 * Build a "number pool" from the engine data: every numeric value
 * that the AI could legitimately cite, with its source path and
 * category.
 */
function buildNumberPool(
  engineData: AIRequest,
  result: SimulationResult,
): PoolEntry[] {
  const pool: PoolEntry[] = [];

  const add = (value: number, source: string, category: NumberCategory) => {
    pool.push({ value, source, category });
  };

  // Baseline KPIs
  const kpis = engineData.baseline.kpis;
  add(kpis.totalFlights, 'baseline.kpis.totalFlights', 'flight_count');
  add(kpis.delayedFlights, 'baseline.kpis.delayedFlights', 'flight_count');
  add(kpis.cancelledFlights, 'baseline.kpis.cancelledFlights', 'cancellation');
  add(kpis.onTimeFlights, 'baseline.kpis.onTimeFlights', 'flight_count');
  add(kpis.totalDelayMinutes, 'baseline.kpis.totalDelayMinutes', 'delay');
  add(kpis.averageDelayMinutes, 'baseline.kpis.averageDelayMinutes', 'delay');
  add(kpis.missedConnections, 'baseline.kpis.missedConnections', 'connection');
  add(kpis.strandedPassengers, 'baseline.kpis.strandedPassengers', 'passenger');
  add(kpis.crewViolations, 'baseline.kpis.crewViolations', 'crew');

  // Baseline top-level
  add(engineData.baseline.missedConnections, 'baseline.missedConnections', 'connection');
  add(engineData.baseline.strandedPassengers, 'baseline.strandedPassengers', 'passenger');

  // Top delayed flights
  engineData.baseline.topDelayedFlights.forEach((f, i) => {
    add(f.delayMinutes, `baseline.topDelayedFlights[${i}].delayMinutes`, 'delay');
  });

  // Candidates
  engineData.candidates.forEach((c) => {
    const prefix = `candidate_${c.rank}`;
    add(c.rank, `${prefix}.rank`, 'general');
    add(c.costScore, `${prefix}.costScore`, 'cost');
    add(c.deltas.delayMinutesDelta, `${prefix}.deltas.delayMinutesDelta`, 'delay');
    add(c.deltas.cancellationsDelta, `${prefix}.deltas.cancellationsDelta`, 'cancellation');
    add(c.deltas.strandedPassengersDelta, `${prefix}.deltas.strandedPassengersDelta`, 'passenger');
    add(c.deltas.crewViolationsDelta, `${prefix}.deltas.crewViolationsDelta`, 'crew');
  });

  // Cost weights
  add(engineData.weights.delayMinuteWeight, 'weights.delayMinuteWeight', 'cost');
  add(engineData.weights.cancellationWeight, 'weights.cancellationWeight', 'cost');
  add(engineData.weights.strandedPassengerWeight, 'weights.strandedPassengerWeight', 'cost');
  add(engineData.weights.crewViolationWeight, 'weights.crewViolationWeight', 'cost');

  // Full simulation result KPIs (cross-reference)
  const rKpis = result.kpis;
  add(rKpis.totalFlights, 'result.kpis.totalFlights', 'flight_count');
  add(rKpis.delayedFlights, 'result.kpis.delayedFlights', 'flight_count');
  add(rKpis.cancelledFlights, 'result.kpis.cancelledFlights', 'cancellation');
  add(rKpis.onTimeFlights, 'result.kpis.onTimeFlights', 'flight_count');
  add(rKpis.totalDelayMinutes, 'result.kpis.totalDelayMinutes', 'delay');
  add(rKpis.averageDelayMinutes, 'result.kpis.averageDelayMinutes', 'delay');
  add(rKpis.missedConnections, 'result.kpis.missedConnections', 'connection');
  add(rKpis.strandedPassengers, 'result.kpis.strandedPassengers', 'passenger');
  add(rKpis.crewViolations, 'result.kpis.crewViolations', 'crew');

  // Individual flight delays from the full result
  result.flights.forEach((f) => {
    if (f.delayMinutes > 0) {
      add(f.delayMinutes, `result.flights.${f.flightId}.delayMinutes`, 'delay');
    }
    // Some implementations may attach passengerCount or it can be accessed if present
    const pCount = (f as unknown as { passengerCount?: number }).passengerCount;
    if (pCount !== undefined) {
      add(pCount, `result.flights.${f.flightId}.passengerCount`, 'passenger');
    }
  });

  // Connection passenger counts from the full result
  result.connections.forEach((c) => {
    add(c.passengerCount, `result.connections.${c.connectionId}.passengerCount`, 'passenger');
  });

  return pool;
}

/**
 * Infer the category of a number claim from its surrounding context words.
 */
function inferCategory(context: string): NumberCategory[] {
  const lower = context.toLowerCase();
  const matched: NumberCategory[] = [];

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS) as Array<
    [NumberCategory, string[]]
  >) {
    if (category === 'general') continue;
    if (keywords.some((kw) => lower.includes(kw))) {
      matched.push(category);
    }
  }

  return matched.length > 0 ? matched : ['general'];
}

/**
 * Verify every extracted numeric claim against the engine data pool.
 *
 * A number is "verified" if:
 *  - Its value matches a pool entry within ±1 (rounding tolerance)
 *  - AND the inferred context category overlaps with the pool entry's category
 *    (or the category is "general", which matches anything)
 *
 * Pure function — no side effects.
 */
export function verifyNumbers(
  claims: NumberClaim[],
  engineData: AIRequest,
  result: SimulationResult,
): VerificationResult {
  if (claims.length === 0) {
    return {
      totalNumbers: 0,
      verifiedNumbers: 0,
      mismatches: [],
      allVerified: true,
      sanitizedText: '',
      annotations: [],
    };
  }

  const pool = buildNumberPool(engineData, result);
  const annotations: NumberAnnotation[] = [];
  const mismatches: NumberMismatch[] = [];
  const mismatchedSentences = new Set<string>();
  let verifiedCount = 0;

  for (const claim of claims) {
    const categories = inferCategory(claim.context);
    const matchResult = findBestMatch(claim.value, categories, pool);

    if (matchResult.verified) {
      verifiedCount++;
      annotations.push({
        value: claim.value,
        position: claim.position,
        verified: true,
        source: matchResult.source,
      });
    } else {
      const mismatch: NumberMismatch = {
        claimed: claim.value,
        expected: matchResult.closestValue,
        sentence: claim.sentence,
        context: claim.context,
      };
      mismatches.push(mismatch);
      mismatchedSentences.add(claim.sentence);

      annotations.push({
        value: claim.value,
        position: claim.position,
        verified: false,
        source: matchResult.source || 'unknown',
        mismatch: matchResult.closestValue !== null
          ? { expected: matchResult.closestValue }
          : undefined,
      });
    }
  }

  // Build sanitized text: block sentences that contain mismatched numbers
  const firstClaim = claims[0];
  // Reconstruct the full text from the first claim's broader context
  // We need the original text — derive it from claims
  const originalText = reconstructText(claims);
  const sanitizedText = sanitize(originalText, mismatchedSentences);

  return {
    totalNumbers: claims.length,
    verifiedNumbers: verifiedCount,
    mismatches,
    allVerified: mismatches.length === 0,
    sanitizedText,
    annotations,
  };
}

// ---------------------------------------------------------------------------
// Matching helpers
// ---------------------------------------------------------------------------

interface MatchResult {
  verified: boolean;
  source: string;
  closestValue: number | null;
}

/**
 * Find the best matching pool entry for a claimed number.
 *
 * Strategy:
 *  1. Exact match (±1 tolerance) with matching category → verified
 *  2. Exact match (±1 tolerance) with "general" category → verified
 *  3. No match → find closest value in matching category for mismatch report
 */
function findBestMatch(
  claimed: number,
  categories: NumberCategory[],
  pool: PoolEntry[],
): MatchResult {
  const TOLERANCE = 1;

  // 1. Category-matched exact match
  for (const entry of pool) {
    if (
      Math.abs(entry.value - claimed) <= TOLERANCE &&
      (categories.includes(entry.category) || categories.includes('general'))
    ) {
      return { verified: true, source: entry.source, closestValue: entry.value };
    }
  }

  // 2. Any-category exact match (the number exists in the data somewhere)
  for (const entry of pool) {
    if (Math.abs(entry.value - claimed) <= TOLERANCE) {
      return { verified: true, source: entry.source, closestValue: entry.value };
    }
  }

  // 3. No exact match — find closest value in matching categories for the mismatch report
  let closest: PoolEntry | null = null;
  let closestDist = Infinity;

  for (const entry of pool) {
    if (categories.includes(entry.category) || categories.includes('general')) {
      const dist = Math.abs(entry.value - claimed);
      if (dist < closestDist) {
        closestDist = dist;
        closest = entry;
      }
    }
  }

  return {
    verified: false,
    source: closest?.source ?? '',
    closestValue: closest?.value ?? null,
  };
}

// ---------------------------------------------------------------------------
// Tamper injection (for testing UI)
// ---------------------------------------------------------------------------

/**
 * Deep-clone an `AIResponse` and tamper with one cited number,
 * changing it by 10–50%. Used when the user clicks the
 * "AI tamper test" button.
 */
export function injectTamperNumber(response: AIResponse): AIResponse {
  const tampered = structuredClone(response);

  if (tampered.citedNumbers.length === 0) {
    // No numbers to tamper — inject a fake one into the reasoning
    tampered.reasoning += ' This affects 9999 passengers.';
    tampered.citedNumbers.push({
      value: 9999,
      context: 'fake passenger count',
      source: 'injected_tamper',
    });
    return tampered;
  }

  // Pick a random cited number to tamper
  const idx = Math.floor(Math.random() * tampered.citedNumbers.length);
  const original = tampered.citedNumbers[idx].value;

  // Change by 10–50% (always at least ±2 to avoid rounding tolerance)
  const factor = 1 + (0.1 + Math.random() * 0.4) * (Math.random() > 0.5 ? 1 : -1);
  let newValue = Math.round(original * factor);
  if (Math.abs(newValue - original) <= 1) {
    newValue = original + (original >= 0 ? 2 : -2);
  }

  tampered.citedNumbers[idx].value = newValue;

  // Also tamper the number in the reasoning text if it appears
  const originalStr = String(original);
  const newStr = String(newValue);
  tampered.reasoning = tampered.reasoning.replace(originalStr, newStr);

  return tampered;
}

// ---------------------------------------------------------------------------
// Correction prompt builder
// ---------------------------------------------------------------------------

/**
 * Build a re-prompt that tells the AI which numbers were wrong
 * and asks it to regenerate with correct values.
 * Maximum 2 retries before the caller should fall back to template.
 */
export function buildCorrectionPrompt(
  originalRequest: AIRequest,
  mismatches: NumberMismatch[],
): string {
  const mismatchLines = mismatches.map((m, i) => {
    const expectedStr =
      m.expected !== null ? `should be ${m.expected}` : 'has no matching source data';
    return `${i + 1}. You stated ${m.claimed} in "${m.sentence}" — this ${expectedStr}.`;
  });

  return [
    `Your previous response contained ${mismatches.length} incorrect number(s).`,
    ``,
    `## Mismatches`,
    ...mismatchLines,
    ``,
    `## Instructions`,
    `1. Review the original data provided to you.`,
    `2. Regenerate your response using ONLY numbers from the data.`,
    `3. For each number you cite, double-check it against the data before including it.`,
    `4. Return the same JSON format as before.`,
    ``,
    `Remember: you are a JUDGE, not a calculator. Only cite numbers that exist in the data.`,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Text utilities (pure)
// ---------------------------------------------------------------------------

/**
 * Split text into sentences, handling common abbreviations.
 */
function splitSentences(text: string): Array<{ text: string; start: number; end: number }> {
  const sentences: Array<{ text: string; start: number; end: number }> = [];
  // Split on sentence boundaries: .!? followed by space or end of string
  const regex = /[^.!?]*[.!?]+(?:\s|$)|[^.!?]+$/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const trimmed = match[0].trim();
    if (trimmed.length > 0) {
      sentences.push({
        text: trimmed,
        start: match.index,
        end: match.index + match[0].length,
      });
    }
  }

  // If no sentences found (no punctuation), treat the entire text as one sentence
  if (sentences.length === 0 && text.trim().length > 0) {
    sentences.push({ text: text.trim(), start: 0, end: text.length });
  }

  return sentences;
}

/**
 * Find the sentence that contains a given character position.
 */
function findContainingSentence(
  sentences: Array<{ text: string; start: number; end: number }>,
  position: number,
  fullText: string,
): string {
  for (const s of sentences) {
    if (position >= s.start && position < s.end) {
      return s.text;
    }
  }
  // Fallback: return a window around the position
  const start = Math.max(0, position - 40);
  const end = Math.min(fullText.length, position + 40);
  return fullText.slice(start, end).trim();
}

/**
 * Extract context words around a number (±30 characters).
 */
function extractContext(text: string, position: number, length: number): string {
  const WINDOW = 30;
  const start = Math.max(0, position - WINDOW);
  const end = Math.min(text.length, position + length + WINDOW);
  return text.slice(start, end).trim();
}

/**
 * Reconstruct the original text from claims by finding the min/max positions
 * and using the sentences.
 */
function reconstructText(claims: NumberClaim[]): string {
  // Collect all unique sentences in order
  const seen = new Set<string>();
  const orderedSentences: string[] = [];
  for (const claim of claims) {
    if (!seen.has(claim.sentence)) {
      seen.add(claim.sentence);
      orderedSentences.push(claim.sentence);
    }
  }
  return orderedSentences.join(' ');
}

/**
 * Replace sentences containing mismatched numbers with a blocked marker.
 */
function sanitize(text: string, mismatchedSentences: Set<string>): string {
  if (mismatchedSentences.size === 0) {
    return text;
  }

  let sanitized = text;
  for (const sentence of mismatchedSentences) {
    sanitized = sanitized.replace(
      sentence,
      '[BLOCKED: number mismatch detected]',
    );
  }

  return sanitized;
}
