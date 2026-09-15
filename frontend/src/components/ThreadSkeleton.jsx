const ThreadSkeleton = () => {
  // Render 3 skeleton cards to fill the viewport
  return (
    <div className="skeleton-container">
      {[1, 2, 3].map((i) => (
        <div key={i} className="card mb-4" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', opacity: 0.7 }}>
          {/* Topic Skeleton */}
          <div className="skeleton skeleton-title" style={{ width: '70%' }}></div>
          
          {/* Header row skeleton */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', width: '100%' }}>
            <div className="skeleton skeleton-circle" style={{ flexShrink: 0 }}></div>
            <div className="skeleton skeleton-line" style={{ flex: 1, margin: 0 }}></div>
            <div className="skeleton skeleton-btn" style={{ flexShrink: 0, borderRadius: 'var(--radius)' }}></div>
          </div>
          
          {/* Meta row skeleton */}
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <div className="skeleton skeleton-small" style={{ width: '120px', height: '0.8rem' }}></div>
            <div className="skeleton skeleton-small" style={{ width: '100px', height: '0.8rem' }}></div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ThreadSkeleton;
