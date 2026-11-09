import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Automatically scrolls the window to the top (0,0) whenever the route changes.
 * Place this component inside <BrowserRouter> in App.tsx.
 */
export default function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) return; // let hash navigation handle scrolling
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname, hash]);

  return null;
}
