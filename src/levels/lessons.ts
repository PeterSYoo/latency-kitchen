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
    fromLevel: 2,
    tool: 'Utilization',
    text: 'is how busy the cooks are. Below about 75% the line stays short; past it, waiting time climbs much faster than the load.',
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
    text: 'is a cache. Hits are near-instant and free up cooks, but the hit rate falls when new orders flood in.',
  },
  {
    fromLevel: 5,
    tool: 'Timeouts and retries',
    text: 'let a customer give up on a slow order and reorder, probably from a different cook.',
  },
  {
    fromLevel: 5,
    tool: 'Cancellation',
    text: 'stops work nobody is waiting for. Without it, every retry adds load and a retry storm can take the whole kitchen down.',
  },
  {
    fromLevel: 6,
    tool: 'Quorum',
    text: 'serves a table before its slowest dish is done. With many parallel dishes, the rare slow one becomes the common case.',
  },
  {
    fromLevel: 7,
    tool: 'Staggered pauses',
    text: 'keep some cooks working while others stop, so hedging has somewhere to send the copy.',
  },
];
