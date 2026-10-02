import { randomUUID, createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import sharp from "sharp";
import { z } from "zod";
import { atomicWriteFile } from "@/lib/marketing/assets/atomicWrite";
import { resolvePackageArtifactPath } from "@/lib/marketing/assets/paths";
import { readPackageMediaBrief } from "@/lib/marketing/assets/cardnews/instagramCardnews";
import { renderCardNewsPackage } from "@/lib/marketing/assets/cardnews/renderCardNewsPackage";
import { requireFreshScenePlan } from "../narrationScenes/service";
import { verifySceneAsset } from "../narrationScenes/assets";
import { NarrationError } from "../narration/persistence";
import { adaptationDirectory, requireApprovedAdaptation, withAdaptationLock } from "./service";

const renderedSchema = z.object({ contract: z.literal("narration-instagram-render-v1"), adaptationFingerprint: z.string().length(64),
  scenePlanFingerprint: z.string().length(64), attemptId: z.string().uuid(), aspectRatio: z.literal("4:5"),
  cards: z.array(z.object({ cardId: z.string().uuid(), sceneId: z.string().uuid(), imageSha256: z.string().length(64),
    relativePath: z.string(), sha256: z.string().length(64) }).strict()).min(4).max(10), createdAt: z.string().datetime() }).strict();
export async function renderAdaptation(root: string, candidateId: string, fingerprint: string) {
  const adaptation = requireApprovedAdaptation(root, candidateId, fingerprint);
  const plan = requireFreshScenePlan(root, candidateId, adaptation.source.scenePlanFingerprint);
  const diskBrief = readPackageMediaBrief(root);
  if (!diskBrief || diskBrief.candidateId !== candidateId) throw new NarrationError("카드 렌더에 필요한 후보 MediaBrief를 찾을 수 없습니다.");
  const attemptId = randomUUID();
  const assetRoot = join(root, "cardnews/narration", fingerprint, attemptId);
  const visuals: Record<string, string> = {};
  for (const card of adaptation.cards) {
    const { bytes, asset } = verifySceneAsset(root, plan, card.visualId);
    if (asset.sha256 !== card.image.sha256) throw new NarrationError("선택한 이미지가 변경되었습니다.");
    const crop = await sharp(bytes).resize(1080, 1350, { fit: "cover", position: "centre" }).png().toBuffer();
    const path = join(assetRoot, "inputs", `${card.cardId}.png`); atomicWriteFile(path, crop); visuals[card.cardId] = path;
  }
  const brief = { ...diskBrief, formats: { ...diskBrief.formats, cardnews: { ...diskBrief.formats.cardnews, enabled: true, aspectRatio: "4:5" as const,
    cards: adaptation.cards.map((card, i) => ({ cardId: card.cardId, role: i === 0 ? "cover" as const : "information" as const,
      headline: card.headline, body: card.body ?? "", visualIntent: "", evidenceRefs: [] })) } } };
  const result = await renderCardNewsPackage({ mediaBrief: brief, assetRoot, aspectRatio: "4:5", graphicOnly: false,
    visuals, visualIdsByCard: Object.fromEntries(adaptation.cards.map(card => [card.cardId, card.visualId])), allowedVisualRoots: [assetRoot],
    editorialCopyByCardId: Object.fromEntries(adaptation.cards.map(({ cardId, kicker, headline, body, microcopy }) => [cardId, { kicker, headline, body, microcopy }])),
    persistMediaBrief: false, manifestMediaBrief: brief });
  if (result.status !== "rendered" || !result.render || result.render.cards.length !== adaptation.cards.length) throw new NarrationError("선택한 카드 전체를 렌더하지 못했습니다.");
  const rendered = renderedSchema.parse({ contract: "narration-instagram-render-v1", adaptationFingerprint: fingerprint,
    scenePlanFingerprint: plan.fingerprint, attemptId, aspectRatio: "4:5", createdAt: new Date().toISOString(),
    cards: result.render.cards.map((renderedCard, index) => {
      const card = adaptation.cards[index]!;
      if (renderedCard.sourceBriefCardId !== card.cardId || !renderedCard.visualAssetId) throw new NarrationError("렌더 카드의 순서 또는 이미지 연결이 다릅니다.");
      const path = resolvePackageArtifactPath({ packageRoot: result.packageRoot, relativePath: renderedCard.relativePath });
      return { cardId: card.cardId, sceneId: card.sceneId, imageSha256: card.image.sha256,
        relativePath: relative(root, path).split(sep).join("/"), sha256: renderedCard.sha256 };
    }) });
  return withAdaptationLock(root, () => {
    requireApprovedAdaptation(root, candidateId, fingerprint);
    atomicWriteFile(join(adaptationDirectory(root), `${fingerprint}.render.json`), JSON.stringify(rendered, null, 2));
    return rendered;
  });
}
export function readAdaptationRender(root: string, candidateId: string, fingerprint: string) {
  const adaptation = requireApprovedAdaptation(root, candidateId, fingerprint);
  const path = join(adaptationDirectory(root), `${fingerprint}.render.json`); if (!existsSync(path)) return null;
  const rendered = renderedSchema.parse(JSON.parse(readFileSync(path, "utf8")));
  if (rendered.adaptationFingerprint !== fingerprint || rendered.scenePlanFingerprint !== adaptation.source.scenePlanFingerprint ||
      rendered.cards.length !== adaptation.cards.length) throw new NarrationError("렌더 결과의 연결 정보가 다릅니다.");
  for (const [i, card] of rendered.cards.entries()) {
    const selected = adaptation.cards[i]!;
    const prefix = `cardnews/narration/${fingerprint}/${rendered.attemptId}/`;
    if (card.cardId !== selected.cardId || card.sceneId !== selected.sceneId || card.imageSha256 !== selected.image.sha256 || !card.relativePath.startsWith(prefix)) throw new NarrationError("렌더 카드와 선택 장면이 일치하지 않습니다.");
    const file = resolvePackageArtifactPath({ packageRoot: root, relativePath: card.relativePath });
    if (!existsSync(file) || createHash("sha256").update(readFileSync(file)).digest("hex") !== card.sha256) throw new NarrationError("렌더 이미지가 없거나 변경되었습니다.");
  }
  return rendered;
}
