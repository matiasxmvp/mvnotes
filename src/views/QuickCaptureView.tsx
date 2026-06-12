import { useCallback, useEffect, useState } from 'react';

import { getCurrentWindow } from '@tauri-apps/api/window';

import { VoiceModal } from '@/components/dashboard/VoiceModal';
import { useSettingsStore } from '@/stores/settingsStore';

/**
 * Standalone content for the hidden "quick" window (Ctrl+Alt+N).
 * Renders VoiceModal permanently open; closing it hides the window.
 * Re-mounts the modal each time the window regains focus so every capture
 * starts with a fresh recording session.
 */
export default function QuickCaptureView(): JSX.Element {
  const { settings, fetchSettings } = useSettingsStore();
  const [session, setSession] = useState(0);
  // Modal mounts only while the window is in use — otherwise the mic would
  // start recording in the hidden window at app boot.
  const [active, setActive] = useState(false);

  useEffect(() => {
    void fetchSettings();
  }, [fetchSettings]);

  // Theme must be applied locally — this window has its own DOM.
  useEffect(() => {
    const dark =
      settings.theme === 'dark' ||
      (settings.theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
  }, [settings.theme]);

  // New capture session every time the window is shown/focused.
  useEffect(() => {
    const win = getCurrentWindow();
    let cancel: (() => void) | undefined;
    void win.onFocusChanged(({ payload: focused }) => {
      if (focused) {
        setSession((s) => s + 1);
        setActive(true);
      }
    }).then((unlisten) => {
      cancel = unlisten;
    });
    return () => cancel?.();
  }, []);

  const handleClose = useCallback(() => {
    setActive(false); // unmounts VoiceModal → its cleanup stops the mic
    void getCurrentWindow().hide();
  }, []);

  return (
    <div className="h-screen w-screen bg-background text-foreground">
      {active && <VoiceModal key={session} open onClose={handleClose} />}
    </div>
  );
}
