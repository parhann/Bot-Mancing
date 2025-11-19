

// const ADMIN_IDS = [
//     "985555957121679372", // ID kamu
//     "852877851581612032"  // ID admin lain (opsional)
// ];

const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const ITEMS_FILE = path.join(DATA_DIR, 'items.json');
const FISH_FILE = path.join(DATA_DIR, 'fish.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}
function saveJson(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2));
}

const items = loadJson(ITEMS_FILE);
const fishData = loadJson(FISH_FILE);
let users = loadJson(USERS_FILE);

function getUser(id) {
  if (!users.users[id]) {
    users.users[id] = {
      id,
      balance: 100,
      xp: 0,
      level: 0,
      inventory: { rods: ["rod_wood"], baits: {} },
      equippedRod: "rod_wood",
      lastFishAt: 0
    };
    saveJson(USERS_FILE, users);
  }
  return users.users[id];
}

function xpNeeded(level) {
  return Math.floor(200 * Math.pow(2.1, level));
}

function addXp(user, amount) {
  user.xp += amount;
  while (user.xp >= xpNeeded(user.level)) {
    user.xp -= xpNeeded(user.level);
    user.level++;
    user.balance += 500 * user.level;
  }
}

function rand() { return Math.random(); }

function weightedRarity(rodTier, baitBoost) {
  const base = fishData.rarityRates;
  const modifier = 1 + (rodTier - 1) * 0.07 + (baitBoost || 0);
  const rarities = Object.keys(base);
  const scores = rarities.map(r => {
    const baseVal = base[r];
    const boost = (r === 'legendary' ? 6 : (1 / (baseVal * 100 + 1))) * (modifier - 1) * 0.02;
    return Math.max(0.0001, baseVal + boost);
  });
  const sum = scores.reduce((a,b)=>a+b,0);
  const probs = scores.map(s=>s/sum);
  let p = rand();
  let acc = 0;
  for (let i=0;i<probs.length;i++){
    acc += probs[i];
    if (p <= acc) return rarities[i];
  }
  return rarities[0];
}

function findFishByRarityAndTier(rarity, rodTier) {
  const candidates = fishData.fish.filter(f => f.rarity === rarity && f.minRodTier <= rodTier);
  if (candidates.length === 0) return null;
  return candidates[Math.floor(rand() * candidates.length)];
}

function canCatchFish(fish, rodTier) {
  return fish.minRodTier <= rodTier;
}

async function handleShop(msg) {
  const lines = [];
  lines.push('=== Shop ===');
  lines.push('\n-- Rods --');
  for (const r of items.rods) {
    lines.push(`${r.id} | ${r.name} | Tier ${r.tier} | Price: ${r.price}`);
  }
  lines.push('\n-- Baits --');
  for (const b of items.baits) {
    lines.push(`${b.id} | ${b.name} | Price: ${b.price} | Boost: +${(b.effect.rarityBoost*100).toFixed(0)}%`);
  }
  msg.channel.send('```\n' + lines.join('\n') + '\n```');
}

async function handleBuy(msg, args) {
  const user = getUser(msg.author.id);
  const id = args[0];
  if (!id) return msg.reply('Gunakan: !buy <item_id>');
  const rod = items.rods.find(r=>r.id===id);
  const bait = items.baits.find(b=>b.id===id);
  if (rod) {
    if (user.balance < rod.price) return msg.reply('Saldo tidak cukup.');
    if (user.inventory.rods.includes(rod.id)) return msg.reply('Sudah punya rod ini.');
    user.balance -= rod.price;
    user.inventory.rods.push(rod.id);
    saveJson(USERS_FILE, users);
    return msg.reply(`Berhasil membeli ${rod.name}.`);
  }
  if (bait) {
    if (user.balance < bait.price) return msg.reply('Saldo tidak cukup.');
    user.balance -= bait.price;
    user.inventory.baits[bait.id] = (user.inventory.baits[bait.id] || 0) + 1;
    saveJson(USERS_FILE, users);
    return msg.reply(`Berhasil membeli ${bait.name}.`);
  }
  return msg.reply('Item tidak ditemukan.');
}

async function handleEquip(msg, args) {
  const user = getUser(msg.author.id);
  const id = args[0];
  if (!id) return msg.reply('Gunakan: !equip <rod_id>');
  if (!user.inventory.rods.includes(id)) return msg.reply('Kamu tidak punya rod itu.');
  user.equippedRod = id;
  saveJson(USERS_FILE, users);
  return msg.reply(`Menggunakan ${id}.`);
}

async function handleProfile(msg) {
  const user = getUser(msg.author.id);
  const equippedRod = items.rods.find(r=>r.id===user.equippedRod) || items.rods[0];
  const invRods = user.inventory.rods.map(id=>{ const r=items.rods.find(x=>x.id===id); return r? r.name:id; }).join(', ');
  const baits = Object.entries(user.inventory.baits).map(([id,c])=>`${id} x${c}`).join(', ') || 'Kosong';
  const text = `Profile ${msg.author.username}\nLevel: ${user.level} (XP: ${user.xp}/${xpNeeded(user.level)})\nBalance: ${user.balance}\nEquipped rod: ${equippedRod.name} (Tier ${equippedRod.tier})\nRods: ${invRods}\nBaits: ${baits}`;
  msg.channel.send('```\n' + text + '\n```');
}

