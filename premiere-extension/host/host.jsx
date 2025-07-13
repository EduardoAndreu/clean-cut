// Clean-Cut ExtendScript Host Functions
// This file contains functions that interact with Premiere Pro's API

// Include modular components
#include "preset-management.jsx"
#include "sequence-info.jsx"
#include "clip-management.jsx"
#include "audio-export.jsx"
#include "cutting.jsx"

// Add polyfill for Object.keys (ExtendScript doesn't have it)
if (!Object.keys) {
  Object.keys = function (obj) {
    if (obj !== Object(obj)) {
      throw new TypeError('Object.keys called on a non-object')
    }
    var keys = []
    for (var p in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, p)) {
        keys.push(p)
      }
    }
    return keys
  }
}

/**
 * Helper function to log messages to the Premiere Pro console
 * @param {string} message - Message to log
 */
function logMessage(message) {
  try {
    $.writeln('[Clean-Cut] ' + message);
  } catch (e) {
    // Silent fail if console logging isn't available
  }
}