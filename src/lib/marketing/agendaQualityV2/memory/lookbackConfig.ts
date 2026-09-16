export type AgendaMemoryLookbackConfig = {
  topicDays: number;
  decisionAxisDays: number;
  selectedPublishedDays: number;
};

export const AGENDA_MEMORY_LOOKBACK_DEFAULTS: AgendaMemoryLookbackConfig = {
  topicDays: 14,
  decisionAxisDays: 14,
  selectedPublishedDays: 30,
};

export function resolveAgendaMemoryLookback(
  overrides?: Partial<AgendaMemoryLookbackConfig>,
): AgendaMemoryLookbackConfig {
  return {
    topicDays: overrides?.topicDays ?? AGENDA_MEMORY_LOOKBACK_DEFAULTS.topicDays,
    decisionAxisDays:
      overrides?.decisionAxisDays ?? AGENDA_MEMORY_LOOKBACK_DEFAULTS.decisionAxisDays,
    selectedPublishedDays:
      overrides?.selectedPublishedDays ?? AGENDA_MEMORY_LOOKBACK_DEFAULTS.selectedPublishedDays,
  };
}
