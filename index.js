const mineflayer = require("mineflayer");
const {
  pathfinder,
  Movements,
  goals: { GoalNear },
} = require("mineflayer-pathfinder");

if (process.argv.length < 4) {
  console.log("Usage : node index.js <host> <port> [<name>] [<password>] [-v]");
  process.exit(1);
}

const options = {
  host: process.argv[2] || "localhost",
  port: parseInt(process.argv[3]),
  username: process.argv[4] || "Another Dude",
  password: process.argv[5],
};

const bot = mineflayer.createBot(options);

bot.loadPlugin(pathfinder);

console.log("bot is working and ready to serve");

// bt find diamond_ore
// bt come
// bt goto x y z
const messages = {
  LOADED: "loaded",
  FIND: "find",
  COME: "come",
  GOTO: "goto",
};

bot.once("spawn", () => {
  const mcData = require("minecraft-data")(bot.version);
  const defaultMove = new Movements(bot, mcData);

  if (process.argv.includes("-v")) {
    const mineflayerViewer = require("prismarine-viewer").mineflayer;
    mineflayerViewer(bot, { port: 3007, firstPerson: false });
  }

  bot.on("chat", async (username, message) => {
    if (username === bot.username) return;
    if (!message.startsWith("bt")) return;

    const words = message.split(" ");
    const command = words[1];

    switch (command) {
      case messages.LOADED: {
        console.log(bot.entity.position);
        await bot.waitForChunksToLoad();
        console.log("Ready!");
        break;
      }

      case messages.FIND: {
        const blockName = words[2];
        if (mcData.blocksByName[blockName] === undefined) {
          console.log(`${blockName} is not a block name`);
          return;
        }
        const ids = [mcData.blocksByName[blockName].id];

        const blocks = bot.findBlocks({
          matching: ids,
          maxDistance: 90,
          count: 10,
        });

        if (blocks.length === 0) {
          console.log(`I couldn't find any ${blockName}. Expand your search`);
          return;
        }
        console.log(
          `I found ${blocks.length}. Search here: ${blocks[0].x}, ${blocks[0].y} ${blocks[0].z}`
        );
        break;
      }

      case messages.COME: {
        const target = bot.players[username]?.entity;
        if (!target) {
          console.log("I don't see you");
          return;
        }
        const { x: playerX, y: playerY, z: playerZ } = target.position;

        bot.pathfinder.setMovements(defaultMove);
        bot.pathfinder.setGoal(
          new GoalNear(playerX, playerY, playerZ, 1) // get within this radius of the player
        );
        break;
      }

      case messages.GOTO: {
        bot.pathfinder.setMovements(defaultMove);
        bot.pathfinder.setGoal(
          new GoalNear(words[2], words[3], words[4], 2) // // get within this radius of the coords
        );
        break;
      }

      default:
        break;
    }
  });
});
