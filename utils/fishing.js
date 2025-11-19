const fs = require("fs");
const path = require("path");
const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");

const config = require("../config");

const { addXP, xpRequired } = require("./leveling");

const DATA_FILE = path.join(__dirname, "data", "players.json");
const PREFIX = config.PREFIX;
const COOLDOWNS = config.COOLDOWNS;

// ensure data dir & file
const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify({}));

function loadPlayers() {
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}
function savePlayers(obj) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(obj, null, 2));
}

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

const userCooldowns = {}; 

client.once("ready", () => console.log("Bot ready:", client.user.tag));

client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;
  if (!msg.content.startsWith(PREFIX)) return;

  const players = loadPlayers();
  const userId = msg.author.id;
  if (!players[userId]) players[userId] = { xp:0, level:1, coins:100, rod:"wooden", bait:5, inventory: {} };

  const args = msg.content.slice(PREFIX.length).trim().split(/\s+/);
  const cmd = args.shift().toLowerCase();

  // --- !fish
  if (cmd === "fish") {
    const now = Date.now();
    userCooldowns[userId] = userCooldowns[userId] || {};
    if (userCooldowns[userId].fish && now - userCooldowns[userId].fish < COOLDOWNS.fish) {
      const remain = Math.ceil((COOLDOWNS.fish - (now - userCooldowns[userId].fish))/1000);
      return msg.reply(`⌛ Cooldown: coba lagi dalam ${remain}s`);
    }

    if ((players[userId].bait || 0) <= 0) return msg.reply("Kamu tidak punya umpan. Beli di `!shop`.");

    userCooldowns[userId].fish = now;
    players[userId].bait -= 1;

    try {
      const result = tryCatch(players[userId].rod);
      if (!result.success) {
        savePlayers(players);
        if (result.reason === "too_strong") return msg.reply(`Ikan terlalu kuat untuk rodmu (${players[userId].rod}). Umpan terpakai.`);
        return msg.reply("Ikan kabur! Umpan terpakai.");
      }

      const key = `${result.speciesId}_${result.rarity}`;
      players[userId].inventory[key] = (players[userId].inventory[key]||0) + 1;

      const gainedXP = result.xp;
      const oldLevel = players[userId].level;
      const levelsGained = addXP(players[userId], gainedXP); 
      let milestoneMsg = "";
      for (const lvl of levelsGained) {
        const reward = config.LEVEL_MILESTONES[lvl];
        if (reward) {
          players[userId].coins = (players[userId].coins||0) + (reward.coins||0);
          if (reward.giveRod) players[userId].rod = reward.giveRod;
          milestoneMsg += `\n🎁 Milestone ${lvl}: +${reward.coins||0} coins ${reward.giveRod?('- Rod: '+reward.giveRod):''}`;
        }
      }

      savePlayers(players);

      const embed = new EmbedBuilder()
        .setTitle("🎣 Hasil Memancing")
        .addFields(
          { name: "Ikan", value: `${result.speciesName} (${result.rarity})`, inline: true },
          { name: "XP", value: `${gainedXP}`, inline: true },
          { name: "Harga Jual", value: `${result.price} coins`, inline: true }
        )
        .setFooter({ text: `Rod: ${result.rodUsed} • Umpan tersisa: ${players[userId].bait}` });

      return msg.reply({ embeds: [embed], content: milestoneMsg || undefined });
    } catch (e) {
      console.error("fish error", e);
      return msg.reply("Terjadi error saat memancing.");
    }
  }

  if (cmd === "profile") {
    const p = players[userId];
    const embed = new EmbedBuilder()
      .setTitle(`${msg.author.username} — Profile`)
      .addFields(
        { name: "Level", value: `${p.level}`, inline: true },
        { name: "XP", value: `${p.xp}/${xpRequired(p.level)}`, inline: true },
        { name: "Coins", value: `${p.coins}`, inline: true },
        { name: "Rod", value: `${p.rod}`, inline: true },
        { name: "Umpan", value: `${p.bait}`, inline: true }
      );
    return msg.reply({ embeds: [embed] });
  }

  if (cmd === "shop") {
    const rods = Object.values(config.RODS).map(r=>`${r.id} — ${r.name} — ${r.price} coins — tier ${r.tier}`).join("\n");
    return msg.reply(`**Toko**\nUmpan: ${config.BAIT_PRICE} coins\n\nPancing:\n${rods}`);
  }

  if (cmd === "buyrod") {
    const id = args[0];
    if (!id) return msg.reply("Gunakan: !buyrod <rodId>");
    const rod = config.RODS[id];
    if (!rod) return msg.reply("Pancing tidak ditemukan.");
    if ((players[userId].coins||0) < rod.price) return msg.reply("Koin tidak cukup.");
    players[userId].coins -= rod.price;
    players[userId].rod = rod.id;
    savePlayers(players);
    return msg.reply(`Berhasil membeli ${rod.name}`);
  }

  if (cmd === "buybait") {
    const n = Math.max(1, parseInt(args[0]) || 1);
    const cost = n * config.BAIT_PRICE;
    if ((players[userId].coins||0) < cost) return msg.reply("Koin tidak cukup.");
    players[userId].coins -= cost;
    players[userId].bait = (players[userId].bait||0) + n;
    savePlayers(players);
    return msg.reply(`Berhasil beli ${n} umpan.`);
  }

  if (cmd === "inventory") {
    const inv = players[userId].inventory || {};
    const lines = Object.entries(inv).map(([k,v]) => `${k} x${v}`);
    return msg.reply(lines.length ? `Inventory:\n${lines.join("\n")}` : "Inventory kosong.");
  }

  if (cmd === "sell") {
    const target = args[0];
    if (!target) return msg.reply("Gunakan: !sell <key|all> [qty]");
    if (target === "all") {
      let total = 0;
      for (const [k,v] of Object.entries(players[userId].inventory||{})) {
        const parts = k.split("_");
        const speciesId = parts[0];
        const rarityKey = parts[1];
        const species = config.SPECIES.find(s=>s.id===speciesId) || { base: 1 };
        const rarity = config.RARITIES.find(r=>r.key===rarityKey) || { priceMult: 1 };
        total += (species.base * rarity.priceMult) * v;
      }
      players[userId].inventory = {};
      players[userId].coins = (players[userId].coins||0) + Math.round(total);
      savePlayers(players);
      return msg.reply(`Semua ikan terjual seharga ${Math.round(total)} coins.`);
    } else {
      const qty = Math.max(1, parseInt(args[1]) || 1);
      const have = players[userId].inventory[target] || 0;
      if (have < qty) return msg.reply("Tidak cukup item.");
      const [speciesId, rarityKey] = target.split("_");
      const species = config.SPECIES.find(s=>s.id===speciesId) || { base: 1 };
      const rarity = config.RARITIES.find(r=>r.key===rarityKey) || { priceMult: 1 };
      const gain = Math.round((species.base * rarity.priceMult) * qty);
      players[userId].inventory[target] -= qty;
      if (players[userId].inventory[target] <= 0) delete players[userId].inventory[target];
      players[userId].coins = (players[userId].coins||0) + gain;
      savePlayers(players);
      return msg.reply(`Terjual ${qty}x ${species.name} (${rarityKey}) seharga ${gain} coins.`);
    }
  }

  if (cmd === "leaderboard") {
    const arr = Object.entries(players).map(([id, pl]) => ({ id, coins: pl.coins || 0 }));
    arr.sort((a,b)=>b.coins - a.coins);
    const top = arr.slice(0,10).map((o,i)=>`${i+1}. <@${o.id}> — ${o.coins} coins`).join("\n");
    return msg.reply(`Leaderboard:\n${top}`);
  }

  if (cmd === "daily") {
    const now = Date.now();
    userCooldowns[userId] = userCooldowns[userId]||{};
    if (userCooldowns[userId].daily && now - userCooldowns[userId].daily < COOLDOWNS.daily) {
      return msg.reply("Sudah klaim daily. Coba lagi besok.");
    }
    const reward = 100 + Math.floor(Math.random()*200);
    players[userId].coins = (players[userId].coins||0) + reward;
    userCooldowns[userId].daily = now;
    savePlayers(players);
    return msg.reply(`Klaim daily: ${reward} coins.`);
  }

  return msg.reply("Command tidak dikenal. Ketik !help");
});

client.login(config.TOKEN);
