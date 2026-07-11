import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import { Layout } from "./components/Layout";
import { RoleGuard } from "./components/RoleGuard";
import { AdminScenarios } from "./pages/AdminScenarios";
import { AgentDetail } from "./pages/AgentDetail";
import { AlertDetail } from "./pages/AlertDetail";
import { Dashboard } from "./pages/Dashboard";
import { Login } from "./pages/Login";
import { ManagementSummary } from "./pages/ManagementSummary";
import { AgentLanding } from "./pages/AgentLanding";
import { RiskQueue } from "./pages/RiskQueue";
import { SaliWorkspace } from "./pages/SaliWorkspace";
import { landingPath } from "./routing";

export default function App() {
  const { user } = useAuth();

  if (!user) {
    return <Login />;
  }

  return (
    <Routes>
      <Route path="workspace" element={<SaliWorkspace />} />
      <Route element={<Layout />}>
        <Route index element={<Navigate to={landingPath(user.role)} replace />} />
        <Route
          path="my-agent"
          element={<RoleGuard roles={["agent"]}><AgentLanding /></RoleGuard>}
        />
        <Route
          path="operations"
          element={<RoleGuard roles={["operations", "admin"]}><Dashboard /></RoleGuard>}
        />
        <Route
          path="review-queue"
          element={<RoleGuard roles={["risk"]}><RiskQueue /></RoleGuard>}
        />
        <Route path="agents/:agentId" element={<AgentDetail />} />
        <Route path="alerts/:alertId" element={<AlertDetail />} />
        <Route
          path="management"
          element={
            <RoleGuard roles={["management", "admin"]}><ManagementSummary /></RoleGuard>
          }
        />
        <Route
          path="admin"
          element={
            <RoleGuard roles={["admin"]}><AdminScenarios /></RoleGuard>
          }
        />
        <Route path="*" element={<Navigate to={landingPath(user.role)} replace />} />
      </Route>
    </Routes>
  );
}
