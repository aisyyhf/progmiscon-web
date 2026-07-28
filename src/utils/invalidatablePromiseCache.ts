export function createInvalidatablePromiseCache<T>(
  load: () => Promise<T>,
): { get: () => Promise<T>; invalidate: () => void } {
  let promise: Promise<T> | undefined;
  let generation = 0;
  return {
    get: () => {
      if (promise) return promise;
      const currentGeneration = generation;
      const currentPromise = load();
      promise = currentPromise;
      void currentPromise.catch(() => {
        if (generation === currentGeneration && promise === currentPromise) {
          promise = undefined;
        }
      });
      return currentPromise;
    },
    invalidate: () => {
      generation += 1;
      promise = undefined;
    },
  };
}
