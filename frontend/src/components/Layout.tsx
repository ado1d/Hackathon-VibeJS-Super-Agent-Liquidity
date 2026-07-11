import { Activity, Bell, LogOut, Menu, Radar, Settings, Users, X } from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth";
import { landingPath } from "../routing";
import { DemoStatus } from "./DemoStatus";

export function Layout() {
  const { user, logout } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="app-shell">
      <aside className={`sidebar${mobileNavOpen ? " mobile-open" : ""}`}>
        <div className="brand">
          <Radar size={25} />
          <div>
            <strong>Super Agent</strong>
            <span>Liquidity intelligence</span>
          </div>
          <button
            className="sidebar-close"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>
        <nav aria-label="Primary navigation">
          <NavLink
            to={user ? landingPath(user.role) : "/"}
            onClick={() => setMobileNavOpen(false)}
          >
            <Activity size={18} />
            Home
          </NavLink>
          {user?.role === "management" && (
            <NavLink to="/management" onClick={() => setMobileNavOpen(false)}>
              <Users size={18} />
              Management
            </NavLink>
          )}
          {user?.role === "admin" && (
            <NavLink to="/admin" onClick={() => setMobileNavOpen(false)}>
              <Settings size={18} />
              Demo control
            </NavLink>
          )}
        </nav>
        <div className="sidebar-note">
          <Bell size={17} />
          <span>
            Synthetic demonstration data only. No financial action is performed.
          </span>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileNavOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      <main className="main">
        <header className="topbar">
          <button
            className="mobile-menu-btn"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>
          <div>
            <span className="eyebrow">ACTIVE ROLE</span>
            <strong>{user?.display_name}</strong>
          </div>
          <div className="top-actions">
            <button className="button ghost" onClick={logout}>
              <LogOut size={16} />
              <span className="signout-text">Sign out</span>
            </button>
          </div>
        </header>
        <DemoStatus />
        <Outlet />
      </main>
    </div>
  );
}
