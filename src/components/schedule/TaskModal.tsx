import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';

import { Button }                                              from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input }                                               from '@/components/ui/input';
import { Label }                                               from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea }                                            from '@/components/ui/textarea';
import { Checkbox }                                            from '@/components/ui/checkbox';

import { todayISO } from '@/lib/dateUtils';
import { useTaskStore } from '@/stores/taskStore';
import type { Recurrence, Task, TaskScope, TaskStatus } from '@/types';

// ---- Props ---------------------------------------------------------------

interface TaskModalProps {
  open: boolean;
  onClose: () => void;
  task?: Task;
  defaultDate?: string;
  defaultStartTime?: string;
  defaultEndTime?: string;
}

// ---- Form state ----------------------------------------------------------

interface FormState {
  title: string;
  description: string;
  status: TaskStatus;
  scope: TaskScope;
  date: string;
  startTime: string;
  endTime: string;
  completed: boolean;
  recurrence: Recurrence | 'none';
}

function buildDefaultForm(
  task?: Task,
  defaultDate?: string,
  defaultStartTime?: string,
  defaultEndTime?: string,
): FormState {
  return {
    title:       task?.title       ?? '',
    description: task?.description ?? '',
    status:      task?.status      ?? 'importante',
    scope:       task?.scope       ?? 'day',
    date:        task?.date        ?? defaultDate      ?? todayISO(),
    startTime:   task?.startTime   ?? defaultStartTime ?? '',
    endTime:     task?.endTime     ?? defaultEndTime   ?? '',
    completed:   task?.completed   ?? false,
    recurrence:  task?.recurrence  ?? 'none',
  };
}

// ---- Component -----------------------------------------------------------

export function TaskModal({
  open,
  onClose,
  task,
  defaultDate,
  defaultStartTime,
  defaultEndTime,
}: TaskModalProps): JSX.Element {
  const { createTask, updateTask, deleteTask } = useTaskStore();
  const [form, setForm] = useState<FormState>(() =>
    buildDefaultForm(task, defaultDate, defaultStartTime, defaultEndTime),
  );
  const [submitting, setSubmitting] = useState(false);

  // Reset form whenever modal opens.
  useEffect(() => {
    if (open) {
      setForm(buildDefaultForm(task, defaultDate, defaultStartTime, defaultEndTime));
    }
  }, [open, task, defaultDate, defaultStartTime, defaultEndTime]);

  function field<K extends keyof FormState>(key: K) {
    return (value: FormState[K]) => setForm((prev) => ({ ...prev, [key]: value }));
  }

  const handleSubmit = async () => {
    if (!form.title.trim()) return;
    setSubmitting(true);
    try {
      if (task) {
        await updateTask(task.id, {
          title:       form.title,
          description: form.description || undefined,
          status:      form.status,
          scope:       form.scope,
          date:        form.date,
          startTime:   form.startTime || undefined,
          endTime:     form.endTime   || undefined,
          completed:   form.completed,
          recurrence:  form.recurrence,
        });
      } else {
        await createTask({
          title:       form.title,
          description: form.description || undefined,
          status:      form.status,
          scope:       form.scope,
          date:        form.date,
          startTime:   form.startTime || undefined,
          endTime:     form.endTime   || undefined,
          recurrence:  form.recurrence === 'none' ? undefined : form.recurrence,
        });
      }
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!task) return;
    setSubmitting(true);
    try {
      await deleteTask(task.id);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{task ? 'Editar tarea' : 'Nueva tarea'}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {/* Title */}
          <div className="grid gap-1.5">
            <Label htmlFor="task-title">Título *</Label>
            <Input
              id="task-title"
              value={form.title}
              onChange={(e) => field('title')(e.target.value)}
              placeholder="¿Qué hay que hacer?"
              onKeyDown={(e) => { if (e.key === 'Enter') void handleSubmit(); }}
              autoFocus
            />
          </div>

          {/* Status + Scope row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Prioridad</Label>
              <Select value={form.status} onValueChange={field('status')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="obligatorio">🔴 Obligatorio</SelectItem>
                  <SelectItem value="importante">🟡 Importante</SelectItem>
                  <SelectItem value="prescindible">🟢 Prescindible</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label>Alcance</Label>
              <Select value={form.scope} onValueChange={field('scope')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Día</SelectItem>
                  <SelectItem value="week">Semana</SelectItem>
                  <SelectItem value="month">Mes</SelectItem>
                  <SelectItem value="year">Año</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Date + Recurrence row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="task-date">Fecha</Label>
              <Input
                id="task-date"
                type="date"
                value={form.date}
                onChange={(e) => field('date')(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Repetir</Label>
              <Select
                value={form.recurrence}
                onValueChange={field('recurrence')}
                disabled={Boolean(task?.recurrenceParentId)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No se repite</SelectItem>
                  <SelectItem value="daily">Diario</SelectItem>
                  <SelectItem value="weekdays">Lun–Vie</SelectItem>
                  <SelectItem value="weekly">Semanal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Time range row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="task-start">Hora inicio</Label>
              <Input
                id="task-start"
                type="time"
                value={form.startTime}
                onChange={(e) => field('startTime')(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="task-end">Hora fin</Label>
              <Input
                id="task-end"
                type="time"
                value={form.endTime}
                onChange={(e) => field('endTime')(e.target.value)}
              />
            </div>
          </div>

          {/* Description */}
          <div className="grid gap-1.5">
            <Label htmlFor="task-desc">Descripción</Label>
            <Textarea
              id="task-desc"
              value={form.description}
              onChange={(e) => field('description')(e.target.value)}
              placeholder="Detalles opcionales…"
              rows={3}
              className="resize-none"
            />
          </div>

          {/* Completed — edit mode only */}
          {task && (
            <div className="flex items-center gap-2">
              <Checkbox
                id="task-done"
                checked={form.completed}
                onCheckedChange={(v) => field('completed')(Boolean(v))}
              />
              <Label htmlFor="task-done" className="cursor-pointer">
                Marcar como completada
              </Label>
            </div>
          )}
        </div>

        <DialogFooter className="flex-row items-center">
          {/* Delete — edit mode only */}
          {task && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => void handleDelete()}
              disabled={submitting}
              className="mr-auto"
              aria-label="Eliminar tarea"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}

          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            onClick={() => void handleSubmit()}
            disabled={submitting || !form.title.trim()}
          >
            {task ? 'Guardar' : 'Crear'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
