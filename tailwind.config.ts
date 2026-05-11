import type { Config } from "tailwindcss";

/**
 * 与 `app/globals.css` 中 `@theme` 的 `--color-main` 保持一致（全页深色底）。
 * Tailwind v4 通过 CSS 内 `@config` 引用本文件。
 */
const config = {
  theme: {
    extend: {
      colors: {
        main: "#000c17",
      },
    },
  },
} satisfies Config;

export default config;
