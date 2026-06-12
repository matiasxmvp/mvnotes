import { useEffect, useMemo, useState } from 'react';
import { addDays } from 'date-fns';
import { Mic, MicOff, RefreshCw, Square, Timer } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { Button }                                                          from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

import { useAudioRecorder }        from '@/hooks/useAudioRecorder';
import { useSpeechRecognition }    from '@/hooks/useSpeechRecognition';
import { parseVoiceInput }         from '@/lib/voiceParser';
import { parseWithGroq }           from '@/lib/groq';
import { transcribeWithDeepgram }  from '@/lib/deepgram';
import { formatDateISO, getDayLabel, todayISO } from '@/lib/dateUtils';
import { cn }                      from '@/lib/utils';
import { usePomodoroStore }        from '@/stores/pomodoroStore';
import { useTaskStore }            from '@/stores/taskStore';
import { useSettingsStore }        from '@/stores/settingsStore';
import type { ParsedTask }         from '@/lib/voiceParser';
import type { VoiceParseResult }   from '@/lib/groq';
import type { TaskStatus }         from '@/types';

// ---- Constants ---------------------------------------------------------------

const STATUS_STYLES: Record<TaskStatus, string> = {
  obligatorio:  'bg-red-500/10 text-red-400 border-red-500/20',
  importante:   'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  prescindible: 'bg-green-500/10 text-green-400 border-green-500/20',
};

const STATUS_LABELS: Record<TaskStatus, string> = {
  obligatorio:  'Obligatorio',
  importante:   'Importante',
  prescindible: 'Prescindible',
};

const POMODORO_CMD_LABELS: Record<string, string> = {
  start: 'Iniciar pomodoro',
  pause: 'Pausar pomodoro',
  reset: 'Reiniciar pomodoro',
  skip:  'Saltar fase',
  config: 'Configurar pomodoro',
};

// ---- Props -------------------------------------------------------------------

interface VoiceModalProps {
  open: boolean;
  onClose: () => void;
}

// ---- Component ---------------------------------------------------------------

