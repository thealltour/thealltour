import { terms } from "./metadataText";

/**
 * Controlled vocabulary for reading provider titles and tags. A concept is matched when one of its phrases appears as a
 * contiguous run of normalized words (never a substring). Narrower concepts count as evidence for the broader one
 * (shrimp for seafood), never the other way round. Categories only group subjects that can contradict each other
 * (pizza vs seafood); concepts without a category never conflict.
 */
export type Axis = "subject" | "action" | "context";
export type Concept = { id: string; axis: Axis; category?: "food" | "drink" | "vehicle" | "animal"; phrases: string[]; narrower?: string[]; generic?: boolean };

export const CONCEPTS: Concept[] = [
  { id: "seafood", axis: "subject", category: "food", phrases: ["seafood", "sea food", "seafood dish"], narrower: ["shrimp", "shellfish", "crab", "lobster", "squid", "octopus", "fish", "sushi"] },
  { id: "shrimp", axis: "subject", category: "food", phrases: ["shrimp", "prawn"] },
  { id: "shellfish", axis: "subject", category: "food", phrases: ["shellfish", "clam", "mussel", "oyster", "scallop", "snail", "sea snail", "cockle", "seashell"] },
  { id: "crab", axis: "subject", category: "food", phrases: ["crab"] },
  { id: "lobster", axis: "subject", category: "food", phrases: ["lobster", "crayfish"] },
  { id: "squid", axis: "subject", category: "food", phrases: ["squid", "calamari", "cuttlefish"] },
  { id: "octopus", axis: "subject", category: "food", phrases: ["octopus"] },
  { id: "fish", axis: "subject", category: "food", phrases: ["fish", "fish fillet", "salmon", "tuna", "mackerel", "sashimi"] },
  { id: "sushi", axis: "subject", category: "food", phrases: ["sushi"] },
  { id: "meat", axis: "subject", category: "food", phrases: ["meat", "beef", "pork", "chicken", "steak", "sausage", "skewer", "kebab"] },
  { id: "noodles", axis: "subject", category: "food", phrases: ["noodle", "pho", "ramen", "udon"] },
  { id: "pizza", axis: "subject", category: "food", phrases: ["pizza"] },
  { id: "burger", axis: "subject", category: "food", phrases: ["burger", "hamburger", "cheeseburger"] },
  { id: "sandwich", axis: "subject", category: "food", phrases: ["sandwich", "banh mi"] },
  { id: "bread", axis: "subject", category: "food", phrases: ["bread", "bagel", "simit", "baguette"] },
  { id: "dessert", axis: "subject", category: "food", phrases: ["dessert", "cake", "ice cream", "pastry", "pudding"] },
  { id: "fruit", axis: "subject", category: "food", phrases: ["fruit", "mango", "banana", "coconut", "durian"] },
  { id: "corn", axis: "subject", category: "food", phrases: ["corn"] },
  { id: "salad", axis: "subject", category: "food", phrases: ["salad"] },
  { id: "soup", axis: "subject", category: "food", phrases: ["soup", "stew", "hot pot", "hotpot"] },
  { id: "coffee", axis: "subject", category: "drink", phrases: ["coffee", "espresso", "latte", "cappuccino"] },
  { id: "tea", axis: "subject", category: "drink", phrases: ["tea"] },
  { id: "juice", axis: "subject", category: "drink", phrases: ["juice", "smoothie", "sugarcane juice"] },
  { id: "beer", axis: "subject", category: "drink", phrases: ["beer", "cocktail", "wine"] },
  { id: "motorbike", axis: "subject", category: "vehicle", phrases: ["motorbike", "motorcycle", "scooter", "moped"] },
  { id: "car", axis: "subject", category: "vehicle", phrases: ["car", "taxi"] },
  { id: "bus", axis: "subject", category: "vehicle", phrases: ["bus"] },
  { id: "bicycle", axis: "subject", category: "vehicle", phrases: ["bicycle", "bike", "cyclist"] },
  { id: "boat", axis: "subject", category: "vehicle", phrases: ["boat", "ferry", "ship"] },
  { id: "train", axis: "subject", category: "vehicle", phrases: ["train", "subway", "metro train"] },
  { id: "cat", axis: "subject", category: "animal", phrases: ["cat", "kitten"] },
  { id: "dog", axis: "subject", category: "animal", phrases: ["dog", "puppy"] },
  { id: "bird", axis: "subject", category: "animal", phrases: ["bird", "pigeon", "parrot"] },
  { id: "grill", axis: "action", phrases: ["grill", "grilled", "grilling", "barbecue", "barbecued", "bbq", "charcoal", "roast", "roasted", "roasting"] },
  { id: "cook", axis: "action", phrases: ["cook", "cooking", "cooked", "fry", "fried", "frying", "stir fry", "boil", "boiling", "steamed", "steaming", "preparing food"] },
  { id: "eat", axis: "action", generic: true, phrases: ["eat", "eating", "dining", "dine", "diner", "feast", "meal"] },
  { id: "drink", axis: "action", generic: true, phrases: ["drink", "drinking", "sip", "sipping"] },
  { id: "walk", axis: "action", generic: true, phrases: ["walk", "walking", "stroll", "strolling", "pedestrian"] },
  { id: "ride", axis: "action", phrases: ["ride", "riding", "driving"] },
  { id: "sell", axis: "action", phrases: ["sell", "selling", "vendor sell"] },
  { id: "street_food", axis: "context", phrases: ["street food", "street vendor", "food stall", "food cart", "hawker", "roadside food", "roadside stall", "sidewalk dining", "sidewalk food", "street dining", "food street"] },
  { id: "night_market", axis: "context", phrases: ["night market"] },
  { id: "market", axis: "context", phrases: ["market", "marketplace", "bazaar"] },
  { id: "outdoor_dining", axis: "context", phrases: ["outdoor dining", "alfresco", "outdoor cafe", "outdoor restaurant", "terrace dining", "street dining"] },
  { id: "plastic_stool", axis: "context", phrases: ["plastic stool", "plastic chair", "low stool", "low table"] },
  { id: "restaurant", axis: "context", phrases: ["restaurant", "eatery", "bistro", "food court"] },
  { id: "beach", axis: "context", phrases: ["beach", "seaside", "shore"] },
  { id: "river", axis: "context", phrases: ["river", "riverside", "canal"] },
  { id: "temple", axis: "context", phrases: ["temple", "pagoda", "shrine"] },
  { id: "alley", axis: "context", phrases: ["alley", "alleyway", "lane"] },
  { id: "traffic", axis: "context", phrases: ["traffic", "intersection", "crosswalk", "rush hour"] },
  { id: "rooftop", axis: "context", phrases: ["rooftop", "roof top"] },
  { id: "kitchen", axis: "context", phrases: ["kitchen"] },
];
/**
 * Words that describe almost any people or street clip. They are shown as "일반어만 일치" and never move a candidate
 * up on their own; concept phrases that contain them (street food) still count.
 */
