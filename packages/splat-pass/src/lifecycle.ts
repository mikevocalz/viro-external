/** Dependency-free lifecycle shared by RN adapters and native host bindings. */
export function createSplatHandle(id: string, count: () => number, detach: () => Promise<void>, untrack: () => void) {
  let released = false;
  let pending: Promise<void> | undefined;
  return {
    id,
    splatCount: () => released ? 0 : count(),
    release(): Promise<void> {
      if (released) return Promise.resolve();
      if (pending) return pending;
      pending = Promise.resolve().then(detach).then(() => {
        released = true;
        untrack();
      }).finally(() => { pending = undefined; });
      return pending;
    },
  };
}
