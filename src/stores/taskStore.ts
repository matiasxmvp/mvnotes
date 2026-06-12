import { create } from 'zustand';

import { invokeTyped } from '@/lib/tauri';
import { parseTask } from '@/types';
import type { CreateTaskInput, RawTask, Task, UpdateTaskInput } from '@/types';

// ---- State shape ---------------------------------------------------------

interface TaskState {
  tasks: Task[];
  isLoading: boolean;
  error: string | null;
  fetchTasks: (opts?: { date?: string; startDate?: string; endDate?: string }) => Promise<void>;
  createTask: (input: CreateTaskInput) => Promise<Task>;
  updateTask: (id: string, patch: UpdateTaskInput) => Promise<Task>;
  deleteTask: (id: string) => Promise<void>;
  clearError: () => void;
}

// ---- Store ---------------------------------------------------------------

export const useTaskStore = create<TaskState>()((set) => ({
  tasks: [],
  isLoading: false,
  error: null,

  fetchTasks: async ({ date, startDate, endDate } = {}) => {
    set({ isLoading: true, error: null });
    try {
      const raw = await invokeTyped<RawTask[]>('get_tasks', {
        date: date ?? null,
        startDate: startDate ?? null,
        endDate: endDate ?? null,
      });
      set({ tasks: raw.map(parseTask), isLoading: false });
    } catch (err) {
      set({ error: String(err), isLoading: false });
    }
  },

  createTask: async (input) => {
    set({ isLoading: true, error: null });
    try {
      const raw = await invokeTyped<RawTask>('create_task', { task: input });
      const task = parseTask(raw);
      set((s) => ({ tasks: [...s.tasks, task], isLoading: false }));
      return task;
    } catch (err) {
      set({ error: String(err), isLoading: false });
      throw err;
    }
  },

  updateTask: async (id, patch) => {
    set({ isLoading: true, error: null });
    try {
      const raw = await invokeTyped<RawTask>('update_task', { id, patch });
      const task = parseTask(raw);
      set((s) => ({
        tasks: s.tasks.map((t) => (t.id === id ? task : t)),
        isLoading: false,
      }));
      return task;
    } catch (err) {
      set({ error: String(err), isLoading: false });
      throw err;
    }
  },

  deleteTask: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await invokeTyped<void>('delete_task', { id });
      set((s) => ({
        tasks: s.tasks.filter((t) => t.id !== id),
        isLoading: false,
      }));
    } catch (err) {
      set({ error: String(err), isLoading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
