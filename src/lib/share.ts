// Builds the plain-text message shared from a story card or a bookmark.
// Pure: no React Native imports, so it is unit-tested directly.

export interface ShareableStory {
  title: string;
  summary: string;
  url: string;
}

export const SHARE_TAG = 'via Owiwi';

export interface ShareContent {
  /** Dialog/subject title (used by Android's chooser and iOS mail subject). */
  title: string;
  /** Full plain-text body: title, summary, link and tag. */
  message: string;
}

const clean = (s: string): string => s.replace(/\s+/g, ' ').trim();

export function formatShareMessage(story: ShareableStory): ShareContent {
  const title = clean(story.title);
  const summary = clean(story.summary);
  const url = story.url.trim();
  const parts = [title, summary, url, SHARE_TAG].filter((p) => p.length > 0);
  return { title, message: parts.join('\n\n') };
}
