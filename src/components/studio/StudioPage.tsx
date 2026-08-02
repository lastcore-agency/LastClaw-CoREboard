import { useEffect, useState, useCallback } from 'react';

interface FileEntry { name: string; type: string; path: string; size?: number; modified?: string; }
interface FileContent { name: string; path: string; content: string; size: number; }

const API = '/api/runtime';
const AGENTS = ['main', 'draco', 'polaris', 'antares', 'altair', 'capella'];

export function StudioPage() {
  const [agent, setAgent] = useState('main');
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileContent | null>(null);
  const [error, setError] = useState('');

  const loadFiles = useCallback(async () => {
    setError('');
    setSelectedFile(null);
    try {
      const r = await fetch(`${API}/workspace/${agent}/files`);
      const d = await r.json();
      if (d.error) setError(d.error);
      else setFiles(d.data || []);
    } catch (e: any) { setError(e.message); }
  }, [agent]);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  async function openFile(filePath: string) {
    setError('');
    try {
      const r = await fetch(`${API}/workspace/${agent}/file?path=${encodeURIComponent(filePath)}`);
      const d = await r.json();
      if (d.error) setError(d.error);
      else setSelectedFile(d.data);
    } catch (e: any) { setError(e.message); }
  }

  return (
    <div style={{ display: 'flex', height: '100%', padding: 12, gap: 12 }}>
      <div style={{ width: 220, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <select value={agent} onChange={e => setAgent(e.target.value)}
          style={{ background: '#1a1a2e', color: '#e0e0ff', border: '1px solid #333', borderRadius: 6, padding: 8 }}>
          {AGENTS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {files.map(f => (
            <div key={f.path} onClick={() => f.type === 'file' && openFile(f.path)}
              style={{
                padding: '6px 10px', borderRadius: 4, cursor: f.type === 'file' ? 'pointer' : 'default',
                background: selectedFile?.path === f.path ? '#0a3d62' : 'transparent',
                color: f.type === 'directory' ? '#4a9eff' : '#e0e0ff', fontSize: 13,
              }}>
              {f.type === 'directory' ? '📁 ' : '📄 '}{f.name}
            </div>
          ))}
        </div>
        {error && <div style={{ color: '#ff6b6b', fontSize: 12 }}>{error}</div>}
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {selectedFile ? (
          <>
            <div style={{ color: '#4a9eff', fontSize: 13, padding: '4px 0', borderBottom: '1px solid #333', marginBottom: 8 }}>
              {selectedFile.path} ({selectedFile.size} bytes)
            </div>
            <pre style={{
              flex: 1, overflow: 'auto', margin: 0, padding: 12, borderRadius: 6,
              background: '#0d0d1a', color: '#c8c8e0', fontSize: 13, lineHeight: 1.5,
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>{selectedFile.content}</pre>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555' }}>
            Select a file to view
          </div>
        )}
      </div>
    </div>
  );
}
