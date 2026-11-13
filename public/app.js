const form = document.querySelector("#video-form");
const input = document.querySelector("#video-url");
const paste = document.querySelector("#paste-btn");
const submit = document.querySelector("#submit-btn");
const status = document.querySelector("#status");
const result = document.querySelector("#result");
const title = document.querySelector("#video-title");
const thumb = document.querySelector("#video-thumb");
const meta = document.querySelector("#video-meta");
const quality = document.querySelector("#quality");
const link = document.querySelector("#download-link");

function duration(seconds) {
  if (!seconds) return "";
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

paste.addEventListener("click", async () => {
  try {
    input.value = await navigator.clipboard.readText();
    input.focus();
  } catch {
    status.textContent = "Paste a link into the box to get started.";
  }
});

form.addEventListener("submit", async event => {
  event.preventDefault();
  result.classList.add("hidden");
  submit.disabled = true;
  submit.textContent = "finding your video...";
  status.textContent = "reading the public TikTok page...";
  try {
    const response = await fetch(`/api/info?url=${encodeURIComponent(input.value.trim())}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Couldn't read this TikTok.");
    title.textContent = data.title;
    thumb.src = data.thumbnail;
    thumb.alt = "TikTok video cover";
    meta.textContent = [data.uploader, duration(data.duration)].filter(Boolean).join(" · ");
    quality.replaceChildren();
    const option = document.createElement("option");
    option.textContent = "Original video";
    quality.append(option);
    quality.disabled = true;
    link.href = data.media;
    link.classList.remove("disabled");
    status.textContent = "";
    result.classList.remove("hidden");
    result.scrollIntoView({behavior:"smooth",block:"nearest"});
  } catch (error) {
    status.textContent = error.message;
  } finally {
    submit.disabled = false;
    submit.innerHTML = 'find my video <span aria-hidden="true">↗</span>';
  }
});
