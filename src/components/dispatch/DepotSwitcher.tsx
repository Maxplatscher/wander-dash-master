import { Building2, Loader2, MapPin } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDispatch } from '@/lib/dispatch-context';
import { ALL_DEPOTS_VALUE, depotLabel } from '@/lib/depot';
import { cn } from '@/lib/utils';

type DepotSwitcherProps = {
  className?: string;
  /** Kompakte Variante für Topbar */
  compact?: boolean;
};

export function DepotSwitcher({ className, compact = true }: DepotSwitcherProps) {
  const {
    depots,
    depotsLoading,
    selectedDepotId,
    setSelectedDepotId,
    selectedDepotLabel,
  } = useDispatch();

  const value = selectedDepotId ?? ALL_DEPOTS_VALUE;

  return (
    <Select
      value={value}
      onValueChange={(next) => setSelectedDepotId(next === ALL_DEPOTS_VALUE ? null : next)}
      disabled={depotsLoading}
    >
      <SelectTrigger
        className={cn(
          compact
            ? 'h-8 min-w-[150px] max-w-[220px] text-xs rounded-lg border-white/10 bg-white/5 text-foreground'
            : 'h-10 w-full',
          className,
        )}
        title={selectedDepotLabel}
      >
        {depotsLoading ? (
          <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin shrink-0" />
        ) : (
          <Building2 className="w-3.5 h-3.5 mr-1.5 shrink-0 text-muted-foreground" />
        )}
        <SelectValue placeholder="Depot wählen" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_DEPOTS_VALUE}>
          <span className="flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
            Alle Depots
          </span>
        </SelectItem>
        {depots.map((depot) => (
          <SelectItem key={depot.id} value={depot.id}>
            <span className="flex flex-col items-start leading-tight">
              <span>{depotLabel(depot)}</span>
              {depot.city && (
                <span className="text-[10px] text-muted-foreground">{depot.city}</span>
              )}
            </span>
          </SelectItem>
        ))}
        {!depotsLoading && depots.length === 0 && (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">
            Keine Depots vorhanden
          </div>
        )}
      </SelectContent>
    </Select>
  );
}
