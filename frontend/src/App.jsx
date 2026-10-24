import React, { useState } from 'react';
import Navbar from './components/Navbar';
import RuleDetailView from './components/RuleDetailView';
import ExceptionRequestView from './components/ExceptionRequestView';
import ManagerQueueView from './components/ManagerQueueView';
import DecidedView from './components/DecidedView';
import TelemetryView from './components/TelemetryView';
import PreFlightInspectorView from './components/PreFlightInspectorView';
import WorkspacesView from './components/WorkspacesView';

const API_BASE = 'http://127.0.0.1:8000';

export default function App() {
  // Navigation tabs: 'workspaces' | 'inspector' | 'registry' | 'queue' | 'telemetry'
  const [activeTab, setActiveTab] = useState('registry'); // Default to Rule Registry (View 1)

  // Sub-view toggle for Pre-Flight Inspector: 'exception_request' (View 2) | 'scan'
  const [inspectorSubView, setInspectorSubView] = useState('exception_request');

  // Sub-view toggle for Manager Queue: 'review' (View 3) | 'decided' (View 4)
  const [queueSubView, setQueueSubView] = useState('review');

  // Badge count for manager queue
  const [queueCount, setQueueCount] = useState(3);

  return (
    <div className="min-h-screen bg-white text-zinc-950 font-sans antialiased selection:bg-emerald-100 selection:text-emerald-900">
      {/* Global Top Navigation Bar (Shared across all 5 reference views) */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
        }}
        queueCount={queueCount}
      />

      {/* Main Content Area */}
      <main className="w-full">
        {/* VIEW 1: Rule Detail / Source of Truth Editor (Rule Registry > FACT_012) */}
        {activeTab === 'registry' && (
          <RuleDetailView
            apiBase={API_BASE}
            onNavigate={(tab) => setActiveTab(tab)}
          />
        )}

        {/* VIEW 2 & Pre-Flight: Creator Exception Request (Pre-Flight > Exception Request) */}
        {activeTab === 'inspector' && (
          <>
            {inspectorSubView === 'exception_request' ? (
              <ExceptionRequestView
                apiBase={API_BASE}
                onBackToInspection={() => setInspectorSubView('scan')}
                onSubmitSuccess={() => {
                  setActiveTab('queue');
                  setQueueSubView('review');
                }}
              />
            ) : (
              <PreFlightInspectorView
                apiBase={API_BASE}
                onRequestException={() => setInspectorSubView('exception_request')}
                onNavigateToRule={(ruleCode) => {
                  setActiveTab('registry');
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

        {/* Workspaces View */}
        {activeTab === 'workspaces' && (
          <WorkspacesView
            onNavigateToInspector={() => {
              setActiveTab('inspector');
              setInspectorSubView('exception_request');
            }}
          />
        )}
      </main>
    </div>
  );
}
