/**
 * 가비아 VPS용 알림톡 relay 샘플 (Express).
 * 실제 VPS 코드베이스에 이식할 때 참고용 — 이 파일만으로 서버를 띄우지 마세요.
 *
 * 의존: express, form-data, node-fetch(또는 내장 fetch)
 * 알리고 공식 예제: node.js_alim_example (token → alimtalkSend)
 *
 * env:
 *   ALIGO_API_KEY
 *   ALIGO_USER_ID
 *   ALIGO_SENDER
 *   ALIGO_KAKAO_SENDERKEY
 */

/* eslint-disable @typescript-eslint/no-require-imports */
const express = require("express");
const FormData = require("form-data");

const app = express();
app.use(express.json({ limit: "256kb" }));

const TOKEN_TTL_TYPE = "h";
const TOKEN_TTL_TIME = "1";

async function createAligoKakaoToken() {
  const apikey = process.env.ALIGO_API_KEY;
  const userid = process.env.ALIGO_USER_ID;
  if (!apikey || !userid) {
    throw new Error("ALIGO_API_KEY / ALIGO_USER_ID missing");
  }

  const form = new FormData();
  form.append("apikey", apikey);
  form.append("userid", userid);

  const url = `https://kakaoapi.aligo.in/akv10/token/create/${TOKEN_TTL_TIME}/${TOKEN_TTL_TYPE}`;
  const res = await fetch(url, { method: "POST", body: form, headers: form.getHeaders() });
  const data = await res.json();
  if (!data || data.code !== 0 || !data.token) {
    throw new Error(data?.message || "token create failed");
  }
  return String(data.token);
}

/**
 * POST /send-alimtalk
 * Body: { receiver, recvname?, tpl_code, subject, message, button?, failover?, fsubject?, fmessage?, testMode? }
 */
app.post("/send-alimtalk", async (req, res) => {
  try {
    const {
      receiver,
      recvname,
      tpl_code,
      subject,
      message,
      button,
      failover,
      fsubject,
      fmessage,
      testMode,
    } = req.body || {};

    if (!receiver || !tpl_code || !subject || !message) {
      return res.status(400).json({ ok: false, message: "receiver, tpl_code, subject, message required" });
    }

    const senderkey = process.env.ALIGO_KAKAO_SENDERKEY;
    const sender = process.env.ALIGO_SENDER;
    const apikey = process.env.ALIGO_API_KEY;
    const userid = process.env.ALIGO_USER_ID;
    if (!senderkey || !sender || !apikey || !userid) {
      return res.status(500).json({ ok: false, message: "VPS Aligo env incomplete" });
    }

    const token = await createAligoKakaoToken();

    const form = new FormData();
    form.append("apikey", apikey);
    form.append("userid", userid);
    form.append("token", token);
    form.append("senderkey", senderkey);
    form.append("tpl_code", String(tpl_code));
    form.append("sender", sender);
    form.append("receiver_1", String(receiver).replace(/\D/g, ""));
    form.append("subject_1", String(subject));
    form.append("message_1", String(message));
    if (recvname) form.append("recvname_1", String(recvname));
    if (button) form.append("button_1", String(button));
    if (failover === "Y" || failover === "N") form.append("failover", failover);
    if (fsubject) form.append("fsubject_1", String(fsubject));
    if (fmessage) form.append("fmessage_1", String(fmessage));
    if (testMode === "Y" || testMode === "N") form.append("testMode", testMode);

    const aligoRes = await fetch("https://kakaoapi.aligo.in/akv10/alimtalk/send/", {
      method: "POST",
      body: form,
      headers: form.getHeaders(),
    });
    const data = await aligoRes.json();

    if (!aligoRes.ok || (data && typeof data.code === "number" && data.code !== 0)) {
      return res.status(502).json({ ok: false, data });
    }

    return res.status(200).json({ ok: true, data });
  } catch (err) {
    console.error("[send-alimtalk]", err);
    return res.status(500).json({
      ok: false,
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

// app.listen(3000);
module.exports = { app };
