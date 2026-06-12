import { cn }           from '@/lib/utils';
import { getDayLabel }  from '@/lib/dateUtils';
import type { Task, TaskStatus } from '@/types';

interface WeekImportantProps {
  tasks: Task[];
}

const DOT: Record<TaskStatus, string> = {
  obligatorio:  'bg-red-400',
  importante:   'bg-yellow-400',
  prescindible: 'bg-green-400',
};

const ROW_BG: Record<TaskStatus, string> = {
  obligatorio:  'bg-red-500/10',
  importante:   'bg-yellow-500/10',
  prescindible: 'bg-green-500/10',
};

export function WeekImportant({ tasks }: WeekImportantProps): JSX.Element {
  // Group by date, preserving date-sort order.
  const dateMap = new Map<string, Task[]>();
  for (const task of tasks) {
    const arr = dateMap.get(task.date) ?? [];
    arr.push(task);
    dateMap.set(task.date, arr);
  }
  const sortedDates = [...dateMap.keys()].sort();

  return (
    <div className="flex flex-col gap-1">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Importantes esta semana
      </h2>

      {sortedDates.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">
          Sin tareas importantes próximas.
        </p>
      ) : (
        sortedDates.map((date) => (
          <DayBlock key={date} date={date} tasks={dateMap.get(date)!} />
        ))
      )}
    </div>
  );
}

function DayBlock({ date, tasks }: { date: string; tasks: Task[] }): JSX.Element {
  return (
    <div className="mb-3">
      <p className="mb-1.5 text-xs font-medium capitalize text-muted-foreground">
        {getDayLabel(date)}
      </p>
      <div className="flex flex-col gap-1">
        {tasks.map((task) => (
          <TaskPill key={task.id} task={task} />
        ))}
      </div>
    </div>
  );
}

function TaskPill({ task }: { task: Task }): JSX.Element {
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-lg px-3 py-2',
        ROW_BG[task.status],
        task.completed && 'opacity-40',
      )}
    >
      <span
        className={cn('h-1.5 w-1.5 shrink-0 rounded-full', DOT[task.status])}
        aria-hidden
      />
      <span
        className={cn(
          'flex-1 truncate text-xs',
          task.completed && 'line-through text-muted-foreground',
        )}
      >
        {task.title}
      </span>
      {task.startTime && (
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {task.startTime}
        </span>
      )}
    </div>
  );
}
