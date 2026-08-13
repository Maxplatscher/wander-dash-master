import { useCallback, useEffect, useRef, useState } from 'react';
import { Building2, Loader2, Sparkles } from 'lucide-react';
import { useJsApiLoader } from '@react-google-maps/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { getGoogleMapsApiKey, GOOGLE_MAPS_LIBRARIES, GOOGLE_MAPS_LOADER_ID } from '@/lib/google-maps';
import {
  CompanyStepData,
  INDUSTRY_LABELS,
  OnboardingIndustry,
  PlaceSuggestion,
  parseAddressComponents,
} from '@/lib/onboarding';
import { toast } from 'sonner';

const GOOGLE_MAPS_API_KEY = getGoogleMapsApiKey();

type StepCompanyProps = {
  value: CompanyStepData;
  onChange: (next: CompanyStepData) => void;
  onContinue: (saved: CompanyStepData) => void;
};

export function StepCompany({ value, onChange, onContinue }: StepCompanyProps) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: GOOGLE_MAPS_LOADER_ID,
    googleMapsApiKey: GOOGLE_MAPS_API_KEY || '',
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const [query, setQuery] = useState(value.companyName);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const blurTimer = useRef<number | null>(null);
  const placesDivRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setQuery(value.companyName);
  }, [value.companyName]);

  useEffect(() => {
    return () => {
      if (blurTimer.current) window.clearTimeout(blurTimer.current);
    };
  }, []);

  const fetchSuggestions = useCallback(
    (input: string) => {
      if (!isLoaded || !input.trim() || input.trim().length < 2) {
        setSuggestions([]);
        return;
      }
      if (!window.google?.maps?.places) {
        setSuggestions([]);
        return;
      }

      setSearching(true);
      const service = new google.maps.places.AutocompleteService();
      service.getPlacePredictions(
        {
          input: input.trim(),
          types: ['establishment'],
          componentRestrictions: { country: 'de' },
        },
        (predictions, status) => {
          setSearching(false);
          if (status !== google.maps.places.PlacesServiceStatus.OK || !predictions) {
            setSuggestions([]);
            return;
          }
          setSuggestions(
            predictions.slice(0, 6).map((p) => ({
              placeId: p.place_id,
              primaryText: p.structured_formatting?.main_text ?? p.description,
              secondaryText: p.structured_formatting?.secondary_text ?? '',
            })),
          );
          setOpen(true);
        },
      );
    },
    [isLoaded],
  );

  useEffect(() => {
    const t = window.setTimeout(() => fetchSuggestions(query), 280);
    return () => window.clearTimeout(t);
  }, [query, fetchSuggestions]);

  const applyPlace = (placeId: string, fallbackName: string) => {
    if (!isLoaded || !window.google?.maps?.places) return;
    setDetailsLoading(true);
    setOpen(false);

    if (!placesDivRef.current) {
      placesDivRef.current = document.createElement('div');
    }
    const service = new google.maps.places.PlacesService(placesDivRef.current);
    service.getDetails(
      {
        placeId,
        fields: ['name', 'formatted_address', 'address_components', 'geometry', 'place_id'],
      },
      (place, status) => {
        setDetailsLoading(false);
        if (status !== google.maps.places.PlacesServiceStatus.OK || !place) {
          toast.error('Ortsdetails konnten nicht geladen werden.');
          return;
        }

        const parsed = parseAddressComponents(place.address_components);
        const name = place.name || fallbackName;
        const lat = place.geometry?.location?.lat() ?? null;
        const lng = place.geometry?.location?.lng() ?? null;

        onChange({
          ...value,
          companyName: name,
          address: parsed.address || place.formatted_address || value.address,
          postalCode: parsed.postalCode || value.postalCode,
          city: parsed.city || value.city,
          country: parsed.country || value.country || 'DE',
          placeId: place.place_id ?? placeId,
          lat,
          lng,
        });
        setQuery(name);
        setSuggestions([]);
      },
    );
  };

  const patch = (partial: Partial<CompanyStepData>) => {
    onChange({ ...value, ...partial });
  };

  const canContinue =
    value.companyName.trim().length > 1 &&
    value.industry !== '' &&
    value.address.trim().length > 0 &&
    value.postalCode.trim().length > 0 &&
    value.city.trim().length > 0;

  const handleContinue = async () => {
    if (!canContinue || saving) return;
    setSaving(true);

    try {
      const { data: companyId, error: cidError } = await supabase.rpc('get_user_company_id');
      if (cidError || !companyId) {
        throw new Error(
          cidError?.message ??
            'Keine company_id gefunden. Bitte erneut anmelden oder Admin-Setup prüfen.',
        );
      }

      // Bestehende Company umbenennen (Nutzer hängt nach Sign-up oft an „Standard“)
      const { error: companyError } = await supabase
        .from('company')
        .update({ name: value.companyName.trim() })
        .eq('id', companyId);

      if (companyError) {
        throw new Error(
          `Unternehmen konnte nicht gespeichert werden (${companyError.message}). ` +
            'Vermutlich fehlt eine UPDATE-Policy auf company — bitte Rücksprache für RPC/Migration.',
        );
      }

      const depotName = `${value.companyName.trim()} – Hauptlager`;
      const depotPayload = {
        company_id: companyId as string,
        name: depotName,
        code: 'HQ',
        address: value.address.trim(),
        city: value.city.trim(),
        postal_code: value.postalCode.trim(),
        country: value.country.trim() || 'DE',
        timezone: 'Europe/Berlin',
        is_active: true,
        lat: value.lat,
        lng: value.lng,
        metadata: {
          industry: value.industry,
          place_id: value.placeId,
          source: 'onboarding',
        },
      };

      let depotId = value.depotId;
      if (depotId) {
        const { error: depotUpdateError } = await supabase
          .from('depot')
          .update(depotPayload)
          .eq('id', depotId)
          .eq('company_id', companyId);
        if (depotUpdateError) throw new Error(depotUpdateError.message);
      } else {
        const { data: existing } = await supabase
          .from('depot')
          .select('id')
          .eq('company_id', companyId)
          .eq('code', 'HQ')
          .maybeSingle();

        if (existing?.id) {
          depotId = existing.id;
          const { error: depotUpdateError } = await supabase
            .from('depot')
            .update(depotPayload)
            .eq('id', depotId);
          if (depotUpdateError) throw new Error(depotUpdateError.message);
        } else {
          const { data: inserted, error: depotInsertError } = await supabase
            .from('depot')
            .insert(depotPayload)
            .select('id')
            .single();
          if (depotInsertError) throw new Error(depotInsertError.message);
          depotId = inserted.id;
        }
      }

      const saved: CompanyStepData = {
        ...value,
        companyId: companyId as string,
        depotId: depotId ?? null,
      };
      onChange(saved);
      toast.success('Unternehmen gespeichert');
      onContinue(saved);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Speichern fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">Unternehmen</h2>
        <p className="text-sm text-muted-foreground">
          Firmenname suchen und Adresse übernehmen — Felder danach frei editierbar.
        </p>
      </div>

      {loadError && (
        <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-3 py-2">
          Google Maps konnte nicht geladen werden. Places API für den Key aktivieren und
          VITE_GOOGLE_MAPS_API_KEY prüfen.
        </p>
      )}

      <div className="space-y-2 relative">
        <Label htmlFor="company-name">Firmenname</Label>
        <div className="relative">
          <Input
            id="company-name"
            value={query}
            autoComplete="off"
            placeholder="Firma suchen…"
            disabled={!isLoaded && !loadError}
            className="bg-white/5 border-white/10 rounded-xl pr-10"
            onChange={(e) => {
              const next = e.target.value;
              setQuery(next);
              patch({ companyName: next, placeId: null });
            }}
            onFocus={() => {
              if (suggestions.length) setOpen(true);
            }}
            onBlur={() => {
              blurTimer.current = window.setTimeout(() => setOpen(false), 160);
            }}
          />
          {(searching || detailsLoading) && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
          )}
        </div>

        {open && suggestions.length > 0 && (
          <ul
            className="absolute z-20 mt-1 w-full rounded-2xl border border-white/10 overflow-hidden"
            style={{
              background: 'hsl(var(--bg-elevated) / 0.98)',
              backdropFilter: 'blur(16px)',
            }}
          >
            {suggestions.map((s) => (
              <li key={s.placeId}>
                <button
                  type="button"
                  className="w-full text-left px-3 py-2.5 flex items-start gap-3 hover:bg-white/5 transition-colors"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyPlace(s.placeId, s.primaryText)}
                >
                  <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                    <Building2 className="w-4 h-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground truncate">{s.primaryText}</span>
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-primary bg-primary/10 border border-primary/20 rounded-full px-1.5 py-0.5 shrink-0">
                        <Sparkles className="w-2.5 h-2.5" />
                        KI
                      </span>
                    </div>
                    {s.secondaryText && (
                      <p className="text-xs text-muted-foreground truncate">{s.secondaryText}</p>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-2">
        <Label>Branche</Label>
        <Select
          value={value.industry || undefined}
          onValueChange={(v) => patch({ industry: v as OnboardingIndustry })}
        >
          <SelectTrigger className="bg-white/5 border-white/10 rounded-xl">
            <SelectValue placeholder="Branche wählen" />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(INDUSTRY_LABELS) as OnboardingIndustry[]).map((key) => (
              <SelectItem key={key} value={key}>
                {INDUSTRY_LABELS[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">Adresse</Label>
        <Input
          id="address"
          value={value.address}
          onChange={(e) => patch({ address: e.target.value })}
          placeholder="Straße und Hausnummer"
          className="bg-white/5 border-white/10 rounded-xl"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="postal">PLZ</Label>
          <Input
            id="postal"
            value={value.postalCode}
            onChange={(e) => patch({ postalCode: e.target.value })}
            placeholder="80331"
            className="bg-white/5 border-white/10 rounded-xl"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="city">Stadt</Label>
          <Input
            id="city"
            value={value.city}
            onChange={(e) => patch({ city: e.target.value })}
            placeholder="München"
            className="bg-white/5 border-white/10 rounded-xl"
          />
        </div>
      </div>

      <Button
        className={cn('w-full rounded-xl')}
        disabled={!canContinue || saving}
        onClick={() => void handleContinue()}
      >
        {saving ? (
          <span className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Speichern…
          </span>
        ) : (
          'Weiter'
        )}
      </Button>
    </div>
  );
}
