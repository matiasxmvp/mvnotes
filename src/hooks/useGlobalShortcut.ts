import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';

/**
 * Subscribes to the 'global-shortcut' event emitted by Rust and calls
 * `handler` when `shortcut` matches.
 *
 * Shortcut format must match what Rust emits, e.g. "ctrl+n".
 */
export function useGlobalShortcut(shortcut: string, handler: () => void): void {
  useEffect(() => {
    let cancel: (() => void) | undefined;

    listen<string>('global-shortcut', (event) => {
      if (event.payload.toLowerCase() === shortcut.toLowerCase()) {
        handler();
      }
    }).then((unlisten) => {
      cancel = unlisten;
    });

    return () => cancel?.();
  }, [shortcut, handler]);
}
