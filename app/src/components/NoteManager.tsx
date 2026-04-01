'use client';

import { useState, useRef } from 'react';
import { useNotes } from '@/hooks/useNotes';
import { getChainConfig } from '@/lib/chains';

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
  const [showPassword, setShowPassword] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const passwordStrength = password.length === 0
    ? null
    : password.length < 8
      ? 'weak'
      : password.length < 16
        ? 'fair'
        : 'strong';

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
              <label className="block text-[15px] mb-1" style={{ color: 'var(--text-body)' }}>
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password to decrypt notes"
                  className="w-full px-3 py-2.5 pr-16 text-[15px] focus:outline-none"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    background: 'var(--bg)',
                    border: '1px solid var(--border-strong)',
                    color: 'var(--text-body)',
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[13px] px-2 py-1"
                  style={{ color: 'var(--text-label)', background: 'transparent' }}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              {passwordStrength && (
                <div className="flex items-center gap-2 mt-1.5">
                  <div className="flex gap-0.5 flex-1">
                    {['weak', 'fair', 'strong'].map((level, i) => (
                      <div
                        key={level}
                        className="h-0.5 flex-1"
                        style={{
                          background:
                            (passwordStrength === 'weak' && i === 0) ? '#f87171'
                            : (passwordStrength === 'fair' && i <= 1) ? '#fbbf24'
                            : (passwordStrength === 'strong') ? '#34d399'
                            : 'var(--border-strong)',
                        }}
                      />
                    ))}
                  </div>
                  <span className="text-[12px]" style={{
                    color: passwordStrength === 'weak' ? '#f87171' : passwordStrength === 'fair' ? '#fbbf24' : '#34d399',
                  }}>
                    {passwordStrength}
                  </span>
                </div>
              )}
            </div>
            <button
              onClick={handleUnlock}
              disabled={!password}
              className="cta-btn w-full text-center text-[15px]"
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
                <p className="text-[15px]" style={{ color: 'var(--text-label)' }}>No notes found</p>
                <p className="text-sm mt-1" style={{ color: 'var(--text-label)' }}>
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
                          {(Number(note.amount) / 1e18).toFixed(4)} {note.sourceChainId ? (getChainConfig(note.sourceChainId)?.chain.nativeCurrency.symbol ?? 'ETH') : 'FLOW'}
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
                            background: note.confirmed === undefined
                              ? 'var(--surface-raised)'
                              : note.confirmed
                                ? 'rgba(52,211,153,0.1)'
                                : 'rgba(251,191,36,0.1)',
                            color: note.confirmed === undefined
                              ? 'var(--text-label)'
                              : note.confirmed
                                ? '#34d399'
                                : '#fbbf24',
                            border: note.confirmed === undefined
                              ? '1px solid var(--border)'
                              : note.confirmed
                                ? '1px solid rgba(52,211,153,0.3)'
                                : '1px solid rgba(251,191,36,0.3)',
                          }}
                        >
                          {note.confirmed === undefined ? 'Checking...' : note.confirmed ? 'Confirmed' : 'Pending'}
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
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleExport}
                className="cta-btn flex-1 text-center text-[15px]"
                style={{ padding: '10px 16px' }}
              >
                Export Backup
              </button>
              <button
                onClick={() => fileRef.current?.click()}
                className="flex-1 px-4 py-2.5 text-[15px]"
                style={{
                  fontFamily: 'var(--font-mono)',
                  background: 'var(--surface-raised)',
                  color: 'var(--text-body)',
                  border: '1px solid var(--border-strong)',
                }}
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
            <p className="text-[15px]" style={{ color: '#f87171' }}>{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
