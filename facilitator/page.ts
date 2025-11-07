/**
 * Generates the HTML landing page for the facilitator
 */
export function getFacilitatorPage(options: {
  networks: string[];
}): string {
  const { networks } = options;
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Amiko x402 Facilitator</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #37768b 0%, #2a5a6b 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      max-width: 640px;
      width: 100%;
      padding: 40px;
    }
    h1 {
      color: #1a202c;
      font-size: 32px;
      margin-bottom: 8px;
    }
    .logo {
      height: 24px;
      vertical-align: middle;
    }
    .subtitle {
      color: #718096;
      font-size: 16px;
      margin-bottom: 32px;
    }
    .status {
      display: inline-block;
      background: #48bb78;
      color: white;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 32px;
    }
    .section {
      margin-bottom: 32px;
    }
    .section-title {
      color: #2d3748;
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .endpoint {
      background: #f7fafc;
      border-left: 4px solid #37768b;
      padding: 12px 16px;
      margin-bottom: 8px;
      border-radius: 4px;
    }
    .endpoint-path {
      font-family: 'Monaco', 'Courier New', monospace;
      color: #37768b;
      font-weight: 600;
      font-size: 14px;
    }
    .endpoint-desc {
      color: #718096;
      font-size: 13px;
      margin-top: 4px;
    }
    .network {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #edf2f7;
      padding: 6px 12px;
      border-radius: 6px;
      margin-right: 6px;
      margin-bottom: 6px;
    }
    .network-badge {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #48bb78;
    }
    .network-name {
      color: #2d3748;
      font-weight: 500;
      font-size: 13px;
    }
    .footer {
      margin-top: 32px;
      padding-top: 24px;
      border-top: 1px solid #e2e8f0;
      text-align: center;
      color: #a0aec0;
      font-size: 13px;
    }
    .footer a {
      color: #37768b;
      text-decoration: none;
      font-weight: 500;
      transition: opacity 0.2s;
    }
    .footer a:hover {
      opacity: 0.7;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🚀 Amiko x402 Facilitator</h1>
    <p class="subtitle">Payment verification and settlement service</p>
    <div class="status">● Running</div>
    
    <div class="section">
      <div class="section-title">
        📡 API Endpoints
      </div>
      <div class="endpoint">
        <div class="endpoint-path">GET /supported</div>
        <div class="endpoint-desc">Get supported payment networks and schemes</div>
      </div>
      <div class="endpoint">
        <div class="endpoint-path">POST /prepare</div>
        <div class="endpoint-desc">Prepare unsigned transaction for client wallet to sign</div>
      </div>
      <div class="endpoint">
        <div class="endpoint-path">POST /verify</div>
        <div class="endpoint-desc">Verify payment payload against requirements</div>
      </div>
      <div class="endpoint">
        <div class="endpoint-path">POST /settle</div>
        <div class="endpoint-desc">Settle verified payment on-chain</div>
      </div>
    </div>
    
    <div class="section">
      <div class="section-title">
        🌐 Network Support
      </div>
      ${networks.map(network => `
      <div class="network">
        <div class="network-badge"></div>
        <div class="network-name">${network}</div>
      </div>
      `).join('')}
      <div style="margin-top: 12px; color: #718096; font-size: 13px;">
         • Solana Trustless Agent Protocol is supported • <a href="https://trustless.heyamiko.com/" target="_blank" rel="noopener noreferrer" style="color: #37768b; text-decoration: none; font-weight: 500;">details</a>
      </div>
    </div>
    
    <div class="footer">
      Powered by x402
      <br><br>
      <a href="https://heyamiko.com/" target="_blank" rel="noopener noreferrer">
        <img src="https://platform.heyamiko.com/amiko-logo.png" alt="Amiko Logo" class="logo">
      </a>
    </div>
  </div>
</body>
</html>
  `;
}
