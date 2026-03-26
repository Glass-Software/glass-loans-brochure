"use client";

import { useEffect } from "react";

export default function TestMapboxPage() {
  useEffect(() => {
    console.log("=== MAPBOX DEBUG ===");
    console.log("1. NEXT_PUBLIC_MAPBOX_API_KEY:", process.env.NEXT_PUBLIC_MAPBOX_API_KEY);
    console.log("2. Checking if mapbox-gl is available...");

    import("mapbox-gl")
      .then((mapboxgl) => {
        console.log("3. mapbox-gl loaded:", mapboxgl);
        console.log("4. mapboxgl.default:", mapboxgl.default);
      })
      .catch((error) => {
        console.error("5. Failed to load mapbox-gl:", error);
      });
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Mapbox Debug Test</h1>
      <p>Check the browser console (F12) for debug output</p>
    </div>
  );
}
