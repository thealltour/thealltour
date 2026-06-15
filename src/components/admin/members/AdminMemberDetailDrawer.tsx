"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import AdminMemberDetailPage from "@/components/admin/members/AdminMemberDetailPage";

type Props = {
  memberId: string | null;
  isOpen: boolean;
  onClose: () => void;
  members: Array<{ id: string }>;
};

export default function AdminMemberDetailDrawer({
  memberId,
  isOpen,
  onClose,
  members,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const currentIndex = members.findIndex((m) => m.id === memberId);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < members.length - 1;

  function goToIndex(index: number) {
    if (index < 0 || index >= members.length) return;
    const nextId = members[index].id;
    const params = new URLSearchParams(searchParams.toString());
    params.set("memberId", nextId);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  function goPrev() {
    if (hasPrev) goToIndex(currentIndex - 1);
  }

  function goNext() {
    if (hasNext) goToIndex(currentIndex + 1);
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      wrapperClassName="p-2 sm:p-4 md:p-6"
      className="flex h-[min(94vh,960px)] w-full max-w-[min(96vw,1400px)] flex-col overflow-hidden p-0"
      aria-label="회원 상세"
    >
      {memberId ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <AdminMemberDetailPage
            memberId={memberId}
            mode="modal"
            onClose={onClose}
            navigation={{
              currentIndex,
              total: members.length,
              onPrev: goPrev,
              onNext: goNext,
              hasPrev,
              hasNext,
            }}
          />
        </div>
      ) : null}
    </Modal>
  );
}
