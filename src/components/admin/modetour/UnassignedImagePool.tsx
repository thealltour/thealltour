"use client";

import { useCallback, useMemo, useState, memo } from "react";
import { setDragData } from "./modetourImageDnd";
import { normalizeProductImageUrl } from "@/lib/media/normalizeProductImageUrl";
import type { ImagePlacementIssue, IssuesByUrl } from "./modetourImageValidation";
import type { ItineraryV2Day } from "@/types/product";
import type { SelectedEventRef } from "@/types/product";
import {
  buildUnassignedDuplicateMeta,
  getAdminImageBadgeLabels,
  getImageHeuristicFlags,
} from "./modetourImageHeuristics";
import { normalizeImageUrl } from "@/lib/images/normalizeImageUrl";

const INITIAL_VISIBLE = 30;
const LOAD_MORE = 30;

export type UnassignedImagePoolProps = {
  imageUrls: string[];
  title?: string;
  className?: string;
  heroImageUrl?: string | null;
  issuesByUrl?: IssuesByUrl;
  activeDayIndex: number;
  v2Days: ItineraryV2Day[];
  selectedEvent: SelectedEventRef | null;
  selectedEventSummary?: string | null;
  onRemoveUrls: (urls: string[]) => void;
  onSetHero: (url: string) => void;
  onAddToSelectedEvent?: (url: string) => void;
  onAddToDayFirstEvent?: (url: string, dayIndex: number) => void;
  onAddToDayLastEvent?: (url: string, dayIndex: number) => void;
  onToast: (message: string) => void;
  onAutoAssignImages?: () => void;
  onRecommendHero?: () => void;
  /** 모두투어 검수: normalizeImageUrl 기준 삭제 예정(저장 시 제외) */
  imageReviewMode?: boolean;
  markedDeletedNormUrls?: ReadonlySet<string>;
  onToggleMarkedDeleted?: (normalizedUrl: string) => void;
};

type PoolCardProps = {
  url: string;
  globalIndex: number;
  heroImageUrl?: string | null;
  badges: string[];
  placementIssues: ImagePlacementIssue[] | undefined;
  selected: boolean;
  onToggleSelect: () => void;
  onRemoveOne: () => void;
  onSetHero: () => void;
  onAddSelectedEvent?: () => void;
  onAddFirst?: () => void;
  onAddLast?: () => void;
  onKeepOnlyInDuplicateGroup?: () => void;
  showKeepOnly: boolean;
  canAddToEvent: boolean;
  onToast: (message: string) => void;
  imageReviewMode?: boolean;
  isMarkedDeleted?: boolean;
  onToggleMarkedDeleted?: () => void;
};

