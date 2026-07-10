import { useEffect, useState } from "react";

export function useAsyncData<T>(fetcher: () => Promise<T>, deps: unknown[], initial: T): { data: T; loading: boolean } {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetcher().then((result) => {
      if (active) {
        setData(result);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading };
}
