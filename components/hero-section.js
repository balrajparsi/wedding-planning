/**
 * Hero Section with Advanced Parallax Scrolling
 * Beautiful wedding mandap with luxury aesthetic
 * Udaipur Fort-inspired design with smooth animations
 */

function createHeroSection() {
  const heroHTML = `
    <section class="hero-section" data-scroll-animation>
      <div class="hero-wrapper-main">
        <!-- Hero Background with Mandap Image -->
        <div class="hero-background-main">
          <!-- Parallax Background Layer -->
          <div class="parallax-layer-1" style="background-image: linear-gradient(135deg, rgba(26, 58, 82, 0.3) 0%, rgba(184, 134, 11, 0.2) 100%), url('https://images.unsplash.com/photo-1519671482677-504be0271101?w=1920&h=1080&fit=crop'); background-position: center; background-attachment: fixed; background-size: cover;">
          </div>

          <!-- Content Overlay -->
          <div class="hero-content-main">
            <!-- Title Section -->
            <div class="hero-title-section fade-in-animation">
              <h1 class="hero-main-title">Akhila & Akshay</h1>
              <p class="hero-subtitle">A Luxury Wedding Planning Experience</p>
              <div class="decorative-dots">
                <span class="dot"></span>
                <span class="dot"></span>
                <span class="dot"></span>
              </div>
            </div>

            <!-- Main Hero Card with Mandap -->
            <div class="hero-card-main slide-up-animation">
              <div class="hero-card-inner">
                <!-- Mandap Image Background -->
                <div class="mandap-bg-layer" style="background-image: linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(26, 58, 82, 0.4) 100%), url('https://images.unsplash.com/photo-1519671482677-504be0271101?w=1600&h=900&fit=crop'); background-position: center; background-size: cover;">
                </div>

                <!-- Golden Mandap Arch Decoration -->
                <div class="mandap-decoration">
                  <!-- Arch Frame -->
                  <div class="arch-frame"></div>

                  <!-- Hanging Gold Strings -->
                  <div class="gold-strings">
                    <div class="string" style="--delay: 0s;"></div>
                    <div class="string" style="--delay: 0.1s;"></div>
                    <div class="string" style="--delay: 0.2s;"></div>
                    <div class="string" style="--delay: 0.3s;"></div>
                    <div class="string" style="--delay: 0.4s;"></div>
                    <div class="string" style="--delay: 0.5s;"></div>
                    <div class="string" style="--delay: 0.6s;"></div>
                  </div>

                  <!-- Hanging Flowers -->
                  <div class="hanging-flowers">
                    <div class="flower-bunch" style="--offset: 0px;">🌹</div>
                    <div class="flower-bunch" style="--offset: 80px;">🌹</div>
                    <div class="flower-bunch" style="--offset: 160px;">🌹</div>
                    <div class="flower-bunch" style="--offset: 240px;">🌹</div>
                    <div class="flower-bunch" style="--offset: 320px;">🌹</div>
                    <div class="flower-bunch" style="--offset: 400px;">🌹</div>
                  </div>
                </div>

                <!-- Text Overlay -->
                <div class="hero-text-overlay">
                  <h2 class="hero-card-title">Plan with Elegance</h2>
                  <p class="hero-card-subtitle">Manage every moment of your special day with royal sophistication</p>
                  <div class="hero-cta-button">Start Planning</div>
                </div>

                <!-- Scroll Indicator -->
                <div class="scroll-indicator-hero">
                  <div class="chevron"></div>
                  <div class="chevron"></div>
                  <div class="chevron"></div>
                </div>
              </div>
            </div>

            <!-- Feature Highlights -->
            <div class="feature-highlights fade-in-delayed">
              <div class="feature-card-hero">
                <div class="feature-icon">👥</div>
                <div class="feature-label">Guest Management</div>
              </div>
              <div class="feature-card-hero">
                <div class="feature-icon">💰</div>
                <div class="feature-label">Budget Tracking</div>
              </div>
              <div class="feature-card-hero">
                <div class="feature-icon">📍</div>
                <div class="feature-label">Venue Planning</div>
              </div>
              <div class="feature-card-hero">
                <div class="feature-icon">🍽️</div>
                <div class="feature-label">Menu Design</div>
              </div>
              <div class="feature-card-hero">
                <div class="feature-icon">✓</div>
                <div class="feature-label">Task Management</div>
              </div>
              <div class="feature-card-hero">
                <div class="feature-icon">📅</div>
                <div class="feature-label">Timeline View</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  `;

  return heroHTML;
}

// Inject hero section into dashboard
function injectHeroSection() {
  const dashboardView = document.querySelector('[data-view="dashboard"]');

  if (dashboardView) {
    const heroWrapper = document.createElement('div');
    heroWrapper.className = 'hero-wrapper';
    heroWrapper.innerHTML = createHeroSection();

    dashboardView.insertBefore(heroWrapper, dashboardView.firstChild);

    // Initialize scroll animation
    const heroSection = heroWrapper.querySelector('[data-scroll-animation]');
    if (heroSection) {
      new ContainerScroll({ container: heroSection });
    }
  }
}

// Auto-inject when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectHeroSection);
} else {
  injectHeroSection();
}
