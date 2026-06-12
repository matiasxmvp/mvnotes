import { useState } from 'react';
import { ChevronDown, ChevronRight, MoveRight, Check } from 'lucide-react';

import { cn }         from '@/lib/utils';
import { todayISO }   from '@/lib/dateUtils';
import type { Task, TaskStatus } from '@/types';

// ---- Types ------------------------------------------------------------------

interface OverdueBannerProps {
  tasks: Task[];
  onMove:     (id: string) => void;
  onComplete: (id: string) => void;
}

// ---- Helpers ----------------------------------------------------------------

const STATUS_DOT: Record<TaskStatus, string> = {
  obligatorio:  'bg-red-400',
  importante:   'bg-yellow-400',
  prescindible: 'bg-green-400',
};

const STATUS_LABEL: Record<TaskStatus, string> = {
  obligatorio:  'Obligatorio',
  importante:   'Importante',
  prescindible: 'Prescindible',
};

function daysDiff(dateStr: string): number {
  const then  = new Date(`${dateStr}T00:00:00`);
  const today = new Date(`${todayISO()}T00:00:00`);
  return Math.round((today.getTime() - then.getTime()) / 86_400_000);
}

function overdueLabel(dateStr: string): string {
  const diff = daysDiff(dateStr);
  if (diff === 1) return 'ayer';
  if (diff === 2) return 'hace 2 días';
  return `hace ${diff} días`;
}

// ---- Component --------------------------------------------------------------

export function OverdueBanner({ tasks, onMove, onComplete }: OverdueBannerProps): JSX.Element | null {
  const [open, setOpen] = useState(true);

  if (tasks.length === 0) return null;

  return (
    <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left hover:bg-yellow-500/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {open
          ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-yellow-400" aria-hidden />
          : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-yellow-400" aria-hidden />}
        <span className="text-xs font-semibold text-yellow-400">
          {tasks.length} tarea{tasks.length !== 1 ? 's' : ''} atrasada{tasks.length !== 1 ? 's' : ''}
        </span>
        <span className="ml-auto text-[10px] text-muted-foreground">
          {open ? 'Contraer' : 'Ver'}
        </span>
      </button>

      {/* Task list */}
      {open && (
        <ul className="border-t border-yellow-500/10 divide-y divide-yellow-500/10">
          {tasks.map((task) => (
            <li
              key={task.id}
              className="flex items-center gap-3 px-4 py-2.5"
            >
              {/* Status dot */}
              <span className={cn('shrink-0 h-2 w-2 rounded-full', STATUS_DOT[task.status])} />

              {/* Info */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{task.title}</p>
                <p className="text-[11px] text-muted-foreground">
                  {overdueLabel(task.date)} · {STATUS_LABEL[task.status]}
                </p>
              </div>

              {/* ATRASADA badge */}
              <span className="shrink-0 rounded-md bg-yellow-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-yellow-400">
                Atrasada
              </span>

              {/* Actions */}
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => onMove(task.id)}
                  title="Mover a hoy"
                  className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  aria-label="Mover a hoy"
                >
                  <MoveRight className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onComplete(task.id)}
                  title="Marcar completada"
                  className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  aria-label="Marcar completada"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
