/**
 * Reference-counted, size-bounded cache for resources the host owns
 * (materials it builds from scene definitions). Borrowed resources from the
 * asset registry never enter it.
 *
 * - `acquire` returns a cached value or builds one, and counts the holder.
 * - `release` drops one holder. Unheld entries stay cached for reuse until
 *   the cache is over `maxIdle`, then the least recently used one is
 *   disposed.
 * - `dispose` disposes every entry once. It is idempotent, and so is
 *   `release` for a holder that already released.
 *
 * Dependency-free and free of Lens globals.
 */
type Entry<V> = { value: V; holders: Set<number> };

export class ViroSpecsResourceCache<V> {
  private readonly entries = new Map<string, Entry<V>>();
  private disposed = false;

  /**
   * @param maxIdle Unheld entries kept for reuse. Held entries are never evicted.
   * @param disposeValue Frees one value. Called exactly once per value.
   * @param onEvict Told about each eviction, for diagnostics.
   */
  constructor(
    private readonly maxIdle: number,
    private readonly disposeValue: (value: V) => void,
    private readonly onEvict: (key: string) => void = () => undefined
  ) {}

  /** Entries currently cached, held or idle. */
  get size(): number {
    return this.entries.size;
  }

  /** Holders of `key`, 0 when absent. */
  holdersOf(key: string): number {
    return this.entries.get(key)?.holders.size ?? 0;
  }

  /**
   * Returns the cached value for `key`, building it with `create` when
   * missing. `holder` identifies the scene that holds it. Returns null when
   * `create` returns null; nothing is cached then.
   */
  acquire(key: string, holder: number, create: () => V | null): V | null {
    if (this.disposed) return null;
    let entry = this.entries.get(key);
    if (!entry) {
      const value = create();
      if (value === null) return null;
      entry = { value, holders: new Set() };
    } else {
      this.entries.delete(key);
    }
    entry.holders.add(holder);
    this.entries.set(key, entry); // most recently used last
    return entry.value;
  }

  /** Drops every key `holder` holds, then evicts idle entries over the bound. */
  releaseHolder(holder: number): void {
    for (const entry of this.entries.values()) entry.holders.delete(holder);
    this.evict();
  }

  /** Drops `holder` from every key not in `keep`, then evicts idle entries over the bound. */
  releaseUnused(holder: number, keep: ReadonlySet<string>): void {
    for (const [key, entry] of this.entries) if (!keep.has(key)) entry.holders.delete(holder);
    this.evict();
  }

  /** Disposes everything. Idempotent. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    const values = Array.from(this.entries.values(), (e) => e.value);
    this.entries.clear();
    for (const value of values) this.disposeValue(value);
  }

  private evict(): void {
    let idle = 0;
    for (const entry of this.entries.values()) if (entry.holders.size === 0) idle++;
    for (const [key, entry] of Array.from(this.entries)) {
      if (idle <= this.maxIdle) break;
      if (entry.holders.size > 0) continue;
      this.entries.delete(key);
      idle--;
      this.disposeValue(entry.value);
      this.onEvict(key);
    }
  }
}
