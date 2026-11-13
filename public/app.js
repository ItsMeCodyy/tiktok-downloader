const form = document.querySelector("#video-form");
const input = document.querySelector("#video-url");
const paste = document.querySelector("#paste-btn");
const submit = document.querySelector("#submit-btn");
const status = document.querySelector("#status");
const result = document.querySelector("#result");
const title = document.querySelector("#video-title");
const thumb = document.querySelector("#video-thumb");
const meta = document.querySelector("#video-meta");
const watermark = document.querySelector("#watermark-toggle");
const watermarkRow = document.querySelector(".watermark-row");
const watermarkHelp = document.querySelector("#watermark-help");
const quality = document.querySelector("#download-quality");
const mp4Button = document.querySelector("#format-mp4");
const mp3Button = document.querySelector("#format-mp3");
const link = document.querySelector("#download-link");

const AUDIO_QUALITIES = [
  { id: "128", label: "128 kbps" },
  { id: "192", label: "192 kbps" },
  { id: "256", label: "256 kbps" }
];

let current = null;
let selectedFormat = "mp4";

function duration(seconds) {
  if (!seconds) return "";
  return Math.floor(seconds / 60) + ":" +
    String(Math.floor(seconds % 60)).padStart(2, "0");
}

function updateControls() {
  if (!current) return;

  const isMp3 = selectedFormat === "mp3";
  const mode = watermark.checked ? "watermarked" : "clean";
  const choices = isMp3
    ? AUDIO_QUALITIES
    : (current.qualities[mode] || []);

  mp4Button.classList.toggle("active", !isMp3);
  mp3Button.classList.toggle("active", isMp3);
  mp4Button.setAttribute("aria-pressed", String(!isMp3));
  mp3Button.setAttribute("aria-pressed", String(isMp3));

  watermarkRow.hidden = isMp3;
  watermarkHelp.hidden = isMp3;

  const previouslySelected = quality.value;
  quality.replaceChildren();

  for (const choice of choices) {
    const option = document.createElement("option");
    option.value = choice.id;
    option.textContent = choice.label;
    quality.append(option);
  }

  if (choices.some(choice => choice.id === previouslySelected)) {
    quality.value = previouslySelected;
  } else if (isMp3) {
    quality.value = "192";
  }

  quality.disabled = choices.length < 2;
  const available = choices.length > 0 &&
    (isMp3 || current.available[mode]);

  const params = new URLSearchParams({
    url: current.url,
    format: selectedFormat,
    mode: isMp3 ? "clean" : mode,
    quality: quality.value
  });

  link.href = available ? "/api/download?" + params.toString() : "#";
  link.classList.toggle("disabled", !available);
  link.setAttribute("aria-disabled", String(!available));
  watermarkHelp.textContent = available ? "" : "Unavailable for this video.";
}

paste.addEventListener("click", async () => {
  try {
    input.value = await navigator.clipboard.readText();
    input.focus();
  } catch {
    status.textContent = "Paste a TikTok link to get started.";
  }
});

mp4Button.addEventListener("click", () => {
  selectedFormat = "mp4";
  updateControls();
});

mp3Button.addEventListener("click", () => {
  selectedFormat = "mp3";
  updateControls();
});

watermark.addEventListener("change", updateControls);
quality.addEventListener("change", updateControls);

link.addEventListener("click", event => {
  if (link.getAttribute("aria-disabled") === "true") event.preventDefault();
});

form.addEventListener("submit", async event => {
  event.preventDefault();

  current = null;
  result.classList.add("hidden");
  submit.disabled = true;
  submit.textContent = "finding your video...";
  status.textContent = "looking up that TikTok...";

  try {
    const url = input.value.trim();
    const response = await fetch("/api/info?url=" + encodeURIComponent(url));
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Couldn't load this TikTok.");
    }

    if (!data.available?.clean && !data.available?.watermarked) {
      throw new Error("No downloadable file is available.");
    }

    current = {
      url,
      available: data.available,
      qualities: data.qualities || { clean: [], watermarked: [] }
    };

    title.textContent = data.title;
    thumb.src = data.thumbnail;
    thumb.alt = "TikTok video cover";
    meta.textContent = [data.uploader, duration(data.duration)]
      .filter(Boolean)
      .join(" · ");

    selectedFormat = "mp4";
    watermark.checked = !data.available.clean;
    watermark.disabled = !(data.available.clean && data.available.watermarked);

    updateControls();
    status.textContent = "";
    result.classList.remove("hidden");
    result.scrollIntoView({ behavior: "smooth", block: "nearest" });
  } catch (error) {
    status.textContent = error.message || "Couldn't load that video.";
  } finally {
    submit.disabled = false;
    submit.innerHTML = 'find my video <span aria-hidden="true">↗</span>';
  }
});
