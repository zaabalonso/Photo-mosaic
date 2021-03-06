var mosaic              = require('./mosaic.js'),
    imagePicker         = require('./imagePicker.js'),
    Coords              = require('./Coords.js'),
    imageSlicer         = require('./imageSlicer.js'),
    work                = require('webworkify'),
    workersCount        = 4,  // Number of workers
    tilesArray, // Array holding tiles
    dominantColorsArray, // Array holding dominant colors per tile
    drawingPointer ,  // Pointer on our drawn rows
    pendingWorkers,  // Counter of finished workers
    workersArray, // Array holding our workers
    canvas; //Canvas to draw the final image

imagePicker.init(ImageLoaded);

function initialize() {
    pendingWorkers      = workersCount;
    tilesArray          = [];
    dominantColorsArray = [];
    workersArray        = [workersCount];
    drawingPointer      = 0;
    canvas              = document.getElementById('canvas');
}

// image loaded
function ImageLoaded(file) {
    var imageToSlice = file.target,
        noOfTilesX   = imageToSlice.width / mosaic.TILE_WIDTH,
        noOfTilesY   = imageToSlice.height / mosaic.TILE_HEIGHT,
        imageTiles   = imageSlicer.sliceImageIntoTiles(imageToSlice, new Coords(noOfTilesX, noOfTilesY));

    initialize(); // we need to re init whenever a new image is picked

    // set canvas dimensions equal to image dimensions
    canvas.width = imageToSlice.width;
    canvas.height = imageToSlice.height;

    assignToImageWorkers(imageTiles);
}

// Create the workers and assing them some tasks
function assignToImageWorkers(imageTiles) {
    var blockSize      = Math.ceil(imageTiles.length / workersCount), // round the blocksize to the greater or equal intiger number
        index          = 0,
        tilesPerWorker = [],
        maxLenght      = 0;

    for (index; index < workersCount; index++) {
        workersArray[index] = work(require('./tileProcessor.js'));
        workersArray[index].addEventListener('message', onRowReady);

        tilesPerWorker = imageTiles.slice(blockSize * index, (blockSize * index) + blockSize);

        if (maxLenght < tilesPerWorker.length) {
            maxLenght = tilesPerWorker.length;
        }
        
        workersArray[index].postMessage({
            data: tilesPerWorker,
            index: index,
            maxLenght: maxLenght
        });
    }
}

// Save the ready rows of dominant colors and tiles to the final arrays
// when all workers are done send for the results for drawing per row
function onRowReady (e) {
    var tilesRow          = e.data.result,
        dominantColorsRow = e.data.colors,
        row               = e.data.row,
        isLastRow         = e.data.isLastRow;

    if (isLastRow) {
        pendingWorkers --;
    }

    tilesArray[row] = tilesRow;
    dominantColorsArray[row] = dominantColorsRow;

    if (pendingWorkers === 0) {
        workersArray.forEach(terminateWorker);
        do {
            drawRow(tilesArray[drawingPointer], dominantColorsArray[drawingPointer], drawingPointer);
            drawingPointer ++;
        } while( tilesArray[drawingPointer] );
    }
}

// Draw row on canvas
function drawRow(tiles, colors, position) {
    var imageTileSize = new Coords(mosaic.TILE_WIDTH, mosaic.TILE_HEIGHT),
        j             = 0,
        drawPos;

    for (j; j < tiles.length; j++) {
        drawPos = new Coords(position, j).multiply(imageTileSize);

        drawTileOnCanva(tiles[j], colors[j], drawPos.y, drawPos.x);
    }
}

// Draw tile on canvas with the dominant color
function drawTileOnCanva (tile, dominantColor, positionX, positionY) {
    var context           = canvas.getContext('2d'),
        dominantColorData = 'data:image/svg+xml;base64,' + window.btoa(dominantColor), // Create a Data URI (prefix + base64 encoding)
        colorImage        = new Image();

    colorImage.onload = function () {
        context.putImageData(tile, positionX, positionY);
        context.globalCompositeOperation = 'soft-light';
        context.drawImage(colorImage, positionX, positionY, mosaic.TILE_WIDTH, mosaic.TILE_HEIGHT);
    };
    colorImage.src = dominantColorData;
}

// Terminate all workers
function terminateWorker(elm) {
    elm.terminate();
}
