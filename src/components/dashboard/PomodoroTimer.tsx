import { Pause, Play, RotateCcw, SkipForward } from 'lucide-react';

import { cn }                from '@/lib/utils';
import { useSettingsStore }  from '@/stores/settingsStore';
import { usePomodoroStore }  from '@/stores/pomodoroStore';
import type { PomodoroPhase } from '@/stores/pomodoroStore';

// ---- Styles -----------------------------------------------------------------

const PHASE_LABEL: Record<PomodoroPhase, string> = {
  work:      'Foco',
  break:     'Descanso',
  longBreak: 'Descanso largo',
};

const PHASE_COLOR: Record<PomodoroPhase, string> = {
  work:      'text-primary',
  break:     'text-green-400',
  longBreak: 'text-yellow-400',
};

const PHASE_RING: Record<PomodoroPhase, string> = {
  work:      'ring-primary/30',
  break:     'ring-green-500/30',
  longBreak: 'ring-yellow-500/30',
};

const DOT_ACTIVE: Record<PomodoroPhase, string> = {
  work:      'bg-primary',
  break:     'bg-green-400',
  longBreak: 'bg-yellow-400',
};

// ---- Component --------------------------------------------------------------

export function PomodoroTimer(): JSX.Element {
  const { settings }                                                      = useSettingsStore();
  const { phase, secondsLeft, sessionCount, running, start, pause, reset, skip } =
    usePomodoroStore();

  const interval = settings.pomodoroLongBreakInterval;
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');
  const posInCycle = sessionCount % interval;

  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Pomodoro
        </span>
        <span className={cn('text-xs font-medium', PHASE_COLOR[phase])}>
          {PHASE_LABEL[phase]}
        </span>
      </div>

      {/* Timer ring + countdown */}
      <div className="flex flex-col items-center gap-3 py-1">
        <div
          className={cn(
            'flex h-20 w-20 items-center justify-center rounded-full ring-4 transition-all duration-500',
            PHASE_RING[phase],
            running ? 'ring-opacity-100' : 'ring-opacity-40',
          )}
        >
          <span className={cn('font-mono text-2xl font-bold tabular-nums', PHASE_COLOR[phase])}>
            {mm}:{ss}
          </span>
        </div>

        {/* Session dots */}
        <div className="flex items-center gap-1.5" aria-label={`Sesión ${posInCycle + 1} de ${interval}`}>
          {Array.from({ length: interval }).map((_, i) => (
            <span
              key={i}
              className={cn(
                'h-1.5 w-1.5 rounded-full transition-colors',
                i < posInCycle
                  ? DOT_ACTIVE[phase]
                  : i === posInCycle && phase === 'work'
                    ? DOT_ACTIVE[phase] + ' opacity-50'
                    : 'bg-muted-foreground/20',
              )}
            />
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={reset}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Reiniciar pomodoro"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={running ? pause : start}
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            running
              ? 'bg-primary/15 text-primary hover:bg-primary/25'
              : 'bg-primary text-primary-foreground hover:bg-primary/90',
          )}
          aria-label={running ? 'Pausar' : 'Iniciar'}
        >
          {running
            ? <Pause className="h-4 w-4 fill-current" />
            : <Play  className="h-4 w-4 fill-current" />}
        </button>

        <button
          type="button"
          onClick={skip}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Saltar fase"
        >
          <SkipForward className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
