// fishingbot/config.js
module.exports = {
  TOKEN: "MTM4MTA5MTg1NTU0NTkyNTcwMg.GDdKOk.lx7p7nZ5urX2sDGfc55PoaC7G267zzWHLzWKT0",
  PREFIX: "!",
  DATA_FILE: "./data/players.json",

  RARITIES: [
    { key: "common",    label: "Common",    chance: 55, xp: 8,  priceMult: 1,   minRodTier: 1 },
    { key: "uncommon",  label: "Uncommon",  chance: 25, xp: 18, priceMult: 2,   minRodTier: 1 },
    { key: "rare",      label: "Rare",      chance: 12, xp: 48, priceMult: 6,   minRodTier: 2 },
    { key: "epic",      label: "Epic",      chance: 6,  xp: 140,priceMult:20,  minRodTier: 2 },
    { key: "legendary", label: "Legendary", chance: 1.8,xp: 600,priceMult:80,  minRodTier: 3 },
    { key: "mythic",    label: "Mythic",    chance: 0.2,xp: 3000,priceMult:300,minRodTier: 4 }
  ],

  RODS: {
    wooden: { id: "wooden", name: "Wooden Rod", price: 200, tier: 1, success: 85, crit: 0.01, multiplier: 1 },
    fiber:  { id: "fiber",  name: "Fiber Rod",  price: 900, tier: 2, success: 92, crit: 0.04, multiplier: 1.25 },
    pro:    { id: "pro",    name: "Pro Rod",    price: 3000,tier: 3, success: 96, crit: 0.09, multiplier: 1.6 },
    mythic: { id: "mythic", name: "Mythic Rod", price:10000,tier: 4, success: 99, crit: 0.18, multiplier: 2.5 }
  },

  BAIT_PRICE: 12,
  LEVEL_MILESTONES: { 5:{coins:250,giveRod:"fiber"},10:{coins:800,giveRod:"pro"},15:{coins:2500,giveRod:"mythic"} },
  COOLDOWNS: { fish: 25*1000, daily: 24*3600*1000 },

  SPECIES: [
    { id: "nila", name: "Nila Mungil", base: 8, possibleRarities: ["common","uncommon"] },
    { id: "bandeng", name: "Bandeng Biasa", base: 30, possibleRarities: ["common","uncommon","rare"] },
    { id: "kerapu", name: "Kerapu Karang", base: 140, possibleRarities: ["rare","epic"] },
    { id: "emas", name: "Ikan Emas Legenda", base: 800, possibleRarities: ["legendary"] },
    { id: "raksasa", name: "Raksasa Laut", base: 3000, possibleRarities: ["mythic"] }
  ]
};
