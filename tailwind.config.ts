import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        kente: {
          50: "#fff8ed",
          100: "#ffefd1",
          200: "#fedba2",
          300: "#fdbf68",
          400: "#fb9d34",
          500: "#f37e14",
          600: "#e3640a",
          700: "#bc4a0b",
          800: "#963b10",
          900: "#793311",
          950: "#411706",
        },
        forest: {
          50: "#f1f8f3",
          100: "#deeee2",
          200: "#bedcc7",
          300: "#92c2a3",
          400: "#65a37c",
          500: "#458760",
          600: "#316b4b",
          700: "#28563d",
          800: "#224532",
          900: "#1d3a2b",
          950: "#0f2017",
        },
        ink: {
          50: "#f6f6f5",
          100: "#e7e6e3",
          200: "#cfccc7",
          300: "#aea9a1",
          400: "#8c857a",
          500: "#736c60",
          600: "#5b554c",
          700: "#4a453e",
          800: "#3e3a35",
          900: "#37332f",
          950: "#1f1c19",
        },
      },
      fontFamily: {
        display: ['"Fraunces"', "ui-serif", "Georgia", "serif"],
        sans: ['"Inter"', "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(31,28,25,0.04), 0 8px 24px rgba(31,28,25,0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
