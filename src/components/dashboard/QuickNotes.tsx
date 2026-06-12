import { useEffect, useRef, useState } from 'react';
import { Textarea }     from '@/components/ui/textarea';
import { useNoteStore } from '@/stores/noteStore';

const DEBOUNCE_MS = 1200;

interface QuickNotesProps {
  date: string;
  initialContent: string;
}

/**
 * Local textarea state is intentional — it prevents lag on every keystroke.
 * `initialContent` is only read once on mount (component is key'd by date in parent,
 * so remounting on date change resets the state naturally).
 */
export function QuickNotes({ date, initialContent }: QuickNotesProps): JSX.Element {
  const { upsertNote, savingDates } = useNoteStore();
  // eslint-disable-next-line react/hook-use-state
  const [local, setLocal] = useState(initialContent);
  const timerRef          = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const isSaving          = savingDates.has(date);

  // Flush pending save on unmount (date change or view switch).
  useEffect(() => {
    return () => {
      clearTimeout(timerRef.current);
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const content = e.target.value;
    setLocal(content);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void upsertNote(date, content);
    }, DEBOUNCE_MS);
  };

  return (
    <div className="shrink-0">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
          Notas del día
        </h3>
        {isSaving && (
          <span className="animate-fade-in font-mono text-[10px] text-muted-foreground/50">
            guardando…
          </span>
        )}
      </div>
      <Textarea
        value={local}
        onChange={handleChange}
        placeholder="Notas, pensamientos, recordatorios…"
        className="min-h-[72px] resize-none border-border/60 bg-card/60 font-mono text-[13px] leading-relaxed placeholder:text-muted-foreground/30 focus-visible:border-primary/40 focus-visible:ring-primary/20"
        rows={3}
        aria-label="Notas rápidas del día"
      />
    </div>
  );
}
