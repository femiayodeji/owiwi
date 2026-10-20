// Bookmarked urls, loaded once and kept in sync on every toggle, so story cards
// can show the right saved state without a query per card.
import { create } from 'zustand';
import { getDb } from '../db/client';
import { addBookmark, listBookmarkedUrls, removeBookmark, saveBookmark, type Bookmark } from '../db/queries';
import { withUrl, type BookmarkSource } from '../lib/bookmarks';

interface BookmarkStore {
  urls: ReadonlySet<string>;
  loaded: boolean;
  /** Loads bookmarked urls once per process; later calls are no-ops. */
  ensureLoaded(): Promise<void>;
  /** Saves or un-saves a story. Returns the new saved state. */
  toggle(story: BookmarkSource): Promise<boolean>;
  /** Removes a bookmark by url. */
  remove(url: string): Promise<void>;
  /** Puts a removed bookmark back exactly as it was (undo). */
  restore(bookmark: Bookmark): Promise<void>;
}

let loading: Promise<void> | null = null;

export const useBookmarks = create<BookmarkStore>((set, get) => ({
  urls: new Set<string>(),
  loaded: false,

  ensureLoaded() {
    if (!loading) {
      loading = (async () => {
        const urls = await listBookmarkedUrls(await getDb());
        // Merge, in case a toggle landed while loading.
        set((s) => ({ urls: new Set([...urls, ...s.urls]), loaded: true }));
      })().catch(() => {
        loading = null;
      });
    }
    return loading;
  },

  async toggle(story) {
    const db = await getDb();
    const saved = !get().urls.has(story.url);
    // Optimistic: flip first so the icon responds instantly, roll back on failure.
    set((s) => ({ urls: withUrl(s.urls, story.url, saved) }));
    try {
      if (saved) await addBookmark(db, story);
      else await removeBookmark(db, story.url);
      return saved;
    } catch (e) {
      set((s) => ({ urls: withUrl(s.urls, story.url, !saved) }));
      throw e;
    }
  },

  async remove(url) {
    await removeBookmark(await getDb(), url);
    set((s) => ({ urls: withUrl(s.urls, url, false) }));
  },

  async restore(bookmark) {
    await saveBookmark(await getDb(), bookmark);
    set((s) => ({ urls: withUrl(s.urls, bookmark.url, true) }));
  },
}));
