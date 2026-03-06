export const COLORS = [
  "#fdd835", // yellow
  "#fb8c00", // orange
  "#e53935", // red
  "#1e88e5", // blue
  "#fbc02d", // amber
  "#43a047", // green
  "#8e24aa", // purple
  "#26a69a", // teal
  "#f57c00", // deep orange
  "#5e35b1"  // indigo
];

export const COLOR = {
  yellow: COLORS[0],
  orange: COLORS[1],
  red: COLORS[2],
  blue: COLORS[3],
  amber: COLORS[4],
  green: COLORS[5],
  purple: COLORS[6],
  teal: COLORS[7],
  deepOrange: COLORS[8],
  indigo: COLORS[9]
};

// Each entry has two weights:
//   weight     — normal mode  (complex pieces favoured)
//   easyWeight — easy mode    (small/simple pieces favoured)
export const PIECE_SET = [
  // Singles & lines
  { name:”single”, cells:[[0,0]], color:COLOR.yellow, weight: 0.8, easyWeight: 5 },

  { name:”1x2”, cells:[[0,0],[0,1]], color:COLOR.orange, weight: 1.2, easyWeight: 5 },
  { name:”2x1”, cells:[[0,0],[1,0]], color:COLOR.orange, weight: 1.2, easyWeight: 5 },

  { name:”1x3”, cells:[[0,0],[0,1],[0,2]], color:COLOR.red, weight: 1.5, easyWeight: 4 },
  { name:”3x1”, cells:[[0,0],[1,0],[2,0]], color:COLOR.red, weight: 1.5, easyWeight: 4 },

  { name:”1x4”, cells:[[0,0],[0,1],[0,2],[0,3]], color:COLOR.blue, weight: 2.5, easyWeight: 0.8 },
  { name:”4x1”, cells:[[0,0],[1,0],[2,0],[3,0]], color:COLOR.blue, weight: 2.5, easyWeight: 0.8 },

  // Square
  { name:”2x2”, cells:[[0,0],[0,1],[1,0],[1,1]], color:COLOR.amber, weight: 1.5, easyWeight: 4 },

  // T shapes (4 rotations)
  { name:”T-up”,    cells:[[0,0],[0,1],[0,2],[1,1]], color:COLOR.purple, weight: 2.5, easyWeight: 1.5 },
  { name:”T-right”, cells:[[0,0],[1,0],[2,0],[1,1]], color:COLOR.purple, weight: 2.5, easyWeight: 1.5 },
  { name:”T-down”,  cells:[[1,0],[1,1],[1,2],[0,1]], color:COLOR.purple, weight: 2.5, easyWeight: 1.5 },
  { name:”T-left”,  cells:[[0,1],[1,1],[2,1],[1,0]], color:COLOR.purple, weight: 2.5, easyWeight: 1.5 },

  // L / J variants
  { name:”L”,     cells:[[0,0],[1,0],[2,0],[2,1]], color:COLOR.blue,  weight: 2.5, easyWeight: 1.2 },
  { name:”J”,     cells:[[0,1],[1,1],[2,1],[2,0]], color:COLOR.green, weight: 2.5, easyWeight: 1.2 },
  { name:”L-top”, cells:[[0,0],[0,1],[1,0],[2,0]], color:COLOR.blue,  weight: 2.0, easyWeight: 1.2 },
  { name:”J-top”, cells:[[0,0],[0,1],[1,1],[2,1]], color:COLOR.green, weight: 2.0, easyWeight: 1.2 },

  // S / Z
  { name:”Z”, cells:[[0,0],[0,1],[1,1],[1,2]], color:COLOR.red,  weight: 2.5, easyWeight: 0.6 },
  { name:”S”, cells:[[1,0],[0,1],[1,1],[0,2]], color:COLOR.teal, weight: 2.5, easyWeight: 0.6 },

  // Rectangles (2×3 / 3×2)
  { name:”2x3”, cells:[[0,0],[0,1],[0,2],[1,0],[1,1],[1,2]], color:COLOR.deepOrange, weight: 2.5, easyWeight: 0.4 },
  { name:”3x2”, cells:[[0,0],[1,0],[2,0],[0,1],[1,1],[2,1]], color:COLOR.deepOrange, weight: 2.5, easyWeight: 0.4 },

  // Rare: 3-step “stairs”
  { name:”stairs-3”, cells:[[0,0],[1,0],[1,1],[2,1],[2,2]], color:COLOR.indigo, weight: 1.5, easyWeight: 0.1 }
];

export function weightedPick(items, weightKey = 'weight') {
  const total = items.reduce((sum, item) => sum + (item[weightKey] || 1), 0);
  let r = Math.random() * total;
  for (const item of items) {
    r -= (item[weightKey] || 1);
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}

