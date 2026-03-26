'use client';

import { useState, useCallback } from 'react';
import { encryptNote, decryptNote, type NoteData } from '@/lib/encryption';

const STORAGE_KEY = 'privacy-bridge-notes';

interface StoredNote {
  id: string;
  encrypted: string;
  createdAt: number;
}

interface NoteWithStatus extends NoteData {
  id: string;
  createdAt: number;
  spent?: boolean;
}

export function useNotes() {
  const [notes, setNotes] = useState<NoteWithStatus[]>([]);
  const [error, setError] = useState<string | null>(null);

  const getStoredNotes = useCallback((): StoredNote[] => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }, []);

  const saveNote = useCallback(
    async (note: NoteData, password: string) => {
      try {
        setError(null);
        const encrypted = await encryptNote(note, password);
        const stored: StoredNote = {
          id: crypto.randomUUID(),
          encrypted,
          createdAt: Date.now(),
        };

        const existing = getStoredNotes();
        existing.push(stored);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));

        return stored.id;
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to save note'
        );
        return null;
      }
    },
    [getStoredNotes]
  );

  const loadNotes = useCallback(
    async (password: string) => {
      try {
        setError(null);
        const stored = getStoredNotes();
        const decrypted: NoteWithStatus[] = [];

        for (const item of stored) {
          try {
            const note = await decryptNote(item.encrypted, password);
            decrypted.push({
              ...note,
              id: item.id,
              createdAt: item.createdAt,
            });
          } catch {
            // Wrong password or corrupted -- skip silently
          }
        }

        setNotes(decrypted);
        return decrypted;
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load notes'
        );
        return [];
      }
    },
    [getStoredNotes]
  );

  const deleteNote = useCallback(
    (id: string) => {
      const stored = getStoredNotes().filter((n) => n.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
      setNotes((prev) => prev.filter((n) => n.id !== id));
    },
    [getStoredNotes]
  );

  const checkNoteStatus = useCallback(
    async (note: NoteWithStatus): Promise<boolean> => {
      // Placeholder: in production, query the nullifier set on-chain
      // For now, return false (not spent)
      return false;
    },
    []
  );

  const exportAllEncrypted = useCallback((): string => {
    const stored = getStoredNotes();
    return JSON.stringify(stored, null, 2);
  }, [getStoredNotes]);

  const importEncrypted = useCallback((json: string) => {
    try {
      setError(null);
      const imported: StoredNote[] = JSON.parse(json);
      if (!Array.isArray(imported)) throw new Error('Invalid format');

      const existing = getStoredNotes();
      const existingIds = new Set(existing.map((n) => n.id));
      const newNotes = imported.filter((n) => !existingIds.has(n.id));

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify([...existing, ...newNotes])
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to import notes'
      );
    }
  }, [getStoredNotes]);

  return {
    notes,
    saveNote,
    loadNotes,
    deleteNote,
    checkNoteStatus,
    exportAllEncrypted,
    importEncrypted,
    error,
  };
}
