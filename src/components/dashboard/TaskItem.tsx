import { PenLine } from 'lucide-react';

import { Checkbox } from '@/components/ui/checkbox';
import { cn }       from '@/lib/utils';
import { useNavStore }        from '@/stores/navStore';
import { useWhiteboardStore } from '@/stores/whiteboardStore';
import type { Task, TaskStatus } from '@/types';

interface TaskItemProps {
  task: Task;
  onToggle: (id: string, completed: boolean) => void;
  onEdit: (task: Task) => void;
}

const STATUS: Record<TaskStatus, { border: string; check: string; dot: string }> = {
  obligatorio: {
    border: 'border-l-red-400/70',
    check:  'border-red-400/60 data-[state=checked]:bg-red-400 data-[state=checked]:border-red-400',
    dot:    'bg-red-400',
  },
  importante: {
    border: 'border-l-yellow-400/70',
    check:  'border-yellow-400/60 data-[state=checked]:bg-yellow-400 data-[state=checked]:border-yellow-400',
    dot:    'bg-yellow-400',
  },
  prescindible: {
    border: 'border-l-green-400/70',
    check:  'border-green-400/60 data-[state=checked]:bg-green-400 data-[state=checked]:border-green-400',
    dot:    'bg-green-400',
  },
};

export function TaskItem({ task, onToggle, onEdit }: TaskItemProps): JSX.Element {
  const s = STATUS[task.status];
  const linkedWb = useWhiteboardStore((st) =>
    st.whiteboards.find((wb) => wb.taskId === task.id),
  );
  const openWhiteboard = useNavStore((st) => st.openWhiteboard);

  return (
    <div
      className={cn(
        'group flex items-center gap-3 rounded-lg border-l-2 bg-card px-3 py-2.5',
        'transition-all duration-150',
        'hover:bg-accent/30 hover:shadow-sm',
        s.border,
        task.completed && 'opacity-40',
      )}
    >
      <Checkbox
        checked={task.completed}
        onCheckedChange={(v) => onToggle(task.id, Boolean(v))}
        onClick={(e) => e.stopPropagation()}
        className={cn('h-4 w-4 shrink-0 rounded-[4px]', s.check)}
        aria-label={`Marcar "${task.title}" como completada`}
      />

      <button
        type="button"
        onClick={() => onEdit(task)}
        className="flex flex-1 items-center justify-between gap-3 text-left focus-visible:outline-none"
      >
        <span
          className={cn(
            'flex-1 text-sm leading-snug',
            task.completed
              ? 'line-through text-muted-foreground'
              : 'font-medium text-foreground/90',
          )}
        >
          {task.title}
        </span>

        {task.startTime && (
          <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground/70">
            {task.startTime}
            {task.endTime && <span className="opacity-50">–{task.endTime}</span>}
          </span>
        )}
      </button>

      {linkedWb && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            openWhiteboard(linkedWb.id);
          }}
          className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Abrir pizarra "${linkedWb.name}"`}
          title={linkedWb.name}
        >
          <PenLine className="h-3.5 w-3.5" aria-hidden />
        </button>
      )}
    </div>
  );
}
