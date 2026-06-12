import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Tldraw, exportAs } from 'tldraw';
import type { Editor, TLEditorSnapshot, TLStoreSnapshot } from 'tldraw';
import { Download } from 'lucide-react';
import { motion } from 'framer-motion';

import 'tldraw/tldraw.css';

import { WhiteboardSelector } from '@/components/whiteboard/WhiteboardSelector';
import { TaskLinkPicker }     from '@/components/whiteboard/TaskLinkPicker';
import { ErrorBanner }        from '@/components/common/ErrorBanner';
import { Button }             from '@/components/ui/button';

import { useNavStore }         from '@/stores/navStore';
import { useSettingsStore }    from '@/stores/settingsStore';
import { useWhiteboardStore }  from '@/stores/whiteboardStore';

// ---- Constants -----------------------------------------------------------

const AUTOSAVE_MS = 5_000;

// ---- View ----------------------------------------------------------------

export default function WhiteboardView(): JSX.Element {
  const {
    whiteboards,
    active,
    isLoading,
    error,
    fetchWhiteboards,
    loadWhiteboard,
    createWhiteboard,
    saveWhiteboard,
    setWhiteboardTask,
  } = useWhiteboardStore();

  const consumePendingWhiteboardId = useNavStore((s) => s.consumePendingWhiteboardId);

  const { settings } = useSettingsStore();
  const editorRef    = useRef<Editor | null>(null);

  // 1. Fetch list on mount.
  useEffect(() => {
    void fetchWhiteboards();
  }, [fetchWhiteboards]);

  // 2. Consume a pending nav request (from a task icon click).
  useEffect(() => {
    const pending = consumePendingWhiteboardId();
    if (pending) void loadWhiteboard(pending);
  }, [consumePendingWhiteboardId, loadWhiteboard]);

  // 3. Auto-select most recent board once the list loads.
  useEffect(() => {
    if (isLoading || active) return;
    if (whiteboards.length > 0) {
      void loadWhiteboard(whiteboards[0].id);
    }
  }, [isLoading, active, whiteboards, loadWhiteboard]);

  // 4. Autosave every 5 seconds. Uses editor.getSnapshot() (v5 API).
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      if (editorRef.current) {
        const data = JSON.stringify(editorRef.current.getSnapshot());
        void saveWhiteboard(active.id, data);
      }
    }, AUTOSAVE_MS);
    return () => clearInterval(id);
  }, [active?.id, saveWhiteboard]);

  // 5. Flush pending edits before switching boards or leaving the view —
  //    otherwise up to AUTOSAVE_MS of drawing is lost.
  const flushRef = useRef<() => void>(() => {});
  useEffect(() => {
    flushRef.current = () => {
      if (!editorRef.current || !active) return;
      try {
        const data = JSON.stringify(editorRef.current.getSnapshot());
        void saveWhiteboard(active.id, data);
      } catch {
        // Editor already disposed — nothing to flush.
      }
    };
  }, [active, saveWhiteboard]);

  useEffect(() => () => flushRef.current(), []);

  const isDark = settings.theme === 'dark' ||
    (settings.theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  // ---- Handlers ----------------------------------------------------------

  const handleMount = useCallback((editor: Editor) => {
    editorRef.current = editor;
  }, []);

  const handleSelect = useCallback(
    (id: string) => {
      flushRef.current();
      void loadWhiteboard(id);
    },
    [loadWhiteboard],
  );

  const handleNew = useCallback(async () => {
    flushRef.current();
    const n = whiteboards.length + 1;
    await createWhiteboard(`Pizarra ${n}`);
  }, [whiteboards.length, createWhiteboard]);

  const handleExport = useCallback(async () => {
    if (!editorRef.current || !active) return;
    const editor = editorRef.current;
    const ids    = [...editor.getCurrentPageShapeIds()];
    if (ids.length === 0) return;

    try {
      // v5: exportAs downloads directly — no blob needed.
      await exportAs(editor, ids, { format: 'png', name: active.name });
    } catch (err) {
      console.error('Export PNG failed:', err);
    }
  }, [active]);

  // ---- Snapshot (parsed once per active board) ---------------------------
  // Accepts both TLStoreSnapshot (old saves) and TLEditorSnapshot (new saves).

  const snapshot = useMemo<TLEditorSnapshot | TLStoreSnapshot | undefined>(() => {
    if (!active || !active.data || active.data === '{}') return undefined;
    try {
      return JSON.parse(active.data) as TLEditorSnapshot | TLStoreSnapshot;
    } catch {
      return undefined;
    }
  }, [active?.id]);

  // ---- Render ------------------------------------------------------------

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.15 }}
        className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3"
      >
        <WhiteboardSelector
          whiteboards={whiteboards}
          activeId={active?.id ?? null}
          isLoading={isLoading}
          onSelect={handleSelect}
          onNew={() => void handleNew()}
        />

        {active && (
          <TaskLinkPicker
            taskId={active.taskId ?? null}
            onChange={(tid) => void setWhiteboardTask(active.id, tid)}
          />
        )}

        <Button
          variant="outline"
          size="sm"
          className="ml-auto gap-2"
          onClick={() => void handleExport()}
          disabled={!active}
          aria-label="Exportar como PNG"
        >
          <Download className="h-4 w-4" aria-hidden />
          Exportar PNG
        </Button>
      </motion.div>

      {error && (
        <ErrorBanner
          message={error}
          className="mx-4 mt-3 shrink-0"
        />
      )}

      {/* Canvas — locale and colorScheme passed as props (v5 API).
          `isolate z-0` traps tldraw's internal z-indices (.tlui-layout 300,
          menus 400, blocker 10000) so portaled dropdowns always paint above. */}
      <div className="relative isolate z-0 min-h-0 flex-1">
        {active ? (
          <Tldraw
            key={active.id}
            snapshot={snapshot}
            onMount={handleMount}
            locale="es"
            colorScheme={isDark ? 'dark' : 'light'}
          />
        ) : (
          <EmptyState onNew={() => void handleNew()} isLoading={isLoading} />
        )}
      </div>
    </div>
  );
}

// ---- Empty state ---------------------------------------------------------

interface EmptyStateProps {
  onNew: () => void;
  isLoading: boolean;
}

function EmptyState({ onNew, isLoading }: EmptyStateProps): JSX.Element {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
      <p className="text-muted-foreground">
        {isLoading ? 'Cargando pizarras…' : 'No hay pizarras todavía.'}
      </p>
      {!isLoading && (
        <Button onClick={onNew}>Nueva pizarra</Button>
      )}
    </div>
  );
}
