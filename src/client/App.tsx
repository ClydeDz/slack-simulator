import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useStore } from './store';
import ControlBar from './components/ControlBar';
import WorkspaceView from './views/WorkspaceView';
import AdminView from './views/AdminView';
import LogsView from './views/LogsView';
import DatabaseView from './views/DatabaseView';
import SlackModal from './components/modals/SlackModal';
import { useRealtimeWS } from './hooks/useRealtimeWS';

export default function App() {
  const { data, isLoading } = useQuery({
    queryKey: ['workspace'],
    queryFn: () => fetch('/_control/workspace').then((r) => r.json()),
  });

  const { setWorkspaceData, activeTab, activeModals } = useStore();

  React.useEffect(() => {
    if (data) setWorkspaceData(data);
  }, [data, setWorkspaceData]);

  useRealtimeWS();

  if (isLoading || !data)
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          fontFamily: 'var(--slacksim-font-body)',
          color: 'var(--slacksim-color-fg)',
        }}
      >
        Loading Slack Simulator…
      </div>
    );

  const topModal = activeModals[activeModals.length - 1] ?? null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflow: 'hidden',
        fontFamily: 'var(--slacksim-font-body)',
      }}
    >
      <ControlBar />
      {activeTab === 'workspace' && <WorkspaceView />}
      {activeTab === 'admin' && <AdminView />}
      {activeTab === 'logs' && <LogsView />}
      {activeTab === 'database' && <DatabaseView />}
      {topModal && (
        <SlackModal
          view={topModal.view}
          appId={topModal.appId}
          stackDepth={activeModals.length}
        />
      )}
    </div>
  );
}
