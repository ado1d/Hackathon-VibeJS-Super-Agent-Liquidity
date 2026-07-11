import type { Role } from "./types";

const LANDING_PATHS: Record<Role, string> = {
  agent: "/workspace",
  operations: "/workspace",
  risk: "/workspace",
  management: "/workspace",
  admin: "/workspace",
};

export function landingPath(role: Role): string {
  return LANDING_PATHS[role];
}
