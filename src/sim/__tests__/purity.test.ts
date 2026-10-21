import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// src/sim must stay deterministic and framework-free.
const dir = join(__dirname, '..');
const files = readdirSync(dir).filter((f) => f.endsWith('.ts'));

describe('src/sim purity', () => {
  it.each(files)('%s uses no wall clock, global randomness, DOM or React', (f) => {
    const src = readFileSync(join(dir, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(src).not.toMatch(/Math\.random|\bDate\b|\bperformance\b|(?<![.\w])(window|document)\b|from ['"]react/);
  });
});
