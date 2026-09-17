import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
  CHANNEL_EDITOR_COMMON_IDENTITY,
  CHANNEL_EDITOR_HERMES_PROFILES,
  assembleChannelComposerPromptParts,
  assertChannelEditorHermesProfile,
  buildChannelEditorIdentityPrompt,
  buildChannelEditorSoulMarkdown,
  resolveChannelEditorHermesProfile,
} from "@/lib/marketing/publishable/channelEditorIdentity";
import { createPublishableComposerInvoke } from "@/lib/marketing/cron/marketingCronRuntime";
import { ROLE_MODEL_ROUTES, resolveModelRoute } from "@/ai-runtime/router/role-routes";
import { naverBlogWritingContract } from "@/lib/marketing/publishable/naver_blog/writingContract";
import { naverBandWritingContract } from "@/lib/marketing/publishable/naver_band/writingContract";
import { kakaoChannelWritingContract } from "@/lib/marketing/publishable/kakao_channel/writingContract";
import type { PublishableChannel } from "@/lib/marketing/publishable/contracts";

const CHANNELS: PublishableChannel[] = [
  "threads",
  "naver_blog",
  "naver_band",
  "kakao_channel",
  "shortform",
  "instagram",
];

describe("CHANNEL_EDITOR_PROFILE_SPLIT_STEP_1 identity", () => {
  it("story-lock identity forbids new Story / booking-timing / future-price drift", () => {
    const text = CHANNEL_EDITOR_COMMON_IDENTITY;
    expect(text).toContain("You are a Channel Editor, not a Content Strategist");
    expect(text).toContain("APPROVED_CANONICAL_MARKETING_ASSET is the sole final editorial authority");
    expect(text).toMatch(/inventing a new Story/i);
    expect(text).toMatch(/decisionAtStake/i);
    expect(text).toMatch(/booking-timing/i);
    expect(text).toMatch(/future-price/i);
    expect(text).toContain("Should I book now or wait?");
    expect(text).toContain("Will hotel prices fall?");
  });

  it("every channel prompt includes Channel Editor identity", () => {
    for (const channel of CHANNELS) {
      const parts = assembleChannelComposerPromptParts({
        channel,
        writingContract: "CONTRACT",
        channelRules: "RULES",
        inputJson: { ok: true },
      });
      expect(parts.system).toContain("You are a Channel Editor");
      expect(parts.system).toContain(buildChannelEditorIdentityPrompt(channel).slice(0, 40));
      expect(parts.text).toContain("=== CHANNEL_EDITOR_IDENTITY ===");
      expect(parts.text).toContain("CONTRACT");
      expect(parts.user).not.toContain("You are a Content Strategist");
    }
  });

  it("oneshot profile mapping never uses content-strategist", () => {
    expect(resolveChannelEditorHermesProfile("threads")).toBe("channel-editor-threads");
    expect(resolveChannelEditorHermesProfile("naver_blog")).toBe("channel-editor-naver-blog");
    expect(resolveChannelEditorHermesProfile("naver_band")).toBe("channel-editor-naver-band");
    expect(resolveChannelEditorHermesProfile("kakao_channel")).toBe("channel-editor-kakao");
    expect(resolveChannelEditorHermesProfile("shortform")).toBe("channel-editor-shortform");
    expect(resolveChannelEditorHermesProfile("instagram")).toBe("channel-editor-instagram");
    for (const channel of CHANNELS) {
      const profile = resolveChannelEditorHermesProfile(channel);
      expect(profile).not.toBe("content-strategist");
      assertChannelEditorHermesProfile(profile);
      expect(CHANNEL_EDITOR_HERMES_PROFILES[channel]).toBe(profile);
    }
    expect(() => assertChannelEditorHermesProfile("content-strategist")).toThrow(
      /channel_editor_profile/,
    );
  });

  it("Hermes SOUL files on disk match canonical identity semantics", () => {
    const hermesHome = process.env.HERMES_HOME ?? "/home/ysh/.hermes";
    for (const channel of CHANNELS) {
      const id = resolveChannelEditorHermesProfile(channel);
      const soulPath = join(hermesHome, "profiles", id, "SOUL.md");
      const soul = readFileSync(soulPath, "utf8");
      expect(soul).toBe(buildChannelEditorSoulMarkdown(channel) + "\n");
      expect(soul).toContain("You are a Channel Editor, not a Content Strategist");
      expect(soul).not.toMatch(/You are Content Strategist/i);
    }
  });

  it("Runtime invoke sends system Channel Editor identity and keeps roleKey/workload", async () => {
    const executeAndWait = vi.fn(async () => ({
      status: "completed",
      response: { content: '{"title":null,"body":"ok"}' },
    }));
    const invoke = createPublishableComposerInvoke({
      useRuntime: true,
      correlationId: "test-corr",
      executor: { executeAndWait },
      completionTimeoutMs: 5_000,
    });
    expect(invoke).toBeTruthy();
    for (const channel of CHANNELS) {
      executeAndWait.mockClear();
      const parts = assembleChannelComposerPromptParts({
        channel,
        writingContract: `${channel}-contract`,
        channelRules: "rules",
        inputJson: { channel },
      });
      await invoke!(parts);
      expect(executeAndWait).toHaveBeenCalledTimes(1);
      const req = executeAndWait.mock.calls[0]?.[0] as {
        workload: string;
        metadata?: { roleKey?: string };
        messages: Array<{ role: string; content: string }>;
      };
      expect(req.workload).toBe("content_draft");
      expect(req.metadata?.roleKey ?? (req as { roleKey?: string }).roleKey).toBeTruthy();
      // roleKey may be on request root or metadata depending on factory
      const roleKey =
        (req as { roleKey?: string }).roleKey ??
        req.metadata?.roleKey ??
        (req as { routing?: { roleKey?: string } }).routing?.roleKey;
      // createCronRuntimeRequest puts roleKey on input → check messages + call args deeply
      const raw = executeAndWait.mock.calls[0]?.[0] as Record<string, unknown>;
      const serialized = JSON.stringify(raw);
      expect(serialized).toContain("channel_editor");
      expect(serialized).toContain("content_draft");
      expect(raw.messages).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            role: "system",
            content: expect.stringContaining("You are a Channel Editor"),
          }),
          expect.objectContaining({
            role: "user",
            content: expect.stringContaining(`${channel}-contract`),
          }),
        ]),
      );
      void roleKey;
    }
  });

  it("oneshot invoke maps each channel to channel-editor-* and never content-strategist", async () => {
    const profiles: string[] = [];
    const invoke = createPublishableComposerInvoke({
      useRuntime: false,
      correlationId: "test-corr",
      invokeHermesProfile: (profile, prompt) => {
        profiles.push(profile);
        expect(prompt).toContain("CHANNEL_EDITOR_IDENTITY");
        return '{"title":null,"body":"ok"}';
      },
    });
    expect(invoke).toBeTruthy();
    for (const channel of CHANNELS) {
      const parts = assembleChannelComposerPromptParts({
        channel,
        writingContract: "c",
        channelRules: "r",
        inputJson: {},
      });
      await invoke!(parts);
    }
    expect(profiles).toEqual([
      "channel-editor-threads",
      "channel-editor-naver-blog",
      "channel-editor-naver-band",
      "channel-editor-kakao",
      "channel-editor-shortform",
      "channel-editor-instagram",
    ]);
    expect(profiles.includes("content-strategist")).toBe(false);
  });

  it("oneshot refuses string prompt without channel (no silent CS fallback)", async () => {
    const invoke = createPublishableComposerInvoke({
      useRuntime: false,
      correlationId: "test-corr",
      invokeHermesProfile: () => {
        throw new Error("should_not_invoke");
      },
    });
    await expect(invoke!("bare string")).rejects.toThrow(/channel_editor_oneshot_requires_channel/);
  });

  it("role routing for channel_editor is unchanged", () => {
    const resolved = resolveModelRoute({
      role: "channel_editor",
      workload: "content_draft",
    });
    expect(resolved.modelIds).toEqual(ROLE_MODEL_ROUTES.channel_editor);
    expect(resolved.routeSource).toBe("role_override");
  });

  it("blog/band/kakao approved-asset contracts drop search-intent-first / selected-angle authority", () => {
    const blog = naverBlogWritingContract({ hasApprovedCanonicalAsset: true });
    expect(blog).not.toMatch(/Search intent first/i);
    expect(blog).toMatch(/Approved Story first/i);

    const band = naverBandWritingContract({ hasApprovedCanonicalAsset: true });
    expect(band).toMatch(/Do NOT use selected angle/i);

    const kakao = kakaoChannelWritingContract({ hasApprovedCanonicalAsset: true });
    expect(kakao).toMatch(/Do NOT choose a new angle/i);
  });
});
