// The footer's "What each tool teaches". A tool shows from the level that introduces it.
export const LESSONS: { fromLevel: number; tool: string; text: string }[] = [
  {
    fromLevel: 1,
    tool: 'More cooks',
    text: 'cuts waiting in line, but a stalled dish is still slow. p99 barely moves at 6 cooks.',
  },
  {
    fromLevel: 1,
    tool: 'Hedging',
    text: 'sends a second copy of a slow order to another cook and takes whichever finishes first. Set it near p95 so only the stragglers get copied.',
  },
  {
    fromLevel: 3,
    tool: 'LIFO',
    text: 'serves the newest order first. Most orders get faster and a few old ones wait much longer, so the tail gets worse.',
  },
  {
    fromLevel: 3,
    tool: 'Load shedding',
    text: 'turns away orders when the line is long. It caps waiting time, but every dropped order is a customer who got an error.',
  },
  {
    fromLevel: 4,
    tool: 'Prep ahead',
    text: 'is a cache. Hits are near-instant and free up cooks, which shrinks the queue for everyone else.',
  },
];
