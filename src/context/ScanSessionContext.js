import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ScanSessionContext = createContext(null);
const SESSION_STORAGE_KEY = 'pro-scanner:in-progress-session';

let nextId = 1;
const generateId = () => `page-${Date.now()}-${nextId++}`;

export function ScanSessionProvider({ children }) {
  const [pages, setPages] = useState([]);
  // Set when the current session was opened via "Edit" on an already-saved
  // History entry (holds that entry's id) rather than a fresh scan - lets
  // PagesScreen know to overwrite that entry on "Done" instead of creating
  // a duplicate. Null for a normal new scan.
  const [sourceEntryId, setSourceEntryId] = useState(null);
  // Distinguishes "nothing persisted yet" from "we haven't checked storage
  // yet" - without this, a screen watching `pages` on first mount can't
  // tell an empty session apart from one that's still loading.
  const [restored, setRestored] = useState(false);
  const isFirstLoad = useRef(true);

  useEffect(() => {
    AsyncStorage.getItem(SESSION_STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          const saved = JSON.parse(raw);
          setPages(saved.pages || []);
          setSourceEntryId(saved.sourceEntryId ?? null);
        }
      })
      .catch((error) => console.error('Error restoring scan session:', error))
      .finally(() => setRestored(true));
  }, []);

  // Every page change (capture, corner-adjust, reorder, delete) is mirrored
  // to disk so a killed/backgrounded app can offer to resume instead of
  // silently losing photos the user already took. Skipped on the very first
  // render so the restore above isn't immediately clobbered by the initial
  // empty state.
  useEffect(() => {
    if (isFirstLoad.current) {
      isFirstLoad.current = false;
      return;
    }
    AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ pages, sourceEntryId })).catch((error) =>
      console.error('Error saving scan session:', error)
    );
  }, [pages, sourceEntryId]);

  const addPage = useCallback((uri) => {
    const id = generateId();
    setPages((prev) => [...prev, { id, uri, corners: null, processedUri: null }]);
    return id;
  }, []);

  const updatePage = useCallback((id, patch) => {
    setPages((prev) => prev.map((page) => (page.id === id ? { ...page, ...patch } : page)));
  }, []);

  const removePage = useCallback((id) => {
    setPages((prev) => prev.filter((page) => page.id !== id));
  }, []);

  const reorderPages = useCallback((fromIndex, toIndex) => {
    setPages((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, []);

  // Loads an existing History entry's already-processed page images into a
  // fresh editable session (add/reorder/delete pages, then rebuild). Marks
  // `sourceEntryId` so the eventual "Done" updates that entry in place.
  const loadPages = useCallback((uris, entryId) => {
    setPages(uris.map((uri) => ({ id: generateId(), uri, corners: null, processedUri: uri })));
    setSourceEntryId(entryId);
  }, []);

  const clearSession = useCallback(() => {
    setPages([]);
    setSourceEntryId(null);
    AsyncStorage.removeItem(SESSION_STORAGE_KEY).catch((error) =>
      console.error('Error clearing saved scan session:', error)
    );
  }, []);

  const value = useMemo(
    () => ({
      pages,
      sourceEntryId,
      restored,
      addPage,
      updatePage,
      removePage,
      reorderPages,
      loadPages,
      clearSession,
    }),
    [pages, sourceEntryId, restored, addPage, updatePage, removePage, reorderPages, loadPages, clearSession]
  );

  return <ScanSessionContext.Provider value={value}>{children}</ScanSessionContext.Provider>;
}

export function useScanSession() {
  const ctx = useContext(ScanSessionContext);
  if (!ctx) {
    throw new Error('useScanSession must be used within a ScanSessionProvider');
  }
  return ctx;
}
