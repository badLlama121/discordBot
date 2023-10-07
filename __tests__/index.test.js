const { Client, Message } = require('discord.js');
const bot = require('../index');

jest.mock('discord.js');

let client;
let message;

beforeEach(() => {
  client = new Client();
  message = new Message();
});

test('responds to !hello command', () => {
  message.content = '!hello';
  myBot.messageCreate(client, message);
  expect(message.reply).toHaveBeenCalledWith('Hello!');
});

test('does not respond to unknown command', () => {
  message.content = '!unknown';
  myBot.messageCreate(client, message);
  expect(message.reply).not.toHaveBeenCalled();
});
