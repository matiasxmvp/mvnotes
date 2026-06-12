import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Bell, Download, Mic, Monitor, Moon, Pencil, RefreshCw, Sun, Upload, X } from 'lucide-react';

import { notify } from '@/lib/notifications';

import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button }   from '@/components/ui/button';
import { Input }    from '@/components/ui/input';
import { Label }    from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch }   from '@/components/ui/switch';

import { invokeTyped }      from '@/lib/tauri';
import { todayISO }         from '@/lib/dateUtils';
import { cn }               from '@/lib/utils';
import { useMicDevices }    from '@/hooks/useMicDevices';
import { useSettingsStore } from '@/stores/settingsStore';
import type { Note, RawTask, Theme, UpdateSettingsInput, Whiteboard } from '@/types';

// ---- Types ---------------------------------------------------------------

interface BackupData {
  version: 1;
  exportedAt: string;
  tasks: RawTask[];
  notes: Note[];
  whiteboards: Whiteboard[];
}

// ---- Shortcut labels -----------------------------------------------------

const SHORTCUT_LABELS: Record<string, string> = {
  newTask: 'Nueva tarea',
};

// ---- Main view -----------------------------------------------------------

export default function SettingsView(): JSX.Element {
  const { settings, fetchSettings, updateSettings, error } = useSettingsStore();
  const { devices: micDevices, refresh: refreshMics } = useMicDevices();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isTesting,   setIsTesting]   = useState(false);

  useEffect(() => {
    void fetchSettings();
  }, [fetchSettings]);

  const update = useCallback(
    (patch: UpdateSettingsInput) => void updateSettings(patch),
    [updateSettings],
  );

  // ---- Export backup -------------------------------------------------------

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const [tasks, notes, whiteboards] = await Promise.all([
        invokeTyped<RawTask[]>('get_tasks', { date: null, startDate: null, endDate: null }),
        invokeTyped<Note[]>('get_all_notes'),
        invokeTyped<Whiteboard[]>('get_whiteboards'),
      ]);

      const backup: BackupData = {
        version: 1,
        exportedAt: new Date().toISOString(),
        tasks,
        notes,
        whiteboards,
      };

      // Local date — toISOString() is UTC and names the file with tomorrow's
      // date when exporting in the evening.
      const dateStr = todayISO();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `mvnotes-backup-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      await notify('✅ Backup exportado', `mvnotes-backup-${dateStr}.json guardado correctamente`);
    } catch (err) {
      setImportError(String(err));
    } finally {
      setIsExporting(false);
    }
  };

  // ---- Import backup -------------------------------------------------------

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so same file can be re-selected.
    e.target.value = '';

    setIsImporting(true);
    setImportError(null);
    setImportSuccess(false);

    try {
      const text   = await file.text();
      const backup = JSON.parse(text) as BackupData;

      if (backup.version !== 1 || !Array.isArray(backup.tasks)) {
        throw new Error('Archivo de backup inválido o incompatible.');
      }

      // Reset everything first.
      await invokeTyped<void>('reset_data');

      // Restore tasks.
      for (const task of backup.tasks) {
        await invokeTyped('create_task', {
          task: {
            title:       task.title,
            description: task.description,
            status:      task.status,
            scope:       task.scope,
            date:        task.date,
            startTime:   task.startTime,
            endTime:     task.endTime,
            tags:        task.tags,
          },
        });
      }

      // Restore notes.
      for (const note of backup.notes) {
        await invokeTyped('upsert_note', { date: note.date, content: note.content });
      }

      // Restore whiteboards.
      for (const wb of backup.whiteboards) {
        const created = await invokeTyped<Whiteboard>('create_whiteboard', {
          input: { name: wb.name },
        });
        if (wb.data && wb.data !== '{}') {
          await invokeTyped('update_whiteboard', {
            id:    created.id,
            patch: { data: wb.data, thumbnail: wb.thumbnail },
          });
        }
      }

      setImportSuccess(true);
      // Reload settings from DB.
      void fetchSettings();
    } catch (err) {
      setImportError(String(err));
    } finally {
      setIsImporting(false);
    }
  };

  // ---- Test notification ---------------------------------------------------

  const handleTestNotify = async () => {
    setIsTesting(true);
    try {
      await notify('🔔 Prueba de notificación', 'Las notificaciones de Pizarra funcionan correctamente.');
    } finally {
      setIsTesting(false);
    }
  };

  // ---- Reset ---------------------------------------------------------------

  const handleReset = async () => {
    setIsResetting(true);
    try {
      await invokeTyped<void>('reset_data');
      void fetchSettings();
    } finally {
      setIsResetting(false);
    }
  };

  // ---- Render --------------------------------------------------------------

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl px-6 py-8">
        <motion.h2
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15 }}
          className="mb-8 text-xl font-semibold"
        >
          Configuración
        </motion.h2>

        {/* ---- General -------------------------------------------------- */}
        <Section title="General">
          <SettingRow
            label="Auto-arranque con Windows"
            description="Abrir Pizarra al iniciar sesión."
          >
            <Switch
              checked={settings.autostart}
              onCheckedChange={(v) => update({ autostart: v })}
              aria-label="Auto-arranque con Windows"
            />
          </SettingRow>

          <Separator />

          <SettingRow
            label="Abrir en monitor secundario"
            description="Al arrancar, maximizar en la segunda pantalla."
          >
            <Switch
              checked={settings.openOnSecondaryMonitor}
              onCheckedChange={(v) => update({ openOnSecondaryMonitor: v })}
              aria-label="Abrir en monitor secundario"
            />
          </SettingRow>
        </Section>

        {/* ---- Inteligencia Artificial --------------------------------- */}
        <Section title="Inteligencia Artificial">
          <div className="py-4 flex flex-col gap-4">

            {/* Groq — primario */}
            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Groq <span className="normal-case font-normal tracking-normal text-green-400">· primario</span>
              </p>
              <div className="grid gap-1.5">
                <Label htmlFor="groq-key">API Key</Label>
                <Input
                  id="groq-key"
                  type="password"
                  value={settings.groqApiKey}
                  onChange={(e) => update({ groqApiKey: e.target.value })}
                  placeholder="gsk_..."
                  className="font-mono text-xs"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="groq-model">Modelo</Label>
                <Input
                  id="groq-model"
                  type="text"
                  value={settings.groqModel}
                  onChange={(e) => update({ groqModel: e.target.value })}
                  placeholder="llama-3.3-70b-versatile"
                  className="font-mono text-xs"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Parseo ~1-2 seg. Free tier en{' '}
                <span className="font-medium text-primary">console.groq.com</span>.
              </p>
            </div>

          </div>
        </Section>

        {/* ---- Deepgram ------------------------------------------------ */}
        <Section title="Reconocimiento de voz">
          <div className="py-4 flex flex-col gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="deepgram-key">API Key de Deepgram</Label>
              <Input
                id="deepgram-key"
                type="password"
                value={settings.deepgramApiKey}
                onChange={(e) => update({ deepgramApiKey: e.target.value })}
                placeholder="Token xxxxxxxx..."
                className="font-mono text-xs"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Transcripción de alta calidad en español.
              Obtén tu key gratis (200h/mes) en{' '}
              <span className="font-medium text-primary">console.deepgram.com</span>.
              Sin key, se usa el reconocimiento del navegador.
            </p>
          </div>
        </Section>

        {/* ---- Micrófono ----------------------------------------------- */}
        <Section title="Micrófono">
          <div className="py-4 flex flex-col gap-3">
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="mic-select" className="flex items-center gap-2">
                  <Mic className="h-3.5 w-3.5" />
                  Dispositivo de entrada
                </Label>
                <button
                  type="button"
                  onClick={() => void refreshMics()}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Actualizar lista de micrófonos"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              </div>
              <Select
                value={settings.micDeviceId || 'default'}
                onValueChange={(v) => update({ micDeviceId: v === 'default' ? '' : v })}
              >
                <SelectTrigger id="mic-select" className="text-xs">
                  <SelectValue placeholder="Micrófono por defecto del sistema" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default" className="text-xs">
                    Por defecto del sistema
                  </SelectItem>
                  {micDevices.map((d) => (
                    <SelectItem key={d.deviceId} value={d.deviceId} className="text-xs">
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              Selecciona el micrófono físico si Discord u otra app interfiere con el reconocimiento de voz.
            </p>
          </div>
        </Section>

        {/* ---- Apariencia ----------------------------------------------- */}
        <Section title="Apariencia">
          <SettingRow label="Tema" description="Elige el esquema de colores.">
            <ThemeSelector
              value={settings.theme}
              onChange={(t) => update({ theme: t })}
            />
          </SettingRow>
        </Section>

        {/* ---- Atajos --------------------------------------------------- */}
        <Section title="Atajos de teclado">
          <ShortcutList
            shortcuts={settings.shortcuts}
            onChange={(shortcuts) =>
              update({ shortcuts: JSON.stringify(shortcuts) })
            }
          />
        </Section>

        {/* ---- Horario -------------------------------------------------- */}
        <Section title="Horario">
          <div className="py-4 flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <PomodoroField
                label="Hora inicio"
                value={settings.scheduleStartHour}
                onChange={(v) => update({ scheduleStartHour: v })}
                min={0}
                max={23}
              />
              <PomodoroField
                label="Hora fin"
                value={settings.scheduleEndHour}
                onChange={(v) => update({ scheduleEndHour: v })}
                min={1}
                max={24}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              El horario semanal muestra solo el rango configurado.
              Ejemplo: 7 → 22 muestra de 7 AM a 10 PM.
            </p>
          </div>
        </Section>

        {/* ---- Pomodoro ------------------------------------------------- */}
        <Section title="Pomodoro">
          <div className="py-4 flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <PomodoroField
                label="Foco (min)"
                value={settings.pomodoroWork}
                onChange={(v) => update({ pomodoroWork: v })}
                min={1} max={90}
              />
              <PomodoroField
                label="Descanso corto (min)"
                value={settings.pomodoroBreak}
                onChange={(v) => update({ pomodoroBreak: v })}
                min={1} max={30}
              />
              <PomodoroField
                label="Descanso largo (min)"
                value={settings.pomodoroLongBreak}
                onChange={(v) => update({ pomodoroLongBreak: v })}
                min={1} max={60}
              />
              <PomodoroField
                label="Sesiones por ciclo"
                value={settings.pomodoroLongBreakInterval}
                onChange={(v) => update({ pomodoroLongBreakInterval: v })}
                min={1} max={10}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Cada {settings.pomodoroLongBreakInterval} sesiones de foco se activa el descanso largo.
            </p>
          </div>
        </Section>

        {/* ---- Datos ---------------------------------------------------- */}
        <Section title="Datos">
          <div className="flex flex-col gap-3 py-2">
            {(error || importError) && (
              <p className="rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive">
                {error ?? importError}
              </p>
            )}
            {importSuccess && (
              <p className="rounded-lg bg-green-500/10 px-4 py-2 text-sm text-green-400">
                Backup importado correctamente.
              </p>
            )}

            <div className="flex flex-wrap gap-3">
              {/* Test notification */}
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => void handleTestNotify()}
                disabled={isTesting}
              >
                <Bell className="h-4 w-4" aria-hidden />
                {isTesting ? 'Enviando…' : 'Probar notificación'}
              </Button>

              {/* Export */}
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => void handleExport()}
                disabled={isExporting}
              >
                <Download className="h-4 w-4" aria-hidden />
                {isExporting ? 'Exportando…' : 'Exportar backup (JSON)'}
              </Button>

              {/* Import */}
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
              >
                <Upload className="h-4 w-4" aria-hidden />
                {isImporting ? 'Importando…' : 'Importar backup'}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={(e) => void handleImportFile(e)}
                aria-label="Seleccionar archivo de backup"
              />
            </div>

            <Separator className="my-1" />

            {/* Reset — destructive, requires confirmation */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  className="w-fit"
                  disabled={isResetting}
                >
                  {isResetting ? 'Reseteando…' : 'Resetear todos los datos'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Resetear todos los datos?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Se eliminarán permanentemente todas las tareas, notas y pizarras.
                    La configuración volverá a los valores predeterminados.
                    Esta acción no se puede deshacer.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => void handleReset()}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Sí, resetear todo
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <p className="text-xs text-muted-foreground">
              Exporta un backup antes de resetear para no perder tus datos.
            </p>
          </div>
        </Section>
      </div>
    </div>
  );
}

// ---- Sub-components (private) --------------------------------------------

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <section className="mb-8">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {title}
      </h3>
      <div className="rounded-xl border border-border bg-card px-5 divide-y divide-border">
        {children}
      </div>
    </section>
  );
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-6 py-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {description && (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

function ThemeSelector({
  value,
  onChange,
}: {
  value: Theme;
  onChange: (t: Theme) => void;
}): JSX.Element {
  const options: { key: Theme; label: string; icon: React.ReactNode }[] = [
    { key: 'light', label: 'Claro',    icon: <Sun  className="h-4 w-4" /> },
    { key: 'dark',  label: 'Oscuro',   icon: <Moon className="h-4 w-4" /> },
    { key: 'auto',  label: 'Auto',     icon: <Monitor className="h-4 w-4" /> },
  ];

  return (
    <div className="flex gap-1.5" role="radiogroup" aria-label="Tema">
      {options.map(({ key, label, icon }) => (
        <button
          key={key}
          type="button"
          role="radio"
          aria-checked={value === key}
          onClick={() => onChange(key)}
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            value === key
              ? 'bg-primary/15 text-primary'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
          )}
        >
          {icon}
          {label}
        </button>
      ))}
    </div>
  );
}

function PomodoroField({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
}): JSX.Element {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const v = parseInt(e.target.value, 10);
          if (!isNaN(v) && v >= min && v <= max) onChange(v);
        }}
        className="h-8 text-sm"
      />
    </div>
  );
}

function ShortcutList({
  shortcuts,
  onChange,
}: {
  shortcuts: Record<string, string>;
  onChange: (s: Record<string, string>) => void;
}): JSX.Element {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft,   setDraft]   = useState('');

  const startEdit = (key: string) => {
    setEditing(key);
    setDraft(shortcuts[key] ?? '');
  };

  const commitEdit = (key: string) => {
    if (draft.trim()) {
      onChange({ ...shortcuts, [key]: draft.trim() });
    }
    setEditing(null);
  };

  const cancelEdit = () => setEditing(null);

  const entries = Object.entries(shortcuts);

  if (entries.length === 0) {
    return (
      <p className="py-4 text-sm text-muted-foreground">Sin atajos configurados.</p>
    );
  }

  return (
    <div className="divide-y divide-border">
      {entries.map(([key, combo]) => (
        <div key={key} className="flex items-center justify-between gap-4 py-3.5">
          <Label className="text-sm font-medium">
            {SHORTCUT_LABELS[key] ?? key}
          </Label>

          {editing === key ? (
            <div className="flex items-center gap-2">
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitEdit(key);
                  if (e.key === 'Escape') cancelEdit();
                }}
                className="h-7 w-32 text-xs"
                placeholder="Ctrl+N"
                autoFocus
              />
              <button
                type="button"
                onClick={cancelEdit}
                aria-label="Cancelar edición"
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <kbd className="rounded-md border border-border bg-muted px-2 py-0.5 text-xs font-mono">
                {combo}
              </kbd>
              <button
                type="button"
                onClick={() => startEdit(key)}
                aria-label={`Editar atajo de ${SHORTCUT_LABELS[key] ?? key}`}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
