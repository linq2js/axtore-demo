class MapEntry<TKey, TValue> {
  public readonly children = new Map<TKey, MapEntry<TKey, TValue>>();
  public value: TValue | undefined;
  public hasValue = false;
}

class ArrayKeyedMap<TValue = unknown, TKey = unknown> {
  private root = new MapEntry<TKey, TValue>();
  private cachedEntries: [keys: TKey[], value: TValue][] | undefined;

  private find<T extends boolean>(
    key: TKey | TKey[],
    createNew?: T
  ):
    | {
        entry: MapEntry<TKey, TValue>;
        parent: MapEntry<TKey, TValue> | undefined;
        key: TKey[];
        lastKey: TKey | undefined;
      }
    | undefined {
    if (!Array.isArray(key)) key = [key];
    let entry = this.root;
    let parent: MapEntry<TKey, TValue> | undefined;
    let lastKey: TKey | undefined;
    for (const k of key) {
      let child = entry.children.get(k);
      if (!child) {
        if (!createNew) return undefined;
        child = new MapEntry<TKey, TValue>();
        entry.children.set(k, child);
      }
      parent = entry;
      lastKey = k;
      entry = child;
    }
    return {
      entry,
      parent,
      key,
      lastKey,
    };
  }

  get(key: TKey | TKey[]): TValue | undefined {
    return this.find(key)?.entry.value;
  }

  getOrAdd(key: TKey | TKey[], addFn: () => TValue) {
    const result = this.find(key, true)!;
    if (!result.entry.hasValue) {
      result.entry.value = addFn();
      result.entry.hasValue = true;
      this.cachedEntries = undefined;
    }
    return result.entry.value;
  }

  set(key: TKey | TKey[], value: TValue) {
    const result = this.find(key, true)!;
    if (result.entry.hasValue && result.entry.value === value) {
      return;
    }
    result.entry.value = value;
    result.entry.hasValue = true;
    this.cachedEntries = undefined;
  }

  delete(key: TKey | TKey[]) {
    const result = this.find(key);
    if (result) {
      result.parent?.children.delete(result.lastKey!);
      this.cachedEntries = undefined;
      return true;
    }
    return false;
  }

  each(callback: (value: TValue, key: TKey[]) => void) {
    function walk(entry: MapEntry<TKey, TValue>, key: TKey[]) {
      entry.children.forEach((child, k) => {
        const childKey = key.concat([k]);
        if (child.hasValue) {
          callback(child.value as TValue, childKey);
        }
        walk(child, childKey);
      });
    }

    walk(this.root, []);
  }

  entries() {
    if (this.cachedEntries) return this.cachedEntries;
    const entries: [keys: TKey[], value: TValue][] = [];
    this.each((value, key) => {
      entries.push([key, value]);
    });
    this.cachedEntries = entries;
    return entries;
  }

  clone() {
    const newMap = new ArrayKeyedMap<TValue, TKey>();
    this.each((value, key) => {
      newMap.set(key, value);
    });
    return newMap;
  }

  clear() {
    this.root.children.clear();
  }
}

export { ArrayKeyedMap };
