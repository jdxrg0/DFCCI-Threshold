import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Eye, Tag } from 'lucide-react';

const ThreadCard = ({ thread, type }) => {
  const isSender = type === 'sent';
  const otherParty = isSender ? thread.receiver : thread.sender;

  return (
    <div className="thread-card-glass mb-4">

      {/* Topic title — more prominent hierarchy */}
      {thread.topic && (
        <div style={{
          fontSize: '1.15rem',
          fontWeight: '800',
          color: 'var(--text-main)',
          marginBottom: '0.1rem',
          lineHeight: '1.2'
        }}>
          {thread.topic}
        </div>
      )}

      {/* Name + badge + view button — all on one row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: 1, minWidth: 0 }}>
          <Tag size={14} className="text-muted" style={{ flexShrink: 0 }} />
          <h3 style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
            {isSender ? `To: ${otherParty?.displayName || 'Unknown'}` : `From: ${otherParty?.displayName || 'Unknown'}`}
          </h3>
        </div>
        <span className={`badge ${thread.status.toLowerCase()}`} style={{ flexShrink: 0, fontWeight: '700' }}>
          {thread.status}
        </span>
        <Link to={`/mirror/thread/${thread._id}`} className="btn btn-primary" style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem', borderRadius: '9999px', fontWeight: '700' }} title="View Thread">
          <Eye size={14} />
          <span style={{ marginLeft: '0.35rem' }}>View</span>
        </Link>
      </div>

      <div className="thread-meta" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        <span>Updated: {format(new Date(thread.updatedAt), 'MMM d, yyyy h:mm a')}</span>
        {thread.resolvedAt && (
          <span style={{ marginLeft: '0.75rem' }}>
            · Resolved: {format(new Date(thread.resolvedAt), 'MMM d, yyyy')}
          </span>
        )}
      </div>
    </div>
  );
};

export default ThreadCard;
