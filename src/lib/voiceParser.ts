import { addDays, format } from 'date-fns';
import type { Recurrence, TaskScope, TaskStatus } from '@/types';

// ---- Lookup tables -------------------------------------------------------

type DayNum = 0 | 1 | 2 | 3 | 4 | 5 | 6;

const WEEKDAYS: Record<string, DayNum> = {
  domingo: 0, lunes: 1, martes: 2,
  miercoles: 3, miércoles: 3, jueves: 4,
  viernes: 5, sabado: 6, sábado: 6,
};

const MONTHS: Record<string, number> = {
  enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
  julio: 6, agosto: 7, septiembre: 8, setiembre: 8, octubre: 9,
  noviembre: 10, diciembre: 11,
};

// ---- Helpers -------------------------------------------------------------

function nextWeekday(target: DayNum): Date {
  const today = new Date();
  const diff = (target - (today.getDay() as DayNum) + 7) % 7;
  return addDays(today, diff === 0 ? 7 : diff); // same day → next week
}

function todayISO(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

// ---- Extractors (each consumes its pattern and returns remaining text) ---

function extractDate(text: string): { date: string; remaining: string } {
  let date = todayISO();
  let rem  = text;

  const try_ = (pattern: RegExp, fn: (m: RegExpMatchArray) => Date | null) => {
    const m = rem.match(pattern);
    if (!m) return false;
    const d = fn(m);
    if (!d) return false;
    date = format(d, 'yyyy-MM-dd');
    rem  = rem.replace(m[0], ' ');
    return true;
  };

  try_(/pasado\s+ma[ñn]ana/i, () => addDays(new Date(), 2))
  || try_(/ma[ñn]ana/i,       () => addDays(new Date(), 1))
  || try_(/\bhoy\b/i,         () => new Date())
  || try_(/en\s+(\d+)\s+d[íi]as?/i, (m) => addDays(new Date(), parseInt(m[1])))
  || (() => {
       // "el (próximo) [weekday]"
       for (const [name, dayNum] of Object.entries(WEEKDAYS)) {
         const re = new RegExp(`el\\s+(?:pr[oó]ximo\\s+)?${name}`, 'i');
         if (try_(re, () => nextWeekday(dayNum as DayNum))) return;
       }
       // "el [N] de [month]"
       try_(/el\s+(\d{1,2})\s+de\s+([a-záéíóú]+)/i, (m) => {
         const monthIdx = MONTHS[m[2].toLowerCase()];
         if (monthIdx === undefined) return null;
         const d = new Date();
         d.setMonth(monthIdx, parseInt(m[1]));
         if (d < new Date()) d.setFullYear(d.getFullYear() + 1);
         return d;
       });
     })();

  return { date, remaining: rem.trim() };
}

function extractTime(text: string): { startTime?: string; remaining: string } {
  const m = text.match(
    /a\s+las\s+(\d{1,2})(?::(\d{2}))?\s*(?:de\s+la\s+(ma[ñn]ana|tarde|noche))?/i,
  );
  if (!m) return { startTime: undefined, remaining: text };

  let hours   = parseInt(m[1]);
  const mins  = parseInt(m[2] ?? '0');
  const period = m[3]?.toLowerCase() ?? '';

  if (period === 'tarde' || period === 'noche') {
    if (hours < 12) hours += 12;
  } else if (hours < 7) {
    hours += 12; // ambiguous small hour → assume afternoon
  }

  const startTime = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  return { startTime, remaining: text.replace(m[0], ' ').trim() };
}

function extractStatus(text: string): { status: TaskStatus; remaining: string } {
  const OBLIGATORIO = /\b(obligatori[oa]|urgent[ea]|prioritari[oa]|esencial|cr[ií]tic[oa]|primero|lo primero)\b/i;
  const PRESCINDIBLE = /\b(prescindible|puede\s+esperar|cuando\s+pueda|si\s+hay\s+tiempo|opcional|no\s+urgente|sin\s+prisa)\b/i;

  if (OBLIGATORIO.test(text)) {
    return { status: 'obligatorio', remaining: text.replace(OBLIGATORIO, ' ').trim() };
  }
  if (PRESCINDIBLE.test(text)) {
    return { status: 'prescindible', remaining: text.replace(PRESCINDIBLE, ' ').trim() };
  }
  return { status: 'importante', remaining: text };
}

const FILLER = /\b(tengo\s+que|hay\s+que|necesito|necesitas|quiero|quieres|hacer|hacerme|hacerle|crea(?:r)?|añade?|agrega?|pon(?:me)?|recuerda(?:me)?|después|bueno|o\s+sea|entonces|pues|una\s+tarea\s+para|tarea\s+para|para\s+(?=\w))\b/gi;

function cleanTitle(raw: string): string {
  return raw
    .replace(FILLER, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s,;.]+|[\s,;.]+$/g, '')
    .trim();
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function splitSegments(input: string): string[] {
  return input
    .split(/[,;]\s*(?:y\s+)?|\s+y\s+adem[aá]s\s+|\s+tambi[eé]n\s+/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 2);
}

// ---- Public API ----------------------------------------------------------

export interface ParsedTask {
  title: string;
  description?: string;
  date: string;
  startTime?: string;
  endTime?: string;
  status: TaskStatus;
  scope: TaskScope;
  recurrence?: Recurrence;
}

export function parseVoiceInput(raw: string): ParsedTask[] {
  return splitSegments(raw)
    .map((segment) => {
      const text = segment.toLowerCase();

      const { date,      remaining: r1 } = extractDate(text);
      const { startTime, remaining: r2 } = extractTime(r1);
      const { status,    remaining: r3 } = extractStatus(r2);

      // Prefer cleaned remainder; fall back to original segment if too short
      const title = capitalize(cleanTitle(r3)) || capitalize(cleanTitle(segment));

      if (title.length === 0) return null;
      const task: ParsedTask = { title, date, status, scope: 'day' };
      if (startTime) task.startTime = startTime;
      return task;
    })
    .filter((t): t is ParsedTask => t !== null);
}
