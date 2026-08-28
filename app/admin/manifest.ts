import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/admin",
    name: "LEELA JEWELLERS ADMIN",
    short_name: "LEELA ADMIN",
    description: "LEELA JEWELLERS ADMIN PANEL",
    start_url: "/admin",
    scope: "/admin",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      {
        src: "/admin-icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/admin-icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
