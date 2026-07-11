import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth";
import { landingPath } from "../routing";
import type { Role } from "../types";

export function RoleGuard({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/" replace />;
  if (!roles.includes(user.role)) {
    return <Navigate to={landingPath(user.role)} replace />;
  }
  return children;
}
