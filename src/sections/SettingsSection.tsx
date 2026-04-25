import { useState, useEffect } from "react";
import { trpc } from "@/providers/trpc";

interface SettingsSectionProps {
  showToast: (message: string) => void;
}

const defaultSettings = {
  welcomeMessage: `Welcome to ✗ᴇɴᴅ8! ✘

Your email delivery & verification suite is now active. Send campaigns, verify lists, and monitor deliverability in real-time.

Begin your first operation below.`,
  buttonText: "꩜ Access Dashboard",
  buttonLink: "https://t.me/Xend8_bot?start=dashboard",
};

export default function SettingsSection({ showToast }: SettingsSectionProps) {
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [welcomeMessage, setWelcomeMessage] = useState(defaultSettings.welcomeMessage);
  const [buttonText, setButtonText] = useState(defaultSettings.buttonText);
  const [buttonLink, setButtonLink] = useState(defaultSettings.buttonLink);
  const [deployUrl, setDeployUrl] = useState("");
  const [webhookUrlInput, setWebhookUrlInput] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  const broadcastMutation = trpc.broadcast.send.useMutation();
  const webhookInfo = trpc.webhook.info.useQuery(undefined, {
    refetchInterval: 30000,
    retry: false,
  });
  const webhookSet = trpc.webhook.set.useMutation();
  const webhookDelete = trpc.webhook.delete.useMutation();
  const utils = trpc.useUtils();

  const botConnected = webhookInfo.data?.bot.connected ?? false;
  const webhookActive = webhookInfo.data?.webhook.connected ?? false;
  const actualWebhookUrl = webhookInfo.data?.webhook.url || "";
  const pendingUpdates = webhookInfo.data?.webhook.pendingUpdates ?? 0;
  const lastChecked = webhookInfo.dataUpdatedAt
    ? new Date(webhookInfo.dataUpdatedAt).toLocaleTimeString()
    : "Never";

  // Auto-set deploy URL from window.location
  useEffect(() => {
    const saved = localStorage.getItem("xndSettings");
    if (saved) {
      try {
        const settings = JSON.parse(saved);
        setWelcomeMessage(settings.welcomeMessage || defaultSettings.welcomeMessage);
        setButtonText(settings.buttonText || defaultSettings.buttonText);
        setButtonLink(settings.buttonLink || defaultSettings.buttonLink);
      } catch {
        // ignore
      }
    }

    // Auto-detect deploy URL from current window location
    if (typeof window !== "undefined") {
      const proto = window.location.protocol;
      const host = window.location.host;
      if (host && host !== "localhost" && !host.startsWith("localhost:")) {
        const autoUrl = `${proto}//${host}`;
        setDeployUrl(autoUrl);
        setWebhookUrlInput(`${autoUrl}/api/telegram-webhook`);
      }
    }
  }, []);

  // Sync webhook URL input when data changes
  useEffect(() => {
    if (actualWebhookUrl) {
      setWebhookUrlInput(actualWebhookUrl);
    }
  }, [actualWebhookUrl]);

  const handleBroadcast = async () => {
    try {
      const result = await broadcastMutation.mutateAsync({
        message: welcomeMessage,
        buttonText: buttonText || undefined,
        buttonLink: buttonLink || undefined,
      });

      if (result.success) {
        showToast("✓ Broadcast Sent!");
        localStorage.setItem(
          "xndSettings",
          JSON.stringify({ welcomeMessage, buttonText, buttonLink })
        );
      } else {
        showToast("✗ Broadcast failed");
      }
    } catch (error: any) {
      showToast("✗ " + error.message);
    }
  };

  const handleUpdateWebhook = async () => {
    const url = webhookUrlInput.trim();
    if (!url || !url.startsWith("http")) {
      showToast("Please enter a valid webhook URL");
      return;
    }

    setIsUpdating(true);
    try {
      const result = await webhookSet.mutateAsync({ url });
      if (result.success) {
        showToast("Webhook Updated");
        utils.webhook.info.invalidate();
      } else {
        showToast("Failed: " + (result.error || "Unknown error"));
      }
    } catch (error: any) {
      showToast("Failed: " + error.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteWebhook = async () => {
    if (!confirm("Are you sure you want to disconnect the webhook?")) return;

    setIsUpdating(true);
    try {
      const result = await webhookDelete.mutateAsync();
      if (result.success) {
        setWebhookUrlInput("");
        showToast("Webhook Disconnected");
        utils.webhook.info.invalidate();
      } else {
        showToast("Failed: " + (result.error || "Unknown error"));
      }
    } catch (error: any) {
      showToast("Failed: " + error.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleResetSettings = () => {
    if (confirm("Reset all settings to default?")) {
      setWelcomeMessage(defaultSettings.welcomeMessage);
      setButtonText(defaultSettings.buttonText);
      setButtonLink(defaultSettings.buttonLink);
      localStorage.setItem("xndSettings", JSON.stringify(defaultSettings));
      showToast("Settings reset");
    }
  };

  const statusClass = webhookInfo.isLoading
    ? "checking"
    : botConnected && webhookActive
    ? "online"
    : "offline";

  const statusLabel = webhookInfo.isLoading
    ? "Checking..."
    : botConnected && webhookActive
    ? "Online"
    : botConnected
    ? "No Webhook"
    : "Error";

  return (
    <div className="animate-fadeIn">
      <div className="xend-subtitle">Configuration & Webhook</div>

      {/* Broadcast Toggle */}
      <button
        className="xend-button primary sweep-hover"
        onClick={() => setShowBroadcast(!showBroadcast)}
        style={{ marginBottom: 16 }}
      >
        ᛔ Broadcast
      </button>

      {showBroadcast && (
        <div id="broadcastPanel" style={{ animation: "fadeUp 0.4s ease" }}>
          <div className="xend-card sweep-card">
            <h3>Broadcast Message</h3>
            <p>
              System-wide announcement delivered to all connected users. Use for service updates, maintenance windows, or feature releases.
            </p>
            <textarea
              className="xend-textarea"
              value={welcomeMessage}
              onChange={(e) => setWelcomeMessage(e.target.value)}
              placeholder="Enter broadcast message..."
            />
          </div>

          <div className="xend-card sweep-card">
            <h3>Call-to-Action Button</h3>
            <p>Configure the action button displayed beneath broadcast messages.</p>

            <label style={{ color: "#999", fontSize: "0.85rem", marginTop: 15, display: "block" }}>
              Button Text
            </label>
            <input
              className="xend-input"
              value={buttonText}
              onChange={(e) => setButtonText(e.target.value)}
              placeholder="e.g. Launch Dashboard"
            />

            <label style={{ color: "#999", fontSize: "0.85rem", marginTop: 15, display: "block" }}>
              Destination URL
            </label>
            <input
              className="xend-input"
              value={buttonLink}
              onChange={(e) => setButtonLink(e.target.value)}
              placeholder="https://..."
            />
          </div>

          <button
            className={`xend-button success sweep-hover ${broadcastMutation.isPending ? "loading" : ""}`}
            onClick={handleBroadcast}
            disabled={broadcastMutation.isPending}
          >
            𐊾 Broadcast
          </button>
          <button className="xend-button sweep-hover" onClick={handleResetSettings}>
            ↺ Reset to Default
          </button>
        </div>
      )}

      <hr className="section-divider" />

      {/* Webhook Configuration */}
      <div className="settings-section-title">Webhook Configuration</div>

      <div className="xend-card sweep-card">
        <h3>Connection Status</h3>
        <div className="status-box">
          <div>Bot Status</div>
          <div className={`api-status ${statusClass}`} id="status">
            ● {statusLabel}
          </div>
        </div>
        <div className="status-box">
          <div>Webhook URL</div>
        </div>
        {/* Editable webhook URL input — wraps naturally without stretching page */}
        <input
          className="xend-input"
          id="webhookUrl"
          value={webhookUrlInput}
          onChange={(e) => setWebhookUrlInput(e.target.value)}
          placeholder="https://your-app.com/api/telegram-webhook"
          style={{
            overflowWrap: "break-word",
            wordBreak: "break-all",
            whiteSpace: "normal",
            fontSize: "0.8rem",
            padding: "14px 16px",
            lineHeight: 1.5,
          }}
        />
        <div className="status-box">
          <div>Pending Updates</div>
          <div className="pending" id="pending">
            {pendingUpdates}
          </div>
        </div>
        <div className="status-box" style={{ marginTop: 12 }}>
          <div>Last Checked</div>
          <div style={{ color: "#666", fontSize: "0.85rem" }} id="lastChecked">
            {lastChecked}
          </div>
        </div>
      </div>

      <div className="xend-card sweep-card">
        <h3>Deployment Endpoint</h3>
        <input
          className="xend-input"
          value={deployUrl}
          onChange={(e) => {
            const val = e.target.value;
            setDeployUrl(val);
            if (val) {
              const base = val.replace(/\/$/, "");
              setWebhookUrlInput(`${base}/api/telegram-webhook`);
            }
          }}
          placeholder="https://yourproject.vercel.app"
        />
        <div
          className="xend-input"
          id="generatedUrl"
          style={{
            color: "#666",
            fontSize: "0.8rem",
            marginTop: 10,
            overflowWrap: "break-word",
            wordBreak: "break-all",
            whiteSpace: "normal",
            lineHeight: 1.5,
            cursor: "default",
            userSelect: "all",
          }}
        >
          {deployUrl ? `${deployUrl.replace(/\/$/, "")}/api/telegram-webhook` : "Generated webhook appears here"}
        </div>
      </div>

      <button
        className={`xend-button primary sweep-hover ${isUpdating ? "loading" : ""}`}
        id="updateWebhookBtn"
        onClick={handleUpdateWebhook}
        disabled={isUpdating}
      >
        ⎌ Update Webhook
      </button>
      <button
        className="xend-button sweep-hover"
        onClick={() => utils.webhook.info.invalidate()}
      >
        ⟲ Refresh Status
      </button>
      <button
        className="xend-button danger sweep-hover"
        onClick={handleDeleteWebhook}
        disabled={isUpdating}
      >
        ⎋ Disconnect
      </button>
    </div>
  );
}
