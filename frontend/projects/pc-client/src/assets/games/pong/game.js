/**
 * Pong Game for Wee Party
 * A simple 2-player Pong game using tilt controls
 */
(function() {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const waitingEl = document.getElementById('waiting');

  // Game constants
  const PADDLE_WIDTH = 15;
  const PADDLE_HEIGHT = 100;
  const BALL_SIZE = 15;
  const PADDLE_SPEED = 8;
  const BALL_SPEED = 7;
  const WINNING_SCORE = 5;

  // Game state
  let gameRunning = false;
  let players = [];
  let playerInputs = {};
  let keysPressed = {};

  // Game objects
  const paddle1 = { x: 30, y: 0, vy: 0, score: 0 };
  const paddle2 = { x: 0, y: 0, vy: 0, score: 0 };
  const ball = { x: 0, y: 0, vx: 0, vy: 0 };

  // Resize canvas to fill window
  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Update paddle positions
    paddle1.x = 30;
    paddle2.x = canvas.width - 30 - PADDLE_WIDTH;

    // Center paddles vertically
    paddle1.y = (canvas.height - PADDLE_HEIGHT) / 2;
    paddle2.y = (canvas.height - PADDLE_HEIGHT) / 2;
  }

  // Reset ball to center
  function resetBall(direction = 1) {
    ball.x = canvas.width / 2;
    ball.y = canvas.height / 2;
    ball.vx = BALL_SPEED * direction;
    ball.vy = (Math.random() - 0.5) * BALL_SPEED;
  }

  // Initialize game
  function init() {
    resize();
    resetBall();
    gameRunning = true;
    waitingEl.style.display = 'none';
    requestAnimationFrame(gameLoop);
  }

  // Update game state
  function update() {
    // Update paddle velocities based on tilt input
    for (let i = 0; i < players.length; i++) {
      const input = playerInputs[players[i].id];
      if (input?.tilt) {
        const paddle = i === 0 ? paddle1 : paddle2;
        // Use tilt x value (-1 to 1) for left/right tilt to move paddle up/down
        paddle.vy = input.tilt.x * PADDLE_SPEED * 2;
      }
    }

    // Keyboard controls for testing (Player 1: W/S, Player 2: Up/Down)
    if (keysPressed['w'] || keysPressed['W']) paddle1.vy = -PADDLE_SPEED;
    else if (keysPressed['s'] || keysPressed['S']) paddle1.vy = PADDLE_SPEED;
    else if (players.length === 0) paddle1.vy = 0;

    if (keysPressed['ArrowUp']) paddle2.vy = -PADDLE_SPEED;
    else if (keysPressed['ArrowDown']) paddle2.vy = PADDLE_SPEED;
    else if (players.length < 2) paddle2.vy = 0;

    // Move paddles
    paddle1.y += paddle1.vy;
    paddle2.y += paddle2.vy;

    // Clamp paddles to screen
    paddle1.y = Math.max(0, Math.min(canvas.height - PADDLE_HEIGHT, paddle1.y));
    paddle2.y = Math.max(0, Math.min(canvas.height - PADDLE_HEIGHT, paddle2.y));

    // Move ball
    ball.x += ball.vx;
    ball.y += ball.vy;

    // Ball collision with top/bottom
    if (ball.y <= 0 || ball.y >= canvas.height - BALL_SIZE) {
      ball.vy = -ball.vy;
      ball.y = Math.max(0, Math.min(canvas.height - BALL_SIZE, ball.y));
    }

    // Ball collision with paddles
    if (ball.vx < 0) {
      // Check paddle 1
      if (ball.x <= paddle1.x + PADDLE_WIDTH &&
          ball.x >= paddle1.x &&
          ball.y + BALL_SIZE >= paddle1.y &&
          ball.y <= paddle1.y + PADDLE_HEIGHT) {
        ball.vx = -ball.vx * 1.05; // Slight speed increase
        ball.x = paddle1.x + PADDLE_WIDTH;
        // Add spin based on where ball hit paddle
        const hitPos = (ball.y + BALL_SIZE / 2 - paddle1.y) / PADDLE_HEIGHT;
        ball.vy = (hitPos - 0.5) * BALL_SPEED * 2;
        vibratePlayer(0);
      }
    } else {
      // Check paddle 2
      if (ball.x + BALL_SIZE >= paddle2.x &&
          ball.x <= paddle2.x + PADDLE_WIDTH &&
          ball.y + BALL_SIZE >= paddle2.y &&
          ball.y <= paddle2.y + PADDLE_HEIGHT) {
        ball.vx = -ball.vx * 1.05;
        ball.x = paddle2.x - BALL_SIZE;
        const hitPos = (ball.y + BALL_SIZE / 2 - paddle2.y) / PADDLE_HEIGHT;
        ball.vy = (hitPos - 0.5) * BALL_SPEED * 2;
        vibratePlayer(1);
      }
    }

    // Scoring
    if (ball.x < 0) {
      paddle2.score++;
      vibratePlayer(0, 200);
      if (paddle2.score >= WINNING_SCORE) {
        endGame(1);
      } else {
        resetBall(-1);
      }
    } else if (ball.x > canvas.width) {
      paddle1.score++;
      vibratePlayer(1, 200);
      if (paddle1.score >= WINNING_SCORE) {
        endGame(0);
      } else {
        resetBall(1);
      }
    }
  }

  // Render game
  function render() {
    // Clear canvas
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw center line
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 4;
    ctx.setLineDash([20, 15]);
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw scores
    ctx.fillStyle = '#333';
    ctx.font = 'bold 120px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(paddle1.score, canvas.width / 4, 130);
    ctx.fillText(paddle2.score, canvas.width * 3 / 4, 130);

    // Draw player names
    if (players.length > 0) {
      ctx.font = '24px sans-serif';
      ctx.fillStyle = '#e94560';
      ctx.fillText(players[0]?.name || 'P1', canvas.width / 4, 170);
      if (players.length > 1) {
        ctx.fillStyle = '#4a90e9';
        ctx.fillText(players[1]?.name || 'P2', canvas.width * 3 / 4, 170);
      }
    }

    // Draw paddles
    ctx.fillStyle = '#e94560';
    ctx.fillRect(paddle1.x, paddle1.y, PADDLE_WIDTH, PADDLE_HEIGHT);

    ctx.fillStyle = '#4a90e9';
    ctx.fillRect(paddle2.x, paddle2.y, PADDLE_WIDTH, PADDLE_HEIGHT);

    // Draw ball
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(ball.x + BALL_SIZE / 2, ball.y + BALL_SIZE / 2, BALL_SIZE / 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Game loop
  function gameLoop() {
    if (!gameRunning) return;

    update();
    render();
    requestAnimationFrame(gameLoop);
  }

  // End game
  function endGame(winner) {
    gameRunning = false;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 60px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${players[winner]?.name || 'Player ' + (winner + 1)} Wins!`, canvas.width / 2, canvas.height / 2);

    ctx.font = '24px sans-serif';
    ctx.fillStyle = '#888';
    ctx.fillText('Press any button to play again', canvas.width / 2, canvas.height / 2 + 50);
  }

  // Vibrate a player's controller
  function vibratePlayer(playerIndex, duration = 50) {
    if (players[playerIndex] && window.WeeParty) {
      window.WeeParty.vibrate(players[playerIndex].id, duration);
    }
  }

  // Handle input from WeeParty
  function handleInput(input) {
    const playerId = input.playerId;

    if (!playerInputs[playerId]) {
      playerInputs[playerId] = {};
    }

    if (input.type === 'tilt') {
      playerInputs[playerId].tilt = input.data;
    } else if (input.type === 'button' && input.data.pressed) {
      // Any button press restarts game if ended
      if (!gameRunning) {
        paddle1.score = 0;
        paddle2.score = 0;
        init();
      }
    }
  }

  // WeeParty integration
  if (window.WeeParty) {
    window.WeeParty.onGameStart((gamePlayers) => {
      players = gamePlayers;
      init();
    });

    window.WeeParty.onInput(handleInput);

    window.WeeParty.onPlayerLeave((player) => {
      // Remove player input
      delete playerInputs[player.id];
    });
  }

  // Handle window resize
  window.addEventListener('resize', resize);

  // Keyboard controls for testing
  window.addEventListener('keydown', (e) => {
    keysPressed[e.key] = true;
    // Start game with space if no players
    if (e.key === ' ' && !gameRunning && players.length === 0) {
      players = [{ id: 'keyboard1', name: 'Player 1', playerIndex: 0 }];
      init();
    }
  });
  window.addEventListener('keyup', (e) => {
    keysPressed[e.key] = false;
  });

  // Initial resize
  resize();
})();
