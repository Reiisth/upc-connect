import "server-only";
import { DECISION_SUPPORT_MAX_OUTPUT_CHARS } from "./config";
import { DecisionSupportError } from "./errors";
import { decisionSupportEvidenceIndex } from "./input";
import { decisionSupportInsightSchema } from "./schemas";
import type { DecisionSupportInput, DecisionSupportEvidence } from "./types";

/** Compare numeric literals as decimal text, including large currency values. No floating money conversion. */
function numericLiterals(value: string): string[] {
  return (value.match(/-?\d+(?:,\d{3})*(?:\.\d+)?/g) ?? []).map((token) => {
    const [whole, fraction = ""] = token.replaceAll(",", "").split(".");
    const normalizedWhole = whole.replace(/^(-?)0+(?=\d)/, "$1");
    const normalizedFraction = fraction.replace(/0+$/, "");
    return `${normalizedWhole === "-0" ? "0" : normalizedWhole}${normalizedFraction ? `.${normalizedFraction}` : ""}`;
  });
}

export function validateDecisionSupportResponse(raw: unknown, input: DecisionSupportInput) {
  if (typeof raw !== "string" || raw.length > DECISION_SUPPORT_MAX_OUTPUT_CHARS) throw new DecisionSupportError("INVALID_RESPONSE");
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new DecisionSupportError("INVALID_RESPONSE"); }
  const parsed = decisionSupportInsightSchema.safeParse(value);
  if (!parsed.success) throw new DecisionSupportError("INVALID_RESPONSE");
  const insight = parsed.data;
  const index = decisionSupportEvidenceIndex(input);
  const paths = new Set([...insight.keyFindings.flatMap((finding) => finding.evidence), ...insight.recommendations.flatMap((item) => item.evidence)]);
  if ([...paths].some((path) => !index.has(path))) throw new DecisionSupportError("INVALID_RESPONSE");
  const evidence: DecisionSupportEvidence[] = [...paths].map((path) => ({ path, value: index.get(path)! }));

  // A bounded guard against novel numeric claims, not a proof that prose correctly interprets its evidence.
  const suppliedNumbers = new Set([...index.values()].flatMap((scalar) => typeof scalar === "string" || typeof scalar === "number" ? numericLiterals(String(scalar)) : []));
  const prose = [insight.executiveSummary, ...insight.limitations,
    ...insight.keyFindings.flatMap((item) => [item.title, item.observation]),
    ...insight.recommendations.flatMap((item) => [item.title, item.recommendation, item.rationale])];
  if (prose.some((text) => numericLiterals(text).some((literal) => !suppliedNumbers.has(literal)))) throw new DecisionSupportError("INVALID_RESPONSE");
  return { insight, evidence };
}
