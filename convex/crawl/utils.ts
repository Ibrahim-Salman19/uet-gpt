/**
 * Constant-time string comparison to prevent timing attacks.
 * Never returns early on length mismatch — always performs a full comparison
 * and negates on mismatch. This prevents leaking the secret's length through timing.
 */
export function constantTimeCompare(a: string, b: string): boolean {
  const lengthsMatch = a.length === b.length;
  const maxLen = lengthsMatch ? a.length : Math.max(a.length, b.length);
  let result = 0;
  for (let i = 0; i < maxLen; i++) {
    const aChar = i < a.length ? a.charCodeAt(i) : 0;
    const bChar = i < b.length ? b.charCodeAt(i) : 0;
    result |= aChar ^ bChar;
  }
  return lengthsMatch && result === 0;
}
