/**
 * Hero Section with Scroll Animation
 * Displays the wedding mandap with parallax scrolling effect
 * Uses reference images from Udaipur/Rajasthan wedding aesthetic
 */

function createHeroSection() {
  const heroHTML = `
    <section class="hero-section" data-scroll-animation>
      <div class="hero-container h-screen md:h-[120vh] flex items-center justify-center relative overflow-hidden">
        <!-- Animated Background -->
        <div class="hero-background absolute inset-0 z-0">
          <div class="absolute inset-0 bg-gradient-to-b from-[#f5f1e8] via-[#f5f1e8] to-[#daa520]/10"></div>
          <div class="fort-parallax absolute right-0 bottom-0 w-full h-96 opacity-15 z-0"
               style="background: url('data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 1000 400%22><path fill=%22%231a3a52%22 d=%22M0,300 Q250,250 500,280 T1000,300 L1000,400 L0,400 Z%22/></svg>') repeat-x bottom; background-size: 500px 100%;"></div>
        </div>

        <!-- Content Container -->
        <div class="hero-content relative z-10 max-w-6xl mx-auto px-4 md:px-8 text-center" style="perspective: 1000px;">

          <!-- Scroll Header (animates up) -->
          <div class="scroll-header mb-12 md:mb-20 transition-transform duration-500 ease-out">
            <h1 class="text-5xl md:text-7xl font-bold text-[#1a3a52] mb-4 leading-tight">
              Akhila & Akshay
            </h1>
            <p class="text-lg md:text-2xl text-[#a0644e] font-semibold tracking-wide">
              Wedding Planning Dashboard
            </p>
            <div class="mt-6 flex justify-center gap-2">
              <div class="w-2 h-2 rounded-full bg-[#b8860b]"></div>
              <div class="w-2 h-2 rounded-full bg-[#daa520] opacity-60"></div>
              <div class="w-2 h-2 rounded-full bg-[#b8860b] opacity-30"></div>
            </div>
          </div>

          <!-- Main Card (animates with scale & rotate) -->
          <div class="scroll-card relative transition-transform duration-500 ease-out"
               style="perspective: 1200px; transform-style: preserve-3d;">

            <!-- Card Container -->
            <div class="relative max-w-5xl mx-auto h-[28rem] md:h-[36rem] bg-white rounded-3xl overflow-hidden shadow-2xl border-4 border-[#b8860b]/20 transform transition-all duration-500"
                 style="box-shadow: 0 0 0 0 rgba(0,0,0,0), 0 9px 20px rgba(0,0,0,0.29), 0 37px 37px rgba(0,0,0,0.26), 0 84px 50px rgba(0,0,0,0.15), 0 149px 60px rgba(0,0,0,0.06), 0 233px 65px rgba(0,0,0,0.02);">

              <!-- Parallax Background Image -->
              <div class="absolute inset-0 bg-cover bg-center parallax-bg"
                   style="background-image: linear-gradient(135deg, rgba(26, 58, 82, 0.7) 0%, rgba(184, 134, 11, 0.6) 100%), url('https://images.unsplash.com/photo-1519671482677-504be0271101?w=1600&h=900&fit=crop');
                          background-attachment: fixed;
                          transform-origin: center;">
              </div>

              <!-- Gold Mandap Overlay (Animated Decorative) -->
              <div class="absolute inset-0 flex items-start justify-center pt-8 z-10 opacity-80">
                <div class="relative w-full max-w-2xl h-64">
                  <!-- Top Arch -->
                  <div class="absolute top-0 left-1/2 transform -translate-x-1/2 w-full h-48 border-t-4 border-l-4 border-r-4 border-[#daa520] rounded-t-3xl"
                       style="border-top-left-radius: 100px; border-top-right-radius: 100px;">
                  </div>

                  <!-- Gold String Drapes (Animated) -->
                  <div class="absolute top-12 left-0 right-0 flex justify-around px-8">
                    <div class="w-1 h-48 bg-gradient-to-b from-[#daa520] to-[#b8860b] transform animate-pulse opacity-70"></div>
                    <div class="w-1 h-52 bg-gradient-to-b from-[#daa520] to-[#b8860b] transform animate-pulse opacity-60"></div>
                    <div class="w-1 h-48 bg-gradient-to-b from-[#daa520] to-[#b8860b] transform animate-pulse opacity-70"></div>
                    <div class="w-1 h-50 bg-gradient-to-b from-[#daa520] to-[#b8860b] transform animate-pulse opacity-60"></div>
                  </div>

                  <!-- Red Flower Accents -->
                  <div class="absolute top-20 left-1/4 w-4 h-4 bg-red-600 rounded-full blur-sm"></div>
                  <div class="absolute top-24 right-1/4 w-3 h-3 bg-red-700 rounded-full blur-sm"></div>
                  <div class="absolute top-16 left-1/3 w-3 h-3 bg-red-600 rounded-full blur-sm"></div>
                </div>
              </div>

              <!-- Content Overlay -->
              <div class="absolute inset-0 flex flex-col items-center justify-center z-20 bg-gradient-to-t from-black/40 to-transparent">
                <h2 class="text-3xl md:text-5xl font-bold text-white text-center mb-4">
                  Plan with Elegance
                </h2>
                <p class="text-white/90 text-sm md:text-lg max-w-sm text-center">
                  Manage guests, venues, budget & timelines with royal sophistication
                </p>
              </div>

              <!-- Scroll Indicator -->
              <div class="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-30 animate-bounce">
                <svg class="w-6 h-6 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
                </svg>
              </div>
            </div>
          </div>

          <!-- Feature Pills (Fade in on scroll) -->
          <div class="mt-16 md:mt-24 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto opacity-0 transition-opacity duration-700"
               style="opacity: calc(var(--scroll-progress, 0) * 1);">
            <div class="feature-pill p-4 rounded-xl bg-white/80 backdrop-blur border border-[#b8860b]/20 hover:border-[#b8860b]/60 transition-all">
              <div class="text-2xl mb-2">👥</div>
              <p class="text-xs md:text-sm font-semibold text-[#1a3a52]">Guest List</p>
            </div>
            <div class="feature-pill p-4 rounded-xl bg-white/80 backdrop-blur border border-[#b8860b]/20 hover:border-[#b8860b]/60 transition-all">
              <div class="text-2xl mb-2">💰</div>
              <p class="text-xs md:text-sm font-semibold text-[#1a3a52]">Budget</p>
            </div>
            <div class="feature-pill p-4 rounded-xl bg-white/80 backdrop-blur border border-[#b8860b]/20 hover:border-[#b8860b]/60 transition-all">
              <div class="text-2xl mb-2">📍</div>
              <p class="text-xs md:text-sm font-semibold text-[#1a3a52]">Venues</p>
            </div>
            <div class="feature-pill p-4 rounded-xl bg-white/80 backdrop-blur border border-[#b8860b]/20 hover:border-[#b8860b]/60 transition-all">
              <div class="text-2xl mb-2">📅</div>
              <p class="text-xs md:text-sm font-semibold text-[#1a3a52]">Timeline</p>
            </div>
          </div>
        </div>

        <!-- Decorative Elements -->
        <div class="absolute top-10 left-10 w-32 h-32 bg-[#daa520] rounded-full opacity-5 blur-3xl"></div>
        <div class="absolute bottom-20 right-10 w-40 h-40 bg-[#a0644e] rounded-full opacity-5 blur-3xl"></div>
      </div>
    </section>
  `;

  return heroHTML;
}

// Inject hero section into dashboard
function injectHeroSection() {
  const mainContent = document.querySelector('.main-content');
  const dashboardView = document.querySelector('[data-view="dashboard"]');

  if (dashboardView) {
    // Create wrapper for hero section
    const heroWrapper = document.createElement('div');
    heroWrapper.className = 'hero-wrapper';
    heroWrapper.innerHTML = createHeroSection();

    // Insert before existing dashboard content
    dashboardView.insertBefore(heroWrapper, dashboardView.firstChild);

    // Initialize scroll animation for hero
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
