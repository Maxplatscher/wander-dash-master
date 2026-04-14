import { useState } from 'react';
import { DispatchProvider, useDispatch } from '@/lib/dispatch-context';
import { useAuth } from '@/hooks/useAuth';
import { getSectionLabel, SECTIONS, SectionId } from '@/lib/navigation';
import { OperativeLage } from './dispatch/OperativeLage';
import { Kalender } from './dispatch/Kalender';
import { Kontrollzentrale } from './dispatch/Kontrollzentrale';
import { Fahrer } from './dispatch/Fahrer';
import { Einstellungen } from './dispatch/Einstellungen';
import { Probleme } from './dispatch/Probleme';
import {
  CalendarDays, Building, LogOut, Menu, X,
  LayoutDashboard, Calendar, Package, Users, AlertTriangle, Settings
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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
    case 'tagesleitstelle': return <OperativeLage />;
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
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col w-full bg-dashboard">
      {/* Top header */}
      <header className="h-14 flex items-center px-5 bg-[#1a2340] border-b border-[#2a3a5a] sticky top-0 z-20 gap-4 shadow-lg">
        <button
          onClick={() => setDrawerOpen(true)}
          className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors"
        >
          <Menu className="w-5 h-5 text-white" />
        </button>

        <h2 className="font-semibold text-white text-sm">{getSectionLabel(currentSection)}</h2>

        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-blue-200/70">
            <CalendarDays className="w-3.5 h-3.5" />
            <input
              type="date"
              value={selectedDate.toISOString().split('T')[0]}
              onChange={e => setSelectedDate(new Date(e.target.value))}
              className="bg-white/10 text-xs text-white border border-white/20 rounded-lg px-2.5 py-1.5 transition-colors focus:border-blue-400 focus:ring-1 focus:ring-blue-300/30 outline-none"
            />
          </div>

          <Select value={tenant} onValueChange={setTenant}>
            <SelectTrigger className="h-8 w-[130px] text-xs rounded-lg border-white/20 bg-white/10 text-white">
              <Building className="w-3 h-3 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Mandant A">Mandant A</SelectItem>
              <SelectItem value="Mandant B">Mandant B</SelectItem>
              <SelectItem value="Mandant C">Mandant C</SelectItem>
            </SelectContent>
          </Select>

          <span className="text-xs text-blue-200/60 truncate max-w-[150px]">
            {user?.email} ({role ?? '...'})
          </span>
          <Button size="sm" variant="ghost" onClick={signOut} title="Abmelden" className="rounded-lg text-white/70 hover:bg-red-500/20 hover:text-red-300">
            <LogOut className="w-3.5 h-3.5" />
          </Button>
        </div>
      </header>

      {/* Main content — full width */}
      <main className="flex-1 p-6 overflow-y-auto">
        <PageContent />
      </main>

      {/* Slide-in drawer overlay */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />

          {/* Drawer */}
          <div className="relative w-64 bg-white h-full shadow-2xl flex flex-col animate-fade-in">
            <div className="p-4 flex items-center justify-between border-b border-[#F0EEE9]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-400 flex items-center justify-center">
                  <LayoutDashboard className="w-4 h-4 text-white" />
                </div>
                <span className="font-semibold text-sm text-[#1a1a1a]">DispoCenter</span>
              </div>
              <button onClick={() => setDrawerOpen(false)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100">
                <X className="w-4 h-4 text-[#666]" />
              </button>
            </div>

            <nav className="flex-1 py-3 px-3 space-y-1">
              {SECTIONS.map(section => {
                const Icon = sectionIcons[section.id] ?? LayoutDashboard;
                const active = currentSection === section.id;
                return (
                  <button
                    key={section.id}
                    onClick={() => { navigateTo(section.id); setDrawerOpen(false); }}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-all',
                      active
                        ? 'bg-teal-50 text-teal-700 font-medium'
                        : 'text-[#666] hover:bg-gray-50 hover:text-[#1a1a1a]'
                    )}
                  >
                    <Icon className={cn('w-4 h-4', active ? 'text-teal-500' : 'text-[#aaa]')} />
                    <span>{section.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="p-3 border-t border-[#F0EEE9]">
              <p className="text-[10px] text-[#aaa] text-center">DispoCenter · {tenant}</p>
            </div>
          </div>
        </div>
      )}
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
