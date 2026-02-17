// PostSkeleton component - Loading skeleton for posts
export default function PostSkeleton() {
  return (
    <div className="post-skeleton">
      <div className="skeleton-header">
        <div className="skeleton-avatar skel-pulse"></div>
        <div className="skeleton-author">
          <div className="skeleton-line short skel-pulse"></div>
          <div className="skeleton-line tiny skel-pulse" style={{ animationDelay: '0.1s' }}></div>
        </div>
      </div>
      <div className="skeleton-content">
        <div className="skeleton-line skel-pulse" style={{ animationDelay: '0.05s' }}></div>
        <div className="skeleton-line medium skel-pulse" style={{ animationDelay: '0.1s' }}></div>
        <div className="skeleton-line long skel-pulse" style={{ animationDelay: '0.15s' }}></div>
      </div>
      <div className="skeleton-media skel-pulse" style={{ animationDelay: '0.2s' }}></div>
      <div className="skeleton-footer">
        <div className="skeleton-action skel-pulse"></div>
        <div className="skeleton-action skel-pulse" style={{ animationDelay: '0.05s' }}></div>
        <div className="skeleton-action skel-pulse" style={{ animationDelay: '0.1s' }}></div>
      </div>

      <style>{`
        .post-skeleton {
          padding: 1.25rem;
          border-radius: 1.25rem;
          background: linear-gradient(145deg, rgba(19, 25, 23, 0.7) 0%, rgba(14, 20, 18, 0.6) 100%);
          border: 1px solid rgba(255, 255, 255, 0.04);
          backdrop-filter: blur(20px);
          animation: skelFadeIn 0.4s ease both;
        }
        @keyframes skelFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .skel-pulse {
          background: linear-gradient(
            100deg,
            rgba(255, 255, 255, 0.04) 0%,
            rgba(255, 255, 255, 0.08) 40%,
            rgba(255, 255, 255, 0.04) 60%
          );
          background-size: 250% 100%;
          animation: skelShimmer 1.8s ease-in-out infinite;
        }
        @keyframes skelShimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .skeleton-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 1rem;
        }
        .skeleton-avatar {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .skeleton-author {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
          flex: 1;
        }
        .skeleton-content { margin-bottom: 1rem; }
        .skeleton-line {
          height: 11px;
          border-radius: 6px;
          margin-bottom: 0.45rem;
          width: 100%;
        }
        .skeleton-line.short { width: 35%; }
        .skeleton-line.medium { width: 65%; }
        .skeleton-line.long { width: 85%; }
        .skeleton-line.tiny { width: 22%; height: 9px; }
        .skeleton-media {
          width: 100%;
          height: 180px;
          border-radius: 14px;
          margin-bottom: 1rem;
        }
        .skeleton-footer {
          display: flex;
          gap: 0.4rem;
          padding-top: 0.75rem;
          border-top: 1px solid rgba(255, 255, 255, 0.03);
        }
        .skeleton-action {
          width: 65px;
          height: 34px;
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
}