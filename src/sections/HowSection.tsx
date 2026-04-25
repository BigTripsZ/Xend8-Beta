export default function HowSection() {
  return (
    <div className="animate-fadeIn">
      <div className="xend-card sweep-card">
        <h3>System Overview</h3>
        <p>The platform connects through secure webhook endpoints. All email operations are processed through your configured SMTP infrastructure with real-time status tracking.</p>
        <p>Users navigate through intuitive menus guiding them through campaign creation and address verification workflows.</p>
      </div>

      <div className="xend-card sweep-card">
        <h3>Email Delivery Flow</h3>
        <p>1. Select Single Send or Bulk Campaign.</p>
        <p>2. Configure delivery parameters:</p>
        <p>
          • Recipient list or verification queue<br />
          • Sender identity & authentication<br />
          • Subject line & content<br />
          • Priority & scheduling<br />
          • Attachment handling
        </p>
        <p>3. SMTP connection established with TLS/SSL.</p>
        <p>4. Sequential delivery with animated progress tracking.</p>
      </div>

      <div className="xend-card sweep-card">
        <h3>Verification Engine</h3>
        <p>Validate email addresses before sending to protect sender reputation. Check syntax, domain MX records, and mailbox existence in real-time.</p>
      </div>

      <div className="xend-card sweep-card">
        <h3>Security</h3>
        <p>Access controlled via approved Telegram IDs. Administrative functions protected with role-based permissions managed directly through the bot interface.</p>
      </div>
    </div>
  );
}
