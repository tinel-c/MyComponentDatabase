export default function AppLoading() {
  return (
    <div className="animate-pulse space-y-4 py-2" aria-busy="true" aria-label="Loading">
      <div className="mx-auto h-7 w-40 rounded-full bg-overlay" />
      <div className="h-16 rounded-2xl bg-overlay/80" />
      <div className="space-y-3">
        <div className="h-28 rounded-2xl bg-overlay/70" />
        <div className="h-28 rounded-2xl bg-overlay/70" />
        <div className="h-28 rounded-2xl bg-overlay/60" />
      </div>
    </div>
  );
}
