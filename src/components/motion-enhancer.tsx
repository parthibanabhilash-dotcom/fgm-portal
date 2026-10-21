'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

const revealSelector = [
  '.auth-page', '.page-heading', '.hero', '.stats', '.dashboard-grid > section', '.dashboard-aside > section',
  '.courses-grid > .course-card', '.panel', '.learning-grid', '.question', '.details', '.empty', '.table-wrap'
].join(', ');

export function MotionEnhancer() {
  const pathname = usePathname();

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (media.matches) return;
    document.documentElement.classList.add('motion-ready');

    const main = document.querySelector<HTMLElement>('.main-content');
    if (main) {
      main.classList.remove('route-enter');
      void main.offsetWidth;
      main.classList.add('route-enter');
    }

    const elements = Array.from(document.querySelectorAll<HTMLElement>(revealSelector));
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-revealed');
        observer.unobserve(entry.target);
      }
    }, { threshold: 0.08, rootMargin: '0px 0px -36px' });

    elements.forEach((element, index) => {
      element.classList.remove('is-revealed');
      element.dataset.reveal = 'true';
      element.style.setProperty('--reveal-delay', `${Math.min((index % 6) * 55, 220)}ms`);
      observer.observe(element);
    });

    const parallax = Array.from(document.querySelectorAll<HTMLElement>('.hero'));
    let frame = 0;
    const updateParallax = () => {
      frame = 0;
      for (const item of parallax) {
        const rect = item.getBoundingClientRect();
        const offset = Math.max(-14, Math.min(14, (window.innerHeight * 0.5 - (rect.top + rect.height * 0.5)) * 0.035));
        item.style.setProperty('--parallax-y', `${offset.toFixed(1)}px`);
      }
    };
    const onScroll = () => { if (!frame) frame = window.requestAnimationFrame(updateParallax); };
    updateParallax();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [pathname]);

  return null;
}
