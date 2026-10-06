import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  root: "./example",
  resolve: {
    alias: {
      // tuner/page.tsx imports the package by its published specifier (so a
      // consumer who copies the file out via `npx vista-sheet add tuner`
      // needs zero edits). This alias is what lets that same, unmodified
      // file also run here against live local source.
      "@seansmithworks/vista-sheet": resolve(__dirname, "../src/index.ts"),
    },
  },
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        flagship: resolve(__dirname, "flagship.html"),
        tune: resolve(__dirname, "tune.html"),
        mediaCard: resolve(__dirname, "media-card.html"),
        list: resolve(__dirname, "list.html"),
        contact: resolve(__dirname, "contact.html"),
        play: resolve(__dirname, "play.html"),
        canvas: resolve(__dirname, "canvas.html"),
        video: resolve(__dirname, "video.html"),
        buttons: resolve(__dirname, "buttons.html"),
        linkPreview: resolve(__dirname, "link-preview.html"),
        focus: resolve(__dirname, "fixtures/focus.html"),
      },
    },
  },
});
