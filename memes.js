const svg2img = require('svg2img');

async function makeMemeAsync (meme, beforeText, afterText) {
    const fs = require('fs');
    const fileData = fs.readFileSync(`./memes/${meme}.svg`, "utf8");
    const svgString = fileData
        .replace('{beforeText}', beforeText)
        .replace('{afterText}', afterText);

    
    return await new Promise((resolve, reject) => {
        svg2img(svgString, function(error, buffer) {
            if (error) {
                reject();
            } else {
            resolve(buffer);
            }
        });
    }); 
}

module.exports = {
    makeMemeAsync
};