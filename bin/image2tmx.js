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
                describe: 'Defines the data format for the tilemap output. Can be csv, gzip, or zlib',
                default: 'gzip'
            })
            .options('o', {
                alias: 'outputDir',
                describe: 'The output directory to put the tilemap and tileset'
            })
            .demand(2),
    argv = yargs.argv,
    tileWidth = 0,
    tileHeight = 0,
    imagePath = '';

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
    fbase = path.basename(imagePath, fext);

fs.createReadStream(imagePath)
    .pipe(new PNG({
        filterType: 4
    }))
    .on('parsed', function() {
        var tileset = new tmx.Tileset(this, tileWidth, tileHeight);

        tileset.on('parsed', function () {
            tileset.writeImage(path.join(outDir, fbase + '-tileset.png'));

            var tilemap = new tmx.Tilemap(tileset, this);

            tilemap.on('parsed', function () {
                tilemap.writeXml(path.join(outDir, fbase + '.tmx'), tilemap.toXmlString(argv.format));
            });
        });
    });
