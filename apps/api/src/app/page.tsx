export default function Page() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#f4f0e8",
        color: "#1f3327",
        fontFamily: "system-ui, sans-serif"
      }}
    >
      <div style={{ maxWidth: 640, padding: 32 }}>
        <h1 style={{ marginBottom: 16 }}>Lawn Pal API</h1>
        <p>This Next app only exposes the weather and AI proxy routes used by the mobile MVP.</p>
      </div>
    </main>
  );
}
