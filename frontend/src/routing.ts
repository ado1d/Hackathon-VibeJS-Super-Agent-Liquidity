import type { Role } from "./types";

const LANDING_PATHS: Record<Role, string> = {
  agent: "/my-agent",
  operations: "/operations",
  risk: "/review-queue",
  management: "/management",
  admin: "/admin",
};

export function landingPath(role: Role): string {
  return LANDING_PATHS[role];
}
