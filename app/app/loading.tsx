export default function AppLoading() {
  return (
    <div className="app-page-v2 app-route-loading" aria-live="polite" aria-busy="true">
      <div className="app-route-loading-kicker" />
      <div className="app-route-loading-title" />
      <div className="app-route-loading-copy" />
      <div className="app-route-loading-metrics">
        <span /><span /><span /><span />
      </div>
      <div className="app-route-loading-list">
        <span /><span /><span />
      </div>
    </div>
  );
}
