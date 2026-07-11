import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth'
import { Layout } from './components/Layout'
import { AdminScenarios } from './pages/AdminScenarios'
import { AgentDetail } from './pages/AgentDetail'
import { AlertDetail } from './pages/AlertDetail'
import { Dashboard } from './pages/Dashboard'
import { Login } from './pages/Login'
import { ManagementSummary } from './pages/ManagementSummary'

export default function App(){
  const {user}=useAuth()
  if(!user)return <Login/>
  return <Routes><Route element={<Layout/>}><Route index element={<Dashboard/>}/><Route path="agents/:agentId" element={<AgentDetail/>}/><Route path="alerts/:alertId" element={<AlertDetail/>}/><Route path="management" element={user.role==='management'||user.role==='admin'?<ManagementSummary/>:<Navigate to="/"/>}/><Route path="admin" element={user.role==='admin'?<AdminScenarios/>:<Navigate to="/"/>}/><Route path="*" element={<Navigate to="/"/>}/></Route></Routes>
}

