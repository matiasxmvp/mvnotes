import { create } from 'zustand';

import { invokeTyped } from '@/lib/tauri';
import type { Settings, UpdateSettingsInput } from '@/types';

// ---- Raw shape from Rust (shortcuts is a JSON string, not parsed object) -

interface RawSettings {
  autostart: boolean;
  openOnSecondaryMonitor: boolean;
  theme: 'light' | 'dark' | 'auto';
  shortcuts: string;
  micDeviceId: string;
  deepgramApiKey: string;
  groqApiKey: string;
  groqModel: string;
  pomodoroWork: number;
  pomodoroBreak: number;
  pomodoroLongBreak: number;
  pomodoroLongBreakInterval: number;
  scheduleStartHour: number;
  scheduleEndHour: number;
}

function parseShortcuts(json: string): Record<string, string> {
  try {
    return JSON.parse(json) as Record<string, string>;
  } catch {
    return DEFAULT_SETTINGS.shortcuts;
  }
}

function parseSettings(raw: RawSettings): Settings {
  return {
    ...raw,
    shortcuts: parseShortcuts(raw.shortcuts),
  };
}

// ---- State shape ---------------------------------------------------------

interface SettingsState {
  settings: Settings;
  isLoading: boolean;
  error: string | null;
  fetchSettings: () => Promise<void>;
  updateSettings: (patch: UpdateSettingsInput) => Promise<void>;
  clearError: () => void;
}

const DEFAULT_SETTINGS: Settings = {
  autostart: false,
  openOnSecondaryMonitor: true,
  theme: 'dark',
  shortcuts: { newTask: 'Ctrl+N' },
  micDeviceId: '',
  deepgramApiKey: '',
  groqApiKey: '',
  groqModel: 'llama-3.3-70b-versatile',
  pomodoroWork: 25,
  pomodoroBreak: 5,
  pomodoroLongBreak: 15,
  pomodoroLongBreakInterval: 4,
  scheduleStartHour: 7,
  scheduleEndHour:   22,
};

// ---- Store ---------------------------------------------------------------

export const useSettingsStore = create<SettingsState>()((set, get) => ({
  settings: DEFAULT_SETTINGS,
  isLoading: false,
  error: null,

  fetchSettings: async () => {
    set({ isLoading: true, error: null });
    try {
      const raw = await invokeTyped<RawSettings>('get_settings');
      set({ settings: parseSettings(raw), isLoading: false });
    } catch {
      // Fall back to defaults — app must never block on settings failure.
      set({ isLoading: false });
    }
  },

  updateSettings: async (patch) => {
    set({ isLoading: true, error: null });
    const previous = get().settings;

    // Optimistic update: parse shortcuts string if provided, keep rest.
    const optimistic: Settings = {
      autostart:               patch.autostart               ?? previous.autostart,
      openOnSecondaryMonitor:  patch.openOnSecondaryMonitor  ?? previous.openOnSecondaryMonitor,
      theme:                   patch.theme                   ?? previous.theme,
      shortcuts: patch.shortcuts
        ? parseShortcuts(patch.shortcuts)
        : previous.shortcuts,
      micDeviceId:    patch.micDeviceId    ?? previous.micDeviceId,
      deepgramApiKey: patch.deepgramApiKey ?? previous.deepgramApiKey,
      groqApiKey:     patch.groqApiKey     ?? previous.groqApiKey,
      groqModel:      patch.groqModel      ?? previous.groqModel,
      pomodoroWork:              patch.pomodoroWork              ?? previous.pomodoroWork,
      pomodoroBreak:             patch.pomodoroBreak             ?? previous.pomodoroBreak,
      pomodoroLongBreak:         patch.pomodoroLongBreak         ?? previous.pomodoroLongBreak,
      pomodoroLongBreakInterval: patch.pomodoroLongBreakInterval ?? previous.pomodoroLongBreakInterval,
      scheduleStartHour:         patch.scheduleStartHour         ?? previous.scheduleStartHour,
      scheduleEndHour:           patch.scheduleEndHour           ?? previous.scheduleEndHour,
    };
    set({ settings: optimistic });

    try {
      const raw = await invokeTyped<RawSettings>('update_settings', { patch });
      set({ settings: parseSettings(raw), isLoading: false });
    } catch (err) {
      // Roll back on failure.
      set({ settings: previous, error: String(err), isLoading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
