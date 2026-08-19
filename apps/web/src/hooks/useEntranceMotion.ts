import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import type { RefObject } from "react";

gsap.registerPlugin(useGSAP);

export function useEntranceMotion(scope: RefObject<HTMLElement | null>) {
  useGSAP(
    () => {
      const root = scope.current;
      if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      const sections = root.querySelectorAll<HTMLElement>("[data-motion-section]");
      const items = root.querySelectorAll<HTMLElement>("[data-motion-item]");

      gsap.from(sections, {
        autoAlpha: 0,
        y: 12,
        duration: 0.48,
        stagger: 0.065,
        ease: "power2.out",
        clearProps: "opacity,visibility,transform"
      });

      if (items.length > 0) {
        gsap.from(items, {
          autoAlpha: 0,
          y: 7,
          duration: 0.38,
          stagger: 0.035,
          delay: 0.12,
          ease: "power2.out",
          clearProps: "opacity,visibility,transform"
        });
      }
    },
    { scope }
  );
}
