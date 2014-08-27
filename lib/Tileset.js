var events = require('events'),
    util = require('util'),
    fs = require('fs'),
    Buffer = require('buffer').Buffer,
    PNG = require('pngjs').PNG;

/**
 * @class Tileset
 * @constructor
 * @param imageData {PNG|Buffer} The image that should be split into a tileset (or a tileset image itself)
 * @param tileWidth {Number} The width of a tile in the tileset
 * @param tileHeight {Number} The height of a tile in the tileset
 */
function Tileset(imageData, tileWidth, tileHeight, pot) {
    events.EventEmitter.call(this);

    this.tileWidth = tileWidth || 16;
    this.tileHeight = tileHeight || 16;

    this.gridWidth = 0;
    this.gridHeight = 0;

    this.tmp = new PNG({
        width: this.tileWidth,
        height: this.tileHeight
    });

    this.tileBufferSize = 4 * this.tileWidth * this.tileHeight;
    this.tileIdMap = {};
    this.tiles = [];

    this.ready = false;

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
 * @param [powerOfTwo=true] {Boolean} Should the resulting image have deminsions that are a power of two
 * @param [callback] {Function} A callback function when the write completes
 * @return {PNG} The PNG instance that is being written
 */
Tileset.prototype.writeImage = function (path, powerOfTwo, cb) {
    if (typeof powerOfTwo === 'function') {
        cb = powerOfTwo;
        powerOfTwo = null;
    }

    powerOfTwo = powerOfTwo || true;

    var sq = Math.ceil(Math.sqrt(this.tiles.length));

    if (powerOfTwo) {
        sq = Math.pow(2, Math.round(Math.log(sq) / Math.log(2)));
    }

    var outPng = new PNG({
        width: sq * this.tileWidth,
        height: sq * this.tileHeight
    });

    for(var y = 0; y < sq; ++y) {
        for(var x = 0; x < sq; ++x) {
            var idx = (sq * y) + x;

            if (idx >= this.tiles.length) break;

            this.tiles[idx].bitblt(outPng, 0, 0, this.tileWidth, this.tileHeight, x * this.tileWidth, y * this.tileHeight);
        }
    }

    console.log('writing,', outPng.width, 'x', outPng.height, 'tileset! With', this.tiles.length, 'tiles.');

    return outPng.pack().pipe(fs.createWriteStream(path));
};

Tileset.prototype._createTileset = function (err) {
    if (err) return this.emit('error', err);

    this.gridWidth = this.png.width / this.tileWidth;
    this.gridHeight = this.png.height / this.tileHeight;

    var key = null,
        tile = null;

    for (var y = 0; y < this.gridHeight; ++y) {
        for (var x = 0; x < this.gridWidth; ++x) {
            this.png.bitblt(this.tmp, x * this.tileWidth, y * this.tileHeight, this.tileWidth, this.tileHeight, 0, 0);
            key = this.tmp.data.toString('base64');

            if (!this.tileIdMap[key]) {
                tile = new PNG({ width: this.tileWidth, height: this.tileHeight });
                this.tmp.bitblt(tile, 0, 0, this.tileWidth, this.tileHeight, 0, 0);

                this.tileIdMap[key] = (this.tiles.push(tile) - 1);
            }
        }
    }

    this.ready = true;
    setImmediate(function () {
        this.emit('parsed');
    }.bind(this));
};
