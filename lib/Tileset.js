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
 * @param [isTilesetImage=false] {Boolean} Is the input image actually a tileset image
 * @param [powerOfTwo=true] {Boolean} Should the resulting image have deminsions that are a power of two
 */
function Tileset(imageData, tileWidth, tileHeight, isTilesetImage, powerOfTwo) {
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
    this.tilemapBuffer = null;

    this.baseDataIsTileset = isTilesetImage || false;
    this.tilemapBuffer = null;

    this.pot = powerOfTwo != null ? powerOfTwo : true;
    this.outWidth = 0;
    this.outHeight = 0;

    if (imageData instanceof PNG) {
        this.png = imageData;
        this._createTileset();
    } else {
        this.png = new PNG();
        this.png.parse(imageData, this._createTileset.bind(this));
    }
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
    });

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

Tileset.prototype._createTileset = function (err) {
    if (err) return this.emit('error', err);

    this.gridWidth = this.png.width / this.tileWidth;
    this.gridHeight = this.png.height / this.tileHeight;

    if (!this.baseDataIsTileset) {
        this.tilemapBuffer = new Buffer(4 * this.gridWidth * this.gridHeight);
    }

    var key = null,
        tile = null,
        idx = 0;

    for (var y = 0; y < this.gridHeight; ++y) {
        for (var x = 0; x < this.gridWidth; ++x) {
            this.png.bitblt(this.tmp, x * this.tileWidth, y * this.tileHeight, this.tileWidth, this.tileHeight, 0, 0);
            key = this.tmp.data.toString('base64');

            if (!this.tileIdMap[key]) {
                tile = new PNG({ width: this.tileWidth, height: this.tileHeight });
                this.tmp.bitblt(tile, 0, 0, this.tileWidth, this.tileHeight, 0, 0);

                this.tileIdMap[key] = this.tiles.push(tile);
            }

            if (this.tilemapBuffer) {
                this.tilemapBuffer.writeUInt32LE(this.tileIdMap[key], idx);
                idx += 4;
            }
        }
    }

    var sq = Math.ceil(Math.sqrt(this.tiles.length));

    if (this.pot) {
        sq = Math.pow(2, Math.round(Math.log(sq) / Math.log(2)));
    }

    this.outWidth = sq * this.tileWidth;
    this.outHeight = sq * this.tileHeight;

    this.ready = true;
    setImmediate(function () {
        this.emit('parsed');
    }.bind(this));
};
