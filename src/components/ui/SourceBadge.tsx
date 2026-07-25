import type { DataSource } from '../../types';

interface Props {
  source: DataSource;
}

export function SourceBadge({ source }: Props) {
  return (
    <span
      className={`source-badge source-badge--${source.toLowerCase()}`}
      title={source === 'MOCK' ? 'This data is simulated — not connected to OpenClaw' : 'Live data from OpenClaw Gateway'}
    >
      {source === 'MOCK' ? '⚠ MOCK' : '● LIVE'}
    </span>
  );
}
