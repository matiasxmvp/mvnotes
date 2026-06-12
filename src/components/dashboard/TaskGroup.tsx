import { TaskItem } from './TaskItem';
import { cn }       from '@/lib/utils';
import type { Task, TaskStatus } from '@/types';

interface TaskGroupProps {
  status: TaskStatus;
  tasks: Task[];
  onToggle: (id: string, completed: boolean) => void;
  onEdit: (task: Task) => void;
}

const STATUS_CONFIG: Record<TaskStatus, {
  label: string;
  dotClass: string;
  countClass: string;
}> = {
  obligatorio:  { label: 'Obligatorio',  dotClass: 'bg-red-400',    countClass: 'text-red-400/70'    },
  importante:   { label: 'Importante',   dotClass: 'bg-yellow-400', countClass: 'text-yellow-400/70' },
  prescindible: { label: 'Prescindible', dotClass: 'bg-green-400',  countClass: 'text-green-400/70'  },
};

export function TaskGroup({ status, tasks, onToggle, onEdit }: TaskGroupProps): JSX.Element | null {
  if (tasks.length === 0) return null;

  const { label, dotClass, countClass } = STATUS_CONFIG[status];
  const sorted = [...tasks].sort((a, b) => Number(a.completed) - Number(b.completed));
  const pending = tasks.filter((t) => !t.completed).length;

  return (
    <section aria-label={label}>
      {/* Group header */}
      <div className="mb-2 flex items-center gap-2">
        <span className={cn('h-1.5 w-1.5 rounded-full', dotClass)} aria-hidden />
        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          {label}
        </h3>
        <span className={cn('ml-auto font-mono text-[11px] tabular-nums', countClass)}>
          {pending}/{tasks.length}
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        {sorted.map((task) => (
          <TaskItem key={task.id} task={task} onToggle={onToggle} onEdit={onEdit} />
        ))}
      </div>
    </section>
  );
}
