/**
 * Provider-neutral structured output / response_format contract.
 * Runtime transports constraints to providers; business parsers stay in TheAllTour layer.
 */

import type { RuntimeJsonSchema } from "@/ai-runtime/domain/tools";

export type RuntimeResponseFormatJsonObject = {
  type: "json_object";
};

export type RuntimeResponseFormatJsonSchema = {
  type: "json_schema";
  name: string;
  description?: string;
  schema: RuntimeJsonSchema;
  strict?: boolean;
};

export type RuntimeResponseFormat =
  | RuntimeResponseFormatJsonObject
  | RuntimeResponseFormatJsonSchema;

export function isJsonSchemaResponseFormat(
  format: RuntimeResponseFormat | undefined,
): format is RuntimeResponseFormatJsonSchema {
  return format?.type === "json_schema";
}
