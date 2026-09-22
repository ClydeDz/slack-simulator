import React, { useState } from 'react';
import { useStore } from '../../store';
import ChannelList from './ChannelList';
import DmList from './DmList';
import AppList from './AppList';
import CreateChannelModal from '../modals/CreateChannelModal';
import IdentitySwitcher from '../ControlBar/IdentitySwitcher';
import SidebarAd from './SidebarAd';

export default function Sidebar() {
  const { workspace } = useStore();
  const [showCreateChannel, setShowCreateChannel] = useState(false);

  return (
    <>
      <div
        style={{
          width: 'var(--slacksim-sidebar-width)',
          flexShrink: 0,
          background: 'var(--slacksim-color-sidebar-bg)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Workspace name */}
        <div
          style={{
            padding: '17px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--slacksim-space-3)',
            fontSize: 'var(--slacksim-font-size-md)',
            fontWeight: 'var(--slacksim-font-weight-bold)',
            color: 'var(--slacksim-color-sidebar-fg-active)',
            borderBottom: '1px solid var(--slacksim-color-bar-border)',
            flexShrink: 0,
          }}
        >
          {/* Workspace avatar — custom image if provided, else first letter in a rounded square */}
          {workspace?.avatarUrl ? (
            <img
              src={workspace.avatarUrl}
              alt={workspace.name}
              style={{
                width: 40,
                height: 40,
                borderRadius: 'var(--slacksim-radius-sm)',
                objectFit: 'cover',
                flexShrink: 0,
              }}
            />
          ) : (
            <div
              style={{
                width: 40,
                height: 40,
                flexShrink: 0,
                background: 'var(--slacksim-color-primary)',
                borderRadius: 'var(--slacksim-radius-sm)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 'var(--slacksim-font-size-sm)',
                fontWeight: 'var(--slacksim-font-weight-bold)',
                color: 'var(--slacksim-color-sidebar-fg-active)',
              }}
            >
              {(workspace?.name ?? 'W')[0].toUpperCase()}
            </div>
          )}
          {workspace?.name ?? 'Workspace'}
        </div>

        {/* Scrollable channel/DM list with pinned ad */}
        <div
          className="ss-sidebar-scroll"
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            minHeight: 0,
          }}
        >
          <div
            className="ss-sidebar-scroll-content"
            style={{
              flex: 1,
              overflowY: 'auto',
              overflowX: 'hidden',
              minHeight: 0,
            }}
          >
            <ChannelList onCreateChannel={() => setShowCreateChannel(true)} />
            <DmList />
            <AppList />
          </div>
          <SidebarAd />
        </div>

        {/* Identity switcher — pinned to bottom of sidebar */}
        <div
          style={{
            borderTop: '1px solid var(--slacksim-color-bar-border)',
            padding: 'var(--slacksim-space-2)',
            flexShrink: 0,
          }}
        >
          <IdentitySwitcher openUpward />
        </div>
      </div>

      {showCreateChannel && (
        <CreateChannelModal onClose={() => setShowCreateChannel(false)} />
      )}
    </>
  );
}
