import { create } from 'zustand';

import { invokeTyped } from '@/lib/tauri';
import type { Whiteboard } from '@/types';

// ---- State shape ---------------------------------------------------------

interface WhiteboardState {
  whiteboards: Whiteboard[];
  active: Whiteboard | null;
  isLoading: boolean;
  error: string | null;
  fetchWhiteboards: () => Promise<void>;
  loadWhiteboard: (id: string) => Promise<void>;
  createWhiteboard: (name: string) => Promise<Whiteboard>;
  saveWhiteboard: (id: string, data: string, thumbnail?: string) => Promise<void>;
  renameWhiteboard: (id: string, name: string) => Promise<void>;
  setWhiteboardTask: (id: string, taskId: string | null) => Promise<void>;
  deleteWhiteboard: (id: string) => Promise<void>;
  clearError: () => void;
}

// ---- Store ---------------------------------------------------------------

export const useWhiteboardStore = create<WhiteboardState>()((set) => ({
  whiteboards: [],
  active: null,
  isLoading: false,
  error: null,

  fetchWhiteboards: async () => {
    set({ isLoading: true, error: null });
    try {
      const whiteboards = await invokeTyped<Whiteboard[]>('get_whiteboards');
      set({ whiteboards, isLoading: false });
    } catch (err) {
      set({ error: String(err), isLoading: false });
    }
  },

  loadWhiteboard: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const wb = await invokeTyped<Whiteboard | null>('get_whiteboard', { id });
      set({ active: wb, isLoading: false });
    } catch (err) {
      set({ error: String(err), isLoading: false });
    }
  },

  createWhiteboard: async (name) => {
    set({ isLoading: true, error: null });
    try {
      const wb = await invokeTyped<Whiteboard>('create_whiteboard', {
        input: { name },
      });
      set((s) => ({
        whiteboards: [wb, ...s.whiteboards],
        active: wb,
        isLoading: false,
      }));
      return wb;
    } catch (err) {
      set({ error: String(err), isLoading: false });
      throw err;
    }
  },

  // No isLoading toggle — autosave runs every 5s and must not cause rerenders.
  saveWhiteboard: async (id, data, thumbnail) => {
    try {
      const updated = await invokeTyped<Whiteboard>('update_whiteboard', {
        id,
        patch: { data, thumbnail: thumbnail ?? null },
      });
      set((s) => ({
        whiteboards: s.whiteboards.map((wb) => (wb.id === id ? updated : wb)),
        active: s.active?.id === id ? updated : s.active,
      }));
    } catch (err) {
      set({ error: String(err) });
    }
  },

  renameWhiteboard: async (id, name) => {
    set({ isLoading: true, error: null });
    try {
      const updated = await invokeTyped<Whiteboard>('update_whiteboard', {
        id,
        patch: { name },
      });
      set((s) => ({
        whiteboards: s.whiteboards.map((wb) => (wb.id === id ? updated : wb)),
        active: s.active?.id === id ? updated : s.active,
        isLoading: false,
      }));
    } catch (err) {
      set({ error: String(err), isLoading: false });
    }
  },

  setWhiteboardTask: async (id, taskId) => {
    try {
      const updated = await invokeTyped<Whiteboard>('set_whiteboard_task', {
        id,
        taskId,
      });
      set((s) => ({
        whiteboards: s.whiteboards.map((wb) => (wb.id === id ? updated : wb)),
        active: s.active?.id === id ? updated : s.active,
      }));
    } catch (err) {
      set({ error: String(err) });
    }
  },

  deleteWhiteboard: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await invokeTyped<void>('delete_whiteboard', { id });
      set((s) => {
        const whiteboards = s.whiteboards.filter((wb) => wb.id !== id);
        // If deleted board was active, fall through to the next most recent.
        const active =
          s.active?.id === id ? (whiteboards[0] ?? null) : s.active;
        return { whiteboards, active, isLoading: false };
      });
    } catch (err) {
      set({ error: String(err), isLoading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
