import { BookOpen, CalendarDays, LayoutDashboard, PenLine, Settings } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn }       from '@/lib/utils';
import type { View } from '@/types';

interface SidebarProps {
  activeView: View;
  onNavigate: (view: View) => void;
}

interface NavItemProps {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}

const MAIN_NAV = [
  { view: 'dashboard'  as View, label: 'Hoy',    icon: LayoutDashboard },
  { view: 'schedule'   as View, label: 'Semana',  icon: CalendarDays    },
  { view: 'whiteboard' as View, label: 'Pizarra', icon: PenLine         },
  { view: 'notes'      as View, label: 'Notas',   icon: BookOpen        },
] as const;

export function Sidebar({ activeView, onNavigate }: SidebarProps): JSX.Element {
  return (
    <aside
      className={cn(
        'relative flex h-screen w-[200px] shrink-0 flex-col',
        'border-r border-border/60 bg-card',
      )}
    >
      {/* Subtle inner-right glow */}
      <div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-primary/20 via-transparent to-primary/10" />

      {/* Brand */}
      <div className="flex items-center gap-2.5 px-4 pb-6 pt-5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/15">
          <span className="text-xs font-bold tracking-tight text-primary">MV</span>
        </div>
        <div>
          <p className="text-sm font-semibold leading-none tracking-tight">MVNOTES</p>
          <p className="mt-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
            notes
          </p>
        </div>
      </div>

      {/* Label */}
      <p className="mb-1.5 px-4 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
        Vistas
      </p>

      {/* Main navigation */}
      <nav aria-label="Navegación principal" className="flex flex-col gap-0.5 px-2">
        {MAIN_NAV.map(({ view, label, icon: Icon }) => (
          <NavItem
            key={view}
            label={label}
            icon={<Icon className="h-[15px] w-[15px]" aria-hidden />}
            active={activeView === view}
            onClick={() => onNavigate(view)}
          />
        ))}
      </nav>

      {/* Settings pinned bottom */}
      <div className="mt-auto border-t border-border/60 px-2 py-3">
        <NavItem
          label="Configuración"
          icon={<Settings className="h-[15px] w-[15px]" aria-hidden />}
          active={activeView === 'settings'}
          onClick={() => onNavigate('settings')}
        />
      </div>
    </aside>
  );
}

function NavItem({ label, icon, active, onClick }: NavItemProps): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group relative flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm',
        'transition-all duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active
          ? 'font-medium text-primary'
          : 'font-normal text-muted-foreground hover:text-foreground',
      )}
    >
      {active && (
        <motion.span
          layoutId="nav-active-bg"
          className="absolute inset-0 rounded-lg bg-primary/8"
          transition={{ type: 'spring', stiffness: 500, damping: 40 }}
        />
      )}
      {active && (
        <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r-full bg-primary" />
      )}
      <span className="relative z-10 flex items-center gap-2.5">
        {icon}
        {label}
      </span>
    </button>
  );
}
