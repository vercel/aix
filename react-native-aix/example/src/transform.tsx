import {
  TransformStream,
  ReadableStream,
  WritableStream,
} from 'web-streams-polyfill';

if (typeof global.TransformStream === 'undefined') {
  global.TransformStream = TransformStream;
}

if (typeof global.Event === 'undefined') {
  global.Event = function Event(type, eventInitDict = {}) {
    this.type = type;
    this.bubbles = eventInitDict.bubbles || false;
    this.cancelable = eventInitDict.cancelable || false;
    this.target = null;
    this.currentTarget = null;
    this.eventPhase = 0;
    this.defaultPrevented = false;
    this.isTrusted = false;

    this.preventDefault = function () {
      this.defaultPrevented = true;
    };
  };
}

if (typeof global.EventTarget === 'undefined') {
  global.EventTarget = function EventTarget() {
    this.listeners = {};
  };

  global.EventTarget.prototype.addEventListener = function (type, callback) {
    if (!this.listeners[type]) {
      this.listeners[type] = [];
    }
    this.listeners[type].push(callback);
  };

  global.EventTarget.prototype.removeEventListener = function (type, callback) {
    if (!this.listeners[type]) return;
    this.listeners[type] = this.listeners[type].filter(cb => cb !== callback);
  };

  global.EventTarget.prototype.dispatchEvent = function (event) {
    if (!this.listeners[event.type]) return true;
    this.listeners[event.type].forEach(cb => cb.call(this, event));
    return !event.defaultPrevented;
  };
}

if (typeof global.MessageEvent === 'undefined') {
  global.MessageEvent = function MessageEvent(type, eventInitDict = {}) {
    this.type = type;
    this.data = eventInitDict.data || null;
    this.origin = eventInitDict.origin || '';
    this.lastEventId = eventInitDict.lastEventId || '';
    this.source = eventInitDict.source || null;
    this.ports = eventInitDict.ports || [];
  };
}

if (typeof BroadcastChannel === 'undefined') {
  global.BroadcastChannel = class BroadcastChannel extends global.EventTarget {
    constructor(channelName) {
      super();
      this.channelName = channelName;
      this._subscribers = [];
    }

    postMessage(message) {
      const event = new global.MessageEvent('message', {
        data: message,
      });

      setTimeout(() => {
        this.dispatchEvent(event);
      }, 0);
    }

    close() {
      this._subscribers = [];
    }
  };
}

export { TransformStream, ReadableStream, WritableStream };
