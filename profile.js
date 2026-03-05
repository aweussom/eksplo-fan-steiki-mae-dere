const STORAGE_KEY = "blockblastProfile";

export function loadProfile(){
  if(typeof localStorage === "undefined"){
    return { name:"", highScore:0 };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return { name:"", highScore:0 };
    const data = JSON.parse(raw);
    if(!data || typeof data !== "object") return { name:"", highScore:0 };
    const name = typeof data.name === "string" ? data.name.trim() : "";
    const highScoreNum = Number(data.highScore);
    const highScore = Number.isFinite(highScoreNum) ? Math.max(0, Math.floor(highScoreNum)) : 0;
    return { name, highScore };
  } catch(err) {
    return { name:"", highScore:0 };
  }
}

export function saveProfile(profile){
  if(typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      name: profile.name,
      highScore: profile.highScore
    }));
  } catch(err) {
    /* ignore persistence errors */
  }
}

export function maybeUpdateHighScore(profile, score){
  const previousBest = profile.highScore || 0;
  if(score > previousBest){
    profile.highScore = score;
    saveProfile(profile);
    return true;
  }
  return false;
}

