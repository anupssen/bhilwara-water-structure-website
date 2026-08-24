import { useState, useEffect } from "react";

const useSubdistricts = () => {
  const [data, setData] = useState({
    records: []
  });

  useEffect(() => {
    const fetchAllRecords = async () => {
      try {
        const baseUrl =
          `https://api.data.gov.in/resource/8268264f-e241-41ed-add6-b72390ed257d` +
          `?api-key=${import.meta.env.VITE_SUBDISTRICTS_API_KEY}` +
          `&format=json` +
          `&limit=999` +
          `&filters%5Bstate_name%5D=RAJASTHAN` +
          `&filters%5Bdistrict_name%5D=Bhilwara`;

        let allRecords = [];
        let offset = 0;
        let total = 0;

        do {
          const response = await fetch(
            `${baseUrl}&offset=${offset}`
          );

          const result = await response.json();

          total = Number(result.total);

          allRecords = [
            ...allRecords,
            ...(result.records || [])
          ];

          offset += 999;

        } while (allRecords.length < total);

        setData({
          records: allRecords
        });

      } catch (error) {
        console.error("API Error:", error);
      }
    };

    fetchAllRecords();
  }, []);

  return data;
};

export default useSubdistricts;