import { motion } from "framer-motion";
import { MapPin, ArrowUpRight, Clock, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Tour {
  id: number;
  name: string;
  location: string;
  distance: string;
  elevation: string;
  duration: string;
  difficulty: "leicht" | "mittel" | "schwer";
  date: string;
}

const difficultyColors: Record<string, string> = {
  leicht: "bg-success/15 text-success border-success/20",
  mittel: "bg-warning/15 text-warning border-warning/20",
  schwer: "bg-destructive/15 text-destructive border-destructive/20",
};

export function TourCard({ tour, index }: { tour: Tour; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.3 + index * 0.08, duration: 0.35 }}
      className="flex items-center justify-between p-4 rounded-xl border border-border bg-card hover:border-primary/30 transition-colors cursor-pointer group"
    >
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
          <MapPin className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="font-heading font-semibold text-card-foreground">{tour.name}</p>
          <p className="text-xs text-muted-foreground">{tour.location} · {tour.date}</p>
        </div>
      </div>

      <div className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <ArrowUpRight className="w-3.5 h-3.5" />
          {tour.distance}
        </span>
        <span className="flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5" />
          {tour.elevation}
        </span>
        <span className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          {tour.duration}
        </span>
      </div>

      <Badge variant="outline" className={difficultyColors[tour.difficulty]}>
        {tour.difficulty}
      </Badge>
    </motion.div>
  );
}

export type { Tour };
