/**
 * Sentinel Pre-Signature Firewall
 * Drag this file's bookmarklet link to your bookmarks bar.
 * Click it on any bags.fm/token/... page to see the risk score before signing.
 */
(function () {
  const API = 'https://sentinel-api.apiworkersdev.workers.dev/v1';

  // Extract mint from bags.fm URL patterns
  function extractMint() {
    const url = window.location.href;
    const patterns = [
      /bags\.fm\/token\/([1-9A-HJ-NP-Za-km-z]{32,44})/,
      /bags\.fm\/[^/]+\/([1-9A-HJ-NP-Za-km-z]{32,44})/,
    ];
    for (const p of patterns) {
      const m = url.match(p);
      if (m) return m[1];
    }
    // Also look in page text for Solana address near "mint" or "CA"
    const pageText = document.body.innerText;
    const addrMatch = pageText.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/g);
    return addrMatch ? addrMatch[0] : null;
  }

  function tierColor(tier) {
    if (!tier) return '#6b7280';
    const t = tier.toLowerCase();
    if (t === 'safe') return '#22c55e';
    if (t === 'caution') return '#f59e0b';
    if (t === 'danger') return '#ef4444';
    return '#6b7280';
  }

  function tierEmoji(tier) {
    if (!tier) return '❓';
    const t = tier.toLowerCase();
    if (t === 'safe') return '✅';
    if (t === 'caution') return '⚠️';
    if (t === 'danger') return '🚨';
    return '❓';
  }

  function removeExisting() {
    const old = document.getElementById('sentinel-firewall-overlay');
    if (old) old.remove();
  }

  function showLoading() {
    removeExisting();
    const overlay = document.createElement('div');
    overlay.id = 'sentinel-firewall-overlay';
    overlay.style.cssText = `
      position: fixed; top: 20px; right: 20px; z-index: 999999;
      background: #0f172a; border: 1px solid #1e293b;
      border-radius: 16px; padding: 20px 24px;
      font-family: 'Inter', -apple-system, sans-serif;
      color: #fff; min-width: 280px; max-width: 340px;
      box-shadow: 0 25px 50px rgba(0,0,0,0.6);
      animation: sentinel-slide-in 0.2s ease;
    `;
    overlay.innerHTML = `
      <style>
        @keyframes sentinel-slide-in { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes sentinel-spin { to { transform: rotate(360deg); } }
        #sentinel-firewall-overlay * { box-sizing: border-box; }
      </style>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">
        <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
          <path d="M16 3L4 8v8c0 6.627 5.148 12.347 12 13.93C22.852 28.347 28 22.627 28 16V8L16 3z" fill="rgba(6,182,212,0.15)" stroke="rgba(6,182,212,0.6)" stroke-width="1.5"/>
          <circle cx="16" cy="16" r="4" fill="none" stroke="#06b6d4" stroke-width="1.5"/>
          <circle cx="16" cy="16" r="1.5" fill="#06b6d4"/>
        </svg>
        <span style="font-size:13px;font-weight:700;color:#06b6d4;letter-spacing:0.05em;">SENTINEL</span>
        <button onclick="document.getElementById('sentinel-firewall-overlay').remove()"
          style="margin-left:auto;background:none;border:none;color:#6b7280;cursor:pointer;font-size:16px;line-height:1;">✕</button>
      </div>
      <p style="font-size:11px;color:#475569;margin:0 0 14px;">Pre-Signature Risk Check</p>
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="width:18px;height:18px;border:2px solid #06b6d4;border-top-color:transparent;border-radius:50%;animation:sentinel-spin 0.8s linear infinite;flex-shrink:0;"></div>
        <span style="font-size:13px;color:#94a3b8;">Analyzing token risk…</span>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  function showResult(data, mint) {
    removeExisting();
    const score = data.score ?? 0;
    const tier = data.tier ?? 'unknown';
    const color = tierColor(tier);
    const emoji = tierEmoji(tier);
    const signals = data.breakdown ? Object.entries(data.breakdown).slice(0, 4) : [];

    const scoreBar = `
      <div style="margin:12px 0;">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
          <span style="font-size:10px;color:#475569;text-transform:uppercase;letter-spacing:0.05em;">Risk Score</span>
          <span style="font-size:10px;color:${color};font-weight:700;">${score}/100</span>
        </div>
        <div style="height:4px;background:#1e293b;border-radius:99px;overflow:hidden;">
          <div style="height:100%;width:${score}%;background:${color};border-radius:99px;transition:width 0.5s;"></div>
        </div>
      </div>
    `;

    const signalList = signals.length > 0 ? `
      <div style="margin-top:10px;space-y:2px;">
        ${signals.map(([k, v]) => `
          <div style="display:flex;justify-content:space-between;padding:2px 0;border-bottom:1px solid #1e293b;">
            <span style="font-size:10px;color:#64748b;text-transform:capitalize;">${k.replace(/_/g,' ')}</span>
            <span style="font-size:10px;color:#94a3b8;font-weight:600;">${Math.round(v)}</span>
          </div>
        `).join('')}
      </div>
    ` : '';

    const actionColor = tier === 'danger' ? '#ef4444' : tier === 'caution' ? '#f59e0b' : '#22c55e';
    const actionText = tier === 'danger' ? '🚫 High Risk — Reconsider' : tier === 'caution' ? '⚠️ Proceed with caution' : '✅ Looks safe';

    const overlay = document.createElement('div');
    overlay.id = 'sentinel-firewall-overlay';
    overlay.style.cssText = `
      position: fixed; top: 20px; right: 20px; z-index: 999999;
      background: #0f172a; border: 1px solid ${color}40;
      border-radius: 16px; padding: 20px 24px;
      font-family: 'Inter', -apple-system, sans-serif;
      color: #fff; min-width: 280px; max-width: 340px;
      box-shadow: 0 25px 50px rgba(0,0,0,0.6), 0 0 0 1px ${color}20;
      animation: sentinel-slide-in 0.2s ease;
    `;
    overlay.innerHTML = `
      <style>@keyframes sentinel-slide-in { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }</style>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">
        <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
          <path d="M16 3L4 8v8c0 6.627 5.148 12.347 12 13.93C22.852 28.347 28 22.627 28 16V8L16 3z" fill="rgba(6,182,212,0.15)" stroke="rgba(6,182,212,0.6)" stroke-width="1.5"/>
          <circle cx="16" cy="16" r="4" fill="none" stroke="#06b6d4" stroke-width="1.5"/>
          <circle cx="16" cy="16" r="1.5" fill="#06b6d4"/>
        </svg>
        <span style="font-size:13px;font-weight:700;color:#06b6d4;letter-spacing:0.05em;">SENTINEL</span>
        <button onclick="document.getElementById('sentinel-firewall-overlay').remove()"
          style="margin-left:auto;background:none;border:none;color:#6b7280;cursor:pointer;font-size:16px;line-height:1;">✕</button>
      </div>
      <p style="font-size:11px;color:#475569;margin:0 0 12px;">Pre-Signature Risk Check</p>

      <div style="display:flex;align-items:center;gap:12px;padding:12px;background:#0a0e1a;border-radius:10px;border:1px solid #1e293b;">
        <span style="font-size:32px;">${emoji}</span>
        <div>
          <div style="font-size:22px;font-weight:900;color:${color};line-height:1;">${score}</div>
          <div style="font-size:11px;color:${color};text-transform:uppercase;font-weight:700;letter-spacing:0.08em;">${tier}</div>
        </div>
        <div style="margin-left:auto;font-size:9px;color:#334155;font-family:monospace;">${mint.slice(0,6)}…${mint.slice(-4)}</div>
      </div>

      ${scoreBar}
      ${signalList}

      <div style="margin-top:12px;padding:8px 12px;background:${actionColor}15;border:1px solid ${actionColor}30;border-radius:8px;font-size:11px;color:${actionColor};font-weight:600;">
        ${actionText}
      </div>

      <a href="https://sentinel-dashboard-3uy.pages.dev?mint=${mint}" target="_blank"
        style="display:block;margin-top:10px;text-align:center;font-size:10px;color:#06b6d4;text-decoration:none;opacity:0.7;">
        Full report on Sentinel ↗
      </a>
    `;
    document.body.appendChild(overlay);
  }

  function showError(msg) {
    removeExisting();
    const overlay = document.createElement('div');
    overlay.id = 'sentinel-firewall-overlay';
    overlay.style.cssText = `
      position:fixed;top:20px;right:20px;z-index:999999;
      background:#0f172a;border:1px solid #ef444440;border-radius:16px;
      padding:20px 24px;font-family:'Inter',-apple-system,sans-serif;
      color:#fff;min-width:260px;box-shadow:0 25px 50px rgba(0,0,0,0.6);
    `;
    overlay.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <span style="font-size:13px;font-weight:700;color:#06b6d4;">SENTINEL</span>
        <button onclick="document.getElementById('sentinel-firewall-overlay').remove()"
          style="background:none;border:none;color:#6b7280;cursor:pointer;font-size:16px;">✕</button>
      </div>
      <p style="font-size:12px;color:#ef4444;margin:0;">⚠️ ${msg}</p>
    `;
    document.body.appendChild(overlay);
  }

  // Main
  const mint = extractMint();
  if (!mint) {
    showError('No token found. Navigate to a bags.fm token page first.');
    return;
  }

  showLoading();

  fetch(`${API}/risk/${mint}`)
    .then(r => r.json())
    .then(body => {
      if (body.ok && body.data) showResult(body.data, mint);
      else showError('Could not fetch risk data.');
    })
    .catch(() => showError('Network error. Check connection.'));
})();
