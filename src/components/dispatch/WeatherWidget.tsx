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
  if (code <= 1) return { icon: Sun, label: 'Sonnig', bg: 'from-amber-400 via-orange-300 to-yellow-200' };
  if (code <= 3) return { icon: Cloud, label: 'Bewölkt', bg: 'from-slate-400 via-gray-300 to-slate-200' };
  if (code <= 48) return { icon: CloudFog, label: 'Nebelig', bg: 'from-gray-400 via-gray-300 to-gray-200' };
  if (code <= 67) return { icon: CloudRain, label: 'Regen', bg: 'from-blue-500 via-blue-400 to-slate-300' };
  if (code <= 77) return { icon: CloudSnow, label: 'Schnee', bg: 'from-blue-100 via-white to-blue-200' };
  if (code <= 82) return { icon: CloudRain, label: 'Schauer', bg: 'from-blue-600 via-blue-400 to-gray-300' };
  return { icon: CloudLightning, label: 'Gewitter', bg: 'from-gray-700 via-purple-600 to-gray-500' };
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
    <div className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${info.bg} p-6 text-white shadow-lg`}>
      {/* Animated background elements */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute -top-4 -right-4 w-32 h-32 rounded-full bg-white/30 animate-pulse" />
        <div className="absolute bottom-2 left-8 w-20 h-20 rounded-full bg-white/20 animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-8 left-1/3 w-12 h-12 rounded-full bg-white/25 animate-pulse" style={{ animationDelay: '0.5s' }} />
      </div>

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-1.5 text-sm font-medium hover:opacity-80 transition-opacity bg-white/20 rounded-lg px-3 py-1.5 backdrop-blur-sm">
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
          <span className="text-xs opacity-70">Auto-Update alle 10 Min</span>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="text-sm">Lade Wetterdaten...</span>
          </div>
        ) : weather ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <WeatherIcon className="w-14 h-14 drop-shadow-lg" />
              <div>
                <p className="text-3xl font-bold">{Math.round(weather.temperature)}°C</p>
                <p className="text-sm font-medium opacity-90">{info.label}</p>
              </div>
            </div>
            <div className="text-right space-y-1">
              <div className="flex items-center gap-1.5 justify-end">
                <Wind className="w-4 h-4 opacity-70" />
                <span className="text-sm">{weather.windspeed} km/h</span>
              </div>
              <p className="text-xs opacity-70">
                {new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm opacity-80">Wetterdaten nicht verfügbar</p>
        )}
      </div>
    </div>
  );
}
