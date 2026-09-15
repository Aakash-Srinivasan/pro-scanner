import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

const STORAGE_KEY = 'pro-scanner:history';
const HISTORY_DIR = `${FileSystem.documentDirectory}history/`;

const HistoryContext = createContext(null);

async function ensureHistoryDir() {
  const info = await FileSystem.getInfoAsync(HISTORY_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(HISTORY_DIR, { intermediates: true });
  }
}

export function HistoryProvider({ children }) {
  const [history, setHistory] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setHistory(JSON.parse(raw));
      })
      .catch((error) => console.error('Error loading history:', error))
      .finally(() => setLoaded(true));
  }, []);

  const persist = useCallback(async (next) => {
    setHistory(next);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (error) {
      console.error('Error saving history:', error);
    }
  }, []);

  // Copies the PDF and every page thumbnail into a permanent app-local
  // folder (independent of wherever the user later saves/shares the PDF
  // to), so History keeps working even if that external copy is moved,
  // renamed, or deleted.
  const addEntry = useCallback(
    async ({ name, pdfUri, pageUris, createdAt }) => {
      await ensureHistoryDir();
      // Date.now() alone can collide when entries are created in a tight
      // loop (e.g. seeding sample data), so add a random suffix.
      const id = `scan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const entryDir = `${HISTORY_DIR}${id}/`;
      await FileSystem.makeDirectoryAsync(entryDir, { intermediates: true });

      const storedPdfUri = `${entryDir}document.pdf`;
      await FileSystem.copyAsync({ from: pdfUri, to: storedPdfUri });

      const storedPageUris = [];
      for (let i = 0; i < pageUris.length; i++) {
        const dest = `${entryDir}page-${i}.jpg`;
        await FileSystem.copyAsync({ from: pageUris[i], to: dest });
        storedPageUris.push(dest);
      }

      const entry = {
        id,
        name,
        createdAt: createdAt ?? Date.now(),
        pageCount: storedPageUris.length,
        pdfUri: storedPdfUri,
        pageUris: storedPageUris,
      };

      // Sorted by actual timestamp (not insertion order) so seeded/backdated
      // entries land in the right place, not just prepended.
      await persist([entry, ...history].sort((a, b) => b.createdAt - a.createdAt));
      return entry;
    },
    [history, persist]
  );

  // Overwrites an existing entry's PDF and page images in place (used when
  // the user edits an already-saved scan) rather than creating a second,
  // duplicate History entry for the same document.
  const updateEntry = useCallback(
    async (id, { pdfUri, pageUris, name }) => {
      const existing = history.find((item) => item.id === id);
      if (!existing) return null;

      const entryDir = `${HISTORY_DIR}${id}/`;
      await FileSystem.deleteAsync(entryDir, { idempotent: true }).catch(() => {});
      await FileSystem.makeDirectoryAsync(entryDir, { intermediates: true });

      const storedPdfUri = `${entryDir}document.pdf`;
      await FileSystem.copyAsync({ from: pdfUri, to: storedPdfUri });

      const storedPageUris = [];
      for (let i = 0; i < pageUris.length; i++) {
        const dest = `${entryDir}page-${i}.jpg`;
        await FileSystem.copyAsync({ from: pageUris[i], to: dest });
        storedPageUris.push(dest);
      }

      const updated = {
        ...existing,
        name: name || existing.name,
        pageCount: storedPageUris.length,
        pdfUri: storedPdfUri,
        pageUris: storedPageUris,
      };

      await persist(history.map((item) => (item.id === id ? updated : item)));
      return updated;
    },
    [history, persist]
  );

  const removeEntry = useCallback(
    async (id) => {
      const entry = history.find((item) => item.id === id);
      await persist(history.filter((item) => item.id !== id));
      if (entry) {
        const entryDir = `${HISTORY_DIR}${id}/`;
        FileSystem.deleteAsync(entryDir, { idempotent: true }).catch(() => {});
      }
    },
    [history, persist]
  );

  const value = useMemo(
    () => ({ history, loaded, addEntry, updateEntry, removeEntry }),
    [history, loaded, addEntry, updateEntry, removeEntry]
  );

  return <HistoryContext.Provider value={value}>{children}</HistoryContext.Provider>;
}

export function useHistory() {
  const ctx = useContext(HistoryContext);
  if (!ctx) {
    throw new Error('useHistory must be used within a HistoryProvider');
  }
  return ctx;
}
