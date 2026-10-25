import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import Navbar from './components/Navbar';
import LoginView from './components/LoginView';
import ForbiddenGuard from './components/ForbiddenGuard';
import RuleDetailView from './components/RuleDetailView';
import ExceptionRequestView from './components/ExceptionRequestView';
import ManagerQueueView from './components/ManagerQueueView';
import DecidedView from './components/DecidedView';
import TelemetryView from './components/TelemetryView';
import PreFlightInspectorView from './components/PreFlightInspectorView';
import WorkspacesView from './components/WorkspacesView';
import TeamManagementView from './components/TeamManagementView';
import { API_BASE } from './config/api';

function MainApp() {
  const { user, isAdmin, isWriter } = useAuth();
  const { t } = useLanguage();

  // Navigation tabs: 'workspaces' | 'inspector' | 'registry' | 'queue' | 'telemetry' | 'team'
  const [activeTab, setActiveTab] = useState('registry');

  // Sub-view toggle for Pre-Flight Inspector: 'exception_request' | 'scan'
  const [inspectorSubView, setInspectorSubView] = useState('scan');

  // Sub-view toggle for Manager Queue: 'review' | 'decided'
  const [queueSubView, setQueueSubView] = useState('review');

  // Badge count for manager queue
  const [queueCount, setQueueCount] = useState(3);

  // Selected submission ID when navigating from Workspace to Inspector
  const [selectedSubmissionId, setSelectedSubmissionId] = useState(null);

  // Exception draft context when navigating from Inspector to Exception Request
  const [exceptionDraftContext, setExceptionDraftContext] = useState(null);

  // Set initial role-based landing tab on login or role switch
  useEffect(() => {
    if (user) {
      if (user.role === 'ADMIN') {
        setActiveTab('registry');
      } else if (user.role === 'CONTENT_WRITER') {
        setActiveTab('inspector');
        setInspectorSubView('scan');
      }
    }
  }, [user?.role]);

  // If user is not logged in, display the Login screen with role redirection
  if (!user) {
    return (
      <LoginView
        onLoginSuccess={(loggedInUser) => {
          if (loggedInUser.role === 'ADMIN') {
            setActiveTab('registry');
          } else {
            setActiveTab('inspector');
            setInspectorSubView('scan');
          }
        }}
      />
    );
  }

  // Admin-only tabs list
  const adminOnlyTabs = ['registry', 'queue', 'telemetry', 'team'];
  const isForbiddenForWriter = isWriter && adminOnlyTabs.includes(activeTab);

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 text-zinc-950 dark:text-zinc-100 font-sans antialiased selection:bg-emerald-100 dark:selection:bg-emerald-900 selection:text-emerald-900 dark:selection:text-emerald-100 transition-colors">
      {/* Global Top Navigation Bar with Role Badge, Language Switcher, Dark Mode, & User Profile */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
        }}
        queueCount={queueCount}
      />

      {/* Main Content Area with Accessible Skip Target */}
      <main id="main-content" tabIndex="-1" className="w-full focus:outline-hidden">
        {/* Route Guard: Content Writers attempting to access Admin screens get HTTP 403 screen */}
        {isForbiddenForWriter ? (
          <ForbiddenGuard
            attemptedTab={activeTab}
            onNavigateBack={() => setActiveTab('inspector')}
          />
        ) : (
          <>
            {/* VIEW 1: Rule Detail / Source of Truth Editor (Rule Registry > FACT_012) */}
            {activeTab === 'registry' && (
              <RuleDetailView
                apiBase={API_BASE}
                onNavigate={(tab) => setActiveTab(tab)}
              />
            )}

            {/* VIEW 2 & Pre-Flight: Creator Pre-Flight Inspector & Exception Request */}
            {activeTab === 'inspector' && (
              <>
                {inspectorSubView === 'exception_request' ? (
                  <ExceptionRequestView
                    apiBase={API_BASE}
                    draftContext={exceptionDraftContext}
                    onBackToInspection={() => setInspectorSubView('scan')}
                    onSubmitSuccess={() => {
                      if (isAdmin) {
                        setActiveTab('queue');
                        setQueueSubView('review');
                      } else {
                        setActiveTab('workspaces');
                      }
                    }}
                  />
                ) : (
                  <PreFlightInspectorView
                    apiBase={API_BASE}
                    initialSubmissionId={selectedSubmissionId}
                    onRequestException={(ctx) => {
                      setExceptionDraftContext(ctx || null);
                      setInspectorSubView('exception_request');
                    }}
                    onNavigateToRule={(ruleCode) => {
                      if (isAdmin) {
                        setActiveTab('registry');
                      }
                    }}
                  />
                )}
              </>
            )}

            {/* VIEW 3 & VIEW 4: Manager Review Queue (Sign-Off vs Decided) */}
            {activeTab === 'queue' && (
              <>
                {queueSubView === 'review' ? (
                  <ManagerQueueView
                    apiBase={API_BASE}
                    onSelectApprovedHandoff={(exceptionId) => {
                      setQueueSubView('decided');
                    }}
                  />
                ) : (
                  <DecidedView
                    onBackToQueue={() => setQueueSubView('review')}
                    onViewAuditTrail={() => {}}
                    onOpenPublishHandoff={() => {}}
                  />
                )}
              </>
            )}

            {/* VIEW 5: Telemetry & Analytics Dashboard (Telemetry) */}
            {activeTab === 'telemetry' && (
              <TelemetryView
                apiBase={API_BASE}
                onSelectRule={(ruleId) => {
                  setActiveTab('registry');
                }}
                onViewAllRules={() => {
                  setActiveTab('registry');
                }}
              />
            )}

            {/* VIEW 6: Team Management (Per-writer stats, Top-5 rules, User Provisioning) */}
            {activeTab === 'team' && (
              <TeamManagementView apiBase={API_BASE} />
            )}

            {/* Workspaces View */}
            {activeTab === 'workspaces' && (
              <WorkspacesView
                apiBase={API_BASE}
                onNavigateToInspector={() => {
                  setSelectedSubmissionId(null);
                  setActiveTab('inspector');
                  setInspectorSubView('scan');
                }}
                onSelectSubmission={(subId) => {
                  setSelectedSubmissionId(subId);
                  setActiveTab('inspector');
                  setInspectorSubView('scan');
                }}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <MainApp />
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
