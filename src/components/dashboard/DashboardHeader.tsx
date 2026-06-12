import { useClock }                              from '@/hooks/useClock';
import { formatDateFull, formatTime, getGreeting } from '@/lib/dateUtils';

export function DashboardHeader(): JSX.Element {
  const now = useClock();

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex flex-col gap-0.5">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground/70">
          {getGreeting(now)}
        </p>
        {/* font-semibold avoids crushing counter shapes at display size */}
        <h1 className="text-2xl font-semibold capitalize leading-tight">
          {formatDateFull(now)}
        </h1>
      </div>

      {/* JetBrains Mono clock — intentional, technical feel */}
      <div className="flex flex-col items-end gap-0.5">
        <p className="font-mono text-3xl font-light tabular-nums tracking-tight text-foreground/80">
          {formatTime(now)}
        </p>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50">
          {now.toLocaleDateString('es-ES', { weekday: 'short' }).toUpperCase()}
        </p>
      </div>
    </div>
  );
}
