var events = require('events'),
    fs = require('fs'),
    util = require('util'),
    zlib = require('zlib'),
    Buffer = require('buffer').Buffer,
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

    this.gridWidth = 0;
    this.gridHeight = 0;

    this.tmp = new PNG({
        width: this.tileset.tileWidth,
        height: this.tileset.tileHeight
    });

    this.ready = false;
    this.tilesetReady = false;
    this.imageReady = false;

    this.buffer = null

    if (tileset.ready) {
        this.tilesetReady = true;
    }

    if (imageData instanceof PNG) {
        this.png = imageData;
        this.imageReady = true;
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
 * @param path {String} The path to the tileset file created for this map
 * @param [format="gzip"] {String} The format of the output tilemap data. Can be: base64, gzip, or zlib
 * @param [callback] {Function} A callback function when the write completes
 */
Tilemap.prototype.writeXml = function (path, tilesetPath, format, cb) {
    var self = this;

    switch(format) {
        case 'gzip':
            // gzip
            zlib.gzip(this.buffer, function (err, zbuffer) {
                if (err) throw err;

                self._doXmlWrite(path, tilesetPath, zbuffer, 'gzip', cb);
            });
            break;

        case 'zlib':
            // zlib
            zlib.deflate(this.buffer, function (err, zbuffer) {
                if (err) throw err;

                self._doXmlWrite(path, tilesetPath, zbuffer, 'zlib', cb);
            });
            break;

        case 'base64':
        default:
            this._doXmlWrite(path, tilesetPath, this.buffer, null, cb);
            break;
    }
};

Tilemap.prototype._doXmlWrite = function(path, tilesetPath, buff, comp, cb) {
    var xml =
        '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<map version="1.0" orientation="orthogonal" width="' + this.gridWidth + '" height="' + this.gridHeight + '" tilewidth="' + this.tileset.tileWidth + '" tileheight="' + this.tileset.tileHeight + '">\n' +
        '   <tileset firstgid="1" name="' + tilesetPath + '" tilewidth="' + this.tileset.tileWidth + '" tileheight="' + this.tileset.tileHeight + '">\n' +
        '       <image source="' + tilesetPath + '" width="' + this.tileset.outWidth + '" height="' + this.tileset.outHeight + '"/>\n' +
        '   </tileset>\n' +
        '   <layer name="' + tilesetPath + '" width="' + this.gridWidth + '" height="' + this.gridHeight + '">\n' +
        '       <data encoding="base64"' + (comp ? ' compression="' + comp + '"' : '') + '>\n' +
        '           ' + buff.toString('base64') + '\n' +
        '       </data>\n' +
        '   </layer>\n' +
        '</map>\n';


    fs.writeFile(path, xml, function (err) {
        if (err) throw err;

        if (cb) cb();
    });
};

Tilemap.prototype._createTilemap = function () {
    if (!this.tilesetReady || !this.imageReady) {
        return;
    }

    this.gridWidth = this.png.width / this.tileset.tileWidth;
    this.gridHeight = this.png.height / this.tileset.tileHeight;

    // if tileset was passed a map image, it will create our buffer for us
    if (this.tileset.tilemapBuffer) {
        this.buffer = this.tileset.tilemapBuffer;
    } else {
        this.buffer = new Buffer(4 * this.gridWidth * this.gridHeight);

        var key = null,
            idx = 0,
            tile = 0;

        for (var y = 0; y < this.gridHeight; ++y) {
            for (var x = 0; x < this.gridWidth; ++x) {
                this.png.bitblt(this.tmp, x * this.tileset.tileWidth, y * this.tileset.tileHeight, this.tileset.tileWidth, this.tileset.tileHeight, 0, 0);
                key = this.tmp.data.toString('base64');
                tile = this.tileset.tileIdMap[key];

                if (tile !== undefined) {
                    this.buffer.writeUInt32LE(tile, idx);

                    idx += 4;
                } else {
                    console.log('WARNING: Tile not found in tileset (' + tile + ')');
                }
            }
        }
    }

    this.ready = true;
    setImmediate(function () {
        this.emit('parsed');
    }.bind(this));
};
