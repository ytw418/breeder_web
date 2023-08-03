/** @type {import('tailwindcss').Config} */

const defaultTheme = require("tailwindcss/defaultTheme");
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
      colors: {
        Black: "#191919",
        White: "#FFFFFF",
        Primary: "#f97316",
        Purple: "#5F50F0",
        Red: "#F66570",
        Modal: "#000000",
        Gray: {
          100: "#FAFAFA",
          200: "#F6F6F6",
          300: "#E5E5E5",
          400: "#B2B2B2",
          500: "#7F7F7F",
          600: "#4C4C4C",
        },
      },
      fontFamily: {
        pretendard: ["Pretendard Variable", ...defaultTheme.fontFamily.sans],
        poppins: ["Poppins", ...defaultTheme.fontFamily.sans],
      },
    },
  },

  plugins: [require("tailwind-scrollbar-hide")],
};
