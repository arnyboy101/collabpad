import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DocumentSummary } from '../types';
import { DocumentList } from '../components/DocumentList';

export function Dashboard() {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchDocs = () => {
    fetch('/api/documents')
      .then((res) => res.json())
      .then((docs) => {
        setDocuments(docs);
        setLoading(false);
      })
      .catch(console.error);
  };

  useEffect(() => {
    fetchDocs();
  }, []);

  const createDoc = async () => {
    const res = await fetch('/api/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Untitled' }),
    });
    const doc = await res.json();
    navigate(`/doc/${doc.id}`);
  };

  const deleteDoc = async (id: string) => {
    await fetch(`/api/documents/${id}`, { method: 'DELETE' });
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  };

  return (
    <div
      style={{
        maxWidth: '680px',
        margin: '0 auto',
        padding: '72px 24px 48px',
        animation: 'fadeUp 0.5s var(--ease-out) both',
      }}
    >
      {/* Brand header */}
      <div style={{ marginBottom: '48px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
          }}
        >
          <div>
            <h1
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '36px',
                fontWeight: 400,
                color: 'var(--ink)',
                letterSpacing: '-0.01em',
                lineHeight: 1.1,
              }}
            >
              CollabPad
            </h1>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '14px',
                color: 'var(--ink-muted)',
                marginTop: '6px',
                fontWeight: 400,
                letterSpacing: '0.01em',
              }}
            >
              Collaborative documents, real-time
            </p>
          </div>
          <button
            onClick={createDoc}
            style={{
              background: 'var(--ink)',
              color: 'var(--paper)',
              border: 'none',
              padding: '10px 22px',
              borderRadius: 'var(--radius-md)',
              fontSize: '13px',
              fontWeight: 500,
              fontFamily: 'var(--font-body)',
              cursor: 'pointer',
              transition: 'all 0.2s var(--ease-out)',
              boxShadow: 'var(--shadow-sm)',
              letterSpacing: '0.02em',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--accent)';
              e.currentTarget.style.boxShadow = 'var(--shadow-accent)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--ink)';
              e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            New document
          </button>
        </div>

        {/* Divider */}
        <div
          style={{
            height: '1px',
            background: 'var(--border)',
            marginTop: '24px',
          }}
        />
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ padding: '60px 0', textAlign: 'center' }}>
          <div
            style={{
              display: 'inline-block',
              width: '180px',
              height: '14px',
              borderRadius: '7px',
              background: 'linear-gradient(90deg, var(--paper-warm), var(--border), var(--paper-warm))',
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.5s infinite',
            }}
          />
        </div>
      ) : (
        <DocumentList documents={documents} onDelete={deleteDoc} />
      )}

      {/* Footer */}
      <div
        style={{
          marginTop: '48px',
          paddingTop: '20px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span
          style={{
            fontSize: '12px',
            color: 'var(--ink-faint)',
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.03em',
          }}
        >
          {documents.length} document{documents.length !== 1 ? 's' : ''}
        </span>
        <span
          style={{
            fontSize: '11px',
            color: 'var(--ink-faint)',
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
          }}
        >
          WebSocket sync
        </span>
      </div>
    </div>
  );
}
