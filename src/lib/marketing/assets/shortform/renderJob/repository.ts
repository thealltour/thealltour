import type {
  EnqueueShortformVideoRenderJobResult,
  FinalizeShortformVideoRenderJobResult,
  ShortformVideoRenderJob,
} from "@/lib/marketing/assets/shortform/renderJob/contracts";

export type ClaimShortformVideoRenderJobInput = {
  workerId: string;
  leaseMs?: number;
  now?: Date;
};

export type ShortformVideoRenderJobOwnership = {
  claimToken: string;
  attemptCount: number;
  claimedBy: string;
};

export type ShortformVideoRenderJobRepository = {
  getById(id: string): Promise<ShortformVideoRenderJob | null>;
  findByLogicalRunKey(logicalRunKey: string): Promise<ShortformVideoRenderJob | null>;
  listForCandidate(candidateId: string): Promise<ShortformVideoRenderJob[]>;
  listQueued(options?: { limit?: number }): Promise<ShortformVideoRenderJob[]>;
  listClaimable(options?: {
    limit?: number;
    leaseMs?: number;
    now?: Date;
  }): Promise<ShortformVideoRenderJob[]>;

  /** Insert-once by logical_run_key; returns existing when active/terminal same key. */
  enqueue(job: ShortformVideoRenderJob): Promise<EnqueueShortformVideoRenderJobResult>;

  claimNext(input: ClaimShortformVideoRenderJobInput): Promise<ShortformVideoRenderJob | null>;

  markReady(input: {
    logicalRunKey: string;
    outputArtifactPath: string;
    ownership: ShortformVideoRenderJobOwnership;
    now?: Date;
  }): Promise<FinalizeShortformVideoRenderJobResult>;

  markFailed(input: {
    logicalRunKey: string;
    errorCode?: string | null;
    error: unknown;
    ownership: ShortformVideoRenderJobOwnership;
    now?: Date;
  }): Promise<FinalizeShortformVideoRenderJobResult>;

  /** FAILED → QUEUED for another attempt (same logical key). READY cannot requeue. */
  requeueFailed(input: {
    logicalRunKey: string;
    now?: Date;
  }): Promise<ShortformVideoRenderJob>;

  cancel(input: {
    logicalRunKey: string;
    now?: Date;
  }): Promise<ShortformVideoRenderJob>;
};
