import { useCallback, useRef, useState } from 'react';

type Status = 'idle' | 'listening' | 'done' | 'unsupported';

interface UseSpeechRecognitionReturn {
  status: Status;
  transcript: string;
  start: () => void;
  stop: () => void;
  reset: () => void;
}

// Use any-cast to avoid browser-specific type issues with Web Speech API
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SpeechRecognitionCtor = new () => any;
const SR: SpeechRecognitionCtor | undefined =
  typeof window !== 'undefined'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? ((window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition)
    : undefined;

export function useSpeechRecognition(): UseSpeechRecognitionReturn {
  const [status,     setStatus]     = useState<Status>(SR ? 'idle' : 'unsupported');
  const [transcript, setTranscript] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognizerRef = useRef<any>(null);
  const stoppedRef    = useRef(false);
  const finalTextRef  = useRef('');

  const stop = useCallback(() => {
    stoppedRef.current = true;
    recognizerRef.current?.stop();
  }, []);

  const reset = useCallback(() => {
    stoppedRef.current   = true;
    finalTextRef.current = '';
    recognizerRef.current?.abort();
    recognizerRef.current = null;
    setTranscript('');
    setStatus('idle');
  }, []);

  const start = useCallback(() => {
    if (!SR) { setStatus('unsupported'); return; }

    stoppedRef.current   = false;
    finalTextRef.current = '';
    setTranscript('');
    setStatus('listening');

    function launch() {
      if (stoppedRef.current) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rec: any = new SR!();
      recognizerRef.current = rec;
      rec.lang           = 'es-ES';
      rec.continuous     = true;
      rec.interimResults = true;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rec.onresult = (event: any) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const chunk = event.results[i][0].transcript as string;
          if (event.results[i].isFinal) {
            finalTextRef.current += chunk + ' ';
          } else {
            interim = chunk;
          }
        }
        setTranscript((finalTextRef.current + interim).trim());
      };

      rec.onend = () => {
        if (stoppedRef.current) {
          setTranscript(finalTextRef.current.trim());
          setStatus('done');
        } else {
          launch();
        }
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rec.onerror = (e: any) => {
        if (e.error === 'aborted') return;
        stoppedRef.current = true;
        setTranscript(finalTextRef.current.trim());
        setStatus('done');
      };

      rec.start();
    }

    launch();
  }, []);

  return { status, transcript, start, stop, reset };
}
