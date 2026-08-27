import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type CodeEntry = { driverName: string; code: string };

type DriverCodeRevealDialogProps = {
  open: boolean;
  entries: CodeEntry[];
  onClose: () => void;
};

export function DriverCodeRevealDialog({
  open,
  entries,
  onClose,
}: DriverCodeRevealDialogProps) {
  const single = entries.length === 1;
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md border-hairline">
        <DialogHeader>
          <DialogTitle>
            {single ? `Code für ${entries[0]?.driverName ?? 'Fahrer'}` : 'Fahrer-Codes'}
          </DialogTitle>
          <DialogDescription>
            Bitte den Fahrern mitteilen. Die Codes werden nicht erneut angezeigt — nur neu
            generieren setzt andere.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {entries.map((entry) => (
            <div key={`${entry.driverName}-${entry.code}`} className="space-y-1">
              {!single && (
                <p className="text-sm text-muted-foreground text-center">{entry.driverName}</p>
              )}
              <p className="text-center font-mono text-4xl tracking-[0.35em] text-foreground">
                {entry.code}
              </p>
            </div>
          ))}
        </div>
        <Button className="w-full rounded" onClick={onClose}>
          Verstanden, Code notiert
        </Button>
      </DialogContent>
    </Dialog>
  );
}
