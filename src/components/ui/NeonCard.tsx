import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

type NeonVariant = 'violet' | 'cyan' | 'blue' | 'green' | 'amber' | 'red' | 'purple';

interface Props {
  children: ReactNode;
  variant?: NeonVariant;
  selected?: boolean;
  active?: boolean;
  className?: string;
  onClick?: () => void;
  'aria-label'?: string;
}

export function NeonCard({ children, variant = 'violet', selected = false, active = false, className = '', onClick, ...rest }: Props) {
  const classes = ['premium-card', `premium-card--${variant}`, selected ? 'is-selected' : '', active ? 'is-active' : '', className].filter(Boolean).join(' ');

  const content = (
    <>
      <div className="premium-border-trail" aria-hidden="true" />
      <div className="premium-card-content">{children}</div>
    </>
  );

  if (onClick) {
    return (
      <motion.button 
        whileHover={{ scale: 1.02, y: -2 }}
        whileTap={{ scale: 0.98 }}
        className={classes} 
        onClick={onClick} 
        type="button" 
        {...rest}
      >
        {content}
      </motion.button>
    );
  }

  return (
    <motion.div whileHover={{ y: -2 }} className={classes} {...rest}>
      {content}
    </motion.div>
  );
}
