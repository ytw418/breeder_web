/** @type {import('tailwindcss').Config} */

const defaultTheme = require("tailwindcss/defaultTheme");
module.exports = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
      colors: {
        // 앱(bredy_app palette.ts) 토큰. bg-app-surface / text-app-muted / border-app-line 처럼 쓴다.
        // CSS 변수(raw hex)라 /opacity 수식어는 동작하지 않는다 — soft 토큰을 쓴다.
        app: {
          "bg": "var(--app-bg)",
          "elevated": "var(--app-elevated)",
          "gap": "var(--app-gap)",
          "surface": "var(--app-surface)",
          "placeholder": "var(--app-placeholder)",
          "line": "var(--app-line)",
          "border": "var(--app-border)",
          "text": "var(--app-text)",
          "strong": "var(--app-strong)",
          "sub": "var(--app-sub)",
          "muted": "var(--app-muted)",
          "caption": "var(--app-caption)",
          "inverse": "var(--app-inverse)",
          "inverse-text": "var(--app-inverse-text)",
          "brand": "var(--app-brand)",
          "brand-soft": "var(--app-brand-soft)",
          "danger": "var(--app-danger)",
          "danger-soft": "var(--app-danger-soft)",
          "success": "var(--app-success)",
          "success-soft": "var(--app-success-soft)",
          "success-text": "var(--app-success-text)",
          "info": "var(--app-info)",
          "info-soft": "var(--app-info-soft)",
          "warning": "var(--app-warning)",
          "warning-soft": "var(--app-warning-soft)",
          "warning-text": "var(--app-warning-text)",
          "overlay": "var(--app-overlay)",
        },
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          1: "hsl(var(--chart-1))",
          2: "hsl(var(--chart-2))",
          3: "hsl(var(--chart-3))",
          4: "hsl(var(--chart-4))",
          5: "hsl(var(--chart-5))",
        },
      },
      fontFamily: {
        pretendard: ["Pretendard Variable", ...defaultTheme.fontFamily.sans],
        poppins: ["Poppins", ...defaultTheme.fontFamily.sans],
      },
      boxShadow: {
        card: "var(--app-shadow-card)",
        popover: "var(--app-shadow-popover)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },

  plugins: [
    require("tailwind-scrollbar-hide"),
    require("tailwindcss-animate"),
    require("@tailwindcss/forms"),
  ],
};
