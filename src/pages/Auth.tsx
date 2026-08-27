import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Truck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Link, Navigate } from 'react-router-dom';

export default function Auth() {
  const { user, loading, signIn, signInWithPin } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (user) return <Navigate to="/" replace />;

  const handleDispoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await signIn(email, password);
    setSubmitting(false);

    if (error) {
      toast.error(error.message);
    }
  };

  const handleDriverSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const result = await signInWithPin(firstName, lastName, code);
    setSubmitting(false);

    if (!result.success) {
      toast.error(result.error ?? 'Anmeldung fehlgeschlagen.');
    }
  };

  const codeDigits = code.replace(/\D/g, '').slice(0, 5);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
            <Truck className="w-6 h-6 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">DispoCenter</h1>
          <p className="text-sm text-muted-foreground">Melde dich an</p>
        </div>

        <Tabs defaultValue="dispo" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="dispo">Dispo</TabsTrigger>
            <TabsTrigger value="fahrer">Fahrer</TabsTrigger>
          </TabsList>

          <TabsContent value="dispo">
            <form onSubmit={handleDispoSubmit} className="space-y-4 rounded-lg border border-border bg-card p-6">
              <div className="space-y-2">
                <Label htmlFor="email">E-Mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="name@firma.de"
                  autoComplete="username"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Passwort</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  minLength={6}
                />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Anmelden</span>
                  </span>
                ) : (
                  'Anmelden'
                )}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="fahrer">
            <form onSubmit={handleDriverSubmit} className="space-y-4 rounded-lg border border-border bg-card p-6">
              <div className="space-y-2">
                <Label htmlFor="driver-first-name">Vorname</Label>
                <Input
                  id="driver-first-name"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  placeholder="Max"
                  autoComplete="given-name"
                  autoCapitalize="words"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="driver-last-name">Nachname</Label>
                <Input
                  id="driver-last-name"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  placeholder="Müller"
                  autoComplete="family-name"
                  autoCapitalize="words"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="driver-code">Code</Label>
                <Input
                  id="driver-code"
                  value={codeDigits}
                  onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
                  placeholder="48213"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="\d{4,5}"
                  maxLength={5}
                  required
                  className="h-16 text-center font-mono text-3xl tracking-[0.35em]"
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={submitting || !firstName.trim() || !lastName.trim() || codeDigits.length < 4}
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Anmelden</span>
                  </span>
                ) : (
                  'Anmelden'
                )}
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        <p className="text-center text-sm text-muted-foreground">
          Zugang nur per Einladung durch den Disponenten. Öffentliche Registrierung ist im Piloten deaktiviert.
        </p>
        <p className="text-center text-xs text-muted-foreground">
          <Link to="/impressum" className="text-primary hover:underline">Impressum</Link>
          {' · '}
          <Link to="/datenschutz" className="text-primary hover:underline">Datenschutz</Link>
        </p>
      </div>
    </div>
  );
}
