const navbar = document.querySelector("#liquid-navbar");

if (navbar && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  navbar.addEventListener("pointermove", event => {
    const rect = navbar.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;

    navbar.style.setProperty("--glass-x", `${x.toFixed(1)}%`);
    navbar.style.setProperty("--glass-y", `${y.toFixed(1)}%`);
  });

  navbar.addEventListener("pointerleave", () => {
    navbar.style.setProperty("--glass-x", "50%");
    navbar.style.setProperty("--glass-y", "50%");
  });
}
