/** Re-export OpenAI-compatible mappers for NVIDIA NIM chat completions. */
export {
  mapRuntimeMessagesToOpenAiChat,
  mapOpenAiFinishReason,
  extractOpenAiChatContent,
  extractOpenAiUsage,
  type OpenAiChatMessage,
  type OpenAiChatRequestBody,
} from "@/ai-runtime/adapters/openrouter/mapper";
