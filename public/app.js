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
  const s = Math.floor(seconds);
  const minutes = Math.floor(s / 60);
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours}:${String(minutes % 60).padStart(2, "0")}:${String(s % 60).padStart(2,"0")}` : `${minutes}:${String(s % 60).padStart(2,"0")}`;
}

function bytes(value) {
  if (!value) return "";
  return ` · ${(value / 1048576).toFixed(1)} MB`;
}

function updateLink(id) {
  const option = quality.selectedOptions[0];
  if (!option) return;
  link.href = `/api/open?id=${encodeURIComponent(id)}&format=${encodeURIComponent(option.value)}`;
}

paste.addEventListener("click", async () => {
  try {
    input.value = await navigator.clipboard.readText();
    input.focus();
  } catch {
    status.textContent = "Paste a link into the box to get started.";
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  result.classList.add("hidden");
  submit.disabled = true;
  submit.innerHTML = 'looking for it <span class="spinner" aria-hidden="true"></span>';
  status.textContent = "fetching your video...";
  try {
    const response = await fetch(`/api/info?url=${encodeURIComponent(input.value.trim())}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Something went wrong.");
    title.textContent = data.title;
    thumb.src = data.thumbnail;
    meta.textContent = [data.uploader, duration(data.duration)].filter(Boolean).join(" · ");
    quality.replaceChildren();
    for (const format of data.formats) {
      const option = document.createElement("option");
      option.value = format.id;
      option.textContent = `${format.label} · MP4${bytes(format.size)}`;
      quality.append(option);
    }
    if (!data.formats.length) {
      link.classList.add("disabled");
      link.removeAttribute("href");
      status.textContent = "No combined MP4 formats are available for this video.";
    } else {
      link.classList.remove("disabled");
      updateLink(data.id);
      quality.onchange = () => updateLink(data.id);
      status.textContent = "";
    }
    result.classList.remove("hidden");
    result.scrollIntoView({behavior:"smooth", block:"nearest"});
  } catch (error) {
    status.textContent = error.message || "Couldn't fetch this video.";
  } finally {
    submit.disabled = false;
    submit.innerHTML = 'find my video <span aria-hidden="true">↗</span>';
  }
});
