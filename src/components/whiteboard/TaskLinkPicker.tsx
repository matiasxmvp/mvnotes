import { useEffect } from 'react';
import { Check, ChevronDown, Link2, Link2Off } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn }              from '@/lib/utils';
import { useTaskStore }    from '@/stores/taskStore';
import type { Task }       from '@/types';

interface TaskLinkPickerProps {
  taskId: string | null;
  disabled?: boolean;
  onChange: (taskId: string | null) => void;
}

export function TaskLinkPicker({
  taskId,
  disabled,
  onChange,
}: TaskLinkPickerProps): JSX.Element {
  const { tasks, fetchTasks } = useTaskStore();

  // Fetch all tasks once when picker mounts.
  useEffect(() => {
    if (tasks.length === 0) void fetchTasks();
  }, [tasks.length, fetchTasks]);

  const linked: Task | undefined = tasks.find((t) => t.id === taskId);
  const label = linked?.title ?? 'Sin tarea';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2" disabled={disabled}>
          {linked ? (
            <Link2 className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
          ) : (
            <Link2Off className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
          )}
          <span className="max-w-[180px] truncate text-xs">{label}</span>
          <ChevronDown className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="z-[9999] w-72 max-h-[60vh]">
        <DropdownMenuItem
          onClick={() => onChange(null)}
          className="gap-2 text-muted-foreground"
        >
          <Link2Off className="h-4 w-4 shrink-0" aria-hidden />
          Sin vincular
        </DropdownMenuItem>

        {tasks.length > 0 && <DropdownMenuSeparator />}

        {tasks.length === 0 && (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">
            No hay tareas
          </div>
        )}

        {tasks.map((t) => (
          <DropdownMenuItem
            key={t.id}
            onClick={() => onChange(t.id)}
            className="gap-2"
          >
            <Check
              className={cn(
                'h-4 w-4 shrink-0',
                t.id === taskId ? 'opacity-100' : 'opacity-0',
              )}
              aria-hidden
            />
            <span className="truncate">{t.title}</span>
            <span className="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground/70">
              {t.date}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
