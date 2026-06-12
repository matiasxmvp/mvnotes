import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';

import { listen } from '@tauri-apps/api/event';

import { TaskModal }    from '@/components/schedule/TaskModal';
import { WeekCalendar } from '@/components/schedule/WeekCalendar';
import { ErrorBanner }  from '@/components/common/ErrorBanner';
import { Button }       from '@/components/ui/button';

import { weekRange }        from '@/lib/dateUtils';
import { useTaskStore }     from '@/stores/taskStore';
import type { Task, UpdateTaskInput } from '@/types';

// ---- View ----------------------------------------------------------------

export default function ScheduleView(): JSX.Element {
  const { tasks, error, fetchTasks, updateTask } = useTaskStore();
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [modalOpen,   setModalOpen]   = useState(false);
  const [activeTask,  setActiveTask]  = useState<Task | undefined>();

  useEffect(() => {
    const [start, end] = weekRange(currentDate);
    void fetchTasks({ startDate: start, endDate: end });
  }, [currentDate, fetchTasks]);

  // Refetch when another window (quick-capture) creates a task.
  useEffect(() => {
    let cancel: (() => void) | undefined;
    void listen('tasks-changed', () => {
      const [start, end] = weekRange(currentDate);
      void fetchTasks({ startDate: start, endDate: end });
    }).then((unlisten) => {
      cancel = unlisten;
    });
    return () => cancel?.();
  }, [currentDate, fetchTasks]);

  const handleUpdate = useCallback(
    async (id: string, patch: UpdateTaskInput) => {
      await updateTask(id, patch);
    },
    [updateTask],
  );

  const handleNavigate = useCallback((date: Date) => setCurrentDate(date), []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setActiveTask(undefined);
    const [start, end] = weekRange(currentDate);
    void fetchTasks({ startDate: start, endDate: end });
  }, [currentDate, fetchTasks]);

  return (
    <div className="flex h-full flex-col p-4 gap-2">
      {error && <ErrorBanner message={error} className="shrink-0" />}

      {/* Nueva tarea button — floats over calendar top-right */}
      <div className="flex shrink-0 justify-end">
        <Button
          size="sm"
          className="gap-2"
          onClick={() => { setActiveTask(undefined); setModalOpen(true); }}
        >
          <Plus className="h-4 w-4" aria-hidden />
          Nueva tarea
        </Button>
      </div>

      {/* Calendar — takes all remaining space */}
      <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-card">
        <WeekCalendar
          tasks={tasks}
          currentDate={currentDate}
          onNavigate={handleNavigate}
          onUpdateTask={handleUpdate}
        />
      </div>

      <TaskModal
        open={modalOpen}
        onClose={closeModal}
        task={activeTask}
      />
    </div>
  );
}
