// Load in dependencies
var assert = require('assert');
var ndarray = require('ndarray');
var savePixels = require('save-pixels');

const PIXEL_EXTRUDING_SIZE = 4;

// Define our canvas constructor
function Canvas(width, height) {
  // Calculate and save dimensions/data for later
  var len = width * height * 4;
  this.width = width;
  this.height = height;
  this.data = new global.Uint8ClampedArray(len);
  this.ndarray = new ndarray(this.data, [width, height, 4]);

  // Create a store for images
  this.images = [];
}
Canvas.defaultFormat = 'png';
Canvas.supportedFormats = ['jpg', 'jpeg', 'png', 'gif'];
Canvas.prototype = {
  addImage: function (img, x, y) {
    // Save the image for later
    this.images.push({
      img: img,
      x: x,
      y: y
    });
  },
  'export': function (options) {
    // Determine the export format
    var format = options.format || Canvas.defaultFormat;
    assert(Canvas.supportedFormats.indexOf(format) !== -1,
      '`pixelsmith` doesn\'t support exporting "' + format + '". Please use "jpeg", "png", or "gif"');

    // If we have a custom background, fill it in (otherwise default is transparent black `rgba(0, 0, 0, 0)`)
    var ndarray = this.ndarray;
    var data = this.data;
    if (options.background) {
      for (var i = 0; i < data.length; ++i) {
        data[i] = options.background[i % 4];
      }
    }

    // Add each image to the canvas
    var images = this.images;
    images.forEach(function getUrlPath (imageObj) {
      // Iterate over the image's data across its rows
      // setting the original data at that offset
      // [1, 2, 0, 0,
      //  3, 4, 0, 0,
      //  0, 0, 5, 0,
      //  0, 0, 0, 6]
      var img = imageObj.img;
      var xOffset = imageObj.x;
      var yOffset = imageObj.y;
      var colIndex = 0;
      var colCount = img.width; // DEV: Use `width` for padding
      for (; colIndex < colCount; colIndex += 1) {
        var rowIndex = 0;
        var rowCount = img.height; // DEV: Use `height` for padding
        for (; rowIndex < rowCount; rowIndex += 1) {
          var rgbaIndex = 0;
          var rgbaCount = 4;
          for (; rgbaIndex < rgbaCount; rgbaIndex += 1) {
            // If we are working with a 4 dimensional array, ignore the first dimension
            // DEV: This is a GIF; [frames, width, height, rgba]
            var val;
            if (img.shape.length === 4) {
              val = img.get(0, colIndex, rowIndex, rgbaIndex);
            // Otherwise, transfer data directly
            } else {
              val = img.get(colIndex, rowIndex, rgbaIndex);
            }
            ndarray.set(xOffset + colIndex, yOffset + rowIndex, rgbaIndex, val);
          }
        }
      }

      // apply pixel extruding: repeat 1 px outside of image edge (rather than leaving it as transparent padding)
      applyPixelExtruding(img, xOffset, yOffset, ndarray, PIXEL_EXTRUDING_SIZE);
    });

    // Concatenate the ndarray into a png
    return savePixels(ndarray, format, options);
  }
};

function applyPixelExtruding(img, xOffset, yOffset, ndarray, size) {

  // must make sure the extruding size is less than image padding.
  // to simply the code, we do pass the context here and thus not able to check it,
  // - so please guarantee this from higher level logic.
  if (size <= 0) {
    return;
  }

  function get(img, col, row, rgbaIndex) {
    if (img.shape.length === 4) {
      return img.get(0, col, row, rgbaIndex);
    } else {
      return img.get(col, row, rgbaIndex);
    }
  }

  function set(x, y, z, v) {
    var shape = ndarray.shape || [0, 0];
    if (x < 0 || x >= shape[0]) {
      return;
    }
    if (y < 0 || y >= shape[1]) {
      return;
    }
    ndarray.set(x, y, z, v);
  }

  const rgbaCount = 4;
  
  // top
  for (let colIndex = 0; colIndex < img.width; colIndex += 1) {
    for (let rgbaIndex = 0; rgbaIndex < rgbaCount; rgbaIndex += 1) {
      let val = get(img, colIndex, 0, rgbaIndex);
      for (let i = 0; i < size; ++i) {
        set(xOffset + colIndex, yOffset - 1, rgbaIndex, val);
      }
    }
  }
  // bottom
  for (let colIndex = 0; colIndex < img.width; colIndex += 1) {
    for (let rgbaIndex = 0; rgbaIndex < rgbaCount; rgbaIndex += 1) {
      let val = get(img, colIndex, img.height - 1, rgbaIndex);
      for (let i = 0; i < size; ++i) {
        set(xOffset + colIndex, yOffset + img.height, rgbaIndex, val);
      }
    }
  }
  // left
  for (let rowIndex = 0; rowIndex < img.height; rowIndex += 1) {
    for (let rgbaIndex = 0; rgbaIndex < rgbaCount; rgbaIndex += 1) {
      let val = get(img, 0, rowIndex, rgbaIndex);
      for (let i = 0; i < size; ++i) {
        set(xOffset - 1, yOffset + rowIndex, rgbaIndex, val);
      }
    }
  }
  // right
  for (let rowIndex = 0; rowIndex < img.height; rowIndex += 1) {
    for (let rgbaIndex = 0; rgbaIndex < rgbaCount; rgbaIndex += 1) {
      let val = get(img, img.width - 1, rowIndex, rgbaIndex);
      for (let i = 0; i < size; ++i) {
        set(xOffset + img.width, yOffset + rowIndex, rgbaIndex, val);
      }
    }
  }
}

// Export Canvas
module.exports = Canvas;
