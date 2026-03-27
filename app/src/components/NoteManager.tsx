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
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-gray-100 mb-4">
          Note Manager
        </h2>

        <div className="bg-amber-900/20 border border-amber-700/50 rounded-lg p-4 mb-6">
          <p className="text-amber-400 text-sm">
            Notes are encrypted with AES-256-GCM and stored in your browser.
            Export backups regularly. If you clear browser data, unbackedup notes
            are lost forever.
          </p>
        </div>

        {/* Password unlock */}
        {!unlocked && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password to decrypt notes"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-300 placeholder:text-gray-400 focus:outline-none focus:border-gray-600"
                onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
              />
            </div>
            <button
              onClick={handleUnlock}
              disabled={!password}
              className="w-full px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-400 text-white text-sm font-medium rounded-lg"
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
                <p className="text-gray-400 text-sm">No notes found</p>
                <p className="text-gray-400 text-xs mt-1">
                  Notes will appear here after you make a deposit
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {notes.map((note) => (
                  <div
                    key={note.id}
                    className="bg-gray-800 border border-gray-700 rounded-lg p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 text-xs font-mono text-gray-400 flex-1 min-w-0">
                        <div>
                          <span className="text-gray-400">Amount: </span>
                          {(Number(note.amount) / 1e18).toFixed(4)} FLOW
                        </div>
                        <div className="break-all">
                          <span className="text-gray-400">Commitment: </span>
                          {note.commitment.slice(0, 20)}...
                        </div>
                        <div className="text-gray-400">
                          {new Date(note.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${
                            note.spent
                              ? 'bg-gray-700 text-gray-400'
                              : 'bg-emerald-900/30 text-emerald-400'
                          }`}
                        >
                          {note.spent ? 'Spent' : 'Active'}
                        </span>
                        <button
                          onClick={() => deleteNote(note.id)}
                          className="text-gray-400 hover:text-red-400 text-xs"
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
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleExport}
                className="flex-1 px-4 py-2.5 bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg hover:bg-gray-700"
              >
                Export All
              </button>
              <button
                onClick={() => fileRef.current?.click()}
                className="flex-1 px-4 py-2.5 bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg hover:bg-gray-700"
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
          <div className="mt-4 bg-red-900/20 border border-red-700/50 rounded-lg p-3">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
