// const { LEVEL_MILESTONES } = require("../config");

// function xpRequired(level) {
//   // Eksponensial ringan: base 100 * 1.25^(level-1) rounded
//   return Math.floor(100 * Math.pow(1.25, level - 1));
// }

// function addXP(player, amount) {
//   if (typeof player.xp !== "number") player.xp = 0;
//   if (typeof player.level !== "number") player.level = 1;

//   player.xp += amount;
//   const milestonesReached = [];
//   while (player.xp >= xpRequired(player.level)) {
//     player.xp -= xpRequired(player.level);
//     player.level += 1;
//     milestonesReached.push(player.level);
//     // apply milestone reward if configured will be handled by caller
//   }
//   return milestonesReached; // array of levels gained (empty if none)
// }

// module.exports = { xpRequired, addXP };
