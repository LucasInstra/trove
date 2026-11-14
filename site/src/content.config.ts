import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";

// The changelog is the release notes of the app, read where they already live.
const releases = defineCollection({
  loader: glob({ pattern: "*.md", base: "../release-notes" }),
});

export const collections = { releases };
