import { create } from 'zustand';

import { invokeTyped } from '@/lib/tauri';
import type { Note } from '@/types';

// ---- State shape ---------------------------------------------------------

interface NoteState {
  notesByDate: Record<string, Note>;
  savingDates: Set<string>;
  error: string | null;
  fetchNote: (date: string) => Promise<void>;
  upsertNote: (date: string, content: string) => Promise<void>;
  clearError: () => void;
}

// ---- Store ---------------------------------------------------------------

export const useNoteStore = create<NoteState>()((set) => ({
  notesByDate: {},
  savingDates: new Set(),
  error: null,

  fetchNote: async (date) => {
    try {
      const note = await invokeTyped<Note | null>('get_note', { date });
      if (note) {
        set((s) => ({
          notesByDate: { ...s.notesByDate, [date]: note },
        }));
      }
    } catch (err) {
      set({ error: String(err) });
    }
  },

  upsertNote: async (date, content) => {
    // Optimistic: update content immediately so the textarea never lags.
    set((s) => {
      const existing = s.notesByDate[date];
      const optimistic: Note = {
        id: existing?.id ?? 'pending',
        content,
        date,
        updatedAt: new Date().toISOString(),
      };
      const savingDates = new Set(s.savingDates).add(date);
      return {
        notesByDate: { ...s.notesByDate, [date]: optimistic },
        savingDates,
      };
    });

    try {
      const note = await invokeTyped<Note>('upsert_note', { date, content });
      set((s) => {
        const savingDates = new Set(s.savingDates);
        savingDates.delete(date);
        return {
          notesByDate: { ...s.notesByDate, [date]: note },
          savingDates,
          error: null,
        };
      });
    } catch (err) {
      set((s) => {
        const savingDates = new Set(s.savingDates);
        savingDates.delete(date);
        return { savingDates, error: String(err) };
      });
    }
  },

  clearError: () => set({ error: null }),
}));
