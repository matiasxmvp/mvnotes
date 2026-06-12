import { useCallback, useEffect, useMemo, useState } from 'react';
import { addDays }   from 'date-fns';
import { Mic, Plus } from 'lucide-react';
import { motion }    from 'framer-motion';

import { listen } from '@tauri-apps/api/event';

import { DashboardHeader }  from '@/components/dashboard/DashboardHeader';
import { OverdueBanner }    from '@/components/dashboard/OverdueBanner';
import { PomodoroTimer }    from '@/components/dashboard/PomodoroTimer';
import { TaskGroup }        from '@/components/dashboard/TaskGroup';
import { TimeBlocksToday }  from '@/components/dashboard/TimeBlocksToday';
import { WeekImportant }    from '@/components/dashboard/WeekImportant';
import { QuickNotes }       from '@/components/dashboard/QuickNotes';
import { VoiceModal }       from '@/components/dashboard/VoiceModal';
import { TaskModal }        from '@/components/schedule/TaskModal';
import { ErrorBanner }      from '@/components/common/ErrorBanner';
import { Spinner }          from '@/components/common/Spinner';

import { formatDateISO, todayISO } from '@/lib/dateUtils';
import { subDays } from 'date-fns';
import { useNoteStore }            from '@/stores/noteStore';
import { useTaskStore }            from '@/stores/taskStore';
import type { Task, TaskStatus }   from '@/types';

// ---- Constants -----------------------------------------------------------

const STATUS_ORDER: TaskStatus[] = ['obligatorio', 'importante', 'prescindible'];

// ---- View ----------------------------------------------------------------

