// Seeded randomness. Every draw in the engine comes from a named stream so that
// changing one control (say, queue order) doesn't reshuffle unrelated draws.

export interface Rng {
  /** Uniform in [0, 1). */
  next(): number;
}

/** mulberry32: small, fast, good enough for a game. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return {
    next() {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

/** Mixes a seed and a stream name into a 32-bit seed (cyrb53-style). */
export function streamSeed(seed: number, name: string): number {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < name.length; i++) {
    const ch = name.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h1 ^ h2) >>> 0;
}

export function stream(seed: number, name: string): Rng {
  return mulberry32(streamSeed(seed, name));
}

/** Exponential with the given mean. */
export function exponential(rng: Rng, mean: number): number {
  return -mean * Math.log(1 - rng.next());
}

/** Standard normal via Box–Muller. Always consumes exactly two draws. */
export function normal(rng: Rng): number {
  const u1 = 1 - rng.next(); // (0, 1]
  const u2 = rng.next();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

export function lognormal(rng: Rng, median: number, sigma: number): number {
  return median * Math.exp(sigma * normal(rng));
}

export function uniform(rng: Rng, min: number, max: number): number {
  return min + (max - min) * rng.next();
}
