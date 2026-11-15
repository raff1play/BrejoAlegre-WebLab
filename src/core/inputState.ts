/**
 * Tracks which logical controls are held, per input source (keyboard, or one pointer id per finger).
 * A control stays down while at least one source holds it, and releasing a source can never leave
 * another source's control stuck.
 */
export class InputState<Control extends string> {
  private readonly held = new Map<string, Set<Control>>();

  press(source: string, control: Control): void {
    let set = this.held.get(source);
    if (!set) { set = new Set(); this.held.set(source, set); }
    set.add(control);
  }

  release(source: string, control: Control): void {
    const set = this.held.get(source);
    if (!set) return;
    set.delete(control);
    if (set.size === 0) this.held.delete(source);
  }

  releaseSource(source: string): void { this.held.delete(source); }

  clear(): void { this.held.clear(); }

  isDown(control: Control): boolean {
    for (const set of this.held.values()) if (set.has(control)) return true;
    return false;
  }

  /** Returns +1, -1 or 0 for a pair of opposing controls. */
  axis(positive: Control, negative: Control): number {
    return (this.isDown(positive) ? 1 : 0) - (this.isDown(negative) ? 1 : 0);
  }
}
