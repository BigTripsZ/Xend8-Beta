import type { ViewId } from "@/pages/Home";
import { trpc } from "@/providers/trpc";

interface HomeSectionProps {
  onNavigate: (id: ViewId) => void;
}

export default function HomeSection({ onNavigate }: HomeSectionProps) {
  const configQuery = trpc.config.useQuery();
  const botLink = configQuery.data?.botLink || "https://t.me/Xend8_bot?start=admin";

  return (
    <div className="animate-fadeIn">
      <div className="xend-title">
        <span className="big-x">✗</span>ᴇɴᴅ8
      </div>
      <div className="xend-subtitle">Email Delivery & Verification Suite</div>

      <div className="xend-card sweep-card">
        <h3>Welcome</h3>
        <p>
          <span className="big-x" style={{ fontFamily: "var(--font-title)" }}>✗</span>ᴇɴᴅ8 is a comprehensive email toolkit for sending campaigns and verifying addresses. 
          Built for professionals who demand precision, deliverability, and real-time insights 
          into their email operations.
        </p>
        <button
          className="xend-menuBtn sweep-hover"
          onClick={() => onNavigate("how")}
        >
          How It Works
        </button>
        <button
          className="xend-menuBtn sweep-hover"
          onClick={() => onNavigate("smtp-tool")}
        >
          ⚒ SMTP Tool
        </button>
        <button
          className="xend-menuBtn sweep-hover"
          onClick={() => onNavigate("settings")}
        >
          ⚙ Settings
        </button>
      </div>

      <div className="xend-card sweep-card">
        <h3>⌬ Get Started</h3>
        <p>
          Launch your email operations directly through Telegram. Access the full suite of sending and verification tools.
        </p>
        <a
          href={botLink}
          target="_blank"
          rel="noopener noreferrer"
          className="xend-button tg-button sweep-hover novacut-btn"
        >
          Get Started
        </a>
      </div>
    </div>
  );
}
