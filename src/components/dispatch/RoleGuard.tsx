import { useDispatch, UserRole } from '@/lib/dispatch-context';

interface RoleGuardProps {
  allowed: UserRole[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function RoleGuard({ allowed, children, fallback }: RoleGuardProps) {
  const { role } = useDispatch();
  if (!allowed.includes(role)) {
    return fallback ? <>{fallback}</> : null;
  }
  return <>{children}</>;
}
