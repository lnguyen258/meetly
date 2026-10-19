import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Meetly",
    short_name: "Meetly",
    description: "Find a time that works for everyone, live.",
    start_url: "/home",
    display: "standalone",
    background_color: "#f7f7fb",
    theme_color: "#5b5bf0",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
