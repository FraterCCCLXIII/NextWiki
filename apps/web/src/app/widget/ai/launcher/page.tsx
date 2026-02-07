import { getSetting } from "~/lib/services/settings";

export const dynamic = "force-dynamic";

export default async function AIWidgetLauncherPage() {
  const widgetEnabled = await getSetting("ai.widget.enabled");

  if (!widgetEnabled) {
    return (
      <div className="bg-transparent h-screen w-screen" aria-hidden="true" />
    );
  }

  return (
    <div
      style={{
        height: "100vh",
        width: "100vw",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "transparent",
      }}
    >
      <style>{`
        html, body {
          margin: 0;
          padding: 0;
          background: transparent;
        }
      `}</style>
      <button
        type="button"
        aria-label="Open AI assistant"
        style={{
          height: "56px",
          width: "56px",
          borderRadius: "999px",
          border: "none",
          backgroundColor: "#ffffff",
          color: "#111827",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 10px 20px rgba(0, 0, 0, 0.25)",
          cursor: "pointer",
        }}
        onClick={() => {
          if (typeof window === "undefined") return;
          window.parent?.postMessage({ type: "nextwiki-widget-toggle" }, "*");
        }}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M7 11H17M7 8H17M7 14H13M12 21C7.582 21 4 17.866 4 14V7C4 3.686 7.582 1 12 1C16.418 1 20 3.686 20 7V14C20 17.314 16.418 20 12 20H8L5 23V19.5C4.358 18.788 4 17.92 4 17V14"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}
