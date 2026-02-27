/**
 * FenwickTree (Binary Indexed Tree)
 *
 * Maintains a prefix-sum array with O(log n) point updates and O(log n) prefix
 * queries. Used by VirtualScrollEngine to track cumulative row heights so that
 * pixel-to-row-index lookup is O(log n) rather than O(n).
 *
 * Indexing convention: the public API is 0-based (matching displayIndex).
 * Internally the tree uses a 1-based array so that the standard BIT bit-trick
 * `i & -i` works without any special casing.
 */
export class FenwickTree {
  private readonly tree: Float64Array;
  private readonly size: number;

  constructor(size: number) {
    if (size < 0) throw new RangeError(`FenwickTree size must be >= 0, got ${size}`);
    this.size = size;
    this.tree = new Float64Array(size + 1); // 1-based, index 0 unused
  }

  /**
   * Add `delta` to the value stored at 0-based `index`.
   * O(log n)
   */
  update(index: number, delta: number): void {
    if (index < 0 || index >= this.size) {
      throw new RangeError(`FenwickTree.update: index ${index} out of range [0, ${this.size - 1}]`);
    }
    let i = index + 1; // convert to 1-based
    while (i <= this.size) {
      this.tree[i] += delta;
      i += i & -i; // move to next responsible node
    }
  }

  /**
   * Returns the prefix sum from index 0 up to and including 0-based `index`.
   * i.e. sum of values[0..index].
   * O(log n)
   */
  query(index: number): number {
    if (index < 0) return 0;
    if (index >= this.size) index = this.size - 1;
    let sum = 0;
    let i = index + 1; // convert to 1-based
    while (i > 0) {
      sum += this.tree[i];
      i -= i & -i; // move to parent
    }
    return sum;
  }

  /**
   * Returns the sum of values in the half-open range [left, right).
   * Both indices are 0-based.
   * O(log n)
   */
  queryRange(left: number, right: number): number {
    if (right <= left) return 0;
    return this.query(right - 1) - (left > 0 ? this.query(left - 1) : 0);
  }

  /**
   * Returns the total sum of all values.
   * O(log n)
   */
  queryAll(): number {
    return this.query(this.size - 1);
  }

  /**
   * Binary search: returns the smallest 0-based index whose prefix sum is
   * >= `target`. Returns `size` if no such index exists (target > total sum).
   *
   * This lets us convert a pixel offset Y into a row display index in O(log n)
   * without a linear scan.
   *
   * O(log n) — descends the implicit segment tree structure of the BIT.
   */
  findFirst(target: number): number {
    if (target <= 0) return 0;
    let index = 0;
    let bitMask = this.highBit(this.size);

    while (bitMask > 0) {
      const next = index + bitMask;
      if (next <= this.size && this.tree[next] < target) {
        index = next;
        target -= this.tree[next];
      }
      bitMask >>= 1;
    }
    // `index` is now 1-based; convert back to 0-based
    return index; // index === the 0-based result because we haven't added 1 yet
  }

  /**
   * Returns the number of elements tracked.
   */
  get length(): number {
    return this.size;
  }

  /**
   * Resets all values to zero.
   * O(n)
   */
  clear(): void {
    this.tree.fill(0);
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  /**
   * Highest power of 2 that is <= n.
   */
  private highBit(n: number): number {
    let bit = 1;
    while (bit <= n) bit <<= 1;
    return bit >> 1;
  }
}
