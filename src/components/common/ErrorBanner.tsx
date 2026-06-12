import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ErrorBannerProps {
  message: string;
  className?: string;
}

export function ErrorBanner({ message, className }: ErrorBannerProps): JSX.Element {
  return (
    <div
      role="alert"
      className={cn(
        'flex items-center gap-2 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400',
        className,
      )}
    >
      <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
      <span>{message}</span>
    </div>
  );
}
