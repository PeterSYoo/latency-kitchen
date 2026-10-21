import { LESSONS } from '../levels/lessons';

export function LessonsFooter({ level }: { level: number }) {
  return (
    <details className="panel">
      <summary>What each tool teaches</summary>
      <ul className="lessons">
        {LESSONS.filter((l) => l.fromLevel <= level).map((l) => (
          <li key={l.tool}>
            <b>{l.tool}</b> {l.text}
          </li>
        ))}
      </ul>
    </details>
  );
}
