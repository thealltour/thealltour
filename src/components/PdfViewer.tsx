"use client";

import { useEffect, useRef, useState } from "react";

let workerInitialized = false;

async function getPdfjs() {
  const pdfjsLib = await import("pdfjs-dist");
  if (!workerInitialized && typeof window !== "undefined") {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
    workerInitialized = true;
  }
  return pdfjsLib;
}

type PdfViewerProps = {
  url: string;
  className?: string;
};

export function PdfViewer({ url, className = "" }: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    if (!url?.trim()) {
      setStatus("error");
      setErrorMsg("PDF URL이 없습니다.");
      return;
    }

    let cancelled = false;

    async function loadAndRender() {
      try {
        const pdfjsLib = await getPdfjs();
        const loadingTask = pdfjsLib.getDocument({
          url,
          cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/cmaps/`,
          cMapPacked: true,
        });
        const pdf = await loadingTask.promise;
        if (cancelled) return;

        const numPages = pdf.numPages;
        const container = containerRef.current;
        if (!container) return;

        const winWidth = typeof window !== "undefined" ? window.innerWidth : 400;
        const containerWidth = container.clientWidth || Math.min(winWidth - 48, 800);
        const maxWidth = Math.max(containerWidth, 280);

        for (let i = 1; i <= numPages; i++) {
          if (cancelled) return;
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 1 });
          const scale = maxWidth / viewport.width;
          const scaledViewport = page.getViewport({ scale });
          const width = Math.round(scaledViewport.width);
          const height = Math.round(scaledViewport.height);

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          canvas.className = "mx-auto block w-full max-w-full";
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          await page.render({
            canvasContext: ctx,
            viewport: scaledViewport,
            canvas,
          }).promise;

          const wrapper = document.createElement("div");
          wrapper.className = "flex justify-center bg-white";
          wrapper.appendChild(canvas);
          container.appendChild(wrapper);
        }

        if (!cancelled) setStatus("ready");
      } catch (err) {
        if (!cancelled) {
          setStatus("error");
          setErrorMsg(err instanceof Error ? err.message : "PDF 로드에 실패했습니다.");
        }
      }
    }

    loadAndRender();
    return () => {
      cancelled = true;
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [url]);

  if (status === "loading") {
    return (
      <div className={`flex flex-1 items-center justify-center bg-slate-100 ${className}`}>
        <p className="text-sm text-slate-500">PDF 불러오는 중…</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className={`flex flex-1 flex-col items-center justify-center gap-2 bg-slate-100 p-6 ${className}`}>
        <p className="text-sm text-red-600">{errorMsg}</p>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-blue-600 underline hover:text-blue-800"
        >
          새 탭에서 PDF 열기
        </a>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`flex flex-col gap-1 overflow-y-auto bg-slate-100 py-2 ${className}`}
      style={{ minHeight: 200 }}
    />
  );
}
