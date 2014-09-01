var events = require('events'),
    fs = require('fs'),
    util = require('util'),
    zlib = require('zlib'),
    Buffer = require('buffer').Buffer,
    PNG = require('pngjs').PNG;

/**
 * @class Tileset
 * @constructor
 * @param imageData {PNG|Buffer} The image that should be split into a tileset (or a tileset image itself)
 * @param tileWidth {Number} The width of a tile in the tileset
 * @param tileHeight {Number} The height of a tile in the tileset
 * @param [powerOfTwo=true] {Boolean} Should the resulting image have deminsions that are a power of two
 */
function Tileset(tileWidth, tileHeight, powerOfTwo) {
    events.EventEmitter.call(this);

    this.tileWidth = tileWidth || 16;
    this.tileHeight = tileHeight || 16;

    this.gridWidth = 0;
    this.gridHeight = 0;

    this.tmp = new PNG({
        width: this.tileWidth,
        height: this.tileHeight
    });

    // this.black = new PNG({
    //     width: this.tileWidth,
    //     height: this.tileHeight
    // });

    // for (var y = 0; y < this.tileHeight; ++y) {
    //     for (var x = 0; x < this.tileWidth; ++x) {
    //         var index = (this.tileWidth * y + x) << 2;
    //         this.black.data[index] = 0;
    //         this.black.data[index+1] = 0;
    //         this.black.data[index+2] = 0;
    //         this.black.data[index+3] = 255;
    //     }
    // }

    this.tileIdMap = {};
    this.tiles = [];

    this.ready = false;

    this.pot = powerOfTwo != null ? powerOfTwo : true;
    this.outSquare = 0;
    this.outWidth = 0;
    this.outHeight = 0;

    this.setMaxListeners(Infinity);
};

util.inherits(Tileset, events.EventEmitter);

module.exports = Tileset;

/**
 * @method writeImage
 * @param path {String} The path to write to
 * @param [callback] {Function} A callback function when the write completes
 * @return {PNG} The PNG instance that is being written
 */
Tileset.prototype.writeImage = function (path, cb) {
    var outPng = new PNG({
            width: this.outWidth,
            height: this.outHeight,
            filterType: 1,
            deflateLevel: zlib.Z_BEST_COMPRESSION,
            deflateStrategy: zlib.Z_FILTERED
        }),
        sq = this.outSquare;

    for(var y = 0; y < sq; ++y) {
        for(var x = 0; x < sq; ++x) {
            var idx = (sq * y) + x;

            if (idx < this.tiles.length) {
                this.tiles[idx].bitblt(outPng, 0, 0, this.tileWidth, this.tileHeight, x * this.tileWidth, y * this.tileHeight);
            } else {
                break;
                // this.black.bitblt(outPng, 0, 0, this.tileWidth, this.tileHeight, x * this.tileWidth, y * this.tileHeight);
            }
        }
    }

    return outPng.pack().pipe(fs.createWriteStream(path));
};

Tileset.prototype.append = function (imageData) {
    if (imageData instanceof PNG) {
        this._appendTileset(null, imageData);
    } else {
        this.png = new PNG();

        var self = this;
        this.png.parse(imageData, this._appendTileset.bind(this));
    }

    return this;
};

Tileset.prototype._appendTileset = function (err, png) {
    if (err) return this.emit('error', err);

    this.gridWidth = png.width / this.tileWidth;
    this.gridHeight = png.height / this.tileHeight;

    var key = null,
        tile = null,
        idx = 0;

    for (var y = 0; y < this.gridHeight; ++y) {
        for (var x = 0; x < this.gridWidth; ++x) {
            png.bitblt(this.tmp, x * this.tileWidth, y * this.tileHeight, this.tileWidth, this.tileHeight, 0, 0);
            key = this.tmp.data.toString('base64');

            if (!this.tileIdMap[key]) {
                tile = new PNG({ width: this.tileWidth, height: this.tileHeight });
                this.tmp.bitblt(tile, 0, 0, this.tileWidth, this.tileHeight, 0, 0);

                this.tileIdMap[key] = this.tiles.push(tile);
            }
        }
    }

    var sq = Math.ceil(Math.sqrt(this.tiles.length));

    if (this.pot) {
        sq = Math.pow(2, Math.round(Math.log(sq) / Math.log(2)));
    }

    this.outSquare = sq;
    this.outWidth = sq * this.tileWidth;
    this.outHeight = sq * this.tileHeight;

    this.ready = true;
    setImmediate(function () {
        this.emit('parsed');
    }.bind(this));
};
