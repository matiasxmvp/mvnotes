import { create } from 'zustand';

import { invokeTyped } from '@/lib/tauri';
import type { StudyNote, CreateStudyNoteInput, UpdateStudyNoteInput } from '@/types';

interface StudyNoteState {
  notes:     StudyNote[];
  search:    string;
  activeTag: string | null;
  isLoading: boolean;
  error:     string | null;
  fetchNotes:  (search?: string) => Promise<void>;
  createNote:  (input: CreateStudyNoteInput) => Promise<StudyNote>;
  updateNote:  (id: string, patch: UpdateStudyNoteInput) => Promise<void>;
  deleteNote:  (id: string) => Promise<void>;
  setSearch:   (search: string) => void;
  setActiveTag: (tag: string | null) => void;
  clearError:  () => void;
}

export const useStudyNoteStore = create<StudyNoteState>()((set, get) => ({
  notes:     [],
  search:    '',
  activeTag: null,
  isLoading: false,
  error:     null,

  fetchNotes: async (search) => {
    set({ isLoading: true, error: null });
    try {
      const s = search ?? get().search;
      const notes = await invokeTyped<StudyNote[]>('get_study_notes', { search: s });
      set({ notes, isLoading: false });
    } catch (err) {
      set({ error: String(err), isLoading: false });
    }
  },

  createNote: async (input) => {
    set({ isLoading: true, error: null });
    try {
      const note = await invokeTyped<StudyNote>('create_study_note', { input });
      set((s) => ({ notes: [note, ...s.notes], isLoading: false }));
      return note;
    } catch (err) {
      set({ error: String(err), isLoading: false });
      throw err;
    }
  },

  updateNote: async (id, patch) => {
    set({ error: null });
    try {
      const updated = await invokeTyped<StudyNote>('update_study_note', { id, patch });
      set((s) => ({
        notes: s.notes.map((n) => (n.id === id ? updated : n)),
      }));
    } catch (err) {
      set({ error: String(err) });
    }
  },

  deleteNote: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await invokeTyped<void>('delete_study_note', { id });
      set((s) => ({ notes: s.notes.filter((n) => n.id !== id), isLoading: false }));
    } catch (err) {
      set({ error: String(err), isLoading: false });
    }
  },

  setSearch:   (search) => set({ search }),
  setActiveTag: (tag) => set({ activeTag: tag }),
  clearError:  () => set({ error: null }),
}));
