"use client";

import { useState } from "react";
import ReviewReportModal from "./ReviewReportModal";

type Props = {
  reviewId: string;
  viewerReported?: boolean;
};

export default function ReviewDetailReportButton({ reviewId, viewerReported }: Props) {
  const [modalOpen, setModalOpen] = useState(false);

  if (viewerReported) {
    return (
      <span className="text-sm text-slate-400">신고됨</span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="text-sm text-slate-500 underline hover:text-slate-700"
      >
        신고하기
      </button>
      {modalOpen && (
        <ReviewReportModal
          reviewId={reviewId}
          onClose={() => setModalOpen(false)}
          onSuccess={() => setModalOpen(false)}
        />
      )}
    </>
  );
}
