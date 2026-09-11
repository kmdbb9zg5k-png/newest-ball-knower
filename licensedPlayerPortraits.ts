export type LicensedPlayerPortrait = {
  fileName: string;
  sourceUrl: string;
  creator: string;
  license: string;
  licenseUrl: string;
};

const normalizePlayerName = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]/g, '');

export const LICENSED_PLAYER_PORTRAITS: Record<string, LicensedPlayerPortrait> = {
  "A.J. Brown": {
    "fileName": "AJ Brown.jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:AJ_Brown.jpg",
    "creator": "Tennessee Titans",
    "license": "CC BY 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/3.0/"
  },
  "Aaron Jones Sr": {
    "fileName": "Aaron Jones WFT vs Packers OCT2021 (cropped).jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Aaron_Jones_WFT_vs_Packers_OCT2021_(cropped).jpg",
    "creator": "All-Pro Reels",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0"
  },
  "Aaron Rodgers": {
    "fileName": "AaronRodgersSteelers (cropped).jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:AaronRodgersSteelers_(cropped).jpg",
    "creator": "Cramerwiki",
    "license": "CC0",
    "licenseUrl": "http://creativecommons.org/publicdomain/zero/1.0/deed.en"
  },
  "Alec Pierce": {
    "fileName": "Alec Pierce Commanders vs Colts OCT2022 (cropped).jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Alec_Pierce_Commanders_vs_Colts_OCT2022_(cropped).jpg",
    "creator": "All-Pro Reels",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0"
  },
  "Alvin Kamara": {
    "fileName": "Alvin Kamara Sonoma 2023.jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Alvin_Kamara_Sonoma_2023.jpg",
    "creator": "TaurusEmerald",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0"
  },
  "Amon-Ra St. Brown": {
    "fileName": "Amon-Ra St. Brown.jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Amon-Ra_St._Brown.jpg",
    "creator": "Steve Cheng, Bruin Report",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0/"
  },
  "Andre Szmyt": {
    "fileName": "Andre Szmyt 2026 preseason (cropped).jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Andre_Szmyt_2026_preseason_(cropped).jpg",
    "creator": "Erik Drost",
    "license": "CC BY 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0"
  },
  "Andres Borregales": {
    "fileName": "Andres Borregales 2025.png",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Andres_Borregales_2025.png",
    "creator": "Tennessee Titans",
    "license": "CC BY 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/3.0"
  },
  "Ashton Jeanty": {
    "fileName": "Ashton Jeanty - 2025 Raiders vs Commanders (cropped).jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Ashton_Jeanty_-_2025_Raiders_vs_Commanders_(cropped).jpg",
    "creator": "All-Pro Reels from District of Columbia, USA",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0"
  },
  "Baker Mayfield": {
    "fileName": "Baker Mayfield (cropped).jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Baker_Mayfield_(cropped).jpg",
    "creator": "Erik Drost",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0"
  },
  "Bijan Robinson": {
    "fileName": "Bijan Robinson 2025.jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Bijan_Robinson_2025.jpg",
    "creator": "All-Pro Reels",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0"
  },
  "Blake Corum": {
    "fileName": "Blake Corum Spring Game.jpeg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Blake_Corum_Spring_Game.jpeg",
    "creator": "Maize & Blue Nation",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0"
  },
  "Blake Grupe": {
    "fileName": "Blake Grupe 2025.png",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Blake_Grupe_2025.png",
    "creator": "Front Office Sports",
    "license": "CC BY 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/3.0"
  },
  "Bo Nix": {
    "fileName": "Bo Nix scramble.png",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Bo_Nix_scramble.png",
    "creator": "Tennessee Titans",
    "license": "CC BY 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0"
  },
  "Brandon Aubrey": {
    "fileName": "Brandon Aubrey 9 16 2025.jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Brandon_Aubrey_9_16_2025.jpg",
    "creator": "The Dumb Zone",
    "license": "CC BY 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0"
  },
  "Breece Hall": {
    "fileName": "BreeceHall2019.jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:BreeceHall2019.jpg",
    "creator": "Daniel Hartwig",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0/"
  },
  "Brock Bowers": {
    "fileName": "Brock Bowers.jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Brock_Bowers.jpg",
    "creator": "BullDawg2021",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0/"
  },
  "Brock Purdy": {
    "fileName": "BrockPurdy2021 (cropped).jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:BrockPurdy2021_(cropped).jpg",
    "creator": "Jar-Lar",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0"
  },
  "C.J. Stroud": {
    "fileName": "CJ Stroud NFL Combine (cropped).png",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:CJ_Stroud_NFL_Combine_(cropped).png",
    "creator": "Tennessee Titans",
    "license": "CC BY 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/3.0"
  },
  "Cade Klubnik": {
    "fileName": "UNC vs Clemson 2025 - 28.jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:UNC_vs_Clemson_2025_-_28.jpg",
    "creator": "Hameltion",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0"
  },
  "Cade Otton": {
    "fileName": "Cade Otton (53988919941) (cropped).jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Cade_Otton_(53988919941)_(cropped).jpg",
    "creator": "All-Pro Reels from District of Columbia, USA",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0"
  },
  "Cairo Santos": {
    "fileName": "Cairo santos 2015 (cropped) (cropped).jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Cairo_santos_2015_(cropped)_(cropped).jpg",
    "creator": "U.S. Air National Guard Senior Airman Bruce Jenkins",
    "license": "Public domain",
    "licenseUrl": "https://creativecommons.org/publicdomain/mark/1.0/"
  },
  "Caleb Williams": {
    "fileName": "Caleb Williams (54858668366) (cropped).jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Caleb_Williams_(54858668366)_(cropped).jpg",
    "creator": "All-Pro Reels from District of Columbia, USA",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0"
  },
  "Cam Skattebo": {
    "fileName": "Cam Skattebo Jan 2019.png",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Cam_Skattebo_Jan_2019.png",
    "creator": "utrhighlightvideos",
    "license": "CC BY 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/3.0"
  },
  "Carnell Tate": {
    "fileName": "Carnell Tate 2026 (cropped).png",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Carnell_Tate_2026_(cropped).png",
    "creator": "Tennessee Titans",
    "license": "CC BY 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0"
  },
  "CeeDee Lamb": {
    "fileName": "Ceedee.jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Ceedee.jpg",
    "creator": "Addadadsadsaf123",
    "license": "CC0 1.0",
    "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/"
  },
  "Chad Ryland": {
    "fileName": "Chad Ryland 8 25 2023 (2).jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Chad_Ryland_8_25_2023_(2).jpg",
    "creator": "Tennessee Titans",
    "license": "CC BY 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/3.0"
  },
  "Chase Brown": {
    "fileName": "Chase Brown.png",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Chase_Brown.png",
    "creator": "Tennessee Titans",
    "license": "CC BY 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/3.0"
  },
  "Chase McLaughlin": {
    "fileName": "Chase McLaughlin (51402814375) (cropped).jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Chase_McLaughlin_(51402814375)_(cropped).jpg",
    "creator": "Erik Drost",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0"
  },
  "Chris Boswell": {
    "fileName": "ChrisBoswell2025.jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:ChrisBoswell2025.jpg",
    "creator": "Cramerwiki",
    "license": "CC0",
    "licenseUrl": "http://creativecommons.org/publicdomain/zero/1.0/deed.en"
  },
  "Chris Godwin Jr": {
    "fileName": "Chris Godwin (2021) (cropped).jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Chris_Godwin_(2021)_(cropped).jpg",
    "creator": "All-Pro Reels",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0"
  },
  "Chris Olave": {
    "fileName": "IX8A4137 (45339431234) (cropped).jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:IX8A4137_(45339431234)_(cropped).jpg",
    "creator": "Maize & Blue Nation",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0"
  },
  "Christian McCaffrey": {
    "fileName": "Christian McCaffrey.jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Christian_McCaffrey.jpg",
    "creator": "All-Pro Reels",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0/"
  },
  "Christian Watson": {
    "fileName": "Christian Watson - 2025 Commanders at Packers.jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Christian_Watson_-_2025_Commanders_at_Packers.jpg",
    "creator": "All-Pro Reels",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0"
  },
  "Colston Loveland": {
    "fileName": "Colston Loveland 2024.jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Colston_Loveland_2024.jpg",
    "creator": "Maize & Blue Nation",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0"
  },
  "Courtland Sutton": {
    "fileName": "Courtland Sutton Salute to Service Boot Camp (10).jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Courtland_Sutton_Salute_to_Service_Boot_Camp_(10).jpg",
    "creator": "Senior Airman Brooke Wise",
    "license": "Public domain",
    "licenseUrl": "https://creativecommons.org/publicdomain/mark/1.0/"
  },
  "D'Andre Swift": {
    "fileName": "GA VS LSU E101318 9.jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:GA_VS_LSU_E101318_9.jpg",
    "creator": "Tammy Anthony Baker, Photographer",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0"
  },
  "Dak Prescott": {
    "fileName": "Dak Prescott by Gage Skidmore.jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Dak_Prescott_by_Gage_Skidmore.jpg",
    "creator": "Gage Skidmore",
    "license": "CC BY-SA 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0"
  },
  "Dallas Goedert": {
    "fileName": "Dallas Goedert (52510560186) (cropped).jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Dallas_Goedert_(52510560186)_(cropped).jpg",
    "creator": "All-Pro Reels",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0"
  },
  "Dalton Kincaid": {
    "fileName": "Dalton Kincaid pro bowl.png",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Dalton_Kincaid_pro_bowl.png",
    "creator": "Tennessee Titans",
    "license": "CC BY 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0"
  },
  "Dalton Schultz": {
    "fileName": "Dalton Schultz.jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Dalton_Schultz.jpg",
    "creator": "All-Pro Reels",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0"
  },
  "Daniel Carlson": {
    "fileName": "Daniel Carlson Las Vegas Raiders 2021 (cropped).jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Daniel_Carlson_Las_Vegas_Raiders_2021_(cropped).jpg",
    "creator": "All-Pro Reels",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0"
  },
  "Daniel Jones": {
    "fileName": "Daniel Jones 2019 crop.jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Daniel_Jones_2019_crop.jpg",
    "creator": "AlexanderJonesi",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0"
  },
  "Davante Adams": {
    "fileName": "Davante Adams Packers vs WFT OCT2021 (cropped).jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Davante_Adams_Packers_vs_WFT_OCT2021_(cropped).jpg",
    "creator": "All-Pro Reels",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0"
  },
  "De'Von Achane": {
    "fileName": "2024 FanDuel Interview De'Von Achane (cropped).png",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:2024_FanDuel_Interview_De%27Von_Achane_(cropped).png",
    "creator": "FanDuel",
    "license": "CC BY 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/3.0"
  },
  "Derrick Henry": {
    "fileName": "Derrick Henry.jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Derrick_Henry.jpg",
    "creator": "Tennessee Titans",
    "license": "CC BY 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/3.0/"
  },
  "Deshaun Watson": {
    "fileName": "Deshaun Watson (53142891313) (cropped).jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Deshaun_Watson_(53142891313)_(cropped).jpg",
    "creator": "Erik Drost",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0"
  },
  "DeVonta Smith": {
    "fileName": "WFT at Eagles - 51771281044 (cropped).jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:WFT_at_Eagles_-_51771281044_(cropped).jpg",
    "creator": "All-Pro Reels",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0"
  },
  "DK Metcalf": {
    "fileName": "DKMetcalf2025.jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:DKMetcalf2025.jpg",
    "creator": "Cramerwiki",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0"
  },
  "Dominic Zvada": {
    "fileName": "MBN S24G01 FRESNOST-41 (cropped).jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:MBN_S24G01_FRESNOST-41_(cropped).jpg",
    "creator": "Maize & Blue Nation",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0"
  },
  "Drake London": {
    "fileName": "Drake London.jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Drake_London.jpg",
    "creator": "Atlanta Falcons",
    "license": "CC BY 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/3.0/"
  },
  "Drake Maye": {
    "fileName": "Drake Maye Patriots vs Titans NOV2024.png (section) (cropped).png",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Drake_Maye_Patriots_vs_Titans_NOV2024.png_(section)_(cropped).png",
    "creator": "Tennessee Titans",
    "license": "CC BY 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/3.0"
  },
  "Drew Lock": {
    "fileName": "Drew Lock 12 18 2023.jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Drew_Lock_12_18_2023.jpg",
    "creator": "Tennessee Titans",
    "license": "CC BY 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/3.0"
  },
  "Drew Stevens": {
    "fileName": "Drew Stevens 2026.jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Drew_Stevens_2026.jpg",
    "creator": "Arlington National Cemetery",
    "license": "Public domain",
    "licenseUrl": "https://creativecommons.org/publicdomain/mark/1.0/"
  },
  "Eddy Pineiro": {
    "fileName": "Eddy Piñeiro.JPG",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Eddy_Pi%C3%B1eiro.JPG",
    "creator": "Jeffrey Beall",
    "license": "CC BY 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0"
  },
  "Emeka Egbuka": {
    "fileName": "2025-0120 Emeka Egbuka.jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:2025-0120_Emeka_Egbuka.jpg",
    "creator": "Bobak Ha'Eri",
    "license": "CC BY 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/3.0"
  },
  "Evan McPherson": {
    "fileName": "Evan McPherson (51394980490) (cropped) (cropped).jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Evan_McPherson_(51394980490)_(cropped)_(cropped).jpg",
    "creator": "All-Pro Reels",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0"
  },
  "Fernando Mendoza": {
    "fileName": "2026-0117 Fernando Mendoza.jpeg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:2026-0117_Fernando_Mendoza.jpeg",
    "creator": "Bobak Ha'Eri",
    "license": "CC BY 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/3.0"
  },
  "Garrett Wilson": {
    "fileName": "2025 NYJ offseason - Garrett Wilson interview (cropped).png",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:2025_NYJ_offseason_-_Garrett_Wilson_interview_(cropped).png",
    "creator": "New York Jets",
    "license": "CC BY 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/3.0"
  },
  "George Kittle": {
    "fileName": "George Kittle (cropped).jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:George_Kittle_(cropped).jpg",
    "creator": "Alexander Jonesi",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0/"
  },
  "George Pickens": {
    "fileName": "George Pickens Cowboys.jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:George_Pickens_Cowboys.jpg",
    "creator": "All-Pro Reels",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0"
  },
  "Greg Dulcich": {
    "fileName": "Broncos DSC 7374 (cropped).jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Broncos_DSC_7374_(cropped).jpg",
    "creator": "U.S. Army Space and Missile Defense Command (SMDC)",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0"
  },
  "Harold Fannin Jr": {
    "fileName": "Harold Fannin Jr. 2026 Cleveland Browns training camp (cropped).jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Harold_Fannin_Jr._2026_Cleveland_Browns_training_camp_(cropped).jpg",
    "creator": "Erik Drost",
    "license": "CC BY 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0"
  },
  "Harrison Butker": {
    "fileName": "Harrison Butker in 2025 (cropped).jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Harrison_Butker_in_2025_(cropped).jpg",
    "creator": "The White House",
    "license": "Public domain",
    "licenseUrl": "https://creativecommons.org/publicdomain/mark/1.0/"
  },
  "Harrison Mevis": {
    "fileName": "Harrison Mevis 11 16 2025.jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Harrison_Mevis_11_16_2025.jpg",
    "creator": "Duke (@DukeFilmzz)",
    "license": "CC BY 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/3.0"
  },
  "Hunter Henry": {
    "fileName": "Hunter Henry.jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Hunter_Henry.jpg",
    "creator": "Jeffrey Beall",
    "license": "CC BY 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0"
  },
  "Ja'Marr Chase": {
    "fileName": "Ja'Marr Chase.jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Ja%27Marr_Chase.jpg",
    "creator": "Joe Glorioso | All-Pro Reels",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0/"
  },
  "Jadarian Price": {
    "fileName": "Jadarian Price.jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Jadarian_Price.jpg",
    "creator": "U.S. Army photo by Spc. David Poleski",
    "license": "Public domain",
    "licenseUrl": "https://creativecommons.org/publicdomain/mark/1.0/"
  },
  "Jahmyr Gibbs": {
    "fileName": "JahmyrGibbs.jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:JahmyrGibbs.jpg",
    "creator": "Ck18102006",
    "license": "CC0 1.0",
    "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/"
  },
  "Jake Ferguson": {
    "fileName": "84 Jake Ferguson (cropped).jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:84_Jake_Ferguson_(cropped).jpg",
    "creator": "Bely Medved",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0"
  },
  "Jalen Hurts": {
    "fileName": "Jalen Hurts.png",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Jalen_Hurts.png",
    "creator": "Don't Tell",
    "license": "CC BY 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/3.0/"
  },
  "James Cook III": {
    "fileName": "JamesCookProBowl2024 (cropped).jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:JamesCookProBowl2024_(cropped).jpg",
    "creator": "Tennessee Titans",
    "license": "CC BY 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/3.0"
  },
  "Jameson Williams": {
    "fileName": "Jameson Williams.png",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Jameson_Williams.png",
    "creator": "The University of Alabama",
    "license": "CC BY 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/3.0"
  },
  "Jared Goff": {
    "fileName": "Jared Goff 2022.jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Jared_Goff_2022.jpg",
    "creator": "All-Pro Reels",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0"
  },
  "Jason Myers": {
    "fileName": "Jason Myers 10 22 2023.jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Jason_Myers_10_22_2023.jpg",
    "creator": "Tennessee Titans",
    "license": "CC BY 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/3.0"
  },
  "Javonte Williams": {
    "fileName": "Javonte WIlliams 2025.jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Javonte_WIlliams_2025.jpg",
    "creator": "All-Pro Reels",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0"
  },
  "Jaxon Smith-Njigba": {
    "fileName": "Jaxon Smith-Njigba FanDuel Interview (cropped).png",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Jaxon_Smith-Njigba_FanDuel_Interview_(cropped).png",
    "creator": "FanDuel",
    "license": "CC BY 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/3.0"
  },
  "Jaxson Dart": {
    "fileName": "Jaxson Dart 2025.jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Jaxson_Dart_2025.jpg",
    "creator": "All-Pro Reels",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0"
  },
  "Jayden Daniels": {
    "fileName": "Jayden Daniels 2025.jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Jayden_Daniels_2025.jpg",
    "creator": "All-Pro Reels",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0"
  },
  "Jaylen Waddle": {
    "fileName": "Jaylen Waddle being interviewed by CBS Sports at Miami Dolphins training camp in July 2025 (cropped).jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Jaylen_Waddle_being_interviewed_by_CBS_Sports_at_Miami_Dolphins_training_camp_in_July_2025_(cropped).jpg",
    "creator": "Gatorfan252525",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0"
  },
  "Jaylen Warren": {
    "fileName": "JaylenWarren.jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:JaylenWarren.jpg",
    "creator": "Cramerwiki",
    "license": "CC0",
    "licenseUrl": "http://creativecommons.org/publicdomain/zero/1.0/deed.en"
  },
  "Joe Burrow": {
    "fileName": "Joe Burrow Bengals.jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Joe_Burrow_Bengals.jpg",
    "creator": "Alexander Jonesi",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0/"
  },
  "Joey Slye": {
    "fileName": "Joey Slye 8 14 2026.jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Joey_Slye_8_14_2026.jpg",
    "creator": "Tennessee Titans",
    "license": "CC BY 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0"
  },
  "Jonathan Taylor": {
    "fileName": "Jonathan Taylor.jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Jonathan_Taylor.jpg",
    "creator": "Brady Klain",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0/"
  },
  "Jordan Love": {
    "fileName": "2025 Commanders at Packers 135 (cropped).jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:2025_Commanders_at_Packers_135_(cropped).jpg",
    "creator": "All-Pro Reels",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0"
  },
  "Josh Allen": {
    "fileName": "Josh Allen.jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Josh_Allen.jpg",
    "creator": "Erik Drost",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0/"
  },
  "Josh Jacobs": {
    "fileName": "2025 Commanders at Packers 54 (cropped).jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:2025_Commanders_at_Packers_54_(cropped).jpg",
    "creator": "All-Pro Reels",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0"
  },
  "Justin Herbert": {
    "fileName": "Justin Herbert presnap against the Washington Commanders.jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Justin_Herbert_presnap_against_the_Washington_Commanders.jpg",
    "creator": "All-Pro Reels",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0"
  },
  "Justin Jefferson": {
    "fileName": "Justin Jefferson Commanders vs Vikings NOV2022.jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Justin_Jefferson_Commanders_vs_Vikings_NOV2022.jpg",
    "creator": "All-Pro Reels",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0/"
  },
  "Juwan Johnson": {
    "fileName": "SaintsGame (51584966166) (cropped).jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:SaintsGame_(51584966166)_(cropped).jpg",
    "creator": "All-Pro Reels from District of Columbia, USA",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0"
  },
  "Ka'imi Fairbairn": {
    "fileName": "Kaʻimi Fairbairn in 2026 (cropped).jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Ka%CA%BBimi_Fairbairn_in_2026_(cropped).jpg",
    "creator": "Jumpingmpjopa",
    "license": "CC0",
    "licenseUrl": "http://creativecommons.org/publicdomain/zero/1.0/deed.en"
  },
  "Kaelon Black": {
    "fileName": "2026-0117 Kaelon Black.jpeg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:2026-0117_Kaelon_Black.jpeg",
    "creator": "Bobak Ha'Eri",
    "license": "CC BY 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/3.0"
  },
  "Kenyon Sadiq": {
    "fileName": "2025-0723 Kenyon Sadiq.jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:2025-0723_Kenyon_Sadiq.jpg",
    "creator": "Bobak Ha'Eri",
    "license": "CC BY 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/3.0"
  },
  "Kyle McCord": {
    "fileName": "Kyle McCord throws the football during practice 02.jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Kyle_McCord_throws_the_football_during_practice_02.jpg",
    "creator": "Kiran891",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0"
  },
  "Kyle Pitts Sr": {
    "fileName": "Kyle Pitts 2025.jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Kyle_Pitts_2025.jpg",
    "creator": "All-Pro Reels",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0"
  },
  "Kyler Murray": {
    "fileName": "Kyler Murray in huddle (50369475187) (cropped) (cropped).jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Kyler_Murray_in_huddle_(50369475187)_(cropped)_(cropped).jpg",
    "creator": "All-Pro Reels",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0"
  },
  "Kyren Williams": {
    "fileName": "2025 FanDuel Super Bowl LIX Winner Poll - Kyren Williams (cropped).png",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:2025_FanDuel_Super_Bowl_LIX_Winner_Poll_-_Kyren_Williams_(cropped).png",
    "creator": "FanDuel",
    "license": "CC BY 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/3.0"
  },
  "Lamar Jackson": {
    "fileName": "Lamar Jackson 2021.jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Lamar_Jackson_2021.jpg",
    "creator": "All-Pro Reels",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0/"
  },
  "Mac Jones": {
    "fileName": "Mac 1237 (1) (2).jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Mac_1237_(1)_(2).jpg",
    "creator": "Jeffhoffman2001",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0"
  },
  "Makai Lemon": {
    "fileName": "2025-0724 Makai Lemon (cropped).jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:2025-0724_Makai_Lemon_(cropped).jpg",
    "creator": "Bobak Ha'Eri",
    "license": "CC BY 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/3.0"
  },
  "Malik Nabers": {
    "fileName": "Malik Nabers Giants week 1 2025.jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Malik_Nabers_Giants_week_1_2025.jpg",
    "creator": "All-Pro Reels",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0/"
  },
  "Malik Willis": {
    "fileName": "Malik Willis interview.jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Malik_Willis_interview.jpg",
    "creator": "Tennessee Titans",
    "license": "CC BY 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/3.0"
  },
  "MarShawn Lloyd": {
    "fileName": "MarShawn Lloyd.jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:MarShawn_Lloyd.jpg",
    "creator": "Gamecock Central",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0"
  },
  "Matt Gay": {
    "fileName": "Matt Gay - 2025 Commanders at Chargers.jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Matt_Gay_-_2025_Commanders_at_Chargers.jpg",
    "creator": "All-Pro Reels",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0"
  },
  "Michael Mayer": {
    "fileName": "2023 NFL ProCamp (1) (cropped).jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:2023_NFL_ProCamp_(1)_(cropped).jpg",
    "creator": "Airman 1st Class Jordan McCoy",
    "license": "Public domain",
    "licenseUrl": "https://creativecommons.org/publicdomain/mark/1.0/"
  },
  "Nate Boerkircher": {
    "fileName": "2022 FB UM vs Nebraska027 (52499830460) (cropped).jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:2022_FB_UM_vs_Nebraska027_(52499830460)_(cropped).jpg",
    "creator": "Maize & Blue Nation",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0"
  },
  "Nick Folk": {
    "fileName": "Nick Folk Media Availability 11 24 2024.jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Nick_Folk_Media_Availability_11_24_2024.jpg",
    "creator": "Tennessee Titans",
    "license": "CC BY 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/3.0"
  },
  "Nico Collins": {
    "fileName": "Nico Collins 2019.jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Nico_Collins_2019.jpg",
    "creator": "Maize & Blue Nation",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0"
  },
  "Patrick Mahomes": {
    "fileName": "Patrick Mahomes TTU.JPG",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Patrick_Mahomes_TTU.JPG",
    "creator": "Christian M. Mericle",
    "license": "CC BY 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/3.0/"
  },
  "Puka Nacua": {
    "fileName": "Puka Nacua FanDuel Interview (cropped).png",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Puka_Nacua_FanDuel_Interview_(cropped).png",
    "creator": "FanDuel",
    "license": "CC BY 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/3.0"
  },
  "Quinshon Judkins": {
    "fileName": "2025-0120 Quinshon Judkins.jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:2025-0120_Quinshon_Judkins.jpg",
    "creator": "Bobak Ha'Eri",
    "license": "CC BY 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/3.0"
  },
  "Rachaad White": {
    "fileName": "Buccaneers RB Rachaad White - Front Office Sports Interview.png",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Buccaneers_RB_Rachaad_White_-_Front_Office_Sports_Interview.png",
    "creator": "Front Office Sports",
    "license": "CC BY 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/3.0"
  },
  "Rashee Rice": {
    "fileName": "Rashee Rice (55090108907) (cropped).jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Rashee_Rice_(55090108907)_(cropped).jpg",
    "creator": "All-Pro Reels from District of Columbia, USA",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0"
  },
  "Rhamondre Stevenson": {
    "fileName": "Rhamondre Stevenson Jan 2019.png",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Rhamondre_Stevenson_Jan_2019.png",
    "creator": "utrhighlightvideos",
    "license": "CC BY 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/3.0"
  },
  "Rico Dowdle": {
    "fileName": "Rico Dowdle.jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Rico_Dowdle.jpg",
    "creator": "Gamecock Central",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0"
  },
  "Riley Nowakowski": {
    "fileName": "2026-0117 Riley Nowakowski.jpeg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:2026-0117_Riley_Nowakowski.jpeg",
    "creator": "Bobak Ha'Eri",
    "license": "CC BY 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/3.0"
  },
  "Riley Patterson": {
    "fileName": "6 Patterson.jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:6_Patterson.jpg",
    "creator": "Atlanta Falcons",
    "license": "CC BY 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/3.0"
  },
  "Rome Odunze": {
    "fileName": "2024-0106-Rome Odunze.jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:2024-0106-Rome_Odunze.jpg",
    "creator": "Bobak Ha'Eri",
    "license": "CC BY 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/3.0"
  },
  "Sam Darnold": {
    "fileName": "Seattle Seahawks Super Bowl LX parade - 16 (Sam Darnold crop).jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Seattle_Seahawks_Super_Bowl_LX_parade_-_16_(Sam_Darnold_crop).jpg",
    "creator": "SounderBruce",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0"
  },
  "Sam Howell": {
    "fileName": "Sam Howell 2022 - 3 (cropped).jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Sam_Howell_2022_-_3_(cropped).jpg",
    "creator": "All-Pro Reels from District of Columbia, USA",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0"
  },
  "Sam LaPorta": {
    "fileName": "SamLaPorta.jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:SamLaPorta.jpg",
    "creator": "Maize & Blue Nation",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0"
  },
  "Saquon Barkley": {
    "fileName": "Saquon Barkley.jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Saquon_Barkley.jpg",
    "creator": "Chris Spon / Chris Sponagle",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0/"
  },
  "Terry McLaurin": {
    "fileName": "Commanders vs. Giants 2025 Terry McLaurin.jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Commanders_vs._Giants_2025_Terry_McLaurin.jpg",
    "creator": "All-Pro Reels",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0"
  },
  "Tetairoa McMillan": {
    "fileName": "Tetairoa McMillan Super Bowl LX 2026.png",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Tetairoa_McMillan_Super_Bowl_LX_2026.png",
    "creator": "MMG",
    "license": "CC BY 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0"
  },
  "Travis Etienne Jr": {
    "fileName": "Travis Etienne.jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Travis_Etienne.jpg",
    "creator": "Gamecock Central",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0"
  },
  "Travis Kelce": {
    "fileName": "Travis Kelce in the Oval Office of the White House on June 5, 2023 - P20230605AS-0902 (cropped).jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Travis_Kelce_in_the_Oval_Office_of_the_White_House_on_June_5%2C_2023_-_P20230605AS-0902_(cropped).jpg",
    "creator": "Adam Schultz",
    "license": "Public domain",
    "licenseUrl": "https://creativecommons.org/publicdomain/mark/1.0/"
  },
  "Trevor Lawrence": {
    "fileName": "Trevor Lawrence (52377887812) (cropped).jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Trevor_Lawrence_(52377887812)_(cropped).jpg",
    "creator": "All-Pro Reels",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0"
  },
  "Trey McBride": {
    "fileName": "2024 FanDuel Interview Trey McBride (cropped).png",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:2024_FanDuel_Interview_Trey_McBride_(cropped).png",
    "creator": "FanDuel",
    "license": "CC BY 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/3.0/"
  },
  "Tua Tagovailoa": {
    "fileName": "Tua Tagovailoa Miami Dolphins at New Orleans Saints 2021 (cropped).jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Tua_Tagovailoa_Miami_Dolphins_at_New_Orleans_Saints_2021_(cropped).jpg",
    "creator": "CCS Pictures",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0"
  },
  "Tucker Kraft": {
    "fileName": "Tucker Kraft (tight end) at Fisher House in Milwaukee during Green Bay Packers Tailgate Tour stop on April 9, 2025 (54441676575) (1).jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Tucker_Kraft_(tight_end)_at_Fisher_House_in_Milwaukee_during_Green_Bay_Packers_Tailgate_Tour_stop_on_April_9%2C_2025_(54441676575)_(1).jpg",
    "creator": "Milwaukee VA Medical Center",
    "license": "Public domain",
    "licenseUrl": "https://creativecommons.org/publicdomain/mark/1.0/"
  },
  "Tyler Bass": {
    "fileName": "Tyler Bass (51528385837) (cropped).jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Tyler_Bass_(51528385837)_(cropped).jpg",
    "creator": "All-Pro Reels from District of Columbia, USA",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0"
  },
  "Tyler Shough": {
    "fileName": "TylerShough2.png",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:TylerShough2.png",
    "creator": "Tennessee Titans",
    "license": "CC BY 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/3.0"
  },
  "Tyler Warren": {
    "fileName": "Tyler Warren pro bowl.png",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Tyler_Warren_pro_bowl.png",
    "creator": "Tennessee Titans",
    "license": "CC BY 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0"
  },
  "Wan'Dale Robinson": {
    "fileName": "Wan'Dale Robinson (cropped).jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Wan%27Dale_Robinson_(cropped).jpg",
    "creator": "All-Pro Reels",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0"
  },
  "Wil Lutz": {
    "fileName": "Wil Lutz.png",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Wil_Lutz.png",
    "creator": "Tennessee Titans",
    "license": "CC BY 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/3.0"
  },
  "Will Reichard": {
    "fileName": "Will Reichard Graduation.png",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Will_Reichard_Graduation.png",
    "creator": "The University of Alabama",
    "license": "CC BY 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/3.0"
  },
  "Xavier Worthy": {
    "fileName": "Xavier Worthy Chiefs Training Camp 2025 (cropped).jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Xavier_Worthy_Chiefs_Training_Camp_2025_(cropped).jpg",
    "creator": "Staff Sgt. Joshua Hastings",
    "license": "Public domain",
    "licenseUrl": "https://creativecommons.org/publicdomain/mark/1.0/"
  },
  "Zay Flowers": {
    "fileName": "Zay Flowers JUL2024 (53880447586).jpg",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Zay_Flowers_JUL2024_(53880447586).jpg",
    "creator": "Maryland GovPics",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0"
  }
};

const LICENSED_BY_NORMALIZED_NAME = new Map(
  Object.entries(LICENSED_PLAYER_PORTRAITS).map(([name, portrait]) => [
    normalizePlayerName(name),
    portrait,
  ]),
);

export function getLicensedPlayerPortrait(
  playerName: string,
): LicensedPlayerPortrait | undefined {
  return LICENSED_BY_NORMALIZED_NAME.get(normalizePlayerName(playerName));
}

export function licensedPlayerPortraitUrl(
  portrait: LicensedPlayerPortrait,
  width = 160,
): string {
  const safeWidth = Math.max(64, Math.min(1024, Math.round(Number.isFinite(width) ? width : 160)));
  return `https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(portrait.fileName)}?width=${safeWidth}`;
}
