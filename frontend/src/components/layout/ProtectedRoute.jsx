import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/AuthProvider";
import { PageSkeleton } from "@/components/common/PageSkeleton";

export function ProtectedRoute({ children, admin = false }) {
  const { user } = useAuth();
  const location = useLocation();
  if (user === null) return <PageSkeleton />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (admin && !user.admin_role) return <Navigate to="/account" replace />;
  return children;
}
