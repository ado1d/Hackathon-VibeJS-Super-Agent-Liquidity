import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Banknote, Clock3, DatabaseZap, MapPin } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import { StatusBadge } from '../components/StatusBadge'
import type { Agent, Alert } from '../types'

interface Page<T> { items: T[]; total: number }

export function Dashboard() {
  const { user } = useAuth()
  const agents = useQuery({ queryKey: ['agents'], queryFn: () => api<Page<Agent>>('/agents?page_size=50') })
  const alerts = useQuery({ queryKey: ['alerts'], queryFn: () => api<Page<Alert>>('/alerts?page_size=50'), enabled: user?.role !== 'management' })
  if (agents.isLoading) return <div className="loading">Loading operational picture…</div>
  if (agents.error) return <div className="error-state"><h2>Operational view unavailable</h2><p>{agents.error.message}</p></div>
  const agentItems = agents.data?.items ?? []; const alertItems = alerts.data?.items ?? []
  if (user?.role === 'management') return <div className="page"><div className="page-heading"><div><span className="eyebrow">MANAGEMENT ACCESS</span><h1>Area readiness</h1><p>Aggregate operational context without customer-level evidence.</p></div><Link to="/management" className="button primary">Open management summary</Link></div></div>
  return <div className="page">
    <div className="page-heading"><div><span className="eyebrow">LIVE SYNTHETIC VIEW</span><h1>{user?.role === 'agent' ? 'My liquidity position' : user?.role === 'risk' ? 'Evidence review queue' : 'Operations cockpit'}</h1><p>Measured balances, forward pressure and coordinated response—kept clearly separate.</p></div><div className="updated"><span className="pulse"/>Deterministic scenario active</div></div>
    <section className="metric-grid" aria-label="Summary metrics">
      <article className="metric"><DatabaseZap/><span>Agents in scope</span><strong>{agentItems.length}</strong></article>
      <article className="metric critical"><AlertTriangle/><span>Critical alerts</span><strong>{alertItems.filter(a => a.severity === 'critical').length}</strong></article>
      <article className="metric"><Clock3/><span>Open cases</span><strong>{alertItems.filter(a => a.status !== 'resolved').length}</strong></article>
      <article className="metric"><Banknote/><span>Nearest pressure</span><strong>{Math.min(...agentItems.map(a => a.nearest_shortage_minutes ?? Infinity)) === Infinity ? 'Stable' : `${Math.round(Math.min(...agentItems.map(a => a.nearest_shortage_minutes ?? Infinity)))}m`}</strong></article>
    </section>
    <div className="dashboard-grid">
      <section className="panel wide"><div className="panel-heading"><div><h2>Agent liquidity map</h2><p>Provider risks are never hidden inside a combined total.</p></div><div className="filters"><select aria-label="Filter area"><option>All areas</option><option>Dhaka North</option><option>Dhaka South</option></select><select aria-label="Filter severity"><option>All severity</option><option>Critical</option><option>High</option></select></div></div>
        <div className="table-wrap"><table><thead><tr><th>Agent</th><th>Area</th><th>Nearest shortage</th><th>Health</th><th>Alerts</th></tr></thead><tbody>{agentItems.map(agent => <tr key={agent.id}><td><Link to={`/agents/${agent.id}`}><strong>{agent.name}</strong><small>{agent.code}</small></Link></td><td><MapPin size={14}/>{agent.area}</td><td>{agent.nearest_shortage_minutes == null ? 'No projected shortage' : `${Math.round(agent.nearest_shortage_minutes)} minutes`}</td><td><StatusBadge value={agent.health}/></td><td>{agent.alert_count}</td></tr>)}</tbody></table></div>
      </section>
      <section className="panel queue"><div className="panel-heading"><div><h2>Priority queue</h2><p>Human review required</p></div></div><div className="alert-list">{alertItems.slice(0, 8).map(alert => <Link to={`/alerts/${alert.id}`} className="alert-row" key={alert.id}><div><StatusBadge value={alert.severity}/><span className="alert-type">{alert.alert_type.replaceAll('_', ' ')}</span></div><strong>{alert.summary}</strong><small>{alert.status.replaceAll('_', ' ')} · confidence {Math.round(Number(alert.confidence) * 100)}%</small></Link>)}{!alertItems.length && <div className="empty">No alerts in this queue.</div>}</div></section>
    </div>
  </div>
}

