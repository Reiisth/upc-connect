export type MemberConnectionResult = { redirectTo: string; error?: never } | { error: string; redirectTo?: never };

export class MemberConnectionValidationError extends Error {}

/** Start the operation immediately, but show its result only after the visual finishes. */
export async function finishMemberConnection<T>(operation: () => Promise<T>, animation: Promise<void>): Promise<T> {
  const [result] = await Promise.allSettled([Promise.resolve().then(operation), animation]);
  if (result.status === "rejected") throw result.reason;
  return result.value;
}
