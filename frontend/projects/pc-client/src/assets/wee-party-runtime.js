/**
 * WeeParty Runtime API
 * This script is injected into game iframes to provide input handling
 * and communication with the platform.
 */
(function() {
  'use strict';

  const callbacks = {
    onInput: [],
    onPlayerJoin: [],
    onPlayerLeave: [],
    onGameStart: []
  };

  let players = [];
  let gameStarted = false;

  // Handle messages from parent frame (platform)
  window.addEventListener('message', (event) => {
    const { type, data } = event.data;

    switch (type) {
      case 'init':
        players = data.players || [];
        gameStarted = true;
        callbacks.onGameStart.forEach(cb => cb(players));
        break;

      case 'input':
        callbacks.onInput.forEach(cb => cb(data));
        break;

      case 'player-join':
        players.push(data);
        callbacks.onPlayerJoin.forEach(cb => cb(data));
        break;

      case 'player-leave':
        players = players.filter(p => p.id !== data.id);
        callbacks.onPlayerLeave.forEach(cb => cb(data));
        break;
    }
  });

  // Public API
  window.WeeParty = {
    /**
     * Register callback for input events
     * @param {function} callback - Called with InputEvent
     */
    onInput(callback) {
      callbacks.onInput.push(callback);
    },

    /**
     * Register callback for player join events
     * @param {function} callback - Called with Player object
     */
    onPlayerJoin(callback) {
      callbacks.onPlayerJoin.push(callback);
    },

    /**
     * Register callback for player leave events
     * @param {function} callback - Called with Player object
     */
    onPlayerLeave(callback) {
      callbacks.onPlayerLeave.push(callback);
    },

    /**
     * Register callback for game start
     * @param {function} callback - Called with array of Players
     */
    onGameStart(callback) {
      callbacks.onGameStart.push(callback);
      // If game already started, call immediately
      if (gameStarted) {
        callback(players);
      }
    },

    /**
     * Get current players
     * @returns {Array} Array of Player objects
     */
    getPlayers() {
      return [...players];
    },

    /**
     * Send vibration feedback to a player's controller
     * @param {string} playerId - Player ID
     * @param {number} duration - Duration in ms
     */
    vibrate(playerId, duration) {
      window.parent.postMessage({
        type: 'vibrate',
        playerId,
        duration
      }, '*');
    },

    /**
     * Send a message to a player's controller
     * @param {string} playerId - Player ID
     * @param {object} message - Message object
     */
    sendToController(playerId, message) {
      window.parent.postMessage({
        type: 'controller-message',
        playerId,
        message
      }, '*');
    }
  };

  // Freeze the API to prevent modification
  Object.freeze(window.WeeParty);

  console.log('WeeParty Runtime loaded');
})();