export default function DashboardView(): JSX.Element {
  const {
    tasks, isLoading, error, fetchTasks, updateTask,
  } = useTaskStore();
  const { notesByDate, fetchNote } = useNoteStore();

  // today and window are computed once — app is not expected to run past midnight.
  const today    = useMemo(() => todayISO(), []);
  const in7Days  = useMemo(() => formatDateISO(addDays(new Date(), 7)), []);
  const past30   = useMemo(() => formatDateISO(subDays(new Date(), 30)), []);

  const [modalOpen,    setModalOpen]    = useState(false);
  const [voiceOpen,    setVoiceOpen]    = useState(false);
  const [editingTask,  setEditingTask]  = useState<Task | undefined>();

  // ---- Data fetching -------------------------------------------------------

  useEffect(() => {
    void fetchTasks({ startDate: past30, endDate: in7Days });
  }, [past30, in7Days, fetchTasks]);

  // Refetch when another window (quick-capture) creates a task.
  useEffect(() => {
    let cancel: (() => void) | undefined;
    void listen('tasks-changed', () => {
      void fetchTasks({ startDate: past30, endDate: in7Days });
    }).then((unlisten) => {
      cancel = unlisten;
    });
    return () => cancel?.();
  }, [past30, in7Days, fetchTasks]);

  useEffect(() => {
    void fetchNote(today);
  }, [today, fetchNote]);

  // ---- Derived data --------------------------------------------------------

  // Overdue: past dates, not completed.
  const overdueTasks = useMemo(
    () => tasks.filter((t) => t.date < today && !t.completed),
    [tasks, today],
  );

  // Today's tasks split by status.
  const todayTasks = useMemo(
    () => tasks.filter((t) => t.date === today),
    [tasks, today],
  );

  // Next 7 days, obligatorio + importante only, for right column.
  const weekImportant = useMemo(
    () =>
      tasks.filter(
        (t) =>
          t.date > today &&
          t.date <= in7Days &&
          (t.status === 'obligatorio' || t.status === 'importante'),
      ),
    [tasks, today, in7Days],
  );

  const todayNote = notesByDate[today];

  // ---- Handlers ------------------------------------------------------------

  const handleToggle = useCallback(
    (id: string, completed: boolean) => void updateTask(id, { completed }),
    [updateTask],
  );

  const handleMoveToToday = useCallback(
    (id: string) => void updateTask(id, { date: today }),
    [updateTask, today],
  );

  const handleCompleteOverdue = useCallback(
    (id: string) => void updateTask(id, { completed: true }),
    [updateTask],
  );

  const openCreate = useCallback(() => {
    setEditingTask(undefined);
    setModalOpen(true);
  }, []);

  const openEdit = useCallback((task: Task) => {
    setEditingTask(task);
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditingTask(undefined);
  }, []);

  const closeVoice = useCallback(() => {
    setVoiceOpen(false);
    void fetchTasks({ startDate: past30, endDate: in7Days });
  }, [fetchTasks, past30, in7Days]);

  // Ctrl+N via window keydown (works when WebView is focused).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        openCreate();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [openCreate]);

  // ---- Render --------------------------------------------------------------

  const hasAnyTask = todayTasks.length > 0;

  return (
    <div className="relative flex h-full flex-col gap-5 p-5">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.15 }}
      >
        <DashboardHeader />
      </motion.div>

      {error && (
        <ErrorBanner message={error} className="shrink-0" />
      )}

      {/* Two-column body */}
      <div className="flex min-h-0 flex-1 gap-5">
        {/* LEFT — Today's tasks (60%) */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2, delay: 0.05 }}
          className="flex w-3/5 flex-col gap-5 overflow-y-auto pr-1"
        >
          <OverdueBanner
            tasks={overdueTasks}
            onMove={handleMoveToToday}
            onComplete={handleCompleteOverdue}
          />

          {isLoading && !hasAnyTask ? (
            <div className="flex items-center justify-center py-16">
              <Spinner size="lg" />
            </div>
          ) : !hasAnyTask ? (
            <EmptyTodayState onAdd={openCreate} />
          ) : (
            STATUS_ORDER.map((status) => (
              <TaskGroup
                key={status}
                status={status}
                tasks={todayTasks.filter((t) => t.status === status)}
                onToggle={handleToggle}
                onEdit={openEdit}
              />
            ))
          )}
        </motion.div>

        {/* RIGHT — Pomodoro + time blocks + week important (40%) */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2, delay: 0.1 }}
          className="w-2/5 flex flex-col gap-4 overflow-y-auto pl-4 border-l border-border"
        >
          <PomodoroTimer />
          <TimeBlocksToday tasks={todayTasks} />
          <WeekImportant tasks={weekImportant} />
        </motion.div>
      </div>

      {/* Bottom — Quick notes */}
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: 0.15 }}
      >
        {/* key={today} remounts on date change → resets local textarea state cleanly */}
        <QuickNotes
          key={today}
          date={today}
          initialContent={todayNote?.content ?? ''}
        />
      </motion.div>

      {/* Floating action buttons */}
      <div className="absolute bottom-6 right-6 flex flex-col items-center gap-2.5">
        {/* Voice button */}
        <motion.button
          type="button"
          onClick={() => setVoiceOpen(true)}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.2, delay: 0.15 }}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-secondary-foreground shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label="Crear tareas por voz"
        >
          <Mic className="h-4 w-4" aria-hidden />
        </motion.button>

        {/* New task button */}
        <motion.button
          type="button"
          onClick={openCreate}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.2, delay: 0.2 }}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label="Nueva tarea (Ctrl+N)"
        >
          <Plus className="h-6 w-6" aria-hidden />
        </motion.button>
      </div>

      {/* Create / edit modal */}
      <TaskModal
        open={modalOpen}
        onClose={closeModal}
        task={editingTask}
        defaultDate={today}
      />

      {/* Voice modal */}
      <VoiceModal open={voiceOpen} onClose={closeVoice} />
    </div>
  );
}

// ---- Empty state ---------------------------------------------------------

function EmptyTodayState({ onAdd }: { onAdd: () => void }): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <p className="text-base font-medium text-muted-foreground">
        Sin tareas para hoy
      </p>
      <p className="text-sm text-muted-foreground/70">
        Pulsa <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs">Ctrl+N</kbd> o el botón{' '}
        <span className="font-medium">+</span> para añadir la primera.
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="mt-2 rounded-lg bg-primary/10 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Nueva tarea
      </button>
    </div>
  );
}
