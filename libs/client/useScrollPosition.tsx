// import debounce from "lodash/debounce";
// import { useEffect, useState } from "react";

// export default function useScrollPosition() {
//   const [scrollPosition, setScrollPosition] = useState(0);
//   const updatePosition = () => {
//     setScrollPosition(window.pageYOffset);
//   };
//   const handleScroll = debounce(updatePosition, 100, { leading: true });

//   useEffect(() => {
//     window.addEventListener("scroll", handleScroll);
//     updatePosition();
//     return () => window.removeEventListener("scroll", handleScroll);
//   }, []);

//   return scrollPosition;
// }
