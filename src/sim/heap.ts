// Binary min-heap of simulation events, ordered by time then insertion order so
// that ties resolve the same way on every run.

export interface Timed {
  t: number;
  seq: number;
}

export class EventHeap<E extends Timed> {
  private items: E[] = [];

  get size(): number {
    return this.items.length;
  }

  peek(): E | undefined {
    return this.items[0];
  }

  push(e: E): void {
    const a = this.items;
    a.push(e);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!less(a[i], a[p])) break;
      [a[i], a[p]] = [a[p], a[i]];
      i = p;
    }
  }

  pop(): E | undefined {
    const a = this.items;
    if (a.length === 0) return undefined;
    const top = a[0];
    const last = a.pop()!;
    if (a.length > 0) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && less(a[l], a[m])) m = l;
        if (r < a.length && less(a[r], a[m])) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m], a[i]];
        i = m;
      }
    }
    return top;
  }
}

function less(a: Timed, b: Timed): boolean {
  return a.t < b.t || (a.t === b.t && a.seq < b.seq);
}