const PoolCard = memo(function PoolCard({
  url,
  globalIndex,
  heroImageUrl,
  badges,
  placementIssues,
  selected,
  onToggleSelect,
  onRemoveOne,
  onSetHero,
  onAddSelectedEvent,
  onAddFirst,
  onAddLast,
  onKeepOnlyInDuplicateGroup,
  showKeepOnly,
  canAddToEvent,
  onToast,
  imageReviewMode,
  isMarkedDeleted,
  onToggleMarkedDeleted,
}: PoolCardProps) {
  const [broken, setBroken] = useState(false);
  const isHero = heroImageUrl && normalizeImageUrl(heroImageUrl) === normalizeImageUrl(url);
  const displaySrc = normalizeProductImageUrl(url) || url;
  const issueBadges = placementIssues?.filter((i) => i.level === "warning").length
    ? [`배치 경고 ${placementIssues!.filter((x) => x.level === "warning").length}`]
    : [];
  const errCount = placementIssues?.filter((i) => i.level === "error").length ?? 0;

  const handleDragStart = (e: React.DragEvent) => {
    setDragData(e.dataTransfer, { source: "unassigned", url });
    e.dataTransfer.effectAllowed = "copy";
  };

  return (
    <div
      className={`group relative flex flex-col overflow-hidden rounded-lg border bg-slate-800 transition ${
        selected ? "border-[var(--primary)] ring-2 ring-[var(--primary)]/40" : "border-slate-600"
      } ${isHero ? "ring-2 ring-amber-500/60" : ""} ${isMarkedDeleted ? "opacity-50" : ""}`}
    >
      <div className="flex items-center gap-1 border-b border-slate-600/80 bg-slate-900/80 px-1.5 py-1">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          className="h-3.5 w-3.5 rounded border-slate-500"
          aria-label={`이미지 ${globalIndex + 1} 선택`}
        />
        <span className="text-[10px] font-mono text-slate-400">#{globalIndex + 1}</span>
        {isHero && (
          <span className="rounded bg-amber-600/90 px-1 py-0.5 text-[9px] font-bold text-white">대표</span>
        )}
        {isMarkedDeleted && (
          <span className="rounded bg-red-900/90 px-1 py-0.5 text-[9px] font-bold text-red-100">삭제 예정</span>
        )}
      </div>
      <div
        draggable
        onDragStart={handleDragStart}
        className="relative aspect-square cursor-grab overflow-hidden bg-slate-900 active:cursor-grabbing"
        title="드래그하여 이벤트에 배치"
        role="presentation"
      >
        {broken ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-2 text-center text-[10px] text-slate-500">
            <span>이미지 로드 실패</span>
            <span className="line-clamp-3 break-all font-mono text-[9px] opacity-80">{url}</span>
          </div>
        ) : (
          <img
            src={displaySrc}
            alt=""
            className="h-full w-full object-cover"
            draggable={false}
            onError={() => setBroken(true)}
          />
        )}
      </div>
      <div className="flex flex-wrap gap-0.5 border-b border-slate-600/80 p-1">
        {badges.map((b) => (
          <span
            key={b}
            className="rounded bg-slate-700 px-1 py-0.5 text-[9px] font-medium text-amber-200/90"
          >
            {b}
          </span>
        ))}
        {errCount > 0 && (
          <span className="rounded bg-red-900/60 px-1 py-0.5 text-[9px] text-red-200">오류 {errCount}</span>
        )}
        {issueBadges.map((b) => (
          <span key={b} className="rounded bg-amber-900/40 px-1 py-0.5 text-[9px] text-amber-200">
            {b}
          </span>
        ))}
      </div>
      <p className="line-clamp-2 break-all px-1.5 py-1 font-mono text-[9px] text-slate-500" title={url}>
        {url.length > 72 ? `${url.slice(0, 72)}…` : url}
      </p>
      <div className="mt-auto flex flex-col gap-0.5 p-1.5">
        <div className="flex flex-wrap gap-0.5">
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(url);
              onToast("URL을 클립보드에 복사했습니다.");
            }}
            className="rounded border border-slate-600 bg-slate-700 px-1 py-0.5 text-[9px] text-slate-200 hover:bg-slate-600"
          >
            복사
          </button>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded border border-slate-600 bg-slate-700 px-1 py-0.5 text-[9px] text-sky-300 hover:bg-slate-600"
          >
            새 탭
          </a>
          {imageReviewMode && onToggleMarkedDeleted ? (
            <button
              type="button"
              onClick={onToggleMarkedDeleted}
              className={`rounded border px-1 py-0.5 text-[9px] ${
                isMarkedDeleted
                  ? "border-emerald-700/50 bg-emerald-950/40 text-emerald-200 hover:bg-emerald-900/50"
                  : "border-red-800/50 bg-red-950/40 text-red-200 hover:bg-red-900/50"
              }`}
            >
              {isMarkedDeleted ? "복구" : "삭제 예정"}
            </button>
          ) : (
            <button
              type="button"
              onClick={onRemoveOne}
              className="rounded border border-red-800/50 bg-red-950/40 px-1 py-0.5 text-[9px] text-red-200 hover:bg-red-900/50"
            >
              삭제
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={onSetHero}
          className="w-full rounded border border-amber-700/50 bg-amber-950/30 py-1 text-[10px] font-semibold text-amber-100 hover:bg-amber-900/40"
        >
          대표로 지정
        </button>
        {canAddToEvent && onAddSelectedEvent && (
          <button
            type="button"
            onClick={onAddSelectedEvent}
            className="w-full rounded border border-[var(--primary)]/40 bg-[var(--primary)]/15 py-1 text-[10px] font-semibold text-[var(--primary)] hover:opacity-90"
          >
            선택 이벤트에 추가
          </button>
        )}
        <div className="flex gap-0.5">
          {onAddFirst && (
            <button
              type="button"
              onClick={onAddFirst}
              className="flex-1 rounded border border-slate-600 bg-slate-700 py-1 text-[9px] text-slate-200 hover:bg-slate-600"
            >
              Day 첫 이벤트
            </button>
          )}
          {onAddLast && (
            <button
              type="button"
              onClick={onAddLast}
              className="flex-1 rounded border border-slate-600 bg-slate-700 py-1 text-[9px] text-slate-200 hover:bg-slate-600"
            >
              Day 끝 이벤트
            </button>
          )}
        </div>
        {showKeepOnly && onKeepOnlyInDuplicateGroup && (
          <button
            type="button"
            onClick={onKeepOnlyInDuplicateGroup}
            className="w-full rounded border border-slate-500 py-1 text-[9px] text-slate-300 hover:bg-slate-700"
          >
            이 URL만 남기고 동일 그룹 제거
          </button>
        )}
      </div>
    </div>
  );
});

