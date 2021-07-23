const { Vec3 } = require("vec3");
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

// example: bt find diamond_ore
const messages = {
  LOADED: "loaded",
  FIND: "find",
  COME: "come",
  GOTO: "go-to",
  MOVE: "move",
  LIST_ITEMS: "list-items",
  DIG: "dig",
  ATTACK: "attack",
  JUMP: "jump",
  FISH: "fish",
  STOP_FISH: "stop-fish",
  FARM: "farm",
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
        await bot.waitForChunksToLoad();
        console.log("Ready!");
        break;
      }

      case messages.FIND: {
        findBlock(mcData, words);
        break;
      }

      case messages.COME: {
        goToPlayer(username, defaultMove);
        break;
      }

      case messages.GOTO: {
        bot.pathfinder.setMovements(defaultMove);
        bot.pathfinder.setGoal(
          new GoalNear(words[2], words[3], words[4], 2) // get within 2 block radius of the coords
        );
        break;
      }

      case messages.MOVE: {
        moveBot(words[2]);
        break;
      }

      case messages.JUMP: {
        bot.setControlState("jump", true);
        bot.setControlState("jump", false);
        break;
      }

      case messages.LIST_ITEMS: {
        const output = bot.inventory
          .items()
          .map((item) => (item ? `${item.name} x ${item.count}` : "(nothing)"))
          .join(", ");
        console.log(output);
        break;
      }

      case messages.DIG: {
        botDig(words);
        break;
      }

      case messages.ATTACK: {
        const entity = bot.nearestEntity();
        if (entity) {
          bot.attack(entity, true);
        } else {
          console.log("no nearby entities");
        }
        break;
      }

      case messages.FISH: {
        goFish(mcData);
        break;
      }

      case messages.STOP_FISH: {
        bot.removeListener("playerCollect", onCollectFishItem);
        break;
      }

      case messages.FARM: {
        goFarm(mcData);
        break;
      }

      default:
        break;
    }
  });
});

function findBlock(words, mcData) {
  const blockName = words[2];
  if (mcData.blocksByName[blockName] === undefined) {
    console.log(`${blockName} is not a mc block name`);
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
}

function goToPlayer(username, defaultMove) {
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
}

function moveBot(position) {
  switch (position) {
    case "forward":
      bot.setControlState("forward", true);
      break;
    case "back":
      bot.setControlState("back", true);
      break;
    case "left":
      bot.setControlState("left", true);
      break;
    case "right":
      bot.setControlState("right", true);
      break;
    case "sprint":
      bot.setControlState("sprint", true);
      break;
    case "stop":
      bot.clearControlStates();
      break;
    default:
      console.warn("only supports forward, back, left, right, sprint, stop");
      break;
  }
}

function botDig() {}

async function goFish(mcData) {
  bot.chat("I'm going fishing'");
  try {
    await bot.equip(mcData.itemsByName.fishing_rod.id, "hand");
  } catch (err) {
    bot.chat("I couldn't fish. Perhaps I need a fishing rod");
    return bot.chat(err.message);
  }
  bot.on("playerCollect", onCollectFishItem);

  try {
    await bot.fish();
  } catch (err) {
    bot.chat(err.message);
  }
}

function onCollectFishItem(player, entity) {
  if (entity.kind === "Drops" && player === bot.entity) {
    bot.removeListener("playerCollect", onCollectFishItem);
    goFish();
  }
}

async function goFarm(mcData) {
  function blockToSow() {
    return bot.findBlock({
      point: bot.entity.position,
      matching: mcData.blocksByName.farmland.id,
      maxDistance: 6,
      useExtraInfo: (block) => {
        const blockAbove = bot.blockAt(block.position.offset(0, 1, 0));
        return !blockAbove || blockAbove.type === 0;
      },
    });
  }

  function blockToHarvest() {
    return bot.findBlock({
      point: bot.entity.position,
      maxDistance: 6,
      matching: (block) => {
        return (
          block &&
          block.type === mcData.blocksByName.wheat.id &&
          block.metadata === 7
        );
      },
    });
  }
  try {
    let action = true;
    while (action) {
      const toHarvest = blockToHarvest();
      if (toHarvest) {
        await bot.dig(toHarvest);
      } else {
        action = false;
        break;
      }
    }
    action = true;
    while (action) {
      const toSow = blockToSow();
      if (toSow) {
        await bot.equip(mcData.itemsByName.wheat_seeds.id, "hand");
        await bot.placeBlock(toSow, new Vec3(0, 1, 0));
      } else {
        action = false;
        break;
      }
    }
  } catch (e) {
    console.log(e);
    bot.chat("oops, farming mistake");
  }
}
