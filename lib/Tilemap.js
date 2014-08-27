var events = require('events'),
    util = require('util'),
    PNG = require('pngjs').PNG;

/**
 * @class Tilemap
 * @constructor
 * @param tileset {Tileset} The tileset for this map
 * @param imageData {PNG|Buffer} The raw image data for this map
 */
function Tilemap(tileset, imageData) {
    events.EventEmitter.call(this);

    this.tileset = tileset;

    this.ready = false;
    this.tilesetReady = false;
    this.imageReady = false;

    if (tileset.ready) {
        this.tilesetReady = true;
    }

    if (imageData instanceof PNG) {
        this.imageReady = true;
        this.png = imageData;
    } else {
        this.png = new PNG();
        this.png.parse(imageData, function () {
            this.imageReady = true;
            this._createTilemap();
        }.bind(this));
    }

    this._createTilemap();
};

util.inherits(Tilemap, events.EventEmitter);

module.exports = Tilemap;

/**
 * @method writeXml
 * @param path {String} The path to write to
 * @param [format="gzip"] {String} The format of the output tilemap data. Can be: csv, gzip, or zlib
 * @return {String} The XML string of the tilemap
 */
Tilemap.prototype.writeXml = function (format) {

};

Tilemap.prototype._createTilemap = function () {
    if (!this.tilesetReady || !this.imageReady) {
        return;
    }

    this.ready = true;
    setImmediate(function () {
        this.emit('parsed');
    }.bind(this));
};
