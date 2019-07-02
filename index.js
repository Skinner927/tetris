// TODO: wrap this in iife but for now debugging is easy
window.ALLOW_CHEATS = true;

const blockSize = 20; // px TODO: should make this % so the grid scales
const numRows = 20;
const numCols = 12;
const msBetweenMoves = 1000;

const $score = document.getElementById('score');
const $board = document.getElementById('board');
const $boardTable = document.createElement('table');
$board.appendChild($boardTable);
const board = []; // y, x

let activeShape = null;
let moveTimeout = null;
let score = 0;
$score.innerHTML = score;

// Create the table we'll play
for (let y = 0; y < numRows; y++) {
  const $row = document.createElement('tr');
  $boardTable.appendChild($row);
  board[y] = [];
  board[y].$row = $row; // hang onto row element

  for (let x = 0; x < numCols; x++) {
    const $cell = document.createElement('td');
    $cell.style.width = blockSize + 'px';
    $cell.style.height = blockSize + 'px';
    $row.appendChild($cell);
    board[y][x] = $cell;
  }
}

// Define shapes
// Rows must be the same length per shape
const shapeStraight = [
  [1, 1, 1, 1],
];
const shapeLeftL = [
  [1, 0, 0],
  [1, 1, 1],
];
const shapeRightL = [
  [0, 0, 1],
  [1, 1, 1],
];
const shapeSquare = [
  [1, 1],
  [1, 1],
];
const shapeRightHorse = [
  [0, 1, 1],
  [1, 1, 0],
];
const shapeLeftHorse = [
  [1, 1, 0],
  [0, 1, 1],
];
const shapeTriangle = [
  [0, 1, 0],
  [1, 1, 1],
];
const shapes = [
  shapeStraight, shapeLeftL, shapeRightL, shapeSquare, shapeRightHorse, shapeLeftHorse, shapeTriangle
];
// must be same length as shapes
const colors = ['red', 'blue', 'green', 'orange', 'pink', 'purple', 'brown'];

function Shape(shape, background) {
  this.shape = shape;
  this.background = background || 'red';
  this.x = 0;
  this.y = 0;
  this.activeCells = [];
}

Object.defineProperties(Shape.prototype, {
  height: {
    enumerable: true,
    get: function () {
      return this.shape.length;
    }
  },
  width: {
    enumerable: true,
    get: function () {
      return this.shape[0].length;
    }
  }
});
// Rotates clockwise
Shape.prototype.rotate = function rotate() {
  const shape = this.shape;
  const rows = shape.length;
  const cols = shape[0].length;

  const newShape = [];
  for (let y = 0; y < cols; y++) {
    newShape[y] = [];
    for (let x = 0; x < rows; x++) {
      newShape[y][x] = shape[rows - 1 - x][y];
    }
  }

  this.shape = newShape;
};
// Remove this shape from the board
Shape.prototype.remove = function remove() {
  this.activeCells.forEach(function (cell) {
    cell.parentElement.removeChild(cell);
  });
  this.activeCells = [];
};
/**
 * Draw this shape on the board
 * @param {Number} [y=this.y]
 * @param {Number} [x=this.x]
 * @param {Boolean} [shapeCollisionReturnVal=false] - Return value when
 *  collision with another shape.
 * @returns {Boolean|Object} Returns false if moving would cause a
 *  collision on the south side of the shape,
 *  true if no problems.
 */
