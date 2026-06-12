// ---- Enums / literals ---------------------------------------------------

export type TaskStatus = 'obligatorio' | 'importante' | 'prescindible';
export type TaskScope  = 'day' | 'week' | 'month' | 'year';
export type Recurrence = 'daily' | 'weekdays' | 'weekly';
export type Theme      = 'light' | 'dark' | 'auto';
export type View       = 'dashboard' | 'schedule' | 'whiteboard' | 'notes' | 'settings';

// ---- Domain models -------------------------------------------------------

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  scope: TaskScope;
  date: string;          // YYYY-MM-DD
  startTime?: string;    // HH:MM
  endTime?: string;      // HH:MM
  completed: boolean;
  tags?: string[];       // parsed from JSON string stored in DB
  recurrence?: Recurrence;        // set on the template row only
  recurrenceParentId?: string;    // set on materialized occurrences
  createdAt: string;     // RFC-3339
  updatedAt: string;
}

export interface Whiteboard {
  id: string;
  name: string;
  data: string;          // tldraw serialised JSON
  thumbnail?: string;    // base64 PNG
  taskId?: string | null;
  updatedAt: string;
}

export interface Note {
  id: string;
  content: string;
  date: string;          // YYYY-MM-DD
  updatedAt: string;
}

export interface StudyNote {
  id:         string;
  title:      string;
  content:    string;
  tags:       string[];
  taskId?:    string;
  taskTitle?: string;   // joined from tasks — may be undefined if task was deleted
  createdAt:  string;
  updatedAt:  string;
}

export interface CreateStudyNoteInput {
  title:   string;
  content: string;
  taskId?: string;
  tags?:   string[];
}

export interface UpdateStudyNoteInput {
  title?:   string;
  content?: string;
  taskId?:  string | null; // null = unlink task
  tags?:    string[];
}

export interface Settings {
  autostart: boolean;
  openOnSecondaryMonitor: boolean;
  theme: Theme;
  shortcuts: Record<string, string>;
  micDeviceId: string;
  deepgramApiKey: string;
  groqApiKey: string;
  groqModel: string;
  pomodoroWork: number;
  pomodoroBreak: number;
  pomodoroLongBreak: number;
  pomodoroLongBreakInterval: number;
  scheduleStartHour: number;
  scheduleEndHour:   number;
}

// ---- Command input types (sent to Rust) ----------------------------------

export interface CreateTaskInput {
  title: string;
  description?: string;
  status: TaskStatus;
  scope: TaskScope;
  date: string;
  startTime?: string;
  endTime?: string;
  tags?: string;         // JSON array string e.g. '["trabajo"]'
  recurrence?: Recurrence;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  scope?: TaskScope;
  date?: string;
  startTime?: string;
  endTime?: string;
  completed?: boolean;
  tags?: string;
  recurrence?: Recurrence | 'none';  // 'none' clears it
}

export interface UpdateSettingsInput {
  autostart?: boolean;
  openOnSecondaryMonitor?: boolean;
  theme?: Theme;
  shortcuts?: string;    // JSON map string
  micDeviceId?: string;
  deepgramApiKey?: string;
  groqApiKey?: string;
  groqModel?: string;
  pomodoroWork?: number;
  pomodoroBreak?: number;
  pomodoroLongBreak?: number;
  pomodoroLongBreakInterval?: number;
  scheduleStartHour?: number;
  scheduleEndHour?:   number;
}

// ---- Raw shapes as returned by Rust (camelCase after serde) --------------

export interface RawTask {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  scope: TaskScope;
  date: string;
  startTime: string | null;
  endTime: string | null;
  completed: boolean;
  tags: string | null;   // JSON array string
  recurrence: Recurrence | null;
  recurrenceParentId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Convert raw Rust response → domain Task (parse tags JSON). */
export function parseTask(raw: RawTask): Task {
  return {
    ...raw,
    description: raw.description ?? undefined,
    startTime:   raw.startTime   ?? undefined,
    endTime:     raw.endTime     ?? undefined,
    tags:        raw.tags ? (JSON.parse(raw.tags) as string[]) : undefined,
    recurrence:         raw.recurrence         ?? undefined,
    recurrenceParentId: raw.recurrenceParentId ?? undefined,
  };
}
