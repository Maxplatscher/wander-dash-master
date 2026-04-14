import {
  LayoutDashboard, Activity, Calendar, Settings, AlertTriangle,
  Users, Package, ChevronLeft, ChevronRight, Truck
} from 'lucide-react';
import { useDispatch, UserRole } from '@/lib/dispatch-context';
import { SectionId } from '@/lib/navigation';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useProblems } from '@/pages/dispatch/Probleme';

interface NavItem {
  id: SectionId;
  label: string;
  icon: React.ElementType;
  roles: UserRole[];
}

const navItems: NavItem[] = [
  { id: 'tagesleitstelle', label: 'Startseite', icon: LayoutDashboard, roles: ['admin', 'dispatcher'] },
  { id: 'operative-lage', label: 'Aktuelle Lage', icon: Activity, roles: ['admin', 'dispatcher', 'driver'] },
  { id: 'kalender', label: 'Kalender', icon: Calendar, roles: ['admin', 'dispatcher'] },
  { id: 'kontrollzentrale', label: 'Lieferscheine & mehr', icon: Package, roles: ['admin', 'dispatcher'] },
  { id: 'fahrer', label: 'Fahrer & Fahrzeuge', icon: Users, roles: ['admin', 'dispatcher'] },
  { id: 'probleme', label: 'Probleme', icon: AlertTriangle, roles: ['admin', 'dispatcher'] },
  { id: 'einstellungen', label: 'Einstellungen', icon: Settings, roles: ['admin'] },
];

export function DispatchSidebar() {
  const { currentSection, navigateTo, role, tenant, selectedDate } = useDispatch();
  const [collapsed, setCollapsed] = useState(false);
  const dateStr = selectedDate.toISOString().split('T')[0];
  const { data: problems } = useProblems(dateStr);
  const problemCount = problems?.length ?? 0;

  const visibleItems = navItems.filter(item => item.roles.includes(role));

  return (
    <aside className={cn(
      "h-screen bg-gradient-to-b from-sidebar to-[hsl(215,35%,10%)] text-sidebar-foreground flex flex-col border-r border-sidebar-border transition-all duration-300 shrink-0 sticky top-0",
      collapsed ? "w-16" : "w-60"
    )}>
      {/* Logo */}
      <div className="p-3 flex items-center gap-3 min-h-[56px]">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center shrink-0 shadow-glow">
          <Truck className="w-5 h-5 text-sidebar-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <h1 className="font-semibold text-sm text-sidebar-primary-foreground truncate">DispoCenter</h1>
            <p className="text-[10px] text-sidebar-foreground/50 truncate">{tenant}</p>
          </div>
        )}
      </div>

      {/* Gradient divider */}
      <div className="gradient-divider mx-3" />

      <nav className="flex-1 py-3 overflow-y-auto space-y-0.5 px-2">
        {visibleItems.map(item => {
          const active = currentSection === item.id;
          const badge = item.id === 'probleme' ? problemCount : 0;

          return (
            <button
              key={item.id}
              onClick={() => navigateTo(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-all duration-200",
                active
                  ? "bg-gradient-to-r from-primary/20 to-primary-glow/10 text-sidebar-primary-foreground font-medium shadow-glow border-l-2 border-primary"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground border-l-2 border-transparent"
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className={cn("w-4 h-4 shrink-0 transition-colors", active && "text-primary")} />
              {!collapsed && <span className="truncate">{item.label}</span>}
              {!collapsed && badge > 0 && (
                <span className="ml-auto bg-destructive/90 text-destructive-foreground text-[10px] font-medium px-1.5 py-0.5 rounded-full shadow-sm">
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="gradient-divider mx-3" />

      <button
        onClick={() => setCollapsed(!collapsed)}
        className="p-3 text-sidebar-foreground/50 hover:text-sidebar-foreground flex items-center justify-center transition-colors"
      >
        <div className="w-7 h-7 rounded-full bg-sidebar-accent/50 hover:bg-sidebar-accent flex items-center justify-center transition-colors">
          {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </div>
      </button>
    </aside>
  );
}
