import { create } from 'zustand';

import type { View } from '@/types';

interface NavState {
  activeView: View;
  pendingWhiteboardId: string | null;
  setView: (view: View) => void;
  openWhiteboard: (whiteboardId: string) => void;
  consumePendingWhiteboardId: () => string | null;
}

export const useNavStore = create<NavState>()((set, get) => ({
  activeView: 'dashboard',
  pendingWhiteboardId: null,

  setView: (view) => set({ activeView: view }),

  openWhiteboard: (whiteboardId) =>
    set({ activeView: 'whiteboard', pendingWhiteboardId: whiteboardId }),

  consumePendingWhiteboardId: () => {
    const id = get().pendingWhiteboardId;
    if (id) set({ pendingWhiteboardId: null });
    return id;
  },
}));
