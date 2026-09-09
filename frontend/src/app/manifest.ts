import type { MetadataRoute } from "next";

// Ilovani telefonga o'rnatish (PWA "Add to Home Screen") uchun. Offline/service
// worker qo'shilmagan - faqat brauzerning tabiiy o'rnatish imkoniyati.
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
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
