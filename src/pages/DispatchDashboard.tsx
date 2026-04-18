import { useState } from 'react';
import { DispatchProvider, useDispatch } from '@/lib/dispatch-context';
import { useAuth } from '@/hooks/useAuth';
import { getSectionLabel, SECTIONS, SectionId } from '@/lib/navigation';
import { OperativeLage } from './dispatch/OperativeLage';
import { Tagesleitstelle } from './dispatch/Tagesleitstelle';
import { Kalender } from './dispatch/Kalender';
import { Kontrollzentrale } from './dispatch/Kontrollzentrale';
import { Fahrer } from './dispatch/Fahrer';
import { Einstellungen } from './dispatch/Einstellungen';
import { Probleme } from './dispatch/Probleme';
import {
  CalendarDays, Building, LogOut, Menu, X, Search, Bell, Settings as SettingsIcon,
  LayoutDashboard, Calendar, Package, Users, AlertTriangle, Settings
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ParticleBackground } from '@/components/dispatch/ParticleBackground';

const sectionIcons: Record<SectionId, React.ElementType> = {
  'operative-lage': LayoutDashboard,
  'tagesleitstelle': LayoutDashboard,
  'kalender': Calendar,
  'kontrollzentrale': Package,
  'fahrer': Users,
  'probleme': AlertTriangle,
  'einstellungen': Settings,
};

function PageContent() {
  const { currentSection } = useDispatch();

  switch (currentSection) {
    case 'tagesleitstelle': return <Tagesleitstelle />;
    case 'operative-lage': return <OperativeLage />;
    case 'kalender': return <Kalender />;
    case 'kontrollzentrale': return <Kontrollzentrale />;
    case 'fahrer': return <Fahrer />;
    case 'einstellungen': return <Einstellungen />;
    case 'probleme': return <Probleme />;
    default: return <OperativeLage />;
  }
}

function DashboardLayout() {
  const { selectedDate, setSelectedDate, tenant, setTenant, currentSection, navigateTo } = useDispatch();
  const { user, role, signOut } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen flex w-full bg-dashboard relative">
      <ParticleBackground />

      {/* ═══ LEFT SIDEBAR — permanent ═══ */}
      <aside className={cn(
        'h-screen sticky top-0 bg-white border-r border-gray-200 flex flex-col z-10 transition-all duration-300 shrink-0',
        sidebarCollapsed ? 'w-16' : 'w-56'
      )}>
        {/* Logo */}
        <div className="h-14 flex items-center px-4 border-b border-gray-100 gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0">
            <LayoutDashboard className="w-4 h-4 text-white" />
          </div>
          {!sidebarCollapsed && <span className="font-bold text-sm text-gray-800">DispoCenter</span>}
        </div>

        {/* Nav */}
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
                  'w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-xl transition-all',
                  sidebarCollapsed && 'justify-center px-0',
                  active
                    ? 'bg-indigo-50 text-indigo-700 font-semibold'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
                )}
              >
                <Icon className={cn('w-[18px] h-[18px] shrink-0', active ? 'text-indigo-500' : 'text-gray-400')} />
                {!sidebarCollapsed && <span>{section.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="p-3 border-t border-gray-100 space-y-2">
          <button
            onClick={() => setSidebarCollapsed(c => !c)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Menu className="w-4 h-4" />
            {!sidebarCollapsed && <span>Einklappen</span>}
          </button>
          {!sidebarCollapsed && (
            <p className="text-[10px] text-gray-400 text-center">DispoCenter · {tenant}</p>
          )}
        </div>
      </aside>

      {/* ═══ MAIN AREA ═══ */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-14 flex items-center px-6 bg-white/70 backdrop-blur-xl border-b border-gray-200/60 sticky top-0 z-10 gap-4">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Suchen…"
              className="w-full h-9 pl-9 pr-4 text-sm bg-gray-50 border border-gray-200 rounded-xl text-gray-700 placeholder:text-gray-400 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-300/30 transition-colors"
            />
          </div>

          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <CalendarDays className="w-3.5 h-3.5" />
              <input
                type="date"
                value={selectedDate.toISOString().split('T')[0]}
                onChange={e => setSelectedDate(new Date(e.target.value))}
                className="bg-gray-50 text-xs text-gray-700 border border-gray-200 rounded-lg px-2.5 py-1.5 transition-colors focus:border-indigo-400 focus:ring-1 focus:ring-indigo-300/30 outline-none"
              />
            </div>

            <Select value={tenant} onValueChange={setTenant}>
              <SelectTrigger className="h-8 w-[130px] text-xs rounded-lg border-gray-200 bg-gray-50 text-gray-700">
                <Building className="w-3 h-3 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Mandant A">Mandant A</SelectItem>
                <SelectItem value="Mandant B">Mandant B</SelectItem>
                <SelectItem value="Mandant C">Mandant C</SelectItem>
              </SelectContent>
            </Select>

            <button className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors">
              <Bell className="w-4 h-4 text-gray-500" />
            </button>
            <button className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors" onClick={() => navigateTo('einstellungen')}>
              <SettingsIcon className="w-4 h-4 text-gray-500" />
            </button>

            {/* Avatar */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                {user?.email?.charAt(0).toUpperCase() ?? 'U'}
              </div>
              <div className="hidden lg:block">
                <p className="text-xs font-medium text-gray-700 truncate max-w-[120px]">{user?.email?.split('@')[0]}</p>
                <p className="text-[10px] text-gray-400">{role ?? 'Dispatcher'}</p>
              </div>
              <Button size="sm" variant="ghost" onClick={signOut} title="Abmelden" className="rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 h-8 w-8 p-0">
                <LogOut className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6 overflow-y-auto relative">
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
