// api/simulated-player-art.ts
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
var SOLO_TEAM_THEMES = [
  { name: "Albuquerque Scorpions", abbr: "ABQ", primary: "#8B2F3C", secondary: "#E4B363" },
  { name: "Anchorage Aurora", abbr: "ANC", primary: "#185C66", secondary: "#8DE1D2" },
  { name: "Austin Outlaws", abbr: "AUS", primary: "#7A2E18", secondary: "#E6A15A" },
  { name: "Birmingham Forge", abbr: "BIR", primary: "#5B1F2A", secondary: "#C9A55C" },
  { name: "Boise Mountaineers", abbr: "BOI", primary: "#16425B", secondary: "#A3C4BC" },
  { name: "Brooklyn Guardians", abbr: "BRK", primary: "#252A5A", secondary: "#D0B66A" },
  { name: "Charleston Corsairs", abbr: "CHS", primary: "#123B3A", secondary: "#D09B52" },
  { name: "Columbus Aviators", abbr: "CLB", primary: "#263C6A", secondary: "#C6D4E1" },
  { name: "Des Moines Harvesters", abbr: "DSM", primary: "#5A421B", secondary: "#E2C46D" },
  { name: "Hartford Foundry", abbr: "HFD", primary: "#30343B", secondary: "#D06B3C" },
  { name: "Honolulu Tides", abbr: "HNL", primary: "#006D77", secondary: "#F2CC8F" },
  { name: "Jersey City Knights", abbr: "JCY", primary: "#172554", secondary: "#D4AF37" },
  { name: "Louisville Stallions", abbr: "LOU", primary: "#4A1942", secondary: "#E2B96F" },
  { name: "Memphis Pharaohs", abbr: "MEM", primary: "#382C63", secondary: "#D9B44A" },
  { name: "Milwaukee Lakehawks", abbr: "MIL", primary: "#164E63", secondary: "#B8D8D8" },
  { name: "Oklahoma City Bison", abbr: "OKC", primary: "#6B2D1A", secondary: "#E0A458" },
  { name: "Omaha Stampede", abbr: "OMA", primary: "#7C2D12", secondary: "#F1C27D" },
  { name: "Orlando Orbit", abbr: "ORL", primary: "#4338CA", secondary: "#67E8F9" },
  { name: "Portland Pioneers", abbr: "POR", primary: "#14532D", secondary: "#D8B25C" },
  { name: "Raleigh Redtails", abbr: "RAL", primary: "#7F1D1D", secondary: "#E7B95E" },
  { name: "Richmond Generals", abbr: "RIC", primary: "#1E3A5F", secondary: "#B8A16A" },
  { name: "Reno Highrollers", abbr: "RNO", primary: "#3F3F46", secondary: "#D7B65D" },
  { name: "Sacramento Gold", abbr: "SAC", primary: "#4C1D95", secondary: "#F2C14E" },
  { name: "Salt Lake Summit", abbr: "SLC", primary: "#1E40AF", secondary: "#C7D2FE" },
  { name: "San Antonio Marshals", abbr: "SAT", primary: "#3F1D38", secondary: "#D8A84E" },
  { name: "San Diego Breakers", abbr: "SDG", primary: "#075985", secondary: "#FDE68A" },
  { name: "St. Louis Archers", abbr: "STL", primary: "#4C1D24", secondary: "#D8B46A" },
  { name: "Toronto Northstars", abbr: "TOR", primary: "#1E3A8A", secondary: "#E5E7EB" },
  { name: "Virginia Beach Tritons", abbr: "VBH", primary: "#0F766E", secondary: "#F0C36E" },
  { name: "Albany Empire", abbr: "ALB", primary: "#312E81", secondary: "#D5B55F" },
  { name: "El Paso Dust Devils", abbr: "ELP", primary: "#7C3A17", secondary: "#F3B562" },
  { name: "Fargo Frost", abbr: "FAR", primary: "#155E75", secondary: "#E0F2FE" }
];
var STADIUM_NAMES = [
  "Desert Crown Stadium",
  "Aurora Field",
  "Lone Star Grounds",
  "Ironworks Stadium",
  "Sawtooth Field",
  "Guardian Grounds",
  "Harbor Fortress",
  "Flight Deck Stadium",
  "Heartland Field",
  "Foundry Park",
  "Pacific Tide Stadium",
  "Knightfall Grounds",
  "Bluegrass Coliseum",
  "Pyramid Field",
  "Lakeshore Stadium",
  "Prairie Crown Field",
  "Stampede Grounds",
  "Orbit Park",
  "Pioneer Stadium",
  "Redtail Field",
  "Commonwealth Grounds",
  "Silver Basin Stadium",
  "Capital Gold Park",
  "Summit Field",
  "Marshal Grounds",
  "Breaker Bay Stadium",
  "Gateway Grounds",
  "Northstar Dome",
  "Triton Field",
  "Empire Stadium",
  "Sunset Mesa Park",
  "Frostline Dome"
];
var SOLO_OWNER_TEAMS = SOLO_TEAM_THEMES.map((team, index) => ({
  abbr: team.abbr,
  name: team.name,
  stadium: STADIUM_NAMES[index],
  capacity: 58e3 + index * 1937 % 19e3,
  marketValueB: Number((4.8 + index * 13 % 57 / 10).toFixed(1))
}));
var FIRST_NAMES = [
  "Aiden",
  "Amari",
  "Andre",
  "Ashton",
  "Blake",
  "Bryce",
  "Cameron",
  "Cedric",
  "Damon",
  "Darius",
  "Devin",
  "Eli",
  "Emmett",
  "Evan",
  "Felix",
  "Gavin",
  "Grant",
  "Isaiah",
  "Jabari",
  "Jace",
  "Jalen",
  "Jamal",
  "Jonah",
  "Jordan",
  "Kaden",
  "Kai",
  "Kendrick",
  "Khalil",
  "Landon",
  "Leo",
  "Malik",
  "Marcus",
  "Mason",
  "Micah",
  "Miles",
  "Nico",
  "Noah",
  "Owen",
  "Quentin",
  "Rashad",
  "Roman",
  "Silas",
  "Tariq",
  "Theo",
  "Tristan",
  "Tyrese",
  "Xavier",
  "Zion"
];
var LAST_NAMES = [
  "Aldridge",
  "Bellamy",
  "Callen",
  "Dunley",
  "Easton",
  "Fairmont",
  "Gaines",
  "Hollowell",
  "Irons",
  "Kessler",
  "Langford",
  "Mercer",
  "Norwood",
  "Oakley",
  "Pryor",
  "Quade",
  "Redvale",
  "Sterling",
  "Tolliver",
  "Underhill",
  "Voss",
  "Westfall",
  "Yardley",
  "Zeller",
  "Ashford",
  "Bexley",
  "Corwin",
  "Danner",
  "Ellery",
  "Farrow",
  "Grady",
  "Hartwell",
  "Ingram",
  "Keller",
  "Lockwood",
  "Marlowe",
  "Nash",
  "Orson",
  "Parker",
  "Quinlan",
  "Rowan",
  "Sayer",
  "Thorne",
  "Ulmer",
  "Vale",
  "Whitaker",
  "York",
  "Zane"
];
var TEAM_POSITIONS = [
  "QB",
  "QB",
  "QB",
  "RB",
  "RB",
  "RB",
  "RB",
  "WR",
  "WR",
  "WR",
  "WR",
  "WR",
  "WR",
  "TE",
  "TE",
  "TE",
  "LT",
  "LT",
  "RT",
  "RT",
  "LG",
  "LG",
  "RG",
  "RG",
  "C",
  "C",
  "EDGE",
  "EDGE",
  "EDGE",
  "DE",
  "DE",
  "DT",
  "DT",
  "DT",
  "NT",
  "LB",
  "LB",
  "LB",
  "LB",
  "LB",
  "LB",
  "CB",
  "CB",
  "CB",
  "CB",
  "CB",
  "CB",
  "FS",
  "FS",
  "SS",
  "SS",
  "K",
  "P"
];
var positionGroup = (position) => {
  if (["LT", "RT", "LG", "RG", "C", "OT", "OG"].includes(position)) return "OL";
  if (["EDGE", "DE", "DT", "NT"].includes(position)) return "DL_EDGE";
  if (["FS", "SS", "S"].includes(position)) return "S";
  return position;
};
var stableNumber = (value) => Array.from(value).reduce((total, character) => Math.imul(total ^ character.charCodeAt(0), 16777619), 2166136261) >>> 0;
var clampRating = (value) => Math.max(60, Math.min(97, Math.round(value)));
var measurementsFor = (position, seed) => {
  const ranges = {
    QB: [[72, 78], [205, 245]],
    RB: [[67, 73], [195, 235]],
    FB: [[69, 74], [230, 265]],
    WR: [[68, 77], [170, 225]],
    TE: [[75, 79], [240, 275]],
    LT: [[76, 81], [300, 380]],
    RT: [[76, 81], [300, 380]],
    OT: [[76, 81], [300, 380]],
    LG: [[73, 79], [295, 365]],
    RG: [[73, 79], [295, 365]],
    OG: [[73, 79], [295, 365]],
    C: [[72, 78], [290, 350]],
    EDGE: [[73, 79], [235, 285]],
    DE: [[73, 79], [255, 310]],
    DT: [[71, 77], [285, 345]],
    NT: [[71, 77], [315, 385]],
    LB: [[71, 77], [225, 270]],
    CB: [[68, 75], [170, 210]],
    S: [[69, 75], [185, 225]],
    FS: [[69, 75], [185, 225]],
    SS: [[69, 75], [195, 235]],
    K: [[68, 76], [170, 220]],
    P: [[70, 78], [185, 235]]
  };
  const [height, weight] = ranges[position] ?? ranges.WR;
  return { heightInches: height[0] + (seed >>> 8) % (height[1] - height[0] + 1), weightLbs: weight[0] + (seed >>> 15) % (weight[1] - weight[0] + 1) };
};
var salaryFor = (position, overall, seed) => {
  const premium = { QB: 1.75, EDGE: 1.25, WR: 1.16, LT: 1.14, CB: 1.08, RT: 0.92, DT: 0.9, DE: 0.9, TE: 0.72, RB: 0.62, LB: 0.68, FS: 0.62, SS: 0.62, K: 0.18, P: 0.14 };
  const floor = ["K", "P"].includes(position) ? 0.8 : 1.1;
  const talent = Math.max(0, overall - 66);
  return Number(Math.max(floor, talent * talent / 48 * (premium[position] ?? 0.58) + seed % 9 * 0.12).toFixed(1));
};
var jerseyPoolFor = (position) => {
  if (position === "QB") return [...Array.from({ length: 20 }, (_, index) => index)];
  if (["RB", "FB", "CB", "FS", "SS", "K", "P"].includes(position)) return Array.from({ length: 50 }, (_, index) => index);
  if (position === "WR") return [...Array.from({ length: 20 }, (_, index) => index), ...Array.from({ length: 10 }, (_, index) => 80 + index)];
  if (position === "TE") return [...Array.from({ length: 10 }, (_, index) => 40 + index), ...Array.from({ length: 10 }, (_, index) => 80 + index)];
  if (["LT", "RT", "LG", "RG", "C", "OT", "OG"].includes(position)) return Array.from({ length: 30 }, (_, index) => 50 + index);
  if (["EDGE", "DE", "DT", "NT"].includes(position)) return [...Array.from({ length: 30 }, (_, index) => 50 + index), ...Array.from({ length: 10 }, (_, index) => 90 + index)];
  if (position === "LB") return [...Array.from({ length: 20 }, (_, index) => 40 + index), ...Array.from({ length: 10 }, (_, index) => 90 + index)];
  return Array.from({ length: 100 }, (_, index) => index);
};
var jerseyFor = (position, seed, used) => {
  const pool = jerseyPoolFor(position);
  const offset = seed % pool.length;
  for (let index = 0; index < pool.length; index += 1) {
    const candidate = pool[(index + offset) % pool.length];
    if (!used.has(candidate)) {
      used.add(candidate);
      return candidate;
    }
  }
  const fallback = Array.from({ length: 100 }, (_, index) => index).find((number) => !used.has(number)) ?? pool[offset];
  used.add(fallback);
  return fallback;
};
var attributesFor = (position, overall, seed) => {
  const variation = (offset) => clampRating(overall + (seed >>> offset) % 9 - 4);
  return {
    athleticism: variation(1),
    footballIQ: variation(5),
    passing: position === "QB" ? variation(8) : void 0,
    rushing: ["QB", "RB"].includes(position) ? variation(10) : void 0,
    receiving: ["RB", "WR", "TE"].includes(position) ? variation(12) : void 0,
    passBlocking: ["LT", "RT", "LG", "RG", "C"].includes(position) ? variation(14) : void 0,
    runBlocking: ["LT", "RT", "LG", "RG", "C", "TE"].includes(position) ? variation(16) : void 0,
    passRush: ["EDGE", "DE", "DT", "NT", "LB"].includes(position) ? variation(18) : void 0,
    runDefense: ["EDGE", "DE", "DT", "NT", "LB", "FS", "SS"].includes(position) ? variation(20) : void 0,
    coverage: ["LB", "CB", "FS", "SS"].includes(position) ? variation(22) : void 0,
    kicking: ["K", "P"].includes(position) ? variation(24) : void 0
  };
};
var buildSoloPlayers = () => {
  let globalIndex = 0;
  return SOLO_TEAM_THEMES.flatMap((team, teamIndex) => {
    const depthByGroup = /* @__PURE__ */ new Map();
    const usedJerseyNumbers = /* @__PURE__ */ new Set();
    return TEAM_POSITIONS.map((position, rosterIndex) => {
      const group = positionGroup(position);
      const depth = depthByGroup.get(group) ?? 0;
      depthByGroup.set(group, depth + 1);
      const seed = stableNumber(`${team.abbr}:${position}:${rosterIndex}:ball-knower-league`);
      const teamStrength = teamIndex * 7 % 9 - 4;
      const depthPenalty = Math.min(12, depth * 2);
      const overall = clampRating(84 + teamStrength - depthPenalty + seed % 9 - 4);
      const firstName = FIRST_NAMES[globalIndex % FIRST_NAMES.length];
      const lastName = LAST_NAMES[Math.floor(globalIndex / FIRST_NAMES.length) % LAST_NAMES.length];
      const name = `${firstName} ${lastName}`;
      const id = `solo-${team.abbr.toLowerCase()}-${String(rosterIndex + 1).padStart(2, "0")}`;
      const measurements = measurementsFor(position, seed);
      globalIndex += 1;
      return {
        id,
        playerId: id,
        teamId: team.abbr,
        team: team.abbr,
        teamAbbreviation: team.abbr,
        teamCity: team.name.split(" ").slice(0, -1).join(" "),
        teamName: team.name,
        conference: teamIndex < 16 ? "AFC" : "NFC",
        division: ["East", "North", "South", "West"][Math.floor(teamIndex % 16 / 4)],
        name,
        firstName,
        lastName,
        fullName: name,
        position,
        positionGroup: group,
        jerseyNumber: jerseyFor(position, seed, usedJerseyNumbers),
        age: 21 + seed % 14,
        experience: seed % 12,
        ...measurements,
        durability: 70 + (seed >>> 23) % 28,
        starter: depth === 0 || group === "WR" && depth < 3 || ["OL", "DL_EDGE", "LB", "CB", "S"].includes(group) && depth < 4,
        active: true,
        isFreeAgent: false,
        rosterSeason: 1,
        ovr: overall,
        overall,
        overallRating: overall,
        ratingSource: "Ball Knower simulated universe",
        ratingSeason: "SIM-1",
        ratingStatus: "EDITORIAL",
        salary: salaryFor(position, overall, seed),
        salaryType: "estimated",
        salarySource: "Ball Knower simulation model",
        archetype: "Simulated pro player",
        attributes: attributesFor(position, overall, seed)
      };
    });
  });
};
var SOLO_CREATOR_EASTER_EGG = {
  id: "bk-001-eli-rodriguez",
  playerId: "bk-001-eli-rodriguez",
  teamId: "JCY",
  team: "JCY",
  teamAbbreviation: "JCY",
  teamCity: "Jersey City",
  teamName: "Jersey City Knights",
  conference: "AFC",
  division: "East",
  name: "Eli Rodriguez",
  firstName: "Eli",
  lastName: "Rodriguez",
  fullName: "Eli Rodriguez",
  position: "WR",
  positionGroup: "WR",
  jerseyNumber: 11,
  age: 30,
  experience: 10,
  heightInches: 69,
  weightLbs: 190,
  fortyYardDash: 4.36,
  durability: 96,
  starter: true,
  active: true,
  isFreeAgent: false,
  rosterSeason: 1,
  ovr: 85,
  overall: 85,
  overallRating: 85,
  ratingSource: "Ball Knower simulated universe",
  ratingSeason: "SIM-1",
  ratingStatus: "EDITORIAL",
  salary: 14.8,
  salaryType: "estimated",
  salarySource: "Ball Knower simulation model",
  archetype: "Elite slot route runner \xB7 4.36 forty \xB7 very durable",
  speed: 96,
  awareness: 93,
  attributes: { athleticism: 91, footballIQ: 94, receiving: 95 }
};
var BASE_SOLO_PLAYERS_DATABASE = buildSoloPlayers();
var eliRosterSlot = BASE_SOLO_PLAYERS_DATABASE.findIndex((player) => player.team === "JCY" && player.position === "WR" && !player.starter);
if (eliRosterSlot >= 0) BASE_SOLO_PLAYERS_DATABASE[eliRosterSlot] = SOLO_CREATOR_EASTER_EGG;
var SOLO_PLAYERS_DATABASE = BASE_SOLO_PLAYERS_DATABASE;
var SOLO_PLAYER_BY_ID = new Map(SOLO_PLAYERS_DATABASE.map((player) => [player.id, player]));
var FACE_COUNT = 9;
var HAIR_COUNT = 10;
var FACIAL_HAIR_COUNT = 6;
var EYE_BLACK_COUNT = 4;
var CREATOR_EASTER_EGG_ID = "bk-001-eli-rodriguez";
function appearanceSeed(id) {
  let hash = 2166136261;
  for (const c of id) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
  return hash >>> 0;
}
var chooseBuild = (position, seed) => {
  if (["LT", "RT", "LG", "RG", "C", "OT", "OG", "NT"].includes(position)) return seed % 4 === 0 ? "power" : "heavy";
  if (["DT", "DE", "EDGE", "LB", "FB", "TE"].includes(position)) return seed % 3 === 0 ? "power" : "athletic";
  if (["RB", "SS", "FS", "S", "QB"].includes(position)) return seed % 4 === 0 ? "power" : "athletic";
  return seed % 5 === 0 ? "athletic" : "lean";
};
var tattooCoverageFor = (seed) => {
  if (seed % 2 !== 0) return "none";
  const pool = ["minimal", "upper-arm", "forearm", "half-sleeve", "full-sleeve", "both-arms"];
  return pool[(seed >>> 5) % pool.length];
};
var tattooStyleFor = (seed) => ["blackwork", "geometric", "script", "traditional", "mixed"][(seed >>> 9) % 5];
function defaultAppearance(player) {
  const seed = appearanceSeed(player.id), number = player.jerseyNumber;
  if (player.id === CREATOR_EASTER_EGG_ID) return { version: 3, face: 5, hair: 2, facialHair: 4, eyeBlack: 1, build: "athletic", number: 11, sleeves: "none", gloves: "dark", tattooCoverage: "full-sleeve", tattooStyle: "mixed", tattooSeed: appearanceSeed("eli-rodriguez-tattoos") };
  return { version: 3, face: seed % FACE_COUNT, hair: (seed >>> 3) % HAIR_COUNT, facialHair: (seed >>> 7) % FACIAL_HAIR_COUNT, eyeBlack: (seed >>> 11) % EYE_BLACK_COUNT, build: chooseBuild(player.position, seed >>> 13), number: Number.isInteger(number) && number >= 0 && number <= 99 ? number : (seed >>> 8) % 100, sleeves: ["none", "right", "left", "both"][(seed >>> 17) % 4], gloves: ["none", "light", "dark"][(seed >>> 21) % 3], tattooCoverage: tattooCoverageFor(seed), tattooStyle: tattooStyleFor(seed), tattooSeed: seed >>> 1 };
}
var intIn = (value, min, max, fallback) => Number.isInteger(value) && Number(value) >= min && Number(value) <= max ? Number(value) : fallback;
function normalizeAppearance(player, input) {
  const base = defaultAppearance(player);
  if (!input || typeof input !== "object") return base;
  const v = input;
  if (![1, 2, 3].includes(Number(v.version))) return base;
  const current = Number(v.version) >= 2, tattooed = Number(v.version) >= 3;
  return { version: 3, face: intIn(v.face, 0, FACE_COUNT - 1, base.face), hair: current ? intIn(v.hair, 0, HAIR_COUNT - 1, base.hair) : base.hair, facialHair: current ? intIn(v.facialHair, 0, FACIAL_HAIR_COUNT - 1, base.facialHair) : base.facialHair, eyeBlack: current ? intIn(v.eyeBlack, 0, EYE_BLACK_COUNT - 1, base.eyeBlack) : base.eyeBlack, build: ["lean", "athletic", "power", "heavy"].includes(String(v.build)) ? v.build : base.build, number: intIn(v.number, 0, 99, base.number), sleeves: ["none", "right", "left", "both"].includes(String(v.sleeves)) ? v.sleeves : base.sleeves, gloves: current && ["none", "light", "dark"].includes(String(v.gloves)) ? v.gloves : base.gloves, tattooCoverage: tattooed && ["none", "minimal", "upper-arm", "forearm", "half-sleeve", "full-sleeve", "both-arms"].includes(String(v.tattooCoverage)) ? v.tattooCoverage : base.tattooCoverage, tattooStyle: tattooed && ["blackwork", "geometric", "script", "traditional", "mixed"].includes(String(v.tattooStyle)) ? v.tattooStyle : base.tattooStyle, tattooSeed: tattooed ? intIn(v.tattooSeed, 0, 2147483647, base.tattooSeed) : base.tattooSeed };
}
function appearanceRenderKey(look) {
  return JSON.stringify(Object.keys(look).sort().map((key) => [key, look[key]]));
}
var SIMULATED_ART_VERSION = 4;
var SIMULATED_ART_BUCKET = "ball-knower-simulated-player-art";
var SKIN_TONES = ["deep ebony", "dark brown", "rich brown", "medium brown", "warm brown", "olive brown", "golden tan", "light olive", "warm beige", "fair"];
var HAIR_STYLES = ["shaved", "bald", "low fade", "high fade", "waves", "short curls", "medium curls", "braids", "cornrows", "short twists", "long twists", "short locs", "medium locs", "tapered afro", "crew cut", "textured crop"];
var FACIAL_HAIR = ["clean shaven", "light stubble", "heavy stubble", "short boxed beard", "full beard", "goatee", "mustache", "beard and mustache"];
var FACE_SHAPES = ["oval", "square", "round", "long", "heart", "diamond"];
var EYE_COLORS = ["dark brown", "brown", "hazel", "green", "blue"];
var DETAILS = ["slight eyebrow notch", "subtle cheek scar", "pronounced dimples", "high cheekbones", "broad nose bridge", "narrow nose bridge", "strong jawline", "soft jawline", "freckled cheeks", "slightly crooked smile", "close-set eyes", "wide-set eyes"];
var POSITION_MEASUREMENTS = {
  QB: { height: [72, 78], weight: [205, 245], body: "balanced quarterback" },
  RB: { height: [67, 73], weight: [195, 235], body: "compact skill" },
  FB: { height: [69, 74], weight: [230, 265], body: "large athletic" },
  WR: { height: [68, 77], weight: [170, 225], body: "lean skill" },
  TE: { height: [75, 79], weight: [240, 275], body: "large athletic" },
  LT: { height: [76, 81], weight: [300, 380], body: "offensive line" },
  RT: { height: [76, 81], weight: [300, 380], body: "offensive line" },
  LG: { height: [73, 79], weight: [295, 365], body: "offensive line" },
  RG: { height: [73, 79], weight: [295, 365], body: "offensive line" },
  C: { height: [72, 78], weight: [290, 350], body: "offensive line" },
  OT: { height: [76, 81], weight: [300, 380], body: "offensive line" },
  OG: { height: [73, 79], weight: [295, 365], body: "offensive line" },
  EDGE: { height: [73, 79], weight: [235, 285], body: "edge power" },
  DE: { height: [73, 79], weight: [255, 310], body: "edge power" },
  DT: { height: [71, 77], weight: [285, 345], body: "interior defensive line" },
  NT: { height: [71, 77], weight: [315, 385], body: "interior defensive line" },
  LB: { height: [71, 77], weight: [225, 270], body: "linebacker power" },
  CB: { height: [68, 75], weight: [170, 210], body: "lean skill" },
  S: { height: [69, 75], weight: [185, 225], body: "compact skill" },
  FS: { height: [69, 75], weight: [185, 225], body: "compact skill" },
  SS: { height: [69, 75], weight: [195, 235], body: "compact skill" },
  K: { height: [68, 76], weight: [170, 220], body: "specialist" },
  P: { height: [70, 78], weight: [185, 235], body: "specialist" }
};
var between = (seed, min, max, shift) => min + (seed >>> shift) % (max - min + 1);
function simulatedPlayerIdentity(player) {
  if (player.id === CREATOR_EASTER_EGG_ID) {
    return {
      version: SIMULATED_ART_VERSION,
      playerId: player.id,
      identitySeed: appearanceSeed(player.id),
      approximateAge: 30,
      skinTone: "warm brown",
      hairStyle: "low fade",
      hairColor: "black",
      facialHair: "full beard",
      faceShape: "diamond",
      eyeColor: "dark brown",
      bodyArchetype: "compact skill",
      heightInches: 69,
      weightLbs: 190,
      tattooProfile: "full sleeve",
      accessoryProfile: "eye black and gloves",
      distinguishingDetail: "approved creator likeness with sharp hairline and shaped beard",
      lockedReference: "eli-rodriguez-approved-face"
    };
  }
  const seed = appearanceSeed(player.id);
  const measurements = POSITION_MEASUREMENTS[player.position] ?? POSITION_MEASUREMENTS.WR;
  const skinTone = SKIN_TONES[seed % SKIN_TONES.length];
  const hairStyle = HAIR_STYLES[(seed >>> 4) % HAIR_STYLES.length];
  const hairColor = skinTone === "fair" ? ["black", "dark brown", "brown", "auburn", "blond"][(seed >>> 9) % 5] : seed % 7 === 0 ? "dark brown" : "black";
  const heightInches = Number.isFinite(player.heightInches) ? Math.round(player.heightInches) : between(seed, measurements.height[0], measurements.height[1], 8);
  const weightLbs = Number.isFinite(player.weightLbs) ? Math.round(player.weightLbs) : between(seed, measurements.weight[0], measurements.weight[1], 15);
  return {
    version: SIMULATED_ART_VERSION,
    playerId: player.id,
    identitySeed: seed,
    approximateAge: Number.isFinite(player.age) ? Math.round(player.age) : between(seed, 21, 35, 20),
    skinTone,
    hairStyle,
    hairColor,
    facialHair: FACIAL_HAIR[(seed >>> 12) % FACIAL_HAIR.length],
    faceShape: FACE_SHAPES[(seed >>> 16) % FACE_SHAPES.length],
    eyeColor: EYE_COLORS[(seed >>> 19) % EYE_COLORS.length],
    bodyArchetype: measurements.body,
    heightInches,
    weightLbs,
    tattooProfile: ["none", "none", "minimal", "one arm", "half sleeve", "full sleeve", "both arms"][(seed >>> 22) % 7],
    accessoryProfile: ["none", "gloves", "arm sleeve", "gloves and sleeve", "eye black and gloves"][(seed >>> 25) % 5],
    distinguishingDetail: DETAILS[(seed >>> 6) % DETAILS.length],
    lockedReference: null
  };
}
function simulatedIdentityFingerprint(player) {
  const identity = simulatedPlayerIdentity(player);
  return [identity.version, identity.playerId, identity.identitySeed, identity.approximateAge, identity.skinTone, identity.hairStyle, identity.hairColor, identity.facialHair, identity.faceShape, identity.eyeColor, identity.bodyArchetype, identity.heightInches, identity.weightLbs, identity.tattooProfile, identity.accessoryProfile, identity.distinguishingDetail, identity.lockedReference ?? ""].join("|");
}
function fictionalUniformPrompt(player, number, variant = "home") {
  const team = SOLO_TEAM_THEMES.find((item) => item.abbr === player.team);
  const name = player.teamName || team?.name || player.team || "Ball Knower Training";
  const primary = team?.primary || "#111827";
  const secondary = team?.secondary || "#D4AF37";
  const jerseyBase = variant === "away" ? "clean white" : variant === "alternate" ? secondary : primary;
  const numberColor = variant === "away" ? primary : variant === "alternate" ? primary : secondary;
  return `${name} fictional professional football ${variant} uniform. STRICT TEAM PALETTE LOCK: primary ${primary}, secondary ${secondary}, with neutral white or black only when needed. Jersey base ${jerseyBase}; jersey number ${number} in ${numberColor} with high-contrast trim; coordinated pants, socks, gloves and blank helmet use this exact same palette. The chest-up and full-body panels must show the identical uniform design, colors, number ${number}, striping and equipment. Do not invent or substitute any color outside this palette. No NFL, real-team, league, sponsor, wordmark, mascot, manufacturer or swoosh logos`;
}
function positionBuildDirection(position, height, weight) {
  if (["WR", "CB"].includes(position)) return `lean explosive skill-player frame at ${height} inches and ${weight} pounds, narrow waist, defined shoulders and realistic speed-athlete legs`;
  if (["RB", "FS", "SS", "S"].includes(position)) return `compact muscular frame at ${height} inches and ${weight} pounds, powerful hips and thighs without oversized lineman mass`;
  if (position === "QB") return `balanced athletic quarterback frame at ${height} inches and ${weight} pounds, strong but not bodybuilder-heavy`;
  if (["TE", "EDGE", "DE", "LB"].includes(position)) return `large athletic contact-player frame at ${height} inches and ${weight} pounds, broad shoulders with believable mobility`;
  if (["OT", "LT", "RT", "OG", "LG", "RG", "C", "DT", "NT"].includes(position)) return `large realistic football lineman frame at ${height} inches and ${weight} pounds, thick torso, heavy legs and functional mass, never merely a stretched skill-player body`;
  if (["K", "P"].includes(position)) return `lean position-appropriate specialist frame at ${height} inches and ${weight} pounds, athletic but not oversized`;
  return `${height} inches and ${weight} pounds with position-appropriate professional football proportions`;
}
function isSupportedSimulatedPlayerId(value) {
  return /^(solo-[a-z0-9-]{3,80}|bk-001-eli-rodriguez|franchise-rookie-[a-z0-9-]{3,100}|my-player-[a-z0-9-]{3,100})$/.test(value);
}
function positionForArt(value) {
  const allowed = ["QB", "RB", "FB", "WR", "TE", "OT", "LT", "RT", "OG", "LG", "RG", "C", "EDGE", "DT", "DE", "NT", "LB", "CB", "S", "FS", "SS", "K", "P"];
  return allowed.includes(value) ? value : "WR";
}
var SIMULATED_ART_BUDGET_SCOPE = "production-v4";
var SIMULATED_ART_ABSOLUTE_BUDGET_MICRO_USD = 35e6;
var SIMULATED_ART_MODELS = { economy: "gemini-3.1-flash-lite-image", review: "gemini-3.1-flash-image" };
var SIMULATED_ART_BATCH_COST_MICRO_USD = { economy: 17e3, review: 35e3 };
function simulatedArtBudgetLimitMicroUsd(configured = 35) {
  const requested = Number(configured), dollars = Number.isFinite(requested) ? Math.max(0, Math.min(35, requested)) : 35;
  return Math.min(SIMULATED_ART_ABSOLUTE_BUDGET_MICRO_USD, Math.floor(dollars * 1e6));
}
var DEFAULT_SUPABASE_URL = "https://gpnboygoosrmeydwjpvk.supabase.co";
var DEFAULT_PUBLISHABLE_KEY = "sb_publishable_tgnOH0RUtswLI58isL5Qfw_Pq3xaV9h";
var TABLE = "ball_knower_simulated_player_art";
var BUDGET_TABLE = "ball_knower_simulated_art_budgets";
var BATCH_TABLE = "ball_knower_simulated_art_batches";
var LEDGER_TABLE = "ball_knower_simulated_art_generation_ledger";
var MAX_BATCH = 16;
var REVIEW_CHECKS = ["distortedEyes", "duplicatedFeatures", "malformedEars", "mangledHands", "warpedJerseys", "unreadableNumbers", "identityMatch", "uniqueIdentity", "realisticAppearance", "sharpExpandedView"];
var json = (res, status, payload, cache = "no-store") => {
  res.setHeader("Cache-Control", cache);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.status(status).json(payload);
};
var safeText = (value, max, fallback) => {
  const text = String(value ?? "").trim().replace(/[^A-Za-z0-9 .'-]/g, " ").replace(/\s+/g, " ").slice(0, max);
  return text || fallback;
};
var safeInt = (value, min, max, fallback) => {
  const number = Math.round(Number(value));
  return Number.isFinite(number) && number >= min && number <= max ? number : fallback;
};
var safeVariant = (value) => ["home", "away", "alternate"].includes(String(value)) ? value : "home";
var safeTier = (value) => value === "review" ? "review" : "economy";
var sha = (value) => createHash("sha256").update(value).digest("hex");
var secureEqual = (provided, expected) => {
  const a = Buffer.from(provided), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
};
var budgetLimitMicroUsd = () => simulatedArtBudgetLimitMicroUsd(process.env.SIMULATED_PLAYER_ART_BUDGET_USD);
var geminiApiKey = () => process.env.GEMINI_API_KEY || process.env.Gemini_key || "";
function clients() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const publishable = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || DEFAULT_PUBLISHABLE_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return {
    publicClient: createClient(url, publishable, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }),
    serviceClient: serviceKey ? createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }) : null
  };
}
function publicUrl(client, path) {
  return path ? client.storage.from(SIMULATED_ART_BUCKET).getPublicUrl(path).data.publicUrl : void 0;
}
function manifest(client, row) {
  const urls = { avatar: publicUrl(client, row.avatar_path), row: publicUrl(client, row.row_path), card: publicUrl(client, row.card_path), portrait: publicUrl(client, row.portrait_path), fullBody: publicUrl(client, row.full_body_path) };
  const complete = Object.values(urls).every(Boolean);
  return {
    status: row.status,
    playerId: row.player_id,
    teamAbbr: row.team_abbr,
    uniformVariant: row.uniform_variant,
    appearanceKey: row.appearance_key,
    identityFingerprint: row.identity_fingerprint,
    artVersion: row.art_version,
    urls: complete ? urls : void 0,
    width: row.source_width,
    height: row.source_height,
    reviewedAt: row.reviewed_at
  };
}
function normalizeJob(input) {
  const playerId = safeText(input.playerId, 110, "");
  if (!isSupportedSimulatedPlayerId(playerId)) throw new Error("Unsupported simulated player ID.");
  const team = String(input.team || "").toUpperCase();
  const teamRecord = SOLO_TEAM_THEMES.find((item) => item.abbr === team);
  if (!teamRecord && !["BK", "FA"].includes(team)) throw new Error("Use a fictional Ball Knower team.");
  const position = positionForArt(String(input.position || "WR").toUpperCase());
  const teamName = teamRecord?.name || (team === "FA" ? "Ball Knower Draft Class" : "Ball Knower Training");
  const player = {
    id: playerId,
    name: safeText(input.name, 60, "Simulated Player"),
    team,
    teamName,
    position,
    jerseyNumber: safeInt(input.number, 0, 99, defaultAppearance({ id: playerId, name: "Simulated Player", team, position }).number),
    age: safeInt(input.age, 20, 45, 21 + simulatedPlayerIdentity({ id: playerId, name: "Simulated Player", team, position }).identitySeed % 15),
    heightInches: safeInt(input.heightInches, 65, 82, 72),
    weightLbs: safeInt(input.weightLbs, 155, 400, 210)
  };
  const appearance = normalizeAppearance(player, input.appearance ?? defaultAppearance(player));
  const appearanceKey = appearanceRenderKey(appearance);
  return { player, appearance, appearanceKey, variant: safeVariant(input.variant), identity: simulatedPlayerIdentity(player), fingerprint: simulatedIdentityFingerprint(player), attempt: safeInt(input.attempt, 0, 20, 0) };
}
function serializedInput(job) {
  return {
    playerId: job.player.id,
    team: job.player.team,
    variant: job.variant,
    position: job.player.position,
    name: job.player.name,
    number: job.appearance.number,
    age: job.player.age,
    heightInches: job.player.heightInches,
    weightLbs: job.player.weightLbs,
    appearance: job.appearance,
    attempt: job.attempt
  };
}
function sheetPrompt(job, hasAnchor) {
  const i = job.identity, number = job.appearance.number;
  const identityDirection = hasAnchor ? "Use the supplied fictional identity anchor as the exact same person in both panels. Preserve the face, skin tone, age, facial structure, eyes, ears, hairline, hair and facial hair." : `Create one entirely fictional adult professional football player, not a real athlete: ${i.approximateAge} years old; ${i.skinTone} skin; ${i.faceShape} face; ${i.eyeColor} eyes; ${i.hairColor} ${i.hairStyle}; ${i.facialHair}; ${i.distinguishingDetail}.`;
  return `${identityDirection} Produce one square two-panel professional football photography sheet with a clean split exactly at the vertical center. LEFT HALF: a large chest-up database portrait, face fully visible, no helmet. RIGHT HALF: the exact same player's realistic full body from hair to both cleats, standing in a natural three-quarter hero pose and holding a helmet at his side. Keep each person entirely inside their own half and do not cross the center. Body requirement: ${positionBuildDirection(job.player.position, i.heightInches, i.weightLbs)}; ${i.bodyArchetype}. Uniform requirement: ${fictionalUniformPrompt(job.player, number, job.variant)}. Equipment: ${job.appearance.eyeBlack ? "eye black" : "no eye black"}; ${job.appearance.sleeves} arm sleeves; ${job.appearance.gloves} gloves. Tattoos: ${job.appearance.tattooCoverage}, ${job.appearance.tattooStyle}; stable identity detail: ${i.tattooProfile}. Photorealistic skin pores, believable eyes, nose, ears, teeth if visible, hairline, hands, fingers, anatomy, football pads, fabric weave and stitching. Dark stadium tunnel with matching cinematic key and rim lighting in both halves. No divider line, captions, words, logos, trademarks, watermark, real teams or real players. Reject any palette drift between players on the same team, mismatched uniforms or faces between panels, duplicate features, distorted eyes, malformed ears, extra fingers, fused hands, extra limbs, warped jersey, unreadable or inconsistent number, mannequin proportions, plastic skin, cartoon styling, blur, cropped feet, or cropped hair.`;
}
function rowKey(job) {
  return { player_id: job.player.id, team_abbr: job.player.team, uniform_variant: job.variant, appearance_key: job.appearanceKey, art_version: SIMULATED_ART_VERSION };
}
async function upload(client, path, buffer, contentType) {
  const { error } = await client.storage.from(SIMULATED_ART_BUCKET).upload(path, buffer, { contentType, cacheControl: "31536000", upsert: false });
  if (error && !/already exists|duplicate/i.test(error.message)) throw new Error(`Artwork upload failed: ${error.message}`);
}
async function download(client, path) {
  const { data, error } = await client.storage.from(SIMULATED_ART_BUCKET).download(path);
  if (error || !data) throw new Error(`Identity anchor download failed: ${error?.message || "empty object"}`);
  return { mime: data.type || "image/jpeg", buffer: Buffer.from(await data.arrayBuffer()) };
}
async function reusableIdentityAnchor(service, job) {
  const { data, error } = await service.from(TABLE).select("identity_anchor_path").eq("player_id", job.player.id).eq("identity_fingerprint", job.fingerprint).eq("art_version", SIMULATED_ART_VERSION).not("identity_anchor_path", "is", null).order("reviewed_at", { ascending: false, nullsFirst: false }).limit(1).maybeSingle();
  if (error) throw new Error(`Could not resolve the persistent identity anchor: ${error.message}`);
  if (data?.identity_anchor_path) return { path: String(data.identity_anchor_path), image: await download(service, String(data.identity_anchor_path)) };
  const relativePath = job.player.id === "bk-001-eli-rodriguez" ? "solo-characters/v2/eli-rodriguez/portrait.webp" : `solo-characters/v2/qa/${job.player.id}/portrait.webp`;
  const image = await localReference(relativePath);
  return image ? { path: null, image } : null;
}
var TEAM_UNIFORM_ANCHOR_PATHS = {
  "ABQ:home": "v4/uniforms/solo-abq-01/ABQ/home/be6db37008ab133c5dae/98389f5ce35b479e17f8/full-body.webp"
};
async function localReference(relativePath) {
  try {
    return { mime: "image/webp", buffer: await readFile(join(process.cwd(), "public", relativePath)) };
  } catch {
    return null;
  }
}
async function reusableTeamUniformAnchor(service, job) {
  const storedPath = TEAM_UNIFORM_ANCHOR_PATHS[`${job.player.team}:${job.variant}`];
  if (storedPath) return download(service, storedPath);
  const staticTeamAnchor = job.player.team === "BRK" ? "solo-characters/v2/qa/solo-brk-02/full-body.webp" : job.player.team === "SLC" ? "solo-characters/v2/qa/solo-slc-02/full-body.webp" : null;
  return staticTeamAnchor ? localReference(staticTeamAnchor) : null;
}
function batchRequest(job, anchor, uniformAnchor) {
  const referenceDirection = uniformAnchor ? " A second supplied reference shows the team's approved uniform only: copy its jersey base color, number color and trim, shoulder striping, pants, socks and helmet palette exactly, but do not copy that reference player's face, hair, skin, body, pose, tattoos or jersey number." : "";
  const parts = [{ text: `${sheetPrompt(job, Boolean(anchor))}${referenceDirection}` }];
  if (anchor) parts.push({ inlineData: { mimeType: anchor.mime, data: anchor.buffer.toString("base64") } });
  if (uniformAnchor) parts.push({ inlineData: { mimeType: uniformAnchor.mime, data: uniformAnchor.buffer.toString("base64") } });
  return { contents: [{ role: "user", parts }], config: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "1:1", imageSize: "1K" } } };
}
function outputBatchImage(value) {
  const parts = value?.response?.candidates?.flatMap((candidate) => candidate?.content?.parts ?? []) ?? [];
  const part = parts.find((item) => item?.inlineData?.data || item?.inline_data?.data), inline = part?.inlineData ?? part?.inline_data;
  if (!inline?.data) throw new Error(value?.error?.message || "The batch model returned no artwork.");
  return { mime: String(inline.mimeType || inline.mime_type || "image/png"), buffer: Buffer.from(inline.data, "base64") };
}
async function packageIdentitySheet(service, raw, generated, stored, model, cost, batchId) {
  const meta = await sharp(generated.buffer).metadata(), width = meta.width ?? 0, height = meta.height ?? 0;
  if (width < 900 || height < 900 || Math.abs(width - height) > Math.max(width, height) * 0.15) throw new Error("Identity sheet is not a production-size square.");
  const sourceSheet = await sharp(generated.buffer).jpeg({ quality: 94, mozjpeg: true }).toBuffer();
  const leftWidth = Math.floor(width / 2), rightWidth = width - leftWidth;
  const portraitSource = await sharp(generated.buffer).extract({ left: 0, top: 0, width: leftWidth, height }).resize(640, 800, { fit: "cover", position: "north" }).jpeg({ quality: 93 }).toBuffer();
  const fullSource = await sharp(generated.buffer).extract({ left: leftWidth, top: 0, width: rightWidth, height }).resize(768, 1536, { fit: "cover", position: "centre" }).jpeg({ quality: 92 }).toBuffer();
  const portraitMeta = await sharp(portraitSource).metadata(), fullMeta = await sharp(fullSource).metadata();
  const derivatives = {
    avatar: await sharp(portraitSource).resize(96, 96, { fit: "cover", position: "attention" }).webp({ quality: 76 }).toBuffer(),
    row: await sharp(portraitSource).resize(160, 200, { fit: "cover", position: "attention" }).webp({ quality: 78 }).toBuffer(),
    card: await sharp(portraitSource).resize(384, 480, { fit: "cover", position: "attention" }).webp({ quality: 82 }).toBuffer(),
    portrait: await sharp(portraitSource).resize(640, 800, { fit: "cover", position: "attention" }).webp({ quality: 84 }).toBuffer(),
    fullBody: await sharp(fullSource).resize(768, 1152, { fit: "contain", background: { r: 8, g: 10, b: 14 } }).webp({ quality: 84 }).toBuffer()
  };
  const identityRoot = `v${SIMULATED_ART_VERSION}/identities/${raw.player.id}/${sha(raw.fingerprint).slice(0, 20)}`, reusable = await reusableIdentityAnchor(service, raw);
  const identityAnchorPath = reusable?.path ?? `${identityRoot}/anchor.jpg`;
  if (!reusable?.path) await upload(service, identityAnchorPath, reusable?.image.buffer ?? portraitSource, reusable?.image.mime ?? "image/jpeg");
  const assetHash = sha(sourceSheet).slice(0, 20), pathHash = sha(raw.appearanceKey).slice(0, 20), root = `v${SIMULATED_ART_VERSION}/uniforms/${raw.player.id}/${raw.player.team}/${raw.variant}/${pathHash}/${assetHash}`;
  const paths = { sheet: `${root}/source-sheet.jpg`, identityAnchor: identityAnchorPath, sourcePortrait: `${root}/source-portrait.jpg`, sourceFull: `${root}/source-full-body.jpg`, avatar: `${root}/avatar.webp`, row: `${root}/row.webp`, card: `${root}/card.webp`, portrait: `${root}/portrait.webp`, fullBody: `${root}/full-body.webp` };
  await Promise.all([
    upload(service, paths.sheet, sourceSheet, "image/jpeg"),
    upload(service, paths.sourcePortrait, portraitSource, "image/jpeg"),
    upload(service, paths.sourceFull, fullSource, "image/jpeg"),
    upload(service, paths.avatar, derivatives.avatar, "image/webp"),
    upload(service, paths.row, derivatives.row, "image/webp"),
    upload(service, paths.card, derivatives.card, "image/webp"),
    upload(service, paths.portrait, derivatives.portrait, "image/webp"),
    upload(service, paths.fullBody, derivatives.fullBody, "image/webp")
  ]);
  const qualityReport = { automated: { sheet: [width, height], portrait: [portraitMeta.width, portraitMeta.height], fullBody: [fullMeta.width, fullMeta.height], layout: "left-portrait-right-full-body", identityAnchorReused: Boolean(reusable), sheetSha256: sha(sourceSheet), portraitSha256: sha(portraitSource), fullBodySha256: sha(fullSource), derivativeBytes: Object.fromEntries(Object.entries(derivatives).map(([key, value]) => [key, value.length])) }, generation: { generationId: stored.generationId, batchId, model, estimatedCostMicrousd: cost, attempt: stored.attempt }, manual: { required: true, passed: false } };
  const { data: completed, error } = await service.from(TABLE).update({
    status: "pending_review",
    identity_anchor_path: paths.identityAnchor,
    source_sheet_path: paths.sheet,
    source_portrait_path: paths.sourcePortrait,
    source_full_body_path: paths.sourceFull,
    avatar_path: paths.avatar,
    row_path: paths.row,
    card_path: paths.card,
    portrait_path: paths.portrait,
    full_body_path: paths.fullBody,
    source_width: fullMeta.width,
    source_height: fullMeta.height,
    content_sha256: sha(fullSource),
    generation_model: model,
    generation_id: stored.generationId,
    estimated_cost_microusd: cost,
    quality_report: qualityReport,
    generated_at: (/* @__PURE__ */ new Date()).toISOString(),
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  }).match(rowKey(raw)).select("*").single();
  if (error) throw new Error(`Could not finalize artwork manifest: ${error.message}`);
  return completed;
}
async function budgetSnapshot(service) {
  const [{ data: budget, error: budgetError }, { count: approved, error: approvedError }, { count: pending, error: pendingError }] = await Promise.all([
    service.from(BUDGET_TABLE).select("*").eq("budget_scope", SIMULATED_ART_BUDGET_SCOPE).single(),
    service.from(TABLE).select("*", { count: "exact", head: true }).eq("status", "approved"),
    service.from(TABLE).select("*", { count: "exact", head: true }).eq("status", "pending_review")
  ]);
  if (budgetError || approvedError || pendingError) throw new Error(`Could not read artwork budget: ${budgetError?.message || approvedError?.message || pendingError?.message}`);
  const limit = Math.min(Number(budget.budget_microusd), budgetLimitMicroUsd());
  return { budgetUsd: limit / 1e6, reservedUsd: Number(budget.reserved_microusd) / 1e6, spentUsd: Number(budget.spent_microusd) / 1e6, remainingUsd: Math.max(0, limit - Number(budget.reserved_microusd) - Number(budget.spent_microusd)) / 1e6, approvedPlayers: approved ?? 0, pendingReviewPlayers: pending ?? 0 };
}
async function finishLedger(service, generationId, succeeded, error) {
  const { error: finishError } = await service.rpc("finish_simulated_art_generation", { p_generation_id: generationId, p_succeeded: succeeded, p_error: succeeded ? null : String(error ?? "Generation failed").slice(0, 1e3) });
  if (finishError) throw new Error(`Could not finalize artwork cost ledger: ${finishError.message}`);
}
async function submitBatch(service, ai, inputs, tier) {
  const batchId = randomUUID(), model = SIMULATED_ART_MODELS[tier], cost = SIMULATED_ART_BATCH_COST_MICRO_USD[tier], normalized = inputs.slice(0, MAX_BATCH).map(normalizeJob);
  if (!normalized.length) throw new Error("At least one artwork job is required.");
  const requestedJobs = normalized.map((raw) => ({ generationId: randomUUID(), dedupeKey: sha(JSON.stringify({ ...rowKey(raw), tier, attempt: raw.attempt })), attempt: raw.attempt, input: serializedInput(raw) }));
  const { error: createError } = await service.from(BATCH_TABLE).insert({ id: batchId, budget_scope: SIMULATED_ART_BUDGET_SCOPE, model, quality_tier: tier, status: "reserving", jobs: requestedJobs, expected_items: requestedJobs.length, expected_cost_microusd: requestedJobs.length * cost });
  if (createError) throw new Error(`Could not create artwork batch: ${createError.message}`);
  const accepted = [];
  let budgetExhausted = false;
  for (let index = 0; index < normalized.length; index++) {
    const raw = normalized[index], stored = requestedJobs[index];
    const { data: existing, error: existingError } = await service.from(TABLE).select("status,updated_at,quality_report").match(rowKey(raw)).maybeSingle();
    if (existingError) throw new Error(`Could not check existing artwork: ${existingError.message}`);
    if (existing?.status === "approved" || existing?.status === "pending_review" || existing?.status === "generating" && raw.attempt === 0 && Date.now() - Date.parse(existing.updated_at) < 26 * 60 * 6e4) continue;
    const priorAttempt = Number(existing?.quality_report?.generation?.attempt);
    if (tier === "review" && Number.isFinite(priorAttempt) && stored.attempt <= priorAttempt) {
      stored.attempt = priorAttempt + 1;
      stored.input.attempt = stored.attempt;
      stored.dedupeKey = sha(JSON.stringify({ ...rowKey(raw), tier, attempt: stored.attempt }));
    }
    const { data, error } = await service.rpc("reserve_simulated_art_generation", { p_generation_id: stored.generationId, p_dedupe_key: stored.dedupeKey, p_budget_scope: SIMULATED_ART_BUDGET_SCOPE, p_budget_limit_microusd: budgetLimitMicroUsd(), p_batch_id: batchId, p_player_id: raw.player.id, p_team_abbr: raw.player.team, p_model: model, p_quality_tier: tier, p_estimated_cost_microusd: cost });
    if (error) throw new Error(`Could not reserve artwork budget: ${error.message}`);
    const reservation = Array.isArray(data) ? data[0] : data;
    if (reservation?.accepted) accepted.push(stored);
    else if (reservation?.reason === "budget_exhausted") {
      budgetExhausted = true;
      break;
    }
  }
  if (!accepted.length) {
    await service.from(BATCH_TABLE).update({ status: "cancelled", jobs: requestedJobs, expected_items: requestedJobs.length, expected_cost_microusd: 0, error: budgetExhausted ? "The $35 artwork budget is exhausted." : "Every requested player already has artwork reserved.", completed_at: (/* @__PURE__ */ new Date()).toISOString(), updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", batchId);
    return { batchId, submitted: 0, budgetExhausted, budget: await budgetSnapshot(service) };
  }
  await service.from(BATCH_TABLE).update({ jobs: accepted, expected_items: accepted.length, expected_cost_microusd: accepted.length * cost, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", batchId);
  let providerName = "";
  try {
    const requests = [];
    for (const stored of accepted) {
      const raw = normalizeJob(stored.input);
      const [anchor, uniformAnchor] = await Promise.all([reusableIdentityAnchor(service, raw), reusableTeamUniformAnchor(service, raw)]);
      requests.push({ ...batchRequest(raw, anchor?.image, uniformAnchor), metadata: { generationId: stored.generationId } });
      const { error } = await service.from(TABLE).upsert({ ...rowKey(raw), identity_fingerprint: raw.fingerprint, identity_descriptor: raw.identity, status: "generating", generation_model: model, generation_id: stored.generationId, estimated_cost_microusd: cost, rejection_reason: null, updated_at: (/* @__PURE__ */ new Date()).toISOString() }, { onConflict: "player_id,team_abbr,uniform_variant,appearance_key,art_version" });
      if (error) throw new Error(`Could not reserve artwork manifest: ${error.message}`);
    }
    const provider = await ai.batches.create({ model, src: { inlinedRequests: requests }, config: { displayName: `ball-knower-v4-${batchId}` } });
    providerName = String(provider?.name || "");
    if (!providerName) throw new Error("Gemini did not return a batch job name.");
    await service.from(LEDGER_TABLE).update({ status: "submitted", provider_job_name: providerName, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("batch_id", batchId).eq("status", "reserved");
    await service.from(BATCH_TABLE).update({ provider_job_name: providerName, status: "submitted", provider_state: String(provider.state ?? "JOB_STATE_PENDING"), updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", batchId);
    return { batchId, providerJobName: providerName, submitted: accepted.length, budgetExhausted, budget: await budgetSnapshot(service) };
  } catch (error) {
    if (!providerName) {
      for (const stored of accepted) await finishLedger(service, stored.generationId, false, error);
      await service.from(BATCH_TABLE).update({ status: "failed", error: String(error).slice(0, 1e3), completed_at: (/* @__PURE__ */ new Date()).toISOString(), updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", batchId);
    } else {
      await service.from(BATCH_TABLE).update({ provider_job_name: providerName, status: "running", error: String(error).slice(0, 1e3), updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", batchId);
    }
    throw error;
  }
}
async function syncBatch(service, publicClient, ai, batchId) {
  const { data, error } = await service.from(BATCH_TABLE).select("*").eq("id", batchId).single();
  if (error || !data) throw new Error("Artwork batch was not found.");
  const batch = data;
  if (batch.status === "succeeded" || batch.status === "failed" || batch.status === "expired" || batch.status === "cancelled") return { batchId, status: batch.status, processed: batch.processed_items, budget: await budgetSnapshot(service) };
  if (!batch.provider_job_name) throw new Error("Artwork batch has no Gemini job name.");
  const provider = await ai.batches.get({ name: batch.provider_job_name }), providerState = String(provider?.state ?? "JOB_STATE_UNSPECIFIED");
  if (!providerState.includes("SUCCEEDED")) {
    const terminal = providerState.includes("FAILED") || providerState.includes("EXPIRED") || providerState.includes("CANCELLED");
    await service.from(BATCH_TABLE).update({ status: terminal ? providerState.includes("EXPIRED") ? "expired" : providerState.includes("CANCELLED") ? "cancelled" : "failed" : "running", provider_state: providerState, error: terminal ? String(provider?.error?.message || providerState) : null, completed_at: terminal ? (/* @__PURE__ */ new Date()).toISOString() : null, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", batchId);
    if (terminal) for (const stored of batch.jobs) await finishLedger(service, stored.generationId, false, provider?.error?.message || providerState);
    return { batchId, status: terminal ? "failed" : "running", providerState, processed: 0, budget: await budgetSnapshot(service) };
  }
  await service.from(BATCH_TABLE).update({ status: "processing", provider_state: providerState, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", batchId);
  const responses = provider?.dest?.inlinedResponses ?? provider?.dest?.inlined_responses ?? [];
  let processed = 0;
  const failures = [];
  const results = [];
  for (let index = 0; index < batch.jobs.length; index++) {
    const stored = batch.jobs[index], raw = normalizeJob(stored.input);
    try {
      const { data: existing } = await service.from(TABLE).select("*").match(rowKey(raw)).in("status", ["pending_review", "approved"]).maybeSingle();
      if (existing) {
        processed++;
        results.push(manifest(publicClient, existing));
        continue;
      }
      const generated = outputBatchImage(responses.find((item) => String(item?.metadata?.generationId || item?.metadata?.generation_id || "") === stored.generationId) ?? responses[index]);
      await finishLedger(service, stored.generationId, true);
      const completed = await packageIdentitySheet(service, raw, generated, stored, batch.model, SIMULATED_ART_BATCH_COST_MICRO_USD[batch.quality_tier], batchId);
      processed++;
      results.push(manifest(publicClient, completed));
    } catch (processError) {
      try {
        await finishLedger(service, stored.generationId, false, processError);
      } catch {
      }
      const message = String(processError instanceof Error ? processError.message : processError).slice(0, 500);
      failures.push({ playerId: raw.player.id, error: message });
      await service.from(TABLE).update({ status: "rejected", rejection_reason: message, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).match(rowKey(raw)).eq("status", "generating");
    }
  }
  const status = failures.length ? "failed" : "succeeded";
  await service.from(BATCH_TABLE).update({ status, processed_items: processed, error: failures.length ? `${failures.length} artwork results need a retry.` : null, completed_at: (/* @__PURE__ */ new Date()).toISOString(), updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", batchId);
  return { batchId, status, processed, failures, results, budget: await budgetSnapshot(service) };
}
async function handler(req, res) {
  const { publicClient, serviceClient } = clients();
  if (req.method === "GET") {
    try {
      const input = { playerId: String(req.query?.playerId || ""), team: String(req.query?.team || ""), variant: safeVariant(req.query?.variant), position: String(req.query?.position || "WR"), name: String(req.query?.name || ""), number: Number(req.query?.number), age: Number(req.query?.age), heightInches: Number(req.query?.heightInches), weightLbs: Number(req.query?.weightLbs) };
      const job = normalizeJob(input), requestedAppearanceKey = String(req.query?.appearanceKey || job.appearanceKey);
      if (requestedAppearanceKey.length < 8 || requestedAppearanceKey.length > 240) throw new Error("Appearance key has an invalid length.");
      const { data, error } = await publicClient.from(TABLE).select("*").match({ player_id: job.player.id, team_abbr: job.player.team, uniform_variant: job.variant, appearance_key: requestedAppearanceKey, art_version: SIMULATED_ART_VERSION }).eq("status", "approved").maybeSingle();
      if (error) return json(res, 503, { status: "missing", error: "Player artwork catalog is temporarily unavailable." });
      if (!data) return json(res, 202, { status: "missing", playerId: job.player.id, teamAbbr: job.player.team, uniformVariant: job.variant, appearanceKey: job.appearanceKey, identityFingerprint: job.fingerprint, artVersion: SIMULATED_ART_VERSION }, "private, max-age=30");
      return json(res, 200, manifest(publicClient, data), "public, max-age=300, stale-while-revalidate=86400");
    } catch (error) {
      return json(res, 400, { status: "missing", error: String(error?.message || "Invalid artwork request.") });
    }
  }
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
  const expected = process.env.SIMULATED_PLAYER_ART_ADMIN_KEY || "", provided = String(req.headers["x-ball-knower-art-key"] || "");
  if (!expected || !provided || !secureEqual(provided, expected)) return json(res, 401, { error: "Artwork publisher authorization required." });
  if (!serviceClient) return json(res, 503, { error: "Server-side artwork storage is not configured." });
  const action = String(req.body?.action || "submit-batch");
  try {
    if (action === "status") {
      const { data: batches } = await serviceClient.from(BATCH_TABLE).select("id,status,quality_tier,model,expected_items,processed_items,expected_cost_microusd,provider_state,created_at,completed_at").order("created_at", { ascending: false }).limit(20);
      return json(res, 200, { budget: await budgetSnapshot(serviceClient), batches: batches ?? [] });
    }
    if (action === "submit-batch" || action === "generate") {
      const apiKey = geminiApiKey();
      if (process.env.SIMULATED_PLAYER_ART_GENERATION_ENABLED !== "true" || !apiKey) return json(res, 503, { error: "Production artwork generation is not enabled." });
      const jobs = (Array.isArray(req.body?.jobs) ? req.body.jobs : [req.body?.job]).filter(Boolean);
      if (!jobs.length) return json(res, 400, { error: "At least one artwork job is required." });
      const ai = new GoogleGenAI({ apiKey });
      return json(res, 202, await submitBatch(serviceClient, ai, jobs, safeTier(req.body?.qualityTier)));
    }
    if (action === "sync-batch") {
      const apiKey = geminiApiKey();
      if (!apiKey) return json(res, 503, { error: "Gemini is not configured." });
      const batchId = String(req.body?.batchId || "");
      if (!/^[0-9a-f-]{36}$/i.test(batchId)) return json(res, 400, { error: "A valid batch ID is required." });
      const ai = new GoogleGenAI({ apiKey });
      return json(res, 200, await syncBatch(serviceClient, publicClient, ai, batchId));
    }
    if (action === "sync-open-batches") {
      const apiKey = geminiApiKey();
      if (!apiKey) return json(res, 503, { error: "Gemini is not configured." });
      const { data: open, error } = await serviceClient.from(BATCH_TABLE).select("id").in("status", ["submitted", "running", "processing"]).order("created_at", { ascending: true }).limit(4);
      if (error) throw new Error(`Could not find open artwork batches: ${error.message}`);
      if (!open?.length) return json(res, 200, { status: "idle", budget: await budgetSnapshot(serviceClient) });
      const ai = new GoogleGenAI({ apiKey });
      const results = [];
      for (const batch of open) results.push(await syncBatch(serviceClient, publicClient, ai, String(batch.id)));
      return json(res, 200, { status: "checked", results, budget: await budgetSnapshot(serviceClient) });
    }
    if (action === "approve" || action === "reject") {
      const input = req.body?.job, job = normalizeJob(input), match = rowKey(job);
      const { data: pending } = await serviceClient.from(TABLE).select("quality_report").match(match).eq("status", "pending_review").maybeSingle();
      if (!pending) return json(res, 409, { error: "Artwork is not awaiting review." });
      const submitted = req.body?.checklist && typeof req.body.checklist === "object" ? req.body.checklist : {}, checklist = Object.fromEntries(REVIEW_CHECKS.map((check) => [check, submitted[check] === true]));
      const missing = REVIEW_CHECKS.filter((check) => checklist[check] !== true);
      if (action === "approve" && missing.length) return json(res, 422, { error: "Every production visual check must pass before approval.", missingChecks: missing });
      const manual = action === "approve" ? { required: true, passed: true, reviewer: safeText(req.body?.reviewer, 80, "Ball Knower visual QA"), checklist } : { required: true, passed: false, checklist };
      const quality_report = { ...pending.quality_report ?? {}, manual };
      const patch = action === "approve" ? { status: "approved", reviewed_at: (/* @__PURE__ */ new Date()).toISOString(), rejection_reason: null, quality_report, updated_at: (/* @__PURE__ */ new Date()).toISOString() } : { status: "rejected", rejection_reason: safeText(req.body?.reason, 500, "Failed visual QA"), quality_report, updated_at: (/* @__PURE__ */ new Date()).toISOString() };
      const { data, error } = await serviceClient.from(TABLE).update(patch).match(match).eq("status", "pending_review").select("*").single();
      if (error) return json(res, 409, { error: error.message });
      return json(res, 200, manifest(publicClient, data));
    }
    return json(res, 400, { error: "Unknown artwork action." });
  } catch (error) {
    console.error("simulated-player-art-error", error?.message || error);
    return json(res, 500, { error: "Unable to process simulated player artwork.", detail: process.env.NODE_ENV === "development" ? String(error?.message || error) : void 0 });
  }
}

// soloUniverse.ts
var SOLO_TEAM_THEMES2 = [
  { name: "Albuquerque Scorpions", abbr: "ABQ", primary: "#8B2F3C", secondary: "#E4B363" },
  { name: "Anchorage Aurora", abbr: "ANC", primary: "#185C66", secondary: "#8DE1D2" },
  { name: "Austin Outlaws", abbr: "AUS", primary: "#7A2E18", secondary: "#E6A15A" },
  { name: "Birmingham Forge", abbr: "BIR", primary: "#5B1F2A", secondary: "#C9A55C" },
  { name: "Boise Mountaineers", abbr: "BOI", primary: "#16425B", secondary: "#A3C4BC" },
  { name: "Brooklyn Guardians", abbr: "BRK", primary: "#252A5A", secondary: "#D0B66A" },
  { name: "Charleston Corsairs", abbr: "CHS", primary: "#123B3A", secondary: "#D09B52" },
  { name: "Columbus Aviators", abbr: "CLB", primary: "#263C6A", secondary: "#C6D4E1" },
  { name: "Des Moines Harvesters", abbr: "DSM", primary: "#5A421B", secondary: "#E2C46D" },
  { name: "Hartford Foundry", abbr: "HFD", primary: "#30343B", secondary: "#D06B3C" },
  { name: "Honolulu Tides", abbr: "HNL", primary: "#006D77", secondary: "#F2CC8F" },
  { name: "Jersey City Knights", abbr: "JCY", primary: "#172554", secondary: "#D4AF37" },
  { name: "Louisville Stallions", abbr: "LOU", primary: "#4A1942", secondary: "#E2B96F" },
  { name: "Memphis Pharaohs", abbr: "MEM", primary: "#382C63", secondary: "#D9B44A" },
  { name: "Milwaukee Lakehawks", abbr: "MIL", primary: "#164E63", secondary: "#B8D8D8" },
  { name: "Oklahoma City Bison", abbr: "OKC", primary: "#6B2D1A", secondary: "#E0A458" },
  { name: "Omaha Stampede", abbr: "OMA", primary: "#7C2D12", secondary: "#F1C27D" },
  { name: "Orlando Orbit", abbr: "ORL", primary: "#4338CA", secondary: "#67E8F9" },
  { name: "Portland Pioneers", abbr: "POR", primary: "#14532D", secondary: "#D8B25C" },
  { name: "Raleigh Redtails", abbr: "RAL", primary: "#7F1D1D", secondary: "#E7B95E" },
  { name: "Richmond Generals", abbr: "RIC", primary: "#1E3A5F", secondary: "#B8A16A" },
  { name: "Reno Highrollers", abbr: "RNO", primary: "#3F3F46", secondary: "#D7B65D" },
  { name: "Sacramento Gold", abbr: "SAC", primary: "#4C1D95", secondary: "#F2C14E" },
  { name: "Salt Lake Summit", abbr: "SLC", primary: "#1E40AF", secondary: "#C7D2FE" },
  { name: "San Antonio Marshals", abbr: "SAT", primary: "#3F1D38", secondary: "#D8A84E" },
  { name: "San Diego Breakers", abbr: "SDG", primary: "#075985", secondary: "#FDE68A" },
  { name: "St. Louis Archers", abbr: "STL", primary: "#4C1D24", secondary: "#D8B46A" },
  { name: "Toronto Northstars", abbr: "TOR", primary: "#1E3A8A", secondary: "#E5E7EB" },
  { name: "Virginia Beach Tritons", abbr: "VBH", primary: "#0F766E", secondary: "#F0C36E" },
  { name: "Albany Empire", abbr: "ALB", primary: "#312E81", secondary: "#D5B55F" },
  { name: "El Paso Dust Devils", abbr: "ELP", primary: "#7C3A17", secondary: "#F3B562" },
  { name: "Fargo Frost", abbr: "FAR", primary: "#155E75", secondary: "#E0F2FE" }
];
var STADIUM_NAMES2 = [
  "Desert Crown Stadium",
  "Aurora Field",
  "Lone Star Grounds",
  "Ironworks Stadium",
  "Sawtooth Field",
  "Guardian Grounds",
  "Harbor Fortress",
  "Flight Deck Stadium",
  "Heartland Field",
  "Foundry Park",
  "Pacific Tide Stadium",
  "Knightfall Grounds",
  "Bluegrass Coliseum",
  "Pyramid Field",
  "Lakeshore Stadium",
  "Prairie Crown Field",
  "Stampede Grounds",
  "Orbit Park",
  "Pioneer Stadium",
  "Redtail Field",
  "Commonwealth Grounds",
  "Silver Basin Stadium",
  "Capital Gold Park",
  "Summit Field",
  "Marshal Grounds",
  "Breaker Bay Stadium",
  "Gateway Grounds",
  "Northstar Dome",
  "Triton Field",
  "Empire Stadium",
  "Sunset Mesa Park",
  "Frostline Dome"
];
var SOLO_OWNER_TEAMS2 = SOLO_TEAM_THEMES2.map((team, index) => ({
  abbr: team.abbr,
  name: team.name,
  stadium: STADIUM_NAMES2[index],
  capacity: 58e3 + index * 1937 % 19e3,
  marketValueB: Number((4.8 + index * 13 % 57 / 10).toFixed(1))
}));
var FIRST_NAMES2 = [
  "Aiden",
  "Amari",
  "Andre",
  "Ashton",
  "Blake",
  "Bryce",
  "Cameron",
  "Cedric",
  "Damon",
  "Darius",
  "Devin",
  "Eli",
  "Emmett",
  "Evan",
  "Felix",
  "Gavin",
  "Grant",
  "Isaiah",
  "Jabari",
  "Jace",
  "Jalen",
  "Jamal",
  "Jonah",
  "Jordan",
  "Kaden",
  "Kai",
  "Kendrick",
  "Khalil",
  "Landon",
  "Leo",
  "Malik",
  "Marcus",
  "Mason",
  "Micah",
  "Miles",
  "Nico",
  "Noah",
  "Owen",
  "Quentin",
  "Rashad",
  "Roman",
  "Silas",
  "Tariq",
  "Theo",
  "Tristan",
  "Tyrese",
  "Xavier",
  "Zion"
];
var LAST_NAMES2 = [
  "Aldridge",
  "Bellamy",
  "Callen",
  "Dunley",
  "Easton",
  "Fairmont",
  "Gaines",
  "Hollowell",
  "Irons",
  "Kessler",
  "Langford",
  "Mercer",
  "Norwood",
  "Oakley",
  "Pryor",
  "Quade",
  "Redvale",
  "Sterling",
  "Tolliver",
  "Underhill",
  "Voss",
  "Westfall",
  "Yardley",
  "Zeller",
  "Ashford",
  "Bexley",
  "Corwin",
  "Danner",
  "Ellery",
  "Farrow",
  "Grady",
  "Hartwell",
  "Ingram",
  "Keller",
  "Lockwood",
  "Marlowe",
  "Nash",
  "Orson",
  "Parker",
  "Quinlan",
  "Rowan",
  "Sayer",
  "Thorne",
  "Ulmer",
  "Vale",
  "Whitaker",
  "York",
  "Zane"
];
var TEAM_POSITIONS2 = [
  "QB",
  "QB",
  "QB",
  "RB",
  "RB",
  "RB",
  "RB",
  "WR",
  "WR",
  "WR",
  "WR",
  "WR",
  "WR",
  "TE",
  "TE",
  "TE",
  "LT",
  "LT",
  "RT",
  "RT",
  "LG",
  "LG",
  "RG",
  "RG",
  "C",
  "C",
  "EDGE",
  "EDGE",
  "EDGE",
  "DE",
  "DE",
  "DT",
  "DT",
  "DT",
  "NT",
  "LB",
  "LB",
  "LB",
  "LB",
  "LB",
  "LB",
  "CB",
  "CB",
  "CB",
  "CB",
  "CB",
  "CB",
  "FS",
  "FS",
  "SS",
  "SS",
  "K",
  "P"
];
var positionGroup2 = (position) => {
  if (["LT", "RT", "LG", "RG", "C", "OT", "OG"].includes(position)) return "OL";
  if (["EDGE", "DE", "DT", "NT"].includes(position)) return "DL_EDGE";
  if (["FS", "SS", "S"].includes(position)) return "S";
  return position;
};
var stableNumber2 = (value) => Array.from(value).reduce((total, character) => Math.imul(total ^ character.charCodeAt(0), 16777619), 2166136261) >>> 0;
var clampRating2 = (value) => Math.max(60, Math.min(97, Math.round(value)));
var measurementsFor2 = (position, seed) => {
  const ranges = {
    QB: [[72, 78], [205, 245]],
    RB: [[67, 73], [195, 235]],
    FB: [[69, 74], [230, 265]],
    WR: [[68, 77], [170, 225]],
    TE: [[75, 79], [240, 275]],
    LT: [[76, 81], [300, 380]],
    RT: [[76, 81], [300, 380]],
    OT: [[76, 81], [300, 380]],
    LG: [[73, 79], [295, 365]],
    RG: [[73, 79], [295, 365]],
    OG: [[73, 79], [295, 365]],
    C: [[72, 78], [290, 350]],
    EDGE: [[73, 79], [235, 285]],
    DE: [[73, 79], [255, 310]],
    DT: [[71, 77], [285, 345]],
    NT: [[71, 77], [315, 385]],
    LB: [[71, 77], [225, 270]],
    CB: [[68, 75], [170, 210]],
    S: [[69, 75], [185, 225]],
    FS: [[69, 75], [185, 225]],
    SS: [[69, 75], [195, 235]],
    K: [[68, 76], [170, 220]],
    P: [[70, 78], [185, 235]]
  };
  const [height, weight] = ranges[position] ?? ranges.WR;
  return { heightInches: height[0] + (seed >>> 8) % (height[1] - height[0] + 1), weightLbs: weight[0] + (seed >>> 15) % (weight[1] - weight[0] + 1) };
};
var salaryFor2 = (position, overall, seed) => {
  const premium = { QB: 1.75, EDGE: 1.25, WR: 1.16, LT: 1.14, CB: 1.08, RT: 0.92, DT: 0.9, DE: 0.9, TE: 0.72, RB: 0.62, LB: 0.68, FS: 0.62, SS: 0.62, K: 0.18, P: 0.14 };
  const floor = ["K", "P"].includes(position) ? 0.8 : 1.1;
  const talent = Math.max(0, overall - 66);
  return Number(Math.max(floor, talent * talent / 48 * (premium[position] ?? 0.58) + seed % 9 * 0.12).toFixed(1));
};
var jerseyPoolFor2 = (position) => {
  if (position === "QB") return [...Array.from({ length: 20 }, (_, index) => index)];
  if (["RB", "FB", "CB", "FS", "SS", "K", "P"].includes(position)) return Array.from({ length: 50 }, (_, index) => index);
  if (position === "WR") return [...Array.from({ length: 20 }, (_, index) => index), ...Array.from({ length: 10 }, (_, index) => 80 + index)];
  if (position === "TE") return [...Array.from({ length: 10 }, (_, index) => 40 + index), ...Array.from({ length: 10 }, (_, index) => 80 + index)];
  if (["LT", "RT", "LG", "RG", "C", "OT", "OG"].includes(position)) return Array.from({ length: 30 }, (_, index) => 50 + index);
  if (["EDGE", "DE", "DT", "NT"].includes(position)) return [...Array.from({ length: 30 }, (_, index) => 50 + index), ...Array.from({ length: 10 }, (_, index) => 90 + index)];
  if (position === "LB") return [...Array.from({ length: 20 }, (_, index) => 40 + index), ...Array.from({ length: 10 }, (_, index) => 90 + index)];
  return Array.from({ length: 100 }, (_, index) => index);
};
var jerseyFor2 = (position, seed, used) => {
  const pool = jerseyPoolFor2(position);
  const offset = seed % pool.length;
  for (let index = 0; index < pool.length; index += 1) {
    const candidate = pool[(index + offset) % pool.length];
    if (!used.has(candidate)) {
      used.add(candidate);
      return candidate;
    }
  }
  const fallback = Array.from({ length: 100 }, (_, index) => index).find((number) => !used.has(number)) ?? pool[offset];
  used.add(fallback);
  return fallback;
};
var attributesFor2 = (position, overall, seed) => {
  const variation = (offset) => clampRating2(overall + (seed >>> offset) % 9 - 4);
  return {
    athleticism: variation(1),
    footballIQ: variation(5),
    passing: position === "QB" ? variation(8) : void 0,
    rushing: ["QB", "RB"].includes(position) ? variation(10) : void 0,
    receiving: ["RB", "WR", "TE"].includes(position) ? variation(12) : void 0,
    passBlocking: ["LT", "RT", "LG", "RG", "C"].includes(position) ? variation(14) : void 0,
    runBlocking: ["LT", "RT", "LG", "RG", "C", "TE"].includes(position) ? variation(16) : void 0,
    passRush: ["EDGE", "DE", "DT", "NT", "LB"].includes(position) ? variation(18) : void 0,
    runDefense: ["EDGE", "DE", "DT", "NT", "LB", "FS", "SS"].includes(position) ? variation(20) : void 0,
    coverage: ["LB", "CB", "FS", "SS"].includes(position) ? variation(22) : void 0,
    kicking: ["K", "P"].includes(position) ? variation(24) : void 0
  };
};
var buildSoloPlayers2 = () => {
  let globalIndex = 0;
  return SOLO_TEAM_THEMES2.flatMap((team, teamIndex) => {
    const depthByGroup = /* @__PURE__ */ new Map();
    const usedJerseyNumbers = /* @__PURE__ */ new Set();
    return TEAM_POSITIONS2.map((position, rosterIndex) => {
      const group = positionGroup2(position);
      const depth = depthByGroup.get(group) ?? 0;
      depthByGroup.set(group, depth + 1);
      const seed = stableNumber2(`${team.abbr}:${position}:${rosterIndex}:ball-knower-league`);
      const teamStrength = teamIndex * 7 % 9 - 4;
      const depthPenalty = Math.min(12, depth * 2);
      const overall = clampRating2(84 + teamStrength - depthPenalty + seed % 9 - 4);
      const firstName = FIRST_NAMES2[globalIndex % FIRST_NAMES2.length];
      const lastName = LAST_NAMES2[Math.floor(globalIndex / FIRST_NAMES2.length) % LAST_NAMES2.length];
      const name = `${firstName} ${lastName}`;
      const id = `solo-${team.abbr.toLowerCase()}-${String(rosterIndex + 1).padStart(2, "0")}`;
      const measurements = measurementsFor2(position, seed);
      globalIndex += 1;
      return {
        id,
        playerId: id,
        teamId: team.abbr,
        team: team.abbr,
        teamAbbreviation: team.abbr,
        teamCity: team.name.split(" ").slice(0, -1).join(" "),
        teamName: team.name,
        conference: teamIndex < 16 ? "AFC" : "NFC",
        division: ["East", "North", "South", "West"][Math.floor(teamIndex % 16 / 4)],
        name,
        firstName,
        lastName,
        fullName: name,
        position,
        positionGroup: group,
        jerseyNumber: jerseyFor2(position, seed, usedJerseyNumbers),
        age: 21 + seed % 14,
        experience: seed % 12,
        ...measurements,
        durability: 70 + (seed >>> 23) % 28,
        starter: depth === 0 || group === "WR" && depth < 3 || ["OL", "DL_EDGE", "LB", "CB", "S"].includes(group) && depth < 4,
        active: true,
        isFreeAgent: false,
        rosterSeason: 1,
        ovr: overall,
        overall,
        overallRating: overall,
        ratingSource: "Ball Knower simulated universe",
        ratingSeason: "SIM-1",
        ratingStatus: "EDITORIAL",
        salary: salaryFor2(position, overall, seed),
        salaryType: "estimated",
        salarySource: "Ball Knower simulation model",
        archetype: "Simulated pro player",
        attributes: attributesFor2(position, overall, seed)
      };
    });
  });
};
var SOLO_CREATOR_EASTER_EGG2 = {
  id: "bk-001-eli-rodriguez",
  playerId: "bk-001-eli-rodriguez",
  teamId: "JCY",
  team: "JCY",
  teamAbbreviation: "JCY",
  teamCity: "Jersey City",
  teamName: "Jersey City Knights",
  conference: "AFC",
  division: "East",
  name: "Eli Rodriguez",
  firstName: "Eli",
  lastName: "Rodriguez",
  fullName: "Eli Rodriguez",
  position: "WR",
  positionGroup: "WR",
  jerseyNumber: 11,
  age: 30,
  experience: 10,
  heightInches: 69,
  weightLbs: 190,
  fortyYardDash: 4.36,
  durability: 96,
  starter: true,
  active: true,
  isFreeAgent: false,
  rosterSeason: 1,
  ovr: 85,
  overall: 85,
  overallRating: 85,
  ratingSource: "Ball Knower simulated universe",
  ratingSeason: "SIM-1",
  ratingStatus: "EDITORIAL",
  salary: 14.8,
  salaryType: "estimated",
  salarySource: "Ball Knower simulation model",
  archetype: "Elite slot route runner \xB7 4.36 forty \xB7 very durable",
  speed: 96,
  awareness: 93,
  attributes: { athleticism: 91, footballIQ: 94, receiving: 95 }
};
var BASE_SOLO_PLAYERS_DATABASE2 = buildSoloPlayers2();
var eliRosterSlot2 = BASE_SOLO_PLAYERS_DATABASE2.findIndex((player) => player.team === "JCY" && player.position === "WR" && !player.starter);
if (eliRosterSlot2 >= 0) BASE_SOLO_PLAYERS_DATABASE2[eliRosterSlot2] = SOLO_CREATOR_EASTER_EGG2;
var SOLO_PLAYERS_DATABASE2 = BASE_SOLO_PLAYERS_DATABASE2;
var SOLO_PLAYER_BY_ID2 = new Map(SOLO_PLAYERS_DATABASE2.map((player) => [player.id, player]));

// solo/appearance.ts
var FACE_COUNT2 = 9;
var HAIR_COUNT2 = 10;
var FACIAL_HAIR_COUNT2 = 6;
var EYE_BLACK_COUNT2 = 4;
var CREATOR_EASTER_EGG_ID2 = "bk-001-eli-rodriguez";
function appearanceSeed2(id) {
  let hash = 2166136261;
  for (const c of id) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
  return hash >>> 0;
}
var chooseBuild2 = (position, seed) => {
  if (["LT", "RT", "LG", "RG", "C", "OT", "OG", "NT"].includes(position)) return seed % 4 === 0 ? "power" : "heavy";
  if (["DT", "DE", "EDGE", "LB", "FB", "TE"].includes(position)) return seed % 3 === 0 ? "power" : "athletic";
  if (["RB", "SS", "FS", "S", "QB"].includes(position)) return seed % 4 === 0 ? "power" : "athletic";
  return seed % 5 === 0 ? "athletic" : "lean";
};
var tattooCoverageFor2 = (seed) => {
  if (seed % 2 !== 0) return "none";
  const pool = ["minimal", "upper-arm", "forearm", "half-sleeve", "full-sleeve", "both-arms"];
  return pool[(seed >>> 5) % pool.length];
};
var tattooStyleFor2 = (seed) => ["blackwork", "geometric", "script", "traditional", "mixed"][(seed >>> 9) % 5];
function defaultAppearance2(player) {
  const seed = appearanceSeed2(player.id), number = player.jerseyNumber;
  if (player.id === CREATOR_EASTER_EGG_ID2) return { version: 3, face: 5, hair: 2, facialHair: 4, eyeBlack: 1, build: "athletic", number: 11, sleeves: "none", gloves: "dark", tattooCoverage: "full-sleeve", tattooStyle: "mixed", tattooSeed: appearanceSeed2("eli-rodriguez-tattoos") };
  return { version: 3, face: seed % FACE_COUNT2, hair: (seed >>> 3) % HAIR_COUNT2, facialHair: (seed >>> 7) % FACIAL_HAIR_COUNT2, eyeBlack: (seed >>> 11) % EYE_BLACK_COUNT2, build: chooseBuild2(player.position, seed >>> 13), number: Number.isInteger(number) && number >= 0 && number <= 99 ? number : (seed >>> 8) % 100, sleeves: ["none", "right", "left", "both"][(seed >>> 17) % 4], gloves: ["none", "light", "dark"][(seed >>> 21) % 3], tattooCoverage: tattooCoverageFor2(seed), tattooStyle: tattooStyleFor2(seed), tattooSeed: seed >>> 1 };
}

// api/simulated-player-art-preview-control.source.ts
var APPROVED_LOCAL = /* @__PURE__ */ new Set([
  "bk-001-eli-rodriguez",
  "solo-brk-02",
  "solo-slc-02",
  "solo-brk-05",
  "solo-slc-05",
  "solo-brk-10",
  "solo-slc-10",
  "solo-brk-15",
  "solo-slc-15",
  "solo-brk-21",
  "solo-slc-20",
  "solo-brk-30",
  "solo-slc-30",
  "solo-brk-38",
  "solo-slc-38",
  "solo-brk-46",
  "solo-slc-45",
  "solo-brk-52",
  "solo-slc-52"
]);
var groupFor = (position) => {
  if (["LT", "RT", "LG", "RG", "C", "OT", "OG"].includes(position)) return "OL";
  if (["EDGE", "DE", "DT", "NT"].includes(position)) return "DL";
  if (["CB", "S", "FS", "SS"].includes(position)) return "DB";
  return position;
};
var samplePlayers = () => {
  const wanted = ["QB", "QB", "RB", "RB", "WR", "WR", "TE", "TE", "OL", "OL", "DL", "DL", "LB", "LB", "DB", "K"];
  const pool = SOLO_PLAYERS_DATABASE2.filter((player) => !APPROVED_LOCAL.has(player.id));
  const used = /* @__PURE__ */ new Set();
  return wanted.map((group) => {
    const player = pool.find((candidate) => !used.has(candidate.id) && groupFor(candidate.position) === group);
    if (!player) throw new Error(`No ${group} player is available for the preview batch.`);
    used.add(player.id);
    return player;
  });
};
async function previewControl(req, res) {
  if (process.env.VERCEL_ENV !== "preview") return res.status(404).json({ error: "Not found" });
  const adminKey = process.env.SIMULATED_PLAYER_ART_ADMIN_KEY || "";
  if (!adminKey) return res.status(503).json({ error: "Preview artwork control is not configured." });
  const action = String(req.query?.action || "status");
  req.method = "POST";
  req.headers["x-ball-knower-art-key"] = adminKey;
  if (action === "submit-sample") {
    req.body = {
      action: "submit-batch",
      qualityTier: "economy",
      jobs: samplePlayers().map((player) => ({
        playerId: player.id,
        team: player.team,
        variant: "home",
        position: player.position,
        name: player.name,
        number: player.jerseyNumber,
        age: player.age,
        heightInches: player.heightInches,
        weightLbs: player.weightLbs,
        appearance: defaultAppearance2(player),
        attempt: 3
      }))
    };
  } else if (action === "sync") req.body = { action: "sync-open-batches" };
  else req.body = { action: "status" };
  return handler(req, res);
}
export {
  previewControl as default
};
