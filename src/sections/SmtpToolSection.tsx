import { useState, useEffect } from "react";
import { trpc } from "@/providers/trpc";

interface SmtpToolSectionProps {
  showToast: (message: string) => void;
}

export default function SmtpToolSection({ showToast }: SmtpToolSectionProps) {
  const [recipient, setRecipient] = useState("");
  const [senderName, setSenderName] = useState("✗ᴇɴᴅ8 Mailer");
  const [subject, setSubject] = useState("Test Delivery from ✗ᴇɴᴅ8");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState("normal");
  const [showError, setShowError] = useState(false);
  const [testResult, setTestResult] = useState<{ type: string; text: string } | null>(null);
  const [logs, setLogs] = useState<string[]>(["No recent activity..."]);
  const [isSending, setIsSending] = useState(false);
  const [progress, setProgress] = useState(0);

  const smtpQuery = trpc.smtp.getConfig.useQuery();
  const testConnection = trpc.smtp.testConnection.useQuery(undefined, {
    refetchInterval: 30000,
  });
  const emailLogsQuery = trpc.email.logs.useQuery();
  const sendTestMutation = trpc.email.sendTest.useMutation();
  const utils = trpc.useUtils();

  useEffect(() => {
    if (emailLogsQuery.data) {
      const logTexts = emailLogsQuery.data.map(
        (log) =>
          `${log.status === "sent" ? "✓" : "✗"} ${log.recipient} at ${new Date(log.createdAt).toLocaleTimeString()}`
      );
      if (logTexts.length > 0) {
        setLogs(logTexts.slice(0, 10));
      }
    }
  }, [emailLogsQuery.data]);

  const addLogEntry = (text: string) => {
    setLogs((prev) => {
      const newLogs = [text, ...prev.filter((l) => l !== "No recent activity...")];
      return newLogs.slice(0, 10);
    });
  };

  const handleSendTest = async () => {
    if (!recipient.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      setShowError(true);
      return;
    }
    setShowError(false);

    if (!subject || !message) {
      showToast("Please fill in subject and message");
      return;
    }

    setIsSending(true);
    setProgress(10);
    setTestResult(null);

    const progressInterval = setInterval(() => {
      setProgress((prev) => (prev < 80 ? prev + 10 : prev));
    }, 300);

    try {
      const result = await sendTestMutation.mutateAsync({
        to: recipient,
        subject,
        text: message,
        senderName: senderName || "✗ᴇɴᴅ8",
        priority: priority as "normal" | "high" | "low",
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (result.success) {
        setTestResult({
          type: "success",
          text: `✓ Email Sent Successfully\nID: ${result.messageId || "N/A"}\nTime: ${new Date().toLocaleTimeString()}`,
        });
        addLogEntry(`✓ Test email sent to ${recipient} at ${new Date().toLocaleTimeString()}`);
        utils.email.logs.invalidate();
      } else {
        setTestResult({
          type: "error",
          text: `✗ Failed to Send\n${result.error || "Unknown error"}`,
        });
        addLogEntry(`✗ Failed to send to ${recipient}: ${result.error}`);
      }
    } catch (error: any) {
      clearInterval(progressInterval);
      setProgress(0);
      setTestResult({
        type: "error",
        text: `✗ Failed to Send\n${error.message}`,
      });
      addLogEntry(`✗ Failed to send to ${recipient}: ${error.message}`);
    } finally {
      setTimeout(() => {
        setIsSending(false);
        setProgress(0);
      }, 1000);
    }
  };

  const clearForm = () => {
    setRecipient("");
    setSubject("Test Delivery from ✗ᴇɴᴅ8");
    setMessage("");
    setTestResult(null);
    setShowError(false);
  };

  const clearLogs = () => {
    setLogs(["No recent activity..."]);
  };

  const smtpConfig = smtpQuery.data;
  const smtpStatusClass = testConnection.data?.connected
    ? "online"
    : smtpConfig
    ? "offline"
    : "checking";
  const smtpStatusLabel = testConnection.data?.connected
    ? "Online"
    : smtpConfig
    ? "Error"
    : "Not Configured";

  return (
    <div className="animate-fadeIn">
      <div className="xend-subtitle">SMTP Configuration & Testing</div>

      {/* Current Configuration Card */}
      <div className="xend-card sweep-card">
        {/* Title row with status indicator inline */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <h3 style={{ margin: 0 }}>Current Configuration</h3>
          <div className={`api-status ${smtpStatusClass}`} style={{ fontSize: "0.8rem", padding: "5px 12px" }}>
            ● {smtpStatusLabel}
          </div>
        </div>

        <div className="smtp-grid" id="smtpConfigGrid">
          <div className="smtp-item">
            <div className="smtp-label">Host</div>
            <div className="smtp-value" id="smtpHost">
              {smtpConfig?.host || "Not configured"}
            </div>
          </div>
          <div className="smtp-item">
            <div className="smtp-label">Port</div>
            <div className="smtp-value" id="smtpPort">
              {smtpConfig?.port || "-"}
            </div>
          </div>
          <div className="smtp-item">
            <div className="smtp-label">Username</div>
            <div className="smtp-value masked" id="smtpUser">
              {smtpConfig?.username || "-"}
            </div>
          </div>
          <div className="smtp-item">
            <div className="smtp-label">Security</div>
            <div className="smtp-value" id="smtpSecure">
              {smtpConfig?.secure ? "TLS/SSL" : smtpConfig ? "None" : "-"}
            </div>
          </div>
        </div>

        <button
          className="xend-button secondary sweep-hover"
          onClick={() => {
            utils.smtp.getConfig.invalidate();
            testConnection.refetch();
          }}
          style={{ marginTop: 16 }}
        >
          ⟲ Refresh Config
        </button>
      </div>

      {/* Send Test Email Card */}
      <div className="xend-card sweep-card">
        <h3>Send Test Email</h3>
        <p style={{ fontSize: "0.9rem", color: "#888", marginBottom: 16 }}>
          Verify your SMTP configuration with a live delivery test.
        </p>

        <label style={{ color: "#999", fontSize: "0.85rem", display: "block", marginTop: 12 }}>
          Recipient Email *
        </label>
        <input
          className="xend-input"
          value={recipient}
          onChange={(e) => {
            setRecipient(e.target.value);
            setShowError(false);
          }}
          placeholder="recipient@example.com"
          type="email"
        />
        <div className={`error-text ${showError ? "show" : ""}`}>
          Please enter a valid email address
        </div>

        <label style={{ color: "#999", fontSize: "0.85rem", display: "block", marginTop: 12 }}>
          Sender Name
        </label>
        <input
          className="xend-input"
          value={senderName}
          onChange={(e) => setSenderName(e.target.value)}
          placeholder="✗ᴇɴᴅ8 Mailer"
        />

        <label style={{ color: "#999", fontSize: "0.85rem", display: "block", marginTop: 12 }}>
          Subject *
        </label>
        <input
          className="xend-input"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Test Delivery from ✗ᴇɴᴅ8"
        />

        <label style={{ color: "#999", fontSize: "0.85rem", display: "block", marginTop: 12 }}>
          Message *
        </label>
        <textarea
          className="xend-textarea"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Enter your test message here..."
        />

        <label style={{ color: "#999", fontSize: "0.85rem", display: "block", marginTop: 12 }}>
          Priority
        </label>
        <select
          className="xend-select"
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
        >
          <option value="normal">Normal</option>
          <option value="high">High</option>
          <option value="low">Low</option>
        </select>

        <div className={`progress-bar ${isSending ? "block" : "hidden"}`}>
          <div
            className="progress-fill"
            style={{ width: `${progress}%` }}
          />
        </div>

        {testResult && (
          <div className={`test-result show ${testResult.type}`}>
            <strong>{testResult.text.split("\n")[0]}</strong>
            <br />
            {testResult.text.split("\n").slice(1).join("\n")}
          </div>
        )}

        <button
          className={`xend-button tg-button sweep-hover ${isSending ? "loading" : ""}`}
          onClick={handleSendTest}
          disabled={isSending}
        >
          ꩜ Send Test
        </button>
        <button className="xend-button sweep-hover" onClick={clearForm}>
          Clear Form
        </button>
      </div>

      {/* Delivery Logs Card */}
      <div className="xend-card sweep-card">
        <h3>Delivery Logs</h3>
        <div
          style={{
            maxHeight: 200,
            overflowY: "auto",
            fontFamily: "monospace",
            fontSize: "0.8rem",
            color: "#666",
          }}
        >
          {logs.map((log, i) => (
            <div
              key={i}
              style={{
                padding: 8,
                borderBottom: "1px solid rgba(255,255,255,0.05)",
                color: log.startsWith("✓") ? "#2ed573" : log.startsWith("✗") ? "#ff6b6b" : "#666",
              }}
            >
              {log}
            </div>
          ))}
        </div>
        <button
          className="xend-button danger sweep-hover"
          onClick={clearLogs}
          style={{ marginTop: 12, fontSize: "0.85rem" }}
        >
          Clear Logs
        </button>
      </div>
    </div>
  );
}
