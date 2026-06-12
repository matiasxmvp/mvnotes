import { useCallback, useEffect, useState } from 'react';

export interface MicDevice {
  deviceId: string;
  label: string;
}

export function useMicDevices(): {
  devices: MicDevice[];
  refresh: () => Promise<void>;
} {
  const [devices, setDevices] = useState<MicDevice[]>([]);

  const refresh = useCallback(async () => {
    try {
      // Need to request mic permission first so labels are populated
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());

      const all = await navigator.mediaDevices.enumerateDevices();
      const mics = all
        .filter((d) => d.kind === 'audioinput')
        .map((d, i) => ({
          deviceId: d.deviceId,
          label: d.label || `Micrófono ${i + 1}`,
        }));
      setDevices(mics);
    } catch {
      setDevices([]);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { devices, refresh };
}