export function UnassignedImagePool({
  imageUrls,
  title,
  className = "",
  heroImageUrl,
  issuesByUrl,
  activeDayIndex,
  v2Days,
  selectedEvent,
  selectedEventSummary,
  onRemoveUrls,
  onSetHero,
  onAddToSelectedEvent,
  onAddToDayFirstEvent,
  onAddToDayLastEvent,
  onToast,
  onAutoAssignImages,
  onRecommendHero,
  imageReviewMode = false,
  markedDeletedNormUrls,
  onToggleMarkedDeleted,
}: UnassignedImagePoolProps) {
  const count = imageUrls.length;
  const [visible, setVisible] = useState(INITIAL_VISIBLE);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  const dupMeta = useMemo(() => buildUnassignedDuplicateMeta(imageUrls), [imageUrls]);

  const displayed = useMemo(() => imageUrls.slice(0, visible), [imageUrls, visible]);

  const toggle = useCallback((url: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelected(new Set(imageUrls));
  }, [imageUrls]);

  const selectNone = useCallback(() => setSelected(new Set()), []);

  const selectWhere = useCallback(
    (predicate: (url: string) => boolean) => {
      const next = new Set<string>();
      for (const u of imageUrls) {
        if (predicate(u)) next.add(u);
      }
      setSelected(next);
      onToast(`${next.size}장 선택했습니다.`);
    },
    [imageUrls, onToast],
  );

  const deleteSelected = useCallback(() => {
    const urls = [...selected];
    if (urls.length === 0) return;
    if (!window.confirm(`선택한 이미지 ${urls.length}장을 미할당 풀에서 제거할까요?`)) return;
    onRemoveUrls(urls);
    setSelected(new Set());
    onToast(`선택한 이미지 ${urls.length}장을 제거했습니다.`);
  }, [selected, onRemoveUrls, onToast]);

  const canAddToSelectedEvent =
    selectedEvent?.editorType === "v2" && onAddToSelectedEvent != null;

  const day = v2Days[activeDayIndex];
  const dayEventCount = day?.events?.length ?? 0;
  const canDayQuick = dayEventCount > 0 && onAddToDayFirstEvent && onAddToDayLastEvent;

  const handleSetHero = useCallback(
    (url: string) => {
      onSetHero(url);
      onToast("대표 이미지로 지정했습니다.");
    },
    [onSetHero, onToast],
  );

  return (
    <div className={`rounded-lg border border-slate-600 bg-slate-900/50 p-4 ${className}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-200">
          {title ?? `미할당 이미지 (${count}장)`}
        </h3>
        {visible < count && (
          <span className="text-[11px] text-slate-500">
            표시 {Math.min(visible, count)}/{count}
          </span>
        )}
      </div>

      {selectedEventSummary ? (
        <div className="mb-3 rounded-lg border border-[var(--primary)]/40 bg-[var(--primary)]/10 px-3 py-2 text-xs text-slate-200">
          <span className="font-semibold text-[var(--primary)]">현재 선택 이벤트: </span>
          {selectedEventSummary}
        </div>
      ) : (
        <div className="mb-3 rounded border border-dashed border-slate-600 px-3 py-2 text-[11px] text-slate-500">
          왼쪽 일정에서 이벤트를 선택하면 &quot;선택 이벤트에 추가&quot;를 사용할 수 있습니다.
        </div>
      )}

      {count > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={selectAll}
            className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-700"
          >
            전체 선택
          </button>
          <button
            type="button"
            onClick={selectNone}
            className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-700"
          >
            전체 해제
          </button>
          <button
            type="button"
            onClick={deleteSelected}
            disabled={selected.size === 0}
            className="rounded border border-red-800/50 bg-red-950/40 px-2 py-1 text-[11px] text-red-200 hover:bg-red-900/50 disabled:opacity-40"
          >
            선택 삭제 ({selected.size})
          </button>
          <button
            type="button"
            onClick={() =>
              selectWhere((u) => (dupMeta.urlToGroupSize.get(u) ?? 1) > 1)
            }
            className="rounded border border-amber-800/40 bg-amber-950/30 px-2 py-1 text-[11px] text-amber-100 hover:bg-amber-900/40"
          >
            중복 그룹만 선택
          </button>
          <button
            type="button"
            onClick={() => selectWhere((u) => getImageHeuristicFlags(u).isLikelyThumbnail)}
            className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-700"
          >
            thumb 의심만
          </button>
          <button
            type="button"
            onClick={() => selectWhere((u) => getImageHeuristicFlags(u).isLikelyLogo)}
            className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-700"
          >
            로고 의심만
          </button>
          {onRecommendHero && (
            <button
              type="button"
              onClick={() => onRecommendHero()}
              className="rounded border border-amber-600/50 bg-amber-900/30 px-2 py-1 text-[11px] font-semibold text-amber-100 hover:bg-amber-900/50"
            >
              자동 대표 추천
            </button>
          )}
          {onAutoAssignImages && (
            <button
              type="button"
              onClick={() => {
                onAutoAssignImages();
                onToast("이미지 자동 배치를 실행했습니다.");
              }}
              className="rounded border border-[var(--primary)]/50 bg-[var(--primary)]/15 px-2 py-1 text-[11px] font-semibold text-[var(--primary)] hover:opacity-90"
            >
              자동 이벤트 배치
            </button>
          )}
        </div>
      )}

      {count === 0 ? (
        <p className="rounded border border-dashed border-slate-600 bg-slate-800/50 px-4 py-8 text-center text-xs text-slate-400">
          미할당 이미지가 없습니다.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {displayed.map((url, i) => {
              const globalIndex = i;
              const gSize = dupMeta.urlToGroupSize.get(url) ?? 1;
              const key = dupMeta.urlToKey.get(url) ?? "";
              const rep = dupMeta.representativeUrlByKey.get(key) ?? url;
              const isRep = normalizeImageUrl(url) === normalizeImageUrl(rep);
              const badges = getAdminImageBadgeLabels(url, {
                duplicateGroupSize: gSize,
                isDedupeRepresentative: isRep && gSize > 1,
              });
              const nu = normalizeImageUrl(url);
              const placementIssues = nu ? issuesByUrl?.[nu] : undefined;

              const removeOthersInGroup = () => {
                const group = dupMeta.keyToUrls.get(key) ?? [];
                const toRemove = group.filter((u) => normalizeImageUrl(u) !== normalizeImageUrl(url));
                if (toRemove.length === 0) return;
                if (!window.confirm(`동일 그룹 ${toRemove.length}장을 제거하고 이 이미지만 남길까요?`)) return;
                onRemoveUrls(toRemove);
                onToast(`동일 그룹에서 ${toRemove.length}장을 제거했습니다.`);
              };

              return (
                <PoolCard
                  key={`pool-${i}-${url.slice(0, 48)}`}
                  url={url}
                  globalIndex={globalIndex}
                  heroImageUrl={heroImageUrl}
                  badges={badges}
                  placementIssues={placementIssues}
                  selected={selected.has(url)}
                  onToggleSelect={() => toggle(url)}
                  onRemoveOne={() => {
                    if (!window.confirm("이 이미지를 미할당 풀에서 제거할까요?")) return;
                    onRemoveUrls([url]);
                    setSelected((s) => {
                      const n = new Set(s);
                      n.delete(url);
                      return n;
                    });
                    onToast("이미지 1장을 제거했습니다.");
                  }}
                  onSetHero={() => handleSetHero(url)}
                  onAddSelectedEvent={
                    canAddToSelectedEvent
                      ? () => {
                          onAddToSelectedEvent!(url);
                          onToast("선택한 이벤트에 이미지를 추가했습니다.");
                        }
                      : undefined
                  }
                  onAddFirst={
                    canDayQuick
                      ? () => {
                          onAddToDayFirstEvent!(url, activeDayIndex);
                          onToast(`Day ${activeDayIndex + 1} 첫 이벤트에 추가했습니다.`);
                        }
                      : undefined
                  }
                  onAddLast={
                    canDayQuick
                      ? () => {
                          onAddToDayLastEvent!(url, activeDayIndex);
                          onToast(`Day ${activeDayIndex + 1} 마지막 이벤트에 추가했습니다.`);
                        }
                      : undefined
                  }
                  onKeepOnlyInDuplicateGroup={gSize > 1 ? removeOthersInGroup : undefined}
                  showKeepOnly={gSize > 1}
                  canAddToEvent={canAddToSelectedEvent}
                  onToast={onToast}
                  imageReviewMode={imageReviewMode}
                  isMarkedDeleted={Boolean(nu && markedDeletedNormUrls?.has(nu))}
                  onToggleMarkedDeleted={
                    imageReviewMode && onToggleMarkedDeleted && nu
                      ? () => onToggleMarkedDeleted(nu)
                      : undefined
                  }
                />
              );
            })}
          </div>
          {visible < count && (
            <button
              type="button"
              onClick={() => setVisible((v) => Math.min(v + LOAD_MORE, count))}
              className="mt-3 w-full rounded-lg border border-slate-600 bg-slate-800 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700"
            >
              더 보기 ({count - visible}장 남음)
            </button>
          )}
        </>
      )}
    </div>
  );
}
