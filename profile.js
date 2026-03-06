const STORAGE_KEY = "blockblastProfile";

export function loadProfile(){
  const blank = { name:"", highScore:0, highScoreTetris:0, highScoreEasy:0 };
  if(typeof localStorage === "undefined") return blank;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return { ...blank };
    const data = JSON.parse(raw);
    if(!data || typeof data !== "object") return { ...blank };
    const name = typeof data.name === "string" ? data.name.trim() : "";
    const parseScore = v => { const n = Number(v); return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0; };
    return {
      name,
      highScore:      parseScore(data.highScore),
      highScoreTetris: parseScore(data.highScoreTetris),
      highScoreEasy:  parseScore(data.highScoreEasy)
    };
  } catch(err) {
    return { ...blank };
  }
}

export function saveProfile(profile){
  if(typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      name:            profile.name,
      highScore:       profile.highScore,
      highScoreTetris: profile.highScoreTetris,
      highScoreEasy:   profile.highScoreEasy
    }));
  } catch(err) {
    /* ignore persistence errors */
  }
}

// mode: 'normal' | 'tetris' | 'easy'
export function maybeUpdateHighScore(profile, score, mode){
  const key = mode === 'easy' ? 'highScoreEasy' : mode === 'tetris' ? 'highScoreTetris' : 'highScore';
  const previousBest = profile[key] || 0;
  if(score > previousBest){
    profile[key] = score;
    saveProfile(profile);
    return true;
  }
  return false;
}

