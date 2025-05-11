const ambience = new Audio('https://cdn.chatlink.space/audios/ambience.mp3');
ambience.loop = true;
ambience.volume = 0.25;

ambience.play().catch(() => {
  console.warn('blocked ap. waiting for interaction...');
});

document.addEventListener('click', () => {
  if (ambience.paused) {
    ambience.play().catch(() => {});
  }
}, { once: true });

function isMediaPlaying(media) {
  return !media.paused && !media.ended && media.readyState > 2;
}

function handlePlayEvent(e) {
  if (e.target !== ambience && !ambience.paused) {
    ambience.pause();
  }
}

function handlePauseEvent() {
  const mediaElements = [...document.querySelectorAll('audio, video')].filter(el => el !== ambience);
  const othersPlaying = mediaElements.some(isMediaPlaying);

  if (!othersPlaying && ambience.paused) {
    ambience.volume = 0;
    ambience.play().then(() => fadeInAmbience());
  }
}

function fadeInAmbience() {
  let volume = 0;
  const targetVolume = 0.25;
  const step = 0.01;
  const interval = 30;

  const fade = setInterval(() => {
    if (volume < targetVolume) {
      volume = Math.min(volume + step, targetVolume);
      ambience.volume = volume;
    } else {
      clearInterval(fade);
    }
  }, interval);
}

function attachMediaListeners() {
  const mediaElements = [...document.querySelectorAll('audio, video')].filter(el => el !== ambience);
  for (const media of mediaElements) {
    media.removeEventListener('play', handlePlayEvent);
    media.removeEventListener('pause', handlePauseEvent);
    media.removeEventListener('ended', handlePauseEvent);

    media.addEventListener('play', handlePlayEvent);
    media.addEventListener('pause', handlePauseEvent);
    media.addEventListener('ended', handlePauseEvent);
  }
}

attachMediaListeners();

const observer = new MutationObserver(attachMediaListeners);
observer.observe(document.body, { childList: true, subtree: true });

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (!ambience.paused) {
      ambience.pause();
    }
  } else {
    if (ambience.paused) {
      ambience.volume = 0;
      ambience.play().then(() => fadeInAmbience());
    }
  }
});