export const GENERIC_TERMS = new Set(terms([
  "people person man woman men women friend friends family couple crowd local locals tourist tourists",
  "eat eating sit sitting table tables chair street streets outdoor outdoors food foods meal dish dishes plate",
  "city urban town day night evening morning vibrant bustling busy lively delicious tasty enjoy enjoying enjoys",
  "view life lifestyle traditional fresh beautiful time casual cozy charming moment authentic experience",
].join(" ")));

const byId = new Map(CONCEPTS.map(c => [c.id, c]));
const conceptTerms = CONCEPTS.map(c => ({ concept: c, phrases: c.phrases.map(p => ({ phrase: p, words: terms(p) })).filter(p => p.words.length) }));
export type Sequences = string[][];
/** Normalized word runs to search in: the slug as one run and each tag as its own run. */
export const sequencesOf = (texts: Array<string | null | undefined>): Sequences => texts.flatMap(t => t ? [terms(t)] : []).filter(s => s.length);
export function containsRun(sequences: Sequences, words: string[]) {
  if (!words.length) return false;
  return sequences.some(seq => { for (let i = 0; i + words.length <= seq.length; i++) if (words.every((w, j) => seq[i + j] === w)) return true; return false; });
}
export type ConceptHit = { concept: Concept; phrase: string };
/** Concepts named in the text, in vocabulary order; the first matching phrase is reported as the evidence. */
export function conceptsIn(sequences: Sequences, axis?: Axis): ConceptHit[] {
  return conceptTerms.flatMap(({ concept, phrases }) => {
    if (axis && concept.axis !== axis) return [];
    const hit = phrases.find(p => containsRun(sequences, p.words)); return hit ? [{ concept, phrase: hit.phrase }] : [];
  });
}
/** A concept and every concept below it, so evidence for shrimp also counts for seafood. */
export function withNarrower(id: string, seen = new Set<string>()): Set<string> {
  if (seen.has(id)) return seen; seen.add(id);
  for (const child of byId.get(id)?.narrower ?? []) withNarrower(child, seen);
  return seen;
}
export const conceptById = (id: string) => byId.get(id) ?? null;
/** Content words that are neither generic nor stopwords; used when a requirement names nothing in the vocabulary. */
export const specificTerms = (text: string) => [...new Set(terms(text).filter(t => !GENERIC_TERMS.has(t)))];
