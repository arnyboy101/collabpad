import { ConnectionStatus } from '../types';

interface PresenceBarProps {
  users: number;
  connectionStatus: ConnectionStatus;
}

const PRESENCE_COLORS = ['#c45d3e', '#2d8a5e', '#6366f1', '#d97706', '#8b5cf6', '#ec4899'];

export function PresenceBar({ users, connectionStatus }: PresenceBarProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        animation: 'fadeIn 0.4s var(--ease-out) both',
      }}
    >
      {/* Connection status badges */}
      {connectionStatus === 'disconnected' && (
        <div
          style={{
            background: 'var(--red-soft)',
            color: 'var(--red)',
            padding: '5px 12px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: 500,
            fontFamily: 'var(--font-body)',
            letterSpacing: '0.01em',
            animation: 'slideDown 0.3s var(--ease-out) both',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: 'var(--red)',
              display: 'inline-block',
              animation: 'pulse-ring 1.5s ease-out infinite',
            }}
          />
          Reconnecting
        </div>
      )}
      {connectionStatus === 'connecting' && (
        <div
          style={{
            background: 'var(--amber-soft)',
            color: 'var(--amber)',
            padding: '5px 12px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: 500,
            fontFamily: 'var(--font-body)',
            letterSpacing: '0.01em',
            animation: 'slideDown 0.3s var(--ease-out) both',
          }}
        >
          Connecting...
        </div>
      )}

      {/* Presence avatars */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <div style={{ display: 'flex', marginRight: '4px' }}>
          {Array.from({ length: Math.min(users, 5) }).map((_, i) => (
            <div
              key={i}
              style={{
                width: '22px',
                height: '22px',
                borderRadius: '50%',
                backgroundColor: PRESENCE_COLORS[i % PRESENCE_COLORS.length],
                border: '2px solid var(--paper)',
                marginLeft: i > 0 ? '-6px' : '0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '9px',
                fontWeight: 600,
                color: 'white',
                fontFamily: 'var(--font-mono)',
                position: 'relative',
                zIndex: 5 - i,
                animation: `fadeUp 0.3s var(--ease-spring) ${i * 0.05}s both`,
              }}
            >
              {i + 1}
            </div>
          ))}
        </div>
        <span
          style={{
            fontSize: '12px',
            color: 'var(--ink-muted)',
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.02em',
          }}
        >
          {users === 1 ? '1 editor' : `${users} editors`}
        </span>
        {connectionStatus === 'connected' && (
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: 'var(--green)',
              display: 'inline-block',
              marginLeft: '2px',
              boxShadow: '0 0 0 2px var(--green-soft)',
            }}
          />
        )}
      </div>
    </div>
  );
}
