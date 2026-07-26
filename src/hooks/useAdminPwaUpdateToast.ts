"use client";

import { useEffect, useState } from "react";
import {
  getAdminServiceWorkerRegistration,
  registerAdminServiceWorker,
} from "@/lib/adminPwaClient";

/**
 * SW 업데이트 감지 후 「새로고침」 유도.
 */
export function useAdminPwaUpdateToast() {
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let intervalId = 0;

    async function setup() {
      const registration =
        (await registerAdminServiceWorker()) ?? (await getAdminServiceWorkerRegistration());
      if (!registration || cancelled) return;

      if (registration.waiting) {
        setUpdateReady(true);
      }

      const onUpdateFound = () => {
        const installing = registration.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          if (installing.state === "installed" && navigator.serviceWorker.controller) {
            setUpdateReady(true);
          }
        });
      };
      registration.addEventListener("updatefound", onUpdateFound);

      intervalId = window.setInterval(() => {
        void registration.update().catch(() => {});
      }, 60 * 60 * 1000);
    }

    void setup();

    return () => {
      cancelled = true;
      if (intervalId) window.clearInterval(intervalId);
    };
  }, []);

  function applyUpdate() {
    void (async () => {
      const registration = await getAdminServiceWorkerRegistration();
      if (registration?.waiting) {
        const onChange = () => {
          navigator.serviceWorker?.removeEventListener("controllerchange", onChange);
          window.location.reload();
        };
        navigator.serviceWorker?.addEventListener("controllerchange", onChange);
        registration.waiting.postMessage({ type: "SKIP_WAITING" });
        window.setTimeout(() => window.location.reload(), 1200);
        return;
      }
      window.location.reload();
    })();
  }

  function dismiss() {
    setUpdateReady(false);
  }

  return { updateReady, applyUpdate, dismiss };
}
