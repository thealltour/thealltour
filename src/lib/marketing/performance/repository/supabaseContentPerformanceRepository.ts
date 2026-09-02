import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { ContentPerformanceRepository, CreateContentPerformanceSnapshotInput } from "@/lib/marketing/performance/repository/contracts";
import type { ContentPerformanceSnapshot, PerformanceMetrics } from "@/lib/marketing/performance/types";
import { resolveNormalizedMetricsForPersistence } from "@/lib/marketing/performance/normalizeFeatures";

function asRow(data: unknown): Record<string, unknown> {
  return data as Record<string, unknown>;
}

function rowsToMetrics(rows: Array<{ metric_type: string; metric_value: number }>): PerformanceMetrics {
  const metrics: PerformanceMetrics = {};
  for (const row of rows) {
    const key = row.metric_type as keyof PerformanceMetrics;
    metrics[key] = Number(row.metric_value);
  }
  return metrics;
}

function mapRow(
  row: Record<string, unknown>,
  metrics: PerformanceMetrics,
): ContentPerformanceSnapshot {
  return {
    contract: "content-performance-snapshot-v1",
    snapshotId: String(row.id),
    collectionId: String(row.collection_id),
    logicalObservationKey: String(row.logical_observation_key),
    candidateId: String(row.candidate_id),
    humanReviewId: String(row.human_review_id),
    platform: String(row.platform),
    channel: String(row.channel),
    externalPostId: row.external_post_id != null ? String(row.external_post_id) : null,
    externalUrl: row.external_url != null ? String(row.external_url) : null,
    publishedAt: row.published_at != null ? String(row.published_at) : null,
    publicationSource: "manual",
    contentOrigin: String(row.content_origin) as "ai_unchanged" | "human_edited",
    collectionStatus: String(row.collection_status) as ContentPerformanceSnapshot["collectionStatus"],
    observedAt: String(row.observed_at),
    dataAvailability: String(row.data_availability) as ContentPerformanceSnapshot["dataAvailability"],
    metrics,
    normalizedMetrics: (row.normalized_metrics as ContentPerformanceSnapshot["normalizedMetrics"]) ?? null,
    topic: row.topic != null ? String(row.topic) : null,
    destinations: Array.isArray(row.destinations) ? row.destinations.map(String) : [],
    format: row.format != null ? String(row.format) : null,
    commercialIntent: row.commercial_intent != null ? String(row.commercial_intent) : null,
    productLinked: Boolean(row.product_linked),
    sampleQuality: row.sample_quality != null ? String(row.sample_quality) : null,
    reason: row.reason != null ? String(row.reason) : null,
    createdAt: String(row.created_at),
  };
}

