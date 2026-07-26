import { useState } from 'react';
import { motion } from 'framer-motion';
import { useSettings } from '../../contexts/SettingsContext';

const pageVariants = {
  initial: { opacity: 0, y: 10, filter: 'blur(4px)', scale: 0.99 },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)', scale: 1, transition: { duration: 0.3, ease: 'easeOut' } },
  exit: { opacity: 0, y: -10, filter: 'blur(4px)', scale: 0.99, transition: { duration: 0.2, ease: 'easeIn' } }
};

export function SettingsPage() {
  const { businessName, updateBusinessName } = useSettings();
  const [draftName, setDraftName] = useState(businessName);
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = draftName.trim();
    if (trimmed) {
      updateBusinessName(trimmed);
      setDraftName(trimmed);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    }
  };

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" className="page-container">
      <div className="premium-card" style={{ maxWidth: 600, margin: '0 auto', padding: '24px' }}>
        <div className="premium-border-trail" aria-hidden="true" />
        <h2 style={{ marginBottom: '24px', fontSize: '20px', fontWeight: 700 }}>Settings</h2>
        
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label htmlFor="business-name" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Business Name
            </label>
            <input
              id="business-name"
              type="text"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              maxLength={40}
              className="premium-input"
              style={{
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 12px',
                color: 'var(--text-primary)',
                fontSize: '14px',
                outline: 'none',
                width: '100%'
              }}
              placeholder="e.g. LastCoRE"
            />
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
            {isSaved && (
              <span style={{ fontSize: '12px', color: 'var(--green)', fontWeight: 600 }}>Saved!</span>
            )}
            <button
              type="submit"
              disabled={!draftName.trim() || draftName.trim() === businessName}
              className="toolbar-btn"
              style={{ 
                background: 'var(--cyan-dim)', 
                color: 'var(--cyan)', 
                borderColor: 'rgba(0, 229, 255, 0.4)',
                opacity: (!draftName.trim() || draftName.trim() === businessName) ? 0.5 : 1
              }}
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </motion.div>
  );
}
