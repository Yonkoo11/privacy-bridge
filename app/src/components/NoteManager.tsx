'use client';

import { useState, useRef } from 'react';
import { useNotes } from '@/hooks/useNotes';

export default function NoteManager() {
  const {
    notes,
    loadNotes,
    deleteNote,
    exportAllEncrypted,
    importEncrypted,
    error,
  } = useNotes();

  const [password, setPassword] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUnlock = async () => {
    if (!password) return;
    await loadNotes(password);
    setUnlocked(true);
  };

  const handleExport = () => {
    const json = exportAllEncrypted();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `privacy-bridge-notes-backup-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      importEncrypted(ev.target?.result as string);
    };
    reader.readAsText(file);
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border-strong)' }}>
        <h2 className="text-base font-semibold mb-4 tracking-wide" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-heading)' }}>
          Note Manager
        </h2>

        <div className="stamp mb-6" style={{ transform: 'none', display: 'block' }}>
          Notes are encrypted with AES-256-GCM and stored in your browser.
          Export backups regularly. If you clear browser data, unbacked notes
          are lost forever.
        </div>

        {/* Password unlock */}
        {!unlocked && (
          <div className="space-y-3">
            <div>
              <label className="block text-[13px] mb-1" style={{ color: 'var(--text-body)' }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password to decrypt notes"
                className="w-full px-3 py-2.5 text-[13px] focus:outline-none"
                style={{
                  fontFamily: 'var(--font-mono)',
                  background: 'var(--bg)',
                  border: '1px solid var(--border-strong)',
                  color: 'var(--text-body)',
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
              />
            </div>
            <button
              onClick={handleUnlock}
              disabled={!password}
              className="cta-btn w-full text-center text-[13px]"
              style={!password ? {
                background: 'var(--surface-raised)',
                color: 'var(--text-label)',
                cursor: 'not-allowed',
              } : {}}
            >
              Unlock Notes
            </button>
          </div>
        )}

        {/* Notes list */}
        {unlocked && (
          <div className="space-y-4">
            {notes.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-[13px]" style={{ color: 'var(--text-label)' }}>No notes found</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-label)' }}>
                  Notes will appear here after you make a deposit
                </p>
              </div>
            ) : (
              <div className="space-y-0">
                {notes.map((note, i) => (
                  <div
                    key={note.id}
                    className="p-4"
                    style={{
                      background: 'var(--bg)',
                      border: '1px solid var(--border)',
                      borderTop: i > 0 ? 'none' : '1px solid var(--border)',
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 text-xs font-mono flex-1 min-w-0" style={{ color: 'var(--text-body)' }}>
                        <div>
                          <span style={{ color: 'var(--text-label)' }}>Amount: </span>
                          {(Number(note.amount) / 1e18).toFixed(4)} FLOW
                        </div>
                        <div className="break-all">
                          <span style={{ color: 'var(--text-label)' }}>Commitment: </span>
                          {note.commitment.slice(0, 20)}...
                        </div>
                        <div style={{ color: 'var(--text-label)' }}>
                          {new Date(note.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className="text-xs px-2 py-0.5"
                          style={{
                            fontFamily: 'var(--font-mono)',
                            background: note.spent ? 'var(--surface-raised)' : 'rgba(52,211,153,0.1)',
                            color: note.spent ? 'var(--text-label)' : '#34d399',
                            border: note.spent ? '1px solid var(--border)' : '1px solid rgba(52,211,153,0.3)',
                          }}
                        >
                          {note.spent ? 'Spent' : 'Active'}
                        </span>
                        <button
                          onClick={() => deleteNote(note.id)}
                          className="text-xs"
                          style={{ color: 'var(--text-label)' }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-px pt-2" style={{ background: 'var(--border)' }}>
              <button
                onClick={handleExport}
                className="flex-1 px-4 py-2.5 text-[13px]"
                style={{ fontFamily: 'var(--font-mono)', background: 'var(--surface)', color: 'var(--text-body)', border: 'none' }}
              >
                Export All
              </button>
              <button
                onClick={() => fileRef.current?.click()}
                className="flex-1 px-4 py-2.5 text-[13px]"
                style={{ fontFamily: 'var(--font-mono)', background: 'var(--surface)', color: 'var(--text-body)', border: 'none' }}
              >
                Import
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".json"
                onChange={handleImport}
                className="hidden"
              />
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 p-3" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)' }}>
            <p className="text-[13px]" style={{ color: '#f87171' }}>{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
