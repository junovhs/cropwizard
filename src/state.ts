// Atomic application state. Every mutation produces one complete next state and
// publishes exactly once; nested objects are never changed in place.

import { neutral } from './adjust.js';
import type { AppState, CropItem } from './domain/types.js';

export type StateListener = (state: AppState) => void;
export type StatePatch = Partial<AppState> | ((state: AppState) => Partial<AppState>);
export type ItemUpdater = (item: CropItem) => CropItem;

export interface AppStore {
  get(): AppState;
  set(patch: StatePatch): AppState;
  transact(update: (state: AppState) => AppState): AppState;
  updateItem(id: string, update: ItemUpdater): AppState;
  updateItems(update: ItemUpdater): AppState;
  subscribe(listener: StateListener): () => void;
}

function freezeItem(item: CropItem): CropItem {
  return Object.freeze({
    ...item,
    frame: item.frame ? Object.freeze({ ...item.frame }) : null,
    adjust: Object.freeze({ ...item.adjust }),
  });
}

function freezeState(state: AppState): AppState {
  return Object.freeze({
    ...state,
    target: Object.freeze({ ...state.target }),
    items: Object.freeze(state.items.map(freezeItem)),
  });
}

export function createAppStore(initial: AppState): AppStore {
  let value = freezeState(initial);
  const listeners = new Set<StateListener>();

  const publish = (next: AppState): AppState => {
    if (next === value) return value;
    value = freezeState(next);
    for (const listener of listeners) listener(value);
    return value;
  };

  return {
    get: () => value,
    set(patch): AppState {
      const resolved = typeof patch === 'function' ? patch(value) : patch;
      return publish({ ...value, ...resolved });
    },
    transact(update): AppState {
      return publish(update(value));
    },
    updateItem(id, update): AppState {
      let changed = false;
      const items = value.items.map((item) => {
        if (item.id !== id) return item;
        const next = update(item);
        changed = changed || next !== item;
        return next;
      });
      return changed ? publish({ ...value, items }) : value;
    },
    updateItems(update): AppState {
      let changed = false;
      const items = value.items.map((item) => {
        const next = update(item);
        changed = changed || next !== item;
        return next;
      });
      return changed ? publish({ ...value, items }) : value;
    },
    subscribe(listener): () => void {
      listeners.add(listener);
      listener(value);
      return () => listeners.delete(listener);
    },
  };
}

export function createItem(file: File, image: HTMLImageElement): CropItem {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    file,
    image,
    name: file.name.replace(/\.[^.]+$/, '') || 'image',
    frame: null,
    adjust: neutral(),
    approved: false,
    auto: true,
    framedFor: null,
  };
}

export const store = createAppStore({
  target: { w: 1080, h: 1080, label: 'Square post' },
  items: [],
  activeIndex: -1,
  batch: false,
});

export const activeItem = (state: AppState = store.get()): CropItem | null =>
  state.items[state.activeIndex] ?? null;
