// Shares a story from a card or a bookmark: as an image of the card in the current
// theme (no caption, the image says it all), or as plain text if the image fails.
import { Share } from 'react-native';
import { renderShareImage } from '../components/ShareCard';
import type { BookmarkSource } from './bookmarks';
import { formatShareMessage } from './share';

// One share at a time: a quick second tap would otherwise open a second sheet.
let sharing = false;

/** Never throws: a dismissed or failed share sheet is not an error worth surfacing. */
export async function shareStory(story: BookmarkSource): Promise<void> {
  if (sharing) return;
  sharing = true;
  try {
    await shareImageOrText(story);
  } finally {
    sharing = false;
  }
}

async function shareImageOrText(story: BookmarkSource): Promise<void> {
  try {
    // Loaded lazily: a build without the native module falls back to text instead of crashing.
    const Sharing = await import('expo-sharing');
    if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing unavailable');
    const uri = await renderShareImage(story);
    await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share story' });
    return;
  } catch {
    // Fall back to text so Share always does something.
  }
  const { title, message } = formatShareMessage(story);
  try {
    await Share.share({ title, message }, { dialogTitle: 'Share story', subject: title });
  } catch {
    // Share sheet unavailable or dismissed.
  }
}
