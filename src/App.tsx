import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { esES } from '@mui/x-scheduler/locales';

import { Sidebar }           from '@/components/common/Sidebar';
import { useTaskReminders }    from '@/hooks/useTaskReminders';
import { usePomodoroInterval }  from '@/hooks/usePomodoroInterval';
import { useNavStore }       from '@/stores/navStore';
import { useSettingsStore }  from '@/stores/settingsStore';
import { useWhiteboardStore } from '@/stores/whiteboardStore';
import type { View }         from '@/types';

import DashboardView  from '@/views/DashboardView';
import NotesView      from '@/views/NotesView';
import ScheduleView   from '@/views/ScheduleView';
import WhiteboardView from '@/views/WhiteboardView';
import SettingsView   from '@/views/SettingsView';

const VIEW_TRANSITION = {
  initial:    { opacity: 0, x: -8 },
  animate:    { opacity: 1, x: 0  },
  exit:       { opacity: 0, x:  8 },
  transition: { duration: 0.18, ease: 'easeInOut' as const },
};

function renderView(view: View): JSX.Element {
  switch (view) {
    case 'dashboard':  return <DashboardView />;
    case 'schedule':   return <ScheduleView />;
    case 'whiteboard': return <WhiteboardView />;
    case 'notes':      return <NotesView />;
    case 'settings':   return <SettingsView />;
  }
}

export default function App(): JSX.Element {
  const activeView    = useNavStore((s) => s.activeView);
  const setActiveView = useNavStore((s) => s.setView);
  const [ready, setReady]           = useState(false);
  const { settings, fetchSettings } = useSettingsStore();
  const fetchWhiteboards            = useWhiteboardStore((s) => s.fetchWhiteboards);
  useTaskReminders();    // startTime + end-of-day reminders
  usePomodoroInterval(); // drives the Pomodoro tick from a single global interval

  // Load settings before showing the app (theme must be applied first).
  // Fallback: if IPC hangs >5 s, show app anyway with defaults.
  useEffect(() => {
    const fallback = setTimeout(() => setReady(true), 5000);
    void fetchSettings().finally(() => {
      clearTimeout(fallback);
      setReady(true);
    });
    return () => clearTimeout(fallback);
  }, [fetchSettings]);

  // Pre-fetch whiteboards so TaskItem can detect links without waiting.
  useEffect(() => {
    void fetchWhiteboards();
  }, [fetchWhiteboards]);

  // Sync theme class to <html> element whenever settings change.
  useEffect(() => {
    const root = document.documentElement;
    const { theme } = settings;

    if (theme === 'auto') {
      const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', dark);
    } else {
      root.classList.toggle('dark', theme === 'dark');
    }
  }, [settings.theme]);

  const isDark = settings.theme === 'dark' ||
    (settings.theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const muiTheme = useMemo(
    () => createTheme(
      {
        palette: {
          mode: isDark ? 'dark' : 'light',
          error: { main: '#f87171', light: '#fca5a5', dark: '#dc2626', contrastText: '#ffffff' },
        },
      },
      esES,
    ),
    [isDark],
  );

  if (!ready) return (
    <AnimatePresence>
      <SplashScreen key="splash" />
    </AnimatePresence>
  );

  return (
    <ThemeProvider theme={muiTheme}>
      <div className="grain flex h-screen overflow-hidden bg-background text-foreground">
        <Sidebar activeView={activeView} onNavigate={setActiveView} />

        <main className="relative flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeView}
              className="absolute inset-0"
              {...VIEW_TRANSITION}
            >
              {renderView(activeView)}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </ThemeProvider>
  );
}

function SplashScreen(): JSX.Element {
  return (
    <motion.div
      className="flex h-screen flex-col items-center justify-center gap-8"
      style={{ background: '#09090b' }}
      exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.25 } }}
    >
      {/* Spinner ring */}
      <div className="relative flex items-center justify-center">
        <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
          <circle cx="36" cy="36" r="32" stroke="#27272a" strokeWidth="3" />
          <motion.circle
            cx="36" cy="36" r="32"
            stroke="#a78bfa"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="52 149"
            animate={{ rotate: ['-90deg', '270deg'] }}
            transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}
            style={{ transformOrigin: '36px 36px' }}
          />
        </svg>
        <div className="absolute">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
            <path d="m15 5 4 4" />
          </svg>
        </div>
      </div>

      {/* Name + dots */}
      <div className="flex flex-col items-center gap-3">
        <span style={{ color: '#fafafa', fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
          MVNOTES
        </span>
        <div className="flex items-center gap-2">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              style={{ width: 6, height: 6, borderRadius: '50%', background: '#a78bfa' }}
              animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.2, 0.8] }}
              transition={{ duration: 1.2, delay: i * 0.2, repeat: Infinity, ease: 'easeInOut' }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}
