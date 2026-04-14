import { DispatchProvider, useDispatch } from '@/lib/dispatch-context';
import { useAuth } from '@/hooks/useAuth';
import { DispatchSidebar } from '@/components/dispatch/DispatchSidebar';
import { getSectionLabel } from '@/lib/navigation';
import { Tagesleitstelle } from './dispatch/Tagesleitstelle';
import { OperativeLage } from './dispatch/OperativeLage';
import { Kalender } from './dispatch/Kalender';
import { Kontrollzentrale } from './dispatch/Kontrollzentrale';
import { Fahrer } from './dispatch/Fahrer';
import { Einstellungen } from './dispatch/Einstellungen';
import { Probleme } from './dispatch/Probleme';
import { CalendarDays, Building, LogOut } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

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

function ContextBar() {
  const { selectedDate, setSelectedDate, tenant, setTenant, currentSection } = useDispatch();
  const { user, role, signOut } = useAuth();

  return (
    <header className="h-14 flex items-center px-5 glass-strong sticky top-0 z-10 gap-4 shadow-[0_1px_3px_0_rgb(0,0,0,0.04)]">
      <h2 className="font-semibold text-foreground text-sm">{getSectionLabel(currentSection)}</h2>

      <div className="ml-auto flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarDays className="w-3.5 h-3.5" />
          <input
            type="date"
            value={selectedDate.toISOString().split('T')[0]}
            onChange={e => setSelectedDate(new Date(e.target.value))}
            className="bg-card/50 text-xs text-foreground border border-border/60 rounded-lg px-2.5 py-1.5 transition-colors focus:border-primary/40 focus:ring-1 focus:ring-primary/20 outline-none"
          />
        </div>

        <Select value={tenant} onValueChange={setTenant}>
          <SelectTrigger className="h-8 w-[130px] text-xs rounded-lg border-border/60 bg-card/50">
            <Building className="w-3 h-3 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Mandant A">Mandant A</SelectItem>
            <SelectItem value="Mandant B">Mandant B</SelectItem>
            <SelectItem value="Mandant C">Mandant C</SelectItem>
          </SelectContent>
        </Select>

        <span className="text-xs text-muted-foreground truncate max-w-[150px]">
          {user?.email} ({role ?? '...'})
        </span>
        <Button size="sm" variant="ghost" onClick={signOut} title="Abmelden" className="rounded-lg hover:bg-destructive/10 hover:text-destructive">
          <LogOut className="w-3.5 h-3.5" />
        </Button>
      </div>
    </header>
  );
}

function DashboardLayout() {
  return (
    <div className="min-h-screen flex w-full bg-background">
      <DispatchSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <ContextBar />
        <main className="flex-1 p-6 overflow-y-auto">
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
