"use client";

import { useState } from "react";
import EarnRequestForm from "@/components/points/EarnRequestForm";
import EarnRequestList from "@/components/points/EarnRequestList";
import { MyPageCard } from "@/components/mypage/ui/MyPageCard";

export default function EarnRequestSection() {
  const [reloadToken, setReloadToken] = useState(0);

  return (
    <div className="space-y-6">
      <MyPageCard title="포인트 적립 요청">
        <EarnRequestForm onSubmitted={() => setReloadToken((v) => v + 1)} />
      </MyPageCard>
      <MyPageCard title="내 적립 요청 목록">
        <div key={reloadToken}>
          <EarnRequestList embedded />
        </div>
      </MyPageCard>
    </div>
  );
}
