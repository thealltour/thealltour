import type { NarrationScenePlan } from "../narrationScenes/contracts";
import { NarrationError } from "../narration/persistence";
/** Same absolute 30fps boundaries as the existing still-scene renderer. */
export function motionFrameLayout(plan: NarrationScenePlan) {
  let startFrame = 0;
  return plan.scenes.map((scene, i) => {
    const endFrame = i === plan.scenes.length - 1 ? Math.ceil(scene.sceneEndMs * 30 / 1000) : Math.round(scene.sceneEndMs * 30 / 1000);
    if (endFrame <= startFrame || endFrame - startFrame > 3600) throw new NarrationError("장면 길이를 확인해주세요. 모션은 장면당 최대 120초입니다.", 400);
    const interval = { startFrame, endFrame }; startFrame = endFrame; return interval;
  });
}