export function createSupabaseContentPerformanceRepository(): ContentPerformanceRepository {
  return {
    async findByLogicalObservationKey(key: string) {
      const { data, error } = await supabaseAdmin
        .from("marketing_content_performance_snapshots")
        .select("*")
        .eq("logical_observation_key", key)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;
      const metricsRes = await supabaseAdmin
        .from("marketing_content_performance_metrics")
        .select("metric_type,metric_value")
        .eq("snapshot_id", String((data as Record<string, unknown>).id));
      if (metricsRes.error) throw new Error(metricsRes.error.message);
      return mapRow(asRow(data), rowsToMetrics(metricsRes.data as Array<{ metric_type: string; metric_value: number }>));
    },
    async findByCandidateId(candidateId: string) {
      const { data, error } = await supabaseAdmin
        .from("marketing_content_performance_snapshots")
        .select("*")
        .eq("candidate_id", candidateId)
        .order("observed_at", { ascending: false });
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as Record<string, unknown>[];
      const results: ContentPerformanceSnapshot[] = [];
      for (const row of rows) {
        const metricsRes = await supabaseAdmin
          .from("marketing_content_performance_metrics")
          .select("metric_type,metric_value")
          .eq("snapshot_id", String(row.id));
        if (metricsRes.error) throw new Error(metricsRes.error.message);
        results.push(
          mapRow(row, rowsToMetrics(metricsRes.data as Array<{ metric_type: string; metric_value: number }>)),
        );
      }
      return results;
    },
    async listRecent(input: { since?: string; limit?: number } = {}) {
      let query = supabaseAdmin
        .from("marketing_content_performance_snapshots")
        .select("*")
        .order("observed_at", { ascending: false })
        .limit(input.limit ?? 50);
      if (input.since) query = query.gte("observed_at", input.since);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as Record<string, unknown>[];
      const results: ContentPerformanceSnapshot[] = [];
      for (const row of rows) {
        const metricsRes = await supabaseAdmin
          .from("marketing_content_performance_metrics")
          .select("metric_type,metric_value")
          .eq("snapshot_id", String(row.id));
        if (metricsRes.error) throw new Error(metricsRes.error.message);
        results.push(
          mapRow(row, rowsToMetrics(metricsRes.data as Array<{ metric_type: string; metric_value: number }>)),
        );
      }
      return results;
    },
    async save(input: CreateContentPerformanceSnapshotInput) {
      const existing = await this.findByLogicalObservationKey(input.snapshot.logicalObservationKey);
      if (existing) return existing;

      const metrics = rowsToMetrics(
        input.metrics.map((metric) => ({ metric_type: metric.metricType, metric_value: metric.metricValue })),
      );
      const normalizedMetrics = resolveNormalizedMetricsForPersistence(
        metrics,
        input.snapshot.observedAt,
        input.snapshot.publishedAt ?? null,
      );

      const { data, error } = await supabaseAdmin
        .from("marketing_content_performance_snapshots")
        .insert({
          collection_id: input.snapshot.collectionId,
          logical_observation_key: input.snapshot.logicalObservationKey,
          candidate_id: input.snapshot.candidateId,
          human_review_id: input.snapshot.humanReviewId,
          platform: input.snapshot.platform,
          channel: input.snapshot.channel,
          external_post_id: input.snapshot.externalPostId ?? null,
          external_url: input.snapshot.externalUrl ?? null,
          published_at: input.snapshot.publishedAt ?? null,
          publication_source: "manual",
          content_origin: input.snapshot.contentOrigin,
          collection_status: input.snapshot.collectionStatus,
          observed_at: input.snapshot.observedAt,
          data_availability: input.snapshot.dataAvailability,
          topic: input.snapshot.topic ?? null,
          destinations: input.snapshot.destinations ?? [],
          format: input.snapshot.format ?? null,
          commercial_intent: input.snapshot.commercialIntent ?? null,
          product_linked: input.snapshot.productLinked ?? false,
          sample_quality: input.snapshot.sampleQuality ?? null,
          reason: input.snapshot.reason ?? null,
          provider_metadata: {},
          normalized_metrics: normalizedMetrics,
        })
        .select("*")
        .single();
      if (error) throw new Error(error.message);

      if (input.metrics.length > 0) {
        const metricRows = input.metrics.map((metric) => ({
          snapshot_id: String((data as Record<string, unknown>).id),
          metric_type: metric.metricType,
          metric_value: metric.metricValue,
          unit: metric.unit ?? null,
        }));
        const metricsInsert = await supabaseAdmin.from("marketing_content_performance_metrics").insert(metricRows);
        if (metricsInsert.error) throw new Error(metricsInsert.error.message);
      }

      const metricsRes = await supabaseAdmin
        .from("marketing_content_performance_metrics")
        .select("metric_type,metric_value")
        .eq("snapshot_id", String((data as Record<string, unknown>).id));
      if (metricsRes.error) throw new Error(metricsRes.error.message);
      return mapRow(asRow(data), rowsToMetrics(metricsRes.data as Array<{ metric_type: string; metric_value: number }>));
    },
  };
}
