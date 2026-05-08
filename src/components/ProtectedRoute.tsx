import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { PageLoader } from './LoadingSpinner';

export function ProtectedRoute() {
  const location = useLocation();
  const { user, loading, organization, hasOrganization, isOrgAdmin, isPlatformOwner } = useAuth();

  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;

  const billingStatus = organization?.billing_status || organization?.subscription_status;
  const isSuspended = hasOrganization && !isPlatformOwner && billingStatus === 'suspended';

  if (isSuspended) {
    const allowedCommon = ['/profile', '/more', '/change-password'];
    const allowedAdmin = ['/leadership/billing'];
    const isAllowedCommon = allowedCommon.some(path => location.pathname.startsWith(path));
    const isAllowedAdmin = isOrgAdmin && allowedAdmin.some(path => location.pathname.startsWith(path));

    if (!isAllowedCommon && !isAllowedAdmin) {
      return <Navigate to={isOrgAdmin ? '/leadership/billing?locked=1' : '/profile?billing_locked=1'} replace />;
    }
  }

  return <Outlet />;
}
