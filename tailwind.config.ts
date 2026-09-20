import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset") as any],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
