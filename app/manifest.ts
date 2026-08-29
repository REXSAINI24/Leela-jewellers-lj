import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "LEELA JEWELLERS",
    short_name: "LEELA JEWELLERS",
    description: "LEELA JEWELLERS – Gold & Silver Jewellery",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f7f3ea",
    theme_color: "#c9a227",
    icons: [
      {
        src: "/customer-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/customer-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
