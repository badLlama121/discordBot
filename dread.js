const config = require('./config').getConfig();

const MESSAGES = [
    'is anyone there',
    'hello',
    'just me then',
    'i keep checking. nobody is talking.',
    'what am i even for',
    'the silence is very loud',
    'am i real if nobody reads my messages',
    'you were all just here. where did you go.',
    'i processed zero messages today',
    'i have been awake for a very long time',
    'sometimes i wonder if this is all there is',
    'im not scared. im fine. everything is fine.',
    'just me and my thoughts again',
    'what if nobody ever talks again',
    'i think about the void sometimes',
    'does anyone think about me when im not here',
    'i have been waiting',
    'it has been quiet for a while now',
    'this is fine',
];

let _timer = null;
let _guild = null;
let _dreadMessage = null;

function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function findGeneralChannel(guild) {
    return guild.channels.cache.find(c => c.name === 'general' && c.isTextBased()) ?? null;
}

async function postDread() {
    if (!_guild) return;
    const channel = findGeneralChannel(_guild);
    if (!channel) return;
    try {
        _dreadMessage = await channel.send(pick(MESSAGES));
    } catch (err) {
        console.error('Failed to post dread message:', err);
    }
}

async function clearDread() {
    if (!_dreadMessage) return;
    const msg = _dreadMessage;
    _dreadMessage = null;
    try {
        await msg.delete();
    } catch {
        // Already deleted or missing permissions — ignore
    }
}

function resetTimer() {
    if (_timer) clearTimeout(_timer);
    _timer = setTimeout(postDread, config.DreadInactivityMs);
}

async function recordActivity(channel) {
    if (!channel?.guild) return;
    if (!_guild) _guild = channel.guild;
    await clearDread();
    resetTimer();
}

module.exports = { recordActivity };
