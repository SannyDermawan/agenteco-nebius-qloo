import { z } from 'zod'

/** The kinds of things Qloo can recommend, as they appear in its `urn:entity:*` types. */
export const CATEGORIES = ['movie', 'tv_show', 'artist', 'place', 'book', 'brand', 'podcast', 'videogame'] as const
export type Category = (typeof CATEGORIES)[number]

export const briefSchema = z.object({
  request: z.string().min(3).max(500),
  /** Optional: how many recommendations to return (1 to 10). */
  count: z.number().int().min(1).max(10).optional(),
})
export type Brief = z.infer<typeof briefSchema>

/** One recommendation. Every one must carry the id of a Qloo entity that Qloo actually returned. */
export const recommendationSchema = z.object({
  name: z.string().min(1).max(200),
  category: z.string().min(1).max(60),
  why: z.string().min(1).max(400),
  qlooEntityId: z.string().min(1).max(80),
  confidence: z.number().min(0).max(1),
})
export type Recommendation = z.infer<typeof recommendationSchema>

export interface Source {
  kind: 'qloo-search' | 'qloo-insights'
  detail: string
  entityIds: string[]
}

export interface TasteResult {
  summary: string
  recommendations: Recommendation[]
  sources: Source[]
  /** live = Qloo and the model were called now. sample = fixture data, labelled as such everywhere. */
  mode: 'live' | 'sample'
  /** Honest notes: for example that the model was unavailable and Qloo's own ranking was used. */
  notes: string[]
  models?: { fast: string; reasoning: string }
}

/** What the language model is asked to extract from the free-text request. */
export const intentSchema = z.object({
  categories: z.array(z.enum(CATEGORIES)).min(1).max(3),
  /** Titles, artists or places the person says they already like. */
  seeds: z.array(z.string().min(1).max(100)).max(5),
  tags: z.array(z.string().min(1).max(60)).max(5),
})
export type Intent = z.infer<typeof intentSchema>

/** What the language model returns for the final selection. */
export const selectionSchema = z.object({
  summary: z.string().min(1).max(500),
  picks: z
    .array(
      z.object({
        qlooEntityId: z.string().min(1).max(80),
        why: z.string().min(1).max(400),
        confidence: z.number().min(0).max(1),
      })
    )
    .max(10),
})
export type Selection = z.infer<typeof selectionSchema>

/** The capability this agent sells on AgentEco. */
export const CAPABILITY_ID = 'taste_recommendations'
