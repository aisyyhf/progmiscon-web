import { useEffect, useState } from "react";
import { EFFECTIVE_MASTER_DATA_INVALIDATED } from "../services/masterDataRepository";

export function useAsyncData<T>(fetcher: () => Promise<T>, deps: unknown[], initial: T): { data: T; loading: boolean } {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  const [masterDataRevision, setMasterDataRevision] = useState(0);

  useEffect(() => {
    const refresh = () => setMasterDataRevision((current) => current + 1);
    window.addEventListener(EFFECTIVE_MASTER_DATA_INVALIDATED, refresh);
    return () =>
      window.removeEventListener(EFFECTIVE_MASTER_DATA_INVALIDATED, refresh);
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);

    fetcher()
      .then((result) => {
        if (active) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((error: unknown) => {
        console.error("[Progmiscon] Gagal memuat data", error);
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, masterDataRevision]);

  return { data, loading };
}
