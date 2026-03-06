const STORAGE_KEY = "blockblastProfile";

export function loadProfile(){
  if(typeof localStorage === "undefined"){
    return { name:"", highScore:0, highScoreTetris:0 };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return { name:"", highScore:0, highScoreTetris:0 };
    const data = JSON.parse(raw);
    if(!data || typeof data !== "object") return { name:"", highScore:0, highScoreTetris:0 };
    const name = typeof data.name === "string" ? data.name.trim() : "";
    const highScoreNum = Number(data.highScore);
    const highScore = Number.isFinite(highScoreNum) ? Math.max(0, Math.floor(highScoreNum)) : 0;
    const highScoreTetrisNum = Number(data.highScoreTetris);
    const highScoreTetris = Number.isFinite(highScoreTetrisNum) ? Math.max(0, Math.floor(highScoreTetrisNum)) : 0;
    return { name, highScore, highScoreTetris };
  } catch(err) {
    return { name:"", highScore:0, highScoreTetris:0 };
  }
}

export function saveProfile(profile){
  if(typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      name: profile.name,
      highScore: profile.highScore,
      highScoreTetris: profile.highScoreTetris
    }));
  } catch(err) {
    /* ignore persistence errors */
  }
}

export function maybeUpdateHighScore(profile, score, tetrisMode){
  const key = tetrisMode ? "highScoreTetris" : "highScore";
  const previousBest = profile[key] || 0;
  if(score > previousBest){
    profile[key] = score;
    saveProfile(profile);
    return true;
  }
  return false;
}

