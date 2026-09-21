import { useEffect, useRef } from "react";

/**
 * Slides start their reveal animations only once the Story container marks them `data-active="true"` (see
 * `Slide.module.css`). A story renders a slide on its own, so this marks every slide inside it as active after mounting,
 * which is what the real Story does for the slide in view. Without it the slide's content would stay invisible.
 */
export default function ActiveSlides({ children }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.querySelectorAll("[data-slide]").forEach((slide) => {
      slide.dataset.active = "true";
    });
  });
  return <div ref={ref}>{children}</div>;
}
