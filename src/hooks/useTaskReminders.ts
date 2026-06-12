import { useEffect, useRef } from 'react';

import { notify }        from '@/lib/notifications';
import { invokeTyped }   from '@/lib/tauri';
import { todayISO }      from '@/lib/dateUtils';
import { parseTask }     from '@/types';
import type { RawTask }  from '@/types';

const CHECK_INTERVAL_MS  = 60_000; // every minute
const END_OF_DAY_HOUR    = 22;
const LATE_NOTIFY_WINDOW = 5;     // fire if up to 5 min past startTime

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m ?? 0);
}

/**
 * Runs permanently (mount in App.tsx).
 * Fetches today's tasks every minute and fires notifications:
 *   1. startTime reminder — within 5-min window of task start (handles late ticks)
 *   2. End-of-day — at 22:00, obligatorio tasks still incomplete
 */
export function useTaskReminders(): void {
  // IDs already notified today — reset on date change via todayISO()
  const notifiedTodayRef  = useRef<Set<string>>(new Set());
  const endOfDayDateRef   = useRef<string>('');  // date string when fired
  const lastDateRef       = useRef<string>('');

  useEffect(() => {
    const tick = async () => {
      const today = todayISO();

      // Reset per-day state when the calendar day rolls over
      if (lastDateRef.current !== today) {
        lastDateRef.current = today;
        notifiedTodayRef.current = new Set();
      }

      const now    = new Date();
      const nowMin = now.getHours() * 60 + now.getMinutes();
      const hour   = now.getHours();
      const minute = now.getMinutes();

      // Fetch today's tasks — self-contained, no store dependency
      let tasks;
      try {
        const raw = await invokeTyped<RawTask[]>('get_tasks', {
          date: today,
          startDate: null,
          endDate: null,
        });
        tasks = raw.map(parseTask);
      } catch {
        return; // DB not ready (app just started), skip this tick
      }

      const pending = tasks.filter((t) => !t.completed);

      // ── 1. Start-time reminders ─────────────────────────────────────
      // Fire if task startTime is within the last LATE_NOTIFY_WINDOW minutes
      // (catches ticks that fired slightly late or tasks created mid-minute).
      for (const task of pending) {
        if (!task.startTime || notifiedTodayRef.current.has(task.id)) continue;
        const taskMin = toMinutes(task.startTime);
        if (taskMin <= nowMin && taskMin > nowMin - LATE_NOTIFY_WINDOW) {
          notifiedTodayRef.current.add(task.id);
          await notify(
            `⏰ ${task.title}`,
            `Comienza a las ${task.startTime}`,
          );
        }
      }

      // ── 2. End-of-day obligatorio check ─────────────────────────────
      const shouldFireEOD =
        hour === END_OF_DAY_HOUR &&
        minute === 0 &&
        endOfDayDateRef.current !== today;

      if (shouldFireEOD) {
        const uncompleted = pending.filter((t) => t.status === 'obligatorio');
        if (uncompleted.length > 0) {
          endOfDayDateRef.current = today;
          const lines = uncompleted
            .slice(0, 4)
            .map((t) => `• ${t.title}`)
            .join('\n');
          const extra =
            uncompleted.length > 4
              ? `\n+${uncompleted.length - 4} más`
              : '';
          await notify(
            `🔴 ${uncompleted.length} obligatoria${uncompleted.length !== 1 ? 's' : ''} sin completar`,
            lines + extra,
          );
        }
      }
    };

    void tick(); // run immediately on mount
    const id = setInterval(() => void tick(), CHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, []); // intentionally empty — hook is self-contained
}
