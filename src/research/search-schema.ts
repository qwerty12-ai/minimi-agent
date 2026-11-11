import { z } from "zod";

export const SearchRequestSchema = z.object({
  query: z.string().trim().min(1).max(500),

  maxResults: z.number()
    .int()
    .min(1)
    .max(20)
    .optional(),

  region: z.string()
    .trim()
    .min(1)
    .max(100)
    .optional(),

  timeRange: z.enum([
    "day",
    "week",
    "month",
    "year",
  ]).optional(),
}).strict();

export const SearchResultSchema = z.object({
  title: z.string().trim().min(1).max(500),

  url: z.string()
    .url()
    .refine(
      (value) =>
        value.startsWith("http://") ||
        value.startsWith("https://"),
      "URL must use HTTP or HTTPS."
    ),

  snippet: z.string().max(5000),

  source: z.string().trim().min(1).max(200),

  publishedAt: z.string().datetime().optional(),

  score: z.number().finite().optional(),
}).strict();

export const SearchResponseSchema = z.object({
  query: z.string().trim().min(1),

  provider: z.string().trim().min(1),

  searchedAt: z.string().datetime(),

  results: z.array(SearchResultSchema).max(20),
}).strict();

export function parseSearchRequest(
  value: unknown
) {
  return SearchRequestSchema.parse(value);
}

export function parseSearchResult(
  value: unknown
) {
  return SearchResultSchema.parse(value);
}

export function parseSearchResponse(
  value: unknown
) {
  return SearchResponseSchema.parse(value);
}