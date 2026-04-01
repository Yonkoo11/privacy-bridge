'use client';

import { useState, useCallback } from 'react';
import { createPublicClient, http } from 'viem';
import { encryptNote, decryptNote, type NoteData } from '@/lib/encryption';
import { getBridgeAddress, PRIVACY_BRIDGE_ABI } from '@/lib/constants';
import { getChainConfig } from '@/lib/chains';

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
  confirmed?: boolean; // deposit confirmed on source chain
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

        // Check on-chain deposit status for each note (non-blocking)
        for (const note of decrypted) {
          checkNoteStatus(note).then(onChain => {
            setNotes(prev => prev.map(n =>
              n.id === note.id ? { ...n, confirmed: onChain } : n
            ));
          });
        }
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
      try {
        const chainId = note.sourceChainId ?? 545;
        const bridgeAddress = getBridgeAddress(chainId);
        const chainConfig = getChainConfig(chainId);
        if (!bridgeAddress || !chainConfig) return false;

        const client = createPublicClient({
          chain: chainConfig.chain,
          transport: http(chainConfig.chain.rpcUrls.default.http[0]),
        });

        const exists = await client.readContract({
          address: bridgeAddress,
          abi: PRIVACY_BRIDGE_ABI,
          functionName: 'commitmentExists',
          args: [BigInt(note.commitment)],
        });

        return !!exists;
      } catch {
        return false;
      }
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
