import { OPERATORS } from '@jsonassert/jsonassert-js';
import { z } from 'zod';

// The shapes the playground's evaluation logic produces (implementation in runner.ts): one zod
// schema per shape and every type inferred here, so runner.ts holds nothing but implementation and
// a shape is declared in exactly one place. Consumers import the types from this module — runner.ts
// deliberately does not re-export them.
//
// The operator list comes from the engine (OPERATORS) instead of being repeated here.

/** How one editor line ended: an assertion that passed or failed, a plain value, or an error. */
export const LineStatusSchema = z.enum(['pass', 'fail', 'value', 'error']);
export type LineStatus = z.infer<typeof LineStatusSchema>;

/** The engine's comparison operators, as a schema (the type itself stays the engine's). */
export const OperatorSchema = z.enum(OPERATORS as readonly [string, ...string[]]);

/** A parse or evaluation error, with the offset to underline in the editor. */
export const LineErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  /** Absolute character offset inside the editor document, when known. */
  from: z.number().int().nullable()
});
export type LineError = z.infer<typeof LineErrorSchema>;

/** One non-empty, non-comment line of the expression document, after evaluation. */
export const LineResultSchema = z.object({
  /** 1-based line number in the expression editor. */
  line: z.number().int(),
  source: z.string(),
  kind: z.enum(['assert', 'expression']),
  status: LineStatusSchema,
  operator: OperatorSchema.optional(),
  actual: z.unknown().optional(),
  expected: z.unknown().optional(),
  /** Plain-expression result. */
  value: z.unknown().optional(),
  /** The canonical JSONata rendering of the line, when it parsed. */
  jsonata: z.string().optional(),
  error: LineErrorSchema.optional()
});
export type LineResult = z.infer<typeof LineResultSchema>;

/** Every line of a run, plus the counters the header shows. */
export const RunSummarySchema = z.object({
  results: z.array(LineResultSchema),
  passed: z.number().int(),
  failed: z.number().int(),
  errors: z.number().int()
});
export type RunSummary = z.infer<typeof RunSummarySchema>;

/** The JSON input pane parsed: a value, or the message and offset to underline. */
export const JsonParseSchema = z.object({
  value: z.unknown(),
  error: z
    .object({
      message: z.string(),
      from: z.number().int().nullable()
    })
    .nullable()
});
export type JsonParse = z.infer<typeof JsonParseSchema>;
