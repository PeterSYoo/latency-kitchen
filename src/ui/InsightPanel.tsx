import { useGame } from '../game/store';

export function InsightPanel() {
  const insight = useGame((s) => s.view?.insight);
  return (
    <section className="panel" aria-label="What's happening">
      <div className="ph">
        <h2>What's happening</h2>
      </div>
      <div className="pb">
        <p className="insight">
          {insight ? (
            <>
              <b>{insight.lead}</b> {insight.body}
            </>
          ) : (
            'Warming up the kitchen…'
          )}
        </p>
      </div>
    </section>
  );
}
