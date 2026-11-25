// Shown only in preview mode (frontend/preview-server), so sample data is never
// mistaken for real reports.
export function PreviewBanner() {
  if (import.meta.env.VITE_PREVIEW !== 'true') return null;
  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        left: 12,
        bottom: 12,
        zIndex: 9999,
        padding: '4px 12px',
        borderRadius: 999,
        background: '#7A2E0E',
        color: '#fff',
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: 0.4,
        pointerEvents: 'none',
      }}
    >
      PREVIEW · sample data
    </div>
  );
}
