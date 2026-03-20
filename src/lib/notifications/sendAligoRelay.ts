export async function sendAligoRelay(params: { receiver: string; msg: string }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch("http://121.78.183.144:3000/send-aligo", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        receiver: params.receiver,
        msg: params.msg,
      }),
      signal: controller.signal,
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const error = new Error(`Aligo relay HTTP ${response.status}`);
      (error as any).data = data;
      throw error;
    }

    return { ok: true, data };
  } finally {
    clearTimeout(timeout);
  }
}

