import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { EventCalendar } from '@mui/x-scheduler/event-calendar';
import type { SchedulerEvent, SchedulerResource } from '@mui/x-scheduler/models';
import { es } from 'date-fns/locale/es';
import { format } from 'date-fns';

import { useSettingsStore } from '@/stores/settingsStore';
import type { Task, UpdateTaskInput } from '@/types';

// ---- Resources (map task status → color lane) --------------------------------

const RESOURCES: SchedulerResource[] = [
  { id: 'obligatorio',  title: 'Obligatorio',  eventColor: 'red'   },
  { id: 'importante',   title: 'Importante',   eventColor: 'amber' },
  { id: 'prescindible', title: 'Prescindible', eventColor: 'green' },
];

// ---- Helpers -----------------------------------------------------------------

function padTime(hhmm: string): string {
  return `${hhmm}:00`;
}

function addOneHour(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  return `${String(((h ?? 0) + 1) % 24).padStart(2, '0')}:${String(m ?? 0).padStart(2, '0')}`;
}

// MUI SchedulerEvent uses ISO strings for start/end, field is "resource" not "resourceId".
// Tasks without startTime become all-day events so they still show on their day.
function taskToEvent(task: Task): SchedulerEvent {
  const base = `${task.date}T`;

  if (!task.startTime) {
    return {
      id: task.id,
      title: task.title,
      start: `${base}00:00:00`,
      end: `${base}23:59:59`,
      allDay: true,
      resource: task.status,
    };
  }

  const start = `${base}${padTime(task.startTime)}`;
  const end   = task.endTime
    ? `${base}${padTime(task.endTime)}`
    : `${base}${padTime(addOneHour(task.startTime))}`;
  return { id: task.id, title: task.title, start, end, resource: task.status };
}

// ---- Props -------------------------------------------------------------------

interface WeekCalendarProps {
  tasks: Task[];
  currentDate: Date;
  onNavigate: (date: Date) => void;
  onUpdateTask: (id: string, patch: UpdateTaskInput) => Promise<void>;
}

// ---- Component ---------------------------------------------------------------

export function WeekCalendar({
  tasks,
  currentDate,
  onNavigate,
  onUpdateTask,
}: WeekCalendarProps): JSX.Element {
  const { settings } = useSettingsStore();

  const events = useMemo<SchedulerEvent[]>(
    () => tasks.map(taskToEvent),
    [tasks],
  );

  // Track committed events for change detection (compare strings, not Dates).
  const committedRef = useRef<SchedulerEvent[]>(events);
  useEffect(() => { committedRef.current = events; }, [events]);

  const handleEventsChange = useCallback(
    (newEvents: SchedulerEvent[]) => {
      const prev = committedRef.current;

      for (const ne of newEvents) {
        const old = prev.find((oe) => oe.id === ne.id);
        if (!old) continue;

        const timeChanged  = ne.start !== old.start || ne.end !== old.end;
        const titleChanged = ne.title !== old.title;

        if (timeChanged || titleChanged) {
          const patch: UpdateTaskInput = {};
          if (timeChanged) {
            const startDate = new Date(String(ne.start));
            patch.date      = format(startDate, 'yyyy-MM-dd');
            // All-day events have no real hours — moving them only changes the date.
            if (!ne.allDay) {
              const endDate   = new Date(String(ne.end));
              patch.startTime = format(startDate, 'HH:mm');
              patch.endTime   = format(endDate,   'HH:mm');
            }
          }
          if (titleChanged) patch.title = ne.title;
          void onUpdateTask(String(ne.id), patch);
          break;
        }
      }
    },
    [onUpdateTask],
  );

  const handleVisibleDateChange = useCallback(
    (date: unknown) => {
      const d = date instanceof Date ? date : new Date(String(date));
      if (!isNaN(d.getTime())) onNavigate(d);
    },
    [onNavigate],
  );

  const wrapperRef = useRef<HTMLDivElement>(null);

  const startHour = settings.scheduleStartHour;
  const endHour   = settings.scheduleEndHour;

  // Show only [startHour, endHour] and fill the available container height.
  // MutationObserver re-applies on every view switch (MUI recreates the DOM subtree).
  // Early-exit check prevents infinite loop from attribute changes.
  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const applyHourStyles = () => {
      const container = wrapper.querySelector('.MuiEventCalendar-dayTimeGridContainer') as HTMLElement | null;
      const scrollable = wrapper.querySelector('.MuiEventCalendar-dayTimeGridScrollableContent') as HTMLElement | null;
      if (!container || !scrollable) return;

      const body = scrollable.parentElement as HTMLElement | null;
      const root = body?.parentElement as HTMLElement | null;
      if (!body || !root) return;

      const availableHeight = root.clientHeight;
      if (availableHeight === 0) return;

      // Pad top/bottom so hour labels (rendered on the hour line) have room
      // to display fully — otherwise the first/last label gets clipped by
      // body's overflow:hidden boundary.
      const LABEL_PAD = 10;
      const hourHeight = (availableHeight - LABEL_PAD * 2) / (endHour - startHour);
      const targetTransform = `translateY(-${startHour * hourHeight - LABEL_PAD}px)`;

      if (
        container.style.getPropertyValue('--hour-height') === `${hourHeight}px` &&
        scrollable.style.transform === targetTransform
      ) return;

      container.style.setProperty('--hour-height', `${hourHeight}px`);
      body.style.overflow = 'hidden';
      scrollable.style.transform = targetTransform;
    };

    applyHourStyles();

    // childList+subtree fires when MUI swaps the day/week DOM — no attributes watched,
    // so style writes above do NOT re-trigger this observer.
    const observer = new MutationObserver(applyHourStyles);
    observer.observe(wrapper, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, [startHour, endHour]);

  return (
    <div ref={wrapperRef} style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
      <EventCalendar
          events={events}
          resources={RESOURCES}
          visibleDate={currentDate}
          onVisibleDateChange={handleVisibleDateChange}
          onEventsChange={handleEventsChange}
          defaultView="week"
          defaultPreferences={{ isSidePanelOpen: false }}
          dateLocale={es}
          sx={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            // Header must sit above translateY'd content bleeding up from the grid.
            // Use our card background so day-name row fully covers the bleed.
            '& .MuiEventCalendar-dayTimeGridHeader': {
              position: 'relative',
              zIndex: 2,
              background: 'hsl(var(--card))',
            },
            // Hard-clip the body so hours outside [startHour, endHour] are invisible.
            '& .MuiEventCalendar-dayTimeGridBody': {
              overflow: 'hidden',
            },
          }}
        />
    </div>
  );
}
