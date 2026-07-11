import { Activity, Bell, LogOut, Radar, Settings, Users } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth'
import type { Role } from '../types'

const roles: Role[] = ['agent', 'operations', 'risk', 'management', 'admin']

export function Layout() {
  const { user, logout, switchRole } = useAuth()
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><Radar size={25}/><div><strong>Super Agent</strong><span>Liquidity intelligence</span></div></div>
      <nav aria-label="Primary navigation">
        <NavLink to="/"><Activity size={18}/>Operational view</NavLink>
        {user?.role === 'management' && <NavLink to="/management"><Users size={18}/>Management</NavLink>}
        {user?.role === 'admin' && <NavLink to="/admin"><Settings size={18}/>Demo control</NavLink>}
      </nav>
      <div className="sidebar-note"><Bell size={17}/><span>Synthetic demonstration data only. No financial action is performed.</span></div>
    </aside>
    <main className="main">
      <header className="topbar">
        <div><span className="eyebrow">ACTIVE ROLE</span><strong>{user?.display_name}</strong></div>
        <div className="top-actions">
          <label className="role-select">View as <select value={user?.role} onChange={event => void switchRole(event.target.value as Role)}>{roles.map(role => <option key={role}>{role}</option>)}</select></label>
          <button className="button ghost" onClick={logout}><LogOut size={16}/>Sign out</button>
        </div>
      </header>
      <Outlet />
    </main>
  </div>
}

