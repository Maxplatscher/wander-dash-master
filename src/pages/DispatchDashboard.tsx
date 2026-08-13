import { useState } from 'react';
import { DispatchProvider, useDispatch } from '@/lib/dispatch-context';
import { useAuth } from '@/hooks/useAuth';
import { SECTIONS, SectionId } from '@/lib/navigation';
import { Startseite } from './dispatch/Startseite';
import { Kalender } from './dispatch/Kalender';
import { Kontrollzentrale } from './dispatch/Kontrollzentrale';
import { Fahrer } from './dispatch/Fahrer';
import { Einstellungen } from './dispatch/Einstellungen';
import { Probleme } from './dispatch/Probleme';
import {
  CalendarDays, LogOut, Menu, Search, Bell, Settings as SettingsIcon,
  LayoutDashboard, Calendar, Package, Users, AlertTriangle, Settings, Home
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ParticleBackground } from '@/components/dispatch/ParticleBackground';
import { DepotSwitcher } from '@/components/dispatch/DepotSwitcher';

const sectionIcons: Record<SectionId, React.ElementType> = {
  startseite: Home,
  kalender: Calendar,
  kontrollzentrale: Package,
  fahrer: Users,
  probleme: AlertTriangle,
  einstellungen: Settings,
};

function PageContent() {
  const { currentSection } = useDispatch();

  switch (currentSection) {
    case 'startseite': return <Startseite />;
    case 'kalender': return <Kalender />;
    case 'kontrollzentrale': return <Kontrollzentrale />;
    case 'fahrer': return <Fahrer />;
    case 'einstellungen': return <Einstellungen />;
    case 'probleme': return <Probleme />;
    default: return <Startseite />;
  }
}

function DashboardLayout() {
  const { selectedDate, setSelectedDate, selectedDepotLabel, currentSection, navigateTo } = useDispatch();
  const { user, role, signOut } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen flex w-full bg-dashboard relative">
      <ParticleBackground />

      <aside
        className={cn(
          'h-[calc(100vh-2rem)] sticky top-4 ml-4 my-4 flex flex-col z-10 transition-all duration-300 shrink-0 rounded-[24px] border border-white/10 overflow-hidden',
          sidebarCollapsed ? 'w-16' : 'w-56'
        )}
        style={{
          background: 'hsl(var(--bg-elevated) / 0.92)',
          backdropFilter: 'blur(20px) saturate(140%)',
          WebkitBackdropFilter: 'blur(20px) saturate(140%)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.05)',
        }}
      >
        <div className="h-14 flex items-center px-4 gap-2 border-b border-white/10">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center shrink-0 shadow-glow">
            <LayoutDashboard className="w-4 h-4 text-primary-foreground" />
          </div>
          {!sidebarCollapsed && <span className="font-bold text-sm text-foreground">DispoCenter</span>}
        </div>

        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
          {SECTIONS.map(section => {
            const Icon = sectionIcons[section.id] ?? LayoutDashboard;
            const active = currentSection === section.id;
            return (
              <button
                key={section.id}
                onClick={() => navigateTo(section.id)}
                title={section.label}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-xl transition-all border border-transparent',
                  sidebarCollapsed && 'justify-center px-0',
                  active
                    ? 'bg-primary/15 text-foreground font-semibold border-primary/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]'
                    : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
                )}
              >
                <Icon className={cn('w-[18px] h-[18px] shrink-0', active ? 'text-primary' : 'text-muted-foreground')} />
                {!sidebarCollapsed && <span>{section.label}</span>}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-white/10 space-y-2">
          <button
            onClick={() => setSidebarCollapsed(c => !c)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground rounded-lg hover:bg-white/5 transition-colors"
          >
            <Menu className="w-4 h-4" />
            {!sidebarCollapsed && <span>Einklappen</span>}
          </button>
          {!sidebarCollapsed && (
            <p className="text-[10px] text-muted-foreground text-center truncate px-1" title={selectedDepotLabel}>
              DispoCenter · {selectedDepotLabel}
            </p>
          )}
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 p-4 gap-4">
        <header
          className="hover-lift p-5 flex items-center sticky top-4 z-10 gap-4 rounded-[24px] border border-white/10"
          style={{
            background: 'hsl(var(--bg-elevated) / 0.92)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.05)',
          }}
        >
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Suchen…"
              className="w-full h-9 pl-9 pr-4 text-sm bg-white/5 border border-white/10 rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-colors"
            />
          </div>

          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarDays className="w-3.5 h-3.5" />
              <input
                type="date"
                value={selectedDate.toISOString().split('T')[0]}
                onChange={e => setSelectedDate(new Date(e.target.value))}
                className="bg-white/5 text-xs text-foreground border border-white/10 rounded-lg px-2.5 py-1.5 transition-colors focus:border-primary/50 focus:ring-1 focus:ring-primary/30 outline-none [color-scheme:dark]"
              />
            </div>

            <DepotSwitcher />

            <button className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors">
              <Bell className="w-4 h-4 text-muted-foreground" />
            </button>
            <button className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" onClick={() => navigateTo('einstellungen')}>
              <SettingsIcon className="w-4 h-4 text-muted-foreground" />
            </button>

            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center text-primary-foreground text-xs font-bold">
                {user?.email?.charAt(0).toUpperCase() ?? 'U'}
              </div>
              <div className="hidden lg:block">
                <p className="text-xs font-medium text-foreground truncate max-w-[120px]">{user?.email?.split('@')[0]}</p>
                <p className="text-[10px] text-muted-foreground">{role ?? 'Dispatcher'}</p>
              </div>
              <Button size="sm" variant="ghost" onClick={signOut} title="Abmelden" className="rounded-lg text-muted-foreground hover:bg-destructive/15 hover:text-destructive h-8 w-8 p-0">
                <LogOut className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto relative">
          <PageContent />
        </main>
      </div>
    </div>
  );
}

export default function DispatchDashboard() {
  return (
    <DispatchProvider>
      <DashboardLayout />
    </DispatchProvider>
  );
}
