import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";

// The changelog is the release notes of the app, read where they already live.
// release-notes/*.md are the English originals; release-notes/pt/*.md the Portuguese ones.
const releases = defineCollection({
  loader: glob({ pattern: "*.md", base: "../release-notes" }),
});
const releasesPt = defineCollection({
  loader: glob({ pattern: "*.md", base: "../release-notes/pt" }),
});

export const collections = { releases, releasesPt };
