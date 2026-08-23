#!/usr/bin/env python3
# Run on VPS: python3 /tmp/install_send_alimtalk.py
# Inserts /send-alimtalk into /root/aligo-server.js (no API secrets in this script).

from pathlib import Path

PATH = Path("/root/aligo-server.js")
src = PATH.read_text(encoding="utf-8")

if "/send-alimtalk" in src:
    print("already patched")
    raise SystemExit(0)

ENV = """
const ALIGO_KAKAO_SENDERKEY = process.env.ALIGO_KAKAO_SENDERKEY || "";
"""

HELPERS = r"""
async function createAligoKakaoToken() {
  const time = "1";
  const type = "h";
  const response = await fetch(
    `https://kakaoapi.aligo.in/akv10/token/create/${time}/${type}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        apikey: ALIGO_API_KEY,
        userid: ALIGO_USER_ID,
      }),
    }
  );

  const data = await response.json();
  if (!data || Number(data.code) !== 0 || !data.token) {
    const error = new Error((data && data.message) || "kakao token create failed");
    error.data = data;
    throw error;
  }
  return String(data.token);
}

async function sendAlimtalkViaAligo(payload) {
  if (!ALIGO_KAKAO_SENDERKEY) {
    const error = new Error("ALIGO_KAKAO_SENDERKEY is not set");
    error.code = "MISSING_SENDERKEY";
    throw error;
  }

  const token = await createAligoKakaoToken();
  const body = {
    apikey: ALIGO_API_KEY,
    userid: ALIGO_USER_ID,
    token,
    senderkey: ALIGO_KAKAO_SENDERKEY,
    tpl_code: String(payload.tpl_code || ""),
    sender: ALIGO_SENDER,
    receiver_1: normalizePhone(payload.receiver),
    subject_1: String(payload.subject || ""),
    message_1: String(payload.message || ""),
  };

  if (payload.recvname) body.recvname_1 = String(payload.recvname);
  if (payload.button) body.button_1 = String(payload.button);
  if (payload.failover === "Y" || payload.failover === "N") body.failover = payload.failover;
  if (payload.fsubject) body.fsubject_1 = String(payload.fsubject);
  if (payload.fmessage) body.fmessage_1 = String(payload.fmessage);
  if (payload.testMode === "Y" || payload.testMode === "N") body.testMode = payload.testMode;

  const response = await fetch("https://kakaoapi.aligo.in/akv10/alimtalk/send/", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body),
  });

  const text = await response.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    parsed = { raw: text };
  }

  const aligoOk = response.ok && Number(parsed && parsed.code) === 0;
  return {
    httpStatus: response.status,
    ok: aligoOk,
    data: parsed,
  };
}

"""

ROUTE = r"""
  if (req.method === "POST" && req.url === "/send-alimtalk") {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk;
    });

    req.on("end", async () => {
      try {
        const parsed = safeJsonParse(body);
        if (!parsed) {
          res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
          return res.end(JSON.stringify({ ok: false, message: "Invalid JSON body" }));
        }

        const receiver = normalizePhone(parsed.receiver);
        const tpl_code = String(parsed.tpl_code || "").trim();
        const subject = String(parsed.subject || "").trim();
        const message = String(parsed.message || "");
        const recvname = String(parsed.recvname || "").trim();
        const button = parsed.button != null ? String(parsed.button) : "";
        const failover = String(parsed.failover || "").trim().toUpperCase();
        const fsubject = String(parsed.fsubject || "").trim();
        const fmessage = String(parsed.fmessage || "").trim();
        const testMode = String(parsed.testMode || "").trim().toUpperCase();

        if (!receiver || !tpl_code || !subject || !String(message || "").trim()) {
          res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
          return res.end(
            JSON.stringify({
              ok: false,
              message: "receiver, tpl_code, subject, message are required",
            })
          );
        }

        console.log("[alimtalk] send request received", {
          receiver,
          tpl_code,
          subject,
          hasButton: Boolean(button),
          failover: failover || null,
          testMode: testMode || null,
          messagePreview: message.slice(0, 120),
        });

        const result = await sendAlimtalkViaAligo({
          receiver,
          recvname: recvname || undefined,
          tpl_code,
          subject,
          message,
          button: button || undefined,
          failover: failover === "Y" || failover === "N" ? failover : undefined,
          fsubject: fsubject || undefined,
          fmessage: fmessage || undefined,
          testMode: testMode === "Y" || testMode === "N" ? testMode : undefined,
        });

        console.log("[alimtalk] send result", {
          receiver,
          httpStatus: result.httpStatus,
          ok: result.ok,
          aligo: result.data,
        });

        res.writeHead(result.ok ? 200 : 502, {
          "Content-Type": "application/json; charset=utf-8",
        });
        return res.end(
          JSON.stringify({
            ok: result.ok,
            data: result.data,
          })
        );
      } catch (error) {
        console.error("[alimtalk] relay fatal error", error);
        res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
        return res.end(
          JSON.stringify({
            ok: false,
            message: error instanceof Error ? error.message : String(error),
            data: error && error.data ? error.data : undefined,
          })
        );
      }
    });

    return;
  }

"""

bak = PATH.with_name("aligo-server.js.bak-alimtalk")
bak.write_text(src, encoding="utf-8")
print("backup:", bak)

needle_env = 'const ENABLE_ADMIN_COPY = String(process.env.ALIGO_ENABLE_ADMIN_COPY || "true").toLowerCase() === "true";\n'
if "ALIGO_KAKAO_SENDERKEY" not in src:
    if needle_env not in src:
        raise SystemExit("ENABLE_ADMIN_COPY marker not found")
    src = src.replace(needle_env, needle_env + ENV, 1)

needle_server = "const server = http.createServer(async (req, res) => {"
if needle_server not in src:
    raise SystemExit("server marker not found")
src = src.replace(needle_server, HELPERS + needle_server, 1)

needle_404 = '  res.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });'
if needle_404 not in src:
    raise SystemExit("404 marker not found")
src = src.replace(needle_404, ROUTE + needle_404, 1)

PATH.write_text(src, encoding="utf-8")
print("patched ok:", PATH)
print("lines:", src.count("\n") + 1)
