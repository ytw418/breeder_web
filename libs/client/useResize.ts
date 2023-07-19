import debounce from "lodash/debounce";
import { useEffect, useState } from "react";

export default function useResize() {
  const [screenWidth, setScreenWidth] = useState<undefined | number>();
  const updateWidth = () => {
    setScreenWidth(window.innerWidth);
  };
  const handleResize = debounce(updateWidth, 100, { leading: true });
  useEffect(() => {
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [handleResize]);

  return screenWidth;
}
