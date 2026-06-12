import { create } from 'zustand';

import { notify }            from '@/lib/notifications';
import { useSettingsStore }  from '@/stores/settingsStore';

export type PomodoroPhase = 'work' | 'break' | 'longBreak';

export type PomodoroCmd =
  | { cmd: 'start' | 'pause' | 'reset' | 'skip' }
  | { cmd: 'config'; work?: number; shortBreak?: number; longBreak?: number; interval?: number };

interface PomodoroState {
  phase: PomodoroPhase;
  secondsLeft: number;
  sessionCount: number;
  running: boolean;
  tick: () => void;
  advance: () => void;
  start: () => void;
  pause: () => void;
  reset: () => void;
  skip: () => void;
  applyCmd: (cmd: PomodoroCmd) => void;
}

function getDuration(phase: PomodoroPhase): number {
  const s = useSettingsStore.getState().settings;
  if (phase === 'work')      return s.pomodoroWork * 60;
  if (phase === 'longBreak') return s.pomodoroLongBreak * 60;
  return s.pomodoroBreak * 60;
}

export const usePomodoroStore = create<PomodoroState>()((set, get) => ({
  phase:        'work',
  secondsLeft:  25 * 60,
  sessionCount: 0,
  running:      false,

  tick: () => {
    const { secondsLeft, running } = get();
    if (!running) return;
    if (secondsLeft > 1) {
      set({ secondsLeft: secondsLeft - 1 });
    } else {
      set({ secondsLeft: 0, running: false });
      get().advance();
    }
  },

  advance: () => {
    const s = useSettingsStore.getState().settings;
    const { phase, sessionCount } = get();

    let nextPhase: PomodoroPhase;
    let nextCount = sessionCount;

    if (phase === 'work') {
      nextCount += 1;
      const isLong = nextCount % s.pomodoroLongBreakInterval === 0;
      nextPhase = isLong ? 'longBreak' : 'break';
      void notify(
        '⏸ Sesión completada',
        isLong
          ? `Descanso largo: ${s.pomodoroLongBreak} min — te lo ganaste.`
          : `Descanso: ${s.pomodoroBreak} min.`,
      );
    } else {
      nextPhase = 'work';
      void notify('🍅 ¡A trabajar!', `Sesión ${nextCount + 1} · ${s.pomodoroWork} min.`);
    }

    set({
      phase:        nextPhase,
      sessionCount: nextCount,
      secondsLeft:  getDuration(nextPhase),
      running:      true,
    });
  },

  start: () => set({ running: true }),
  pause: () => set({ running: false }),

  reset: () => set({
    phase:        'work',
    secondsLeft:  getDuration('work'),
    sessionCount: 0,
    running:      false,
  }),

  skip: () => {
    set({ running: false, secondsLeft: 0 });
    get().advance();
  },

  applyCmd: (cmd) => {
    const { start, pause, reset, skip } = get();
    if (cmd.cmd === 'start')  { start(); return; }
    if (cmd.cmd === 'pause')  { pause(); return; }
    if (cmd.cmd === 'reset')  { reset(); return; }
    if (cmd.cmd === 'skip')   { skip();  return; }

    if (cmd.cmd === 'config') {
      const { updateSettings } = useSettingsStore.getState();
      const patch: Record<string, number> = {};
      if (cmd.work      != null) patch.pomodoroWork              = cmd.work;
      if (cmd.shortBreak != null) patch.pomodoroBreak            = cmd.shortBreak;
      if (cmd.longBreak  != null) patch.pomodoroLongBreak        = cmd.longBreak;
      if (cmd.interval   != null) patch.pomodoroLongBreakInterval = cmd.interval;
      if (Object.keys(patch).length > 0) {
        void updateSettings(patch);
        // Reset timer so next session uses new durations.
        reset();
      }
    }
  },
}));
