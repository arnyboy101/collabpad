import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import { useCollabSocket } from '../hooks/useCollabSocket';
import { PresenceBar } from '../components/PresenceBar';

export function Editor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [saved, setSaved] = useState(false);
  const titleTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { content, setContent, users, connectionStatus, version } =
    useCollabSocket(id!);

  useEffect(() => {
    fetch(`/api/documents/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error('Not found');
        return res.json();
      })
      .then((doc) => setTitle(doc.title))
      .catch(() => navigate('/'));
  }, [id, navigate]);

  // Brief "saved" flash when version changes (means server accepted edit)
  useEffect(() => {
    if (version > 1) {
      setSaved(true);
      const t = setTimeout(() => setSaved(false), 1500);
      return () => clearTimeout(t);
    }
  }, [version]);

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    clearTimeout(titleTimeoutRef.current);
    titleTimeoutRef.current = setTimeout(() => {
      fetch(`/api/documents/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle }),
      });
    }, 500);
  };

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        animation: 'fadeIn 0.3s var(--ease-out) both',
      }}
    >
      {/* Top bar */}
      <header
        style={{
          padding: '12px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid var(--border)',
          background: 'rgba(250, 248, 245, 0.85)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          flexShrink: 0,
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: 0 }}>
          {/* Back button */}
          <button
            onClick={() => navigate('/')}
            style={{
              background: 'none',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              padding: '6px 10px',
              cursor: 'pointer',
              color: 'var(--ink-muted)',
              transition: 'all 0.15s var(--ease-out)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '13px',
              fontFamily: 'var(--font-body)',
              fontWeight: 500,
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-hover)';
              e.currentTarget.style.color = 'var(--ink)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.color = 'var(--ink-muted)';
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            Back
          </button>

          {/* Title input */}
          <input
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            style={{
              border: 'none',
              fontSize: '16px',
              fontWeight: 500,
              fontFamily: 'var(--font-body)',
              color: 'var(--ink)',
              outline: 'none',
              background: 'transparent',
              minWidth: '120px',
              maxWidth: '400px',
              letterSpacing: '-0.01em',
            }}
            placeholder="Untitled"
          />

          {/* Save indicator */}
          <span
            style={{
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              color: saved ? 'var(--green)' : 'var(--ink-faint)',
              letterSpacing: '0.03em',
              transition: 'color 0.3s var(--ease-out)',
              whiteSpace: 'nowrap',
            }}
          >
            {saved ? 'saved' : `v${version}`}
          </span>
        </div>

        <PresenceBar users={users} connectionStatus={connectionStatus} />
      </header>

      {/* Editor area */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          justifyContent: 'center',
          overflow: 'auto',
          padding: '0 24px',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '720px',
            padding: '40px 0 80px',
          }}
        >
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            style={{
              width: '100%',
              height: '100%',
              minHeight: 'calc(100vh - 180px)',
              border: 'none',
              background: 'transparent',
              padding: '0',
              fontSize: '16px',
              lineHeight: '1.8',
              color: 'var(--ink-light)',
              resize: 'none',
              outline: 'none',
              fontFamily: 'var(--font-body)',
              letterSpacing: '-0.005em',
            }}
            placeholder="Start writing..."
          />
        </div>
      </div>
    </div>
  );
}
