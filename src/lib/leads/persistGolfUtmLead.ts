import "server-only";

import { randomBytes } from "node:crypto";
import { inferAttribution } from "@/lib/analytics/attribution";
import { sendSlackPlainText } from "@/lib/notifications";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { GolfUtmLeadInput } from "@/lib/leads/golfLeadPayload";

export type PersistGolfUtmLeadResult =
  | { ok: true; referenceId: string }
  | { ok: false; error: string; referenceId: string };

function generateReferenceId(): string {
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date())
    .replace(/-/g, "");
  const hex = randomBytes(2).toString("hex").toUpperCase();
  return `GT-${ymd}-${hex}`;
}

function resolveAcquisitionChannel(input: GolfUtmLeadInput): string {
  try {
    const result = inferAttribution({
      utm_source: input.utmSource ?? undefined,
      utm_medium: input.utmMedium ?? undefined,
      utm_campaign: input.utmCampaign ?? undefined,
      utm_term: input.utmTerm ?? undefined,
      utm_content: input.utmContent ?? undefined,
      firstLandingUrl: input.landingPage ?? undefined,
    });
    return result.acquisition_channel ?? (input.utmMedium?.trim() || "unknown");
  } catch {
    return input.utmMedium?.trim() || "unknown";
  }
}

async function insertGolfLeadRow(
  row: {
    reference_id: string;
    customer_name: string;
    phone_number: string;
    group_size: number | null;
    target_destination: string | null;
    landing_page: string | null;
    utm_source: string | null;
    utm_medium: string | null;
    utm_campaign: string | null;
    utm_term: string | null;
    utm_content: string | null;
    acquisition_channel: string;
  },
  referenceId: string,
): Promise<{ error: { code?: string; message: string } | null; referenceId: string }> {
  let currentReferenceId = referenceId;

  for (let attempt = 0; attempt < 2; attempt++) {
    const { error } = await supabaseAdmin.from("golf_tour_leads").insert({
      ...row,
      reference_id: currentReferenceId,
    });

    if (!error) {
      return { error: null, referenceId: currentReferenceId };
    }

    if (error.code === "23505" && attempt === 0) {
      currentReferenceId = generateReferenceId();
      continue;
    }

    return { error, referenceId: currentReferenceId };
  }

  return {
    error: { message: "reference_id 충돌 재시도 후에도 적재에 실패했습니다." },
    referenceId: currentReferenceId,
  };
}

export type PersistGolfUtmLeadOptions = {
  /** 실패 시 Slack 알림 (기본 true) */
  notifyOnFailure?: boolean;
};

/** golf_tour_leads 적재. fire-and-forget 호출용 — throw 하지 않음. */
export async function persistGolfUtmLead(
  input: GolfUtmLeadInput,
  options?: PersistGolfUtmLeadOptions,
): Promise<PersistGolfUtmLeadResult> {
  const notifyOnFailure = options?.notifyOnFailure !== false;
  const referenceId = generateReferenceId();
  const acquisitionChannel = resolveAcquisitionChannel(input);

  const { error, referenceId: finalReferenceId } = await insertGolfLeadRow(
    {
      reference_id: referenceId,
      customer_name: input.customerName,
      phone_number: input.phoneNumber,
      group_size: input.groupSize ?? null,
      target_destination: input.targetDestination?.trim() || null,
      landing_page: input.landingPage?.trim() || null,
      utm_source: input.utmSource?.trim() || null,
      utm_medium: input.utmMedium?.trim() || null,
      utm_campaign: input.utmCampaign?.trim() || null,
      utm_term: input.utmTerm?.trim() || null,
      utm_content: input.utmContent?.trim() || null,
      acquisition_channel: acquisitionChannel,
    },
    referenceId,
  );

  if (error) {
    if (notifyOnFailure) {
      void sendSlackPlainText(
        `[골프리드 적재 실패] ${input.customerName}/${input.phoneNumber} ref=${finalReferenceId} err=${error.message}`,
      );
    }
    return { ok: false, error: error.message, referenceId: finalReferenceId };
  }

  return { ok: true, referenceId: finalReferenceId };
}
