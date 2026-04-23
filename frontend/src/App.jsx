import { Routes, Route, Navigate } from 'react-router-dom';
import { EngagementProvider, useEngagement } from './context/EngagementContext';
import { SettingsProvider } from './context/SettingsContext';
import { CodeReviewScanProvider } from './context/CodeReviewScanContext';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Scope from './pages/Scope';
import Assets from './pages/Assets';
import AssetDetail from './pages/AssetDetail';
import Findings from './pages/Findings';
import FindingDetail from './pages/FindingDetail';
import Credentials from './pages/Credentials';
import CredentialDetail from './pages/CredentialDetail';
import ToolOutput from './pages/ToolOutput';
import Checklists from './pages/Checklists';
import ActivityLog from './pages/ActivityLog';
import Guides from './pages/Guides';
import Assistant from './pages/Assistant';
import Settings from './pages/Settings';
import Report from './pages/Report';
import CodeReview from './pages/CodeReview';


function LegacyAssistantRedirect() {
  const { current } = useEngagement();
  if (current?.id) return <Navigate to={`/e/${current.id}/assistant`} replace />;
  return <Navigate to="/" replace />;
}

export default function App() {
  return (
    <SettingsProvider>
    <CodeReviewScanProvider>
    <EngagementProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8 app-main">
          <div className="max-w-[1200px] mx-auto w-full">
            <Routes>
              <Route path="/" element={<Dashboard key="list" />} />
              <Route path="/e/:id" element={<Dashboard key="detail" />} />
              <Route path="/e/:id/scope" element={<Scope />} />
              <Route path="/e/:id/assets" element={<Assets />} />
              <Route path="/e/:id/assets/:assetId" element={<AssetDetail />} />
              <Route path="/e/:id/findings" element={<Findings />} />
              <Route path="/e/:id/findings/:findingId" element={<FindingDetail />} />
              <Route path="/e/:id/credentials" element={<Credentials />} />
              <Route path="/e/:id/credentials/:credentialId" element={<CredentialDetail />} />
              <Route path="/e/:id/tool-output" element={<ToolOutput />} />
              <Route path="/e/:id/checklists" element={<Checklists />} />
              <Route path="/e/:id/activity" element={<ActivityLog />} />

              <Route path="/e/:id/report" element={<Report />} />
              <Route path="/guides" element={<Guides />} />
              <Route path="/e/:id/code-review" element={<CodeReview />} />
              <Route path="/assistant" element={<LegacyAssistantRedirect />} />
              <Route path="/e/:id/assistant" element={<Assistant />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </main>
      </div>
    </EngagementProvider>
    </CodeReviewScanProvider>
    </SettingsProvider>
  );
}
