import type { DataSource } from '../../types';

interface Props {
  source: DataSource;
}

export function SourceBadge({ source }: Props) {
  let label = source;
  let icon = '';

  switch (source) {
    case 'LIVE':
      label = 'LIVE';
      icon = '● ';
      break;
    case 'CACHED':
    case 'FALLBACK':
      icon = '⚠ ';
      break;
    case 'MOCK':
      icon = '⚠ ';
      break;
    case 'ERROR':
      icon = '✖ ';
      break;
    case 'EMPTY':
      icon = '○ ';
      break;
    default:
      icon = '';
  }

  const title = source === 'MOCK' 
    ? 'This data is simulated — not connected to OpenClaw' 
    : `Data source: ${source}`;

  return (
    <span
      className={`source-badge source-badge--${source.toLowerCase()}`}
      title={title}
    >
      {icon}{label}
    </span>
  );
}
