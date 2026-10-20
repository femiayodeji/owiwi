// Opens the native share sheet for a story. Uses React Native's built-in Share API.
import { Share } from 'react-native';
import { formatShareMessage, type ShareableStory } from './share';

/** Never throws: a dismissed or failed share sheet is not an error worth surfacing. */
export async function shareStory(story: ShareableStory): Promise<void> {
  const { title, message } = formatShareMessage(story);
  try {
    await Share.share({ title, message }, { dialogTitle: 'Share story', subject: title });
  } catch {
    // Share sheet unavailable or dismissed.
  }
}
