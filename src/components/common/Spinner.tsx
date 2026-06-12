import { cn } from '@/lib/utils';

interface SpinnerProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE = {
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-2',
  lg: 'h-10 w-10 border-[3px]',
} as const;

export function Spinner({ className, size = 'md' }: SpinnerProps): JSX.Element {
  return (
    <div
      role="status"
      aria-label="Cargando"
      className={cn(
        'animate-spin rounded-full border-transparent border-t-foreground',
        SIZE[size],
        className,
      )}
    />
  );
}
