"use client";

import { useState, useRef, useEffect } from "react";
import ReviewReportModal from "./ReviewReportModal";

type Props = {
  reviewId: string;
  viewerReported?: boolean;
};

export default function ReviewCardReportButton({ reviewId, viewerReported }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [menuOpen]);

  const openReportModal = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuOpen(false);
    setModalOpen(true);
  };

  const toggleMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuOpen((prev) => !prev);
  };

  return (
    <div ref={menuRef} className="relative shrink-0">
      <button
        type="button"
        onClick={toggleMenu}
        aria-label="메뉴 열기"
        className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
      >
        <span className="text-lg leading-none">⋯</span>
      </button>
      {menuOpen && (
        <div
          className="absolute right-0 top-full z-10 mt-1 min-w-[120px] rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
          role="menu"
        >
          <button
            type="button"
            onClick={openReportModal}
            disabled={viewerReported}
            role="menuitem"
            className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-transparent"
          >
            {viewerReported ? "신고됨" : "신고하기"}
          </button>
        </div>
      )}
      {modalOpen && (
        <ReviewReportModal
          reviewId={reviewId}
          onClose={() => setModalOpen(false)}
          onSuccess={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}
