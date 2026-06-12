import { cn }         from '@/lib/utils';
import type { Task, TaskStatus } from '@/types';

// ---- Types ------------------------------------------------------------------

interface TimeBlocksTodayProps {
  tasks: Task[];
}

// ---- Styles -----------------------------------------------------------------

const STATUS_DOT: Record<TaskStatus, string> = {
  obligatorio:  'bg-red-400',
  importante:   'bg-yellow-400',
  prescindible: 'bg-green-400',
};

// ---- Component --------------------------------------------------------------

export function TimeBlocksToday({ tasks }: TimeBlocksTodayProps): JSX.Element {
  const blocked = tasks
    .filter((t) => t.startTime)
    .sort((a, b) => (a.startTime! > b.startTime! ? 1 : -1));

  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-2">
      <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Bloques de hoy
      </span>

      {blocked.length === 0 ? (
        <p className="py-2 text-xs text-muted-foreground/60">
          Sin bloques de tiempo. Asigna horario a una tarea desde el Horario.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {blocked.map((task) => (
            <li key={task.id} className="flex items-center gap-2.5 min-w-0">
              {/* Time */}
              <span className="shrink-0 font-mono text-[11px] text-muted-foreground w-10">
                {task.startTime}
              </span>

              {/* Dot */}
              <span className={cn('shrink-0 h-1.5 w-1.5 rounded-full', STATUS_DOT[task.status])} />

              {/* Title */}
              <span
                className={cn(
                  'truncate text-xs font-medium',
                  task.completed ? 'line-through text-muted-foreground/50' : '',
                )}
              >
                {task.title}
              </span>

              {/* End time */}
              {task.endTime && (
                <span className="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground/50">
                  →{task.endTime}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