Shape.prototype.drawAt = function drawAt(y, x, shapeCollisionReturnVal) {
  if (typeof y === 'undefined') {
    y = this.y;
  }
  if (typeof x === 'undefined') {
    x = this.x;
  }

  const boardHeight = numRows;
  const boardWidth = numCols;

  if (y + this.height > boardHeight) {
    // Hitting the bottom of the board
    console.log('bottom of board');
    return false;
  }
  if (x < 0 || (x + this.width) > boardWidth) {
    // Ignore moves outside the left/right bounds
    console.log('side');
    return true;
  }

  // There's likely more elegant ways, but first we'll check to see
  // if any space we're going to move it is occupied.
  for (let yo = 0; yo < this.height; yo++) {
    for (let xo = 0; xo < this.width; xo++) {
      if (this.shape[yo][xo] === 1 && board[y + yo][x + xo].hasChildNodes()) {
        const willCollide = Array.prototype.some.call(board[y + yo][x + xo].childNodes, function(el) {
          return el && this.activeCells.indexOf(el) === -1;
        }.bind(this));
        if (willCollide) {
          console.log('Collision @', y + yo, x + xo, board[y + yo][x + xo].childNodes);
          return !!shapeCollisionReturnVal;
        }
      }
    }
  }

  // Then we'll actually draw it
  this.remove();
  for (let yo = 0; yo < this.height; yo++) {
    for (let xo = 0; xo < this.width; xo++) {
      if (this.shape[yo][xo] === 1) {
        const $el = document.createElement('div');
        $el.style.backgroundColor = this.background;
        this.activeCells.push($el);
        board[y + yo][x + xo].appendChild($el);
      }
    }
  }

  this.x = x;
  this.y = y;
  return true;
};
Shape.prototype.drop = function drop() {
  while(this.move(1, 0)) {}
};
// Move the shape given a delta
// This is does most of the logic
Shape.prototype.move = function move(deltaY, deltaX) {
  deltaY = deltaY || 0;
  deltaX = deltaX || 0;

  if (deltaY !== 0 && deltaX !== 0) {
    throw new Error('cannot move diagonally');
  }

  if (!this.drawAt(this.y + deltaY, this.x + deltaX, deltaX !== 0)) {
    clearCompletedRows();
    startNewRandomShape();
    return false;
  } else if (deltaY !== 0) {
    resetForcedMove();
  }
  return true;
};

// Game functions
function startNewRandomShape(i) {
  if (typeof i === 'undefined') {
    i = Math.floor(Math.random() * shapes.length);
  }
  activeShape = new Shape(shapes[i], colors[i]);

  if (!activeShape.drawAt(0, Math.ceil((numCols - activeShape.width) / 2))) {
    if (moveTimeout) {
      window.clearTimeout(moveTimeout);
      moveTimeout = null;
    }
    alert('GAME OVER! \nYour score is ' + score);
    window.location.reload();
  } else {
    resetForcedMove();
  }
}

function resetForcedMove() {
  if (moveTimeout) {
    window.clearTimeout(moveTimeout);
  }
  moveTimeout = window.setTimeout(function() {
    if (activeShape) {
      resetForcedMove();
      activeShape.move(1, 0);
    }
  }, msBetweenMoves);
}

// Only call this when the activeShape has collided and stopped moving.
function clearCompletedRows() {
  function emptyRow(row) {
    row.forEach(function(cell) {
      cell.childNodes.forEach(function(e) {
        cell.removeChild(e);
      });
    });
  }

  let linesCleared = 0;
  for (let i = board.length - 1; i >= 0; i--) {
    const row = board[i];
    const full = row.every(function(cell) {
      return cell.hasChildNodes();
    });
    if (!full) {
      continue;
    }
    // Row is full
    emptyRow(row);
    linesCleared++;
    // Shift everything down
    for (let j = i; j > 0; j--) {
      const rowOnTop = board[j - 1];
      rowOnTop.forEach(function(cell, i) {
        cell.childNodes.forEach(function(child) {
          board[j][i].appendChild(child);
        });
      });
      emptyRow(rowOnTop);
    }
    i++; // We'll need to re-process this line
  }

  // Add the score
  switch(linesCleared) {
    case 1:
      score += 100;
      break;
    case 2:
      score += 300;
      break;
    case 3:
      score += 500;
      break;
    case 4:
      score += 800;
      break;
  }
  $score.innerHTML = score;
}

// Listen for events
document.addEventListener('keydown', function (e) {
  if (!activeShape) {
    return;
  }

  if (e.key === 'ArrowDown') {
    activeShape.move(1, 0);
  } else if (e.key === 'ArrowUp') {
    activeShape.drop();
  } else if (e.key === 'ArrowRight') {
    activeShape.move(0, 1);
  } else if (e.key === 'ArrowLeft') {
    activeShape.move(0, -1);
  } else if (e.key === ' ') {
    activeShape.rotate();
    activeShape.drawAt();
  } else if (window.ALLOW_CHEATS && e.key === ('' + parseInt(e.key, 10))) {
    // Pressing number keys allows us to debug
    const index = parseInt(e.key, 10) - 1;
    if (index >= shapes.length) {
      console.log('shape index out of bounds');
      return;
    }
    activeShape.remove();
    startNewRandomShape(index);
  } else {
    console.log('unknown key event', e.key, e);
  }
}, {passive: true, capture: true,});


// Start the game
startNewRandomShape();
