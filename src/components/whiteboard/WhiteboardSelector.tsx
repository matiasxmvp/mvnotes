import { Check, ChevronDown, PenLine, Plus } from 'lucide-react';

import { Button }                                       from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn }                                           from '@/lib/utils';
import type { Whiteboard }                              from '@/types';

interface WhiteboardSelectorProps {
  whiteboards: Whiteboard[];
  activeId: string | null;
  isLoading: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
}

export function WhiteboardSelector({
  whiteboards,
  activeId,
  isLoading,
  onSelect,
  onNew,
}: WhiteboardSelectorProps): JSX.Element {
  const activeName =
    whiteboards.find((wb) => wb.id === activeId)?.name ?? 'Sin pizarra';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2" disabled={isLoading}>
          <PenLine className="h-4 w-4 shrink-0" aria-hidden />
          <span className="max-w-[200px] truncate">{activeName}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="z-[9999] w-60">
        {whiteboards.length === 0 && (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">
            Sin pizarras guardadas
          </div>
        )}

        {whiteboards.map((wb) => (
          <DropdownMenuItem
            key={wb.id}
            onClick={() => onSelect(wb.id)}
            className="gap-2"
          >
            <Check
              className={cn('h-4 w-4 shrink-0', wb.id === activeId ? 'opacity-100' : 'opacity-0')}
              aria-hidden
            />
            <span className="truncate">{wb.name}</span>
          </DropdownMenuItem>
        ))}

        {whiteboards.length > 0 && <DropdownMenuSeparator />}

        <DropdownMenuItem onClick={onNew} className="gap-2">
          <Plus className="h-4 w-4 shrink-0" aria-hidden />
          Nueva pizarra
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
