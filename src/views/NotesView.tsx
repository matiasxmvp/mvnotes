import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  BookOpen, Eye, Link2, Pencil, Plus, Search,
  Sparkles, Tag, Trash2, Unlink, X,
} from 'lucide-react';
import { motion } from 'framer-motion';

import { Button }   from '@/components/ui/button';
import { Input }    from '@/components/ui/input';
import { Label }    from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ErrorBanner } from '@/components/common/ErrorBanner';

import { summarizeWithGroq } from '@/lib/groq';
import { invokeTyped }       from '@/lib/tauri';
import { cn }                from '@/lib/utils';
import { useSettingsStore }  from '@/stores/settingsStore';
import { useStudyNoteStore } from '@/stores/studyNoteStore';
import type { RawTask, StudyNote } from '@/types';

// ---- Helpers ----------------------------------------------------------------

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1)  return 'ahora';
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  const d = Math.floor(h / 24);
  return `hace ${d} día${d !== 1 ? 's' : ''}`;
}

// ---- View ----------------------------------------------------------------

export default function NotesView(): JSX.Element {
  const {
    notes, search, activeTag, isLoading, error,
    fetchNotes, createNote, updateNote, deleteNote,
    setSearch, setActiveTag,
  } = useStudyNoteStore();

  const { settings } = useSettingsStore();

  const [activeId,   setActiveId]   = useState<string | null>(null);
  const [allTasks,   setAllTasks]   = useState<RawTask[]>([]);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // ---- Init ----------------------------------------------------------------

  useEffect(() => {
    void fetchNotes('');
    invokeTyped<RawTask[]>('get_tasks', { date: null, startDate: null, endDate: null })
      .then(setAllTasks)
      .catch(() => {/* non-fatal */});
  }, [fetchNotes]);

  const activeNote = useMemo(
    () => notes.find((n) => n.id === activeId) ?? null,
    [notes, activeId],
  );

  // ---- All unique tags across all notes ------------------------------------

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const n of notes) n.tags.forEach((t) => set.add(t));
    return [...set].sort();
  }, [notes]);

  // ---- Filtered note list --------------------------------------------------

  const filteredNotes = useMemo(
    () => activeTag ? notes.filter((n) => n.tags.includes(activeTag)) : notes,
    [notes, activeTag],
  );

  const linked = useMemo(() => filteredNotes.filter((n) => n.taskId), [filteredNotes]);
  const free   = useMemo(() => filteredNotes.filter((n) => !n.taskId), [filteredNotes]);

  const byTask = useMemo(() => {
    const map = new Map<string, { taskTitle: string; notes: StudyNote[] }>();
    for (const n of linked) {
      const key = n.taskId!;
      if (!map.has(key)) map.set(key, { taskTitle: n.taskTitle ?? key, notes: [] });
      map.get(key)!.notes.push(n);
    }
    return map;
  }, [linked]);

  // ---- Search --------------------------------------------------------------

  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    void fetchNotes(value);
  }, [setSearch, fetchNotes]);

  // ---- New note ------------------------------------------------------------

  const handleNew = useCallback(async () => {
    const note = await createNote({ title: '', content: '', tags: [] });
    setActiveId(note.id);
    setActiveTag(null);
  }, [createNote, setActiveTag]);

  // ---- Auto-save (debounced) -----------------------------------------------

  const scheduleSave = useCallback(
    (id: string, patch: { title?: string; content?: string; tags?: string[] }) => {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        void updateNote(id, patch);
      }, 800);
    },
    [updateNote],
  );

  useEffect(() => () => clearTimeout(saveTimerRef.current), []);

  // ---- Delete --------------------------------------------------------------

  const handleDelete = useCallback(async (id: string) => {
    await deleteNote(id);
    if (activeId === id) setActiveId(null);
  }, [deleteNote, activeId]);

  // ---- Render: list item ---------------------------------------------------

  const renderItem = (note: StudyNote) => (
    <button
      key={note.id}
      type="button"
      onClick={() => setActiveId(note.id)}
      className={cn(
        'w-full text-left rounded-lg px-3 py-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        activeId === note.id
          ? 'bg-primary/10 text-primary'
          : 'hover:bg-accent text-foreground',
      )}
    >
      <p className="truncate text-sm font-medium">
        {note.title || <span className="italic text-muted-foreground">Sin título</span>}
      </p>
      {note.tags.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {note.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="rounded px-1.5 py-0.5 text-[10px] bg-primary/10 text-primary/80">
              {tag}
            </span>
          ))}
          {note.tags.length > 3 && (
            <span className="text-[10px] text-muted-foreground">+{note.tags.length - 3}</span>
          )}
        </div>
      )}
      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
        {note.content ? note.content.slice(0, 50) : ''}
      </p>
      <p className="mt-0.5 text-[10px] text-muted-foreground/60">{timeAgo(note.updatedAt)}</p>
    </button>
  );

  // ---- Render --------------------------------------------------------------

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── LEFT: list ─────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.15 }}
        className="flex w-64 shrink-0 flex-col gap-3 border-r border-border p-3"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Notas
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={() => void handleNew()}
            aria-label="Nueva nota"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Buscar notas…"
            className="h-8 pl-8 text-xs"
          />
        </div>

        {/* Tag filter chips */}
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {allTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                className={cn(
                  'flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                  activeTag === tag
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                <Tag className="h-2.5 w-2.5" />
                {tag}
              </button>
            ))}
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto flex flex-col gap-1">
          {isLoading && notes.length === 0 && (
            <p className="px-2 text-xs text-muted-foreground">Cargando…</p>
          )}

          {/* Linked groups */}
          {byTask.size > 0 && (
            <div className="flex flex-col gap-1">
              <p className="px-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mt-1">
                Con tarea
              </p>
              {[...byTask.entries()].map(([taskId, { taskTitle, notes: taskNotes }]) => (
                <div key={taskId} className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-1.5 px-1 py-0.5">
                    <Link2 className="h-3 w-3 shrink-0 text-primary/60" />
                    <span className="truncate text-[11px] font-medium text-primary/80">{taskTitle}</span>
                  </div>
                  {taskNotes.map(renderItem)}
                </div>
              ))}
            </div>
          )}

          {/* Free notes */}
          {free.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="px-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mt-1">
                Sin tarea
              </p>
              {free.map(renderItem)}
            </div>
          )}

          {filteredNotes.length === 0 && !isLoading && (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
              <BookOpen className="h-8 w-8 opacity-30" />
              <p className="text-xs">
                {activeTag ? `Sin notas con tag "${activeTag}"` : 'Sin notas todavía'}
              </p>
              {!activeTag && (
                <button
                  type="button"
                  onClick={() => void handleNew()}
                  className="text-xs text-primary hover:underline"
                >
                  Crear primera nota
                </button>
              )}
            </div>
          )}
        </div>
      </motion.div>

      {/* ── RIGHT: editor ──────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col min-w-0">
        {error && <ErrorBanner message={error} className="m-4 shrink-0" />}

        {activeNote ? (
          <NoteEditor
            note={activeNote}
            tasks={allTasks}
            groqApiKey={settings.groqApiKey}
            groqModel={settings.groqModel}
            onSave={(patch) => scheduleSave(activeNote.id, patch)}
            onTaskLink={(taskId) => void updateNote(activeNote.id, { taskId: taskId ?? null })}
            onDelete={() => void handleDelete(activeNote.id)}
          />
        ) : (
          <EmptyEditor onNew={() => void handleNew()} />
        )}
      </div>
    </div>
  );
}

// ---- NoteEditor sub-component -------------------------------------------

interface NoteEditorProps {
  note:        StudyNote;
  tasks:       RawTask[];
  groqApiKey:  string;
  groqModel:   string;
  onSave:      (patch: { title?: string; content?: string; tags?: string[] }) => void;
  onTaskLink:  (taskId: string | undefined) => void;
  onDelete:    () => void;
}

function NoteEditor({
  note, tasks, groqApiKey, groqModel, onSave, onTaskLink, onDelete,
}: NoteEditorProps): JSX.Element {
  const [localTitle,   setLocalTitle]   = useState(note.title);
  const [localContent, setLocalContent] = useState(note.content);
  const [localTags,    setLocalTags]    = useState<string[]>(note.tags);
  const [preview,      setPreview]      = useState(false);
  const [tagInput,     setTagInput]     = useState('');
  const [summarizing,  setSummarizing]  = useState(false);

  // Sync when switching notes.
  useEffect(() => {
    setLocalTitle(note.title);
    setLocalContent(note.content);
    setLocalTags(note.tags);
    setPreview(false);
  }, [note.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Tag actions --------------------------------------------------------

  const addTag = useCallback((raw: string) => {
    const tag = raw.trim().toLowerCase().replace(/\s+/g, '-');
    if (!tag || localTags.includes(tag)) { setTagInput(''); return; }
    const next = [...localTags, tag];
    setLocalTags(next);
    setTagInput('');
    onSave({ tags: next });
  }, [localTags, onSave]);

  const removeTag = useCallback((tag: string) => {
    const next = localTags.filter((t) => t !== tag);
    setLocalTags(next);
    onSave({ tags: next });
  }, [localTags, onSave]);

  const handleTagKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(tagInput);
    } else if (e.key === 'Backspace' && tagInput === '' && localTags.length > 0) {
      removeTag(localTags[localTags.length - 1]!);
    }
  }, [tagInput, localTags, addTag, removeTag]);

  // ---- AI Summary ---------------------------------------------------------

  const handleSummarize = useCallback(async () => {
    if (!groqApiKey || !localContent.trim()) return;
    setSummarizing(true);
    try {
      const summary = await summarizeWithGroq(groqApiKey, groqModel, localContent);
      const next = `${localContent}\n\n---\n\n**Resumen**\n\n${summary}`;
      setLocalContent(next);
      onSave({ content: next });
    } finally {
      setSummarizing(false);
    }
  }, [groqApiKey, groqModel, localContent, onSave]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex shrink-0 flex-col gap-2 border-b border-border px-6 py-4">
        {/* Title row */}
        <div className="flex items-center gap-3">
          <input
            value={localTitle}
            onChange={(e) => {
              setLocalTitle(e.target.value);
              onSave({ title: e.target.value });
            }}
            placeholder="Título de la nota…"
            className="flex-1 min-w-0 bg-transparent text-lg font-semibold text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
          />

          {/* Toolbar */}
          <div className="flex shrink-0 items-center gap-1">
            {/* Preview toggle */}
            <button
              type="button"
              onClick={() => setPreview((v) => !v)}
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                preview
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
              aria-label={preview ? 'Editar' : 'Vista previa'}
            >
              {preview ? <Pencil className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>

            {/* AI Summarize */}
            <button
              type="button"
              onClick={() => void handleSummarize()}
              disabled={summarizing || !groqApiKey || !localContent.trim()}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Resumir con IA"
              title={!groqApiKey ? 'Configura tu Groq API key en Ajustes' : 'Resumir con IA'}
            >
              <Sparkles className={cn('h-4 w-4', summarizing && 'animate-pulse text-primary')} />
            </button>

            {/* Delete */}
            <button
              type="button"
              onClick={onDelete}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Eliminar nota"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Task link row */}
        <div className="flex items-center gap-2">
          {note.taskId ? (
            <div className="flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-1">
              <Link2 className="h-3 w-3 text-primary" aria-hidden />
              <span className="text-xs font-medium text-primary">{note.taskTitle ?? note.taskId}</span>
              <button
                type="button"
                onClick={() => onTaskLink(undefined)}
                className="ml-0.5 text-primary/60 hover:text-primary transition-colors"
                aria-label="Desvincular tarea"
              >
                <Unlink className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <TaskSelector tasks={tasks} onSelect={onTaskLink} />
          )}
        </div>

        {/* Tags row */}
        <div className="flex flex-wrap items-center gap-1.5">
          {localTags.map((tag) => (
            <span
              key={tag}
              className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs text-primary"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="ml-0.5 text-primary/60 hover:text-primary transition-colors"
                aria-label={`Quitar tag ${tag}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <div className="flex items-center gap-1 text-muted-foreground">
            <Tag className="h-3 w-3 shrink-0" />
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              onBlur={() => { if (tagInput.trim()) addTag(tagInput); }}
              placeholder="Agregar tag…"
              className="h-5 w-28 bg-transparent text-xs placeholder:text-muted-foreground/40 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Content area */}
      {preview ? (
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {localContent.trim() ? (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{localContent}</ReactMarkdown>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground/40 italic">Sin contenido todavía…</p>
          )}
        </div>
      ) : (
        <textarea
          value={localContent}
          onChange={(e) => {
            setLocalContent(e.target.value);
            onSave({ content: e.target.value });
          }}
          placeholder="Escribe tu nota aquí… (soporta Markdown)"
          className="flex-1 resize-none bg-transparent px-6 py-4 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/40 focus:outline-none font-mono"
        />
      )}

      {/* Footer */}
      <div className="shrink-0 border-t border-border px-6 py-2">
        <p className="text-[11px] text-muted-foreground/50">
          Guardado automáticamente · Actualizado {timeAgo(note.updatedAt)}
          {preview && <span className="ml-2 text-primary/60">· Vista previa Markdown</span>}
        </p>
      </div>
    </div>
  );
}

// ---- TaskSelector --------------------------------------------------------

interface TaskSelectorProps {
  tasks:    RawTask[];
  onSelect: (taskId: string) => void;
}

function TaskSelector({ tasks, onSelect }: TaskSelectorProps): JSX.Element {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-md border border-dashed border-border px-2 py-1 text-xs text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <Link2 className="h-3 w-3" />
        Vincular a tarea
      </button>
    );
  }

  return (
    <div className="w-64">
      <Label className="sr-only" htmlFor="task-link-select">Vincular a tarea</Label>
      <Select
        onValueChange={(v) => {
          onSelect(v);
          setOpen(false);
        }}
        onOpenChange={(o) => { if (!o) setOpen(false); }}
        defaultOpen
      >
        <SelectTrigger id="task-link-select" className="h-7 text-xs">
          <SelectValue placeholder="Elegir tarea…" />
        </SelectTrigger>
        <SelectContent>
          {tasks.length === 0 && (
            <div className="px-2 py-2 text-xs text-muted-foreground">Sin tareas disponibles</div>
          )}
          {tasks.map((t) => (
            <SelectItem key={t.id} value={t.id} className="text-xs">
              <span className="truncate">{t.title}</span>
              <span className="ml-1.5 text-muted-foreground">{t.date}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// ---- Empty state ---------------------------------------------------------

function EmptyEditor({ onNew }: { onNew: () => void }): JSX.Element {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center text-muted-foreground">
      <BookOpen className="h-12 w-12 opacity-20" />
      <p className="text-sm">Selecciona una nota o crea una nueva</p>
      <Button variant="outline" size="sm" onClick={onNew} className="gap-2">
        <Plus className="h-4 w-4" />
        Nueva nota
      </Button>
    </div>
  );
}
