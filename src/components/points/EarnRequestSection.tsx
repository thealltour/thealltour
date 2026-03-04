"use client";

import { useState } from "react";
import EarnRequestForm from "@/components/points/EarnRequestForm";
import EarnRequestList from "@/components/points/EarnRequestList";

export default function EarnRequestSection() {
  const [reloadToken, setReloadToken] = useState(0);

  return (
    <div className="space-y-4">
      <EarnRequestForm onSubmitted={() => setReloadToken((v) => v + 1)} />
      <div key={reloadToken}>
        <EarnRequestList />
      </div>
    </div>
  );
}
