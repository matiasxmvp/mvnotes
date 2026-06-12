import { useEffect } from 'react';
import { usePomodoroStore } from '@/stores/pomodoroStore';

/** Drives the Pomodoro timer tick. Mount once at App level. */
export function usePomodoroInterval(): void {
  const running = usePomodoroStore((s) => s.running);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => usePomodoroStore.getState().tick(), 1000);
    return () => clearInterval(id);
  }, [running]);
}
