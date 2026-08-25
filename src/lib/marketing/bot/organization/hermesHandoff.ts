import type { HermesMarketingProfileId } from "@/lib/marketing/bot/organization/envelope";

/**
 * Hermes Agent v0.20.4 (installed) handoff primitives.
 *
 * There is no native "profile A invokes profile B" RPC.
 * Same-machine delivery uses CLI profile selection. Cross-machine uses `hermes peer dm`.
 * `delegate_task` is an in-process subagent, not another named profile.
 */
export const HERMES_HANDOFF_CLASSIFICATION = "application_level" as const;

export const HERMES_HANDOFF_PRIMITIVES = {
  oneshot: 'hermes -p <profile> --yolo --ignore-rules -z "<prompt>"',
  botChat:
    'hermes -p <profile> chat --in ~ -c "Bot Chat" --create-if-missing -Q --query-file <path>',
  kanbanAssign: "hermes kanban assign — async board, requires dispatch daemon; not used in 2-4.8A",
  peerDm: "hermes peer dm — other machines only",
  delegateTask: "in-process subagent, not a named marketing profile",
} as const;

export function buildHermesOneshotArgv(profile: HermesMarketingProfileId, prompt: string): string[] {
  return ["hermes", "-p", profile, "--yolo", "--ignore-rules", "-z", prompt];
}

export function buildHermesQueryFileArgv(profile: HermesMarketingProfileId, queryFile: string): string[] {
  return [
    "hermes",
    "-p",
    profile,
    "chat",
    "--in",
    process.env.HOME ?? "/home/ysh",
    "-c",
    "Bot Chat",
    "--create-if-missing",
    "-Q",
    "--yolo",
    "--ignore-rules",
    "--query-file",
    queryFile,
  ];
}
