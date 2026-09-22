import React from 'react';
import Sidebar from '../components/Sidebar';
import MainPane from '../components/MainPane';
import ThreadPane from '../components/ThreadPane';
import { useStore } from '../store';

export default function WorkspaceView() {
  const activeThreadTs = useStore((s) => s.activeThreadTs);

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      <Sidebar />
      <MainPane />
      {activeThreadTs && <ThreadPane />}
    </div>
  );
}
