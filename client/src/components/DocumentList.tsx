import { useNavigate } from 'react-router-dom';
import { DocumentSummary } from '../types';

interface DocumentListProps {
  documents: DocumentSummary[];
  onDelete: (id: string) => void;
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr + 'Z');
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function DocumentList({ documents, onDelete }: DocumentListProps) {
  const navigate = useNavigate();

  if (documents.length === 0) {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: '64px 0',
          animation: 'fadeIn 0.6s var(--ease-out) both',
        }}
      >
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: 'var(--paper-warm)',
            border: '1px solid var(--border)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px',
            fontSize: '20px',
            color: 'var(--ink-faint)',
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10 9 9 9 8 9"/>
          </svg>
        </div>
        <p
          style={{
            color: 'var(--ink-muted)',
            fontSize: '14px',
            fontWeight: 400,
          }}
        >
          No documents yet
        </p>
        <p
          style={{
            color: 'var(--ink-faint)',
            fontSize: '13px',
            marginTop: '4px',
          }}
        >
          Create one to get started
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: '2px' }}>
      {documents.map((doc, index) => (
        <div
          key={doc.id}
          onClick={() => navigate(`/doc/${doc.id}`)}
          style={{
            padding: '16px 20px',
            background: 'var(--paper-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            transition: 'all 0.2s var(--ease-out)',
            animation: `fadeUp 0.4s var(--ease-out) ${index * 0.04}s both`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-hover)';
            e.currentTarget.style.boxShadow = 'var(--shadow-md)';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.boxShadow = 'none';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
            {/* Document icon */}
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--paper-warm)',
                border: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                color: 'var(--ink-muted)',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
            </div>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 500,
                  fontSize: '14px',
                  color: 'var(--ink)',
                  letterSpacing: '-0.01em',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {doc.title}
              </div>
              <div
                style={{
                  fontSize: '12px',
                  color: 'var(--ink-faint)',
                  marginTop: '2px',
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.02em',
                }}
              >
                {timeAgo(doc.updated_at)}
              </div>
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(doc.id);
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--ink-faint)',
              cursor: 'pointer',
              fontSize: '16px',
              padding: '6px 8px',
              borderRadius: 'var(--radius-sm)',
              transition: 'all 0.15s var(--ease-out)',
              opacity: 0.4,
              lineHeight: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '1';
              e.currentTarget.style.color = 'var(--red)';
              e.currentTarget.style.background = 'var(--red-soft)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '0.4';
              e.currentTarget.style.color = 'var(--ink-faint)';
              e.currentTarget.style.background = 'none';
            }}
            title="Delete document"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
