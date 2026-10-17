// Full-screen vertical pager: one card per page, swipe up for the next.
import { useCallback, useRef, useState } from 'react';
import { FlatList, RefreshControl, View, type ListViewToken } from 'react-native';
import type { Card } from '../db/queries';
import type { Slot } from '../llm/types';
import { colors } from '../lib/theme';
import { CompletionCard } from './CompletionCard';
import { StoryCard } from './StoryCard';

type Item = { kind: 'card'; card: Card } | { kind: 'done' };

interface Props {
  cards: Card[];
  slot: Slot;
  streak: number;
  /** Fires once when the last story card is reached. */
  onReachedEnd: () => void;
  onIndexChange?: (index: number) => void;
  onPullToRegenerate: () => void;
}

export function Pager({ cards, slot, streak, onReachedEnd, onIndexChange, onPullToRegenerate }: Props) {
  const [height, setHeight] = useState(0);
  const items: Item[] = [...cards.map((card) => ({ kind: 'card' as const, card })), { kind: 'done' as const }];
  const firedEnd = useRef(false);

  // Must be stable for FlatList; read latest props via refs.
  const latest = useRef({ onReachedEnd, onIndexChange, total: cards.length });
  latest.current = { onReachedEnd, onIndexChange, total: cards.length };
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ListViewToken[] }) => {
    const index = viewableItems[0]?.index;
    if (index == null) return;
    latest.current.onIndexChange?.(index);
    if (index >= latest.current.total - 1 && !firedEnd.current) {
      firedEnd.current = true;
      latest.current.onReachedEnd();
    }
  }).current;

  const getItemLayout = useCallback(
    (_: ArrayLike<Item> | null | undefined, index: number) => ({ length: height, offset: height * index, index }),
    [height],
  );

  return (
    <View style={{ flex: 1 }} onLayout={(e) => setHeight(e.nativeEvent.layout.height)}>
      {height > 0 ? (
        <FlatList
          data={items}
          keyExtractor={(item) => (item.kind === 'card' ? item.card.id : 'done')}
          renderItem={({ item, index }) =>
            item.kind === 'card' ? (
              <StoryCard card={item.card} height={height} index={index} total={cards.length} />
            ) : (
              <CompletionCard height={height} slot={slot} streak={streak} />
            )
          }
          pagingEnabled
          showsVerticalScrollIndicator={false}
          decelerationRate="fast"
          getItemLayout={getItemLayout}
          windowSize={3}
          initialNumToRender={2}
          maxToRenderPerBatch={2}
          viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
          onViewableItemsChanged={onViewableItemsChanged}
          refreshControl={<RefreshControl refreshing={false} onRefresh={onPullToRegenerate} tintColor={colors.indigo} />}
        />
      ) : null}
    </View>
  );
}
