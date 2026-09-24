/**
 * Checks if a string is a valid UUID format (8-4-4-4-12 hex).
 */
export function isValidUUID(str: string): boolean {
  if (!str || typeof str !== 'string') return false;
  const trimmed = str.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed);
}

/**
 * Deterministically generates a valid UUID v4-shaped RFC 4122 string from any arbitrary string (e.g. Firebase UID).
 * Uses a pure 128-bit hash algorithm so it works synchronously everywhere without external dependencies.
 */
export function toDeterministicUUID(input: string): string {
  if (!input || typeof input !== 'string') {
    return '00000000-0000-4000-8000-000000000000';
  }

  const trimmed = input.trim();

  // If already a valid UUID, return normalized lowercase
  if (isValidUUID(trimmed)) {
    return trimmed.toLowerCase();
  }

  // 128-bit hashing using 4 32-bit seeds (FNV-1a / Murmur mix)
  let h1 = 0x811c9dc5;
  let h2 = 0x6c62272e;
  let h3 = 0x9e3779b9;
  let h4 = 0x27d4eb2f;

  for (let i = 0; i < trimmed.length; i++) {
    const code = trimmed.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 0x01000193);
    h2 = Math.imul(h2 ^ ((code << 5) | (code >>> 27)), 0x5bd1e995);
    h3 = Math.imul(h3 ^ ((code << 11) | (code >>> 21)), 0xcc9e2d51);
    h4 = Math.imul(h4 ^ ((code << 17) | (code >>> 15)), 0x1b873593);
  }

  // Avalanche bit mixing
  h1 ^= h1 >>> 16; h1 = Math.imul(h1, 0x85ebca6b); h1 ^= h1 >>> 13; h1 = Math.imul(h1, 0xc2b2ae35); h1 ^= h1 >>> 16;
  h2 ^= h2 >>> 16; h2 = Math.imul(h2, 0x85ebca6b); h2 ^= h2 >>> 13; h2 = Math.imul(h2, 0xc2b2ae35); h2 ^= h2 >>> 16;
  h3 ^= h3 >>> 16; h3 = Math.imul(h3, 0x85ebca6b); h3 ^= h3 >>> 13; h3 = Math.imul(h3, 0xc2b2ae35); h3 ^= h3 >>> 16;
  h4 ^= h4 >>> 16; h4 = Math.imul(h4, 0x85ebca6b); h4 ^= h4 >>> 13; h4 = Math.imul(h4, 0xc2b2ae35); h4 ^= h4 >>> 16;

  const hex1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const hex2 = (h2 >>> 0).toString(16).padStart(8, '0');
  const hex3 = (h3 >>> 0).toString(16).padStart(8, '0');
  const hex4 = (h4 >>> 0).toString(16).padStart(8, '0');

  const combined = hex1 + hex2 + hex3 + hex4;

  // Format as RFC 4122 compliant UUID (version 4, variant 1): 8-4-4-4-12
  const part1 = combined.slice(0, 8);
  const part2 = combined.slice(8, 12);
  const part3 = '4' + combined.slice(13, 16);
  const part4 = ((parseInt(combined.slice(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, '0') + combined.slice(18, 20);
  const part5 = combined.slice(20, 32);

  return `${part1}-${part2}-${part3}-${part4}-${part5}`.toLowerCase();
}
