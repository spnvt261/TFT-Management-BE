import { z } from "zod";

const apiErrorBodySchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional()
});

const apiErrorSchema = z.object({
  success: z.literal(false),
  error: apiErrorBodySchema
});

export const paginationMetaSchema = z.object({
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative()
});

export function toSwaggerSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  return z.toJSONSchema(schema, { target: "draft-7" }) as Record<string, unknown>;
}

export function successResponseSchema(dataSchema: z.ZodTypeAny, metaSchema?: z.ZodTypeAny): Record<string, unknown> {
  const baseSchema = z.object({
    success: z.literal(true),
    data: dataSchema
  });

  const schema = metaSchema ? baseSchema.extend({ meta: metaSchema }) : baseSchema;
  return toSwaggerSchema(schema);
}

export const errorResponseSchemas: Record<number, Record<string, unknown>> = {
  400: toSwaggerSchema(apiErrorSchema),
  404: toSwaggerSchema(apiErrorSchema),
  422: toSwaggerSchema(apiErrorSchema),
  500: toSwaggerSchema(apiErrorSchema)
};

export const openApiTags = [
  { name: "System", description: "System endpoints" },
  { name: "Players", description: "Player management" },
  { name: "Rules", description: "Rule set and version management" },
  { name: "Matches", description: "Match creation, listing, detail and void" },
  { name: "Presets", description: "Recent match presets by module" },
  { name: "Match Stakes", description: "Match stakes summary, ledger and match history" },
  { name: "Group Fund", description: "Group fund summary, ledger and match history" }
];