async function handleFish(msg, args) {
  const user = getUser(msg.author.id);
  const now = Date.now();
  const COOLDOWN = 25 * 1000; 
  if (now - user.lastFishAt < COOLDOWN) return msg.reply('Sedang cooldown, tunggu beberapa detik.');

  const equippedRod = items.rods.find(r=>r.id===user.equippedRod);
  const rodTier = equippedRod ? equippedRod.tier : 1;

  let baitBoost = 0;
  let usedBait = null;
  if (args && args[0]) {
    const baitId = args[0];
    const bait = items.baits.find(b=>b.id===baitId);
    if (bait && user.inventory.baits[bait.id] > 0) {
      user.inventory.baits[bait.id] -= 1;
      baitBoost = bait.effect.rarityBoost;
      usedBait = bait;
    }
  }

  user.lastFishAt = now;

  const rarity = weightedRarity(rodTier, baitBoost);
  const fish = findFishByRarityAndTier(rarity, rodTier);
  if (!fish) {
    const fallback = findFishByRarityAndTier('common', rodTier);
    if (!fallback) return msg.reply('Sepertinya tidak ada ikan yang bisa ditangkap dengan rodmu.');
    msg.channel.send(`${msg.author.username}... Kamu menarik sesuatu tapi putus! Namun kamu berhasil mendapatkan ${fallback.name} (common).`);
    addXp(user, 3); 
    saveJson(USERS_FILE, users);
    return;
  }

  user.balance += fish.value;
  // XP: common 1-3, uncommon 3-8, rare 8-20, epic 30-80, legendary 150-400 but legendary extremely rare
  const xpTable = { common: [1,3], uncommon: [3,8], rare: [8,20], epic: [30,80], legendary: [150,400] };
  const [minXp,maxXp] = xpTable[fish.rarity] || [1,3];
  const xpGain = Math.max(1, Math.floor((Math.random() * (maxXp-minXp+1) + minXp) * 0.2));
  addXp(user, xpGain);

  saveJson(USERS_FILE, users);

  let reply = `${msg.author.username} menangkap **${fish.name}** (rarity: ${fish.rarity}) senilai ${fish.value} koin. XP +${xpGain}.`;
  if (usedBait) reply += ` (menggunakan ${usedBait.name})`;
  msg.channel.send(reply);
}

// Boot the bot
const token = process.env.BOT_TOKEN || 'token dsini jg';
if (!token || token === 'token disini ya zan') {
}

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
client.once('ready', ()=>{
  console.log('Bot ready');
});

client.on('messageCreate', async (msg)=>{
  if (msg.author.bot) return;
  const prefix = '!';
  if (!msg.content.startsWith(prefix)) return;
  const [cmd, ...args] = msg.content.slice(prefix.length).trim().split(/\s+/);
  try {
    if (cmd === 'shop') await handleShop(msg);
    else if (cmd === 'buy') await handleBuy(msg, args);
    else if (cmd === 'equip') await handleEquip(msg, args);
    else if (cmd === 'profile') await handleProfile(msg);
    else if (cmd === 'fish') await handleFish(msg, args);
    else if (cmd === 'help') {
      msg.channel.send('```Hanya ada Command Ini Y kont :!shop, !buy <id>, !equip <rod_id>, !profile, !fish [bait_id]```');
    }
  } catch (e) {
    console.error(e);
    msg.reply('Terjadi error saat menjalankan command.');
  }
          var ADMIN_IDS = ["985555957121679372"]; 
          var ADMIN_IDS = ["686126275441721355"]; 
          var ADMIN_IDS = ["852877851581612032"];
          
        function isAdmin(id) {
            return ADMIN_IDS.includes(id);
        }

        // !addmoney <userID> <jumlah>
        if (cmd === "addmoney") {
            if (!isAdmin(msg.author.id))
                return msg.reply("Kamu tidak punya izin (Admin only).");

            const userId = args[0];
            const amount = parseInt(args[1]);

            if (!userId || isNaN(amount))
                return msg.reply("Gunakan: !addmoney <userID> <jumlah>");

            const target = getUser(userId);
            target.balance += amount;

            saveJson(USERS_FILE, users);
            return msg.reply(`Berhasil menambahkan ${amount} ke user ${userId}.`);
        }

        // !addlevel <userID> <jumlah>
        if (cmd === "addlevel") {
            if (!isAdmin(msg.author.id))
                return msg.reply("Kamu tidak punya izin (Admin only).");

            const userId = args[0];
            const amount = parseInt(args[1]);

            if (!userId || isNaN(amount))
                return msg.reply("Gunakan: !addlevel <userID> <jumlah_level>");

            const target = getUser(userId);
            for (let i = 0; i < amount; i++) {
                target.level++;
                target.balance += 500 * target.level; // reward default
            }

            saveJson(USERS_FILE, users);
            return msg.reply(`Berhasil menambahkan ${amount} level ke user ${userId}.`);
        }

});

client.login(token);

// === NOTES ===
// - This is a basic prototype using JSON files as storage. For multi-server or concurrency use a real DB (SQLite, Postgres, etc.).
// - Leveling is intentionally slow: XP gains per catch are scaled down, XP curve grows quickly, and there's a cooldown.
// - Rods have tiers; only fish with minRodTier <= rod.tier can be caught. That restricts early players from getting top fish.
// - Rarity probabilities are in data/fish.json -> rarityRates. You can tweak those numbers.
// - Add more unique fish to data/fish.json to expand variety.
// - To run: npm install, set env BOT_TOKEN, and run `node bot.js`.
