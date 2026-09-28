import type { MetadataRoute } from "next";

// PWA install (desktop + "Add to Home Screen"). public/sw.js is a minimal
// pass-through service worker (no offline cache) that makes the app installable.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Dona Don",
    short_name: "Dona Don",
    description: "Don savdosi bilan shug'ullanuvchi firma uchun ombor va savdo boshqaruv tizimi",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#caa23c",
    icons: [
      {
        src: "/wheat-sack.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/wheat-sack.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
