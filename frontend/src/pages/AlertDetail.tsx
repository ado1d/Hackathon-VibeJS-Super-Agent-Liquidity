import { FormEvent, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CheckCircle2, CircleHelp, ClipboardCheck, ShieldAlert } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { post, api } from '../api'
import { useAuth } from '../auth'
import { StatusBadge } from '../components/StatusBadge'
import { labels, type Language } from '../i18n/templates'
import type { Alert } from '../types'

interface Event { id:string; event_type:string; from_status:string|null; to_status:string|null; details:Record<string,unknown>; occurred_at:string }
interface Detail { alert: Alert; notes: {id:string; content:string; note_type:string; created_at:string}[]; events: Event[]; explanation_complete:boolean }

export function AlertDetail() {
  const { alertId = '' } = useParams(); const { user } = useAuth(); const client = useQueryClient(); const [language, setLanguage] = useState<Language>('en'); const [note, setNote] = useState('')
  const detail = useQuery({ queryKey: ['alert', alertId], queryFn: () => api<Detail>(`/alerts/${alertId}`) })
  const action = useMutation({ mutationFn: ({name, body}: {name:string; body?:unknown}) => post(`/alerts/${alertId}/${name}`, body), onSuccess: () => void client.invalidateQueries({queryKey:['alert', alertId]}) })
  const addNote = (event: FormEvent) => { event.preventDefault(); if (note.trim()) action.mutate({name:'notes', body:{content:note}}); setNote('') }
  if (detail.isLoading) return <div className="loading">Loading evidence and audit timeline…</div>
  if (!detail.data) return <div className="error-state">{detail.error?.message}</div>
  const alert = detail.data.alert; const canCoordinate = ['operations','risk','admin'].includes(user?.role || '')
  return <div className="page">
    <Link to="/" className="back"><ArrowLeft size={16}/>Back to queue</Link>
    <div className="alert-title"><div><div className="badge-row"><StatusBadge value={alert.severity}/><StatusBadge value={alert.status}/><span>{alert.alert_type.replaceAll('_',' ')}</span></div><h1>{alert.summary}</h1><p>Created {new Date(alert.created_at).toLocaleString()} · routed to {alert.assigned_role}</p></div><div className="language"><label>Explanation language<select value={language} onChange={event => setLanguage(event.target.value as Language)}><option value="en">English</option><option value="bn">বাংলা</option><option value="banglish">Banglish</option></select></label></div></div>
    <div className="explanation-grid">
      <section className="panel explanation primary-evidence"><div className="section-icon"><ShieldAlert/></div><span className="eyebrow">{labels[language].flagged}</span><h2>{alert.reason}</h2><p>{labels[language].unusual}</p><pre>{JSON.stringify(alert.evidence, null, 2)}</pre></section>
      <section className="panel explanation"><div className="section-icon"><ClipboardCheck/></div><span className="eyebrow">CONFIDENCE</span><div className="confidence-score"><strong>{Math.round(Number(alert.confidence)*100)}%</strong><StatusBadge value={alert.data_quality_status}/></div><ul>{alert.confidence_reasons.map(reason => <li key={reason}>{reason}</li>)}</ul></section>
      <section className="panel explanation"><div className="section-icon"><CircleHelp/></div><span className="eyebrow">{labels[language].uncertainty}</span><h2>{alert.uncertainty_statement}</h2><p>This is decision support, not a final fraud determination.</p></section>
      <section className="panel explanation safe-next"><div className="section-icon"><CheckCircle2/></div><span className="eyebrow">{labels[language].next}</span><h2>{alert.recommended_next_step}</h2><p>No transfer, block, freeze, or automatic financial action is available.</p></section>
    </div>
    <section className="panel workflow"><div className="panel-heading"><div><h2>Human coordination</h2><p>Actions are permission checked and appended to the audit trail.</p></div><div className="action-bar">{!alert.owner_user_id && canCoordinate && <button onClick={() => action.mutate({name:'claim'})}>Claim</button>}{['new','reopened'].includes(alert.status) && <button onClick={() => action.mutate({name:'acknowledge'})}>Acknowledge</button>}{canCoordinate && ['new','acknowledged','reopened','escalated'].includes(alert.status) && <button onClick={() => action.mutate({name:'in-progress'})}>Start progress</button>}{canCoordinate && ['new','acknowledged','in_progress','reopened'].includes(alert.status) && <button onClick={() => action.mutate({name:'escalate', body:{assigned_role:'risk', note:'Escalated for evidence-led review.'}})}>Escalate</button>}{canCoordinate && ['acknowledged','in_progress','escalated','reopened'].includes(alert.status) && <button onClick={() => action.mutate({name:'resolve', body:{resolution_code:'reviewed_no_further_action', note:'Synthetic evidence reviewed; no further prototype action required.'}})}>Resolve</button>}{canCoordinate && alert.status === 'resolved' && <button onClick={() => action.mutate({name:'reopen'})}>Reopen</button>}</div></div>
      {action.error && <p className="error" role="alert">{action.error.message}</p>}
      <form className="note-form" onSubmit={addNote}><label htmlFor="case-note">{user?.role === 'agent' ? 'Request operational support' : 'Add case note'}</label><textarea id="case-note" value={note} onChange={event => setNote(event.target.value)} placeholder="Record context without sensitive or real customer information."/><button className="button primary" disabled={!note.trim()}>Add to timeline</button></form>
      <div className="timeline">{detail.data.events.map(event => <div className="timeline-event" key={event.id}><span/><div><strong>{event.event_type.replaceAll('_',' ')}</strong><p>{event.from_status && `${event.from_status} → `}{event.to_status}</p><small>{new Date(event.occurred_at).toLocaleString()}</small></div></div>)}</div>
    </section>
  </div>
}
