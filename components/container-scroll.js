/**
 * Container Scroll Animation Component
 * Creates a parallax scroll effect with image scaling and rotation
 * Uses Framer Motion for smooth animations
 */

class ContainerScroll {
  constructor(options = {}) {
    this.container = options.container;
    this.isMobile = window.innerWidth <= 768;
    this.scrollProgress = 0;
    this.setupObserver();
    this.setupResizeListener();
    this.render();
  }

  setupObserver() {
    if (!this.container) return;

    const observerOptions = {
      threshold: [0, 0.25, 0.5, 0.75, 1],
    };

    this.observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const containerTop = this.container.getBoundingClientRect().top;
          const windowHeight = window.innerHeight;
          const containerHeight = this.container.offsetHeight;

          // Calculate scroll progress (0 to 1)
          this.scrollProgress = Math.max(
            0,
            Math.min(1, (windowHeight - containerTop) / (windowHeight + containerHeight))
          );

          this.updateAnimations();
        }
      });
    }, observerOptions);

    this.observer.observe(this.container);
  }

  setupResizeListener() {
    window.addEventListener('resize', () => {
      const wasMobile = this.isMobile;
      this.isMobile = window.innerWidth <= 768;
      if (wasMobile !== this.isMobile) {
        this.render();
      }
    });
  }

  getScaleDimensions() {
    return this.isMobile ? [0.7, 0.9] : [1.05, 1];
  }

  getTransformValues() {
    const [minScale, maxScale] = this.getScaleDimensions();
    const scale = minScale + (maxScale - minScale) * (1 - this.scrollProgress);
    const rotate = 20 * (1 - this.scrollProgress);
    const translateY = -100 * this.scrollProgress;

    return { scale, rotate, translateY };
  }

  updateAnimations() {
    const { scale, rotate, translateY } = this.getTransformValues();
    const card = this.container?.querySelector('.scroll-card');
    const header = this.container?.querySelector('.scroll-header');

    if (header) {
      header.style.transform = `translateY(${translateY}px)`;
    }

    if (card) {
      card.style.transform = `rotateX(${rotate}deg) scale(${scale})`;
      card.style.opacity = 0.5 + this.scrollProgress * 0.5; // Fade in as we scroll
    }
  }

  render() {
    if (!this.container) return;
    this.updateAnimations();
  }

  destroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
  }
}

// Initialize scroll animations for all containers with data-scroll-animation
function initializeScrollAnimations() {
  document.querySelectorAll('[data-scroll-animation]').forEach((container) => {
    new ContainerScroll({ container });
  });
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeScrollAnimations);
} else {
  initializeScrollAnimations();
}
