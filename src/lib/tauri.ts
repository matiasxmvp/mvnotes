import { invoke } from '@tauri-apps/api/core';

/**
 * Typed wrapper around invoke. Always use this — never call invoke() directly.
 * Errors propagate as rejected promises with a string message from Rust.
 */
export async function invokeTyped<T>(
  cmd: string,
  args?: Record<string, unknown>,
): Promise<T> {
  return invoke<T>(cmd, args);
}
