import {
  format,
  isToday,
  isTomorrow,
  isYesterday,
  startOfWeek,
  endOfWeek,
  addWeeks,
} from 'date-fns';
import { es } from 'date-fns/locale';

export function formatDateFull(date: Date): string {
  return format(date, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es });
}

export function formatTime(date: Date): string {
  return format(date, 'HH:mm');
}

export function formatDateISO(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function todayISO(): string {
  return formatDateISO(new Date());
}

export function getGreeting(date: Date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return 'Buenos días';
  if (hour < 18) return 'Buenas tardes';
  return 'Buenas noches';
}

/** Human-readable label for a YYYY-MM-DD string (in local time). */
export function getDayLabel(dateStr: string): string {
  // Append T00:00:00 to force local timezone interpretation.
  const date = new Date(`${dateStr}T00:00:00`);
  if (isToday(date))     return 'Hoy';
  if (isTomorrow(date))  return 'Mañana';
  if (isYesterday(date)) return 'Ayer';
  return format(date, "EEEE d 'de' MMMM", { locale: es });
}

/** Returns [startISO, endISO] for the week containing `date` (Mon–Sun). */
export function weekRange(date: Date, offsetWeeks = 0): [string, string] {
  const base = addWeeks(date, offsetWeeks);
  const start = startOfWeek(base, { weekStartsOn: 1 });
  const end   = endOfWeek(base,   { weekStartsOn: 1 });
  return [formatDateISO(start), formatDateISO(end)];
}

/** Returns array of 7 Date objects for Mon–Sun of the week containing `date`. */
export function weekDays(date: Date, offsetWeeks = 0): Date[] {
  const [startISO] = weekRange(date, offsetWeeks);
  const start = new Date(`${startISO}T00:00:00`);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });
}
