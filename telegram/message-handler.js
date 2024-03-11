const { tradingView } = require("../configs");
const captureAll = require("../tradingview/capture-all");
const chartData = require("../tradingview/chart-data");
const fs = require("fs");

module.exports = (bot, browser) => {
  const chatStates = {};
  const stock = tradingView.stock;
  const stockSymbols = Object.keys(stock);

  const timeIntervals = tradingView.timeInterval;

  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    chatStates[chatId] = {};
    bot.sendMessage(chatId, "Choose 1", {
      reply_markup: {
        keyboard: stockSymbols.map((symbol) => [symbol]),
      },
    });
    return;
  });

  bot.on("message", async (msg) => {
    if (msg.text.startsWith("/")) {
      return;
    }
    const chatId = msg.chat.id;
    const chatState = chatStates[chatId];
    if (!chatState) {
      bot.sendMessage(chatId, "Try /start first");
      return;
    }
    if (stock.hasOwnProperty(msg.text)) {
      chatState.coin = msg.text;
      bot.sendMessage(chatId, "Choose 2", {
        reply_markup: {
          keyboard: [
            ...Object.keys(timeIntervals).map((time) => [time]),
            ["ALL"],
          ],
        },
      });
      return;
    } else if (timeIntervals.hasOwnProperty(msg.text)) {
      chatState.timeInterval = msg.text;
      const timeNow = new Date();
      if (chatState.time && timeNow - chatState.time < 30000) {
        bot.sendMessage(
          chatId,
          "Too many requests, please wait for last request to finish"
        );
        return;
      }
      chatState.time = timeNow;
      try {
        if (!chatState.coin) {
          bot.sendMessage(chatId, "Choose 1 first");
          return;
        }
        const imgName = `${chatId}_${chatState.coin}_${chatState.timeInterval}`;
        const responData = await chartData(
          browser,
          stock[chatState.coin],
          timeIntervals[chatState.timeInterval],
          imgName
        );
        let priceIncrease1 =
          100 *
          (+responData.increase1 /
            (+responData.decrease1 + +responData.increase1));
        priceIncrease1 = priceIncrease1.toFixed(2);
        let priceIncrease2 =
          100 *
          (+responData.increase2 /
            (+responData.decrease2 + +responData.increase2));
        priceIncrease2 = priceIncrease2.toFixed(2);
        let priceIncrease3 =
          100 *
          (+responData.increase3 /
            (+responData.decrease3 + +responData.increase3));
        priceIncrease3 = priceIncrease3.toFixed(2);
        bot.sendMessage(
          chatId,
          `1: ${priceIncrease1}% goes up(${responData.increase1}/${responData.decrease1})\n2: ${priceIncrease2}% goes up(${responData.increase2}/${responData.decrease2})\n3: ${priceIncrease3}% goes up(${responData.increase3}/${responData.decrease3})`
        );
        bot.sendPhoto(chatId, `./screenshots/${imgName}.png`);
        await new Promise((resolve) => setTimeout(resolve, 3000));
        // Delete the image after sending
        setTimeout(() => {
          fs.unlinkSync(`./screenshots/${imgName}.png`);
        }, 1000);
      } catch (error) {
        console.log(error);
        bot.sendMessage(chatId, "Something went wrong");
        return;
      }

      return;
    } else if (msg.text == "ALL") {
      chatState.timeInterval = msg.text;
      const timeNow = new Date();
      if (chatState.time && timeNow - chatState.time < 30000) {
        bot.sendMessage(
          chatId,
          "Too many requests, please wait for last request to finish"
        );
        return;
      }
      chatState.time = timeNow;
      try {
        if (!chatState.coin) {
          bot.sendMessage(chatId, "Choose 1 first");
          return;
        }
        const imgName = `${chatId}_${chatState.coin}_ALL`;
        await captureAll(browser, stock[chatState.coin], imgName);
        await new Promise((resolve) => setTimeout(resolve, 1200));
        bot.sendPhoto(chatId, `./screenshots/${imgName}.png`);
        await new Promise((resolve) => setTimeout(resolve, 1800));
        // Delete the image after sending
        setTimeout(() => {
          fs.unlinkSync(`./screenshots/${imgName}.png`);
        }, 1000);
      } catch (error) {
        console.log(error);
        bot.sendMessage(chatId, "Something went wrong");
        return;
      }
    }
    bot.sendMessage(chatId, "Invalid input");
  });
};
