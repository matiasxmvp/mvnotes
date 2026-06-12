import { useCallback, useRef, useState } from 'react';

export type RecordStatus = 'idle' | 'recording' | 'done' | 'unsupported';

interface UseAudioRecorderReturn {
  status: RecordStatus;
  audioBlob: Blob | null;
  elapsedSeconds: number;
  start: (deviceId?: string) => Promise<void>;
  stop: () => void;
  reset: () => void;
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [status, setStatus] = useState<RecordStatus>(
    typeof window !== 'undefined' && Boolean(navigator.mediaDevices) ? 'idle' : 'unsupported',
  );
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef   = useRef<Blob[]>([]);
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef    = useRef(false);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const stop = useCallback(() => {
    clearTimer();
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop();
    }
  }, []);

  const reset = useCallback(() => {
    abortRef.current = true;
    clearTimer();
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop();
    }
    recorderRef.current = null;
    chunksRef.current   = [];
    setAudioBlob(null);
    setElapsedSeconds(0);
    setStatus('idle');
  }, []);

  const start = useCallback(async (deviceId?: string) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('unsupported');
      return;
    }

    abortRef.current = false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: deviceId ? { deviceId: { exact: deviceId } } : true,
      });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const recorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current = recorder;
      chunksRef.current   = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (abortRef.current) return;
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        setStatus('done');
      };

      recorder.start(250);
      setStatus('recording');
      setElapsedSeconds(0);

      timerRef.current = setInterval(
        () => setElapsedSeconds((s) => s + 1),
        1000,
      );
    } catch {
      setStatus('unsupported');
    }
  }, []);

  return { status, audioBlob, elapsedSeconds, start, stop, reset };
}
