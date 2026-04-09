import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { StatCard } from "@/components/StatCard";
import { TourCard, Tour } from "@/components/TourCard";
import { motion } from "framer-motion";
import { Route, Mountain, Clock, TrendingUp, Map } from "lucide-react";

const stats = [
  { icon: Route, label: "Touren gesamt", value: "47", subtitle: "12 dieses Jahr" },
  { icon: TrendingUp, label: "Gesamtdistanz", value: "683 km", subtitle: "+42 km diese Woche" },
  { icon: Mountain, label: "Höhenmeter", value: "28.450 m", subtitle: "Ø 605 m pro Tour" },
  { icon: Clock, label: "Gesamtzeit", value: "194 h", subtitle: "Ø 4,1 h pro Tour" },
];

const recentTours: Tour[] = [
  { id: 1, name: "Zugspitze über Höllental", location: "Garmisch-Partenkirchen", distance: "21,4 km", elevation: "2.232 m", duration: "10:30 h", difficulty: "schwer", date: "05. Apr 2026" },
  { id: 2, name: "Königssee Rundweg", location: "Berchtesgaden", distance: "14,8 km", elevation: "420 m", duration: "4:15 h", difficulty: "leicht", date: "28. Mär 2026" },
  { id: 3, name: "Watzmann Überschreitung", location: "Berchtesgaden", distance: "18,2 km", elevation: "1.890 m", duration: "9:00 h", difficulty: "schwer", date: "15. Mär 2026" },
  { id: 4, name: "Partnachklamm & Eckbauer", location: "Garmisch-Partenkirchen", distance: "8,6 km", elevation: "580 m", duration: "3:30 h", difficulty: "mittel", date: "02. Mär 2026" },
  { id: 5, name: "Tegernseer Höhenweg", location: "Tegernsee", distance: "11,2 km", elevation: "340 m", duration: "3:45 h", difficulty: "leicht", date: "18. Feb 2026" },
];

const Index = () => {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-14 flex items-center border-b border-border px-4 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
            <SidebarTrigger className="mr-4" />
            <h2 className="font-heading font-semibold text-foreground">Dashboard</h2>
          </header>

          <main className="flex-1 p-6 space-y-6 max-w-6xl">
            {/* Greeting */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <h1 className="text-2xl font-heading font-bold text-foreground">Willkommen zurück! 🏔️</h1>
              <p className="text-muted-foreground mt-1">Hier ist deine Tourenübersicht für diese Saison.</p>
            </motion.div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {stats.map((stat, i) => (
                <StatCard key={stat.label} {...stat} index={i} />
              ))}
            </div>

            {/* Two column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Recent Tours */}
              <div className="lg:col-span-2 space-y-3">
                <h3 className="font-heading font-semibold text-foreground">Letzte Touren</h3>
                <div className="space-y-2">
                  {recentTours.map((tour, i) => (
                    <TourCard key={tour.id} tour={tour} index={i} />
                  ))}
                </div>
              </div>

              {/* Map placeholder */}
              <div className="space-y-3">
                <h3 className="font-heading font-semibold text-foreground">Nächste Tour</h3>
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5, duration: 0.4 }}
                  className="rounded-xl border border-border bg-card overflow-hidden"
                >
                  <div className="aspect-square bg-muted flex items-center justify-center relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5" />
                    <div className="text-center z-10">
                      <Map className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Kartenansicht</p>
                    </div>
                  </div>
                  <div className="p-4">
                    <p className="font-heading font-semibold text-card-foreground">Alpspitze Ferrata</p>
                    <p className="text-xs text-muted-foreground mt-1">Geplant für 12. Apr 2026</p>
                    <div className="flex gap-3 mt-3 text-xs text-muted-foreground">
                      <span>12,4 km</span>
                      <span>1.340 m ↑</span>
                      <span>~6 h</span>
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Index;
