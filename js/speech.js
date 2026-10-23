(function (global) {
  'use strict';

  class PersistentGermanSpeech {
    constructor(options = {}) {
      this.Recognition = global.SpeechRecognition || global.webkitSpeechRecognition;
      this.onTranscript = options.onTranscript || (() => {});
      this.onStatus = options.onStatus || (() => {});
      this.shouldRestart = options.shouldRestart || (() => false);
      this.instance = null;
      this.restartTimer = null;
      this.denied = false;
      this.accepting = true;
    }

    get supported() { return Boolean(this.Recognition); }
    get active() { return Boolean(this.instance); }

    start() {
      if (!this.supported) { this.onStatus('unsupported'); return false; }
      if (this.instance || this.denied) return Boolean(this.instance);
      try {
        const recognition = new this.Recognition();
        this.instance = recognition;
        recognition.lang = 'de-DE';
        recognition.interimResults = false;
        recognition.maxAlternatives = 3;
        recognition.continuous = true;
        recognition.onstart = () => this.onStatus('listening');
        recognition.onresult = event => {
          const result = event.results[event.resultIndex ?? 0];
          if (this.accepting) this.onTranscript([...result].map(item => item.transcript));
        };
        recognition.onerror = event => {
          if (['not-allowed', 'service-not-allowed'].includes(event.error)) {
            this.denied = true;
            this.onStatus('denied');
          } else if (event.error === 'no-speech') this.onStatus('listening');
          else if (!['aborted'].includes(event.error)) this.onStatus('error');
        };
        recognition.onend = () => {
          if (this.instance !== recognition) return;
          this.instance = null;
          if (this.shouldRestart() && !this.denied) {
            this.onStatus('restarting');
            this.restartTimer = global.setTimeout(() => this.start(), 120);
          }
        };
        this.onStatus('requesting');
        recognition.start();
        return true;
      } catch {
        this.instance = null;
        this.onStatus('error');
        return false;
      }
    }

    stop() {
      global.clearTimeout(this.restartTimer);
      this.restartTimer = null;
      if (!this.instance) return;
      const recognition = this.instance;
      this.instance = null;
      recognition.onend = null;
      try { recognition.stop(); } catch {}
    }

    setAccepting(value) { this.accepting = Boolean(value); }

    retry() {
      this.denied = false;
      this.accepting = true;
      // Keep an existing continuous recognition session alive. Repeated
      // stop/start cycles are what cause the browser's microphone lock/unlock
      // chime and make the experience feel like a voice-message recorder.
      if (this.instance) return true;
      return this.start();
    }
  }

  global.LegramSpeech = PersistentGermanSpeech;
})(window);
