import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sun, Cloud, CloudRain, CloudSnow, CloudLightning, CloudFog, Wind, MapPin, Search, Loader2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface Location {
  name: string;
  latitude: number;
  longitude: number;
}

function getWeatherInfo(code: number) {
  if (code <= 1) return { icon: Sun, label: 'Sonnig', bg: 'from-amber-500/20 via-orange-500/10 to-transparent' };
  if (code <= 3) return { icon: Cloud, label: 'Bewölkt', bg: 'from-slate-500/20 via-slate-400/10 to-transparent' };
  if (code <= 48) return { icon: CloudFog, label: 'Nebelig', bg: 'from-slate-500/20 via-slate-400/10 to-transparent' };
  if (code <= 67) return { icon: CloudRain, label: 'Regen', bg: 'from-blue-500/25 via-blue-400/10 to-transparent' };
  if (code <= 77) return { icon: CloudSnow, label: 'Schnee', bg: 'from-cyan-400/20 via-blue-300/10 to-transparent' };
  if (code <= 82) return { icon: CloudRain, label: 'Schauer', bg: 'from-blue-600/25 via-blue-500/10 to-transparent' };
  return { icon: CloudLightning, label: 'Gewitter', bg: 'from-purple-600/25 via-slate-700/10 to-transparent' };
}

async function fetchWeather(lat: number, lon: number) {
  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`
  );
  if (!res.ok) throw new Error('Wetter konnte nicht geladen werden');
  return res.json();
}

async function searchCity(query: string): Promise<Location[]> {
  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=de`
  );
  const data = await res.json();
  return (data.results ?? []).map((r: any) => ({
    name: `${r.name}, ${r.country}`,
    latitude: r.latitude,
    longitude: r.longitude,
  }));
}

export function WeatherWidget() {
  const [location, setLocation] = useState<Location>({ name: 'München, Deutschland', latitude: 48.14, longitude: 11.58 });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Location[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['weather', location.latitude, location.longitude],
    queryFn: () => fetchWeather(location.latitude, location.longitude),
    refetchInterval: 10 * 60 * 1000,
    staleTime: 5 * 60 * 1000,
  });

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const results = await searchCity(searchQuery);
      setSearchResults(results);
    } finally {
      setSearching(false);
    }
  };

  const selectCity = (loc: Location) => {
    setLocation(loc);
    setOpen(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  const weather = data?.current_weather;
  const info = weather ? getWeatherInfo(weather.weathercode) : getWeatherInfo(1);
  const WeatherIcon = info.icon;

  return (
    <div className={`relative overflow-hidden h-full w-full rounded-[24px] bg-gradient-to-br ${info.bg} p-6 text-foreground flex flex-col`}>
      {/* Animated background elements */}
      <div className="absolute inset-0 opacity-30 pointer-events-none">
        <div className="absolute -top-4 -right-4 w-32 h-32 rounded-full bg-primary/20 blur-2xl animate-pulse" />
        <div className="absolute bottom-2 left-8 w-20 h-20 rounded-full bg-accent-cyan/20 blur-2xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative z-10 flex flex-col h-full">
        <div className="flex items-center justify-between mb-4">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-1.5 text-sm font-medium hover:bg-white/10 transition bg-white/5 border border-white/10 rounded-full px-3 py-1.5 backdrop-blur-md text-foreground">
                <MapPin className="w-3.5 h-3.5" />
                {location.name}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-72" align="start">
              <div className="space-y-3">
                <p className="text-sm font-medium text-card-foreground">Standort ändern</p>
                <div className="flex gap-2">
                  <Input
                    placeholder="Stadt suchen..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="h-8 text-sm"
                  />
                  <Button size="sm" variant="outline" onClick={handleSearch} disabled={searching} className="h-8 px-2">
                    {searching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                  </Button>
                </div>
                {searchResults.length > 0 && (
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {searchResults.map((r, i) => (
                      <button
                        key={i}
                        onClick={() => selectCity(r)}
                        className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-muted transition-colors text-card-foreground"
                      >
                        {r.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>
          <span className="text-xs text-muted-foreground">Auto-Update alle 10 Min</span>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="text-sm">Lade Wetterdaten...</span>
          </div>
        ) : weather ? (
          <div className="flex-1 flex flex-col justify-center">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-5">
                <WeatherIcon className="w-24 h-24 drop-shadow-lg" />
                <div>
                  <p className="text-6xl font-bold leading-none">{Math.round(weather.temperature)}°C</p>
                  <p className="text-base font-medium opacity-90 mt-2">{info.label}</p>
                </div>
              </div>
              <div className="text-right space-y-2">
                <div className="flex items-center gap-1.5 justify-end">
                  <Wind className="w-5 h-5 opacity-80" />
                  <span className="text-base">{weather.windspeed} km/h</span>
                </div>
                <p className="text-sm opacity-70">
                  {new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
                </p>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm opacity-80">Wetterdaten nicht verfügbar</p>
        )}
      </div>
    </div>
  );
}
