import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Truck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Navigate } from 'react-router-dom';

const ADMIN_EMAIL = 'Maxkitooltest@gmail.com';
const ADMIN_PASSWORD = 'Wipshausen1';

export default function Auth() {
  const { user, loading, signIn, signUp } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const autoLoginAttempted = useRef(false);

  // Auto-login with admin credentials
  useEffect(() => {
    if (!loading && !user && !autoLoginAttempted.current) {
      autoLoginAttempted.current = true;
      signIn(ADMIN_EMAIL, ADMIN_PASSWORD).then(({ error }) => {
        if (error) {
          // If login fails, try to register first then login
          signUp(ADMIN_EMAIL, ADMIN_PASSWORD).then(() => {
            signIn(ADMIN_EMAIL, ADMIN_PASSWORD);
          });
        }
      });
    }
  }, [loading, user, signIn, signUp]);

  if (loading || (!user && !autoLoginAttempted.current)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = isLogin
      ? await signIn(email, password)
      : await signUp(email, password);
    setSubmitting(false);

    if (error) {
      toast.error(error.message);
    } else if (!isLogin) {
      toast.success('Registrierung erfolgreich! Bitte bestätige deine E-Mail.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-2">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
            <Truck className="w-6 h-6 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">DispoCenter</h1>
          <p className="text-sm text-muted-foreground">
            {isLogin ? 'Melde dich an' : 'Erstelle ein Konto'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-border bg-card p-6">
          <div className="space-y-2">
            <Label htmlFor="email">E-Mail</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="name@firma.de"
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
              required
              minLength={6}
            />
          </div>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isLogin ? 'Anmelden' : 'Registrieren'}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          {isLogin ? 'Noch kein Konto?' : 'Bereits registriert?'}{' '}
          <button
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            className="text-primary hover:underline font-medium"
          >
            {isLogin ? 'Registrieren' : 'Anmelden'}
          </button>
        </p>
      </div>
    </div>
  );
}