export function VoiceModal({ open, onClose }: VoiceModalProps): JSX.Element {
  const { tasks, createTask } = useTaskStore();
  const { settings }          = useSettingsStore();
  const pomodoroStore         = usePomodoroStore();

  const deepgramKey = settings.deepgramApiKey.trim();
  const groqKey     = settings.groqApiKey.trim();
  const groqModel   = settings.groqModel.trim() || 'llama-3.3-70b-versatile';
  const useDeepgram = Boolean(deepgramKey);

  const audio  = useAudioRecorder();
  const speech = useSpeechRecognition();

  const [editedText,   setEditedText]   = useState('');
  const [transcribing, setTranscribing] = useState(false);
  const [parsing,      setParsing]      = useState(false);
  const [parseError,   setParseError]   = useState<string | null>(null);
  const [groqResult,   setGroqResult]   = useState<VoiceParseResult | null>(null);
  const [creating,     setCreating]     = useState(false);

  // ---- Open/close lifecycle ------------------------------------------------

  useEffect(() => {
    if (open) {
      audio.reset();
      speech.reset();
      setEditedText('');
      setGroqResult(null);
      setParseError(null);
      if (useDeepgram) {
        void audio.start(settings.micDeviceId || undefined);
      } else {
        speech.start();
      }
    } else {
      audio.reset();
      speech.reset();
    }
    // Cleanup on unmount — otherwise the mic stream keeps recording if the
    // modal is unmounted while open (e.g. navigating to another view).
    return () => {
      audio.reset();
      speech.reset();
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Deepgram path -------------------------------------------------------

  useEffect(() => {
    if (!useDeepgram || audio.status !== 'done' || !audio.audioBlob) return;

    setTranscribing(true);
    setParseError(null);

    transcribeWithDeepgram(deepgramKey, audio.audioBlob)
      .then((text) => {
        setEditedText(text);
        if (groqKey) runGroq(text);
      })
      .catch((err: unknown) => {
        setParseError(`Deepgram: ${String(err instanceof Error ? err.message : err)}`);
      })
      .finally(() => setTranscribing(false));
  }, [audio.status, audio.audioBlob]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Web Speech path -----------------------------------------------------

  useEffect(() => {
    if (useDeepgram) return;
    setEditedText(speech.transcript);
  }, [speech.transcript]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (useDeepgram || speech.status !== 'done' || !speech.transcript || !groqKey) return;
    runGroq(speech.transcript);
  }, [speech.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Groq parsing --------------------------------------------------------

  const runGroq = (text: string) => {
    if (!groqKey || !text.trim()) return;

    setParsing(true);
    setParseError(null);
    setGroqResult(null);

    // Local-time dates — toISOString() is UTC and flips to the next day in the evening.
    const today        = todayISO();
    const tomorrow     = formatDateISO(addDays(new Date(), 1));
    const contextTasks = tasks.filter((t) => t.date === today || t.date === tomorrow);

    parseWithGroq(groqKey, groqModel, text, contextTasks)
      .then((result) => setGroqResult(result))
      .catch((err: unknown) => {
        setParseError(String(err instanceof Error ? err.message : err));
      })
      .finally(() => setParsing(false));
  };

  // ---- Derived state -------------------------------------------------------

  const isRecording   = useDeepgram ? audio.status === 'recording' : speech.status === 'listening';
  const isDone        = useDeepgram ? audio.status === 'done'      : speech.status === 'done';
  const isUnsupported = useDeepgram ? audio.status === 'unsupported' : speech.status === 'unsupported';
  const isBusy        = transcribing || parsing;

  const localParsed = useMemo<ParsedTask[]>(() => {
    if (!isDone || !editedText || groqKey) return [];
    return parseVoiceInput(editedText);
  }, [isDone, editedText, groqKey]);

  const displayTasks: ParsedTask[] =
    groqResult?.type === 'tasks' ? groqResult.tasks : localParsed;

  const pomodoroCmd = groqResult?.type === 'pomodoro' ? groqResult.cmd : null;

  const handleToggle = () => {
    if (isRecording) {
      if (useDeepgram) audio.stop();
      else speech.stop();
    } else {
      setEditedText('');
      setGroqResult(null);
      setParseError(null);
      if (useDeepgram) {
        audio.reset();
        void audio.start(settings.micDeviceId || undefined);
      } else {
        speech.reset();
        speech.start();
      }
    }
  };

  const handleCreateTasks = async () => {
    setCreating(true);
    try {
      for (const t of displayTasks) {
        await createTask({
          title:       t.title,
          description: t.description,
          status:      t.status,
          scope:       t.scope,
          date:        t.date,
          startTime:   t.startTime,
          endTime:     t.endTime,
          recurrence:  t.recurrence,
        });
      }
      onClose();
    } finally {
      setCreating(false);
    }
  };

  const handleApplyPomodoro = () => {
    if (!pomodoroCmd) return;
    pomodoroStore.applyCmd(pomodoroCmd);
    onClose();
  };

  // ---- Render --------------------------------------------------------------

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Crear por voz
            {useDeepgram && (
              <span className="rounded-md bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-blue-400">
                Deepgram
              </span>
            )}
            {groqKey && (
              <span className="rounded-md bg-green-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-green-400">
                Groq
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2 max-h-[60vh] overflow-y-auto pr-1">
          {isUnsupported ? (
            <p className="text-sm text-destructive">
              El micrófono no está disponible en este entorno.
            </p>
          ) : (
            <>
              {/* Mic button */}
              <div className="flex flex-col items-center gap-3 py-2">
                <div className="relative flex items-center justify-center">
                  {isRecording && (
                    <motion.div
                      className="absolute h-16 w-16 rounded-full bg-primary/20"
                      animate={{ scale: [1, 1.4, 1] }}
                      transition={{ duration: 1.2, repeat: Infinity }}
                    />
                  )}
                  <button
                    type="button"
                    onClick={handleToggle}
                    disabled={isBusy}
                    className={cn(
                      'relative z-10 flex h-12 w-12 items-center justify-center rounded-full transition-colors',
                      isRecording
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-accent',
                      isBusy && 'pointer-events-none opacity-50',
                    )}
                    aria-label={isRecording ? 'Detener grabación' : 'Iniciar grabación'}
                  >
                    {isRecording
                      ? useDeepgram
                        ? <Square className="h-4 w-4 fill-current" />
                        : <Mic    className="h-5 w-5" />
                      : <MicOff className="h-5 w-5" />}
                  </button>
                </div>
                <p className="font-mono text-xs text-muted-foreground">
                  {isRecording
                    ? useDeepgram
                      ? `● ${String(Math.floor(audio.elapsedSeconds / 60)).padStart(2,'0')}:${String(audio.elapsedSeconds % 60).padStart(2,'0')}`
                      : 'Escuchando… pulsa para detener'
                    : transcribing
                      ? 'Transcribiendo…'
                      : isDone
                        ? 'Grabación finalizada'
                        : 'Pulsa para hablar'}
                </p>
              </div>

              {parseError && (
                <p className="text-xs text-yellow-400">{parseError}</p>
              )}

              {/* Editable transcript */}
              {(editedText || isDone) && (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                      Transcript
                    </p>
                    {isDone && groqKey && (
                      <button
                        type="button"
                        onClick={() => runGroq(editedText)}
                        disabled={isBusy}
                        className="flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 disabled:opacity-50"
                      >
                        <RefreshCw className="h-3 w-3" />
                        Reanálizar
                      </button>
                    )}
                  </div>
                  <textarea
                    value={editedText}
                    onChange={(e) => setEditedText(e.target.value)}
                    disabled={isRecording || transcribing}
                    rows={3}
                    className="w-full resize-none rounded-lg border border-border/60 bg-muted/30 p-3 font-mono text-[13px] leading-relaxed text-foreground/80 focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-60"
                  />
                </div>
              )}

              {parsing && (
                <p className="text-center text-xs text-muted-foreground">Analizando con Groq…</p>
              )}

              {/* Pomodoro command preview */}
              <AnimatePresence>
                {isDone && !isBusy && pomodoroCmd && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3"
                  >
                    <Timer className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-primary">
                        {POMODORO_CMD_LABELS[pomodoroCmd.cmd] ?? pomodoroCmd.cmd}
                      </p>
                      {pomodoroCmd.cmd === 'config' && (
                        <p className="text-[11px] text-muted-foreground">
                          {[
                            pomodoroCmd.work      != null && `Foco: ${pomodoroCmd.work} min`,
                            pomodoroCmd.shortBreak != null && `Descanso: ${pomodoroCmd.shortBreak} min`,
                            pomodoroCmd.longBreak  != null && `Descanso largo: ${pomodoroCmd.longBreak} min`,
                            pomodoroCmd.interval   != null && `Ciclo: ${pomodoroCmd.interval} sesiones`,
                          ].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Tasks preview */}
              <AnimatePresence>
                {isDone && !isBusy && displayTasks.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col gap-2"
                  >
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      {displayTasks.length} tarea{displayTasks.length !== 1 ? 's' : ''} detectada{displayTasks.length !== 1 ? 's' : ''}
                    </p>
                    {displayTasks.map((task, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 rounded-lg border border-border/60 bg-card px-3 py-2.5"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{task.title}</p>
                          {task.description && (
                            <p className="truncate text-[11px] italic text-muted-foreground/70">
                              {task.description}
                            </p>
                          )}
                          <p className="text-[11px] text-muted-foreground">
                            {getDayLabel(task.date)}
                            {task.startTime && ` · ${task.startTime}`}
                          </p>
                        </div>
                        <span className={cn(
                          'shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-medium',
                          STATUS_STYLES[task.status],
                        )}>
                          {STATUS_LABELS[task.status]}
                        </span>
                      </div>
                    ))}
                  </motion.div>
                )}
                {isDone && !isBusy && displayTasks.length === 0 && !pomodoroCmd && editedText && (
                  <p className="text-center text-sm text-muted-foreground">
                    No se detectaron tareas. Edita el texto y pulsa Reanálizar.
                  </p>
                )}
              </AnimatePresence>
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          {isDone && displayTasks.length === 0 && !pomodoroCmd && !isBusy && (
            <Button variant="outline" size="sm" onClick={handleToggle} className="mr-auto">
              Reintentar
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>Cancelar</Button>

          {pomodoroCmd && !isBusy && (
            <Button onClick={handleApplyPomodoro}>
              Aplicar
            </Button>
          )}
          {displayTasks.length > 0 && !isBusy && (
            <Button onClick={() => void handleCreateTasks()} disabled={creating}>
              {creating ? 'Creando…' : `Crear ${displayTasks.length} tarea${displayTasks.length !== 1 ? 's' : ''}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
