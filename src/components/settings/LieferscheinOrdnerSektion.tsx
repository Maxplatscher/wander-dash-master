import { useEffect, useMemo, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useIntegrations } from '@/hooks/useIntegrations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  folderHonestyNote,
  folderStatus,
  formatFolderSource,
  formatRelativeDe,
  isFolderType,
  parseFolderPath,
} from '@/lib/folder-source';
import type { SystemIntegration } from '@/types/integrations';

type FolderStat = {
  count: number;
  lastAt: string | null;
};

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-folder`;
}

export function LieferscheinOrdnerSektion({ companyId }: { companyId: string | null }) {
  const { integrations, loading, error, save, remove } = useIntegrations(companyId);
  const [name, setName] = useState('');
  const [path, setPath] = useState('');
  const [imapUser, setImapUser] = useState('');
  const [imapPass, setImapPass] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [stats, setStats] = useState<Record<string, FolderStat>>({});

  const folders = useMemo(
    () => integrations.filter((item) => isFolderType(item.system_type)),
    [integrations],
  );
  const connected = folders.filter((item) => item.is_active).length;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!companyId || folders.length === 0) {
        setStats({});
        return;
      }
      const ids = folders.map((item) => item.id);
      const { data, error: statsError } = await supabase
        .from('shipment')
        .select('integration_id, email_received_at')
        .eq('company_id', companyId)
        .in('integration_id', ids);

      if (cancelled) return;
      if (statsError) {
        // Spalte fehlt, bevor die Migration remote ist — Zähler dann 0 / last_test_at.
        setStats({});
        return;
      }

      const next: Record<string, FolderStat> = {};
      for (const id of ids) next[id] = { count: 0, lastAt: null };
      for (const row of data ?? []) {
        const id = row.integration_id as string | null;
        if (!id || !next[id]) continue;
        next[id].count += 1;
        const at = row.email_received_at as string | null;
        if (at && (!next[id].lastAt || at > next[id].lastAt)) next[id].lastAt = at;
      }
      setStats(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, folders]);

  const handleAdd = async () => {
    if (!companyId) {
      toast.error('Kein Unternehmen zugeordnet');
      return;
    }
    const label = name.trim();
    const parsed = parseFolderPath(path);
    const lookingImap = parsed?.kind === 'email_imap';
    if (!label) {
      toast.error('Bitte eine Bezeichnung angeben');
      return;
    }
    if (!parsed) {
      toast.error('Pfad oder Postfach fehlt');
      return;
    }

    setSaving(true);
    try {
      await save({
        id: newId(),
        depot_id: null,
        system_type: parsed.kind,
        name: label,
        config: parsed.config,
        credentials:
          lookingImap && imapUser && imapPass
            ? { username: imapUser, password: imapPass }
            : {},
        is_active: parsed.kind !== 'csv_import',
      });
      setName('');
      setPath('');
      setImapUser('');
      setImapPass('');
      if (parsed.kind === 'email_imap' && !(imapUser && imapPass)) {
        toast.success('IMAP-Ordner angelegt. Benutzername und Passwort fehlen noch — erneut hinzufügen oder Zugangsdaten später nachtragen.');
      } else if (parsed.kind === 'email_imap') {
        toast.success('IMAP-Ordner verbunden.');
      } else if (parsed.kind === 'unc_share') {
        toast.message('Netzwerkpfad gespeichert — ohne Cloud-Abruf, bis ein lokaler Agent existiert.');
      } else {
        toast.message('SFTP gespeichert. Die Abholung ist noch nicht angebunden.');
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Ordner konnte nicht angelegt werden');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (folder: SystemIntegration) => {
    setDeletingId(folder.id);
    try {
      await remove(folder.id);
      toast.success(`„${folder.name}“ entfernt`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Löschen fehlgeschlagen');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="glass-card p-5 space-y-4">
      <div className="flex items-center gap-3">
        <p className="card-title">Lieferschein-Ordner</p>
        <span className="px-1.5 py-0.5 text-[10.5px] font-semibold rounded-sm bg-primary/15 text-primary">
          {connected} verbunden
        </span>
      </div>

      {error ? <p className="text-sm text-danger">Fehler beim Laden: {error}</p> : null}

      {loading ? (
        <div className="flex items-center gap-2 meta-text py-3">
          <Loader2 className="w-4 h-4 animate-spin" />
          Ordner werden geladen…
        </div>
      ) : folders.length === 0 ? (
        <p className="meta-text">Noch kein Lieferschein-Ordner verbunden.</p>
      ) : (
        <div className="space-y-2">
          {folders.map((folder) => {
            const status = folderStatus(folder);
            const stat = stats[folder.id];
            const lastAt = stat?.lastAt ?? folder.last_test_at ?? null;
            const note = folderHonestyNote(folder.system_type);
            return (
              <div key={folder.id} className="sub-card px-4 py-3 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[14.5px] font-semibold text-foreground truncate">{folder.name}</p>
                  <code className="font-mono text-[11.5px] text-muted-foreground break-all">
                    {formatFolderSource(folder)}
                  </code>
                  {note ? <p className="meta-text mt-1">{note}</p> : null}
                </div>
                <p className="shrink-0 text-[12px] text-muted-foreground text-right">
                  {stat?.count ?? 0} Dokumente / {formatRelativeDe(lastAt)}
                </p>
                <span
                  className={cn(
                    'shrink-0 px-1.5 py-0.5 text-[10.5px] font-semibold rounded-sm',
                    status === 'aktiv'
                      ? 'bg-success/15 text-success'
                      : 'bg-warning/15 text-warning',
                  )}
                >
                  {status}
                </span>
                <button
                  type="button"
                  aria-label={`${folder.name} entfernen`}
                  disabled={deletingId === folder.id}
                  onClick={() => void handleRemove(folder)}
                  className="shrink-0 h-7 w-7 grid place-items-center rounded-[4px] text-muted-foreground hover:text-foreground hover:bg-white/[0.06]"
                >
                  {deletingId === folder.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <X className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="pt-2 border-t border-hairline">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Ordner hinzufügen
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Bezeichnung, z. B. Lieferscheine Nord"
            className="rounded-[4px] h-9"
          />
          <Input
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="Pfad oder Postfach"
            className="rounded-[4px] h-9"
          />
          {parseFolderPath(path)?.kind === 'email_imap' ? (
            <>
              <Input
                value={imapUser}
                onChange={(e) => setImapUser(e.target.value)}
                placeholder="IMAP-Benutzer"
                className="rounded-[4px] h-9"
                autoComplete="off"
              />
              <Input
                type="password"
                value={imapPass}
                onChange={(e) => setImapPass(e.target.value)}
                placeholder="IMAP-Passwort"
                className="rounded-[4px] h-9"
                autoComplete="new-password"
              />
            </>
          ) : null}
          <Button
            className="rounded-[4px] h-9 font-semibold shrink-0"
            disabled={saving || !companyId}
            onClick={() => void handleAdd()}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Hinzufügen'}
          </Button>
        </div>
      </div>
    </div>
  );
}
