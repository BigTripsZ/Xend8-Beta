import { useCallback, useRef } from "react";
import { trpc } from "@/providers/trpc";
import type { ViewId } from "@/pages/Home";

interface HeaderProps {
  currentView: ViewId;
  onNavigate: (id: ViewId) => void;
  isBotConnected: boolean;
  isChecking: boolean;
}

export default function Header({ currentView, onNavigate, isBotConnected, isChecking }: HeaderProps) {
  const logoRef = useRef<HTMLDivElement>(null);
  const configQuery = trpc.config.useQuery();
  const logoUrl = configQuery.data?.logoUrl || "/logo.png";

  const handleLogoClick = useCallback(() => {
    if (logoRef.current) {
      logoRef.current.classList.add("flash-active");
      setTimeout(() => {
        logoRef.current?.classList.remove("flash-active");
      }, 300);

      logoRef.current.style.transform = "scale(0.9)";
      setTimeout(() => {
        if (logoRef.current) logoRef.current.style.transform = "";
      }, 150);
    }

    onNavigate("home");
  }, [onNavigate]);

  const dotClass = isChecking
    ? ""
    : isBotConnected
    ? "pulse"
    : "disconnected";

  const statusText = isChecking
    ? "Checking..."
    : isBotConnected
    ? "Online"
    : "Offline";

  return (
    <div className="xend-header" id="mainHeader">
      <div id="headerLeft">
        {currentView === "home" ? (
          <div
            ref={logoRef}
            className="logo-container sweep-card"
            onClick={handleLogoClick}
            title="Home"
          >
            <img
              src={logoUrl}
              className="logo-img"
              alt="✗ᴇɴᴅ8"
              draggable={false}
            />
          </div>
        ) : (
          <div
            className="logo-container sweep-card"
            onClick={handleLogoClick}
            title="Home"
            style={{ width: 36, height: 36 }}
          >
            <img
              src={logoUrl}
              className="logo-img"
              style={{ width: 24, height: 24 }}
              alt="✗ᴇɴᴅ8"
              draggable={false}
            />
          </div>
        )}
      </div>

      <div id="headerRight">
        {currentView === "home" ? (
          <div className="conn-status-display">
            <div className={`status-dot ${dotClass}`} />
            <span>{statusText}</span>
          </div>
        ) : (
          <div
            className="header-title"
            style={{
              fontFamily: "var(--font-title)",
              fontSize: "1.4rem",
              fontWeight: "bold",
              letterSpacing: "1px",
              background: "linear-gradient(135deg, #fff, #777)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            <span className="big-x">✗</span>ᴇɴᴅ8
          </div>
        )}
      </div>
    </div>
  );
}
