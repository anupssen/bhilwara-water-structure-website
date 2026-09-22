import { useState, useEffect } from "react";

// Hook to fetch subdistrict records (with centroid coordinates) from the
// FastAPI backend, which reads them from the Bhilwara subdistrict shapefile.
// v2: bumped so stale caches from the old data.gov.in shape are discarded.
const CACHE_KEY = "subdistricts_cache_v2";
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const isValidRecord = (r) =>
  r &&
  typeof r.subdistrict === "string" &&
  typeof r.latitude === "number" &&
  typeof r.longitude === "number";

const useSubdistricts = () => {
  const [data, setData] = useState({ records: [], loading: true, error: null });

  useEffect(() => {
    let cancelled = false;

    const loadFromCache = () => {
      try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed?.ts || Date.now() - parsed.ts > CACHE_TTL) {
          localStorage.removeItem(CACHE_KEY);
          return null;
        }
        const records = parsed.records;
        if (!Array.isArray(records) || !records.every(isValidRecord)) {
          localStorage.removeItem(CACHE_KEY);
          return null;
        }
        return records;
      } catch (e) {
        return null;
      }
    };

    const saveToCache = (records) => {
      try {
        localStorage.setItem(
          CACHE_KEY,
          JSON.stringify({ ts: Date.now(), records }),
        );
      } catch (e) {
        // ignore storage errors
      }
    };

    const fetchAllRecords = async () => {
      setData({ records: [], loading: true, error: null });

      const cached = loadFromCache();
      if (cached) {
        setData({ records: cached, loading: false, error: null });
        return;
      }

      try {
        const resp = await fetch(`${API_BASE_URL}/api/subdistricts/list`);
        if (!resp.ok) throw new Error(`Server returned ${resp.status}`);
        const records = await resp.json();
        if (!Array.isArray(records)) throw new Error("Unexpected response");

        if (!cancelled) {
          setData({ records, loading: false, error: null });
          saveToCache(records);
        }
      } catch (error) {
        console.error("API Error:", error);
        if (!cancelled)
          setData({
            records: [],
            loading: false,
            error: error.message || String(error),
          });
      }
    };

    fetchAllRecords();

    return () => {
      cancelled = true;
    };
  }, []);

  return data;
};

export default useSubdistricts;