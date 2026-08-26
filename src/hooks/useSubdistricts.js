import { useState, useEffect } from "react";

// Hook to fetch subdistrict/area records with caching and parallel fetch optimization
const CACHE_KEY = 'subdistricts_cache_v1';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

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
        return parsed.records || null;
      } catch (e) {
        return null;
      }
    };

    const saveToCache = (records) => {
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), records }));
      } catch (e) {
        // ignore storage errors
      }
    };

    const fetchAllRecords = async () => {
      setData({ records: [], loading: true, error: null });

      // try cache first
      const cached = loadFromCache();
      if (cached) {
        setData({ records: cached, loading: false, error: null });
        return;
      }

      try {
        const limit = 999;
        const baseUrl =
          `https://api.data.gov.in/resource/8268264f-e241-41ed-add6-b72390ed257d` +
          `?api-key=${import.meta.env.VITE_SUBDISTRICTS_API_KEY}` +
          `&format=json` +
          `&limit=${limit}` +
          `&filters%5Bstate_name%5D=RAJASTHAN` +
          `&filters%5Bdistrict_name%5D=Bhilwara`;

        // fetch first page to learn total
        const firstResp = await fetch(`${baseUrl}&offset=0`);
        const firstJson = await firstResp.json();
        const total = Number(firstJson.total) || (firstJson.records || []).length;

        let allRecords = [...(firstJson.records || [])];

        if (allRecords.length < total) {
          // prepare parallel fetches for remaining pages
          const pages = [];
          for (let offset = limit; offset < total; offset += limit) {
            pages.push(fetch(`${baseUrl}&offset=${offset}`).then(r => r.json()));
          }

          const results = await Promise.all(pages);
          results.forEach(res => {
            allRecords = allRecords.concat(res.records || []);
          });
        }

        if (!cancelled) {
          setData({ records: allRecords, loading: false, error: null });
          saveToCache(allRecords);
        }
      } catch (error) {
        console.error('API Error:', error);
        if (!cancelled) setData({ records: [], loading: false, error: error.message || String(error) });
      }
    };

    fetchAllRecords();

    return () => { cancelled = true; };
  }, []);

  return data;
};

export default useSubdistricts;