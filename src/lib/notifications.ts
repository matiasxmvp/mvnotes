import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';

import { invokeTyped } from '@/lib/tauri';

// Cached permission state — avoid re-requesting on every call.
let _granted: boolean | null = null;

async function ensurePermission(): Promise<boolean> {
  if (_granted !== null) return _granted;
  _granted = await isPermissionGranted();
  if (!_granted) {
    const result = await requestPermission();
    _granted = result === 'granted';
  }
  return _granted;
}

export async function notify(title: string, body?: string): Promise<void> {
  if (!(await ensurePermission())) return;
  sendNotification({ title, body });
  void invokeTyped<void>('play_notification_sound');
}
