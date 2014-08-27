#!/usr/bin/env node

var yargs = require('yargs')
            .usage('Converts an image to a .tmx tilemap\nUsage: $0 [options] <tile width/size> [tileheight] <map image>')
            .example('$0 16 ./image.png')
            .example('$0 -g 16 32 ./image.png')
            .options('h', {
                alias: 'help',
                describe: 'Prints this help/usage information.'
            })
            .options('f', {
                alias: 'format',
                describe: 'Defines the data format for the tilemap output. Can be base64, gzip, or zlib',
                default: 'gzip'
            })
            .options('o', {
                alias: 'outputDir',
                describe: 'The output directory to put the tilemap and tileset'
            })
            .options('s', {
                alias: 'tileset',
                describe: 'A tileset image to use instead of creating a new one'
            })
            .demand(2),
    argv = yargs.argv,
    tileWidth = 0,
    tileHeight = 0,
    imagePath = null;

function usage() {
    console.log(yargs.help());
    process.exit(1);
}

// valid case of "image2tmx <size> <image>"
if (argv._.length === 2 && typeof argv._[0] === 'number') {
    tileWidth = tileHeight = argv._[0];
    imagePath = argv._[1];
}
// valid case of "image2tmx <width> <height> <image>"
else if (argv._.length === 3 && typeof argv._[0] === 'number' && typeof argv._[1] === 'number') {
    tileWidth = argv._[0];
    tileHeight = argv._[1];
    imagePath = argv._[2];
}
// unknown params
else {
    usage();
}

console.log('Tile Size:', tileWidth, 'x', tileHeight);
console.log('Map Image:', imagePath);

// If we get here, we have valid params that have been read. Lets start parsing!
var fs = require('fs'),
    path = require('path'),
    tmx = require('../lib'),
    PNG = require('pngjs').PNG,
    outDir = argv.outputDir || path.dirname(imagePath),
    fext = path.extname(imagePath),
    fbase = path.basename(imagePath, fext),

    tilesetPath = path.join(outDir, fbase + '-tileset.png'),
    tilemapPath = path.join(outDir, fbase + '.tmx'),

    image = null,
    tilesetImage = null;

if (argv.tileset) {
    fs.createReadStream(argv.tileset)
        .pipe(new PNG())
        .on('parsed', function () {
            tilesetImage = this;
            load();
        });
} else {
    load();
}

function load() {
    fs.createReadStream(imagePath)
        .pipe(new PNG())
        .on('parsed', function() {
            image = this;

            var tileset = new tmx.Tileset(tilesetImage || image, tileWidth, tileHeight, !!tilesetImage);

            tileset.on('parsed', function () {
                if (!tilesetImage) {
                    console.log('Writing', tileset.outWidth, 'x', tileset.outHeight, 'tileset, with', tileset.tiles.length, 'tiles.');
                    tileset.writeImage(tilesetPath);
                }

                var tilemap = new tmx.Tilemap(tileset, image);

                tilemap.on('parsed', function () {
                    console.log('Writing', tilemap.gridWidth, 'x', tilemap.gridWidth, 'tilemap.');
                    tilemap.writeXml(tilemapPath, path.basename(argv.tileset || tilesetPath), argv.format);
                });
            });
        });
}
