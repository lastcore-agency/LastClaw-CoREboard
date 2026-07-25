import type { ReactNode } from 'react';

type NeonVariant = 'cyan' | 'blue' | 'green' | 'amber' | 'red' | 'purple';

interface Props {
  children: ReactNode;
  variant?: NeonVariant;
  selected?: boolean;
  className?: string;
  onClick?: () => void;
  'aria-label'?: string;
}

export function NeonCard({
  children,
  variant = 'cyan',
  selected = false,
  className = '',
  onClick,
  ...rest
}: Props) {
  const classes = [
    'neon-card',
    `neon-card--${variant}`,
    selected ? 'neon-card--selected' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  if (onClick) {
    return (
      <button className={classes} onClick={onClick} type="button" {...rest}>
        {children}
      </button>
    );
  }

  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  );
}
