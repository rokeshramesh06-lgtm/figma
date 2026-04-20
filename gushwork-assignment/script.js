const body = document.body;
const floatingHeader = document.querySelector("#floatingHeader");
const navToggle = document.querySelector("#navToggle");
const navMenu = document.querySelector("#navMenu");
const hero = document.querySelector(".hero");
const carouselViewport = document.querySelector("#carouselViewport");
const carouselTrack = document.querySelector("#carouselTrack");
const prevBtn = document.querySelector("#prevBtn");
const nextBtn = document.querySelector("#nextBtn");
const dotsWrap = document.querySelector("#carouselDots");
const zoomPreview = document.querySelector("#zoomPreview");
const zoomImage = document.querySelector("#zoomImage");
const form = document.querySelector(".signup-form");
const formNote = document.querySelector("#formNote");

let dots = [];

function setFloatingHeader() {
  const firstFold = Math.max(window.innerHeight * 0.78, hero.offsetHeight * 0.62);
  const shouldShow = window.scrollY > firstFold;

  body.classList.toggle("has-floating-header", shouldShow);
  floatingHeader.setAttribute("aria-hidden", String(!shouldShow));
}

function closeMenu() {
  body.classList.remove("menu-open");
  navToggle.setAttribute("aria-expanded", "false");
  navToggle.setAttribute("aria-label", "Open navigation menu");
}

function toggleMenu() {
  const isOpen = body.classList.toggle("menu-open");
  navToggle.setAttribute("aria-expanded", String(isOpen));
  navToggle.setAttribute("aria-label", isOpen ? "Close navigation menu" : "Open navigation menu");
}

function getStepSize() {
  const card = carouselTrack.querySelector(".report-card");
  if (!card) return carouselViewport.clientWidth;
  const gap = Number.parseFloat(getComputedStyle(carouselTrack).columnGap) || 0;
  return card.getBoundingClientRect().width + gap;
}

function updateCarousel() {
  const maxScroll = carouselViewport.scrollWidth - carouselViewport.clientWidth;
  const progress = maxScroll <= 0 ? 0 : carouselViewport.scrollLeft / maxScroll;
  const activeIndex = Math.min(dots.length - 1, Math.round(progress * Math.max(dots.length - 1, 0)));

  prevBtn.disabled = carouselViewport.scrollLeft <= 2;
  nextBtn.disabled = carouselViewport.scrollLeft >= maxScroll - 2;

  dots.forEach((dot, index) => {
    dot.setAttribute("aria-current", String(index === activeIndex));
  });
}

function buildDots() {
  const cards = Array.from(carouselTrack.children);
  dotsWrap.innerHTML = "";

  dots = cards.map((_, index) => {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.setAttribute("aria-label", `Go to report ${index + 1}`);
    dot.addEventListener("click", () => {
      carouselViewport.scrollTo({
        left: getStepSize() * index,
        behavior: "smooth",
      });
    });
    dotsWrap.appendChild(dot);
    return dot;
  });

  updateCarousel();
}

function moveCarousel(direction) {
  carouselViewport.scrollBy({
    left: getStepSize() * direction,
    behavior: "smooth",
  });
}

function showZoom(target) {
  const imageUrl = target.dataset.zoom;
  zoomImage.style.backgroundImage = `url("${imageUrl}")`;
  zoomImage.style.backgroundPosition = "50% 50%";
  zoomPreview.classList.add("is-visible");
  zoomPreview.setAttribute("aria-hidden", "false");
}

function moveZoom(event, target) {
  const rect = target.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 100;
  const y = ((event.clientY - rect.top) / rect.height) * 100;
  const clampedX = Math.min(92, Math.max(8, x));
  const clampedY = Math.min(92, Math.max(8, y));

  zoomImage.style.backgroundPosition = `${clampedX}% ${clampedY}%`;
}

function hideZoom() {
  zoomPreview.classList.remove("is-visible");
  zoomPreview.setAttribute("aria-hidden", "true");
}

function bindZoomCards() {
  const zoomTargets = document.querySelectorAll("[data-zoom]");

  zoomTargets.forEach((target) => {
    target.addEventListener("mouseenter", () => showZoom(target));
    target.addEventListener("mousemove", (event) => moveZoom(event, target));
    target.addEventListener("mouseleave", hideZoom);
    target.addEventListener("focus", () => showZoom(target));
    target.addEventListener("blur", hideZoom);
  });
}

window.addEventListener("scroll", setFloatingHeader, { passive: true });
window.addEventListener("resize", () => {
  closeMenu();
  setFloatingHeader();
  buildDots();
});

navToggle.addEventListener("click", toggleMenu);

navMenu.addEventListener("click", (event) => {
  if (event.target.matches("a")) closeMenu();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeMenu();
    hideZoom();
  }
});

prevBtn.addEventListener("click", () => moveCarousel(-1));
nextBtn.addEventListener("click", () => moveCarousel(1));
carouselViewport.addEventListener("scroll", updateCarousel, { passive: true });

form.addEventListener("submit", (event) => {
  event.preventDefault();
  form.reset();
  formNote.textContent = "Thanks. The website review package is ready to send.";
});

bindZoomCards();
buildDots();
setFloatingHeader();
