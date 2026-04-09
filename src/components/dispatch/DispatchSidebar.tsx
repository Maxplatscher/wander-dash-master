import {
  LayoutDashboard, Activity, Calendar, Settings, AlertTriangle,
  Users, GitBranch, Radio, ChevronLeft, ChevronRight, Truck
} from 'lucide-react';
import { useDispatch, UserRole } from '@/lib/dispatch-context';
import { SectionId } from '@/lib/navigation';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface NavItem {
  id: SectionId;
  label: string;
  icon: React.ElementType;
  roles: UserRole[];
  badge?: number;
}

const navItems: NavItem[] = [
  { id: 'tagesleitstelle', label: 'Tagesleitstelle', icon: LayoutDashboard, roles: ['admin', 'dispatcher'] },
  { id: 'operative-lage', label: 'Operative Lage', icon: Activity, roles: ['admin', 'dispatcher', 'driver'] },
  { id: 'kalender', label: 'Kalender', icon: Calendar, roles: ['admin', 'dispatcher'] },
  { id: 'kontrollzentrale', label: 'Kontrollzentrale', icon: Radio, roles: ['admin', 'dispatcher'] },
  { id: 'versionen', label: 'Versionen & Freigabe', icon: GitBranch, roles: ['admin', 'dispatcher'] },
  { id: 'fahrer', label: 'Fahrer & Fahrzeuge', icon: Users, roles: ['admin', 'dispatcher'] },
  { id: 'probleme', label: 'Probleme', icon: AlertTriangle, roles: ['admin', 'dispatcher'], badge: 3 },
  { id: 'einstellungen', label: 'Einstellungen', icon: Settings, roles: ['admin'] },
];

export function DispatchSidebar() {
  const { currentSection, navigateTo, role, tenant } = useDispatch();
  const [collapsed, setCollapsed] = useState(false);

  const visibleItems = navItems.filter(item => item.roles.includes(role));

  return (
    <aside className={cn(
      "h-screen bg-sidebar text-sidebar-foreground flex flex-col border-r border-sidebar-border transition-all duration-200 shrink-0",
      collapsed ? "w-16" : "w-60"
    )}>
      {/* Header */}
      <div className="p-3 flex items-center gap-3 border-b border-sidebar-border min-h-[56px]">
        <div className="w-9 h-9 rounded-lg bg-sidebar-primary flex items-center justify-center shrink-0">
          <Truck className="w-5 h-5 text-sidebar-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <h1 className="font-semibold text-sm text-sidebar-primary-foreground truncate">DispoCenter</h1>
            <p className="text-[10px] text-sidebar-foreground/50 truncate">{tenant}</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-2 overflow-y-auto">
        {visibleItems.map(item => {
          const active = currentSection === item.id;
          return (
            <button
              key={item.id}
              onClick={() => navigateTo(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-primary-foreground font-medium"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
              {!collapsed && item.badge && (
                <span className="ml-auto bg-destructive text-destructive-foreground text-[10px] font-medium px-1.5 py-0.5 rounded-full">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="p-3 border-t border-sidebar-border text-sidebar-foreground/50 hover:text-sidebar-foreground flex items-center justify-center"
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
    </aside>
  );
}
