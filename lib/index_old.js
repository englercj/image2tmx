// Load modules
var fs = require('fs'),
    path = require('path'),
    PNG = require('pngjs').PNG,
    zlib;

// Input handling
var args = process.argv.slice(2),
    flag = 0,
    fpath, fext, fname, fbase,
    tileHeight, tileWidth;

function usage() {
    console.info('Usage: node Image2Map.js [options] <tile width/size> [tile height] <map image>');
    console.log('Options:');
    console.log(' -c, --csv     Outputs tile data in CSV format.');
    console.log(' -g, --gzip    Outputs tile data in GZIP-compressed base64.');
    console.log(' -p, --path    Defines the path to the input image file.');
    console.log(' -z, --zlib    Outputs tile data in ZLIB-compressed base64.');
    console.log(' -h, --help    Prints this usage info.');
}

// Set it up so the last flag of the same kind "wins"
for (var l = 0; l < args.length; l++) {
    switch (args[l]) {
        case '-c':
        case '--csv':
            flag = 1;
            break;
        case '-g':
        case '--gzip':
            flag = 2;
            break;
        case '-z':
        case '--zlib':
            flag = 4;
            break;
        case '-h':
        case '--help':
            usage();
            process.exit();
            break;
        case '-p':
        case '--path':
            fpath = args[l+1];
            fext = path.extname(fpath);
            fname = path.basename(fpath);
            fbase = path.basename(fname, fext);
            l++;
            break;
        default:
            // tile dimensions or image path
            if (isNaN(parseInt(args[l]))) {
                // image path
                fpath = args[l];
                fext = path.extname(fpath);
                fname = path.basename(fpath);
                fbase = path.basename(fname, fext);
            }
            if (!isNaN(parseInt(args[l]))) {
                // tile sizes
                tileWidth = parseInt(args[l]);
                if (args[l+1] && !isNaN(parseInt(args[l+1]))) {
                    tileHeight = parseInt(args[l+1]);
                    l++;
                } else {
                    console.warn('Notice: Found only one size parameter. Assuming same value for both.');
                    tileHeight = tileWidth;
                }
            }
            break;
    }
}

if (!fpath) {
    console.error('Error: Missing required image path parameter.');
    usage();
    process.exit();
}

// Only load zlib if we need it
if ((flag & 2) || (flag & 4)) {
    zlib = require('zlib');
}

// Create environment
var src = new PNG(),
    input = fs.createReadStream(fpath),
    output = fs.createWriteStream(fbase + '-Tileset' + fext);

// Once piped, the image is parsed
src.on('parsed', function() {
    var black = new PNG({
            height: tileHeight,
            width: tileWidth
        }),
        buf,
        bufList = [],
        dst = new PNG({
            height: src.height,
            width: src.width
        }),
        found,
        gridHeight = src.height / tileHeight,
        gridWidth = src.width / tileWidth,
        i = 0,
        index,
        list = [],
        out = [],
        tile,
        tmp = new PNG({
            height: tileHeight,
            width: tileWidth
        }),
        x,
        y = 0;

    function buildXML() {
        var comp;
        if (flag & 2) {
            comp = 'gzip';
        } else if (flag & 4) {
            comp = 'zlib';
        }
        return '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<map version="1.0" orientation="orthogonal" width="' + gridWidth + '" height="' + gridHeight + '" tilewidth="' + tileWidth + '" tileheight="' + tileHeight + '">\n' +
        ' <tileset firstgid="1" name="' + fbase + '" tilewidth="' + tileWidth + '" tileheight="' + tileHeight + '">\n' +
        '  <image source="' + fbase + '-Tileset.png" width="' + gridWidth * tileWidth + '" height="' + gridHeight * tileHeight + '"/>\n' +
        ' </tileset>\n' +
        ' <layer name="' + fbase + '" width="' + gridWidth + '" height="' + gridHeight + '">\n' +
        '  <data encoding="' + (arguments[1] ? arguments[1] : 'base64') + '"' + (comp ? ' compression="' + comp + '"' : '') + '>\n' +
        '   ' + arguments[0] + '\n' +
        '  </data>\n' +
        ' </layer>\n' +
        '</map>\n';
    }

    // Make the black tile
    for (; y < tileHeight; y++) {
        for (x = 0; x < tileWidth; x++) {
            index = (tileWidth * y + x) << 2;
            black.data[index] = 0;
            black.data[index+1] = 0;
            black.data[index+2] = 0;
            black.data[index+3] = 255;
        }
    }

    // Build tileset and tile grid
    for (y = 0; y < gridHeight; y++) {
        for (x = 0; x < gridWidth; x++) {
            // Tiled.app has a starting tile index of 1, not 0
            i++;

            src.bitblt(tmp, x * tileWidth, y * tileHeight, tileWidth, tileHeight, 0, 0);
            tile = tmp.data.toString('base64');

            if (0 === list.length) {
                // add first tile
                list[i] = tile;
                tmp.bitblt(dst, 0, 0, tileWidth, tileHeight, 0, 0);
                if (flag & 1) {
                    out = '1,'
                } else {
                    out.push('1');
                }
            } else {
                // For each "item" in "list", draw to tmp and check against current tile
                found = false;
                for (var item in list) {
                    // Match found, not adding to list
                    if (list[item] === tile) {
                        found = true;
                        black.bitblt(dst, 0, 0, tileWidth, tileHeight, x * tileWidth, y * tileHeight);
                        if (flag & 1) {
                            out += item + ',';
                        } else {
                            out.push(item.toString());
                        }
                        break;
                    }
                }

                // No match found, adding to list
                if (!found) {
                    list[i] = tile;
                    tmp.bitblt(dst, 0, 0, tileWidth, tileHeight, x * tileWidth, y * tileHeight);
                    if (flag & 1) {
                        out += i + ',';
                    } else {
                        out.push(i.toString());
                    }
                }
            }
        }
        if (flag & 1) {
            out += "\n";
        }
    }
    if (flag & 1) {
        out = out.slice(0, -2);
    }

    // turn out into a buffer filled with UInt32LE
    if (!(flag & 1)) {
        for (i = 0; i < out.length; i++) {
            var tmp = new Buffer(4);
            tmp.writeUInt32LE(parseInt(out[i]), 0);
            bufList.push(tmp);
        }
        buf = Buffer.concat(bufList);
    }

    if (flag & 2) {
        // gzip
        zlib.gzip(buf, function (err, buffer) {
            if (!err) {
                fs.writeFile(fbase + '.tmx', buildXML(buffer.toString('base64')), function (err) {
                    if (err) throw err;
                });
            } else {
                throw err;
            }
        });
    } else if (flag & 4) {
        // zlib
        zlib.deflate(buf, function (err, buffer) {
            if (!err) {
                // Write .tmx file to disk
                fs.writeFile(fbase + '.tmx', buildXML(buffer.toString('base64')), function (err) {
                    if (err) throw err;
                });
            } else {
                throw err;
            }
        });
    } else if (flag & 1) {
        // csv
        fs.writeFile(fbase + '.tmx', buildXML(out, 'csv'), function (err) {
            if (err) throw err;
        });
    } else {
        // base64 uncompressed
        fs.writeFile(fbase + '.tmx', buildXML(buf.toString('base64')), function (err) {
            if (err) throw err;
        });
    }

    dst.pack().pipe(output);
});

// pipe contents of input to src
input.pipe(src);
