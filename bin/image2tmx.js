#!/usr/bin/env node

var glob = require('glob'),
    async = require('async'),
    yargs = require('yargs')
            .usage('Converts an image to a .tmx tilemap\nUsage: $0 [options] <tile width/size> [tileheight] <map image(s)>')
            .example('$0 16 ./image.png')
            .example('$0 -g 16 32 ./image.png')
            .example('$0 16 "./{cave,dungeon}*.png"')
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
                alias: 'output-dir',
                describe: 'The output directory to put the tilemap and tileset'
            })
            .options('s', {
                alias: 'tileset',
                describe: 'A tileset image to use instead of creating a new one'
            })
            .options('c', {
                alias: 'common-tileset',
                describe: 'Use a single tileset for all the images we convert'
            })
            .demand(2),
    argv = yargs.argv,
    tw = 0,
    th = 0,
    imgPath = null;

function usage() {
    console.log(yargs.help());
    process.exit(1);
}

// valid case of "image2tmx <size> <image>"
if (argv._.length === 2 && typeof argv._[0] === 'number') {
    tw = th = argv._[0];
    imgPath = argv._[1];
}
// valid case of "image2tmx <width> <height> <image>"
else if (argv._.length === 3 && typeof argv._[0] === 'number' && typeof argv._[1] === 'number') {
    tw = argv._[0];
    th = argv._[1];
    imgPath = argv._[2];
}
// unknown params
else {
    usage();
}

var reuseTileset = null,
    randName = require('crypto').randomBytes(4).toString('hex'),
    reuseTilesetPath = require('path').join(argv.outputDir || '.', randName + '.png');

glob(imgPath, function (err, files) {
    if (err) throw err;

    async.forEach(
        files,
        function (path, _cb) {
            convertImage(path, tw, th, _cb);
        },
        function (err) {
            if (err) throw err;

            if (argv.commonTileset) {
                console.log('Writing common ', reuseTileset.outWidth, 'x', reuseTileset.outHeight, 'tileset, with', reuseTileset.tiles.length, 'tiles.');
                reuseTileset.writeImage(reuseTilesetPath);
            }
        }
    );
});

function convertImage(imagePath, tileWidth, tileHeight, cb) {
    console.log('Parsing map.');
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

        tilesetPath = argv.commonTileset ? reuseTilesetPath : path.join(outDir, fbase + '-tileset.png'),
        tilemapPath = path.join(outDir, fbase + '.tmx'),

        image = null,
        tilesetImage = null,
        tileset = null,
        tilemap = null;

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

                if (argv.commonTileset && reuseTileset) {
                    tileset = reuseTileset;
                } else {
                    tileset = reuseTileset = new tmx.Tileset(tileWidth, tileHeight);
                }

                tileset.append(tilesetImage || image).once('parsed', function () {
                    if (!tilesetImage && !argv.commonTileset) {
                        console.log('Writing', tileset.outWidth, 'x', tileset.outHeight, 'tileset, with', tileset.tiles.length, 'tiles.');
                        tileset.writeImage(tilesetPath);
                    }

                    var tilemap = new tmx.Tilemap(tileset, image);

                    tilemap.once('parsed', function () {
                        console.log('Writing', tilemap.gridWidth, 'x', tilemap.gridWidth, 'tilemap.');
                        tilemap.writeXml(tilemapPath, path.basename(argv.tileset || tilesetPath), argv.format);

                        cb();
                    });
                });
            });
    }
}
