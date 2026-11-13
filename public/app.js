const form=document.querySelector("#video-form");
const input=document.querySelector("#video-url");
const paste=document.querySelector("#paste-btn");
const submit=document.querySelector("#submit-btn");
const status=document.querySelector("#status");
const result=document.querySelector("#result");
const title=document.querySelector("#video-title");
const thumb=document.querySelector("#video-thumb");
const meta=document.querySelector("#video-meta");
const toggle=document.querySelector("#watermark-toggle");
const help=document.querySelector("#watermark-help");
const link=document.querySelector("#download-link");
let current=null;

function duration(seconds) {
  if (!seconds) return "";
  return Math.floor(seconds/60)+":"+String(Math.floor(seconds%60)).padStart(2,"0");
}

function updateLink() {
  if (!current) return;
  const mode=toggle.checked ? "watermarked" : "clean";
  const available=current.available[mode];
  link.href=available ? "/api/download?url="+encodeURIComponent(current.url)+"&mode="+mode : "#";
  link.classList.toggle("disabled",!available);
  link.setAttribute("aria-disabled",String(!available));
  help.textContent=!available ? "This version isn't available for this video." :
    toggle.checked ? "Includes TikTok's logo and username when provided." :
    "Uses the playback copy. Creator-added overlays may remain.";
}

paste.addEventListener("click",async ()=>{
  try { input.value=await navigator.clipboard.readText(); input.focus(); }
  catch { status.textContent="Paste a TikTok link to get started."; }
});
toggle.addEventListener("change",updateLink);
link.addEventListener("click",event=>{
  if (link.getAttribute("aria-disabled")==="true") event.preventDefault();
});

form.addEventListener("submit",async event=>{
  event.preventDefault();
  current=null;
  result.classList.add("hidden");
  submit.disabled=true;
  submit.textContent="finding your video...";
  status.textContent="looking up that TikTok...";
  try {
    const url=input.value.trim();
    const response=await fetch("/api/info?url="+encodeURIComponent(url));
    const data=await response.json();
    if (!response.ok) throw new Error(data.error || "Couldn't load this TikTok.");
    current={url,available:data.available};
    title.textContent=data.title;
    thumb.src=data.thumbnail;
    thumb.alt="TikTok video cover";
    meta.textContent=[data.uploader,duration(data.duration)].filter(Boolean).join(" · ");
    if (!data.available.clean && !data.available.watermarked) throw new Error("No video copy is available.");
    toggle.checked=!data.available.clean;
    toggle.disabled=!(data.available.clean && data.available.watermarked);
    updateLink();
    status.textContent="";
    result.classList.remove("hidden");
    result.scrollIntoView({behavior:"smooth",block:"nearest"});
  } catch(error) {
    status.textContent=error.message;
  } finally {
    submit.disabled=false;
    submit.innerHTML='find my video <span aria-hidden="true">↗</span>';
  }
});
