import type { Brief, Category, Recommendation, TasteResult } from './types.ts'

/**
 * Sample data for demos when the outside services are unavailable. These are NOT Qloo results: the ids start with
 * "sample:" so nobody can mistake them for Qloo entity ids, and every result built from them is labelled mode "sample".
 */
const SAMPLE: Partial<Record<Category, { name: string; tags: string[]; why: string }[]>> = {
  movie: [
    { name: 'Spirited Away', tags: ['animation', 'fantasy'], why: 'A gentle, imaginative film that suits a cosy evening.' },
    { name: 'Parasite', tags: ['thriller', 'drama'], why: 'Tense and clever, for someone who likes stories with a twist.' },
    { name: 'The Grand Budapest Hotel', tags: ['comedy', 'stylised'], why: 'Colourful and witty, easy to watch with friends.' },
  ],
  tv_show: [
    { name: 'Avatar: The Last Airbender', tags: ['adventure', 'animation'], why: 'A warm adventure series with a strong story.' },
    { name: 'Dark', tags: ['mystery', 'sci-fi'], why: 'A puzzle-box series for people who enjoy piecing things together.' },
  ],
  artist: [
    { name: 'Tulus', tags: ['pop', 'indonesian'], why: 'Smooth Indonesian pop for relaxed listening.' },
    { name: 'Hindia', tags: ['indie', 'indonesian'], why: 'Reflective indie songwriting with a modern feel.' },
    { name: 'Norah Jones', tags: ['jazz', 'acoustic'], why: 'Calm, acoustic and good for studying.' },
  ],
  place: [
    { name: 'A quiet neighbourhood coffee shop', tags: ['cafe', 'quiet'], why: 'Good for reading or working without noise.' },
    { name: 'A night market food street', tags: ['street food', 'lively'], why: 'Many small dishes to share.' },
  ],
  book: [{ name: 'Norwegian Wood', tags: ['novel', 'literary'], why: 'A quiet, absorbing read.' }],
  podcast: [{ name: 'Radiolab', tags: ['science', 'storytelling'], why: 'Curious, well produced stories about ideas.' }],
  videogame: [{ name: 'Stardew Valley', tags: ['relaxing', 'farming'], why: 'A calm game you can play in short sessions.' }],
  brand: [{ name: 'Uniqlo', tags: ['basics', 'affordable'], why: 'Simple everyday clothes at fair prices.' }],
}

export function sampleResult(brief: Brief, categories: Category[]): TasteResult {
  const count = brief.count ?? 5
  const picks: Recommendation[] = []
  for (const category of categories) {
    for (const [index, item] of (SAMPLE[category] ?? []).entries()) {
      picks.push({ name: item.name, category, why: item.why, qlooEntityId: `sample:${category}:${index}`, confidence: 0.5 })
    }
  }
  return {
    summary: 'Sample mode: these are fixed examples, not Qloo results.',
    recommendations: picks.slice(0, count),
    sources: [],
    mode: 'sample',
    notes: [],
  }
}
