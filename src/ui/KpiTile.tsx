import type { ReactNode } from 'react';
import { Sparkline, type SparkKey } from '../views/Sparkline';

interface Props {
  name: string;
  value: string;
  caption: ReactNode;
  spark: SparkKey;
  swatch?: string;
  breach?: boolean;
  limit?: number;
}

export function KpiTile({ name, value, caption, spark, swatch, breach, limit }: Props) {
  return (
    <div className={breach ? 'kpi breach' : 'kpi'}>
      <div className="k">
        {name}
        {breach && <span className="tag fail">FAIL</span>}
        {swatch && <i style={{ background: swatch }} />}
      </div>
      <div className="v">{value}</div>
      <div className="sub">{caption}</div>
      <Sparkline metric={spark} limit={limit} />
    </div>
  );
}
