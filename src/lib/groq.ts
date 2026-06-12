import { todayISO } from '@/lib/dateUtils';
import { addDays, format } from 'date-fns';
import type { ParsedTask } from '@/lib/voiceParser';
import type { Task } from '@/types';
import type { PomodoroCmd } from '@/stores/pomodoroStore';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

// ---- Types ------------------------------------------------------------------

export type VoiceParseResult =
  | { type: 'tasks';    tasks: ParsedTask[] }
  | { type: 'pomodoro'; cmd: PomodoroCmd };

interface ContextTask {
  title: string;
  date: string;
  startTime?: string;
  endTime?: string;
}

// ---- Helpers ----------------------------------------------------------------

function addMinutes(time: string, mins: number): string {
  const [h, m] = time.split(':').map(Number);
  const total  = h * 60 + (m ?? 0) + mins;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function buildContextBlock(ctx: ContextTask[]): string {
  if (ctx.length === 0) return '';
  const lines = ctx.map((t) => {
    const base = t.endTime ?? t.startTime;
    const refs  = base
      ? [15, 30, 45, 60, 90, 120]
          .map((m) => `${m}min→${addMinutes(base, m)}`)
          .join(', ')
      : '';
    const time = t.startTime
      ? `${t.startTime}${t.endTime ? `–${t.endTime}` : ''}`
      : 'sin hora';
    return `  - "${t.title}": ${t.date}, ${time}${refs ? ` (después: ${refs})` : ''}`;
  });
  return `
TAREAS EXISTENTES (solo referencia — NO crearlas de nuevo):
${lines.join('\n')}
Si el usuario dice "X min/horas después de [tarea]" → usa el startTime pre-calculado de arriba.
La nueva tarea hereda la misma fecha que la tarea de referencia.
`;
}

function buildPrompt(transcript: string, ctx: ContextTask[]): string {
  const today    = todayISO();
  const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');

  return `Analiza este texto de voz en español. Hoy es ${today}.

Primero determina si el texto es un COMANDO DE POMODORO puro o una CREACIÓN DE TAREAS.

COMANDOS DE POMODORO — responder con intent="pomodoro" SOLO si el texto habla EXCLUSIVAMENTE del timer pomodoro:
- Iniciar/arrancar/empezar pomodoro → cmd="start"
- Pausar/parar/detener pomodoro → cmd="pause"
- Reiniciar/resetear pomodoro → cmd="reset"
- Saltar/siguiente fase → cmd="skip"
- Configurar duración: "foco de X min"→work=X, "descanso corto de X min"→shortBreak=X, "descanso largo de X min"→longBreak=X, "ciclo de X sesiones"→interval=X

Para TODO LO DEMÁS (incluyendo textos que mencionan "estilo pomodoro" pero crean tareas) → intent="tasks".
${buildContextBlock(ctx)}
═══════════════════════════════════════════════
REGLAS PARA TAREAS
═══════════════════════════════════════════════

FECHA:
- "hoy"→${today}, "mañana"→${tomorrow}, día semana→próxima ocurrencia, sin fecha→${today}
- Todas las tareas de la misma frase comparten fecha salvo indicación contraria

HORAS EXPLÍCITAS:
- tarde/noche→PM (suma 12 si <12), mañana→AM, número <7 sin especificar→PM
- "10 am"→"10:00", "3 pm"→"15:00", "mediodía"→"12:00"

DURACIÓN Y endTime:
- Extrae duración si se menciona: "30 min/minutos"→30, "1 hora"→60, "media hora"→30, "2 horas"→120, "45 min"→45
- Si hay startTime + duración → calcula endTime = startTime + duración (en HH:MM)
- Sin duración → endTime = null

ENCADENAMIENTO SECUENCIAL (crítico):
- Palabras clave: "después", "luego", "entonces", "a continuación", "posterior a eso/esto", "seguido de", "tras eso", "más tarde"
- Cuando aparece: startTime de la tarea siguiente = endTime de la tarea anterior
- Aplica el encadenamiento en ORDEN de aparición en el texto
- Ejemplo: "A las 10 camino 30 min, después desayuno 30 min, luego estudio 1 hora"
    → Tarea 1: startTime="10:00", endTime="10:30"
    → Tarea 2: startTime="10:30" (encadenado), endTime="11:00"
    → Tarea 3: startTime="11:00" (encadenado), endTime="12:00"

DESCRIPTORES ESPECIALES (NO son comandos pomodoro, van a description):
- "estilo pomodoro", "con técnica pomodoro", "usando pomodoro" → description incluye "Técnica Pomodoro"
- "sin interrupciones", "en silencio", "con música", etc. → añadir a description

SEPARACIÓN DE TAREAS:
- Cada actividad diferente = tarea SEPARADA
- "caminar Y ver One Piece" = 1 tarea (actividad simultánea)
- "caminar, DESPUÉS desayuno" = 2 tareas

RECURRENCIA:
- "todos los días", "cada día", "diario" → recurrence="daily"
- "de lunes a viernes", "días de semana", "días hábiles" → recurrence="weekdays"
- "todas las semanas", "cada semana", "todos los [día]" (ej. "todos los lunes") → recurrence="weekly" (date = próxima ocurrencia de ese día)
- Sin mención de repetición → recurrence=null

TÍTULO: máx 5 palabras, sin relleno ("tengo que", "necesito", "hay que", "voy a", "vas a")
STATUS: urgente/crítico→"obligatorio", puede esperar/opcional→"prescindible", resto→"importante"

═══════════════════════════════════════════════
Responde SOLO con JSON sin markdown:

Forma 1 — tareas:
{"intent":"tasks","tasks":[{"title":string,"description":string|null,"date":"YYYY-MM-DD","startTime":"HH:MM"|null,"endTime":"HH:MM"|null,"status":"obligatorio"|"importante"|"prescindible","scope":"day","recurrence":"daily"|"weekdays"|"weekly"|null}]}

Forma 2 — pomodoro puro:
{"intent":"pomodoro","cmd":"start"|"pause"|"reset"|"skip"|"config","work":number|null,"shortBreak":number|null,"longBreak":number|null,"interval":number|null}

Texto: "${transcript}"`;
}

function extractJson(raw: string): string {
  const stripped = raw.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  const match = stripped.match(/\{[\s\S]*\}/);
  return match ? match[0] : stripped;
}

const VALID_SCOPES      = new Set(['day', 'week', 'month', 'year']);
const VALID_STATUSES    = new Set(['obligatorio', 'importante', 'prescindible']);
const VALID_RECURRENCES = new Set(['daily', 'weekdays', 'weekly']);

// ---- Main export ------------------------------------------------------------

export async function summarizeWithGroq(
  apiKey: string,
  model:  string,
  content: string,
): Promise<string> {
  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role:    'system',
          content: 'Eres un asistente de estudio. Resume el siguiente texto en español de forma concisa, destacando los puntos clave. Máximo 150 palabras. Solo responde con el resumen, sin introducción ni título.',
        },
        { role: 'user', content },
      ],
      temperature: 0.3,
      max_tokens:  300,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Groq ${response.status}: ${body || response.statusText}`);
  }

  const data = await response.json() as { choices: { message: { content: string } }[] };
  return data.choices[0]?.message?.content ?? '';
}

export async function parseWithGroq(
  apiKey: string,
  model: string,
  transcript: string,
  contextTasks: Task[] = [],
): Promise<VoiceParseResult> {
  const ctx: ContextTask[] = contextTasks.map((t) => ({
    title:     t.title,
    date:      t.date,
    startTime: t.startTime,
    endTime:   t.endTime,
  }));

  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role:    'system',
          content: 'Eres un asistente de voz. Responde SIEMPRE con JSON válido, sin markdown, sin texto adicional.',
        },
        { role: 'user', content: buildPrompt(transcript, ctx) },
      ],
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Groq ${response.status}: ${body || response.statusText}`);
  }

  const data    = await response.json() as { choices: { message: { content: string } }[] };
  const content = data.choices[0]?.message?.content ?? '';
  const json    = extractJson(content);
  const parsed  = JSON.parse(json) as Record<string, unknown>;

  // ── Pomodoro intent ───────────────────────────────────────────────────────
  if (parsed.intent === 'pomodoro') {
    const rawCmd = String(parsed.cmd ?? '');
    if (rawCmd === 'config') {
      const cmd: PomodoroCmd = {
        cmd:        'config',
        work:       typeof parsed.work       === 'number' ? parsed.work       : undefined,
        shortBreak: typeof parsed.shortBreak === 'number' ? parsed.shortBreak : undefined,
        longBreak:  typeof parsed.longBreak  === 'number' ? parsed.longBreak  : undefined,
        interval:   typeof parsed.interval   === 'number' ? parsed.interval   : undefined,
      };
      return { type: 'pomodoro', cmd };
    }
    if (['start', 'pause', 'reset', 'skip'].includes(rawCmd)) {
      return { type: 'pomodoro', cmd: { cmd: rawCmd as 'start' | 'pause' | 'reset' | 'skip' } };
    }
  }

  // ── Tasks intent ──────────────────────────────────────────────────────────
  const rawTasks = Array.isArray(parsed.tasks) ? parsed.tasks as ParsedTask[] : [];
  const existingTitles = ctx.map((c) => c.title.toLowerCase());

  const tasks = rawTasks
    .filter((t) => typeof t.title === 'string' && t.title.length > 0)
    .filter((t) => !existingTitles.some(
      (e) => e.includes(t.title.toLowerCase()) || t.title.toLowerCase().includes(e),
    ))
    .map((t) => ({
      title:       t.title,
      description: typeof t.description === 'string' && t.description.length > 0
        ? t.description : undefined,
      date:      t.date,
      startTime: t.startTime  ?? undefined,
      endTime:   ((t as unknown) as Record<string, unknown>).endTime as string | undefined ?? undefined,
      scope:     VALID_SCOPES.has(t.scope)    ? t.scope   : 'day',
      status:    VALID_STATUSES.has(t.status) ? t.status  : 'importante',
      recurrence: t.recurrence && VALID_RECURRENCES.has(t.recurrence) ? t.recurrence : undefined,
    } as ParsedTask));

  return { type: 'tasks', tasks };
}
