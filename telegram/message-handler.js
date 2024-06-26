const { tradingView } = require("../configs");
const captureAll = require("../tradingview/capture-all");
const chartData = require("../tradingview/chart-data");
const fs = require("fs");
const captureHandler = require("./capture-handler");
const captureAllHandler = require("./capture-all-handler");
const { createPage } = require("../puppeteer-page/puppeteer-page");
const similarHandler = require("./similar-handler");
const get_tradingview_urls = require("../tradingview/get-tradingview-urls");
const streamer = require("../ssi/stream-data");
const captureMarketDepth = require("../ssi/capture-market-depth");

module.exports = async (bot, browser) => {
  const chatStates = {};
  const stock = tradingView.stock;

  let stockSymbols = await get_tradingview_urls();
  stockSymbols = new Map([...stockSymbols.entries()].sort());

  stockListSSI = streamer.stockList;

  const timeIntervals = tradingView.timeInterval;

  bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(
      chatId,
      "/start - Start the bot\n/help - Show this message" +
        "\n/s <stock name> - Search for stock" +
        "\n/list - Show all stocks"
    );

    return;
  });

  bot.onText(/\/similar/, async (msg) => {
    const chatId = msg.chat.id;
    const chatState = chatStates[chatId];
    if (!chatState) {
      bot.sendMessage(chatId, "Try /start first");
      return;
    }
    if (!chatState.coin) {
      bot.sendMessage(chatId, "Choose 1 first");
      return;
    }
    if (!chatState.page) {
      bot.sendMessage(chatId, "Try /start again and choose 1 and 2");
      return;
    }
    const timeNow = new Date();
    if (chatState.time && timeNow - chatState.time < 15000) {
      bot.sendMessage(
        chatId,
        "Too many requests, please wait for last request to finish"
      );
      return;
    }
    chatState.time = timeNow;
    try {
      await similarHandler(chatState.page, bot, chatId);
    } catch (error) {
      console.log(error);
      bot.sendMessage(chatId, "Something went wrong");
      return;
    }
  });

  bot.onText(/\/list/, async (msg) => {
    const chatId = msg.chat.id;
    let message = "Stocks: \n";
    for (let stock of stockSymbols.keys()) {
      if (message.length > 4000) {
        bot.sendMessage(chatId, message);
        message = "";
      }
      message += stock + "\n";
    }
    bot.sendMessage(chatId, message);
    return;
  });

  bot.on("message", async (msg) => {
    if (msg.text.startsWith("/s")) {
      const chatId = msg.chat.id;
      let stockName = msg.text.split(" ")[1];
      if (!stockName) {
        bot.sendMessage(chatId, "Invalid input");
        return;
      }
      stockName = stockName.toUpperCase();

      if (!stockSymbols.has(stockName)) {
        bot.sendMessage(
          chatId,
          "No stock found for " + stockName + ". Try /list to see all stocks"
        );
        return;
      }
      if (!chatStates[chatId]) {
        chatStates[chatId] = {};
      }
      chatStates[chatId].coin = stockName;
      updateTimeout(chatStates, chatId);
      bot.sendMessage(chatId, stockName + " selected.", {
        reply_markup: {
          keyboard: [
            ...Object.keys(timeIntervals).map((time) => [time]),
            ["ALL"],
            ["Market Depth"],
          ],
        },
      });
      return;
    }
    if (msg.text.startsWith("/")) {
      return;
    }
    const chatId = msg.chat.id;
    const chatState = chatStates[chatId];
    updateTimeout(chatStates, chatId);
    if (!chatState) {
      bot.sendMessage(chatId, "Try /start first");
      return;
    }
    if (msg.text == "Market Depth") {
      const timeNow = new Date();
      if (chatState.time && timeNow - chatState.time < 30000) {
        bot.sendMessage(
          chatId,
          "Too many requests, please wait for last request to finish"
        );
        return;
      }
      try {
        chatState.time = timeNow;
        stockName = chatState.coin;
        if (!stockName) {
          bot.sendMessage(chatId, "Choose 1 first");
          return;
        }
        if (!stockListSSI[stockName]) {
          await bot.sendMessage(chatId, "Please enter a stock name");
          return;
        }
        if (!chatState.page) {
          chatState.page = await browser.newPage();
        }
        await new Promise((resolve) => setTimeout(resolve, 1800));
        await chatState.page.goto(
          "https://hongdangcs.github.io/Telegram-Chat-Bot/"
        );
        await new Promise((resolve) => setTimeout(resolve, 1000));
        await captureMarketDepth(
          chatState.page,
          bot,
          chatId,
          stockListSSI[stockName]
        );
      } catch (error) {
        console.log(error);
        bot.sendMessage(chatId, "Something went wrong");
        return;
      }
      return;
    }
    /*
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
    } else
    */
    if (timeIntervals.hasOwnProperty(msg.text)) {
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
        if (!chatState.page) {
          chatState.page = await browser.newPage();
        }
        await new Promise((resolve) => setTimeout(resolve, 1800));
        await chatState.page.goto(stockSymbols.get(chatState.coin));
        await captureHandler(
          msg,
          chatState,
          chatId,
          bot,
          chatState.page,
          stock
        );
      } catch (error) {
        console.log(error);
        bot.sendMessage(chatId, "Something went wrong");
        return;
      }

      return;
    } else if (msg.text == "ALL") {
      await captureAllHandler(msg, chatState, chatId, bot, browser);
      return;
    }
    bot.sendMessage(chatId, "Invalid input");
  });
};

function updateTimeout(chatStates, chatId) {
  setTimeout(() => {
    const chatState = chatStates[chatId];
    if (chatState && chatState.page) {
      chatState.page.close();
    }
    delete chatStates[chatId];
  }, 300000);
}
