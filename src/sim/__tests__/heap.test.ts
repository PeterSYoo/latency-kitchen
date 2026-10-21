import { describe, expect, it } from 'vitest';
import { EventHeap } from '../heap';
import { mulberry32 } from '../rng';

describe('EventHeap', () => {
  it('pops in time order, ties in insertion order', () => {
    const h = new EventHeap<{ t: number; seq: number }>();
    const r = mulberry32(9);
    for (let i = 0; i < 1000; i++) h.push({ t: Math.floor(r.next() * 50), seq: i });
    let prev = { t: -1, seq: -1 };
    while (h.size) {
      const e = h.pop()!;
      expect(e.t > prev.t || (e.t === prev.t && e.seq > prev.seq)).toBe(true);
      prev = e;
    }
    expect(h.pop()).toBeUndefined();
  });
});
