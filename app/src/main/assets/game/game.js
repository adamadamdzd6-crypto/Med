/**
 * ====================================================================
 * Castle Defense TD - Complete Game Engine
 * Massive Castle, Multi-Weapon Battlements, Wave Physics & Particles
 * ====================================================================
 */

(function () {
  "use strict";

  // --- ADVANCED AUDIO MANAGER (Epic BGM + Synthesized Tower & Enemy SFX) ---
  class AudioManager {
    constructor(game) {
      this.game = game;
      this.ctx = null;
      this.masterGain = null;
      this.musicGain = null;
      this.sfxGain = null;

      // Audio settings with LocalStorage persistence
      this.settings = {
        masterEnabled: true,
        masterVolume: 0.8,
        musicEnabled: true,
        musicVolume: 0.65,
        sfxEnabled: true,
        sfxVolume: 0.8,
        towerSfxEnabled: true,
        enemySfxEnabled: true
      };

      this.loadSettings();

      // BGM Sequencer state
      this.musicPlaying = false;
      this.schedulerTimer = null;
      this.tempo = 112; // BPM
      this.stepTime = (60 / this.tempo) / 2; // 8th note duration (~0.268s)
      this.currentStep = 0;
      this.currentBar = 0;
      this.nextNoteTime = 0;

      // Epic D-Minor Orchestral Progression (Medieval Fantasy)
      this.chords = [
        { name: "Dm", bass: 73.42, notes: [146.83, 174.61, 220.00], lead: [220.0, 261.63, 293.66, 349.23] }, // Bar 0: D minor
        { name: "Bb", bass: 58.27, notes: [116.54, 146.83, 174.61], lead: [233.08, 293.66, 349.23, 440.0] }, // Bar 1: Bb major
        { name: "C",  bass: 65.41, notes: [130.81, 164.81, 196.00], lead: [261.63, 329.63, 392.0, 440.0] },  // Bar 2: C major
        { name: "Am", bass: 55.00, notes: [110.00, 130.81, 164.81], lead: [220.0, 261.63, 329.63, 392.0] },  // Bar 3: A minor
        { name: "Dm", bass: 73.42, notes: [146.83, 174.61, 220.00], lead: [293.66, 349.23, 440.0, 523.25] }, // Bar 4: D minor heroic
        { name: "Gm", bass: 49.00, notes: [98.00,  116.54, 146.83], lead: [293.66, 349.23, 392.0, 466.16] }, // Bar 5: G minor
        { name: "Bb", bass: 58.27, notes: [116.54, 146.83, 174.61], lead: [233.08, 293.66, 349.23, 440.0] }, // Bar 6: Bb major
        { name: "A",  bass: 55.00, notes: [110.00, 138.59, 164.81], lead: [220.0, 277.18, 329.63, 440.0] }   // Bar 7: A major fanfare
      ];
    }

    get enabled() {
      return this.settings.masterEnabled;
    }

    set enabled(val) {
      this.setMasterEnabled(val);
    }

    loadSettings() {
      try {
        const saved = localStorage.getItem("castle_td_audio_settings");
        if (saved) {
          const parsed = JSON.parse(saved);
          Object.assign(this.settings, parsed);
        }
      } catch (e) {
        // storage disabled or unavailable
      }
    }

    saveSettings() {
      try {
        localStorage.setItem("castle_td_audio_settings", JSON.stringify(this.settings));
      } catch (e) {
        // storage safety
      }
    }

    init() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
          this.masterGain = this.ctx.createGain();
          this.musicGain = this.ctx.createGain();
          this.sfxGain = this.ctx.createGain();

          this.musicGain.connect(this.masterGain);
          this.sfxGain.connect(this.masterGain);
          this.masterGain.connect(this.ctx.destination);

          this.applyGains();
        }
      }
      if (this.ctx && this.ctx.state === "suspended") {
        this.ctx.resume();
      }

      if (this.settings.musicEnabled && !this.musicPlaying && this.ctx) {
        this.startMusic();
      }
    }

    applyGains() {
      if (!this.ctx || !this.masterGain) return;
      const t = this.ctx.currentTime;
      const mVol = this.settings.masterEnabled ? this.settings.masterVolume : 0;
      const bgmVol = this.settings.musicEnabled ? this.settings.musicVolume : 0;
      const sfxVol = this.settings.sfxEnabled ? this.settings.sfxVolume : 0;

      this.masterGain.gain.setValueAtTime(mVol, t);
      this.musicGain.gain.setValueAtTime(bgmVol, t);
      this.sfxGain.gain.setValueAtTime(sfxVol, t);
    }

    // --- BGM EPIC MUSIC SYNTHESIZER ---
    startMusic() {
      this.init();
      if (!this.ctx) return;
      if (this.musicPlaying) return;

      this.musicPlaying = true;
      this.nextNoteTime = this.ctx.currentTime + 0.08;
      this.currentStep = 0;
      this.currentBar = 0;

      if (this.schedulerTimer) clearInterval(this.schedulerTimer);
      this.schedulerTimer = setInterval(() => {
        this.scheduler();
      }, 75);
    }

    stopMusic() {
      this.musicPlaying = false;
      if (this.schedulerTimer) {
        clearInterval(this.schedulerTimer);
        this.schedulerTimer = null;
      }
    }

    scheduler() {
      if (!this.ctx || !this.musicPlaying) return;
      // Schedule audio ahead by 0.3s
      while (this.nextNoteTime < this.ctx.currentTime + 0.3) {
        this.scheduleStep(this.currentStep, this.nextNoteTime);
        this.advanceStep();
      }
    }

    advanceStep() {
      this.nextNoteTime += this.stepTime;
      this.currentStep = (this.currentStep + 1) % 8; // 8 steps per bar (eighth notes)
      if (this.currentStep === 0) {
        this.currentBar = (this.currentBar + 1) % this.chords.length;
      }
    }

    scheduleStep(step, time) {
      if (!this.ctx || !this.musicGain) return;
      const chord = this.chords[this.currentBar];
      const isBattle = this.game && this.game.waveActive;
      const intensity = isBattle ? 1.0 : 0.65;

      // 1. War Drum Kick: On quarter note beats (steps 0, 4)
      if (step === 0 || step === 4 || (isBattle && step === 6 && this.currentBar % 2 === 1)) {
        this.synthKick(time, 0.55 * intensity);
      }

      // 2. War Snare / Tom Drum: Steps 2 and 6
      if (step === 2 || step === 6) {
        this.synthSnare(time, 0.42 * intensity);
      }

      // 3. Marching Shaker / Anvil metallic pulse: every 8th note
      this.synthAnvil(time, (step % 2 === 0 ? 0.08 : 0.04) * intensity);

      // 4. Staccato Driving Bass: Heroic galloping rhythm (steps 0, 2, 4, 5, 6)
      if (step === 0 || step === 2 || step === 4 || step === 5 || step === 6) {
        const bassFreq = (step === 6) ? chord.bass * 1.5 : chord.bass;
        this.synthBass(bassFreq, time, this.stepTime * 0.85, 0.35 * intensity);
      }

      // 5. Majestic Medieval Brass / Strings Chords: On step 0 and 4 of each bar
      if (step === 0 || step === 4) {
        this.synthChord(chord.notes, time, this.stepTime * 3.6, 0.22 * intensity);
      }

      // 6. Heroic Fanfare Brass Lead: Active during wave battle or phrase climax
      if ((isBattle || this.currentBar >= 4) && (step === 0 || step === 3 || step === 5)) {
        const noteIdx = (step === 0) ? 0 : (step === 3 ? 1 : 2);
        const melNote = chord.lead[noteIdx % chord.lead.length];
        this.synthLead(melNote, time, this.stepTime * 1.25, 0.24 * intensity);
      }
    }

    synthKick(time, gainVal) {
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(140, time);
        osc.frequency.exponentialRampToValueAtTime(36, time + 0.2);
        gain.gain.setValueAtTime(gainVal, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.22);
        osc.connect(gain);
        gain.connect(this.musicGain);
        osc.start(time);
        osc.stop(time + 0.22);
      } catch (e) {}
    }

    synthSnare(time, gainVal) {
      try {
        const bufferSize = Math.floor(this.ctx.sampleRate * 0.12);
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.035));
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.setValueAtTime(1100, time);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(gainVal, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.musicGain);
        noise.start(time);
      } catch (e) {}
    }

    synthAnvil(time, gainVal) {
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(3200, time);
        gain.gain.setValueAtTime(gainVal, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);
        osc.connect(gain);
        gain.connect(this.musicGain);
        osc.start(time);
        osc.stop(time + 0.04);
      } catch (e) {}
    }

    synthBass(freq, time, dur, gainVal) {
      try {
        const osc = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();

        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(freq, time);

        filter.type = "lowpass";
        filter.frequency.setValueAtTime(450, time);
        filter.frequency.exponentialRampToValueAtTime(160, time + dur);

        gain.gain.setValueAtTime(gainVal, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.musicGain);

        osc.start(time);
        osc.stop(time + dur);
      } catch (e) {}
    }

    synthChord(freqs, time, dur, gainVal) {
      try {
        freqs.forEach(f => {
          const osc = this.ctx.createOscillator();
          const filter = this.ctx.createBiquadFilter();
          const gain = this.ctx.createGain();

          osc.type = "triangle";
          osc.frequency.setValueAtTime(f, time);

          filter.type = "lowpass";
          filter.frequency.setValueAtTime(750, time);

          gain.gain.setValueAtTime(0.001, time);
          gain.gain.linearRampToValueAtTime(gainVal / freqs.length, time + 0.08);
          gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

          osc.connect(filter);
          filter.connect(gain);
          gain.connect(this.musicGain);

          osc.start(time);
          osc.stop(time + dur);
        });
      } catch (e) {}
    }

    synthLead(freq, time, dur, gainVal) {
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(freq, time);

        const filter = this.ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(1200, time);

        gain.gain.setValueAtTime(0.001, time);
        gain.gain.linearRampToValueAtTime(gainVal, time + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.musicGain);

        osc.start(time);
        osc.stop(time + dur);
      } catch (e) {}
    }

    // --- SFX FILTERING & PLAYBACK ---
    isTowerSound(type) {
      return ["arrow", "cannon", "tesla", "ballista", "flamethrower", "catapult", "build"].includes(type);
    }

    isEnemySound(type) {
      return ["hit", "deflect", "dodge", "horn", "enemy_death", "colossus_step", "boss_roar"].includes(type);
    }

    play(type, category = null) {
      if (!this.settings.masterEnabled || !this.settings.sfxEnabled) return;
      if ((category === "tower" || this.isTowerSound(type)) && !this.settings.towerSfxEnabled) return;
      if ((category === "enemy" || this.isEnemySound(type)) && !this.settings.enemySfxEnabled) return;

      this.init();
      if (!this.ctx || !this.sfxGain) return;

      const t = this.ctx.currentTime;
      try {
        switch (type) {
          case "arrow": {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = "triangle";
            osc.frequency.setValueAtTime(650, t);
            osc.frequency.exponentialRampToValueAtTime(180, t + 0.12);
            gain.gain.setValueAtTime(0.25, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.12);
            osc.connect(gain);
            gain.connect(this.sfxGain);
            osc.start(t);
            osc.stop(t + 0.12);
            break;
          }
          case "cannon": {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = "sine";
            osc.frequency.setValueAtTime(150, t);
            osc.frequency.exponentialRampToValueAtTime(30, t + 0.38);
            gain.gain.setValueAtTime(0.55, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.38);
            osc.connect(gain);
            gain.connect(this.sfxGain);
            osc.start(t);
            osc.stop(t + 0.38);
            break;
          }
          case "tesla": {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = "sawtooth";
            osc.frequency.setValueAtTime(850, t);
            osc.frequency.setValueAtTime(450, t + 0.05);
            osc.frequency.setValueAtTime(950, t + 0.1);
            gain.gain.setValueAtTime(0.3, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.18);
            osc.connect(gain);
            gain.connect(this.sfxGain);
            osc.start(t);
            osc.stop(t + 0.18);
            break;
          }
          case "hit": {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = "sine";
            osc.frequency.setValueAtTime(240, t);
            osc.frequency.exponentialRampToValueAtTime(65, t + 0.12);
            gain.gain.setValueAtTime(0.4, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.12);
            osc.connect(gain);
            gain.connect(this.sfxGain);
            osc.start(t);
            osc.stop(t + 0.12);
            break;
          }
          case "coin": {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = "sine";
            osc.frequency.setValueAtTime(987, t);
            osc.frequency.setValueAtTime(1318, t + 0.08);
            gain.gain.setValueAtTime(0.28, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.22);
            osc.connect(gain);
            gain.connect(this.sfxGain);
            osc.start(t);
            osc.stop(t + 0.22);
            break;
          }
          case "build": {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = "square";
            osc.frequency.setValueAtTime(320, t);
            osc.frequency.setValueAtTime(480, t + 0.08);
            gain.gain.setValueAtTime(0.28, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.25);
            osc.connect(gain);
            gain.connect(this.sfxGain);
            osc.start(t);
            osc.stop(t + 0.25);
            break;
          }
          case "horn": {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = "sawtooth";
            osc.frequency.setValueAtTime(240, t);
            osc.frequency.linearRampToValueAtTime(360, t + 0.35);
            gain.gain.setValueAtTime(0.4, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.7);
            osc.connect(gain);
            gain.connect(this.sfxGain);
            osc.start(t);
            osc.stop(t + 0.7);
            break;
          }
          case "spell": {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = "sine";
            osc.frequency.setValueAtTime(300, t);
            osc.frequency.exponentialRampToValueAtTime(950, t + 0.3);
            gain.gain.setValueAtTime(0.35, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.35);
            osc.connect(gain);
            gain.connect(this.sfxGain);
            osc.start(t);
            osc.stop(t + 0.35);
            break;
          }
          case "achievement": {
            const freqs = [523.25, 659.25, 783.99, 1046.5];
            freqs.forEach((freq, idx) => {
              const startT = t + idx * 0.08;
              const osc = this.ctx.createOscillator();
              const gain = this.ctx.createGain();
              osc.type = "sine";
              osc.frequency.setValueAtTime(freq, startT);
              gain.gain.setValueAtTime(0.3, startT);
              gain.gain.exponentialRampToValueAtTime(0.001, startT + 0.35);
              osc.connect(gain);
              gain.connect(this.sfxGain);
              osc.start(startT);
              osc.stop(startT + 0.36);
            });
            break;
          }
          case "thunder": {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = "sawtooth";
            osc.frequency.setValueAtTime(80, t);
            osc.frequency.exponentialRampToValueAtTime(25, t + 0.95);
            gain.gain.setValueAtTime(0.7, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.95);
            osc.connect(gain);
            gain.connect(this.sfxGain);
            osc.start(t);
            osc.stop(t + 0.95);
            break;
          }
          case "wind": {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = "sine";
            osc.frequency.setValueAtTime(130, t);
            osc.frequency.linearRampToValueAtTime(220, t + 0.4);
            osc.frequency.linearRampToValueAtTime(110, t + 0.85);
            gain.gain.setValueAtTime(0.3, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.85);
            osc.connect(gain);
            gain.connect(this.sfxGain);
            osc.start(t);
            osc.stop(t + 0.85);
            break;
          }
          case "weather_change": {
            const notes = [440, 554.37, 659.25];
            notes.forEach((freq, idx) => {
              const startT = t + idx * 0.08;
              const osc = this.ctx.createOscillator();
              const gain = this.ctx.createGain();
              osc.type = "triangle";
              osc.frequency.setValueAtTime(freq, startT);
              gain.gain.setValueAtTime(0.25, startT);
              gain.gain.exponentialRampToValueAtTime(0.001, startT + 0.35);
              osc.connect(gain);
              gain.connect(this.sfxGain);
              osc.start(startT);
              osc.stop(startT + 0.35);
            });
            break;
          }
          case "guard_horn": {
            const notes = [329.63, 440.0, 554.37, 659.25];
            notes.forEach((freq, idx) => {
              const startT = t + idx * 0.09;
              const osc = this.ctx.createOscillator();
              const gain = this.ctx.createGain();
              osc.type = "sawtooth";
              osc.frequency.setValueAtTime(freq, startT);
              gain.gain.setValueAtTime(0.32, startT);
              gain.gain.exponentialRampToValueAtTime(0.01, startT + 0.32);
              osc.connect(gain);
              gain.connect(this.sfxGain);
              osc.start(startT);
              osc.stop(startT + 0.33);
            });
            break;
          }
          case "guard_block": {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = "triangle";
            osc.frequency.setValueAtTime(1200, t);
            osc.frequency.exponentialRampToValueAtTime(320, t + 0.18);
            gain.gain.setValueAtTime(0.45, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.18);
            osc.connect(gain);
            gain.connect(this.sfxGain);
            osc.start(t);
            osc.stop(t + 0.18);
            break;
          }
          case "sword_clash": {
            // Metallic blade clashing in melee combat
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = "sawtooth";
            osc.frequency.setValueAtTime(1600 + Math.random() * 400, t);
            osc.frequency.exponentialRampToValueAtTime(280, t + 0.12);
            gain.gain.setValueAtTime(0.28, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.12);
            osc.connect(gain);
            gain.connect(this.sfxGain);
            osc.start(t);
            osc.stop(t + 0.12);
            break;
          }
          case "troop_recruit": {
            // Noble brass fanfare for new soldier entering the field
            const notes = [440.0, 554.37, 659.25];
            notes.forEach((freq, idx) => {
              const startT = t + idx * 0.07;
              const osc = this.ctx.createOscillator();
              const gain = this.ctx.createGain();
              osc.type = "triangle";
              osc.frequency.setValueAtTime(freq, startT);
              gain.gain.setValueAtTime(0.26, startT);
              gain.gain.exponentialRampToValueAtTime(0.01, startT + 0.22);
              osc.connect(gain);
              gain.connect(this.sfxGain);
              osc.start(startT);
              osc.stop(startT + 0.23);
            });
            break;
          }
        }
      } catch (e) {
        // audio context safety
      }
    }

    setMasterVolume(val) {
      this.settings.masterVolume = Math.max(0, Math.min(1, val));
      this.saveSettings();
      this.applyGains();
      this.syncUI();
    }

    setMasterEnabled(bool) {
      this.settings.masterEnabled = bool;
      this.saveSettings();
      this.applyGains();
      this.syncUI();
      const soundBtn = document.getElementById("btn-sound");
      if (soundBtn) soundBtn.textContent = bool ? "🔊" : "🔇";
    }

    setMusicVolume(val) {
      this.settings.musicVolume = Math.max(0, Math.min(1, val));
      this.saveSettings();
      this.applyGains();
      this.syncUI();
    }

    setMusicEnabled(bool) {
      this.settings.musicEnabled = bool;
      this.saveSettings();
      this.applyGains();
      if (bool && !this.musicPlaying) {
        this.startMusic();
      } else if (!bool && this.musicPlaying) {
        this.stopMusic();
      }
      this.syncUI();
    }

    setSfxVolume(val) {
      this.settings.sfxVolume = Math.max(0, Math.min(1, val));
      this.saveSettings();
      this.applyGains();
      this.syncUI();
    }

    setSfxEnabled(bool) {
      this.settings.sfxEnabled = bool;
      this.saveSettings();
      this.applyGains();
      this.syncUI();
    }

    setTowerSfxEnabled(bool) {
      this.settings.towerSfxEnabled = bool;
      this.saveSettings();
      this.syncUI();
    }

    setEnemySfxEnabled(bool) {
      this.settings.enemySfxEnabled = bool;
      this.saveSettings();
      this.syncUI();
    }

    resetDefaults() {
      this.settings = {
        masterEnabled: true,
        masterVolume: 0.8,
        musicEnabled: true,
        musicVolume: 0.65,
        sfxEnabled: true,
        sfxVolume: 0.8,
        towerSfxEnabled: true,
        enemySfxEnabled: true
      };
      this.saveSettings();
      this.applyGains();
      if (this.settings.musicEnabled && !this.musicPlaying) {
        this.startMusic();
      }
      this.syncUI();
    }

    syncUI() {
      const s = this.settings;
      const masterSlider = document.getElementById("slider-master-volume");
      if (masterSlider) masterSlider.value = Math.round(s.masterVolume * 100);
      const masterVal = document.getElementById("val-master-volume");
      if (masterVal) masterVal.textContent = Math.round(s.masterVolume * 100) + "%";

      const masterToggle = document.getElementById("toggle-master-sound");
      if (masterToggle) masterToggle.checked = s.masterEnabled;

      const bgmSlider = document.getElementById("slider-bgm-volume");
      if (bgmSlider) bgmSlider.value = Math.round(s.musicVolume * 100);
      const bgmVal = document.getElementById("val-bgm-volume");
      if (bgmVal) bgmVal.textContent = Math.round(s.musicVolume * 100) + "%";

      const bgmToggle = document.getElementById("toggle-bgm");
      if (bgmToggle) bgmToggle.checked = s.musicEnabled;

      const sfxSlider = document.getElementById("slider-sfx-volume");
      if (sfxSlider) sfxSlider.value = Math.round(s.sfxVolume * 100);
      const sfxVal = document.getElementById("val-sfx-volume");
      if (sfxVal) sfxVal.textContent = Math.round(s.sfxVolume * 100) + "%";

      const sfxToggle = document.getElementById("toggle-sfx");
      if (sfxToggle) sfxToggle.checked = s.sfxEnabled;

      const towerToggle = document.getElementById("toggle-tower-sfx");
      if (towerToggle) towerToggle.checked = s.towerSfxEnabled;

      const enemyToggle = document.getElementById("toggle-enemy-sfx");
      if (enemyToggle) enemyToggle.checked = s.enemySfxEnabled;

      const soundBtn = document.getElementById("btn-sound");
      if (soundBtn) soundBtn.textContent = s.masterEnabled ? "🔊" : "🔇";
    }
  }

  // --- TRANSLATION DICTIONARY ---
  const I18N = {
    ar: {
      wave: "الموجة",
      castleName: "قلعة المجد العريضة",
      repair: "إصلاح",
      meteor: "شهب",
      guardCall: "نداء الحرس",
      freeze: "صقيع",
      startWave: "ابدأ الموجة القادمة ⚔️",
      shopTitle: "ترسانة الدفاع",
      shopHint: "اختر سلاحاً ثم اضغط فوق أسوار وأبراج القلعة العريضة",
      tabTowers: "أبراج القلعة",
      tabArmy: "جيش الميدان",
      armyTitle: "فيلق الجيش الملكي",
      armyHint: "اضغط لتجنيد وإرسال المقاتلين لمواجهة وسحق الغزاة في الطريق",
      unitSwordsman: "المشاة الملكي",
      unitSwordsmanDesc: "سيف ودرع • صمود متقدم",
      unitArcher: "رماة السهام",
      unitArcherDesc: "رمي عن بعد • قذائف سريعة",
      unitPaladin: "الفارس الثقيل",
      unitPaladinDesc: "درع فولاذي • صحة 580",
      unitCavalier: "فرسان الخيالة",
      unitCavalierDesc: "صدمة سريعة • هجوم ساحق",
      unitWarChariot: "منجنيق الميدان",
      unitWarChariotDesc: "قذائف متفجرة • سحق جماعي",
      formationFront: "تشكيل: جدار أمامي",
      formationFlank: "تشكيل: حماية جانبية",
      formationWedge: "تشكيل: هجوم الوتد",
      catWeapons: "الأسلحة 🏹",
      catWeaponsSub: "أبراج ودفاعات القلعة",
      catArmy: "الجيش ⚔️",
      catArmySub: "قوات الميدان والتشكيلات",
      weaponsDrawerTitle: "ترسانة الأسلحة وأبراج القلعة",
      armyDrawerTitle: "فيلق الجيش وقوات الميدان",
      quickWeaponTitle: "إحضار سلاح 🏹",
      quickArmyTitle: "إحضار جيش ⚔️",
      quickWeaponHint: "تجهيز فوري • 100 🪙",
      quickArmyHint: "استدعاء فوري • 35 🪙",
      uiSimplified: "مبسط ⚡",
      uiDetailed: "تفصيلي ⚙️",
      cancel: "إلغاء التحديد ✕",
      wpnArcher: "رماة السهام",
      wpnArcherDesc: "سريع • مهدئ",
      wpnCannon: "مدفع الحصار",
      wpnCannonDesc: "انفجار • ضرر جماعي",
      wpnBallista: "قاذف الباليستا",
      wpnBallistaDesc: "مدى بعيد • خارق للدروع",
      wpnFlame: "قاذف النيران",
      wpnFlameDesc: "حرق مستمر • يبطئ",
      wpnTesla: "برج الصواعق",
      wpnTeslaDesc: "صاعقة متشعبة • صدمة",
      wpnCatapult: "المنجنيق الصخري",
      wpnCatapultDesc: "صخور عملاقة • سحق",
      enemyFast: "كشاف الظلال السريع",
      enemyArmored: "الفارس المدرع الفولاذي",
      enemyMassive: "العملاق الصخري الضخم",
      damage: "الضرر",
      fireRate: "سرعة الرمي",
      range: "المدى",
      kills: "الأعداء المقضي عليهم",
      targetPriority: "أولوية الاستهداف:",
      targetFirst: "الأول",
      targetClosest: "الأقرب",
      targetStrongest: "الأقوى",
      targetWeakest: "الأضعف",
      upgrade: "ترقية",
      sell: "بيع السلاح",
      finalWave: "الموجة المكتملة:",
      finalScore: "النتيجة النهائية:",
      enemiesDefeated: "إجمالي الأعداء:",
      playAgain: "معركة جديدة ⚔️",
      filesTitle: "ملفات المشروع المنفصلة (HTML / CSS / JS)",
      filesSubtitle: "جاهزة للحزم في APK أو التصدير لأي محاكي (Zalith Launcher / Cordova / Web)",
      settingsTitle: "إعدادات الصوتيات واللعبة",
      settingsSubtitle: "التحكم بالموسيقى الملحمية ومؤثرات الأبراج والأعداء",
      masterAudio: "🔊 الصوت العام (Master)",
      bgmTitle: "🎵 الموسيقى الملحمية (Epic BGM)",
      bgmTrack: "سيمفونية القلعة ⚔️",
      playMusic: "▶️ تشغيل الموسيقى",
      stopMusic: "⏹️ إيقاف",
      sfxTitle: "💥 المؤثرات الصوتية (SFX)",
      towerSfx: "مؤثرات الأبراج والأسلحة",
      towerSfxDesc: "سهام، قذائف مدافع، صواعق، نيران",
      enemySfx: "مؤثرات الأعداء والقلعة",
      enemySfxDesc: "ضربات السور، دروع الفرسان، خطى العمالقة",
      testSfx: "تجربة المؤثرات:",
      testCannon: "💣 مدفع",
      testArrow: "🏹 سهم",
      testTesla: "⚡ صاعقة",
      testHit: "🛡️ ضربة سور",
      testHorn: "📯 بوق معركة",
      resetAudio: "إعادة الضبط الافتراضي 🔄",
      saveClose: "حفظ وإغلاق ✓",
      victoryTitle: "تم دحر الغزاة بنجاح! 🏆",
      victorySub: "صمدت قلعتك العريضة أمام أمواج الأعداء العاتية!",
      defeatTitle: "سقطت أسوار القلعة! ⚔️",
      defeatSub: "اقتحم الغزاة البوابات، أعد بناء دفاعاتك وحاول ثانية!",
      bossAlertTag: "زعيم الموجة",
      bossIncomingSub: "إنذار طوارئ الحرب: اقتراب زعيم الغزاة!",
      bossRecommendedTowers: "الأسلحة الموصى بها لهزيمته:",
      bossInfernoName: "قائد الجحيم الناري (بيغيموث)",
      bossInfernoDesc: "وحش بركاني سريع ذو صحة هائلة ومناعة ضد النيران، يشن اندفاعات حارقة متتالية!",
      bossInfernoTip: "محصن ضد النار! يتطلب الباليستا الخارقة والمدافع الثقيلة وصقيع التجميد لإيقافه.",
      bossPhantomName: "سيد الظلال الشبحية المندفع",
      bossPhantomDesc: "شبح فائق السرعة يراوغ 65% من السهام والقذائف الفيزيائية بحركات خفية خاطفة!",
      bossPhantomTip: "يتطلب أبراج تسلا الكهربائية لصعقه وإلغاء مراوغته، مع قاذفات اللهب لكشف جسده.",
      bossDreadnoughtName: "المدمرة الحديدية المدرعة الهائلة",
      bossDreadnoughtDesc: "آلة حرب عملاقة مصفحة بصفائح صلب تصد 80% من الضربات العادية وتهدم الأسوار!",
      bossDreadnoughtTip: "استخدم مدافع الحصار والمنجنيق لسحق صفائحه، مع صواعق تسلا المخترقة للحديد.",
      bossTempestName: "ملكة عواصف التنانين الهوائية",
      bossTempestDesc: "زعيم جوي سريع يحلق فوق الأرض بحاجز رياح عاتية يحرف القذائف البطيئة!",
      bossTempestTip: "يتطلب قواذف الباليستا السريعة المضادة للطيران وصواعق تسلا المتشعبة لإسقاطها.",
      bossChaosName: "إمبراطور الفوضى والدمار الجبار",
      bossChaosDesc: "الزعيم الأسطوري النهائي! يبدل بين درع الحمم والدرع الحركي، ويندفع بجنون عند انخفاض صحته!",
      bossChaosTip: "يتطلب ترسانة دفاعية شاملة: مدافع + باليستا + تسلا + قاذف لهب مع كافة التعاويذ السحرية!",
      bestiaryTitle: "موسوعة الأعداء والدليل التكتيكي",
      bestiarySubtitle: "معلومات شاملة عن نقاط قوة وضعف كافة الغزاة وتشكيلات الأسلحة المضادة لهم",
      bestiarySearchPlaceholder: "بحث عن عدو أو زعيم...",
      bestiaryTabAll: "الكل 📋",
      bestiaryTabBoss: "الزعماء 👑",
      bestiaryTabArmored: "مدرع 🛡️",
      bestiaryTabFast: "سريع ⚡",
      bestiaryTabFlying: "طائر 🐉",
      bestiaryTabMassive: "عمالقة 🗿",
      bestiaryTabStandard: "مشاة 👺",
      statHp: "الصحة",
      statSpeed: "السرعة",
      statCastleDmg: "ضرر السور",
      statGold: "المكافأة",
      strengthsTitle: "نقاط القوة والميزات:",
      weaknessesTitle: "نقاط الضعف:",
      countersTitle: "الأبراج والتعاويذ الفعالة:",
      bestiaryShowing: "عرض",
      bestiaryOf: "من أصل",
      bestiaryEnemiesRegistered: "نوع عدو مسجل في سجلات الحصن",
      bestiaryNoResults: "لم يتم العثور على أعداء يطابقون بحثك!",
      achievementsTitle: "سجل الإنجازات والبطولات",
      achievementsHeader: "سجل الإنجازات والبطولات الحربية",
      achievementsSub: "حقق الأهداف لكسب الجوائز الذهبية والأوسمة الإمبراطورية",
      achievementsCompleted: "الإنجازات المكتملة:",
      achievementsTotalRewards: "مجموع الجوائز:",
      achievementUnlockedBadge: "مُحقق ✓",
      achievementLockedBadge: "قيد الإنجاز ⏳",
      achievementUnlockedToast: "🏆 إنجاز جديد مُحقق!",
      weatherTitle: "نظام الطقس والمناخ التكتيكي",
      weatherSubtitle: "المناخ يؤثر حركياً على سرعة الأعداء وقوة الأبراج",
      weatherManualSelect: "موسوعة أنماط الطقس والتبديل اليدوي",
      weatherClear: "صافٍ ومشمس",
      weatherRain: "عاصفة رعدية ممطرة",
      weatherSnow: "عاصفة ثلجية جليدية",
      weatherFog: "ضباب كثيف غامض",
      weatherSandstorm: "عاصفة رملية نارية",
      weatherActivateBtn: "تفعيل هذا الطقس ⚡",
      weatherActiveBadge: "الطقس النشط حالياً ✓"
    },
    en: {
      wave: "Wave",
      castleName: "Grand Iron Fortress",
      repair: "Repair",
      meteor: "Meteor",
      guardCall: "Guard Call",
      freeze: "Freeze",
      startWave: "Start Next Wave ⚔️",
      shopTitle: "Defense Arsenal",
      shopHint: "Select weapon then tap castle ramparts and battlements",
      tabTowers: "Fortress Towers",
      tabArmy: "Field Army",
      armyTitle: "Royal Army Corps",
      armyHint: "Tap to recruit and deploy troops to clash with invaders on the highway",
      unitSwordsman: "Royal Infantry",
      unitSwordsmanDesc: "Sword & Shield • Frontline",
      unitArcher: "Royal Archer",
      unitArcherDesc: "Ranged Volley • High Speed",
      unitPaladin: "Heavy Paladin",
      unitPaladinDesc: "Steel Armor • 580 HP",
      unitCavalier: "Royal Cavalier",
      unitCavalierDesc: "Fast Charge • High Impact",
      unitWarChariot: "War Chariot",
      unitWarChariotDesc: "Siege Mortar • AoE Blast",
      formationFront: "Formation: Front Wall",
      formationFlank: "Formation: Flank Guard",
      formationWedge: "Formation: Wedge Assault",
      catWeapons: "Weapons 🏹",
      catWeaponsSub: "Castle Towers & Defense",
      catArmy: "Army ⚔️",
      catArmySub: "Field Forces & Formations",
      weaponsDrawerTitle: "Weapons & Castle Towers",
      armyDrawerTitle: "Royal Army & Field Forces",
      quickWeaponTitle: "Deploy Weapon 🏹",
      quickArmyTitle: "Deploy Army ⚔️",
      quickWeaponHint: "Instant Equip • 100 🪙",
      quickArmyHint: "Instant Summon • 35 🪙",
      uiSimplified: "Simple ⚡",
      uiDetailed: "Detailed ⚙️",
      cancel: "Cancel Selection ✕",
      wpnArcher: "Archer Garrison",
      wpnArcherDesc: "Fast • Rapid Fire",
      wpnCannon: "Siege Cannon",
      wpnCannonDesc: "Explosive • AoE Blast",
      wpnBallista: "Sniper Ballista",
      wpnBallistaDesc: "Long Range • Armor Pierce",
      wpnFlame: "Dragon Flame",
      wpnFlameDesc: "Continuous Burn • Slows",
      wpnTesla: "Tesla Spire",
      wpnTeslaDesc: "Chain Lightning • Stun",
      wpnCatapult: "Mortar Catapult",
      wpnCatapultDesc: "Heavy Boulders • Crush",
      enemyFast: "Shadow Sprinter",
      enemyArmored: "Ironclad Knight",
      enemyMassive: "Mountain Colossus",
      damage: "Damage",
      fireRate: "Fire Rate",
      range: "Range",
      kills: "Enemies Defeated",
      targetPriority: "Targeting:",
      targetFirst: "First",
      targetClosest: "Closest",
      targetStrongest: "Strongest",
      targetWeakest: "Weakest",
      upgrade: "Upgrade",
      sell: "Sell Weapon",
      finalWave: "Wave Completed:",
      finalScore: "Final Score:",
      enemiesDefeated: "Total Defeated:",
      playAgain: "Battle Again ⚔️",
      filesTitle: "Separated Project Files (HTML / CSS / JS)",
      filesSubtitle: "Ready for APK packaging or running in Zalith Launcher & WebViews",
      settingsTitle: "Audio & Game Settings",
      settingsSubtitle: "Epic BGM, tower weapons & enemy sound effects",
      masterAudio: "🔊 Master Audio",
      bgmTitle: "🎵 Epic Background Music (BGM)",
      bgmTrack: "Fortress Symphony ⚔️",
      playMusic: "▶️ Play Music",
      stopMusic: "⏹️ Stop",
      sfxTitle: "💥 Sound Effects (SFX)",
      towerSfx: "Tower & Defense Weapons SFX",
      towerSfxDesc: "Arrows, cannons, tesla lightning, flame",
      enemySfx: "Enemy & Castle Impacts SFX",
      enemySfxDesc: "Wall hits, armor deflections, colossus steps",
      testSfx: "Test Sound Effects:",
      testCannon: "💣 Cannon",
      testArrow: "🏹 Arrow",
      testTesla: "⚡ Tesla",
      testHit: "🛡️ Wall Hit",
      testHorn: "📯 War Horn",
      resetAudio: "Reset Defaults 🔄",
      saveClose: "Save & Close ✓",
      victoryTitle: "Victory! Fortress Defended! 🏆",
      victorySub: "Your massive castle withstood all enemy siege assaults!",
      defeatTitle: "Castle Walls Breached! ⚔️",
      defeatSub: "Enemies stormed the keep. Rebuild your defenses and try again!",
      bossAlertTag: "WAVE BOSS",
      bossIncomingSub: "CITADEL EMERGENCY: BOSS APPROACHING!",
      bossRecommendedTowers: "Recommended Weapon Arsenal:",
      bossInfernoName: "Inferno Behemoth",
      bossInfernoDesc: "Massive volcanic titan immune to fire with scorching high-speed charges!",
      bossInfernoTip: "Immune to fire! Requires piercing Ballistas, heavy Cannons and Blizzard freeze.",
      bossPhantomName: "Phantom Shadow Lord",
      bossPhantomDesc: "Ultra-fast specter dodging 65% physical attacks with ethereal phasing!",
      bossPhantomTip: "Tesla Lightning Towers are mandatory to electrocute & break dodge phase!",
      bossDreadnoughtName: "Ironclad Dreadnought",
      bossDreadnoughtDesc: "Colossal war machine with heavy steel plates deflecting 80% physical damage!",
      bossDreadnoughtTip: "Focus Siege Cannons & Catapults to crack armor, plus Tesla conduct.",
      bossTempestName: "Storm Tempest Monarch",
      bossTempestDesc: "Fast aerial dragon monarch deflecting slow projectiles with gale barriers!",
      bossTempestTip: "Deploy anti-air Ballistas for high velocity plus Tesla chain lightning.",
      bossChaosName: "Chaos Titan Emperor",
      bossChaosDesc: "The Ultimate Overlord! Cycles between Magma and Kinetic shields, berserking at low HP!",
      bossChaosTip: "Requires a fully balanced arsenal: Cannons + Ballista + Tesla + Flamethrower + Spells!",
      bestiaryTitle: "Enemy Bestiary & Tactical Guide",
      bestiarySubtitle: "Comprehensive weaknesses, strengths, and optimal tower counters for all invaders",
      bestiarySearchPlaceholder: "Search enemy or boss...",
      bestiaryTabAll: "All 📋",
      bestiaryTabBoss: "Bosses 👑",
      bestiaryTabArmored: "Armored 🛡️",
      bestiaryTabFast: "Fast ⚡",
      bestiaryTabFlying: "Flying 🐉",
      bestiaryTabMassive: "Giants 🗿",
      bestiaryTabStandard: "Standard 👺",
      statHp: "Health",
      statSpeed: "Speed",
      statCastleDmg: "Wall Damage",
      statGold: "Reward",
      strengthsTitle: "Strengths & Perks:",
      weaknessesTitle: "Weaknesses:",
      countersTitle: "Effective Towers & Spells:",
      bestiaryShowing: "Showing",
      bestiaryOf: "of",
      bestiaryEnemiesRegistered: "registered invaders in citadel archives",
      bestiaryNoResults: "No enemies found matching your search!",
      achievementsTitle: "Achievements & Trophies",
      achievementsHeader: "Citadel Achievements & Badges",
      achievementsSub: "Complete battle feats to earn gold rewards and imperial badges",
      achievementsCompleted: "Achievements Completed:",
      achievementsTotalRewards: "Total Earned Rewards:",
      achievementUnlockedBadge: "Unlocked ✓",
      achievementLockedBadge: "In Progress ⏳",
      achievementUnlockedToast: "🏆 Achievement Unlocked!",
      weatherTitle: "Tactical Weather System",
      weatherSubtitle: "Dynamic climate affects enemy movement and tower potency",
      weatherManualSelect: "Weather Encyclopedia & Manual Control",
      weatherClear: "Clear & Sunny",
      weatherRain: "Thunderstorm",
      weatherSnow: "Frost Blizzard",
      weatherFog: "Dense Fog",
      weatherSandstorm: "Desert Sandstorm",
      weatherActivateBtn: "Activate Climate ⚡",
      weatherActiveBadge: "Currently Active ✓"
    }
  };

  // --- WEAPON DATA TEMPLATES ---
  const WEAPON_TYPES = {
    archer: {
      id: "archer",
      nameKey: "wpnArcher",
      icon: "🏹",
      cost: 100,
      range: 190,
      damage: 26,
      fireRate: 1.4, // attacks per sec
      color: "#2ecc71",
      projectileSpeed: 650,
      aoe: 0,
      type: "arrow",
      upgrades: [
        { cost: 90, damage: 45, range: 215, fireRate: 1.8, desc: "Dual Arrows" },
        { cost: 160, damage: 80, range: 240, fireRate: 2.3, desc: "Flaming Volley" }
      ]
    },
    cannon: {
      id: "cannon",
      nameKey: "wpnCannon",
      icon: "💣",
      cost: 175,
      range: 220,
      damage: 75,
      fireRate: 0.65,
      color: "#e67e22",
      projectileSpeed: 420,
      aoe: 65,
      type: "cannonball",
      upgrades: [
        { cost: 150, damage: 135, range: 250, fireRate: 0.8, aoe: 85, desc: "Heavy Shrapnel" },
        { cost: 240, damage: 220, range: 280, fireRate: 1.0, aoe: 110, desc: "Atomic Siege Bomb" }
      ]
    },
    ballista: {
      id: "ballista",
      nameKey: "wpnBallista",
      icon: "🎯",
      cost: 225,
      range: 310,
      damage: 130,
      fireRate: 0.5,
      color: "#00e5ff",
      projectileSpeed: 900,
      aoe: 0,
      pierce: 3,
      type: "bolt",
      upgrades: [
        { cost: 180, damage: 240, range: 350, fireRate: 0.65, pierce: 5, desc: "Steel Tip Drill" },
        { cost: 290, damage: 410, range: 390, fireRate: 0.8, pierce: 7, desc: "Dragon Piercer" }
      ]
    },
    flamethrower: {
      id: "flamethrower",
      nameKey: "wpnFlame",
      icon: "🔥",
      cost: 250,
      range: 155,
      damage: 18, // per tick
      fireRate: 4.5,
      color: "#e74c3c",
      type: "flame",
      upgrades: [
        { cost: 190, damage: 32, range: 175, fireRate: 5.5, desc: "Hellfire Stream" },
        { cost: 300, damage: 55, range: 195, fireRate: 6.5, desc: "Infernal Blaze" }
      ]
    },
    tesla: {
      id: "tesla",
      nameKey: "wpnTesla",
      icon: "⚡",
      cost: 300,
      range: 200,
      damage: 90,
      fireRate: 0.75,
      color: "#9b59b6",
      chain: 3,
      type: "lightning",
      upgrades: [
        { cost: 230, damage: 160, range: 230, chain: 5, fireRate: 0.9, desc: "Overcharged Arc" },
        { cost: 360, damage: 270, range: 260, chain: 7, fireRate: 1.1, desc: "Storm King Conduit" }
      ]
    },
    catapult: {
      id: "catapult",
      nameKey: "wpnCatapult",
      icon: "☄️",
      cost: 350,
      range: 290,
      damage: 150,
      fireRate: 0.4,
      color: "#d35400",
      projectileSpeed: 340,
      aoe: 80,
      type: "boulder",
      upgrades: [
        { cost: 260, damage: 260, range: 320, aoe: 105, fireRate: 0.5, desc: "Magma Core" },
        { cost: 420, damage: 450, range: 360, aoe: 135, fireRate: 0.65, desc: "Meteor Trebuchet" }
      ]
    }
  };

  // --- GRAND BATTLEFIELD IMPERIAL HIGHWAY LANES ---
  // A wide, straight, unified military avenue where enemy and friendly armies march and clash head-on
  const BATTLEFIELD_PATHS = [
    {
      id: "road_lane_0",
      nameAr: "مسار الطريق الشمالي",
      nameEn: "Upper War Highway",
      waypoints: [
        { rx: 1.05, ry: 0.44 },
        { rx: 0.82, ry: 0.44 },
        { rx: 0.60, ry: 0.45 },
        { rx: 0.42, ry: 0.47 },
        { rx: 0.285, ry: 0.50 }
      ]
    },
    {
      id: "road_lane_1",
      nameAr: "قلب الطريق الإمبراطوري",
      nameEn: "Imperial Highway Center",
      waypoints: [
        { rx: 1.05, ry: 0.48 },
        { rx: 0.82, ry: 0.48 },
        { rx: 0.60, ry: 0.49 },
        { rx: 0.42, ry: 0.50 },
        { rx: 0.285, ry: 0.50 }
      ]
    },
    {
      id: "road_lane_2",
      nameAr: "المسار الأوسط الجنوبي",
      nameEn: "Central Highway Flank",
      waypoints: [
        { rx: 1.05, ry: 0.52 },
        { rx: 0.82, ry: 0.52 },
        { rx: 0.60, ry: 0.51 },
        { rx: 0.42, ry: 0.50 },
        { rx: 0.285, ry: 0.50 }
      ]
    },
    {
      id: "road_lane_3",
      nameAr: "مسار الطريق الجنوبي",
      nameEn: "Lower War Highway",
      waypoints: [
        { rx: 1.05, ry: 0.56 },
        { rx: 0.82, ry: 0.56 },
        { rx: 0.60, ry: 0.54 },
        { rx: 0.42, ry: 0.52 },
        { rx: 0.285, ry: 0.50 }
      ]
    }
  ];

  // --- ROYAL FIELD ARMY DEFINITIONS (وحدات الجيش الملكي الميداني) ---
  const ALLIED_UNIT_TYPES = {
    swordsman: {
      id: "swordsman",
      nameAr: "المشاة الملكي",
      nameEn: "Royal Infantry",
      icon: "⚔️",
      cost: 35,
      hp: 280,
      damage: 28,
      speed: 68,
      range: 34,
      attackInterval: 0.8,
      radius: 14,
      isRanged: false,
      color: "#3498db"
    },
    archer: {
      id: "archer",
      nameAr: "رماة السهام الإمبراطوري",
      nameEn: "Royal Archer",
      icon: "🏹",
      cost: 50,
      hp: 160,
      damage: 24,
      speed: 55,
      range: 190,
      attackInterval: 0.9,
      radius: 13,
      isRanged: true,
      color: "#2ecc71"
    },
    paladin: {
      id: "paladin",
      nameAr: "الفارس الثقيل",
      nameEn: "Heavy Paladin",
      icon: "🛡️",
      cost: 75,
      hp: 580,
      damage: 45,
      speed: 46,
      range: 36,
      attackInterval: 0.95,
      radius: 17,
      isRanged: false,
      color: "#f1c40f"
    },
    cavalier: {
      id: "cavalier",
      nameAr: "فرسان الخيالة",
      nameEn: "Royal Cavalier",
      icon: "🐎",
      cost: 95,
      hp: 420,
      damage: 65,
      speed: 110,
      range: 38,
      attackInterval: 0.75,
      radius: 18,
      isRanged: false,
      color: "#9b59b6"
    },
    war_chariot: {
      id: "war_chariot",
      nameAr: "منجنيق الميدان الملكي",
      nameEn: "War Machine Chariot",
      icon: "⚙️",
      cost: 130,
      hp: 480,
      damage: 75,
      speed: 40,
      range: 220,
      attackInterval: 1.4,
      radius: 20,
      isRanged: true,
      aoe: 70,
      color: "#e67e22"
    }
  };

  // --- CASTLE WEAPON SLOT LAYOUT (Relative to canvas dimensions) ---
  // Strategically distributed on the massive fortress ramparts and towers
  const SLOT_CONFIGS = [
    // North High Tower (Top Balconies)
    { id: "slot_n_high1", rx: 0.11, ry: 0.18, label: "برج الشمال الأعلى" },
    { id: "slot_n_high2", rx: 0.17, ry: 0.22, label: "شرفة الشمال" },

    // Upper Rampart & Middle Bastion
    { id: "slot_wall_top", rx: 0.23, ry: 0.27, label: "السور العلوي" },
    { id: "slot_keep_mid", rx: 0.13, ry: 0.39, label: "الحصن الملكي" },
    { id: "slot_wall_mid1", rx: 0.24, ry: 0.42, label: "شرفة السور الأوسط" },

    // Gatehouse Overlook (Directly defending the gate)
    { id: "slot_gate_top", rx: 0.26, ry: 0.53, label: "أعلى بوابة الحصن" },
    { id: "slot_gate_low", rx: 0.23, ry: 0.63, label: "متراس البوابة" },

    // Lower Rampart & South Tower
    { id: "slot_wall_low1", rx: 0.24, ry: 0.72, label: "السور الجنوبي" },
    { id: "slot_s_high1", rx: 0.16, ry: 0.78, label: "شرفة الجنوب" },
    { id: "slot_s_high2", rx: 0.11, ry: 0.83, label: "برج الجنوب السفلي" },

    // Forward Moat Defensive Bastions (Strategic forward gun platforms)
    { id: "slot_fwd_top", rx: 0.28, ry: 0.35, label: "منصة الخندق العليا" },
    { id: "slot_fwd_bot", rx: 0.28, ry: 0.68, label: "منصة الخندق السفلى" }
  ];

  // --- ENEMY DEFINITIONS ---
  const ENEMY_TYPES = {
    // 1. FAST ENEMY (عدو سريع)
    fast_runner: {
      name: "Shadow Sprinter",
      nameKey: "enemyFast",
      category: "fast",
      hp: 95,
      speed: 165,
      gold: 20,
      score: 40,
      radius: 12,
      color: "#00d2d3",
      damageToCastle: 20,
      dodgeChance: 0.22,
      sprintInterval: 2.6,
      icon: "⚡"
    },

    // 2. ARMORED ENEMY (عدو مدرع)
    armored_knight: {
      name: "Ironclad Knight",
      nameKey: "enemyArmored",
      category: "armored",
      hp: 580,
      speed: 42,
      gold: 50,
      score: 100,
      radius: 19,
      armor: 0.65, // Deflects 65% physical damage, weak to elemental/fire
      color: "#718093",
      damageToCastle: 65,
      icon: "🛡️"
    },

    // 3. MASSIVE ENEMY (عدو ضخم)
    colossus_giant: {
      name: "Mountain Colossus",
      nameKey: "enemyMassive",
      category: "massive",
      hp: 2400,
      speed: 25,
      gold: 180,
      score: 450,
      radius: 34,
      armor: 0.25,
      damageToCastle: 380, // Heavy structural impact on castle
      slowResistance: 0.65, // Resists freeze/slow duration
      icon: "🗿",
      color: "#d35400"
    },

    // Standard & Specialized invaders
    goblin: {
      name: "Goblin Scout",
      category: "swarm",
      hp: 75,
      speed: 85,
      gold: 14,
      score: 25,
      radius: 12,
      color: "#27ae60",
      damageToCastle: 25,
      icon: "👺"
    },
    orc: {
      name: "Orc Raider",
      category: "infantry",
      hp: 170,
      speed: 65,
      gold: 24,
      score: 50,
      radius: 16,
      color: "#d35400",
      damageToCastle: 45,
      icon: "👹"
    },
    shield: {
      name: "Shield Bearer",
      category: "armored",
      hp: 340,
      speed: 48,
      gold: 40,
      score: 85,
      radius: 18,
      armor: 0.45,
      color: "#7f8c8d",
      damageToCastle: 60,
      icon: "🛡️"
    },
    wolf: {
      name: "Wolf Rider",
      category: "fast",
      hp: 140,
      speed: 130,
      gold: 30,
      score: 65,
      radius: 14,
      color: "#8e44ad",
      damageToCastle: 40,
      icon: "🐺"
    },
    sorcerer: {
      name: "Dark Sorcerer",
      category: "ranged",
      hp: 220,
      speed: 55,
      gold: 45,
      score: 95,
      radius: 15,
      color: "#2c3e50",
      ranged: true,
      range: 260,
      damageToCastle: 70,
      icon: "🧙"
    },
    ram: {
      name: "Siege Ram",
      category: "massive",
      hp: 950,
      speed: 35,
      gold: 85,
      score: 220,
      radius: 26,
      color: "#8854d0",
      damageToCastle: 260,
      icon: "🪵"
    },
    wyvern: {
      name: "Wyvern Flyer",
      category: "flying",
      hp: 290,
      speed: 95,
      gold: 50,
      score: 120,
      flying: true,
      radius: 17,
      color: "#eb3b5a",
      damageToCastle: 80,
      icon: "🐉"
    },
    // --- SPECIALIZED BOSS WAVE ENEMIES (Every 5th Wave) ---
    boss_inferno: {
      name: "Inferno Behemoth",
      nameKey: "bossInfernoName",
      descKey: "bossInfernoDesc",
      tipKey: "bossInfernoTip",
      isBoss: true,
      category: "massive",
      bossTheme: "inferno",
      hp: 5500,
      speed: 105,
      gold: 350,
      score: 1200,
      radius: 42,
      color: "#e74c3c",
      damageToCastle: 650,
      slowResistance: 0.2, // Vulnerable to slow/ice
      icon: "🔥",
      recommendedCombo: ["🎯 باليستا خارقة", "💣 مدفع الحصار", "❄️ تعويذة الصقيع"],
      recommendedComboEn: ["🎯 Sniper Ballista", "💣 Siege Cannon", "❄️ Blizzard Freeze"]
    },
    boss_phantom: {
      name: "Phantom Shadow Lord",
      nameKey: "bossPhantomName",
      descKey: "bossPhantomDesc",
      tipKey: "bossPhantomTip",
      isBoss: true,
      category: "fast",
      bossTheme: "phantom",
      hp: 11500,
      speed: 155,
      gold: 480,
      score: 1900,
      radius: 38,
      color: "#9b59b6",
      damageToCastle: 850,
      dodgeChance: 0.65,
      sprintInterval: 1.6,
      icon: "👻",
      recommendedCombo: ["⚡ برج تسلا للصواعق", "🔥 قاذف النيران", "🏹 رماة السهام"],
      recommendedComboEn: ["⚡ Tesla Spire", "🔥 Dragon Flame", "🏹 Archer Garrison"]
    },
    boss_dreadnought: {
      name: "Ironclad Dreadnought",
      nameKey: "bossDreadnoughtName",
      descKey: "bossDreadnoughtDesc",
      tipKey: "bossDreadnoughtTip",
      isBoss: true,
      category: "armored",
      bossTheme: "dreadnought",
      hp: 24000,
      speed: 55,
      gold: 650,
      score: 2800,
      radius: 46,
      armor: 0.80,
      color: "#7f8c8d",
      damageToCastle: 1200,
      icon: "🛡️",
      recommendedCombo: ["💣 مدفع الحصار", "☄️ المنجنيق الصخري", "⚡ برج تسلا"],
      recommendedComboEn: ["💣 Siege Cannon", "☄️ Mortar Catapult", "⚡ Tesla Spire"]
    },
    boss_tempest: {
      name: "Storm Tempest Monarch",
      nameKey: "bossTempestName",
      descKey: "bossTempestDesc",
      tipKey: "bossTempestTip",
      isBoss: true,
      category: "flying",
      bossTheme: "tempest",
      hp: 36000,
      speed: 130,
      gold: 800,
      score: 3800,
      flying: true,
      radius: 44,
      color: "#00d2d3",
      damageToCastle: 1600,
      icon: "🌪️",
      recommendedCombo: ["🎯 قاذف الباليستا", "⚡ برج تسلا", "🏹 رماة السهام"],
      recommendedComboEn: ["🎯 Sniper Ballista", "⚡ Tesla Spire", "🏹 Archer Garrison"]
    },
    boss_chaos: {
      name: "Chaos Titan Emperor",
      nameKey: "bossChaosName",
      descKey: "bossChaosDesc",
      tipKey: "bossChaosTip",
      isBoss: true,
      category: "massive",
      bossTheme: "chaos",
      hp: 68000,
      speed: 85,
      gold: 1400,
      score: 6500,
      radius: 52,
      color: "#8e44ad",
      damageToCastle: 2500,
      slowResistance: 0.5,
      icon: "👑",
      recommendedCombo: ["💣 مدافع", "🎯 باليستا", "⚡ تسلا", "🔥 قاذف اللهب", "☄️ نيازك"],
      recommendedComboEn: ["💣 Cannons", "🎯 Ballista", "⚡ Tesla", "🔥 Flame", "☄️ Meteors"]
    },
    boss_golem: {
      name: "Titan Warlord",
      isBoss: true,
      category: "massive",
      hp: 3800,
      speed: 28,
      gold: 350,
      score: 1200,
      radius: 38,
      color: "#fa8231",
      damageToCastle: 500,
      slowResistance: 0.75,
      icon: "👑"
    }
  };

  // --- COMPREHENSIVE ENEMY BESTIARY (موسوعة الأعداء والدليل التكتيكي) ---
  const BESTIARY_DATA = [
    {
      id: "boss_inferno",
      category: "boss",
      isBoss: true,
      icon: "🔥",
      nameAr: "قائد الجحيم الناري (Inferno Behemoth)",
      nameEn: "Inferno Behemoth",
      descAr: "وحش بركاني سريع ذو صحة هائلة ومناعة مطلقة ضد النيران، يشن اندفاعات حارقة متتالية تهدد أسوار القلعة.",
      descEn: "Colossal volcanic titan entirely immune to fire, unleashing scorching dashes wrapped in infernal heat.",
      hp: 5500,
      speed: "105 px/s",
      damageToCastle: 650,
      gold: 350,
      strengthsAr: ["🔥 مناعة مطلقة ضد أسلحة النيران والاحتراق", "⚡ اندفاع تسارعي جنوني عند هبوط صحته لأقل من 50%", "❤️ صحة تفوق 5500 نقطة"],
      strengthsEn: ["🔥 100% Total Immunity to fire/burn damage", "⚡ Berserk sprint burst when HP drops below 50%", "❤️ Huge health pool (5500+ HP)"],
      weaknessesAr: ["🎯 قاذف الباليستا الخارق يلحق +85% ضرر بنواته", "💣 قذائف المدافع تسحق قشرته المنصهرة وتفتتها", "❄️ تعويذة الصقيع توقف اندفاعه السريع فوراً"],
      weaknessesEn: ["🎯 Armor-piercing Ballista deals +85% critical core damage", "💣 Heavy Cannon explosions fracture molten shell", "❄️ Blizzard Freeze halts its sprint charge"],
      countersAr: ["🎯 قاذف الباليستا", "💣 مدفع الحصار", "❄️ تعويذة الصقيع"],
      countersEn: ["🎯 Sniper Ballista", "💣 Siege Cannon", "❄️ Blizzard Freeze"]
    },
    {
      id: "boss_phantom",
      category: "boss",
      isBoss: true,
      icon: "👻",
      nameAr: "سيد الظلال الشبحية (Phantom Shadow Lord)",
      nameEn: "Phantom Shadow Lord",
      descAr: "طيف شبحي أسطوري فائق السرعة، يتلاشى في الأثير ليراوغ 65% من السهام والضربات الفيزيائية.",
      descEn: "Mythic ethereal specter dashing at extreme velocity, phasing between dimensions to dodge physical attacks.",
      hp: 11500,
      speed: "155 px/s",
      damageToCastle: 850,
      gold: 480,
      strengthsAr: ["💨 مراوغة 65% ضد السهام والقذائف الفيزيائية", "⚡ سرعة اندفاع 155 تفاجئ الدفاعات قبل اكتمال شحنها", "👻 يتجاوز خطوط النار برشاقة"],
      strengthsEn: ["💨 65% evasive phase dodge against physical weapons", "⚡ Blistering 155 base speed rushes defenses", "👻 Phantasmal form slips through volleys"],
      weaknessesAr: ["⚡ صواعق تسلا تصعقه وتلغي خاصية المراوغة لمدة 4 ثوانٍ كاملة!", "🔥 قاذف النيران يبطئ سرعته بنسبة 45% ويكشفه للرماة", "⚡ يتلقى +85% ضرر إضافي أثناء تفريغ الصدمة الكهربائية"],
      weaknessesEn: ["⚡ Tesla lightning shocks and DISRUPTS phantom dodge for 4.0s!", "🔥 Flamethrower slows speed by 45% and burns aura", "⚡ Receives +85% bonus damage while shocked"],
      countersAr: ["⚡ برج تسلا (أساسي)", "🔥 قاذف النيران", "🏹 رماة السهام"],
      countersEn: ["⚡ Tesla Spire (Mandatory)", "🔥 Dragon Flame", "🏹 Archer Garrison"]
    },
    {
      id: "boss_dreadnought",
      category: "boss",
      isBoss: true,
      icon: "🛡️",
      nameAr: "المدمرة الحديدية المدرعة (Ironclad Dreadnought)",
      nameEn: "Ironclad Dreadnought",
      descAr: "آلة حرب عملاقة مصفحة بصفائح صلب تصد 80% من الضربات العادية وتهدد بهدم أسوار القلعة بضربات ساحقة.",
      descEn: "Colossal war machine with heavy steel plates deflecting 80% physical damage to breach the citadel.",
      hp: 24000,
      speed: "55 px/s",
      damageToCastle: 1200,
      gold: 650,
      strengthsAr: ["🛡️ صفائح فولاذية تصد 80% من كافة الهجمات الفيزيائية", "❤️ صحة عملاقة تفوق 24,000 نقطة", "💥 ضرر هائل 1200 نقطة للسور عند الوصول"],
      strengthsEn: ["🛡️ Heavy steel plating deflects 80% physical damage", "❤️ Colossal 24,000 HP health bar", "💥 Catastrophic 1200 damage to castle"],
      weaknessesAr: ["💣 قذائف مدافع الحصار تمزق صفائحه الفولاذية وتقلل متانة درعه بشكل دائم!", "☄️ صخور المنجنيق تلحق ضرراً مضاعفاً 210% بالهيكل", "⚡ صواعق تسلا الكهربائية تنتشر في معدنه وتلحق +75% ضرر"],
      weaknessesEn: ["💣 Siege Cannon blasts permanently shred its armor plating!", "☄️ Catapult boulders deal +110% devastating crushing damage", "⚡ Tesla lightning conducts through steel for +75% bonus dmg"],
      countersAr: ["💣 مدفع الحصار", "☄️ المنجنيق الصخري", "⚡ برج تسلا"],
      countersEn: ["💣 Siege Cannon", "☄️ Mortar Catapult", "⚡ Tesla Spire"]
    },
    {
      id: "boss_tempest",
      category: "boss",
      isBoss: true,
      icon: "🌪️",
      nameAr: "ملكة عواصف التنانين (Storm Tempest Monarch)",
      nameEn: "Storm Tempest Monarch",
      descAr: "ملكة التنانين الجوية الهائلة، تثير دوامات هوائية تحرف 65% من القذائف المتفجرة وتحلق بسرعة متجاوزة الميدان.",
      descEn: "Grand storm dragon empress spinning whirlwind gale shields that deflect 65% of slow projectile barrages.",
      hp: 36000,
      speed: "130 px/s",
      damageToCastle: 1600,
      gold: 800,
      strengthsAr: ["🌪️ درع العاصفة يحرف 65% من القذائف المتفجرة البطيئة", "🐉 تحليق جوي سريع بسرعة 130 يتجاوز الخنادق", "❤️ صحة خرافية 36,000 نقطة"],
      strengthsEn: ["🌪️ Gale vortex deflects 65% of slow explosive artillery", "🐉 High-speed aerial flight (130 speed)", "❤️ Legendary 36,000 HP"],
      weaknessesAr: ["🎯 قاذف الباليستا يخترق أجنحتها بسرعة 950 px/s ويلحق +80% ضرر", "⚡ صواعق تسلا تصيبها مباشرة في الهواء وتتجاوز دوامات الرياح", "🏹 سهام الرماة السريعة تخترق عين العاصفة"],
      weaknessesEn: ["🎯 High-velocity Sniper Ballista (950 px/s) pierces wings for +80% dmg", "⚡ Tesla lightning bypasses wind barrier directly into heart", "🏹 Rapid-fire archer barrages puncture through gales"],
      countersAr: ["🎯 قاذف الباليستا", "⚡ برج تسلا", "🏹 رماة السهام"],
      countersEn: ["🎯 Sniper Ballista", "⚡ Tesla Spire", "🏹 Archer Garrison"]
    },
    {
      id: "boss_chaos",
      category: "boss",
      isBoss: true,
      icon: "👑",
      nameAr: "إمبراطور الفوضى والدمار (Chaos Titan Emperor)",
      nameEn: "Chaos Titan Emperor",
      descAr: "الزعيم الأسطوري النهائي! يبدل دورياً بين درع الحمم والدرع الحركي، ويندفع بسرعة هائجة عند انخفاض صحته.",
      descEn: "The supreme overlord! Cycles between Magma and Kinetic shields, berserking into blind fury at low HP.",
      hp: 68000,
      speed: "85 px/s",
      damageToCastle: 2500,
      gold: 1400,
      strengthsAr: ["🔮 درع الحمم يمتص 85% من هجمات النار والسحر", "🛡️ الدرع الحركي يصد 85% من الهجمات الفيزيائية والخارقة", "⚡ غضب هائج وانفجار سرعة عند نصف الصحة", "❤️ صحة أسطورية 68,000 نقطة"],
      strengthsEn: ["🔮 Magma Shield absorbs 85% of fire and magic", "🛡️ Kinetic Shield blocks 85% of physical & pierce attacks", "⚡ Berserk enraged speed boost under 50% HP", "❤️ Unstoppable 68,000 HP bar"],
      weaknessesAr: ["🔄 مراقبة لون الدرع الحالي واستخدام السلاح المضاد له فوراً!", "⚔️ استخدام الضرر الفيزيائي والباليستا والمدافع أثناء درع الحمم", "🔥 استخدام قاذف اللهب والصواعق والتعاويذ أثناء الدرع الحركي", "☄️ استخدام كافة تعاويذ النيازك والصقيع المتاحة في المعركة"],
      weaknessesEn: ["🔄 Watch active shield glow and counter with opposite damage type!", "⚔️ Strike with Physical / Ballista / Cannons during Magma Shield", "🔥 Strike with Flames / Tesla / Magic during Kinetic Shield", "☄️ Unleash all Meteor and Blizzard spells continuously"],
      countersAr: ["💣 مدافع الحصار", "🎯 قواذف الباليستا", "⚡ أبراج تسلا", "🔥 قاذف النيران", "☄️ تعاويذ النيازك"],
      countersEn: ["💣 Siege Cannons", "🎯 Sniper Ballistas", "⚡ Tesla Spires", "🔥 Dragon Flames", "☄️ Meteor Spells"]
    },
    {
      id: "fast_runner",
      category: "fast",
      isBoss: false,
      icon: "⚡",
      nameAr: "كشاف الظلال السريع (Shadow Sprinter)",
      nameEn: "Shadow Sprinter",
      descAr: "كشافة رشيقة يرتدون عباءات التخفي، ينطلقون بسرعات فائقة لمباغتة دفاعات القلعة قبل اكتمال نصب الأسلحة.",
      descEn: "Agile scouts cloaked in ethereal mantles, darting forward at blinding speeds to overrun the citadel before defenses are ready.",
      hp: 95,
      speed: "165 px/s",
      damageToCastle: 20,
      gold: 20,
      strengthsAr: ["⚡ اندفاع تسارعي كل 2.6 ثانية", "💨 مراوغة 22% ضد السهام العادية", "🏃 يصعب إصابته بالمقذوفات البطيئة"],
      strengthsEn: ["⚡ Sprint burst every 2.6s", "💨 22% dodge chance against physical arrows", "🏃 Evades slow mortar shells"],
      weaknessesAr: ["❄️ ضعيف أمام تجميد الصقيع", "🔥 قاذف النيران يبطل سرعته ويلحق ضرراً مستمراً", "⚡ صواعق تسلا تصيبه حتماً دون مراوغة"],
      weaknessesEn: ["❄️ Highly vulnerable to Freeze spell", "🔥 Dragon Flame burns away sprint speed", "⚡ Tesla chain lightning never misses"],
      countersAr: ["🔥 قاذف النيران", "⚡ برج تسلا", "❄️ تعويذة الصقيع"],
      countersEn: ["🔥 Dragon Flame", "⚡ Tesla Spire", "❄️ Blizzard Freeze"]
    },
    {
      id: "armored_knight",
      category: "armored",
      isBoss: false,
      icon: "🛡️",
      nameAr: "الفارس المدرع الفولاذي (Ironclad Knight)",
      nameEn: "Ironclad Knight",
      descAr: "فرسان نخبة مصفحون بدروع قوطية من الفولاذ المسقى، يتقدمون بثبات لحماية صفوف المشاة وحرف السهام.",
      descEn: "Elite vanguard clad in tempered gothic steel, marching relentlessly to shield infantry units and deflect arrows.",
      hp: 580,
      speed: "42 px/s",
      damageToCastle: 65,
      gold: 50,
      strengthsAr: ["🛡️ صد 65% من الضرر الفيزيائي والسهام", "⚔️ تقدم ثابت لا يتأثر بالرياح", "🧱 يشكل جداراً دفاعياً لحماية الأعداء خلفه"],
      strengthsEn: ["🛡️ Deflects 65% physical arrow damage", "⚔️ Steadfast unflinching advance", "🧱 Frontline meatshield for weaker units"],
      weaknessesAr: ["🎯 قاذف الباليستا يخترق دروعه ويتجاوز الصد", "🔥 يتلقى +35% ضرر إضافي من قاذف النيران", "⚡ ينقل الصعق الكهربائي عبر معدن درعه"],
      weaknessesEn: ["🎯 Sniper Ballista pierces through heavy armor", "🔥 Takes +35% bonus damage from Flamethrower", "⚡ Steel conducts lethal Tesla shocks"],
      countersAr: ["🎯 قاذف الباليستا", "🔥 قاذف النيران", "💣 مدفع الحصار"],
      countersEn: ["🎯 Sniper Ballista", "🔥 Dragon Flame", "💣 Siege Cannon"]
    },
    {
      id: "colossus_giant",
      category: "massive",
      isBoss: false,
      icon: "🗿",
      nameAr: "العملاق الصخري الضخم (Mountain Colossus)",
      nameEn: "Mountain Colossus",
      descAr: "عملاق قديم منحوت من صخور الجرانيت والبازلت المنصهر، كل خطوة منه تزلزل الأرض وتهدد بانهيار السور.",
      descEn: "Ancient monolith carved from granite and basalt, each colossal stride trembling the earth and threatening the wall.",
      hp: 2400,
      speed: "25 px/s",
      damageToCastle: 380,
      gold: 180,
      strengthsAr: ["❤️ صحة هائلة (2400+ نقطة)", "💥 يلحق 380 ضرراً مدمراً بسور القلعة عند الوصول", "🛡️ مقاومة عالية لتعاويذ الإبطاء بنسبة 65%"],
      strengthsEn: ["❤️ Massive health pool (2400+ HP)", "💥 Deals catastrophic 380 damage to castle wall", "🛡️ Resists slow and freeze durations by 65%"],
      weaknessesAr: ["🎯 حجم ضخم جداً يسهل استهدافه بكافة الأسلحة", "💣 يتلقى +20% ضرراً إضافياً من الانفجارات الجماعية", "☄️ صخور المنجنيق والنيازك تحطم بنيته الصخرية"],
      weaknessesEn: ["🎯 Huge hitbox easily targeted by all weapons", "💣 Vulnerable to explosive AoE (+20% bonus dmg)", "☄️ Catapult boulders & Meteors crush its stone core"],
      countersAr: ["💣 مدفع الحصار", "☄️ المنجنيق الصخري", "🎯 قاذف الباليستا"],
      countersEn: ["💣 Siege Cannon", "☄️ Mortar Catapult", "🎯 Sniper Ballista"]
    },
    {
      id: "wyvern",
      category: "flying",
      isBoss: false,
      icon: "🐉",
      nameAr: "التنين المجنح الطائر (Wyvern Flyer)",
      nameEn: "Wyvern Flyer",
      descAr: "زواحف مجنحة محلقة تتجاوز الخنادق والحواجز الأرضية وتنقض مباشرة من السماء على القلعة.",
      descEn: "Winged draconian flyers soaring over moats and ground traps to assault ramparts from the sky.",
      hp: 290,
      speed: "95 px/s",
      damageToCastle: 80,
      gold: 50,
      strengthsAr: ["🐉 طيران جوي يتجاهل الحمم والفخاخ الأرضية", "💨 سرعة تحليق عالية متوازنة"],
      strengthsEn: ["🐉 Aerial flight ignores ground hazards & moat", "💨 Fast cruising air speed"],
      weaknessesAr: ["🎯 قاذف الباليستا المضاد للطيران يصطاده بدقة", "⚡ صواعق تسلا تصعقه في الهواء", "🏹 رماة السهام يقصفونه بسهام سريعة"],
      weaknessesEn: ["🎯 Sniper Ballista bolts track and impale wings", "⚡ Tesla lightning reaches high into the sky", "🏹 Archer Garrison pepper it down"],
      countersAr: ["🎯 قاذف الباليستا", "⚡ برج تسلا", "🏹 رماة السهام"],
      countersEn: ["🎯 Sniper Ballista", "⚡ Tesla Spire", "🏹 Archer Garrison"]
    },
    {
      id: "ram",
      category: "massive",
      isBoss: false,
      icon: "🪵",
      nameAr: "كبش الدك الهجومي (Siege Ram)",
      nameEn: "Siege Ram",
      descAr: "آلة حصار خشبية ثقيلة برأس فولاذي مدبب، مصممة خصيصاً لتهشيم بوابات الحصن في ضربات ساحقة.",
      descEn: "Heavy reinforced battering ram engineered solely to shatter the fortress drawbridge in devastating strikes.",
      hp: 950,
      speed: "35 px/s",
      damageToCastle: 260,
      gold: 85,
      strengthsAr: ["🪵 هيكل خشبي سميك مدعم", "💥 يلحق 260 ضرراً بالسور عند الوصول"],
      strengthsEn: ["🪵 Dense wooden structural chassis", "💥 Inflicts massive 260 damage on wall contact"],
      weaknessesAr: ["🔥 هيكل الخشب سريع الاشتعال بقاذف النيران", "💣 قذائف المدافع والمنجنيق تحطمه في منتصف الطريق"],
      weaknessesEn: ["🔥 Highly flammable to Flamethrower streams", "💣 Siege cannons and catapults demolish chassis"],
      countersAr: ["🔥 قاذف النيران", "💣 مدفع الحصار", "☄️ المنجنيق"],
      countersEn: ["🔥 Dragon Flame", "💣 Siege Cannon", "☄️ Mortar Catapult"]
    },
    {
      id: "sorcerer",
      category: "standard",
      isBoss: false,
      icon: "🧙",
      nameAr: "الساحر المظلم (Dark Sorcerer)",
      nameEn: "Dark Sorcerer",
      descAr: "كهنة سحر أسود يطلقون مقذوفات لعنة مظلمة من مسافة بعيدة ضد أسوار القلعة والأبراج الدفاعية.",
      descEn: "Shadow spellcasters launching dark sorcery bolts from long distance directly at the fortress ramparts.",
      hp: 220,
      speed: "55 px/s",
      damageToCastle: 70,
      gold: 45,
      strengthsAr: ["🔮 هجوم عن بعد بمدى 260 بكسل دون الحاجة لملامسة السور", "💥 ضرر سحري مرتفع للقلعة"],
      strengthsEn: ["🔮 Long range caster (260px range)", "💥 High magical wall siege damage"],
      weaknessesAr: ["💔 صحة منخفضة للغاية", "🎯 يسقط بضربة واحدة من قاذف الباليستا بعيد المدى"],
      weaknessesEn: ["💔 Very fragile hit points", "🎯 Sniped instantly by high-range Ballista"],
      countersAr: ["🎯 قاذف الباليستا", "⚡ برج تسلا"],
      countersEn: ["🎯 Sniper Ballista", "⚡ Tesla Spire"]
    },
    {
      id: "wolf",
      category: "fast",
      isBoss: false,
      icon: "🐺",
      nameAr: "فارس الذئاب المفترس (Wolf Rider)",
      nameEn: "Wolf Rider",
      descAr: "خيالة سريعة تمتطي ذئاباً برية متوحشة، تتجاوز خطوط النار وتسعى لاقتحام الخندق في ثوانٍ معدودة.",
      descEn: "Feral cavalry riding vicious battle wolves, outpacing standard defensive fire to leap straight at the moat.",
      hp: 140,
      speed: "130 px/s",
      damageToCastle: 40,
      gold: 30,
      strengthsAr: ["🐺 سرعة عالية تتفوق على معظم الأعداء", "⚡ يباغت الدفاعات أثناء إعادة شحن الأسلحة"],
      strengthsEn: ["🐺 Blazing movement speed", "⚡ Exploits slow weapon recharge windows"],
      weaknessesAr: ["⚡ صواعق تسلا تصيبه وتشل تقدمه", "🏹 رماة السهام السريعون يقضون عليه قبل الاقتراب"],
      weaknessesEn: ["⚡ Tesla lightning chains through pack instantly", "🏹 Rapid-fire Archers take him down at distance"],
      countersAr: ["⚡ برج تسلا", "🏹 رماة السهام"],
      countersEn: ["⚡ Tesla Spire", "🏹 Archer Garrison"]
    },
    {
      id: "shield",
      category: "armored",
      isBoss: false,
      icon: "🛡️",
      nameAr: "حامل الدرع المعزز (Shield Bearer)",
      nameEn: "Shield Bearer",
      descAr: "جنود يحملون دروعاً ضخمة معززة بصفائح حديدية لحماية الصفوف الأمامية وامتصاص القذائف المباشرة.",
      descEn: "Shielded shocktroopers carrying towering bulwarks to protect the front ranks from missile volleys.",
      hp: 340,
      speed: "48 px/s",
      damageToCastle: 60,
      gold: 40,
      strengthsAr: ["🛡️ امتصاص 45% من الضرر المباشر", "🧱 درع صامد أمام رماة السهام"],
      strengthsEn: ["🛡️ Absorbs 45% frontal physical damage", "🧱 Hard counter to basic archers"],
      weaknessesAr: ["💣 القذائف المنحنية من المنجنيق تسقط خلف درعه", "🔥 قاذف النيران يحرق الدرع الخشبي"],
      weaknessesEn: ["💣 Catapult high-arc boulders bypass frontal shield", "🔥 Dragon Flame scorches through wooden frame"],
      countersAr: ["☄️ المنجنيق الصخري", "🔥 قاذف النيران"],
      countersEn: ["☄️ Mortar Catapult", "🔥 Dragon Flame"]
    },
    {
      id: "orc",
      category: "standard",
      isBoss: false,
      icon: "👹",
      nameAr: "المحارب الأوركي (Orc Raider)",
      nameEn: "Orc Raider",
      descAr: "مقاتلو خطوط المواجهة الأشداء، يتمتعون بصحة متوازنة وقوة هجومية مباشرة على بوابات القلعة.",
      descEn: "Brutal frontline skirmishers balancing sturdy resilience and aggressive direct assault on citadel gates.",
      hp: 170,
      speed: "65 px/s",
      damageToCastle: 45,
      gold: 24,
      strengthsAr: ["💪 صحة متوازنة ومقاومة للضربات الفردية", "⚔️ ضرر معتبر للسور"],
      strengthsEn: ["💪 Balanced health against single hits", "⚔️ Decent damage to castle wall"],
      weaknessesAr: ["🚫 لا يمتلك درعاً أو مراوغة خاصة", "🔥 قاذف النيران يلتهم أعدادهم المتجمعة"],
      weaknessesEn: ["🚫 No defensive armor plating or dodge", "🔥 Flamethrower incinerates clustered squads"],
      countersAr: ["🏹 رماة السهام", "🔥 قاذف النيران"],
      countersEn: ["🏹 Archer Garrison", "🔥 Dragon Flame"]
    },
    {
      id: "goblin",
      category: "standard",
      isBoss: false,
      icon: "👺",
      nameAr: "كشاف الغيلان (Goblin Scout)",
      nameEn: "Goblin Scout",
      descAr: "غزاة مشاة من قبائل الغيلان البرية، يهاجمون في موجات وأفواج مستمرة لإشغال الأبراج الدفاعية.",
      descEn: "Wild infantry raiders swarming in dense packs to distract and overwhelm perimeter defenses.",
      hp: 75,
      speed: "85 px/s",
      damageToCastle: 25,
      gold: 14,
      strengthsAr: ["👥 أعداد متكاثرة وسريعة الانتشار", "💨 حركة رشيقة بين المسارات"],
      strengthsEn: ["👥 Swarming numbers", "💨 Agile movement across roads"],
      weaknessesAr: ["💔 صحة متدنية للغاية", "🏹 يسقط سريعاً برماة السهام والانفجارات الخفيفة"],
      weaknessesEn: ["💔 Very low base health", "🏹 Collapses instantly to Archers & splash"],
      countersAr: ["🏹 رماة السهام", "💣 مدفع الحصار"],
      countersEn: ["🏹 Archer Garrison", "💣 Siege Cannon"]
    }
  ];

  // --- CITADEL ACHIEVEMENTS DEFINITIONS (نظام الإنجازات والبطولات الحربية) ---
  const ACHIEVEMENT_DEFINITIONS = [
    {
      id: "first_blood",
      icon: "⚔️",
      titleAr: "أول قطرة دماء",
      titleEn: "First Blood",
      descAr: "اقضِ على أول عدو يهاجم أسوار القلعة",
      descEn: "Defeat your first enemy invader",
      target: 1,
      reward: 50,
      getProgress: (g) => g.totalEnemiesKilled
    },
    {
      id: "slayer_50",
      icon: "🏹",
      titleAr: "صائد الغزاة",
      titleEn: "Invader Hunter",
      descAr: "اقضِ على 50 عدواً من الغزاة",
      descEn: "Defeat 50 enemy invaders",
      target: 50,
      reward: 100,
      getProgress: (g) => g.totalEnemiesKilled
    },
    {
      id: "slayer_100",
      icon: "💀",
      titleAr: "قاهر الجيوش (100 عدو)",
      titleEn: "Army Crusher (100 Enemies)",
      descAr: "اقضِ على 100 عدو من الغزاة المهاجمين",
      descEn: "Defeat 100 enemy invaders in battle",
      target: 100,
      reward: 200,
      getProgress: (g) => g.totalEnemiesKilled
    },
    {
      id: "slayer_250",
      icon: "☠️",
      titleAr: "سفاح المعارك الأسطوري",
      titleEn: "Legendary Slayer",
      descAr: "اقضِ على 250 عدواً في مجمل المعارك",
      descEn: "Defeat 250 enemy invaders in total",
      target: 250,
      reward: 400,
      getProgress: (g) => g.totalEnemiesKilled
    },
    {
      id: "survive_wave_5",
      icon: "🛡️",
      titleAr: "صمود الحصن (الموجة 5)",
      titleEn: "Hold the Line (Wave 5)",
      descAr: "اصمد وتجاوز بنجاح الموجة الخامسة الأولى",
      descEn: "Survive and successfully complete Wave 5",
      target: 5,
      reward: 120,
      getProgress: (g) => g.highestWaveCompleted
    },
    {
      id: "survive_wave_10",
      icon: "🏰",
      titleAr: "الصمود حتى الموجة 10",
      titleEn: "Fortress Bastion (Wave 10)",
      descAr: "اصمد ودافع عن أسوار القلعة حتى الموجة 10",
      descEn: "Survive and successfully complete Wave 10",
      target: 10,
      reward: 250,
      getProgress: (g) => g.highestWaveCompleted
    },
    {
      id: "survive_wave_20",
      icon: "👑",
      titleAr: "عرش النصر (الموجة 20)",
      titleEn: "Iron Throne (Wave 20)",
      descAr: "اصمد وتصدى لهجمات الغزاة حتى الموجة 20",
      descEn: "Survive and successfully complete Wave 20",
      target: 20,
      reward: 500,
      getProgress: (g) => g.highestWaveCompleted
    },
    {
      id: "boss_killer",
      icon: "🔥",
      titleAr: "صائد الزعماء الأسطوري",
      titleEn: "Boss Slayer",
      descAr: "اهزم أول زعيم من زعماء المعارك الأسطورية",
      descEn: "Defeat your first epic boss encounter",
      target: 1,
      reward: 300,
      getProgress: (g) => g.bossesDefeatedCount
    },
    {
      id: "tower_architect",
      icon: "🏗️",
      titleAr: "المهندس الحربي",
      titleEn: "Citadel Architect",
      descAr: "شيد 6 أبراج حربية في نفس الوقت على أسوار القلعة",
      descEn: "Construct 6 defense towers simultaneously",
      target: 6,
      reward: 150,
      getProgress: (g) => g.towers.length
    },
    {
      id: "tower_master",
      icon: "⭐",
      titleAr: "سلاح المجد الأقصى",
      titleEn: "Masterwork Citadel",
      descAr: "قم بترقية أي برج دفاعي إلى المستوى 3 الأقصى",
      descEn: "Upgrade any tower to maximum Level 3",
      target: 1,
      reward: 180,
      getProgress: (g) => g.maxTowerLevelReached >= 3 ? 1 : 0
    },
    {
      id: "spellcaster",
      icon: "🔮",
      titleAr: "سيد التعاويذ التكتيكية",
      titleEn: "Grand Archmage",
      descAr: "ألقِ 5 تعاويذ سحرية (إصلاح السور، نيازك، أو صقيع)",
      descEn: "Cast 5 spells (Repair, Meteors, or Freeze)",
      target: 5,
      reward: 140,
      getProgress: (g) => g.spellsCastCount
    },
    {
      id: "gold_hoarder",
      icon: "💰",
      titleAr: "خازن الذهب الإمبراطوري",
      titleEn: "Citadel Treasury",
      descAr: "اجمع رصيداً يبلغ 1000 قطعة ذهبية في خزانة الحصن",
      descEn: "Accumulate 1000 gold in your citadel treasury",
      target: 1000,
      reward: 200,
      getProgress: (g) => Math.floor(g.gold)
    }
  ];

  // --- DYNAMIC WEATHER TYPES DEFINITION (أنماط وتأثيرات الطقس والمناخ) ---
  const WEATHER_TYPES = {
    clear: {
      id: "clear",
      icon: "☀️",
      nameAr: "صافٍ ومشمس",
      nameEn: "Clear & Sunny",
      descAr: "أجواء مثالية وهادئة، تعمل كافة الأبراج والأعداء بكفاءتها القياسية المعتادة دون أي تعديل مناخي.",
      descEn: "Standard atmospheric conditions. All towers and invaders operate at default base parameters.",
      badgeClass: "state-clear",
      modBadgeAr: "قياسي 100%",
      modBadgeEn: "Normal 100%",
      tint: "rgba(255, 235, 180, 0.04)",
      enemySpeedMod: 1.0,
      towerRangeMod: 1.0,
      teslaDmgMod: 1.0,
      teslaChainMod: 0,
      flameDmgMod: 1.0,
      ballistaDmgMod: 1.0,
      tacticsAr: [
        { text: "توازن حربي كامل: ضرر وسرعة قياسية لكافة الوحدات", type: "neutral" },
        { text: "أجواء مثالية ومستقرة لكافة تشكيلات الأبراج", type: "buff" }
      ],
      tacticsEn: [
        { text: "Perfect balance: all combat units at standard specs", type: "neutral" },
        { text: "Stable conditions for all defense strategies", type: "buff" }
      ]
    },
    rain: {
      id: "rain",
      icon: "🌧️",
      nameAr: "عاصفة رعدية ممطرة",
      nameEn: "Thunderstorm",
      descAr: "أمطار غزيرة ورعود متتالية؛ الأرض الموحلة تبطئ الغزاة بنسبة 10%، ورطوبة الماء توصل صواعق تسلا بقوة (+25%) لكنها تخمد لهب النيران (-20%).",
      descEn: "Heavy torrential rain and thunder. Mud slows infantry by 10%, and wet air conducts Tesla electricity (+25%) while dampening flamethrowers (-20%).",
      badgeClass: "state-rain",
      modBadgeAr: "+25% صواعق | -10% حركة",
      modBadgeEn: "+25% Tesla | -10% Speed",
      tint: "rgba(18, 30, 52, 0.22)",
      enemySpeedMod: 0.90, // ground enemies slowed 10%
      towerRangeMod: 1.0,
      teslaDmgMod: 1.25, // +25% Tesla power
      teslaChainMod: 2, // +2 chain links
      flameDmgMod: 0.80, // -20% flame doused
      ballistaDmgMod: 1.0,
      tacticsAr: [
        { text: "⚡ برج الصواعق: +25% ضرر و +2 سلسلة تفريغ كهربائي إضافية", type: "buff" },
        { text: "🌧️ الأرض المبتلة: إبطاء سرعة الأعداء الأرضيين بنسبة 10%", type: "buff" },
        { text: "🔥 قاذف النيران: انخفاض الضرر بنسبة 20% بسبب المطر", type: "debuff" }
      ],
      tacticsEn: [
        { text: "⚡ Tesla Spire: +25% Damage & +2 extra chain arcs", type: "buff" },
        { text: "🌧️ Muddy Ground: Ground invaders slowed by 10%", type: "buff" },
        { text: "🔥 Flamethrower: -20% Damage doused by rain", type: "debuff" }
      ]
    },
    snow: {
      id: "snow",
      icon: "❄️",
      nameAr: "عاصفة ثلجية جليدية",
      nameEn: "Frost Blizzard",
      descAr: "صقيع قارس ورياح متجمدة؛ انخفاض حاد في سرعة كافة الأعداء بنسبة 20%، وتتعرض الوحوش المجمدة لضرر صدمة حرارية مضاعفة من قاذف النيران (+20%)!",
      descEn: "Biting frost and swirling snow. Severe 20% speed drop on all enemies, with thermal-shock bonus damage from fire (+20%)!",
      badgeClass: "state-snow",
      modBadgeAr: "-20% سرعة الأعداء 🥶",
      modBadgeEn: "-20% Enemy Speed 🥶",
      tint: "rgba(170, 215, 255, 0.12)",
      enemySpeedMod: 0.80, // 20% slow
      towerRangeMod: 1.0,
      teslaDmgMod: 1.0,
      teslaChainMod: 0,
      flameDmgMod: 1.20, // thermal melting shock!
      ballistaDmgMod: 1.0,
      tacticsAr: [
        { text: "🥶 البرد القارس: انخفاض سرعة جميع الأعداء بنسبة 20%", type: "buff" },
        { text: "🔥 قاذف النيران: +20% ضرر تذويب الجليد والصدمة الحرارية", type: "buff" },
        { text: "❄️ تعويذة الصقيع: انخفاض تكلفة المانا ومدى أكبر", type: "buff" }
      ],
      tacticsEn: [
        { text: "🥶 Freezing Chill: All enemy speeds reduced by 20%", type: "buff" },
        { text: "🔥 Flamethrower: +20% Thermal-shock melt damage", type: "buff" },
        { text: "❄️ Blizzard Spell: Reduced mana cost & boosted chill", type: "buff" }
      ]
    },
    fog: {
      id: "fog",
      icon: "🌫️",
      nameAr: "ضباب كثيف غامض",
      nameEn: "Dense Fog",
      descAr: "ضباب كثيف يغطي أرض المعركة مقللاً مدى إطلاق الأبراج بنسبة 15%، لكن قاذف الباليستا يمتلك مناظير حرارية خارقة للدروع (+25% ضرر)! ",
      descEn: "Thick mystical shroud reduces tower attack range by 15%, but Ballista Snipers gain infrared armor-piercing optics (+25% damage)!",
      badgeClass: "state-fog",
      modBadgeAr: "-15% مدى | +25% باليستا",
      modBadgeEn: "-15% Range | +25% Ballista",
      tint: "rgba(185, 200, 215, 0.18)",
      enemySpeedMod: 1.0,
      towerRangeMod: 0.85, // -15% tower range
      teslaDmgMod: 1.0,
      teslaChainMod: 0,
      flameDmgMod: 1.0,
      ballistaDmgMod: 1.25, // +25% Ballista sniper infrared
      tacticsAr: [
        { text: "👁️ انعدام الرؤية: انخفاض مدى هجوم الأبراج بنسبة 15%", type: "debuff" },
        { text: "🎯 باليستا خارقة: تصويب حراري نافذ يتجاهل دروع الغزاة (+25% ضرر)", type: "buff" }
      ],
      tacticsEn: [
        { text: "👁️ Shrouded View: Tower attack range decreased by 15%", type: "debuff" },
        { text: "🎯 Sniper Ballista: Infrared targeting deals +25% pierce damage", type: "buff" }
      ]
    },
    sandstorm: {
      id: "sandstorm",
      icon: "🌪️",
      nameAr: "عاصفة رملية نارية",
      nameEn: "Desert Sandstorm",
      descAr: "رياح صحراوية عاتية تجبر الأعداء على التقدم بصعوبة (-12% سرعة)، وتؤجج ألسنة نيران قاذف اللهب لتصبح حرائق مستعرة (+25% ضرر)!",
      descEn: "Furious desert gales push against advancing invaders (-12% speed) and violently fan Flamethrower fire (+25% damage)!",
      badgeClass: "state-sandstorm",
      modBadgeAr: "+25% نيران | -12% سرعة",
      modBadgeEn: "+25% Fire | -12% Speed",
      tint: "rgba(215, 130, 45, 0.16)",
      enemySpeedMod: 0.88, // -12% enemy speed
      towerRangeMod: 1.0,
      teslaDmgMod: 1.0,
      teslaChainMod: 0,
      flameDmgMod: 1.25, // +25% fire
      ballistaDmgMod: 1.0,
      tacticsAr: [
        { text: "🔥 قاذف النيران: رياح ساخنة تزيد ضرر الحرق بنسبة 25%", type: "buff" },
        { text: "💨 رياح معاكسة: إعاقة حركة الغزاة وإبطاؤهم بنسبة 12%", type: "buff" },
        { text: "☄️ المنجنيق: رمال متطايرة تزيد انتشار الشظايا الحجرية", type: "buff" }
      ],
      tacticsEn: [
        { text: "🔥 Flamethrower: Scorching winds fan fire damage by +25%", type: "buff" },
        { text: "💨 Headwinds: Strong desert air slows enemy advance by 12%", type: "buff" },
        { text: "☄️ Catapult: Flying gravel widens mortar blast footprint", type: "buff" }
      ]
    }
  };

  // --- MAIN GAME ENGINE CLASS ---
  class CastleTDGame {
    constructor() {
      this.canvas = document.getElementById("gameCanvas");
      this.ctx = this.canvas.getContext("2d");
      this.sound = new AudioManager(this);

      // Game state
      this.gold = 450;
      this.mana = 100;
      this.score = 0;
      this.castleMaxHp = 2500;
      this.castleHp = 2500;
      this.currentWave = 1;
      this.totalWaves = 25;
      this.speed = 1;
      this.isPaused = false;
      this.isGameOver = false;
      this.isVictory = false;
      this.waveActive = false;
      this.lang = "ar";

      // Elements collections
      this.slots = [];
      this.towers = [];
      this.enemies = [];
      this.projectiles = [];
      this.particles = [];
      this.floatingTexts = [];
      this.groundHazards = [];

      // Selection & Placement
      this.selectedShopWeapon = null;
      this.lastWeaponSelectTime = 0;
      this.inspectingTower = null;
      this.hoveredSlot = null;
      this.currentShopTab = "towers";
      this.isSimplifiedUI = false;
      this.activeCategoryDrawer = null;

      // Royal Field Army state (فيلق الجيش الملكي الميداني)
      this.allies = [];
      this.currentFormation = "front_wall"; // "front_wall", "flank_guard", "wedge_assault"
      this.draggingAlly = null;
      this.dragOffset = { x: 0, y: 0 };
      this.dragPointerId = null;

      // Royal Guards active state (نداء الحرس)
      this.guards = [];
      this.spellsCastCount = 0;

      // Spell cooldown timers
      this.spellCooldowns = {
        repair: 0,
        meteor: 0,
        guard: 0,
        blizzard: 0
      };

      // Spawning state
      this.waveEnemiesQueue = [];
      this.spawnTimer = 0;
      this.enemiesDefeatedCount = 0;
      this.activeBoss = null;
      this.bossWarningTimer = 0;

      // Screen shake
      this.screenShakeTime = 0;
      this.screenShakeIntensity = 0;

      // Ambient effects
      this.ambientTime = 0;
      this.flagsWavePhase = 0;

      // Bestiary encyclopedia state
      this.bestiaryFilter = "all";
      this.bestiarySearch = "";

      // Dynamic Weather System state
      this.currentWeather = "clear";
      this.weatherTimer = 0;
      this.weatherDuration = 55;
      this.weatherParticles = [];
      this.lightningTimer = 0;
      this.lightningFlash = 0;
      this.fogBands = [];
      this.weatherAlertTimeout = null;

      this.initDimensions();
      this.initSlots();
      this.initWeatherSystem();
      this.initUI();
      this.initEvents();
      this.updateWeatherUI();

      // Start loop
      this.lastTime = performance.now();
      requestAnimationFrame(this.gameLoop.bind(this));
    }

    initDimensions() {
      const dpr = window.devicePixelRatio || 1;
      this.width = window.innerWidth;
      this.height = window.innerHeight;
      this.canvas.width = this.width * dpr;
      this.canvas.height = this.height * dpr;
      this.ctx.scale(dpr, dpr);
    }

    initSlots() {
      this.slots = SLOT_CONFIGS.map(cfg => {
        return {
          id: cfg.id,
          rx: cfg.rx,
          ry: cfg.ry,
          label: cfg.label,
          x: cfg.rx * this.width,
          y: cfg.ry * this.height,
          tower: null,
          radius: 26
        };
      });
    }

    recalcSlotPositions() {
      this.slots.forEach(slot => {
        slot.x = slot.rx * this.width;
        slot.y = slot.ry * this.height;
        if (slot.tower) {
          slot.tower.x = slot.x;
          slot.tower.y = slot.y;
        }
      });
    }

    // --- USER INTERFACE & BINDINGS ---
    initUI() {
      this.updateHUD();
      this.updateShopCards();
      this.applyLocalization();
      this.sound.syncUI();
    }

    openSettingsModal() {
      document.getElementById("settings-modal").classList.remove("hidden");
      this.sound.syncUI();
    }

    closeSettingsModal() {
      document.getElementById("settings-modal").classList.add("hidden");
    }

    // --- DYNAMIC WEATHER SYSTEM (نظام الطقس والمناخ التكتيكي) ---
    initWeatherSystem() {
      const w = this.width || 1200;
      const h = this.height || 700;
      this.weatherParticles = [];

      for (let i = 0; i < 110; i++) {
        this.weatherParticles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: 0,
          vy: 0,
          size: 2,
          len: 16,
          alpha: 0.5,
          phase: Math.random() * Math.PI * 2,
          swaySpeed: 1.5,
          swayAmp: 20
        });
      }

      this.fogBands = [
        { yRel: 0.25, speed: 20, alpha: 0.18, width: 500, height: 160, x: 0 },
        { yRel: 0.50, speed: 28, alpha: 0.22, width: 620, height: 200, x: 250 },
        { yRel: 0.75, speed: 22, alpha: 0.18, width: 520, height: 180, x: 500 }
      ];

      this.resetWeatherParticles();
    }

    resetWeatherParticles() {
      const w = this.width || 1200;
      const h = this.height || 700;
      const wType = this.currentWeather;

      this.weatherParticles.forEach(p => {
        p.x = Math.random() * w;
        p.y = Math.random() * h;
        p.phase = Math.random() * Math.PI * 2;

        if (wType === "rain") {
          p.vx = -100 - Math.random() * 60;
          p.vy = 650 + Math.random() * 320;
          p.len = 15 + Math.random() * 15;
          p.alpha = 0.45 + Math.random() * 0.35;
          p.swayAmp = 0;
        } else if (wType === "snow") {
          p.vx = -35 - Math.random() * 35;
          p.vy = 45 + Math.random() * 55;
          p.size = 1.8 + Math.random() * 3.2;
          p.alpha = 0.45 + Math.random() * 0.45;
          p.swaySpeed = 1.2 + Math.random() * 1.8;
          p.swayAmp = 22 + Math.random() * 22;
        } else if (wType === "sandstorm") {
          p.vx = -420 - Math.random() * 280;
          p.vy = 25 + (Math.random() - 0.5) * 60;
          p.size = 1.5 + Math.random() * 2.5;
          p.alpha = 0.35 + Math.random() * 0.4;
          p.swayAmp = 0;
        } else {
          // Clear sunny motes
          p.vx = (Math.random() - 0.5) * 18;
          p.vy = -18 - Math.random() * 22;
          p.size = 1.8 + Math.random() * 2.4;
          p.alpha = 0.2 + Math.random() * 0.25;
          p.swaySpeed = 1.0 + Math.random() * 1.5;
          p.swayAmp = 12;
        }
      });
    }

    setWeather(weatherId, triggeredByWave = false) {
      if (!WEATHER_TYPES[weatherId]) weatherId = "clear";
      if (this.currentWeather === weatherId && triggeredByWave) return;

      this.currentWeather = weatherId;
      this.weatherTimer = 0;

      // Auditory immersion
      if (weatherId === "rain") {
        this.sound.play("thunder");
      } else if (weatherId === "snow" || weatherId === "sandstorm" || weatherId === "fog") {
        this.sound.play("wind");
      } else {
        this.sound.play("weather_change");
      }

      this.resetWeatherParticles();
      this.updateWeatherUI();
      this.showWeatherAlert(weatherId);

      // If modal is open, re-render immediately
      const weatherModal = document.getElementById("weather-modal");
      if (weatherModal && !weatherModal.classList.contains("hidden")) {
        this.renderWeatherModal();
      }
    }

    updateWeatherUI() {
      const data = WEATHER_TYPES[this.currentWeather] || WEATHER_TYPES.clear;
      const isAr = this.lang === "ar";

      const iconEl = document.getElementById("weather-icon");
      const nameEl = document.getElementById("weather-name");
      const modEl = document.getElementById("weather-mod-badge");
      const badgeEl = document.getElementById("weather-badge");

      if (iconEl) iconEl.textContent = data.icon;
      if (nameEl) nameEl.textContent = isAr ? data.nameAr : data.nameEn;
      if (modEl) modEl.textContent = isAr ? data.modBadgeAr : data.modBadgeEn;

      if (badgeEl) {
        badgeEl.className = "weather-badge " + (data.badgeClass || "state-clear");
      }
    }

    showWeatherAlert(weatherId) {
      const data = WEATHER_TYPES[weatherId] || WEATHER_TYPES.clear;
      const banner = document.getElementById("weather-alert-banner");
      if (!banner) return;

      const isAr = this.lang === "ar";
      const dict = I18N[this.lang];
      const iconEl = document.getElementById("weather-alert-icon");
      const titleEl = document.getElementById("weather-alert-title");
      const descEl = document.getElementById("weather-alert-desc");

      if (iconEl) iconEl.textContent = data.icon;
      if (titleEl) titleEl.textContent = `${dict.weatherAlertIntro || "تغير الطقس في ساحة المعركة:"} ${isAr ? data.nameAr : data.nameEn}`;
      if (descEl) descEl.textContent = isAr ? data.modBadgeAr : data.modBadgeEn;

      banner.classList.remove("hidden");

      if (this.weatherAlertTimeout) clearTimeout(this.weatherAlertTimeout);
      this.weatherAlertTimeout = setTimeout(() => {
        banner.classList.add("hidden");
      }, 3800);
    }

    openWeatherModal() {
      this.sound.play("weather_change");
      this.renderWeatherModal();
      const modal = document.getElementById("weather-modal");
      if (modal) modal.classList.remove("hidden");
    }

    closeWeatherModal() {
      const modal = document.getElementById("weather-modal");
      if (modal) modal.classList.add("hidden");
    }

    renderWeatherModal() {
      const hero = document.getElementById("current-weather-hero");
      const grid = document.getElementById("weather-types-grid");
      if (!hero || !grid) return;

      const isAr = this.lang === "ar";
      const dict = I18N[this.lang];
      const cur = WEATHER_TYPES[this.currentWeather] || WEATHER_TYPES.clear;

      // Render Hero Showcase
      const tacticPills = (isAr ? cur.tacticsAr : cur.tacticsEn).map(tac => {
        return `<span class="tactic-pill ${tac.type}">${tac.text}</span>`;
      }).join("");

      hero.innerHTML = `
        <div class="hero-weather-avatar">${cur.icon}</div>
        <div class="hero-weather-info">
          <span class="hero-weather-tag">${dict.weatherActiveBadge || "الطقس النشط حالياً ✓"}</span>
          <h3 class="hero-weather-title">${isAr ? cur.nameAr : cur.nameEn}</h3>
          <p class="hero-weather-desc">${isAr ? cur.descAr : cur.descEn}</p>
          <div class="hero-weather-tactics">${tacticPills}</div>
        </div>
      `;

      // Render All 5 Weather Cards in Grid
      grid.innerHTML = "";
      Object.keys(WEATHER_TYPES).forEach(wKey => {
        const wObj = WEATHER_TYPES[wKey];
        const isActive = wKey === this.currentWeather;
        const card = document.createElement("div");
        card.className = `weather-type-card ${isActive ? "active" : ""}`;

        const pills = (isAr ? wObj.tacticsAr : wObj.tacticsEn).map(t => {
          return `<div style="font-size: 0.68rem; color: #cbd5e1; display: flex; align-items: center; gap: 4px;">• ${t.text}</div>`;
        }).join("");

        card.innerHTML = `
          <div class="weather-card-header">
            <span class="weather-card-icon">${wObj.icon}</span>
            <div style="display: flex; flex-direction: column;">
              <span class="weather-card-name">${isAr ? wObj.nameAr : wObj.nameEn}</span>
              <span style="font-size: 0.66rem; color: #f1c40f; font-weight: 700;">${isAr ? wObj.modBadgeAr : wObj.modBadgeEn}</span>
            </div>
          </div>
          <p class="weather-card-desc">${isAr ? wObj.descAr : wObj.descEn}</p>
          <div style="display: flex; flex-direction: column; gap: 3px; margin: 4px 0;">${pills}</div>
          <button class="btn-set-weather" data-weather="${wKey}">
            ${isActive ? (dict.weatherActiveBadge || "الطقس النشط حالياً ✓") : (dict.weatherActivateBtn || "تفعيل هذا الطقس ⚡")}
          </button>
        `;

        const btn = card.querySelector(".btn-set-weather");
        if (btn && !isActive) {
          btn.addEventListener("click", () => {
            this.setWeather(wKey);
          });
        }

        grid.appendChild(card);
      });
    }

    updateWeather(dt) {
      this.weatherTimer += dt;
      const w = this.width;
      const h = this.height;

      // Natural climate shift every 55 seconds (if no active boss battle and not game over)
      if (this.weatherTimer >= this.weatherDuration && !this.activeBoss && !this.isGameOver) {
        const types = ["clear", "rain", "snow", "fog", "sandstorm"];
        const nextTypes = types.filter(t => t !== this.currentWeather);
        const chosen = nextTypes[Math.floor(Math.random() * nextTypes.length)];
        this.setWeather(chosen);
      }

      // Random thunderclap & lightning flash in rain
      if (this.currentWeather === "rain") {
        this.lightningTimer += dt;
        if (this.lightningTimer > 7.0) {
          if (Math.random() < 0.28) {
            this.lightningFlash = 0.82;
            this.sound.play("thunder");
            this.shakeScreen(3.5, 0.2);
            this.lightningTimer = 0;
          }
        }
      }

      if (this.lightningFlash > 0) {
        this.lightningFlash = Math.max(0, this.lightningFlash - dt * 2.8);
      }

      // Move fog bands across screen
      if (this.currentWeather === "fog") {
        this.fogBands.forEach(fb => {
          fb.x -= fb.speed * dt;
          if (fb.x < -fb.width) fb.x = w + 80;
        });
      }

      // Update particle positions
      this.weatherParticles.forEach(p => {
        p.phase = (p.phase || 0) + dt * (p.swaySpeed || 2);
        const sway = p.swayAmp ? Math.sin(p.phase) * (p.swayAmp * dt) : 0;

        p.x += (p.vx + sway) * dt;
        p.y += p.vy * dt;

        // Screen boundary wraps
        if (p.y > h + 20) {
          p.y = -20;
          p.x = Math.random() * w;
        } else if (p.y < -30) {
          p.y = h + 20;
          p.x = Math.random() * w;
        }

        if (p.x < -30) {
          p.x = w + 20;
          p.y = Math.random() * h;
        } else if (p.x > w + 30) {
          p.x = -20;
          p.y = Math.random() * h;
        }
      });
    }

    renderWeatherEffects() {
      const w = this.width;
      const h = this.height;
      const wData = WEATHER_TYPES[this.currentWeather] || WEATHER_TYPES.clear;

      // 1. Ambient atmospheric color tint wash
      if (wData.tint) {
        this.ctx.fillStyle = wData.tint;
        this.ctx.fillRect(0, 0, w, h);
      }

      // 2. Weather particles rendering
      if (this.currentWeather === "rain") {
        this.ctx.save();
        this.ctx.strokeStyle = "rgba(174, 214, 241, 0.65)";
        this.ctx.lineWidth = 1.6;
        this.ctx.lineCap = "round";
        this.weatherParticles.forEach(p => {
          this.ctx.beginPath();
          this.ctx.moveTo(p.x, p.y);
          this.ctx.lineTo(p.x - 5, p.y + (p.len || 18));
          this.ctx.stroke();
        });
        this.ctx.restore();
      } else if (this.currentWeather === "snow") {
        this.ctx.save();
        this.weatherParticles.forEach(p => {
          this.ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha || 0.6})`;
          this.ctx.beginPath();
          this.ctx.arc(p.x, p.y, p.size || 2.5, 0, Math.PI * 2);
          this.ctx.fill();
        });

        // Frosty corner vignette
        const grad = this.ctx.createRadialGradient(w / 2, h / 2, h * 0.42, w / 2, h / 2, Math.max(w, h) * 0.68);
        grad.addColorStop(0, "rgba(200, 235, 255, 0)");
        grad.addColorStop(1, "rgba(180, 225, 255, 0.22)");
        this.ctx.fillStyle = grad;
        this.ctx.fillRect(0, 0, w, h);
        this.ctx.restore();
      } else if (this.currentWeather === "fog") {
        this.ctx.save();
        this.fogBands.forEach(fb => {
          const cy = fb.yRel * h;
          const grad = this.ctx.createRadialGradient(fb.x + fb.width / 2, cy, 30, fb.x + fb.width / 2, cy, fb.width / 2);
          grad.addColorStop(0, `rgba(215, 225, 235, ${fb.alpha})`);
          grad.addColorStop(0.6, `rgba(200, 215, 230, ${fb.alpha * 0.6})`);
          grad.addColorStop(1, "rgba(200, 215, 230, 0)");
          this.ctx.fillStyle = grad;
          this.ctx.fillRect(fb.x, cy - fb.height / 2, fb.width, fb.height);
        });
        this.ctx.restore();
      } else if (this.currentWeather === "sandstorm") {
        this.ctx.save();
        this.weatherParticles.forEach(p => {
          this.ctx.fillStyle = `rgba(243, 156, 18, ${p.alpha || 0.5})`;
          this.ctx.fillRect(p.x, p.y, (p.size || 2) * 2.2, p.size || 1.5);
        });
        this.ctx.restore();
      } else {
        // Clear sunny motes
        this.ctx.save();
        this.weatherParticles.slice(0, 25).forEach(p => {
          this.ctx.fillStyle = `rgba(255, 241, 118, ${p.alpha || 0.25})`;
          this.ctx.beginPath();
          this.ctx.arc(p.x, p.y, p.size || 2, 0, Math.PI * 2);
          this.ctx.fill();
        });
        this.ctx.restore();
      }

      // 3. Lightning Flash
      if (this.lightningFlash > 0) {
        this.ctx.save();
        this.ctx.fillStyle = `rgba(255, 255, 255, ${this.lightningFlash})`;
        this.ctx.fillRect(0, 0, w, h);
        this.ctx.restore();
      }
    }

    evaluateWaveWeather(wave, isBossWave, bossType) {
      if (isBossWave && bossType) {
        if (bossType === "boss_inferno") {
          this.setWeather("sandstorm", true);
        } else if (bossType === "boss_phantom") {
          this.setWeather("fog", true);
        } else if (bossType === "boss_dreadnought") {
          this.setWeather("rain", true);
        } else if (bossType === "boss_tempest") {
          this.setWeather("snow", true);
        } else if (bossType === "boss_chaos") {
          this.setWeather("rain", true);
        }
      } else {
        // Thematic wave progressions
        if (wave <= 2) {
          this.setWeather("clear", true);
        } else if (wave === 3 || wave === 4) {
          this.setWeather("rain", true);
        } else if (wave === 6 || wave === 7) {
          this.setWeather("snow", true);
        } else if (wave === 8 || wave === 9) {
          this.setWeather("fog", true);
        } else if (wave === 11 || wave === 12) {
          this.setWeather("sandstorm", true);
        } else {
          const types = ["clear", "rain", "snow", "fog", "sandstorm"];
          const pick = types[(wave * 3) % types.length];
          this.setWeather(pick, true);
        }
      }
    }

    // --- ENEMY BESTIARY (موسوعة الأعداء) ---
    openBestiaryModal() {
      this.sound.play("horn");
      this.renderBestiaryList(this.bestiaryFilter, this.bestiarySearch);
      const modal = document.getElementById("bestiary-modal");
      if (modal) modal.classList.remove("hidden");
    }

    closeBestiaryModal() {
      const modal = document.getElementById("bestiary-modal");
      if (modal) modal.classList.add("hidden");
    }

    renderBestiaryList(filter = "all", query = "") {
      const container = document.getElementById("bestiary-cards-grid");
      if (!container) return;

      const isAr = this.lang === "ar";
      const dict = I18N[this.lang];

      const filtered = BESTIARY_DATA.filter(item => {
        // Category filter
        if (filter === "boss" && !item.isBoss) return false;
        if (filter !== "all" && filter !== "boss" && item.category !== filter) return false;

        // Search query filter
        if (query) {
          const matchName = (item.nameAr + " " + item.nameEn).toLowerCase().includes(query);
          const matchDesc = ((item.descAr || "") + " " + (item.descEn || "")).toLowerCase().includes(query);
          const matchStrengths = ((item.strengthsAr || []).join(" ") + " " + (item.strengthsEn || []).join(" ")).toLowerCase().includes(query);
          const matchWeaknesses = ((item.weaknessesAr || []).join(" ") + " " + (item.weaknessesEn || []).join(" ")).toLowerCase().includes(query);
          const matchCounters = ((item.countersAr || []).join(" ") + " " + (item.countersEn || []).join(" ")).toLowerCase().includes(query);
          return matchName || matchDesc || matchStrengths || matchWeaknesses || matchCounters;
        }
        return true;
      });

      // Update counter text in footer
      const counterEl = document.getElementById("bestiary-counter-text");
      if (counterEl) {
        counterEl.textContent = `${dict.bestiaryShowing || "عرض"} ${filtered.length} ${dict.bestiaryOf || "من أصل"} ${BESTIARY_DATA.length} ${dict.bestiaryEnemiesRegistered || "نوع عدو مسجل في سجلات الحصن"}`;
      }

      if (filtered.length === 0) {
        container.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; padding: 45px 15px; color: #7f8c8d;">
            <div style="font-size: 2.8rem; margin-bottom: 10px;">🔍</div>
            <p style="font-size: 1rem; color: #bdc3c7;">${dict.bestiaryNoResults || "لم يتم العثور على أعداء يطابقون بحثك!"}</p>
          </div>
        `;
        return;
      }

      const catBadgeClass = {
        boss: "cat-boss",
        armored: "cat-armored",
        fast: "cat-fast",
        flying: "cat-flying",
        massive: "cat-massive",
        standard: "cat-standard"
      };

      const catBadgeText = {
        boss: isAr ? "زعيم 👑" : "Boss 👑",
        armored: isAr ? "مدرع 🛡️" : "Armored 🛡️",
        fast: isAr ? "سريع ⚡" : "Fast ⚡",
        flying: isAr ? "طائر 🐉" : "Flying 🐉",
        massive: isAr ? "عملاق 🗿" : "Massive 🗿",
        standard: isAr ? "مشاة 👺" : "Standard 👺"
      };

      container.innerHTML = filtered.map(item => {
        const name = isAr ? item.nameAr : item.nameEn;
        const desc = isAr ? item.descAr : item.descEn;
        const strengths = (isAr ? item.strengthsAr : item.strengthsEn) || [];
        const weaknesses = (isAr ? item.weaknessesAr : item.weaknessesEn) || [];
        const counters = (isAr ? item.countersAr : item.countersEn) || [];
        const catClass = catBadgeClass[item.category] || "cat-standard";
        const catLabel = item.isBoss ? catBadgeText.boss : (catBadgeText[item.category] || item.category);

        return `
          <div class="bestiary-card-item ${item.isBoss ? "is-boss-card" : ""}">
            <div class="bestiary-card-header">
              <div class="bestiary-card-avatar" style="${item.isBoss ? "border-color: #f1c40f;" : ""}">
                <span>${item.icon}</span>
              </div>
              <div class="bestiary-card-title-wrap">
                <div class="bestiary-card-title-row">
                  <span class="bestiary-card-name">${name}</span>
                  <span class="bestiary-cat-pill ${catClass}">${catLabel}</span>
                </div>
                <div class="bestiary-card-desc">${desc}</div>
              </div>
            </div>

            <!-- Stats Grid Row -->
            <div class="bestiary-stats-row">
              <div class="bestiary-stat-item">
                <span class="bestiary-stat-lbl">${dict.statHp || "الصحة"}</span>
                <span class="bestiary-stat-val" style="color: #2ecc71;">${item.hp}</span>
              </div>
              <div class="bestiary-stat-item">
                <span class="bestiary-stat-lbl">${dict.statSpeed || "السرعة"}</span>
                <span class="bestiary-stat-val" style="color: #00e5ff;">${item.speed}</span>
              </div>
              <div class="bestiary-stat-item">
                <span class="bestiary-stat-lbl">${dict.statCastleDmg || "ضرر السور"}</span>
                <span class="bestiary-stat-val" style="color: #e74c3c;">${item.damageToCastle}</span>
              </div>
              <div class="bestiary-stat-item">
                <span class="bestiary-stat-lbl">${dict.statGold || "المكافأة"}</span>
                <span class="bestiary-stat-val" style="color: #f1c40f;">+${item.gold} 🪙</span>
              </div>
            </div>

            <!-- Strengths, Weaknesses, Counters Detail -->
            <div class="bestiary-detail-section">
              <div class="bestiary-sub-row">
                <div class="bestiary-sub-lbl lbl-strengths">
                  <span>✨</span>
                  <span>${dict.strengthsTitle || "نقاط القوة والميزات:"}</span>
                </div>
                <div class="bestiary-tags-list">
                  ${strengths.map(s => `<span class="bestiary-tag-pill tag-strength">${s}</span>`).join("")}
                </div>
              </div>

              <div class="bestiary-sub-row">
                <div class="bestiary-sub-lbl lbl-weaknesses">
                  <span>⚠️</span>
                  <span>${dict.weaknessesTitle || "نقاط الضعف:"}</span>
                </div>
                <div class="bestiary-tags-list">
                  ${weaknesses.map(w => `<span class="bestiary-tag-pill tag-weakness">${w}</span>`).join("")}
                </div>
              </div>

              <div class="bestiary-sub-row">
                <div class="bestiary-sub-lbl lbl-counters">
                  <span>🎯</span>
                  <span>${dict.countersTitle || "الأبراج والتعاويذ الفعالة:"}</span>
                </div>
                <div class="bestiary-tags-list">
                  ${counters.map(c => `<span class="bestiary-tag-pill tag-counter">${c}</span>`).join("")}
                </div>
              </div>
            </div>
          </div>
        `;
      }).join("");
    }

    applyLocalization() {
      const dict = I18N[this.lang];
      document.querySelectorAll("[data-i18n]").forEach(el => {
        const key = el.getAttribute("data-i18n");
        if (dict[key]) {
          el.textContent = dict[key];
        }
      });
      document.querySelectorAll("[data-i18n-title]").forEach(el => {
        const key = el.getAttribute("data-i18n-title");
        if (dict[key]) {
          el.setAttribute("title", dict[key]);
        }
      });
      document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
        const key = el.getAttribute("data-i18n-placeholder");
        if (dict[key]) {
          el.setAttribute("placeholder", dict[key]);
        }
      });
      document.documentElement.lang = this.lang;
      document.documentElement.dir = this.lang === "ar" ? "rtl" : "ltr";
      document.getElementById("btn-lang").textContent = this.lang.toUpperCase();

      const quickWpnHint = document.getElementById("quick-weapon-cost-hint");
      if (quickWpnHint) {
        quickWpnHint.textContent = dict.quickWeaponHint || (this.lang === "ar" ? "تجهيز فوري • 100 🪙" : "Instant Equip • 100 🪙");
      }
      const quickArmyHint = document.getElementById("quick-army-cost-hint");
      if (quickArmyHint) {
        quickArmyHint.textContent = dict.quickArmyHint || (this.lang === "ar" ? "استدعاء فوري • 35 🪙" : "Instant Summon • 35 🪙");
      }
      const uiModeText = document.getElementById("ui-mode-text");
      if (uiModeText) {
        uiModeText.textContent = this.isSimplifiedUI ? (this.lang === "ar" ? "تفصيلي" : "Detailed") : (this.lang === "ar" ? "مبسط" : "Simple");
      }

      const bestiaryModal = document.getElementById("bestiary-modal");
      if (bestiaryModal && !bestiaryModal.classList.contains("hidden")) {
        this.renderBestiaryList(this.bestiaryFilter, this.bestiarySearch);
      }

      this.updateWeatherUI();
      const weatherModal = document.getElementById("weather-modal");
      if (weatherModal && !weatherModal.classList.contains("hidden")) {
        this.renderWeatherModal();
      }
    }

    updateHUD() {
      document.getElementById("gold-value").textContent = Math.floor(this.gold);
      document.getElementById("mana-value").textContent = Math.floor(this.mana);
      document.getElementById("score-value").textContent = this.score;
      document.getElementById("wave-number").textContent = this.currentWave;
      document.getElementById("enemy-count").textContent = this.enemies.length + this.waveEnemiesQueue.length;

      // Castle HP & Dynamic SVG Status
      const hpPct = Math.max(0, Math.min(100, (this.castleHp / this.castleMaxHp) * 100));
      const fillEl = document.getElementById("castle-health-fill");
      if (fillEl) fillEl.style.width = hpPct + "%";
      const hpTextEl = document.getElementById("castle-hp-text");
      if (hpTextEl) hpTextEl.textContent = `${Math.ceil(this.castleHp)} / ${this.castleMaxHp}`;

      const panel = document.getElementById("castle-health-panel");
      const shieldSvg = document.getElementById("castle-shield-svg");
      const vitalitySvg = document.getElementById("castle-vitality-svg");

      if (hpPct < 25) {
        if (fillEl) fillEl.style.background = "linear-gradient(90deg, #c0392b, #ff4757)";
        if (panel) {
          panel.classList.remove("state-safe", "state-warning");
          panel.classList.add("state-danger");
        }
        if (shieldSvg) shieldSvg.setAttribute("data-state", "danger");
        if (vitalitySvg) vitalitySvg.setAttribute("data-state", "danger");
      } else if (hpPct < 55) {
        if (fillEl) fillEl.style.background = "linear-gradient(90deg, #d35400, #f39c12)";
        if (panel) {
          panel.classList.remove("state-safe", "state-danger");
          panel.classList.add("state-warning");
        }
        if (shieldSvg) shieldSvg.setAttribute("data-state", "warning");
        if (vitalitySvg) vitalitySvg.setAttribute("data-state", "warning");
      } else {
        if (fillEl) fillEl.style.background = "linear-gradient(90deg, #27ae60, #2ecc71)";
        if (panel) {
          panel.classList.remove("state-warning", "state-danger");
          panel.classList.add("state-safe");
        }
        if (shieldSvg) shieldSvg.setAttribute("data-state", "safe");
        if (vitalitySvg) vitalitySvg.setAttribute("data-state", "safe");
      }

      // Wave Banner Visibility
      const banner = document.getElementById("wave-banner");
      if (!this.waveActive && !this.isGameOver && !this.isVictory) {
        banner.classList.remove("hidden");
      } else {
        banner.classList.add("hidden");
      }

      // Active Boss Battle HUD Synchronization
      const bossHud = document.getElementById("boss-hud");
      if (bossHud) {
        if (this.activeBoss && this.activeBoss.hp > 0 && this.enemies.includes(this.activeBoss)) {
          const boss = this.activeBoss;
          const hpPct = Math.max(0, Math.min(100, (boss.hp / boss.maxHp) * 100));
          const hpBar = document.getElementById("boss-hp-bar");
          const hpLag = document.getElementById("boss-hp-lag");
          const hpVal = document.getElementById("boss-hp-val");
          const phaseBadge = document.getElementById("boss-phase-badge");

          if (hpBar) hpBar.style.width = hpPct + "%";
          if (hpLag) {
            const currentLag = parseFloat(hpLag.style.width) || 100;
            if (currentLag > hpPct) {
              hpLag.style.width = Math.max(hpPct, currentLag - 0.4) + "%";
            } else {
              hpLag.style.width = hpPct + "%";
            }
          }
          if (hpVal) hpVal.textContent = `${Math.ceil(boss.hp)} / ${Math.ceil(boss.maxHp)} (${Math.ceil(hpPct)}%)`;
          if (phaseBadge) {
            if (boss.enraged) {
              phaseBadge.textContent = "⚡ ENRAGED!";
              phaseBadge.style.color = "#ff3838";
            } else if (boss.type === "boss_chaos") {
              phaseBadge.textContent = boss.shieldType === "magma" ? "MAGMA SHIELD" : "KINETIC SHIELD";
              phaseBadge.style.color = boss.shieldType === "magma" ? "#e74c3c" : "#f1c40f";
            } else if (boss.phantomBrokenTimer > 0) {
              phaseBadge.textContent = "SHOCKED!";
              phaseBadge.style.color = "#00e5ff";
            } else {
              phaseBadge.textContent = "PHASE 1";
              phaseBadge.style.color = "#00e5ff";
            }
          }
          bossHud.classList.remove("hidden");
        } else {
          bossHud.classList.add("hidden");
          if (this.activeBoss && (this.activeBoss.hp <= 0 || !this.enemies.includes(this.activeBoss))) {
            this.activeBoss = null;
          }
        }
      }

      // Shop affordability
      document.querySelectorAll(".weapon-card").forEach(card => {
        const cost = parseInt(card.getAttribute("data-cost"), 10);
        if (this.gold < cost) {
          card.classList.add("disabled");
        } else {
          card.classList.remove("disabled");
        }
      });

      document.querySelectorAll(".army-card").forEach(card => {
        const cost = parseInt(card.getAttribute("data-cost"), 10);
        if (this.gold < cost) {
          card.classList.add("disabled");
        } else {
          card.classList.remove("disabled");
        }
      });

      const armyLiveBadge = document.getElementById("army-live-badge");
      if (armyLiveBadge) {
        armyLiveBadge.textContent = this.allies ? this.allies.length : 0;
      }

      // Spells status
      const repairBtn = document.getElementById("spell-repair");
      if (this.gold < 75 || this.spellCooldowns.repair > 0 || this.castleHp >= this.castleMaxHp) {
        repairBtn.classList.add("disabled");
      } else {
        repairBtn.classList.remove("disabled");
      }

      const meteorBtn = document.getElementById("spell-meteor");
      if (this.mana < 40 || this.spellCooldowns.meteor > 0) {
        meteorBtn.classList.add("disabled");
      } else {
        meteorBtn.classList.remove("disabled");
      }

      const blizzardBtn = document.getElementById("spell-blizzard");
      if (this.mana < 50 || this.spellCooldowns.blizzard > 0) {
        blizzardBtn.classList.add("disabled");
      } else {
        blizzardBtn.classList.remove("disabled");
      }

      const guardBtn = document.getElementById("spell-guard");
      if (guardBtn) {
        if (this.mana < 45 || this.spellCooldowns.guard > 0) {
          guardBtn.classList.add("disabled");
        } else {
          guardBtn.classList.remove("disabled");
        }
      }

      // Dynamic cooldown indicator overlays
      const cdRepair = document.getElementById("cd-repair");
      if (cdRepair) cdRepair.style.height = this.spellCooldowns.repair > 0 ? `${(this.spellCooldowns.repair / 15) * 100}%` : "0%";
      const cdMeteor = document.getElementById("cd-meteor");
      if (cdMeteor) cdMeteor.style.height = this.spellCooldowns.meteor > 0 ? `${(this.spellCooldowns.meteor / 20) * 100}%` : "0%";
      const cdGuard = document.getElementById("cd-guard");
      if (cdGuard) cdGuard.style.height = this.spellCooldowns.guard > 0 ? `${(this.spellCooldowns.guard / 24) * 100}%` : "0%";
      const cdBlizzard = document.getElementById("cd-blizzard");
      if (cdBlizzard) cdBlizzard.style.height = this.spellCooldowns.blizzard > 0 ? `${(this.spellCooldowns.blizzard / 25) * 100}%` : "0%";

      // Quick War Buttons state
      const quickWpnBtn = document.getElementById("btn-quick-weapon");
      if (quickWpnBtn) {
        const emptySlots = this.slots.filter(s => !s.tower);
        let canDeployOrUpgrade = false;
        if (emptySlots.length > 0) {
          canDeployOrUpgrade = this.gold >= 100;
        } else {
          canDeployOrUpgrade = this.towers.some(t => {
            const tmpl = WEAPON_TYPES[t.id];
            if (tmpl && tmpl.upgrades && t.level <= tmpl.upgrades.length) {
              const upg = tmpl.upgrades[t.level - 1];
              return upg && this.gold >= upg.cost;
            }
            return false;
          });
        }
        if (canDeployOrUpgrade) {
          quickWpnBtn.classList.remove("disabled");
        } else {
          quickWpnBtn.classList.add("disabled");
        }
      }

      const quickArmyBtn = document.getElementById("btn-quick-army");
      if (quickArmyBtn) {
        if (this.gold >= 35) {
          quickArmyBtn.classList.remove("disabled");
        } else {
          quickArmyBtn.classList.add("disabled");
        }
      }
    }

    updateShopCards() {
      // Highlight selected weapon in bottom bar
      document.querySelectorAll(".weapon-card").forEach(card => {
        const type = card.getAttribute("data-weapon");
        if (this.selectedShopWeapon && this.selectedShopWeapon.id === type) {
          card.classList.add("selected");
        } else {
          card.classList.remove("selected");
        }
      });

      const cancelBtn = document.getElementById("btn-cancel-placement");
      if (cancelBtn) {
        if (this.selectedShopWeapon) {
          cancelBtn.classList.remove("hidden");
        } else {
          cancelBtn.classList.add("hidden");
        }
      }

      if (!this.selectedShopWeapon) {
        this.closePlacementGuide();
      }
    }

    initEvents() {
      window.addEventListener("resize", () => {
        this.initDimensions();
        this.recalcSlotPositions();
      });

      // Main War Category Buttons (الأسلحة & الجيش)
      const btnWpnCat = document.getElementById("btn-category-weapons");
      if (btnWpnCat) {
        btnWpnCat.addEventListener("click", () => {
          this.toggleWarCategory("weapons");
        });
      }

      const btnArmyCat = document.getElementById("btn-category-army");
      if (btnArmyCat) {
        btnArmyCat.addEventListener("click", () => {
          this.toggleWarCategory("army");
        });
      }

      // Drawer Close Buttons (✕)
      const btnCloseWpn = document.getElementById("btn-close-weapons-drawer");
      if (btnCloseWpn) {
        btnCloseWpn.addEventListener("click", () => {
          this.closeWarDrawer();
        });
      }

      const btnCloseArmy = document.getElementById("btn-close-army-drawer");
      if (btnCloseArmy) {
        btnCloseArmy.addEventListener("click", () => {
          this.closeWarDrawer();
        });
      }

      // Quick War Command Buttons (تجهيز فوري واستدعاء فوري)
      const quickWpnBtn = document.getElementById("btn-quick-weapon");
      if (quickWpnBtn) {
        quickWpnBtn.addEventListener("click", () => {
          this.quickDeployWeapon();
        });
      }

      const quickArmyBtn = document.getElementById("btn-quick-army");
      if (quickArmyBtn) {
        quickArmyBtn.addEventListener("click", () => {
          this.quickDeployArmy();
        });
      }

      // Formation Toggle Button (تغيير التشكيل القتالي)
      const formationBtn = document.getElementById("btn-formation");
      if (formationBtn) {
        formationBtn.addEventListener("click", () => {
          this.toggleFormation();
        });
      }

      // Army Unit Recruitment Cards
      document.querySelectorAll(".army-card").forEach(card => {
        card.addEventListener("click", e => {
          e.stopPropagation();
          const uType = card.getAttribute("data-unit");
          this.recruitUnit(uType);
        });
      });

      // Direct deploy buttons on weapon cards (نشر فوري في القلعة بنقرة واحدة)
      document.querySelectorAll(".btn-card-direct-deploy").forEach(btn => {
        btn.addEventListener("click", e => {
          e.stopPropagation();
          const wType = btn.getAttribute("data-weapon");
          this.deploySpecificWeapon(wType);
        });
      });

      // Shop card selection (Towers manual placement mode)
      document.querySelectorAll(".weapon-card").forEach(card => {
        card.addEventListener("click", e => {
          e.stopPropagation();
          const wType = card.getAttribute("data-weapon");
          const template = WEAPON_TYPES[wType];
          if (!template) return;

          if (this.gold < template.cost) {
            this.sound.play("error");
            const wName = (I18N[this.lang] && I18N[this.lang][template.nameKey]) || template.id;
            this.createFloatingText(
              this.lang === "ar" ? `تحتاج ${template.cost} 🪙 لتجهيز ${wName}! (الذهب الحالي: ${this.gold} 🪙)` : `Need ${template.cost} 🪙 for ${wName}!`,
              this.width * 0.35,
              this.height * 0.5,
              "#e74c3c",
              1.2
            );
            return;
          }

          this.selectedShopWeapon = template;
          this.lastWeaponSelectTime = performance.now();
          this.inspectingTower = null;
          this.closeWeaponModal();
          this.closeWarDrawer(); // Close drawer so player sees the wall slots clearly!
          this.showPlacementGuide(template);
          this.sound.play("build");
          this.updateShopCards();
        });
      });

      // Cancel button & Placement Guide Controls
      const handleCancelPlacement = (e) => {
        if (e) e.stopPropagation();
        this.selectedShopWeapon = null;
        this.closePlacementGuide();
        this.updateShopCards();
      };
      const cancelBtn = document.getElementById("btn-cancel-placement");
      if (cancelBtn) cancelBtn.addEventListener("click", handleCancelPlacement);

      const guideCancelBtn = document.getElementById("btn-guide-cancel");
      if (guideCancelBtn) guideCancelBtn.addEventListener("click", handleCancelPlacement);

      const guideAutoBtn = document.getElementById("btn-guide-auto-place");
      if (guideAutoBtn) {
        guideAutoBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          if (this.selectedShopWeapon) {
            this.deploySpecificWeapon(this.selectedShopWeapon.id);
          }
        });
      }

      // Start wave button
      document.getElementById("btn-start-wave").addEventListener("click", () => {
        this.startNextWave();
      });

      // Speed button
      document.getElementById("btn-speed").addEventListener("click", () => {
        if (this.speed === 1) {
          this.speed = 2;
          document.getElementById("btn-speed").textContent = "2x";
        } else {
          this.speed = 1;
          document.getElementById("btn-speed").textContent = "1x";
        }
      });

      // Sound quick mute toggle
      document.getElementById("btn-sound").addEventListener("click", () => {
        this.sound.setMasterEnabled(!this.sound.enabled);
      });

      // Settings modal buttons
      const settingsBtn = document.getElementById("btn-settings");
      if (settingsBtn) {
        settingsBtn.addEventListener("click", () => {
          this.openSettingsModal();
        });
      }

      const closeSettingsBtn = document.getElementById("btn-close-settings");
      if (closeSettingsBtn) {
        closeSettingsBtn.addEventListener("click", () => {
          this.closeSettingsModal();
        });
      }

      const saveSettingsBtn = document.getElementById("btn-save-settings");
      if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener("click", () => {
          this.closeSettingsModal();
        });
      }

      const settingsModal = document.getElementById("settings-modal");
      if (settingsModal) {
        settingsModal.addEventListener("click", (e) => {
          if (e.target.id === "settings-modal") {
            this.closeSettingsModal();
          }
        });
      }

      // Master audio controls
      const masterSlider = document.getElementById("slider-master-volume");
      if (masterSlider) {
        masterSlider.addEventListener("input", (e) => {
          this.sound.setMasterVolume(parseFloat(e.target.value) / 100);
        });
      }

      const masterToggle = document.getElementById("toggle-master-sound");
      if (masterToggle) {
        masterToggle.addEventListener("change", (e) => {
          this.sound.setMasterEnabled(e.target.checked);
        });
      }

      // Background music controls
      const bgmSlider = document.getElementById("slider-bgm-volume");
      if (bgmSlider) {
        bgmSlider.addEventListener("input", (e) => {
          this.sound.setMusicVolume(parseFloat(e.target.value) / 100);
        });
      }

      const bgmToggle = document.getElementById("toggle-bgm");
      if (bgmToggle) {
        bgmToggle.addEventListener("change", (e) => {
          this.sound.setMusicEnabled(e.target.checked);
        });
      }

      const playMusicBtn = document.getElementById("btn-play-music");
      if (playMusicBtn) {
        playMusicBtn.addEventListener("click", () => {
          this.sound.setMusicEnabled(true);
          this.sound.startMusic();
        });
      }

      const stopMusicBtn = document.getElementById("btn-stop-music");
      if (stopMusicBtn) {
        stopMusicBtn.addEventListener("click", () => {
          this.sound.stopMusic();
        });
      }

      // Sound effects (SFX) controls
      const sfxSlider = document.getElementById("slider-sfx-volume");
      if (sfxSlider) {
        sfxSlider.addEventListener("input", (e) => {
          this.sound.setSfxVolume(parseFloat(e.target.value) / 100);
        });
      }

      const sfxToggle = document.getElementById("toggle-sfx");
      if (sfxToggle) {
        sfxToggle.addEventListener("change", (e) => {
          this.sound.setSfxEnabled(e.target.checked);
        });
      }

      const towerToggle = document.getElementById("toggle-tower-sfx");
      if (towerToggle) {
        towerToggle.addEventListener("change", (e) => {
          this.sound.setTowerSfxEnabled(e.target.checked);
        });
      }

      const enemyToggle = document.getElementById("toggle-enemy-sfx");
      if (enemyToggle) {
        enemyToggle.addEventListener("change", (e) => {
          this.sound.setEnemySfxEnabled(e.target.checked);
        });
      }

      // Test SFX buttons
      document.querySelectorAll(".test-sfx-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const soundType = btn.getAttribute("data-sound");
          this.sound.play(soundType);
        });
      });

      const resetAudioBtn = document.getElementById("btn-reset-audio");
      if (resetAudioBtn) {
        resetAudioBtn.addEventListener("click", () => {
          this.sound.resetDefaults();
        });
      }

      // Language toggle
      document.getElementById("btn-lang").addEventListener("click", () => {
        this.lang = this.lang === "ar" ? "en" : "ar";
        this.applyLocalization();
      });

      // Dynamic Weather System (نظام الطقس والمناخ التكتيكي)
      const weatherBadge = document.getElementById("weather-badge");
      if (weatherBadge) {
        weatherBadge.addEventListener("click", () => {
          this.openWeatherModal();
        });
      }

      const weatherBtn = document.getElementById("btn-weather");
      if (weatherBtn) {
        weatherBtn.addEventListener("click", () => {
          this.openWeatherModal();
        });
      }

      const closeWeatherBtn = document.getElementById("btn-close-weather");
      if (closeWeatherBtn) {
        closeWeatherBtn.addEventListener("click", () => {
          this.closeWeatherModal();
        });
      }

      const dismissWeatherBtn = document.getElementById("btn-dismiss-weather");
      if (dismissWeatherBtn) {
        dismissWeatherBtn.addEventListener("click", () => {
          this.closeWeatherModal();
        });
      }

      const weatherModal = document.getElementById("weather-modal");
      if (weatherModal) {
        weatherModal.addEventListener("click", (e) => {
          if (e.target.id === "weather-modal") {
            this.closeWeatherModal();
          }
        });
      }

      // Bestiary Encyclopedia (موسوعة الأعداء) Modal
      const bestiaryBtn = document.getElementById("btn-bestiary");
      if (bestiaryBtn) {
        bestiaryBtn.addEventListener("click", () => {
          this.openBestiaryModal();
        });
      }

      const closeBestiaryBtn = document.getElementById("btn-close-bestiary");
      if (closeBestiaryBtn) {
        closeBestiaryBtn.addEventListener("click", () => {
          this.closeBestiaryModal();
        });
      }

      const dismissBestiaryBtn = document.getElementById("btn-dismiss-bestiary");
      if (dismissBestiaryBtn) {
        dismissBestiaryBtn.addEventListener("click", () => {
          this.closeBestiaryModal();
        });
      }

      document.querySelectorAll(".bestiary-tab").forEach(tab => {
        tab.addEventListener("click", () => {
          document.querySelectorAll(".bestiary-tab").forEach(t => t.classList.remove("active"));
          tab.classList.add("active");
          this.bestiaryFilter = tab.getAttribute("data-filter") || "all";
          this.renderBestiaryList(this.bestiaryFilter, this.bestiarySearch);
        });
      });

      const searchInput = document.getElementById("bestiary-search");
      if (searchInput) {
        searchInput.addEventListener("input", (e) => {
          this.bestiarySearch = e.target.value.trim().toLowerCase();
          this.renderBestiaryList(this.bestiaryFilter, this.bestiarySearch);
        });
      }

      // Files viewer modal button
      document.getElementById("btn-files").addEventListener("click", () => {
        this.openFilesModal();
      });

      document.getElementById("btn-close-files").addEventListener("click", () => {
        document.getElementById("files-modal").classList.add("hidden");
      });

      // Spells
      document.getElementById("spell-repair").addEventListener("click", () => {
        if (this.gold >= 75 && this.spellCooldowns.repair <= 0 && this.castleHp < this.castleMaxHp) {
          this.gold -= 75;
          this.castleHp = Math.min(this.castleMaxHp, this.castleHp + 450);
          this.spellCooldowns.repair = 15; // 15 sec cooldown
          this.spellsCastCount = (this.spellsCastCount || 0) + 1;
          this.sound.play("spell");
          this.createRepairFX();
          this.updateHUD();
        }
      });

      document.getElementById("spell-meteor").addEventListener("click", () => {
        if (this.mana >= 40 && this.spellCooldowns.meteor <= 0) {
          this.mana -= 40;
          this.spellCooldowns.meteor = 20;
          this.spellsCastCount = (this.spellsCastCount || 0) + 1;
          this.sound.play("spell");
          this.castMeteorShower();
          this.updateHUD();
        }
      });

      const guardBtnEl = document.getElementById("spell-guard");
      if (guardBtnEl) {
        guardBtnEl.addEventListener("click", () => {
          if (this.mana >= 45 && this.spellCooldowns.guard <= 0) {
            this.mana -= 45;
            this.spellCooldowns.guard = 24; // 24 sec cooldown
            this.castGuardCall();
            this.updateHUD();
          }
        });
      }

      document.getElementById("spell-blizzard").addEventListener("click", () => {
        if (this.mana >= 50 && this.spellCooldowns.blizzard <= 0) {
          this.mana -= 50;
          this.spellCooldowns.blizzard = 25;
          this.spellsCastCount = (this.spellsCastCount || 0) + 1;
          this.sound.play("spell");
          this.castBlizzard();
          this.updateHUD();
        }
      });

      // Canvas pointer interactions (Click, Drag & Drop soldiers)
      this.canvas.addEventListener("pointerdown", e => {
        const rect = this.canvas.getBoundingClientRect();
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;
        this.handlePointerDown(px, py, e);
      });

      this.canvas.addEventListener("pointermove", e => {
        if (!this.draggingAlly) return;
        const rect = this.canvas.getBoundingClientRect();
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;

        // Constrain soldier within battlefield corridor (x: 0.27w to 0.95w, y: 0.36h to 0.64h)
        const minX = this.width * 0.27;
        const maxX = this.width * 0.95;
        const minY = this.height * 0.36;
        const maxY = this.height * 0.64;

        this.draggingAlly.x = Math.max(minX, Math.min(maxX, px + this.dragOffset.x));
        this.draggingAlly.y = Math.max(minY, Math.min(maxY, py + this.dragOffset.y));
        this.draggingAlly.customPositioned = true;
      });

      const handlePointerUp = () => {
        if (this.draggingAlly) {
          this.sound.play("guard_block");
          this.createShockwave(this.draggingAlly.x, this.draggingAlly.y, "#f1c40f", 36, 0.28, 2.5);
          for (let p = 0; p < 8; p++) {
            this.particles.push({
              x: this.draggingAlly.x + (Math.random() - 0.5) * 10,
              y: this.draggingAlly.y + (Math.random() - 0.5) * 10,
              vx: (Math.random() - 0.5) * 40,
              vy: -15 - Math.random() * 25,
              life: 0.22,
              maxLife: 0.22,
              color: "#3498db",
              size: 2.5
            });
          }
          this.createFloatingText("DEFEND! 🛡️", this.draggingAlly.x, this.draggingAlly.y - 20, "#f1c40f", 1.05);
          this.draggingAlly.isSelected = false;
          this.draggingAlly = null;
        }
      };

      this.canvas.addEventListener("pointerup", handlePointerUp);
      this.canvas.addEventListener("pointercancel", handlePointerUp);

      // Modal buttons
      document.getElementById("btn-close-inspect").addEventListener("click", () => {
        this.closeWeaponModal();
      });

      document.getElementById("btn-upgrade-weapon").addEventListener("click", () => {
        if (this.inspectingTower) {
          this.upgradeTower(this.inspectingTower);
        }
      });

      document.getElementById("btn-sell-weapon").addEventListener("click", () => {
        if (this.inspectingTower) {
          this.sellTower(this.inspectingTower);
        }
      });

      // Priority pills
      document.querySelectorAll(".priority-pills .pill-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          document.querySelectorAll(".priority-pills .pill-btn").forEach(b => b.classList.remove("active"));
          btn.classList.add("active");
          if (this.inspectingTower) {
            this.inspectingTower.priority = btn.getAttribute("data-priority");
          }
        });
      });

      // Restart button
      document.getElementById("btn-restart-game").addEventListener("click", () => {
        this.restartGame();
      });

      // Files Explorer tabs & copy / download
      document.querySelectorAll(".file-tab").forEach(tab => {
        tab.addEventListener("click", () => {
          document.querySelectorAll(".file-tab").forEach(t => t.classList.remove("active"));
          tab.classList.add("active");
          const file = tab.getAttribute("data-file");
          this.showFileContent(file);
        });
      });

      const copyBtn = document.getElementById("btn-copy-code");
      if (copyBtn) {
        copyBtn.addEventListener("click", () => {
          const text = document.getElementById("code-content").textContent;
          const showSuccess = () => {
            copyBtn.textContent = "✅ تم النسخ بنجاح!";
            setTimeout(() => {
              copyBtn.textContent = "📋 نسخ الملف";
            }, 2000);
          };

          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(showSuccess).catch(() => {
              fallbackCopy(text);
            });
          } else {
            fallbackCopy(text);
          }

          function fallbackCopy(str) {
            const ta = document.createElement("textarea");
            ta.value = str;
            ta.style.position = "fixed";
            ta.style.left = "-9999px";
            ta.style.top = "0";
            document.body.appendChild(ta);
            ta.focus();
            ta.select();
            try {
              document.execCommand("copy");
              showSuccess();
            } catch (e) {
              copyBtn.textContent = "❌ فشل النسخ";
            }
            document.body.removeChild(ta);
          }
        });
      }

      const downloadBtn = document.getElementById("btn-download-code");
      if (downloadBtn) {
        downloadBtn.addEventListener("click", () => {
          const text = document.getElementById("code-content").textContent;
          const filename = document.getElementById("current-filename").textContent || "code.txt";
          let mime = "text/plain;charset=utf-8";
          if (filename.endsWith(".html")) mime = "text/html;charset=utf-8";
          else if (filename.endsWith(".css")) mime = "text/css;charset=utf-8";
          else if (filename.endsWith(".js")) mime = "application/javascript;charset=utf-8";

          try {
            const blob = new Blob([text], { type: mime });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            downloadBtn.textContent = "✅ تم التحميل!";
            setTimeout(() => {
              downloadBtn.textContent = "💾 حفظ كملف";
            }, 2000);
          } catch (e) {
            downloadBtn.textContent = "❌ تعذر الحفظ";
          }
        });
      }
    }

    handlePointerDown(px, py, e) {
      this.sound.init();

      // 1. Check if tapping a friendly soldier to drag & drop
      if (this.allies && this.allies.length > 0) {
        for (let i = this.allies.length - 1; i >= 0; i--) {
          const ally = this.allies[i];
          if (ally.hp > 0 && Math.hypot(ally.x - px, ally.y - py) <= ally.radius + 14) {
            this.draggingAlly = ally;
            this.dragOffset.x = ally.x - px;
            this.dragOffset.y = ally.y - py;
            ally.isSelected = true;
            this.sound.play("build");
            this.createShockwave(ally.x, ally.y, "#3498db", 30, 0.22, 2.0);
            return;
          }
        }
      }

      // 2. If a weapon is selected from the shop:
      if (this.selectedShopWeapon) {
        // Protect against touch/pointer leakage right after opening/selecting from card (350ms window)
        if (performance.now() - (this.lastWeaponSelectTime || 0) < 350) {
          return;
        }

        const template = this.selectedShopWeapon;
        const castleMaxX = this.width * 0.36;

        // A. Direct slot hit with generous hit radius (up to 65px radius!)
        let targetSlot = null;
        let minSlotDist = Infinity;
        for (const slot of this.slots) {
          const dist = Math.hypot(slot.x - px, slot.y - py);
          if (dist < minSlotDist) {
            minSlotDist = dist;
            if (dist <= 65) {
              targetSlot = slot;
            }
          }
        }

        // B. If user tapped on/near the castle area (px <= castleMaxX + 50) or within 120px of any slot:
        if (!targetSlot && (px <= castleMaxX + 50 || minSlotDist <= 120)) {
          // Find the closest empty slot to where they tapped!
          const emptySlots = this.slots.filter(s => !s.tower);
          if (emptySlots.length > 0) {
            emptySlots.sort((a, b) => Math.hypot(a.x - px, a.y - py) - Math.hypot(b.x - px, b.y - py));
            targetSlot = emptySlots[0];
          }
        }

        // C. If slot target is found or selected:
        if (targetSlot) {
          if (!targetSlot.tower) {
            this.deploySpecificWeapon(template.id, targetSlot);
            return;
          } else {
            // That slot already has a tower: find nearest empty slot on castle
            const otherEmpty = this.slots.filter(s => !s.tower);
            if (otherEmpty.length > 0) {
              otherEmpty.sort((a, b) => Math.hypot(a.x - px, a.y - py) - Math.hypot(b.x - px, b.y - py));
              this.deploySpecificWeapon(template.id, otherEmpty[0]);
              return;
            } else {
              this.sound.play("error");
              this.createFloatingText(
                this.lang === "ar" ? "جميع مواقع القلعة ممتلئة! يمكنك ترقية الأسلحة ⭐" : "All slots full! Tap to upgrade ⭐",
                this.width * 0.35,
                this.height * 0.45,
                "#f39c12",
                1.25
              );
              return;
            }
          }
        } else {
          // User tapped open battlefield far from castle
          // DO NOT CANCEL PLACEMENT! Guide the user!
          this.sound.play("error");
          this.createFloatingText(
            this.lang === "ar" ? "اضغط على القلعة ومواقع الأبراج (+) لنشر السلاح! 🏰" : "Tap on castle wall or (+) slots to place weapon! 🏰",
            this.width * 0.35,
            this.height * 0.5,
            "#00cec9",
            1.2
          );
          return;
        }
      }

      // 3. Normal slot inspection / selection when NOT placing:
      let clickedSlot = null;
      for (const slot of this.slots) {
        const dist = Math.hypot(slot.x - px, slot.y - py);
        if (dist <= slot.radius * 1.8) {
          clickedSlot = slot;
          break;
        }
      }

      if (clickedSlot) {
        if (clickedSlot.tower) {
          this.inspectTower(clickedSlot.tower);
        } else {
          // Tapped empty slot without weapon selected: open weapons drawer!
          this.openWarDrawer("weapons");
          this.createFloatingText(
            this.lang === "ar" ? "اختر سلاحاً لنشره في هذا الموقع! 🏹" : "Choose weapon to deploy here! 🏹",
            clickedSlot.x,
            clickedSlot.y - 25,
            "#00cec9",
            1.15
          );
        }
      } else {
        // Tapped open field
        if (this.inspectingTower) {
          this.closeWeaponModal();
        }
      }
    }

    showPlacementGuide(template) {
      const banner = document.getElementById("placement-guide-banner");
      if (!banner) return;
      const icon = document.getElementById("guide-weapon-icon");
      const name = document.getElementById("guide-weapon-name");
      const cost = document.getElementById("guide-weapon-cost");
      const hint = document.getElementById("guide-weapon-hint");

      const wName = (I18N[this.lang] && I18N[this.lang][template.nameKey]) || template.id;
      if (icon) icon.textContent = template.icon;
      if (name) name.textContent = wName;
      if (cost) cost.textContent = `${template.cost} 🪙`;
      if (hint) {
        hint.textContent = this.lang === "ar"
          ? "انقر فوق أي موقع بالأخضر (+) بالقلعة لوضعه (أو اضغط نشر تلقائي)"
          : "Tap any green (+) slot on castle to place (or tap Auto Place)";
      }
      banner.classList.remove("hidden");
    }

    closePlacementGuide() {
      const banner = document.getElementById("placement-guide-banner");
      if (banner) banner.classList.add("hidden");
    }

    deploySpecificWeapon(wType, explicitSlot = null) {
      const template = WEAPON_TYPES[wType];
      if (!template) return false;

      if (this.gold < template.cost) {
        this.sound.play("error");
        const wName = (I18N[this.lang] && I18N[this.lang][template.nameKey]) || template.id;
        this.createFloatingText(
          this.lang === "ar" ? `تحتاج ${template.cost} 🪙 لتجهيز ${wName}! (الذهب الحالي: ${this.gold} 🪙)` : `Need ${template.cost} 🪙 for ${wName}!`,
          this.width * 0.35,
          this.height * 0.5,
          "#e74c3c",
          1.25
        );
        return false;
      }

      // If explicitSlot provided and empty, use it
      let targetSlot = explicitSlot;
      if (targetSlot && targetSlot.tower) {
        targetSlot = null; // occupied
      }

      // If no valid explicitSlot, select the best strategic empty slot on the castle
      if (!targetSlot) {
        const emptySlots = this.slots.filter(s => !s.tower);
        if (emptySlots.length === 0) {
          this.sound.play("error");
          this.createFloatingText(
            this.lang === "ar" ? "جميع مواقع القلعة ممتلئة! يمكنك ترقية الأسلحة الحالية ⭐" : "All slots full! Tap to upgrade ⭐",
            this.width * 0.35,
            this.height * 0.5,
            "#f39c12",
            1.25
          );
          return false;
        }

        const priorityOrder = [
          "slot_gate_top", "slot_gate_low", "slot_fwd_top", "slot_fwd_bot",
          "slot_wall_mid1", "slot_keep_mid", "slot_wall_top", "slot_wall_low1",
          "slot_n_high1", "slot_n_high2", "slot_s_high1", "slot_s_high2"
        ];
        emptySlots.sort((a, b) => {
          const idxA = priorityOrder.indexOf(a.id);
          const idxB = priorityOrder.indexOf(b.id);
          return (idxA !== -1 ? idxA : 99) - (idxB !== -1 ? idxB : 99);
        });
        targetSlot = emptySlots[0];
      }

      // Build tower
      this.buildTower(targetSlot, template);
      const wName = (I18N[this.lang] && I18N[this.lang][template.nameKey]) || template.id;
      this.createFloatingText(`+${template.icon} ${wName}!`, targetSlot.x, targetSlot.y - 30, "#00cec9", 1.35);
      this.selectedShopWeapon = null;
      this.closePlacementGuide();
      this.updateShopCards();
      return true;
    }

    // --- TOWER LOGIC ---
    buildTower(slot, template) {
      if (this.gold < template.cost) return;

      this.gold -= template.cost;
      const tower = {
        slot: slot,
        id: template.id,
        nameKey: template.nameKey,
        icon: template.icon,
        x: slot.x,
        y: slot.y,
        level: 1,
        range: template.range,
        damage: template.damage,
        fireRate: template.fireRate,
        color: template.color,
        type: template.type,
        aoe: template.aoe || 0,
        pierce: template.pierce || 1,
        chain: template.chain || 0,
        upgrades: template.upgrades,
        priority: "first",
        cooldown: 0,
        angle: 0,
        kills: 0,
        totalDamage: 0,
        investedGold: template.cost
      };

      slot.tower = tower;
      this.towers.push(tower);
      this.sound.play("build");
      this.createExplosion(slot.x, slot.y, "#f1c40f", 25);
      this.createFloatingText(`-${template.cost} 🪙`, slot.x, slot.y - 30, "#e74c3c");
      this.updateHUD();
    }

    inspectTower(tower) {
      this.inspectingTower = tower;
      const modal = document.getElementById("weapon-modal");
      const dict = I18N[this.lang];

      document.getElementById("inspect-icon").textContent = tower.icon;
      document.getElementById("inspect-name").textContent = dict[tower.nameKey] || tower.id;
      document.getElementById("inspect-level").textContent = `${this.lang === "ar" ? "المستوى" : "Level"} ${tower.level}`;
      document.getElementById("inspect-damage").textContent = Math.round(tower.damage);
      document.getElementById("inspect-speed").textContent = `${tower.fireRate}/s`;
      document.getElementById("inspect-range").textContent = Math.round(tower.range);
      document.getElementById("inspect-kills").textContent = tower.kills;

      // Priority pill sync
      document.querySelectorAll(".priority-pills .pill-btn").forEach(b => {
        if (b.getAttribute("data-priority") === tower.priority) {
          b.classList.add("active");
        } else {
          b.classList.remove("active");
        }
      });

      // Upgrade button status
      const upBtn = document.getElementById("btn-upgrade-weapon");
      const nextUp = tower.upgrades && tower.upgrades[tower.level - 1];
      if (nextUp) {
        upBtn.style.display = "flex";
        document.getElementById("upgrade-cost").textContent = `${nextUp.cost} 🪙`;
        if (this.gold < nextUp.cost) {
          upBtn.style.opacity = "0.5";
          upBtn.style.pointerEvents = "none";
        } else {
          upBtn.style.opacity = "1";
          upBtn.style.pointerEvents = "auto";
        }
      } else {
        upBtn.style.display = "none";
      }

      // Sell refund
      const refund = Math.floor(tower.investedGold * 0.7);
      document.getElementById("sell-refund").textContent = `+${refund} 🪙`;

      modal.classList.remove("hidden");
    }

    closeWeaponModal() {
      this.inspectingTower = null;
      document.getElementById("weapon-modal").classList.add("hidden");
    }

    upgradeTower(tower) {
      const nextUp = tower.upgrades && tower.upgrades[tower.level - 1];
      if (!nextUp || this.gold < nextUp.cost) return;

      this.gold -= nextUp.cost;
      tower.investedGold += nextUp.cost;
      tower.level += 1;
      tower.damage = nextUp.damage;
      tower.range = nextUp.range;
      if (nextUp.fireRate) tower.fireRate = nextUp.fireRate;
      if (nextUp.aoe) tower.aoe = nextUp.aoe;
      if (nextUp.chain) tower.chain = nextUp.chain;
      if (nextUp.pierce) tower.pierce = nextUp.pierce;

      this.sound.play("build");
      this.createExplosion(tower.x, tower.y, "#2ecc71", 35);
      this.createFloatingText("UPGRADE! ⬆️", tower.x, tower.y - 30, "#2ecc71");
      this.inspectTower(tower);
      this.updateHUD();
    }

    sellTower(tower) {
      const refund = Math.floor(tower.investedGold * 0.7);
      this.gold += refund;
      tower.slot.tower = null;
      const idx = this.towers.indexOf(tower);
      if (idx !== -1) {
        this.towers.splice(idx, 1);
      }

      this.sound.play("coin");
      this.createFloatingText(`+${refund} 🪙`, tower.x, tower.y - 20, "#f1c40f");
      this.closeWeaponModal();
      this.updateHUD();
    }

    // --- CASTLE DEFENSIVE SPELLS & VISUAL FX ---
    castMeteorShower() {
      const targetCount = 6;
      for (let i = 0; i < targetCount; i++) {
        setTimeout(() => {
          const mx = this.width * (0.35 + Math.random() * 0.55);
          const my = this.height * (0.15 + Math.random() * 0.7);
          this.createMeteorImpact(mx, my);
        }, i * 220);
      }
    }

    createMeteorImpact(x, y) {
      this.sound.play("cannon");
      this.shakeScreen(7, 0.4);

      // Blazing expanding shockwaves
      this.createShockwave(x, y, "#e74c3c", 115, 0.5, 4.5);
      this.createShockwave(x, y, "#f1c40f", 65, 0.35, 3);

      // 40 flaming ember and debris particles
      for (let i = 0; i < 35; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 60 + Math.random() * 220;
        this.particles.push({
          type: Math.random() < 0.4 ? "debris" : "fire_ember",
          x: x,
          y: y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd - 30,
          gravity: 280,
          drag: 0.94,
          vRot: (Math.random() - 0.5) * 10,
          rot: Math.random() * Math.PI * 2,
          life: 0.5 + Math.random() * 0.4,
          maxLife: 0.9,
          color: Math.random() < 0.5 ? "#e74c3c" : "#f39c12",
          size: 4 + Math.random() * 5
        });
      }

      // Billowing smoke clouds
      for (let i = 0; i < 12; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 20 + Math.random() * 60;
        this.particles.push({
          type: "smoke",
          x: x,
          y: y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd - 25,
          growth: 24,
          drag: 0.92,
          life: 0.8 + Math.random() * 0.5,
          maxLife: 1.3,
          color: "rgba(30, 35, 45, 0.75)",
          size: 14 + Math.random() * 10
        });
      }

      // Damage nearby enemies
      const radius = 130;
      this.enemies.forEach(e => {
        const d = Math.hypot(e.x - x, e.y - y);
        if (d <= radius) {
          const dmg = 240 * (1 - d / radius * 0.5);
          this.damageEnemy(e, dmg, "magic", "#e74c3c");
        }
      });

      // Ground scorched hazard
      this.groundHazards.push({
        x: x,
        y: y,
        radius: 60,
        duration: 4.5,
        damagePerSec: 35,
        color: "rgba(230, 126, 34, 0.4)"
      });
    }

    castBlizzard() {
      this.sound.play("spell");

      // Giant center frost shockwave
      this.createShockwave(this.width * 0.6, this.height * 0.5, "#00e5ff", 350, 0.9, 6);
      this.createShockwave(this.width * 0.6, this.height * 0.5, "#ffffff", 200, 0.6, 3);

      // Swirling snow and crystalline ice particles across the screen
      for (let i = 0; i < 70; i++) {
        const px = this.width * 0.3 + Math.random() * (this.width * 0.7);
        const py = Math.random() * this.height;
        this.particles.push({
          type: "ice_crystal",
          x: px,
          y: py,
          vx: -120 - Math.random() * 180, // High blizzard wind to the left
          vy: (Math.random() - 0.5) * 60,
          vRot: (Math.random() - 0.5) * 8,
          rot: Math.random() * Math.PI,
          life: 0.9 + Math.random() * 0.8,
          maxLife: 1.7,
          color: Math.random() < 0.6 ? "#00e5ff" : "#ffffff",
          size: 4 + Math.random() * 6
        });
      }

      // Freezing mist clouds
      for (let i = 0; i < 15; i++) {
        this.particles.push({
          type: "smoke",
          x: this.width * (0.35 + Math.random() * 0.6),
          y: this.height * Math.random(),
          vx: -80,
          vy: (Math.random() - 0.5) * 30,
          growth: 30,
          life: 1.4,
          maxLife: 1.4,
          color: "rgba(129, 236, 236, 0.25)",
          size: 25 + Math.random() * 20
        });
      }

      // Freeze all current enemies
      this.enemies.forEach(e => {
        e.frozenTime = 4.5;
        this.createFloatingText("FROZEN! ❄️", e.x, e.y - 15, "#00e5ff");
      });
    }

    createRepairFX() {
      const cx = this.width * 0.22;
      const cy = this.height * 0.5;

      // Green & gold holy shockwave ring along castle wall
      this.createShockwave(cx, cy, "#2ecc71", 220, 0.7, 5);
      this.createShockwave(cx, cy, "#f1c40f", 140, 0.5, 3);

      // 40 rising holy healing motes and divine sparkles
      for (let i = 0; i < 40; i++) {
        const rx = this.width * (0.12 + Math.random() * 0.16);
        const ry = this.height * (0.15 + Math.random() * 0.7);
        this.particles.push({
          type: "holy_mote",
          x: rx,
          y: ry,
          vx: (Math.random() - 0.5) * 40,
          vy: -60 - Math.random() * 100, // Floats upward
          vRot: (Math.random() - 0.5) * 4,
          rot: Math.random() * Math.PI,
          life: 0.8 + Math.random() * 0.6,
          maxLife: 1.4,
          color: Math.random() < 0.6 ? "#2ecc71" : "#f1c40f",
          size: 5 + Math.random() * 6
        });
      }

      this.createFloatingText("+450 HP RESTORED! 🛡️", cx + 30, cy, "#2ecc71", 1.3);

      // Trigger heal pulse on SVG castle icon
      const shieldIcon = document.getElementById("castle-shield-svg");
      if (shieldIcon) {
        shieldIcon.classList.remove("heal-impact", "hit-impact");
        void shieldIcon.offsetWidth;
        shieldIcon.classList.add("heal-impact");
      }
    }

    // --- GUARD CALL ABILITY (مهارة نداء الحرس الإمبراطوري) ---
    castGuardCall() {
      this.sound.play("guard_horn");
      this.sound.play("spell");
      this.spellsCastCount = (this.spellsCastCount || 0) + 1;

      const isAr = this.lang === "ar";
      this.createFloatingText(
        isAr ? "🛡️ نداء الحرس: تقدمت كتيبة المشاة لحماية السور!" : "🛡️ Guard Call: Royal Infantry Phalanx Deployed!",
        this.width * 0.33,
        this.height * 0.48,
        "#f1c40f",
        1.35
      );
      this.shakeScreen(4.5, 0.3);

      // 5 elite royal guards deployed in front of the castle wall covering all path approaches
      const guardSlots = [
        { rx: 0.305, ry: 0.20, role: "vanguard_north", nameAr: "حارس السور الشمالي", nameEn: "North Sentry" },
        { rx: 0.320, ry: 0.35, role: "swordsman_upper", nameAr: "فارس الحرس", nameEn: "Shield Knight" },
        { rx: 0.332, ry: 0.50, role: "captain", nameAr: "قائد الحرس الملكي 👑", nameEn: "Imperial Captain 👑", isCaptain: true },
        { rx: 0.320, ry: 0.65, role: "swordsman_lower", nameAr: "فارس الحرس", nameEn: "Shield Knight" },
        { rx: 0.305, ry: 0.80, role: "vanguard_south", nameAr: "حارس البرج الجنوبي", nameEn: "South Sentry" }
      ];

      const duration = 22; // 22 seconds
      const baseHp = 550;

      this.guards = guardSlots.map((slot, idx) => {
        const gx = slot.rx * this.width;
        const gy = slot.ry * this.height;

        this.createGuardSpawnParticles(gx, gy);

        const maxHp = slot.isCaptain ? Math.round(baseHp * 1.35) : baseHp;

        return {
          id: `guard_${Date.now()}_${idx}`,
          rx: slot.rx,
          ry: slot.ry,
          x: gx,
          y: gy,
          maxHp: maxHp,
          hp: maxHp,
          duration: duration,
          maxDuration: duration,
          role: slot.role,
          nameAr: slot.nameAr,
          nameEn: slot.nameEn,
          isCaptain: !!slot.isCaptain,
          attackCooldown: 0.2 + idx * 0.15,
          attackInterval: 0.85,
          attackAnim: 0,
          hitAnim: 0,
          walkPhase: idx * 1.2,
          radius: slot.isCaptain ? 18 : 16
        };
      });
    }

    createGuardSpawnParticles(x, y) {
      this.createShockwave(x, y, "#f1c40f", 85, 0.45, 3.5);
      this.createShockwave(x, y, "#3498db", 50, 0.3, 2.5);

      for (let i = 0; i < 22; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 40 + Math.random() * 110;
        this.particles.push({
          x: x,
          y: y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd - 35,
          drag: 0.94,
          life: 0.5 + Math.random() * 0.35,
          maxLife: 0.85,
          color: Math.random() > 0.4 ? "#f1c40f" : "#e67e22",
          size: 3 + Math.random() * 4
        });
      }
    }

    createGuardBlockParticles(gx, gy, dmg, enemy) {
      this.shakeScreen(3.0, 0.2);

      // Radiant shield deflection ring
      this.createShockwave(gx, gy, "#f1c40f", Math.min(80, 40 + dmg * 0.15), 0.35, 3.0);
      this.createShockwave(gx + 6, gy, "#74b9ff", Math.min(55, 30 + dmg * 0.1), 0.25, 2.0);

      // Deflected spark burst flying forward against the enemy
      const sparkCount = Math.min(18, 8 + Math.floor(dmg / 20));
      for (let i = 0; i < sparkCount; i++) {
        const ang = (Math.random() - 0.5) * 1.6;
        const spd = 80 + Math.random() * 150;
        this.particles.push({
          type: "spark",
          x: gx + 10,
          y: gy + (Math.random() - 0.5) * 14,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          drag: 0.92,
          life: 0.25 + Math.random() * 0.2,
          maxLife: 0.45,
          color: Math.random() > 0.4 ? "#f1c40f" : "#ecf0f1",
          size: 2.5 + Math.random() * 2.5
        });
      }
    }

    createGuardDeathFX(gx, gy, isSlain) {
      if (isSlain) {
        this.sound.play("hit");
        // Shield shatter debris particles
        for (let i = 0; i < 16; i++) {
          const ang = Math.random() * Math.PI * 2;
          const spd = 40 + Math.random() * 90;
          this.particles.push({
            type: "debris",
            x: gx,
            y: gy,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd - 20,
            gravity: 240,
            drag: 0.94,
            life: 0.45 + Math.random() * 0.3,
            maxLife: 0.75,
            color: Math.random() > 0.5 ? "#7f8c8d" : "#bdc3c7",
            size: 3 + Math.random() * 4
          });
        }
      } else {
        // Honorable recall sparkle particles
        for (let i = 0; i < 14; i++) {
          this.particles.push({
            type: "holy_mote",
            x: gx + (Math.random() - 0.5) * 20,
            y: gy + (Math.random() - 0.5) * 20,
            vx: (Math.random() - 0.5) * 30,
            vy: -40 - Math.random() * 60,
            life: 0.45 + Math.random() * 0.3,
            maxLife: 0.75,
            color: "#f1c40f",
            size: 3 + Math.random() * 3
          });
        }
      }
    }

    updateGuards(dt) {
      if (!this.guards || this.guards.length === 0) return;

      for (let i = this.guards.length - 1; i >= 0; i--) {
        const g = this.guards[i];

        // Countdown active duration
        g.duration -= dt;
        if (g.duration <= 0 || g.hp <= 0) {
          this.createGuardDeathFX(g.x, g.y, g.hp <= 0);
          this.guards.splice(i, 1);
          continue;
        }

        // Decay hit & attack animations
        if (g.hitAnim > 0) g.hitAnim = Math.max(0, g.hitAnim - dt * 3.8);
        if (g.attackAnim > 0) g.attackAnim = Math.max(0, g.attackAnim - dt * 4.5);
        g.walkPhase += dt * 3.5;

        // Ensure position responds to screen resizing
        g.x = g.rx * this.width;
        g.y = g.ry * this.height;

        // Counter-Attack: nearby invaders within 85px get struck by infantry swords!
        g.attackCooldown -= dt;
        if (g.attackCooldown <= 0) {
          const target = this.enemies.find(e => {
            return e.hp > 0 && Math.hypot(e.x - g.x, e.y - g.y) <= 85;
          });

          if (target) {
            g.attackCooldown = g.attackInterval;
            g.attackAnim = 1.0;

            const strikeDmg = g.isCaptain ? 52 : 38;
            this.damageEnemy(target, strikeDmg, "physical", "#f1c40f", true);

            // Melee sword slash sparks
            for (let p = 0; p < 5; p++) {
              this.particles.push({
                x: target.x + (Math.random() - 0.5) * 10,
                y: target.y + (Math.random() - 0.5) * 10,
                vx: 40 + Math.random() * 60,
                vy: (Math.random() - 0.5) * 70,
                life: 0.18,
                maxLife: 0.18,
                color: "#f1c40f",
                size: 2.5 + Math.random() * 2
              });
            }
          }
        }
      }
    }

    renderGuards() {
      if (!this.guards || this.guards.length === 0) return;

      const isAr = this.lang === "ar";

      this.guards.forEach(g => {
        const x = g.x;
        const y = g.y;
        const isHit = g.hitAnim > 0;
        const isAttacking = g.attackAnim > 0;
        const hpPct = Math.max(0, Math.min(1, g.hp / g.maxHp));
        const durationPct = Math.max(0, Math.min(1, g.duration / g.maxDuration));

        this.ctx.save();

        // 1. Ground Shadow & Golden Holy Aura Ring
        this.ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
        this.ctx.beginPath();
        this.ctx.ellipse(x, y + 16, 16, 7, 0, 0, Math.PI * 2);
        this.ctx.fill();

        // Pulsing golden vanguard protective circle
        const auraPulse = 0.5 + Math.sin(g.walkPhase) * 0.25;
        this.ctx.strokeStyle = `rgba(241, 196, 15, ${auraPulse * 0.7})`;
        this.ctx.lineWidth = 1.8;
        this.ctx.beginPath();
        this.ctx.arc(x, y + 2, 22, 0, Math.PI * 2);
        this.ctx.stroke();

        // 2. Billowing Cape
        const capeWave = Math.sin(g.walkPhase) * 4;
        this.ctx.fillStyle = g.isCaptain ? "#c0392b" : "#2980b9";
        this.ctx.beginPath();
        this.ctx.moveTo(x - 8, y - 6);
        this.ctx.lineTo(x - 18 + capeWave, y + 12);
        this.ctx.lineTo(x - 8, y + 10);
        this.ctx.closePath();
        this.ctx.fill();

        // 3. Knight Armor Body & Legs
        this.ctx.fillStyle = isHit ? "#ffffff" : (g.isCaptain ? "#34495e" : "#2c3e50");
        this.ctx.beginPath();
        try {
          if (typeof this.ctx.roundRect === "function") {
            this.ctx.roundRect(x - 8, y - 8, 16, 20, 4);
          } else {
            this.ctx.rect(x - 8, y - 8, 16, 20);
          }
        } catch (e) {
          this.ctx.rect(x - 8, y - 8, 16, 20);
        }
        this.ctx.fill();

        // Gold Trim / Royal Breastplate Inlay
        this.ctx.strokeStyle = "#f1c40f";
        this.ctx.lineWidth = 1.5;
        this.ctx.beginPath();
        this.ctx.moveTo(x - 5, y - 4);
        this.ctx.lineTo(x, y + 4);
        this.ctx.lineTo(x + 5, y - 4);
        this.ctx.stroke();

        // 4. Helmet & Red Feather Plume
        this.ctx.fillStyle = isHit ? "#ffffff" : "#7f8c8d";
        this.ctx.beginPath();
        this.ctx.arc(x, y - 12, 8, 0, Math.PI * 2);
        this.ctx.fill();

        // Golden Visor slit
        this.ctx.fillStyle = "#111827";
        this.ctx.fillRect(x - 2, y - 13, 6, 2.5);

        // Feather Plume on helm
        this.ctx.fillStyle = "#e74c3c";
        this.ctx.beginPath();
        this.ctx.ellipse(x - 3, y - 20, 3, 6, -0.3, 0, Math.PI * 2);
        this.ctx.fill();

        // 5. Heavy Tower Shield (Raised toward right facing oncoming monsters)
        const shieldHitOffset = isHit ? -3 : (isAttacking ? 3 : 0);
        const shieldX = x + 8 + shieldHitOffset;
        const shieldY = y;

        this.ctx.save();
        this.ctx.fillStyle = isHit ? "#fff3cd" : (g.isCaptain ? "#1a252f" : "#2c3e50");
        this.ctx.strokeStyle = isHit ? "#ffffff" : "#f1c40f";
        this.ctx.lineWidth = 2;

        // Curved kite shield path
        this.ctx.beginPath();
        this.ctx.moveTo(shieldX - 2, shieldY - 14);
        this.ctx.lineTo(shieldX + 8, shieldY - 14);
        this.ctx.lineTo(shieldX + 8, shieldY + 6);
        this.ctx.lineTo(shieldX + 3, shieldY + 16);
        this.ctx.lineTo(shieldX - 2, shieldY + 6);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();

        // Golden Lion / Cross Crest on Shield
        this.ctx.strokeStyle = "#f1c40f";
        this.ctx.lineWidth = 1.5;
        this.ctx.beginPath();
        this.ctx.moveTo(shieldX + 3, shieldY - 10);
        this.ctx.lineTo(shieldX + 3, shieldY + 10);
        this.ctx.moveTo(shieldX, shieldY - 3);
        this.ctx.lineTo(shieldX + 6, shieldY - 3);
        this.ctx.stroke();
        this.ctx.restore();

        // 6. Thrusting Spear / Broadsword
        const attackThrust = isAttacking ? 16 : 0;
        this.ctx.strokeStyle = "#ecf0f1";
        this.ctx.lineWidth = 2.5;
        this.ctx.beginPath();
        this.ctx.moveTo(x + 2, y + 2);
        this.ctx.lineTo(x + 20 + attackThrust, y - 2);
        this.ctx.stroke();

        // Sword blade tip glint
        this.ctx.fillStyle = "#f1c40f";
        this.ctx.beginPath();
        this.ctx.arc(x + 20 + attackThrust, y - 2, 2.5, 0, Math.PI * 2);
        this.ctx.fill();

        // 7. Captain's Imperial Battle Banner (if captain)
        if (g.isCaptain) {
          const bannerWave = Math.sin(g.walkPhase * 1.5) * 5;
          this.ctx.strokeStyle = "#795548";
          this.ctx.lineWidth = 2.5;
          this.ctx.beginPath();
          this.ctx.moveTo(x - 10, y + 14);
          this.ctx.lineTo(x - 10, y - 36);
          this.ctx.stroke();

          // Banner cloth
          this.ctx.fillStyle = "#c0392b";
          this.ctx.beginPath();
          this.ctx.moveTo(x - 10, y - 35);
          this.ctx.lineTo(x - 28 + bannerWave, y - 31);
          this.ctx.lineTo(x - 24 + bannerWave, y - 19);
          this.ctx.lineTo(x - 10, y - 17);
          this.ctx.closePath();
          this.ctx.fill();

          // Gold eagle icon on banner
          this.ctx.fillStyle = "#f1c40f";
          this.ctx.font = "10px sans-serif";
          this.ctx.fillText("🦅", x - 23 + bannerWave * 0.5, y - 23);
        }

        // 8. Overhead HP Bar & Remaining Duration Gauge
        const barW = 34;
        const barH = 5;
        const barX = x - barW / 2;
        const barY = y - 28;

        // HP Background
        this.ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
        this.ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);

        // HP Fill (Gradient green -> red)
        const hpColor = hpPct > 0.5 ? "#2ecc71" : (hpPct > 0.25 ? "#f39c12" : "#e74c3c");
        this.ctx.fillStyle = hpColor;
        this.ctx.fillRect(barX, barY, barW * hpPct, barH);

        // Duration line underneath
        this.ctx.fillStyle = "#38ef7d";
        this.ctx.fillRect(barX, barY + barH + 1, barW * durationPct, 2);

        // Shield status badge
        this.ctx.fillStyle = "#f1c40f";
        this.ctx.font = "bold 8px 'Tajawal', sans-serif";
        this.ctx.textAlign = "center";
        const title = isAr ? g.nameAr : g.nameEn;
        this.ctx.fillText(title, x, barY - 4);

        this.ctx.restore();
      });
    }

    // --- QUICK WAR COMMANDS (أوامر الحرب السريعة والمبسطة بنقرة واحدة) ---
    quickDeployWeapon() {
      // 1. Check if there are open slots on the castle battlements
      const emptySlots = this.slots.filter(s => !s.tower);

      if (emptySlots.length > 0) {
        // Prioritize key strategic slots (gate overlook, forward bastions, central wall)
        const priorityOrder = [
          "slot_gate_top", "slot_gate_low", "slot_fwd_top", "slot_fwd_bot",
          "slot_wall_mid1", "slot_keep_mid", "slot_wall_top", "slot_wall_low1",
          "slot_n_high1", "slot_n_high2", "slot_s_high1", "slot_s_high2"
        ];
        emptySlots.sort((a, b) => {
          const idxA = priorityOrder.indexOf(a.id);
          const idxB = priorityOrder.indexOf(b.id);
          return (idxA !== -1 ? idxA : 99) - (idxB !== -1 ? idxB : 99);
        });
        const bestSlot = emptySlots[0];

        // Pick best weapon affordable
        const candidates = [
          WEAPON_TYPES.tesla,        // 300
          WEAPON_TYPES.flamethrower, // 250
          WEAPON_TYPES.ballista,     // 225
          WEAPON_TYPES.cannon,       // 175
          WEAPON_TYPES.archer        // 100
        ];

        const affordable = candidates.find(w => this.gold >= w.cost);
        if (!affordable) {
          this.sound.play("error");
          this.createFloatingText(this.lang === "ar" ? "تحتاج 100 🪙 على الأقل لتجهيز سلاح! 🏹" : "Need at least 100 🪙 to deploy weapon!", this.width * 0.35, this.height * 0.5, "#e74c3c", 1.25);
          return;
        }

        this.buildTower(bestSlot, affordable);
        this.sound.play("build");
        this.createShockwave(bestSlot.x, bestSlot.y, "#00cec9", 60, 0.35, 3.0);
        for (let i = 0; i < 12; i++) {
          this.particles.push({
            type: "spark",
            x: bestSlot.x + (Math.random() - 0.5) * 16,
            y: bestSlot.y + (Math.random() - 0.5) * 16,
            vx: (Math.random() - 0.5) * 70,
            vy: -20 - Math.random() * 50,
            drag: 0.93,
            life: 0.3,
            maxLife: 0.3,
            color: "#00cec9",
            size: 3
          });
        }
        const wName = I18N[this.lang][affordable.nameKey] || affordable.id;
        this.createFloatingText(`+${affordable.icon} ${wName}!`, bestSlot.x, bestSlot.y - 25, "#00cec9", 1.3);
        this.updateHUD();
        return;
      }

      // 2. All slots filled: Automatically upgrade an existing tower!
      const upgradableTowers = [];
      this.towers.forEach(t => {
        const tmpl = WEAPON_TYPES[t.id];
        if (tmpl && tmpl.upgrades && t.level <= tmpl.upgrades.length) {
          const upg = tmpl.upgrades[t.level - 1];
          if (upg) {
            upgradableTowers.push({ tower: t, upgrade: upg, cost: upg.cost, level: t.level });
          }
        }
      });

      if (upgradableTowers.length === 0) {
        this.createFloatingText(this.lang === "ar" ? "جميع الأسلحة في أعلى مستوى! ⭐" : "All weapons at max level!", this.width * 0.35, this.height * 0.5, "#f1c40f", 1.2);
        return;
      }

      upgradableTowers.sort((a, b) => a.level - b.level || a.cost - b.cost);
      const affordableUpg = upgradableTowers.find(u => this.gold >= u.cost);

      if (!affordableUpg) {
        const minCost = upgradableTowers[0].cost;
        this.sound.play("error");
        this.createFloatingText(this.lang === "ar" ? `تحتاج ${minCost} 🪙 لترقية السلاح! ⭐` : `Need ${minCost} 🪙 to upgrade weapon!`, this.width * 0.35, this.height * 0.5, "#e74c3c", 1.25);
        return;
      }

      this.gold -= affordableUpg.cost;
      const tower = affordableUpg.tower;
      const upg = affordableUpg.upgrade;
      tower.level++;
      if (upg.damage) tower.damage = upg.damage;
      if (upg.range) tower.range = upg.range;
      if (upg.fireRate) tower.fireRate = upg.fireRate;
      if (upg.aoe) tower.aoe = upg.aoe;
      if (upg.pierce) tower.pierce = upg.pierce;

      this.sound.play("build");
      this.createShockwave(tower.x, tower.y, "#f1c40f", 65, 0.4, 3.5);
      for (let i = 0; i < 14; i++) {
        this.particles.push({
          type: "spark",
          x: tower.x + (Math.random() - 0.5) * 16,
          y: tower.y + (Math.random() - 0.5) * 16,
          vx: (Math.random() - 0.5) * 80,
          vy: -30 - Math.random() * 60,
          drag: 0.92,
          life: 0.35,
          maxLife: 0.35,
          color: "#f1c40f",
          size: 3.5
        });
      }
      this.createFloatingText(`⭐ Lvl ${tower.level} UPGRADE!`, tower.x, tower.y - 25, "#f1c40f", 1.35);
      this.updateHUD();
    }

    quickDeployArmy() {
      if (this.gold < 35) {
        this.sound.play("error");
        this.createFloatingText(this.lang === "ar" ? "تحتاج 35 🪙 لتجنيد مقاتل! ⚔️" : "Need 35 🪙 to recruit troop!", this.width * 0.38, this.height * 0.5, "#e74c3c", 1.25);
        return;
      }

      // Smart unit recruitment selection based on gold
      const candidates = [];
      if (this.gold >= 130) candidates.push("war_chariot", "cavalier", "paladin");
      else if (this.gold >= 95) candidates.push("cavalier", "paladin", "archer");
      else if (this.gold >= 75) candidates.push("paladin", "archer", "swordsman");
      else if (this.gold >= 50) candidates.push("archer", "swordsman");
      else candidates.push("swordsman");

      const chosenType = candidates[Math.floor(Math.random() * candidates.length)];
      this.recruitUnit(chosenType);
    }

    // --- WAR CATEGORY CONTROLS (نظام فئات الحرب المنظم: الأسلحة والجيش) ---
    toggleWarCategory(category) {
      if (this.activeCategoryDrawer === category) {
        this.closeWarDrawer();
        return;
      }
      this.openWarDrawer(category);
    }

    openWarDrawer(category) {
      this.activeCategoryDrawer = category;
      this.currentShopTab = category === "weapons" ? "towers" : "army";
      const drawerContainer = document.getElementById("war-drawer-container");
      const wpnPanel = document.getElementById("drawer-weapons-panel");
      const armyPanel = document.getElementById("drawer-army-panel");
      const btnWpn = document.getElementById("btn-category-weapons");
      const btnArmy = document.getElementById("btn-category-army");
      const wpnIndicator = document.getElementById("wpn-indicator");
      const armyIndicator = document.getElementById("army-indicator");

      if (drawerContainer) drawerContainer.classList.remove("collapsed");

      if (category === "weapons") {
        if (wpnPanel) {
          wpnPanel.style.display = "flex";
          wpnPanel.classList.remove("hidden");
        }
        if (armyPanel) {
          armyPanel.style.display = "none";
          armyPanel.classList.add("hidden");
        }
        if (btnWpn) btnWpn.classList.add("active");
        if (btnArmy) btnArmy.classList.remove("active");
        if (wpnIndicator) wpnIndicator.textContent = "▴";
        if (armyIndicator) armyIndicator.textContent = "▾";
        this.sound.play("upgrade");
      } else if (category === "army") {
        if (armyPanel) {
          armyPanel.style.display = "flex";
          armyPanel.classList.remove("hidden");
        }
        if (wpnPanel) {
          wpnPanel.style.display = "none";
          wpnPanel.classList.add("hidden");
        }
        if (btnArmy) btnArmy.classList.add("active");
        if (btnWpn) btnWpn.classList.remove("active");
        if (armyIndicator) armyIndicator.textContent = "▴";
        if (wpnIndicator) wpnIndicator.textContent = "▾";
        this.sound.play("guard");
      }

      this.updateShopCards();
    }

    closeWarDrawer() {
      this.activeCategoryDrawer = null;
      const drawerContainer = document.getElementById("war-drawer-container");
      const wpnPanel = document.getElementById("drawer-weapons-panel");
      const armyPanel = document.getElementById("drawer-army-panel");
      const btnWpn = document.getElementById("btn-category-weapons");
      const btnArmy = document.getElementById("btn-category-army");
      const wpnIndicator = document.getElementById("wpn-indicator");
      const armyIndicator = document.getElementById("army-indicator");

      if (drawerContainer) drawerContainer.classList.add("collapsed");
      if (wpnPanel) {
        wpnPanel.style.display = "none";
        wpnPanel.classList.add("hidden");
      }
      if (armyPanel) {
        armyPanel.style.display = "none";
        armyPanel.classList.add("hidden");
      }
      if (btnWpn) btnWpn.classList.remove("active");
      if (btnArmy) btnArmy.classList.remove("active");
      if (wpnIndicator) wpnIndicator.textContent = "▾";
      if (armyIndicator) armyIndicator.textContent = "▾";
      this.sound.play("click");
    }

    // --- ROYAL FIELD ARMY LOGIC (فيلق الجيش الملكي الميداني) ---
    applyFormationPositions(forceReset = false) {
      if (!this.allies || this.allies.length === 0) return;
      const count = this.allies.length;
      const w = this.width;
      const h = this.height;

      this.allies.forEach((ally, idx) => {
        if (ally.customPositioned && !forceReset) return;

        let targetX = w * 0.38;
        let targetY = h * 0.50;

        if (this.currentFormation === "front_wall") {
          // Frontline defensive wall: vertical line defending the road corridor
          const rank = Math.floor(idx / 5);
          const rowInRank = idx % 5;
          const rankCount = Math.min(count - rank * 5, 5);
          const rankSpread = Math.min(h * 0.28, Math.max(60, (rankCount - 1) * 28));
          const rankStartY = h * 0.50 - rankSpread / 2;
          const rankStepY = rankCount > 1 ? rankSpread / (rankCount - 1) : 0;

          targetX = w * (0.38 - rank * 0.05);
          targetY = rankStartY + rowInRank * rankStepY;
        } else if (this.currentFormation === "flank_guard") {
          // Two wings guarding upper and lower flanks
          if (idx === 0) {
            targetX = w * 0.42;
            targetY = h * 0.50;
          } else {
            const isUpper = idx % 2 === 1;
            const flankIdx = Math.floor((idx - 1) / 2);
            const flankSpreadX = flankIdx * 28;
            const flankSpreadY = flankIdx * 16;
            targetX = w * 0.36 + flankSpreadX;
            targetY = isUpper ? (h * 0.40 - flankSpreadY) : (h * 0.60 + flankSpreadY);
          }
        } else if (this.currentFormation === "wedge_assault") {
          // V-shaped wedge pointing into enemy forces
          if (idx === 0) {
            targetX = w * 0.48;
            targetY = h * 0.50;
          } else {
            const isUpper = idx % 2 === 1;
            const rank = Math.floor((idx + 1) / 2);
            targetX = w * 0.48 - rank * (w * 0.035);
            targetY = h * 0.50 + (isUpper ? -1 : 1) * (rank * (h * 0.045));
          }
        }

        ally.targetX = Math.max(w * 0.28, Math.min(w * 0.75, targetX));
        ally.targetY = Math.max(h * 0.35, Math.min(h * 0.65, targetY));
        if (forceReset) {
          ally.customPositioned = false;
        }
      });
    }

    toggleFormation() {
      const formations = ["front_wall", "flank_guard", "wedge_assault"];
      const currentIdx = formations.indexOf(this.currentFormation);
      const nextIdx = (currentIdx + 1) % formations.length;
      this.currentFormation = formations[nextIdx];

      const iconEl = document.getElementById("formation-icon");
      const labelEl = document.getElementById("formation-label");
      const dict = I18N[this.lang];

      let labelText = "";
      let icon = "🛡️";

      if (this.currentFormation === "front_wall") {
        icon = "🛡️";
        labelText = dict.formationFront || (this.lang === "ar" ? "تشكيل: جدار أمامي" : "Formation: Front Wall");
      } else if (this.currentFormation === "flank_guard") {
        icon = "⚔️";
        labelText = dict.formationFlank || (this.lang === "ar" ? "تشكيل: حماية جانبية" : "Formation: Flank Guard");
      } else if (this.currentFormation === "wedge_assault") {
        icon = "⚡";
        labelText = dict.formationWedge || (this.lang === "ar" ? "تشكيل: هجوم الوتد" : "Formation: Wedge Assault");
      }

      if (iconEl) iconEl.textContent = icon;
      if (labelEl) labelEl.textContent = labelText;

      this.sound.play("guard_horn");
      this.applyFormationPositions(true);

      // Visual feedback
      this.createFloatingText(labelText, this.width * 0.42, this.height * 0.48, "#2ecc71", 1.3);
      this.createShockwave(this.width * 0.40, this.height * 0.50, "#2ecc71", 75, 0.35, 3);
    }

    recruitUnit(uType) {
      const tmpl = ALLIED_UNIT_TYPES[uType];
      if (!tmpl) return;

      if (this.gold < tmpl.cost) {
        this.sound.play("error");
        this.createFloatingText(this.lang === "ar" ? "الذهب غير كافٍ! 🪙" : "Not enough gold!", this.width * 0.45, this.height * 0.50, "#e74c3c", 1.1);
        return;
      }

      this.gold -= tmpl.cost;

      // Drawbridge spawn point
      const spawnX = this.width * 0.285;
      const spawnY = this.height * 0.50 + (Math.random() - 0.5) * 35;

      const ally = {
        id: "ally_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
        type: uType,
        nameAr: tmpl.nameAr,
        nameEn: tmpl.nameEn,
        icon: tmpl.icon,
        hp: tmpl.hp,
        maxHp: tmpl.hp,
        damage: tmpl.damage,
        speed: tmpl.speed,
        baseSpeed: tmpl.speed,
        range: tmpl.range,
        attackInterval: tmpl.attackInterval,
        attackCooldown: 0.2,
        radius: tmpl.radius,
        isRanged: tmpl.isRanged || false,
        aoe: tmpl.aoe || 0,
        color: tmpl.color,
        x: spawnX,
        y: spawnY,
        targetX: spawnX + 40,
        targetY: spawnY,
        customPositioned: false,
        isSelected: false,
        hitAnim: 0,
        attackAnim: 0,
        walkPhase: Math.random() * Math.PI * 2,
        inCombat: false,
        currentTarget: null,
        clashCooldown: 0
      };

      this.allies.push(ally);
      this.applyFormationPositions();

      this.sound.play("guard_horn");
      this.createShockwave(spawnX, spawnY, tmpl.color, 45, 0.3, 2.5);

      for (let i = 0; i < 10; i++) {
        this.particles.push({
          type: "spark",
          x: spawnX + (Math.random() - 0.5) * 12,
          y: spawnY + (Math.random() - 0.5) * 12,
          vx: 40 + Math.random() * 60,
          vy: (Math.random() - 0.5) * 70,
          drag: 0.93,
          life: 0.28,
          maxLife: 0.28,
          color: "#f1c40f",
          size: 3
        });
      }

      const unitName = this.lang === "ar" ? tmpl.nameAr : tmpl.nameEn;
      this.createFloatingText(`+${tmpl.icon} ${unitName}!`, spawnX + 15, spawnY - 24, "#2ecc71", 1.25);

      this.updateHUD();
    }

    createClashParticles(x, y, attackerColor, defenderColor, isCrit = false, clashType = "melee") {
      // 1. Tactile Screen Micro-shake
      this.shakeScreen(isCrit ? 3.5 : 1.4, isCrit ? 0.2 : 0.08);

      // 2. High-speed ricochet sparks
      const sparkCount = isCrit ? 14 : 8;
      for (let i = 0; i < sparkCount; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 70 + Math.random() * 140;
        this.particles.push({
          type: "spark",
          x: x + (Math.random() - 0.5) * 6,
          y: y + (Math.random() - 0.5) * 6,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          drag: 0.91,
          life: 0.18 + Math.random() * 0.15,
          maxLife: 0.33,
          color: Math.random() > 0.4 ? "#f1c40f" : "#ffffff",
          size: 2.5 + Math.random() * 2.5
        });
      }

      // 3. Radiant impact shockwave
      this.createShockwave(x, y, isCrit ? "#ff3838" : (attackerColor || "#f1c40f"), isCrit ? 55 : 32, 0.22, 2.2);

      // 4. Ground combat dust / smoke puffs
      for (let i = 0; i < 3; i++) {
        this.particles.push({
          type: "smoke",
          x: x + (Math.random() - 0.5) * 10,
          y: y + 8,
          vx: (Math.random() - 0.5) * 20,
          vy: -10 - Math.random() * 15,
          life: 0.25 + Math.random() * 0.15,
          maxLife: 0.4,
          color: "rgba(149, 165, 166, 0.45)",
          size: 5,
          growth: 10
        });
      }

      // 5. Splatter droplets (blood / ichor / aura)
      const splatterColor = defenderColor || "#e74c3c";
      for (let i = 0; i < 4; i++) {
        this.particles.push({
          x: x,
          y: y,
          vx: (Math.random() - 0.5) * 90,
          vy: (Math.random() - 0.5) * 90,
          gravity: 190,
          life: 0.25,
          maxLife: 0.25,
          color: splatterColor,
          size: 2.2
        });
      }

      // 6. Sound
      if (isCrit) {
        this.sound.play("guard_block");
      } else {
        this.sound.play("hit");
      }
    }

    updateAllies(dt) {
      if (!this.allies || this.allies.length === 0) return;

      const w = this.width;
      const h = this.height;

      for (let i = this.allies.length - 1; i >= 0; i--) {
        const ally = this.allies[i];

        // If ally HP depleted
        if (ally.hp <= 0) {
          this.sound.play("hit");
          this.createShockwave(ally.x, ally.y, "#e74c3c", 40, 0.25, 2.0);
          for (let p = 0; p < 12; p++) {
            this.particles.push({
              type: "debris",
              x: ally.x,
              y: ally.y,
              vx: (Math.random() - 0.5) * 80,
              vy: -30 - Math.random() * 60,
              gravity: 220,
              drag: 0.94,
              life: 0.35 + Math.random() * 0.2,
              maxLife: 0.55,
              color: ally.color,
              size: 3 + Math.random() * 3
            });
          }
          this.createFloatingText("FALLEN ⚔️", ally.x, ally.y - 18, "#e74c3c", 1.0);
          this.allies.splice(i, 1);
          this.updateHUD();
          continue;
        }

        // Decay animations
        if (ally.hitAnim > 0) ally.hitAnim = Math.max(0, ally.hitAnim - dt * 4.5);
        if (ally.attackAnim > 0) ally.attackAnim = Math.max(0, ally.attackAnim - dt * 4.0);
        if (ally.attackCooldown > 0) ally.attackCooldown -= dt;
        if (ally.clashCooldown > 0) ally.clashCooldown -= dt;

        // Skip movement if user is actively dragging this ally
        if (this.draggingAlly === ally) continue;

        // Autonomous enemy target acquisition (Request 5)
        let targetEnemy = null;
        let minDist = Infinity;
        const aggroRadius = ally.type === "cavalier" ? 340 : (ally.isRanged ? 280 : 250);

        for (const e of this.enemies) {
          if (e.hp <= 0) continue;
          const d = Math.hypot(e.x - ally.x, e.y - ally.y);
          const enemyNearDefense = e.x < w * 0.78 && Math.abs(e.y - ally.y) < 140;
          if (d <= aggroRadius || enemyNearDefense) {
            if (d < minDist) {
              minDist = d;
              targetEnemy = e;
            }
          }
        }

        if (targetEnemy) {
          ally.currentTarget = targetEnemy;
          const dx = targetEnemy.x - ally.x;
          const dy = targetEnemy.y - ally.y;
          const dist = Math.hypot(dx, dy);

          // Check if within attack range
          if (dist <= ally.range) {
            ally.inCombat = true;

            if (ally.attackCooldown <= 0) {
              ally.attackCooldown = ally.attackInterval;
              ally.attackAnim = 1.0;

              if (ally.isRanged) {
                if (ally.type === "archer") {
                  this.sound.play("arrow");
                  this.projectiles.push({
                    type: "arrow",
                    x: ally.x,
                    y: ally.y,
                    target: targetEnemy,
                    targetX: targetEnemy.x,
                    targetY: targetEnemy.y,
                    speed: 620,
                    damage: ally.damage,
                    color: "#2ecc71"
                  });
                } else if (ally.type === "war_chariot") {
                  this.sound.play("cannon");
                  this.projectiles.push({
                    type: "cannonball",
                    x: ally.x,
                    y: ally.y,
                    targetX: targetEnemy.x,
                    targetY: targetEnemy.y,
                    damage: ally.damage,
                    speed: 460,
                    aoe: ally.aoe || 70,
                    color: "#e67e22"
                  });
                }
              } else {
                const isCrit = Math.random() < 0.25;
                const finalDmg = isCrit ? Math.floor(ally.damage * 1.5) : ally.damage;

                this.damageEnemy(targetEnemy, finalDmg, "physical", ally.color, true);

                const clashX = (ally.x + targetEnemy.x) / 2;
                const clashY = (ally.y + targetEnemy.y) / 2;
                this.createClashParticles(clashX, clashY, ally.color, targetEnemy.color || "#e74c3c", isCrit, "melee");

                if (isCrit) {
                  this.createFloatingText(`💥 ${finalDmg}`, targetEnemy.x, targetEnemy.y - 20, "#f39c12", 1.15);
                }

                if (ally.type === "cavalier") {
                  targetEnemy.x = Math.min(w * 0.95, targetEnemy.x + 12);
                  this.shakeScreen(2.2, 0.12);
                }
              }
            }
          } else {
            // Move automatically towards nearest enemy
            ally.inCombat = false;
            const moveSpeed = ally.speed * (ally.type === "cavalier" ? 1.25 : 1.0);
            ally.x += (dx / dist) * moveSpeed * dt;
            ally.y += (dy / dist) * moveSpeed * dt;
            ally.walkPhase += dt * 8.0;

            if (Math.random() < 0.15) {
              this.particles.push({
                type: "smoke",
                x: ally.x + (Math.random() - 0.5) * 8,
                y: ally.y + ally.radius * 0.6,
                vx: -(dx / dist) * 15,
                vy: -10,
                life: 0.18,
                maxLife: 0.18,
                color: "rgba(189, 195, 199, 0.35)",
                size: 3
              });
            }
          }
        } else {
          // No enemies in range: return smoothly to formation target
          ally.currentTarget = null;
          ally.inCombat = false;

          const destX = ally.targetX || (w * 0.38);
          const destY = ally.targetY || (h * 0.50);
          const returnDx = destX - ally.x;
          const returnDy = destY - ally.y;
          const returnDist = Math.hypot(returnDx, returnDy);

          if (returnDist > 6) {
            const returnSpeed = ally.speed * 0.85;
            ally.x += (returnDx / returnDist) * returnSpeed * dt;
            ally.y += (returnDy / returnDist) * returnSpeed * dt;
            ally.walkPhase += dt * 5.0;
          }
        }

        // Close-quarters enemy melee collision
        for (const enemy of this.enemies) {
          if (enemy.hp <= 0 || enemy.flying) continue;
          const contactDist = Math.hypot(enemy.x - ally.x, enemy.y - ally.y);
          if (contactDist <= 38) {
            if (ally.clashCooldown <= 0) {
              ally.clashCooldown = 0.8;
              const enemyDmg = Math.max(8, Math.floor(enemy.damageToCastle * 0.45));
              const mitigatedDmg = ally.type === "paladin" ? Math.floor(enemyDmg * 0.65) : enemyDmg;

              ally.hp = Math.max(0, ally.hp - mitigatedDmg);
              ally.hitAnim = 1.0;

              const midX = (ally.x + enemy.x) / 2;
              const midY = (ally.y + enemy.y) / 2;
              this.createClashParticles(midX, midY, enemy.color || "#e74c3c", ally.color, false, "defend");
              this.createFloatingText(`-${mitigatedDmg}`, ally.x, ally.y - 18, "#e74c3c", 0.95);
            }
            break;
          }
        }
      }
    }

    renderAllies() {
      if (!this.allies || this.allies.length === 0) return;

      const isAr = this.lang === "ar";
      const ctx = this.ctx;

      this.allies.forEach(a => {
        const x = a.x;
        const y = a.y;
        const isHit = a.hitAnim > 0.1;
        const isAttacking = a.attackAnim > 0.1;
        const hpPct = Math.max(0, Math.min(1, a.hp / a.maxHp));

        ctx.save();

        // 1. Selection / Drag reticle & Tether line to anchor
        if (a.isSelected || this.draggingAlly === a) {
          ctx.strokeStyle = "rgba(52, 152, 219, 0.4)";
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(a.targetX || x, a.targetY || y);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = "rgba(52, 152, 219, 0.15)";
          ctx.beginPath();
          ctx.arc(x, y, a.radius + 12, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = "#3498db";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(x, y, a.radius + 8, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
          ctx.beginPath();
          ctx.ellipse(x, y + a.radius * 0.7, a.radius * 0.9, a.radius * 0.45, 0, 0, Math.PI * 2);
          ctx.fill();
        }

        const walkBob = Math.sin(a.walkPhase || 0) * 2;
        const attackLunge = isAttacking ? 8 : 0;

        if (isHit) {
          ctx.filter = "brightness(1.8) drop-shadow(0 0 6px #ff7675)";
        }

        if (a.type === "swordsman") {
          // --- ROYAL SWORDSMAN ---
          ctx.fillStyle = "#2c3e50";
          ctx.fillRect(x - 5, y + 4 + walkBob, 4, 8);
          ctx.fillRect(x + 1, y + 4 - walkBob, 4, 8);

          ctx.fillStyle = "#2980b9";
          ctx.fillRect(x - 6, y - 6, 12, 11);
          ctx.fillStyle = "#bdc3c7";
          ctx.fillRect(x - 5, y - 5, 10, 8);

          ctx.fillStyle = "#7f8c8d";
          ctx.beginPath();
          ctx.arc(x, y - 10, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#e74c3c";
          ctx.beginPath();
          ctx.ellipse(x - 2, y - 16, 2.5, 5, -0.2, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = "#2c3e50";
          ctx.strokeStyle = "#f1c40f";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(x + 4, y - 7);
          ctx.lineTo(x + 11, y - 7);
          ctx.lineTo(x + 11, y + 5);
          ctx.lineTo(x + 7, y + 10);
          ctx.lineTo(x + 4, y + 5);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          ctx.strokeStyle = "#ecf0f1";
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(x - 2, y);
          ctx.lineTo(x + 12 + attackLunge, y - 4);
          ctx.stroke();
        } else if (a.type === "archer") {
          // --- ROYAL ARCHER ---
          ctx.fillStyle = "#27ae60";
          ctx.fillRect(x - 4, y + 4 + walkBob, 3.5, 7);
          ctx.fillRect(x + 1, y + 4 - walkBob, 3.5, 7);

          ctx.fillStyle = "#2ecc71";
          ctx.fillRect(x - 5, y - 6, 10, 10);

          ctx.fillStyle = "#27ae60";
          ctx.beginPath();
          ctx.arc(x, y - 9, 5.5, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = "#8b5a2b";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(x + 6 + (isAttacking ? 2 : 0), y - 2, 9, -Math.PI * 0.45, Math.PI * 0.45);
          ctx.stroke();
          ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x + 6, y - 10);
          ctx.lineTo(x + 6 - (isAttacking ? 4 : 0), y - 2);
          ctx.lineTo(x + 6, y + 6);
          ctx.stroke();
        } else if (a.type === "paladin") {
          // --- HEAVY PALADIN ---
          ctx.fillStyle = "#bdc3c7";
          ctx.fillRect(x - 7, y + 5 + walkBob, 5, 9);
          ctx.fillRect(x + 2, y + 5 - walkBob, 5, 9);

          ctx.fillStyle = "#f1c40f";
          ctx.fillRect(x - 8, y - 8, 16, 14);
          ctx.fillStyle = "#ecf0f1";
          ctx.fillRect(x - 6, y - 6, 12, 10);

          ctx.fillStyle = "#bdc3c7";
          ctx.beginPath();
          ctx.arc(x, y - 12, 7.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#f1c40f";
          ctx.beginPath();
          ctx.moveTo(x - 6, y - 16);
          ctx.lineTo(x - 12, y - 22);
          ctx.lineTo(x - 6, y - 12);
          ctx.moveTo(x + 6, y - 16);
          ctx.lineTo(x + 12, y - 22);
          ctx.lineTo(x + 6, y - 12);
          ctx.fill();

          ctx.fillStyle = "#2c3e50";
          ctx.strokeStyle = "#f1c40f";
          ctx.lineWidth = 2;
          ctx.fillRect(x + 6, y - 12, 7, 20);
          ctx.strokeRect(x + 6, y - 12, 7, 20);
          ctx.fillStyle = "#f1c40f";
          ctx.fillRect(x + 8.5, y - 9, 2, 14);
          ctx.fillRect(x + 6.5, y - 4, 6, 2);

          ctx.strokeStyle = "#95a5a6";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(x - 4, y + 2);
          ctx.lineTo(x + 14 + attackLunge, y - 10);
          ctx.stroke();
          ctx.fillStyle = "#7f8c8d";
          ctx.fillRect(x + 12 + attackLunge, y - 14, 6, 8);
        } else if (a.type === "cavalier") {
          // --- ROYAL CAVALIER ---
          ctx.fillStyle = "#6d4c41";
          ctx.beginPath();
          ctx.ellipse(x, y + 2, 16, 10, 0, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = "#8e44ad";
          ctx.fillRect(x - 8, y - 4, 16, 9);
          ctx.strokeStyle = "#f1c40f";
          ctx.lineWidth = 1;
          ctx.strokeRect(x - 8, y - 4, 16, 9);

          ctx.fillStyle = "#5d4037";
          ctx.beginPath();
          ctx.moveTo(x + 10, y);
          ctx.lineTo(x + 18, y - 8);
          ctx.lineTo(x + 22, y - 4);
          ctx.lineTo(x + 15, y + 4);
          ctx.closePath();
          ctx.fill();

          ctx.strokeStyle = "#4e342e";
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(x - 10, y + 6);
          ctx.lineTo(x - 14 + walkBob * 2, y + 15);
          ctx.moveTo(x + 8, y + 6);
          ctx.lineTo(x + 12 - walkBob * 2, y + 15);
          ctx.stroke();

          ctx.fillStyle = "#bdc3c7";
          ctx.fillRect(x - 5, y - 12, 10, 9);
          ctx.beginPath();
          ctx.arc(x, y - 16, 5.5, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = "#d35400";
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(x - 4, y - 6);
          ctx.lineTo(x + 28 + attackLunge, y - 12);
          ctx.stroke();
          ctx.fillStyle = "#e74c3c";
          ctx.beginPath();
          ctx.moveTo(x + 22 + attackLunge, y - 12);
          ctx.lineTo(x + 12 + attackLunge, y - 18);
          ctx.lineTo(x + 14 + attackLunge, y - 12);
          ctx.closePath();
          ctx.fill();
        } else if (a.type === "war_chariot") {
          // --- WAR MACHINE CHARIOT ---
          ctx.fillStyle = "#795548";
          ctx.fillRect(x - 16, y - 8, 32, 16);
          ctx.strokeStyle = "#2c3e50";
          ctx.lineWidth = 2;
          ctx.strokeRect(x - 16, y - 8, 32, 16);

          ctx.fillStyle = "#95a5a6";
          ctx.beginPath();
          ctx.moveTo(x + 16, y - 6);
          ctx.lineTo(x + 25 + attackLunge, y);
          ctx.lineTo(x + 16, y + 6);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = "#34495e";
          ctx.fillRect(x - 4, y - 14, 18 + attackLunge, 7);
          ctx.fillStyle = "#1a252f";
          ctx.fillRect(x + 13 + attackLunge, y - 15, 3, 9);

          ctx.fillStyle = "#2c3e50";
          ctx.beginPath();
          ctx.arc(x - 10, y + 8, 6, 0, Math.PI * 2);
          ctx.arc(x + 10, y + 8, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#bdc3c7";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        ctx.filter = "none";

        // Overhead HP Bar
        const barW = Math.max(26, a.radius * 2);
        const barH = 4;
        const barX = x - barW / 2;
        const barY = y - a.radius - 12;

        ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
        ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);

        const hpColor = hpPct > 0.5 ? "#2ecc71" : (hpPct > 0.25 ? "#f39c12" : "#e74c3c");
        ctx.fillStyle = hpColor;
        ctx.fillRect(barX, barY, barW * hpPct, barH);

        // Unit Title Badge
        ctx.fillStyle = "#ecf0f1";
        ctx.font = "bold 8px 'Tajawal', sans-serif";
        ctx.textAlign = "center";
        const unitLabel = isAr ? a.nameAr : a.nameEn;
        ctx.fillText(`${a.icon} ${unitLabel}`, x, barY - 3);

        ctx.restore();
      });
    }

    // --- WAVE GENERATOR & BOSS WAVES ---
    getBossForWave(wave) {
      if (wave % 5 !== 0) return null;
      if (wave === 5) return "boss_inferno";
      if (wave === 10) return "boss_phantom";
      if (wave === 15) return "boss_dreadnought";
      if (wave === 20) return "boss_tempest";
      if (wave === 25) return "boss_chaos";
      // Waves beyond 25 cycle through the legendary bosses
      const cycle = ["boss_inferno", "boss_phantom", "boss_dreadnought", "boss_tempest", "boss_chaos"];
      const idx = Math.floor((wave / 5 - 1) % cycle.length);
      return cycle[idx];
    }

    triggerBossWarning(bossKey) {
      const bossTmpl = ENEMY_TYPES[bossKey] || ENEMY_TYPES.boss_inferno;
      const dict = I18N[this.lang];
      const bossName = dict[bossTmpl.nameKey] || bossTmpl.name;
      const bossDesc = dict[bossTmpl.descKey] || (this.lang === "ar" ? "زعيم جبار يهدد القلعة!" : "Massive boss approaching the citadel!");
      const bossTip = dict[bossTmpl.tipKey] || (this.lang === "ar" ? "استخدم تشكيلة متكاملة من الأبراج لهزيمته!" : "Use a balanced tower combination!");

      // 1. Setup Warning Overlay Banner
      const overlay = document.getElementById("boss-warning-overlay");
      if (overlay) {
        const avatarEl = document.getElementById("boss-warn-avatar");
        const titleEl = document.getElementById("boss-warn-title");
        const descEl = document.getElementById("boss-warn-desc");
        const tagsContainer = document.getElementById("boss-combo-tags");

        if (avatarEl) avatarEl.textContent = bossTmpl.icon || "👑";
        if (titleEl) titleEl.textContent = bossName;
        if (descEl) descEl.textContent = bossDesc;

        if (tagsContainer) {
          const comboList = (this.lang === "ar" ? bossTmpl.recommendedCombo : bossTmpl.recommendedComboEn) || [];
          tagsContainer.innerHTML = comboList.map(tag => `<span class="combo-pill">${tag}</span>`).join("");
        }

        overlay.classList.remove("hidden");
        this.bossWarningTimer = 3.6; // Auto hides after 3.6s
      }

      // 2. Setup Top Boss HUD Bar
      const bossHud = document.getElementById("boss-hud");
      if (bossHud) {
        const hudAvatar = document.getElementById("boss-hud-avatar");
        const hudName = document.getElementById("boss-hud-name");
        const hudTip = document.getElementById("boss-tip-text");
        const phaseBadge = document.getElementById("boss-phase-badge");
        const hpBar = document.getElementById("boss-hp-bar");
        const hpLag = document.getElementById("boss-hp-lag");
        const hpVal = document.getElementById("boss-hp-val");

        if (hudAvatar) hudAvatar.textContent = bossTmpl.icon || "👑";
        if (hudName) hudName.textContent = bossName;
        if (hudTip) hudTip.textContent = bossTip;
        if (phaseBadge) phaseBadge.textContent = "PHASE 1";
        if (hpBar) hpBar.style.width = "100%";
        if (hpLag) hpLag.style.width = "100%";
        if (hpVal) hpVal.textContent = "100%";
        bossHud.classList.remove("hidden");
      }

      this.sound.play("horn");
      this.shakeScreen(7, 0.5);
    }

    startNextWave() {
      if (this.waveActive || this.isGameOver || this.isVictory) return;
      this.waveActive = true;
      this.sound.play("horn");

      const wave = this.currentWave;
      const count = 10 + wave * 4;
      const queue = [];
      const isBossWave = (wave % 5 === 0);
      const bossType = this.getBossForWave(wave);

      // Dynamic Tactical Weather Shift for the Wave
      this.evaluateWaveWeather(wave, isBossWave, bossType);

      if (isBossWave && bossType) {
        // --- 5TH WAVE BOSS INVASION LOGIC ---
        this.triggerBossWarning(bossType);

        // 1. Specialized Vanguard Escorts (Distract single-target towers)
        const escortCount = Math.min(12, 6 + Math.floor(wave / 5) * 2);
        for (let e = 0; e < escortCount; e++) {
          let escortType = "fast_runner";
          if (bossType === "boss_inferno") {
            escortType = e % 2 === 0 ? "fast_runner" : "goblin";
          } else if (bossType === "boss_phantom") {
            escortType = e % 2 === 0 ? "wolf" : "fast_runner";
          } else if (bossType === "boss_dreadnought") {
            escortType = e % 2 === 0 ? "armored_knight" : "shield";
          } else if (bossType === "boss_tempest") {
            escortType = e % 2 === 0 ? "wyvern" : "sorcerer";
          } else if (bossType === "boss_chaos") {
            escortType = e % 3 === 0 ? "colossus_giant" : (e % 3 === 1 ? "armored_knight" : "fast_runner");
          }

          queue.push({
            type: escortType,
            pathIndex: e % BATTLEFIELD_PATHS.length,
            delay: 0.42 + Math.random() * 0.38
          });
        }

        // 2. The Mighty Boss marches down central highway
        queue.push({
          type: bossType,
          pathIndex: 1, // Central highway
          delay: 1.6,
          hpMultiplier: 1 + Math.max(0, (wave - 5) / 5) * 0.35
        });

        // 3. Flanking reinforcement waves behind the boss
        for (let t = 0; t < 8; t++) {
          queue.push({
            type: Math.random() < 0.55 ? "fast_runner" : (Math.random() < 0.5 ? "armored_knight" : "orc"),
            pathIndex: (t % 2 === 0) ? 0 : 2,
            delay: 0.6 + Math.random() * 0.5
          });
        }
      } else {
        // --- REGULAR TACTICAL WAVES ---
        let waveAlertText = "";
        if (wave === 2) {
          waveAlertText = this.lang === "ar" ? "⚡ هجوم سريع: كشافة الظلال يركضون بسرعة فائقة!" : "⚡ Fast Rush: Shadow Sprinters advance rapidly!";
        } else if (wave === 4) {
          waveAlertText = this.lang === "ar" ? "🛡️ فيلق المدرعات: فرسان الفولاذ يصدون السهام!" : "🛡️ Armored Vanguard: Ironclad Knights deflect arrows!";
        } else if (wave === 6) {
          waveAlertText = this.lang === "ar" ? "🗿 زحف العمالقة: العمالقة الصخريون يهزون الأرض!" : "🗿 Colossus Advance: Massive stone giants shake the earth!";
        }

        if (waveAlertText) {
          this.createFloatingText(waveAlertText, this.width * 0.55, this.height * 0.22, "#ffca28", 1.25);
        }

        for (let i = 0; i < count; i++) {
          let type = "goblin";
          const roll = Math.random();

          if (wave === 2) {
            type = roll < 0.65 ? "fast_runner" : "goblin";
          } else if (wave === 3) {
            type = roll < 0.4 ? "fast_runner" : (roll < 0.7 ? "orc" : "goblin");
          } else if (wave === 4) {
            type = roll < 0.55 ? "armored_knight" : (roll < 0.8 ? "shield" : "fast_runner");
          } else if (wave === 6) {
            type = roll < 0.35 ? "colossus_giant" : (roll < 0.65 ? "armored_knight" : "fast_runner");
          } else {
            if (roll < 0.28) {
              type = "fast_runner";
            } else if (roll < 0.52) {
              type = "armored_knight";
            } else if (roll < 0.66) {
              type = "orc";
            } else if (roll < 0.78) {
              type = "sorcerer";
            } else if (roll < 0.88 && wave >= 5) {
              type = "colossus_giant";
            } else if (roll < 0.94 && wave >= 7) {
              type = "ram";
            } else if (wave >= 8) {
              type = "wyvern";
            } else {
              type = "goblin";
            }
          }

          let pIndex = i % BATTLEFIELD_PATHS.length;
          if (type === "fast_runner") {
            pIndex = Math.random() < 0.5 ? 3 : 0;
          } else if (type === "armored_knight") {
            pIndex = Math.random() < 0.6 ? 1 : 2;
          } else if (type === "colossus_giant") {
            pIndex = Math.random() < 0.55 ? 1 : (Math.random() < 0.5 ? 0 : 2);
          }

          queue.push({
            type: type,
            pathIndex: pIndex,
            delay: 0.52 + Math.random() * 0.82
          });
        }
      }

      this.waveEnemiesQueue = queue;
      this.spawnTimer = 0.4;
      this.updateHUD();
    }

    calculateEnemyStats(typeKey, wave, hpMultiplier = 1) {
      const template = ENEMY_TYPES[typeKey] || ENEMY_TYPES.goblin;

      // Speed variance (±12%) so each individual enemy has realistic organic variation
      const speedVariance = template.isBoss ? 1.0 : (0.88 + Math.random() * 0.24);
      let calculatedSpeed = template.speed * speedVariance;

      // Health scaling per wave with individual variance (±8%)
      const waveHpScale = 1 + (wave - 1) * (template.isBoss ? 0.35 : 0.23);
      const hpVariance = template.isBoss ? 1.0 : (0.92 + Math.random() * 0.16);
      let calculatedHp = Math.round(template.hp * waveHpScale * hpMultiplier * hpVariance);

      // Gold and score scaling
      const goldReward = Math.round(template.gold + wave * (template.isBoss ? 15 : 1.5));
      const scoreReward = Math.round(template.score * (1 + wave * (template.isBoss ? 0.3 : 0.15)));

      return {
        template,
        maxHp: calculatedHp,
        speed: calculatedSpeed,
        baseSpeed: calculatedSpeed,
        gold: goldReward,
        score: scoreReward,
        armor: template.armor || 0,
        damageToCastle: Math.round(template.damageToCastle * (1 + (wave - 1) * 0.08)),
        category: template.category || "standard",
        dodgeChance: template.dodgeChance || 0,
        sprintInterval: template.sprintInterval || 0,
        slowResistance: template.slowResistance || 0
      };
    }

    spawnEnemy(info) {
      const stats = this.calculateEnemyStats(info.type, this.currentWave, info.hpMultiplier || 1);
      const template = stats.template;

      // Select assigned route from multiple intertwining battlefield paths
      const pIdx = (info.pathIndex !== undefined) ? info.pathIndex : Math.floor(Math.random() * BATTLEFIELD_PATHS.length);
      const chosenPath = BATTLEFIELD_PATHS[pIdx] || BATTLEFIELD_PATHS[0];
      const waypoints = chosenPath.waypoints;
      const startWp = waypoints[0];

      // Lane jitter so enemies travelling the same road do not stack in a rigid line
      const jitterX = template.isBoss ? 0 : (Math.random() - 0.5) * 14;
      const jitterY = template.isBoss ? 0 : (Math.random() - 0.5) * 14;

      const startX = startWp.rx * this.width + jitterX;
      const startY = startWp.ry * this.height + jitterY;

      const enemy = {
        type: info.type,
        category: stats.category,
        name: template.name,
        pathIndex: pIdx,
        waypoints: waypoints,
        currentWpIdx: 1, // Heading towards next waypoint
        jitterX: jitterX,
        jitterY: jitterY,
        x: startX,
        y: startY,
        maxHp: stats.maxHp,
        hp: stats.maxHp,
        speed: stats.speed,
        baseSpeed: stats.baseSpeed,
        gold: stats.gold,
        score: stats.score,
        radius: template.radius,
        color: template.color,
        armor: stats.armor,
        damageToCastle: stats.damageToCastle,
        isBoss: template.isBoss || false,
        flying: template.flying || false,
        icon: template.icon,
        dodgeChance: stats.dodgeChance,
        sprintInterval: stats.sprintInterval,
        sprintTimer: Math.random() * 2,
        isSprinting: false,
        slowResistance: stats.slowResistance,
        footstepTimer: 0,
        frozenTime: 0,
        burnTime: 0,
        burnDps: 0,
        attackCooldown: 0,
        trailTimer: 0,
        reachedCastle: false,
        // Boss specialized mechanics state
        shieldType: "magma", // for chaos boss
        phaseTimer: 0,
        phantomBrokenTimer: 0,
        enraged: false
      };

      if (enemy.isBoss) {
        this.activeBoss = enemy;
        this.sound.play("horn");
        this.shakeScreen(7, 0.4);
      }

      this.enemies.push(enemy);
    }

    // --- GAME LOOP & UPDATES ---
    gameLoop(now) {
      const dt = Math.min((now - this.lastTime) / 1000, 0.1) * this.speed;
      this.lastTime = now;

      if (!this.isPaused && !this.isGameOver) {
        this.update(dt);
      }

      this.render();
      requestAnimationFrame(this.gameLoop.bind(this));
    }

    update(dt) {
      this.ambientTime += dt;
      this.flagsWavePhase += dt * 3.5;

      // Mana gradual regeneration
      if (this.mana < 100) {
        this.mana = Math.min(100, this.mana + dt * 2.5);
      }

      // Spell cooldown ticks
      for (const k in this.spellCooldowns) {
        if (this.spellCooldowns[k] > 0) {
          this.spellCooldowns[k] = Math.max(0, this.spellCooldowns[k] - dt);
        }
      }

      // Screen shake decay
      if (this.screenShakeTime > 0) {
        this.screenShakeTime -= dt;
      }

      // Boss Warning overlay timer decay
      if (this.bossWarningTimer > 0) {
        this.bossWarningTimer -= dt;
        if (this.bossWarningTimer <= 0) {
          const overlay = document.getElementById("boss-warning-overlay");
          if (overlay) overlay.classList.add("hidden");
        }
      }

      // Spawning
      if (this.waveEnemiesQueue.length > 0) {
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
          const next = this.waveEnemiesQueue.shift();
          this.spawnEnemy(next);
          this.spawnTimer = next.delay;
        }
      } else if (this.waveActive && this.enemies.length === 0) {
        // Wave complete!
        this.onWaveCompleted();
      }

      // Update Enemies
      this.updateEnemies(dt);

      // Update Towers & Attacks
      this.updateTowers(dt);

      // Update Projectiles
      this.updateProjectiles(dt);

      // Update Ground Hazards
      this.updateHazards(dt);

      // Update Particles & Floating Text
      this.updateParticles(dt);

      // Dynamic Weather System update
      this.updateWeather(dt);

      // Update Royal Guards
      this.updateGuards(dt);

      // Update Royal Field Army
      this.updateAllies(dt);

      // Periodically refresh HUD
      this.updateHUD();
    }

    updateEnemies(dt) {
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const e = this.enemies[i];

        // Slow/Freeze resistance logic
        if (e.frozenTime > 0) {
          const resistance = e.slowResistance || 0;
          const slowFactor = 0.2 + (0.8 * resistance);
          e.frozenTime -= dt;
          e.speed = e.baseSpeed * slowFactor;
        } else if (e.isSprinting) {
          e.speed = e.baseSpeed * 1.48; // Sprint surge
        } else {
          e.speed = e.baseSpeed;
        }

        // Tactical Weather movement modifier (mud, snow, sandstorm)
        const wData = WEATHER_TYPES[this.currentWeather];
        if (wData && wData.enemySpeedMod) {
          let mod = wData.enemySpeedMod;
          if (e.isFlying && mod < 1.0) {
            mod = 1.0 - (1.0 - mod) * 0.4; // Flying units less slowed by mud
          }
          e.speed *= mod;
        }

        // Fast Enemy: Sprint Burst & Wind particle trails
        if (e.category === "fast") {
          e.sprintTimer += dt;
          if (e.sprintTimer >= e.sprintInterval) {
            e.isSprinting = true;
            if (e.sprintTimer >= e.sprintInterval + 1.2) {
              e.isSprinting = false;
              e.sprintTimer = 0;
            }
          }
          if (e.isSprinting) {
            e.trailTimer += dt;
            if (e.trailTimer > 0.08) {
              e.trailTimer = 0;
              this.particles.push({
                x: e.x + (Math.random() - 0.5) * 6,
                y: e.y + (Math.random() - 0.5) * 6,
                vx: 45,
                vy: 0,
                life: 0.22,
                maxLife: 0.22,
                color: "rgba(0, 210, 211, 0.65)",
                size: 3
              });
            }
          }
        }

        // Massive Colossus Enemy: Heavy Footstep micro-tremors & ground dust
        if (e.category === "massive") {
          e.footstepTimer += dt;
          if (e.footstepTimer >= 1.4) {
            e.footstepTimer = 0;
            this.createExplosion(e.x, e.y + e.radius * 0.6, "rgba(211, 84, 0, 0.45)", 6);
            if (Math.hypot(e.x - this.width * 0.3, e.y - this.height * 0.5) < 320) {
              this.shakeScreen(1.8, 0.15);
            }
          }
        }

        // Boss Specialized Runtime Passives
        if (e.isBoss) {
          if (e.phantomBrokenTimer > 0) {
            e.phantomBrokenTimer -= dt;
          }

          if (e.type === "boss_chaos") {
            e.phaseTimer = (e.phaseTimer || 0) + dt;
            if (e.phaseTimer >= 8.0) {
              e.phaseTimer = 0;
              e.shieldType = e.shieldType === "magma" ? "kinetic" : "magma";
              this.sound.play("tesla");
              this.createFloatingText(e.shieldType === "magma" ? "🔮 MAGMA SHIELD!" : "🛡️ KINETIC SHIELD!", e.x, e.y - 30, e.shieldType === "magma" ? "#e74c3c" : "#f1c40f", 1.25);
              this.createShockwave(e.x, e.y, e.shieldType === "magma" ? "#e74c3c" : "#f1c40f", 70, 0.4, 3);
            }
          }

          // Enrage sprint surge when HP < 50%
          if (e.hp < e.maxHp * 0.5 && !e.enraged) {
            e.enraged = true;
            e.baseSpeed *= 1.45;
            this.sound.play("horn");
            this.shakeScreen(6, 0.4);
            this.createFloatingText("⚡ BOSS ENRAGED! ⚡", e.x, e.y - 36, "#ff3838", 1.35);
          }
        }

        if (e.burnTime > 0) {
          e.burnTime -= dt;
          this.damageEnemy(e, e.burnDps * dt, "fire", "#e67e22", false);
        }

        if (e.hp <= 0) continue;

        // Check if an ally is directly blocking this enemy in frontline melee combat
        let blockedByAlly = false;
        if (this.allies && this.allies.length > 0 && !e.flying) {
          for (const a of this.allies) {
            if (a.hp > 0 && Math.hypot(a.x - e.x, a.y - e.y) <= 38) {
              blockedByAlly = true;
              break;
            }
          }
        }

        // Path Waypoint Navigation
        if (!e.reachedCastle) {
          if (!blockedByAlly) {
            const wp = e.waypoints[e.currentWpIdx];
            if (wp) {
              const targetX = wp.rx * this.width + (e.flying ? 0 : e.jitterX);
              const targetY = wp.ry * this.height + (e.flying ? 0 : e.jitterY);
              const dx = targetX - e.x;
              const dy = targetY - e.y;
              const dist = Math.hypot(dx, dy);

              if (dist < Math.max(12, e.speed * dt)) {
                e.currentWpIdx++;
                if (e.currentWpIdx >= e.waypoints.length) {
                  e.reachedCastle = true;
                }
              } else {
                e.x += (dx / dist) * e.speed * dt;
                e.y += (dy / dist) * e.speed * dt;
              }
            } else {
              e.reachedCastle = true;
            }
          }
        }

        // Castle Wall Attack if arrived
        if (e.reachedCastle) {
          e.attackCooldown -= dt;
          if (e.attackCooldown <= 0) {
            this.attackCastle(e);
            e.attackCooldown = 1.6;
          }
        }
      }

      // Clean dead enemies
      this.enemies = this.enemies.filter(e => e.hp > 0);
    }

    attackCastle(enemy) {
      const dmg = enemy.damageToCastle;

      // Royal Guard Phalanx Damage Interception (نداء الحرس)
      const aliveGuards = (this.guards || []).filter(g => g.hp > 0);
      if (aliveGuards.length > 0) {
        // Find the guard positioned vertically closest to the attacking enemy
        aliveGuards.sort((a, b) => Math.abs(a.y - enemy.y) - Math.abs(b.y - enemy.y));
        const guard = aliveGuards[0];

        // Guard absorbs damage instead of the castle wall
        guard.hp = Math.max(0, guard.hp - dmg);
        guard.hitAnim = 1.0;

        // Play shield block sound & block FX
        this.sound.play("guard_block");
        this.createGuardBlockParticles(guard.x, guard.y, dmg, enemy);

        // Floating indicator: guard intercepted damage!
        this.createFloatingText(`-${dmg} 🛡️`, guard.x + 12, guard.y - 16, "#f39c12", 1.25);

        // Castle wall remains completely undamaged!
        return;
      }

      this.castleHp = Math.max(0, this.castleHp - dmg);
      this.sound.play("hit");

      // Dynamic Particle System: Specialized Castle Rampart Hit FX!
      this.spawnCastleImpactParticles(this.width * 0.28, enemy.y, dmg, enemy);

      // Trigger dynamic SVG hit impact animation and update HUD immediately
      const shieldIcon = document.getElementById("castle-shield-svg");
      if (shieldIcon) {
        shieldIcon.classList.remove("hit-impact", "heal-impact");
        void shieldIcon.offsetWidth;
        shieldIcon.classList.add("hit-impact");
      }
      this.updateHUD();

      if (this.castleHp <= 0) {
        this.handleGameOver();
      }
    }

    spawnCastleImpactParticles(wallX, hitY, dmg, enemy) {
      const isColossusOrBoss = enemy && (enemy.isBoss || enemy.category === "massive");
      const impactScale = isColossusOrBoss ? 1.6 : Math.min(1.4, 0.9 + (dmg / 150));

      // Screen shake proportional to impact magnitude
      this.shakeScreen(isColossusOrBoss ? 10 : Math.min(8, 3.5 + dmg * 0.02), 0.35);

      // 1. Dual Shockwave Rings (Outer Red Defense Ring & Inner Amber Spark Ring)
      this.createShockwave(wallX, hitY, isColossusOrBoss ? "#ff3838" : "#e74c3c", Math.min(130, 45 + dmg * 0.12), 0.45, 4.5);
      this.createShockwave(wallX - 12, hitY, "#f39c12", Math.min(85, 30 + dmg * 0.08), 0.32, 3.5);

      // 2. Exploding Stone Masonry Chunks (Debris) bursting backwards into courtyard
      const debrisCount = isColossusOrBoss ? 26 : Math.min(22, 10 + Math.floor(dmg / 15));
      const stoneColors = ["#7f8c8d", "#95a5a6", "#34495e", "#bdc3c7", "#2c3e50"];
      for (let i = 0; i < debrisCount; i++) {
        const vx = -(50 + Math.random() * 160 * impactScale);
        const vy = (Math.random() - 0.5) * 180 * impactScale;
        this.particles.push({
          type: "debris",
          x: wallX + (Math.random() - 0.5) * 8,
          y: hitY + (Math.random() - 0.5) * 16,
          vx: vx,
          vy: vy,
          gravity: 340,
          bounce: true,
          vRot: (Math.random() - 0.5) * 18,
          rot: Math.random() * Math.PI,
          life: 0.65 + Math.random() * 0.45,
          maxLife: 1.1,
          color: stoneColors[Math.floor(Math.random() * stoneColors.length)],
          size: (3.5 + Math.random() * 5.5) * impactScale
        });
      }

      // 3. Billowing Dust Clouds of Pulverized Mortar & Stone
      const smokeCount = isColossusOrBoss ? 14 : Math.min(10, 5 + Math.floor(dmg / 30));
      for (let i = 0; i < smokeCount; i++) {
        const ang = Math.PI + (Math.random() - 0.5) * 1.6;
        const spd = 25 + Math.random() * 70 * impactScale;
        this.particles.push({
          type: "smoke",
          x: wallX,
          y: hitY + (Math.random() - 0.5) * 20,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd - 20,
          growth: 22 * impactScale,
          drag: 0.92,
          life: 0.75 + Math.random() * 0.4,
          maxLife: 1.15,
          color: isColossusOrBoss ? "rgba(40, 20, 25, 0.75)" : "rgba(45, 55, 72, 0.7)",
          size: (12 + Math.random() * 10) * impactScale
        });
      }

      // 4. Fiery Wall Impact Sparks Flying in Semicircle
      const sparkCount = isColossusOrBoss ? 32 : Math.min(26, 12 + Math.floor(dmg / 12));
      for (let i = 0; i < sparkCount; i++) {
        const ang = Math.PI + (Math.random() - 0.5) * 2.2;
        const spd = 80 + Math.random() * 190 * impactScale;
        this.particles.push({
          type: "spark",
          x: wallX,
          y: hitY,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          drag: 0.93,
          life: 0.32 + Math.random() * 0.28,
          maxLife: 0.6,
          color: Math.random() < 0.45 ? "#ff4757" : (Math.random() < 0.8 ? "#ffa502" : "#ffffff"),
          size: 3 + Math.random() * 3
        });
      }

      // 5. High-Impact Castle Floating Damage Indicator
      this.createFloatingText(`-${dmg} HP`, wallX - 16, hitY - 8, "#e74c3c", isColossusOrBoss ? 1.45 : 1.15);
    }

    updateTowers(dt) {
      this.towers.forEach(t => {
        if (t.cooldown > 0) {
          t.cooldown -= dt;
        }

        // Tactical Weather Visibility modifier (e.g. Fog -15% tower range)
        const wData = WEATHER_TYPES[this.currentWeather];
        const effectiveRange = t.range * (wData ? wData.towerRangeMod : 1.0);

        // Find targets in range
        const inRange = this.enemies.filter(e => {
          return Math.hypot(e.x - t.x, e.y - t.y) <= effectiveRange && e.hp > 0;
        });

        if (inRange.length === 0) return;

        // Sort by priority
        let target = null;
        if (t.priority === "first") {
          // furthest left (closest to castle wall)
          target = inRange.reduce((prev, curr) => (curr.x < prev.x ? curr : prev));
        } else if (t.priority === "closest") {
          target = inRange.reduce((prev, curr) => {
            const d1 = Math.hypot(curr.x - t.x, curr.y - t.y);
            const d2 = Math.hypot(prev.x - t.x, prev.y - t.y);
            return d1 < d2 ? curr : prev;
          });
        } else if (t.priority === "strongest") {
          target = inRange.reduce((prev, curr) => (curr.hp > prev.hp ? curr : prev));
        } else if (t.priority === "weakest") {
          target = inRange.reduce((prev, curr) => (curr.hp < prev.hp ? curr : prev));
        }

        if (!target) return;

        // Rotate smoothly towards target
        t.angle = Math.atan2(target.y - t.y, target.x - t.x);

        // Fire if cooldown ready
        if (t.cooldown <= 0) {
          this.fireTower(t, target, inRange);
          t.cooldown = 1 / t.fireRate;
        }
      });
    }

    fireTower(tower, target, inRangeEnemies) {
      switch (tower.type) {
        case "arrow":
          this.sound.play("arrow");
          this.projectiles.push({
            type: "arrow",
            x: tower.x,
            y: tower.y,
            target: target,
            targetX: target.x,
            targetY: target.y,
            damage: tower.damage,
            speed: 700,
            tower: tower,
            color: tower.color
          });
          break;

        case "cannonball":
          this.sound.play("cannon");
          this.projectiles.push({
            type: "cannonball",
            x: tower.x,
            y: tower.y,
            targetX: target.x,
            targetY: target.y,
            damage: tower.damage,
            aoe: tower.aoe,
            speed: 460,
            tower: tower,
            color: "#e67e22"
          });
          break;

        case "bolt":
          this.sound.play("arrow");
          const boltWeatherMod = (this.currentWeather === "fog") ? 1.25 : 1.0;
          this.projectiles.push({
            type: "bolt",
            x: tower.x,
            y: tower.y,
            angle: tower.angle,
            damage: tower.damage * boltWeatherMod,
            pierce: (this.currentWeather === "fog") ? (tower.pierce + 1) : tower.pierce,
            hitEnemies: [],
            speed: 950,
            tower: tower,
            color: (this.currentWeather === "fog") ? "#00ffff" : "#00e5ff"
          });
          break;

        case "flame":
          // Instant cone flame stream
          this.createFlameCone(tower);
          break;

        case "lightning":
          this.sound.play("tesla");
          let chains = tower.chain || 3;
          let teslaDmgMult = 1.0;
          if (this.currentWeather === "rain") {
            chains += 2;
            teslaDmgMult = 1.25; // 25% conduction boost in thunderstorm!
          }
          this.castChainLightning(tower, target, chains, teslaDmgMult);
          break;

        case "boulder":
          this.sound.play("cannon");
          this.projectiles.push({
            type: "boulder",
            x: tower.x,
            y: tower.y,
            targetX: target.x,
            targetY: target.y,
            damage: tower.damage,
            aoe: tower.aoe,
            speed: 360,
            tower: tower,
            arcHeight: 60,
            progress: 0,
            totalDist: Math.hypot(target.x - tower.x, target.y - tower.y)
          });
          break;
      }
    }

    createFlameCone(tower) {
      const coneAngle = 0.5; // radians
      const flameRange = tower.range;

      // Tactical Weather multiplier for fire:
      let flameDmgMult = 1.0;
      if (this.currentWeather === "rain") flameDmgMult = 0.80; // water douses fire
      else if (this.currentWeather === "snow") flameDmgMult = 1.20; // thermal melting shock
      else if (this.currentWeather === "sandstorm") flameDmgMult = 1.25; // desert winds fan flames

      const finalFlameDamage = tower.damage * flameDmgMult;

      for (let i = 0; i < 4; i++) {
        const spread = (Math.random() - 0.5) * coneAngle;
        const ang = tower.angle + spread;
        const dist = 30 + Math.random() * (flameRange - 30);
        this.particles.push({
          x: tower.x + Math.cos(ang) * 15,
          y: tower.y + Math.sin(ang) * 15,
          vx: Math.cos(ang) * (flameRange * 1.5),
          vy: Math.sin(ang) * (flameRange * 1.5),
          life: 0.35,
          maxLife: 0.35,
          color: Math.random() > 0.5 ? "#f39c12" : "#e74c3c",
          size: 6 + Math.random() * 8
        });
      }

      this.enemies.forEach(e => {
        const dist = Math.hypot(e.x - tower.x, e.y - tower.y);
        if (dist <= flameRange) {
          const angToE = Math.atan2(e.y - tower.y, e.x - tower.x);
          const diff = Math.abs(this.angleDiff(tower.angle, angToE));
          if (diff <= coneAngle) {
            this.damageEnemy(e, finalFlameDamage, "fire", "#e74c3c");
            e.burnTime = 2.0;
            e.burnDps = finalFlameDamage * 0.8;
          }
        }
      });
    }

    castChainLightning(tower, initialTarget, maxChains, dmgMult = 1.0) {
      let current = initialTarget;
      const hitList = [current];
      let fromX = tower.x;
      let fromY = tower.y;

      for (let i = 0; i < maxChains; i++) {
        if (!current) break;

        // Damage & Stun (boosted in rain)
        const lightningColor = this.currentWeather === "rain" ? "#00e5ff" : "#9b59b6";
        this.damageEnemy(current, tower.damage * dmgMult * (1 - i * 0.15), "lightning", lightningColor);
        current.frozenTime = 0.5; // mini stun

        // Spark effect
        this.particles.push({
          type: "lightning_segment",
          x1: fromX,
          y1: fromY,
          x2: current.x,
          y2: current.y,
          life: 0.15,
          maxLife: 0.15,
          color: lightningColor
        });

        fromX = current.x;
        fromY = current.y;

        // Next chained target
        const next = this.enemies.find(e => {
          return !hitList.includes(e) && Math.hypot(e.x - current.x, e.y - current.y) < 160 && e.hp > 0;
        });

        current = next;
        if (current) hitList.push(current);
      }
    }

    angleDiff(a, b) {
      let diff = b - a;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      return diff;
    }

    updateProjectiles(dt) {
      for (let i = this.projectiles.length - 1; i >= 0; i--) {
        const p = this.projectiles[i];

        if (p.type === "arrow") {
          // Homing arrow
          if (p.target && p.target.hp > 0) {
            p.targetX = p.target.x;
            p.targetY = p.target.y;
          }
          const dx = p.targetX - p.x;
          const dy = p.targetY - p.y;
          const dist = Math.hypot(dx, dy);

          if (dist < p.speed * dt || dist < 12) {
            if (p.target && p.target.hp > 0) {
              this.damageEnemy(p.target, p.damage, "physical", p.color);
            }
            this.createExplosion(p.targetX, p.targetY, p.color, 6);
            this.projectiles.splice(i, 1);
            continue;
          }

          p.x += (dx / dist) * p.speed * dt;
          p.y += (dy / dist) * p.speed * dt;
        } else if (p.type === "cannonball") {
          const dx = p.targetX - p.x;
          const dy = p.targetY - p.y;
          const dist = Math.hypot(dx, dy);

          if (dist < p.speed * dt || dist < 15) {
            // AoE impact
            this.sound.play("cannon");
            this.shakeScreen(3, 0.2);
            this.createExplosion(p.targetX, p.targetY, "#e67e22", 30);
            this.enemies.forEach(e => {
              const d = Math.hypot(e.x - p.targetX, e.y - p.targetY);
              if (d <= p.aoe) {
                const splash = p.damage * (1 - d / p.aoe * 0.4);
                this.damageEnemy(e, splash, "explosive", "#e67e22");
              }
            });
            this.projectiles.splice(i, 1);
            continue;
          }

          p.x += (dx / dist) * p.speed * dt;
          p.y += (dy / dist) * p.speed * dt;
        } else if (p.type === "bolt") {
          // Piercing straight bolt (Armor Piercing)
          p.x += Math.cos(p.angle) * p.speed * dt;
          p.y += Math.sin(p.angle) * p.speed * dt;

          this.enemies.forEach(e => {
            if (!p.hitEnemies.includes(e) && Math.hypot(e.x - p.x, e.y - p.y) < e.radius + 10) {
              p.hitEnemies.push(e);
              this.damageEnemy(e, p.damage, "pierce", "#00e5ff");
              this.createExplosion(p.x, p.y, "#00e5ff", 10);
            }
          });

          if (p.hitEnemies.length >= p.pierce || p.x > this.width + 50 || p.y < -50 || p.y > this.height + 50) {
            this.projectiles.splice(i, 1);
          }
        } else if (p.type === "boulder") {
          const dx = p.targetX - p.x;
          const dy = p.targetY - p.y;
          const dist = Math.hypot(dx, dy);

          if (dist < p.speed * dt || dist < 18) {
            this.sound.play("cannon");
            this.shakeScreen(4, 0.3);
            this.createExplosion(p.targetX, p.targetY, "#d35400", 35);
            this.enemies.forEach(e => {
              const d = Math.hypot(e.x - p.targetX, e.y - p.targetY);
              if (d <= p.aoe) {
                this.damageEnemy(e, p.damage, "explosive", "#d35400");
              }
            });
            this.groundHazards.push({
              x: p.targetX,
              y: p.targetY,
              radius: 45,
              duration: 3.5,
              damagePerSec: 30,
              color: "rgba(211, 84, 0, 0.35)"
            });
            this.projectiles.splice(i, 1);
            continue;
          }

          p.x += (dx / dist) * p.speed * dt;
          p.y += (dy / dist) * p.speed * dt;
        }
      }
    }

    damageEnemy(enemy, damage, damageType = "physical", color = "#fff", showText = true) {
      if (enemy.hp <= 0) return;

      // 1. Fast Enemy Agility Dodge (Against physical single-target hits)
      if (damageType === "physical" && enemy.dodgeChance > 0 && Math.random() < enemy.dodgeChance) {
        this.createFloatingText("DODGE! 💨", enemy.x, enemy.y - 18, "#00d2d3", 1.1);
        this.particles.push({
          x: enemy.x,
          y: enemy.y,
          vx: 50,
          vy: (Math.random() - 0.5) * 30,
          life: 0.3,
          maxLife: 0.3,
          color: "#00d2d3",
          size: 6
        });
        return;
      }

      let finalDmg = damage;

      // 2. Armored Enemy Damage Absorption & Deflection
      if (enemy.armor > 0 && !enemy.isBoss) {
        if (damageType === "physical") {
          finalDmg *= (1 - enemy.armor);
          this.createExplosion(enemy.x - enemy.radius * 0.7, enemy.y, "#bdc3c7", 8);
          if (Math.random() > 0.5) {
            this.createFloatingText("DEFLECTED! 🛡️", enemy.x, enemy.y - 18, "#bdc3c7", 0.95);
          }
        } else if (damageType === "magic" || damageType === "fire" || damageType === "pierce") {
          finalDmg *= 1.35;
          if (Math.random() > 0.5) {
            this.createFloatingText("PIERCED! 🔥", enemy.x, enemy.y - 18, "#e74c3c", 1.05);
          }
        }
      }

      // 3. Massive Enemy Reaction
      if (enemy.category === "massive" && damageType === "explosive") {
        finalDmg *= 1.2;
      }

      // 4. SPECIALIZED BOSS TACTICAL COMBINATIONS & WEAKNESSES
      if (enemy.isBoss) {
        if (enemy.type === "boss_inferno") {
          // Inferno Behemoth: Immune to fire, vulnerable to Ballista pierce and Cannon shock
          if (damageType === "fire") {
            this.createFloatingText("IMMUNE! 🔥", enemy.x, enemy.y - 20, "#ff5252", 1.15);
            return; // Immune to fire
          } else if (damageType === "pierce" || damageType === "explosive") {
            finalDmg *= 1.85;
            if (Math.random() < 0.4) {
              this.createFloatingText("CORE CRUSHED! 💥", enemy.x, enemy.y - 22, "#ffb142", 1.2);
            }
          }
        } else if (enemy.type === "boss_phantom") {
          // Phantom Shadow Lord: 65% dodge against physical, broken by Tesla lightning
          if (enemy.phantomBrokenTimer > 0) {
            finalDmg *= 1.5;
          } else if (damageType === "lightning") {
            enemy.phantomBrokenTimer = 4.0; // Tesla breaks phantom form for 4s!
            this.createFloatingText("SHOCKED! ⚡ PHANTOM BROKEN!", enemy.x, enemy.y - 24, "#00e5ff", 1.3);
            this.createShockwave(enemy.x, enemy.y, "#00e5ff", 80, 0.35, 3.5);
            finalDmg *= 1.85;
          } else if (damageType === "fire") {
            enemy.speed = enemy.baseSpeed * 0.55; // Flamethrower slows phantom
            finalDmg *= 1.35;
          } else if (damageType === "physical") {
            if (Math.random() < 0.65) {
              this.createFloatingText("PHASED! 💨", enemy.x, enemy.y - 18, "#9b59b6", 1.15);
              return;
            }
          }
        } else if (enemy.type === "boss_dreadnought") {
          // Ironclad Dreadnought: 80% armor plating, shredded by Cannons/Catapults & conducted by Tesla
          if (damageType === "explosive") {
            finalDmg *= 2.1;
            enemy.armor = Math.max(0.15, (enemy.armor || 0.8) - 0.05);
            this.createFloatingText("ARMOR SHRED! 💣", enemy.x, enemy.y - 22, "#f39c12", 1.25);
            this.createExplosion(enemy.x, enemy.y, "#f39c12", 16);
          } else if (damageType === "lightning") {
            finalDmg *= 1.75;
            this.createFloatingText("CONDUCTED! ⚡", enemy.x, enemy.y - 20, "#00e5ff", 1.15);
          } else if (damageType === "physical") {
            finalDmg *= (1 - (enemy.armor || 0.8));
            this.createFloatingText("PLATING DEFLECT! 🛡️", enemy.x, enemy.y - 18, "#bdc3c7", 0.95);
          }
        } else if (enemy.type === "boss_tempest") {
          // Storm Tempest Monarch: Aerial boss deflecting slow projectiles, vulnerable to Ballista & Tesla
          if (damageType === "explosive") {
            if (Math.random() < 0.65) {
              this.createFloatingText("GALE DEFLECT! 🌪️", enemy.x, enemy.y - 18, "#00d2d3", 1.15);
              return;
            }
          } else if (damageType === "pierce" || damageType === "lightning") {
            finalDmg *= 1.8;
            this.createFloatingText("WINGS PIERCED! 🎯", enemy.x, enemy.y - 22, "#00e5ff", 1.25);
          }
        } else if (enemy.type === "boss_chaos") {
          // Chaos Titan Emperor: Dynamic cycling shield
          if (enemy.shieldType === "magma" && (damageType === "fire" || damageType === "magic")) {
            this.createFloatingText("ABSORBED! 🔮", enemy.x, enemy.y - 20, "#e74c3c", 1.1);
            finalDmg *= 0.15;
          } else if (enemy.shieldType === "kinetic" && (damageType === "physical" || damageType === "pierce")) {
            this.createFloatingText("BLOCKED! 🛡️", enemy.x, enemy.y - 20, "#f1c40f", 1.1);
            finalDmg *= 0.15;
          } else {
            finalDmg *= 1.4;
          }
        }
      }

      finalDmg = Math.max(1, Math.round(finalDmg));
      enemy.hp -= finalDmg;

      if (showText && (Math.random() > 0.35 || finalDmg > 50)) {
        this.createFloatingText(`-${finalDmg}`, enemy.x, enemy.y - 12, color || "#fff");
      }

      if (enemy.hp <= 0) {
        this.killEnemy(enemy);
      }
    }

    killEnemy(enemy) {
      this.sound.play("coin");
      this.gold += enemy.gold;
      this.score += enemy.score;
      this.enemiesDefeatedCount += 1;

      // Specialized Visual Explosion & Particle FX
      this.spawnEnemyDeathFX(enemy);
      this.createFloatingText(`+${enemy.gold} 🪙`, enemy.x, enemy.y - 20, "#f1c40f");

      if (enemy.isBoss) {
        this.sound.play("horn");
        this.gold += 350; // Extra Boss Bounty!
        this.score += 1500;
        this.createFloatingText("👑 BOSS SLAIN! +350 BONUS GOLD! 🏆", enemy.x, enemy.y - 45, "#f1c40f", 1.5);
        this.shakeScreen(12, 0.7);
        this.createShockwave(enemy.x, enemy.y, "#f39c12", 240, 0.7, 6);
        this.createShockwave(enemy.x, enemy.y, "#e74c3c", 160, 0.5, 4);

        if (this.activeBoss === enemy) {
          this.activeBoss = null;
          const bossHud = document.getElementById("boss-hud");
          if (bossHud) bossHud.classList.add("hidden");
        }
      }
    }

    createShockwave(x, y, color = "#fff", maxRadius = 70, duration = 0.4, lineWidth = 3.5) {
      this.particles.push({
        type: "shockwave",
        x: x,
        y: y,
        radius: 4,
        expandSpeed: maxRadius / duration,
        maxRadius: maxRadius,
        lineWidth: lineWidth,
        life: duration,
        maxLife: duration,
        color: color
      });
    }

    spawnEnemyDeathFX(enemy) {
      const ex = enemy.x;
      const ey = enemy.y;

      if (enemy.isBoss) {
        // --- 1. LEGENDARY BOSS DESTRUCTION SPECTACLE ---
        // Triple concentric chromatic shockwaves
        this.createShockwave(ex, ey, "#f1c40f", 220, 0.75, 6);
        this.createShockwave(ex, ey, "#e74c3c", 150, 0.55, 4.5);
        this.createShockwave(ex, ey, "#00e5ff", 90, 0.4, 3.5);

        // Radiant radial fiery spark burst
        for (let i = 0; i < 48; i++) {
          const ang = Math.random() * Math.PI * 2;
          const spd = 100 + Math.random() * 260;
          this.particles.push({
            type: "spark",
            x: ex,
            y: ey,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd,
            drag: 0.93,
            life: 0.45 + Math.random() * 0.35,
            maxLife: 0.8,
            color: Math.random() < 0.4 ? "#f1c40f" : (Math.random() < 0.7 ? "#ff4757" : "#00d2d3"),
            size: 4 + Math.random() * 4
          });
        }

        // Heavy volcanic and metallic shrapnel debris
        for (let i = 0; i < 36; i++) {
          const ang = Math.random() * Math.PI * 2;
          const spd = 80 + Math.random() * 220;
          this.particles.push({
            type: "debris",
            x: ex,
            y: ey,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd - 60,
            gravity: 360,
            bounce: true,
            vRot: (Math.random() - 0.5) * 16,
            rot: Math.random() * Math.PI,
            life: 0.8 + Math.random() * 0.5,
            maxLife: 1.3,
            color: Math.random() < 0.5 ? "#d35400" : (Math.random() < 0.5 ? "#c0392b" : "#7f8c8d"),
            size: 6 + Math.random() * 8
          });
        }

        // Billowing dark celebratory smoke clouds
        for (let i = 0; i < 20; i++) {
          const ang = Math.random() * Math.PI * 2;
          const spd = 20 + Math.random() * 70;
          this.particles.push({
            type: "smoke",
            x: ex,
            y: ey,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd - 35,
            growth: 28,
            drag: 0.92,
            life: 1.0 + Math.random() * 0.45,
            maxLife: 1.45,
            color: "rgba(20, 24, 35, 0.85)",
            size: 18 + Math.random() * 14
          });
        }

        // Colossal shower of golden coins
        for (let i = 0; i < 18; i++) {
          const ang = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
          const spd = 90 + Math.random() * 180;
          this.particles.push({
            type: "coin",
            x: ex,
            y: ey,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd,
            gravity: 300,
            bounce: true,
            vRot: 12 + Math.random() * 18,
            rot: Math.random() * Math.PI,
            life: 0.9 + Math.random() * 0.4,
            maxLife: 1.3,
            size: 7.5
          });
        }

        this.shakeScreen(12, 0.6);
      } else if (enemy.category === "massive") {
        // --- 2. MASSIVE COLOSSUS & SIEGE RAM DESTRUCTION ---
        this.createShockwave(ex, ey, "#e67e22", 110, 0.5, 4.5);
        this.createShockwave(ex, ey, "rgba(211, 84, 0, 0.6)", 65, 0.35, 3.5);

        for (let i = 0; i < 30; i++) {
          const ang = Math.random() * Math.PI * 2;
          const spd = 70 + Math.random() * 200;
          this.particles.push({
            type: "debris",
            x: ex,
            y: ey,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd - 50,
            gravity: 360,
            bounce: true,
            vRot: (Math.random() - 0.5) * 15,
            rot: Math.random() * Math.PI,
            life: 0.75 + Math.random() * 0.4,
            maxLife: 1.15,
            color: Math.random() < 0.5 ? "#d35400" : "#7f8c8d",
            size: 5.5 + Math.random() * 6.5
          });
        }

        for (let i = 0; i < 14; i++) {
          const ang = Math.random() * Math.PI * 2;
          const spd = 15 + Math.random() * 55;
          this.particles.push({
            type: "smoke",
            x: ex,
            y: ey,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd - 25,
            growth: 24,
            drag: 0.93,
            life: 0.85 + Math.random() * 0.35,
            maxLife: 1.2,
            color: "rgba(35, 42, 54, 0.75)",
            size: 15 + Math.random() * 10
          });
        }

        const coinCount = Math.min(10, Math.max(4, Math.floor(enemy.gold / 14)));
        for (let i = 0; i < coinCount; i++) {
          const ang = -Math.PI / 2 + (Math.random() - 0.5) * 1.3;
          const spd = 75 + Math.random() * 140;
          this.particles.push({
            type: "coin",
            x: ex,
            y: ey,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd,
            gravity: 280,
            bounce: true,
            vRot: 10 + Math.random() * 15,
            rot: Math.random() * Math.PI,
            life: 0.8 + Math.random() * 0.3,
            maxLife: 1.1,
            size: 6
          });
        }

        this.shakeScreen(7, 0.35);
      } else if (enemy.category === "fast") {
        // --- 3. FAST SHADOW SPRINTER & WOLF DESTRUCTION ---
        this.createShockwave(ex, ey, "#00d2d3", 75, 0.35, 4);
        this.createShockwave(ex, ey, "#ffffff", 40, 0.25, 2.5);

        for (let i = 0; i < 28; i++) {
          const ang = Math.random() * Math.PI * 2;
          const spd = 95 + Math.random() * 200;
          this.particles.push({
            type: "spark",
            x: ex,
            y: ey,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd,
            drag: 0.92,
            life: 0.32 + Math.random() * 0.25,
            maxLife: 0.57,
            color: Math.random() < 0.6 ? "#00d2d3" : "#ffffff",
            size: 3.5 + Math.random() * 3
          });
        }

        const coinCount = Math.min(6, Math.max(3, Math.floor(enemy.gold / 8)));
        for (let i = 0; i < coinCount; i++) {
          const ang = -Math.PI / 2 + (Math.random() - 0.5) * 1.2;
          const spd = 70 + Math.random() * 120;
          this.particles.push({
            type: "coin",
            x: ex,
            y: ey,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd,
            gravity: 280,
            bounce: true,
            vRot: 12 + Math.random() * 14,
            rot: Math.random() * Math.PI,
            life: 0.75 + Math.random() * 0.25,
            maxLife: 1.0,
            size: 5.5
          });
        }
      } else if (enemy.category === "armored") {
        // --- 4. ARMORED KNIGHT & SHIELD BEARER DESTRUCTION ---
        this.createShockwave(ex, ey, "#bdc3c7", 65, 0.35, 3.5);

        for (let i = 0; i < 24; i++) {
          const ang = Math.random() * Math.PI * 2;
          const spd = 65 + Math.random() * 160;
          this.particles.push({
            type: "debris",
            x: ex,
            y: ey,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd - 40,
            gravity: 340,
            bounce: true,
            vRot: (Math.random() - 0.5) * 16,
            rot: Math.random() * Math.PI,
            life: 0.7 + Math.random() * 0.3,
            maxLife: 1.0,
            color: Math.random() < 0.5 ? "#7f8c8d" : "#bdc3c7",
            size: 4 + Math.random() * 5.5
          });
        }

        for (let i = 0; i < 20; i++) {
          const ang = Math.random() * Math.PI * 2;
          const spd = 80 + Math.random() * 130;
          this.particles.push({
            type: "spark",
            x: ex,
            y: ey,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd,
            drag: 0.94,
            life: 0.35,
            maxLife: 0.35,
            color: Math.random() < 0.5 ? "#f1c40f" : "#ffa502",
            size: 3.5
          });
        }

        const coinCount = Math.min(8, Math.max(3, Math.floor(enemy.gold / 10)));
        for (let i = 0; i < coinCount; i++) {
          const ang = -Math.PI / 2 + (Math.random() - 0.5) * 1.3;
          const spd = 70 + Math.random() * 130;
          this.particles.push({
            type: "coin",
            x: ex,
            y: ey,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd,
            gravity: 280,
            bounce: true,
            vRot: 10 + Math.random() * 15,
            rot: Math.random() * Math.PI,
            life: 0.75 + Math.random() * 0.3,
            maxLife: 1.05,
            size: 6
          });
        }
      } else if (enemy.category === "flying") {
        // --- 5. FLYING WYVERN DESTRUCTION ---
        this.createShockwave(ex, ey, "#eb3b5a", 85, 0.4, 3.5);

        for (let i = 0; i < 22; i++) {
          const ang = Math.random() * Math.PI * 2;
          const spd = 70 + Math.random() * 160;
          this.particles.push({
            type: "spark",
            x: ex,
            y: ey,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd,
            drag: 0.93,
            life: 0.4 + Math.random() * 0.3,
            maxLife: 0.7,
            color: Math.random() < 0.5 ? "#eb3b5a" : "#f39c12",
            size: 4 + Math.random() * 3
          });
        }

        for (let i = 0; i < 10; i++) {
          const ang = Math.random() * Math.PI * 2;
          const spd = 15 + Math.random() * 45;
          this.particles.push({
            type: "smoke",
            x: ex,
            y: ey,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd - 20,
            growth: 20,
            drag: 0.93,
            life: 0.8 + Math.random() * 0.3,
            maxLife: 1.1,
            color: "rgba(45, 20, 25, 0.7)",
            size: 14 + Math.random() * 8
          });
        }

        for (let i = 0; i < 6; i++) {
          const ang = -Math.PI / 2 + (Math.random() - 0.5) * 1.3;
          const spd = 70 + Math.random() * 140;
          this.particles.push({
            type: "coin",
            x: ex,
            y: ey,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd,
            gravity: 280,
            bounce: true,
            vRot: 10 + Math.random() * 15,
            rot: Math.random() * Math.PI,
            life: 0.75 + Math.random() * 0.3,
            maxLife: 1.05,
            size: 6
          });
        }
      } else if (enemy.type === "sorcerer") {
        // --- 6. DARK SORCERER VOID DISSIPATION ---
        this.createShockwave(ex, ey, "#8e44ad", 75, 0.4, 4);

        for (let i = 0; i < 22; i++) {
          const ang = Math.random() * Math.PI * 2;
          const spd = 60 + Math.random() * 150;
          this.particles.push({
            type: "spark",
            x: ex,
            y: ey,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd - 30,
            drag: 0.93,
            life: 0.45 + Math.random() * 0.3,
            maxLife: 0.75,
            color: Math.random() < 0.6 ? "#9b59b6" : "#00e5ff",
            size: 3.5 + Math.random() * 3
          });
        }

        for (let i = 0; i < 6; i++) {
          const ang = -Math.PI / 2 + (Math.random() - 0.5) * 1.3;
          const spd = 70 + Math.random() * 140;
          this.particles.push({
            type: "coin",
            x: ex,
            y: ey,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd,
            gravity: 280,
            bounce: true,
            vRot: 10 + Math.random() * 15,
            rot: Math.random() * Math.PI,
            life: 0.75 + Math.random() * 0.3,
            maxLife: 1.05,
            size: 6
          });
        }
      } else {
        // --- 7. STANDARD ENEMY DEATH (GOBLIN, ORC, ETC.) ---
        this.createShockwave(ex, ey, enemy.color || "#2ecc71", 52, 0.32, 3);

        for (let i = 0; i < 22; i++) {
          const ang = Math.random() * Math.PI * 2;
          const spd = 55 + Math.random() * 150;
          this.particles.push({
            type: "spark",
            x: ex,
            y: ey,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd,
            drag: 0.93,
            life: 0.38 + Math.random() * 0.25,
            maxLife: 0.63,
            color: enemy.color || "#f1c40f",
            size: 3 + Math.random() * 3.5
          });
        }

        for (let i = 0; i < 10; i++) {
          const ang = Math.random() * Math.PI * 2;
          const spd = 40 + Math.random() * 100;
          this.particles.push({
            type: "debris",
            x: ex,
            y: ey,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd - 30,
            gravity: 320,
            bounce: true,
            vRot: (Math.random() - 0.5) * 14,
            rot: Math.random() * Math.PI,
            life: 0.55 + Math.random() * 0.25,
            maxLife: 0.8,
            color: Math.random() < 0.5 ? "#27ae60" : "#576574",
            size: 3 + Math.random() * 4
          });
        }

        const coinCount = Math.min(6, Math.max(3, Math.floor(enemy.gold / 8)));
        for (let i = 0; i < coinCount; i++) {
          const ang = -Math.PI / 2 + (Math.random() - 0.5) * 1.3;
          const spd = 70 + Math.random() * 140;
          this.particles.push({
            type: "coin",
            x: ex,
            y: ey,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd,
            gravity: 280,
            bounce: true,
            vRot: 10 + Math.random() * 15,
            rot: Math.random() * Math.PI,
            life: 0.75 + Math.random() * 0.3,
            maxLife: 1.05,
            size: 6
          });
        }
      }
    }

    updateHazards(dt) {
      for (let i = this.groundHazards.length - 1; i >= 0; i--) {
        const h = this.groundHazards[i];
        h.duration -= dt;

        this.enemies.forEach(e => {
          if (Math.hypot(e.x - h.x, e.y - h.y) <= h.radius) {
            this.damageEnemy(e, h.damagePerSec * dt, "#e67e22", false);
          }
        });

        if (h.duration <= 0) {
          this.groundHazards.splice(i, 1);
        }
      }
    }

    updateParticles(dt) {
      // Advanced Particle Physics update
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.life -= dt;
        if (p.life <= 0) {
          this.particles.splice(i, 1);
          continue;
        }

        // Velocity & Position
        if (p.vx) p.x += p.vx * dt;
        if (p.vy) p.y += p.vy * dt;

        // Gravity
        if (p.gravity) {
          p.vy += p.gravity * dt;
        }

        // Air Drag
        if (p.drag) {
          p.vx *= Math.pow(p.drag, dt * 60);
          p.vy *= Math.pow(p.drag, dt * 60);
        }

        // Rotation
        if (p.vRot) {
          p.rot = (p.rot || 0) + p.vRot * dt;
        }

        // Size Growth (Smoke / Auras)
        if (p.growth) {
          p.size = (p.size || 6) + p.growth * dt;
        }

        // Shockwave Expansion
        if (p.type === "shockwave") {
          p.radius = (p.radius || 4) + p.expandSpeed * dt;
        }

        // Ground / Border Bounce
        if (p.bounce && p.y > this.height - 15) {
          p.y = this.height - 15;
          p.vy = -p.vy * 0.5;
          p.vx *= 0.75;
        }
      }

      // Floating Combat Text
      for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
        const ft = this.floatingTexts[i];
        ft.life -= dt;
        ft.y -= ft.vy * dt;
        if (ft.life <= 0) {
          this.floatingTexts.splice(i, 1);
        }
      }
    }

    createExplosion(x, y, color, count = 15) {
      for (let i = 0; i < count; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 40 + Math.random() * 120;
        this.particles.push({
          x: x,
          y: y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          life: 0.35 + Math.random() * 0.3,
          maxLife: 0.65,
          color: color,
          size: 3 + Math.random() * 4
        });
      }
    }

    createFloatingText(text, x, y, color = "#fff", scale = 1) {
      this.floatingTexts.push({
        text: text,
        x: x + (Math.random() - 0.5) * 15,
        y: y,
        vy: 35,
        life: 0.9,
        maxLife: 0.9,
        color: color,
        scale: scale
      });
    }

    shakeScreen(intensity, duration) {
      this.screenShakeIntensity = intensity;
      this.screenShakeTime = duration;
    }

    onWaveCompleted() {
      this.waveActive = false;
      const waveBonus = 70 + this.currentWave * 20;
      this.gold += waveBonus;
      this.sound.play("horn");
      this.createFloatingText(`+${waveBonus} 🪙 Wave Clear!`, this.width * 0.5, this.height * 0.3, "#f1c40f", 1.3);

      if (this.currentWave >= this.totalWaves) {
        this.handleVictory();
      } else {
        this.currentWave += 1;
      }
      this.updateHUD();
    }

    handleGameOver() {
      this.isGameOver = true;
      const modal = document.getElementById("end-modal");
      const dict = I18N[this.lang];

      document.getElementById("end-header-icon").textContent = "💀";
      document.getElementById("end-title").textContent = dict.defeatTitle;
      document.getElementById("end-subtitle").textContent = dict.defeatSub;
      document.getElementById("end-final-wave").textContent = this.currentWave;
      document.getElementById("end-final-score").textContent = this.score;
      document.getElementById("end-final-enemies").textContent = this.enemiesDefeatedCount;

      modal.classList.remove("hidden");
    }

    handleVictory() {
      this.isVictory = true;
      const modal = document.getElementById("end-modal");
      const dict = I18N[this.lang];

      document.getElementById("end-header-icon").textContent = "🏆";
      document.getElementById("end-title").textContent = dict.victoryTitle;
      document.getElementById("end-subtitle").textContent = dict.victorySub;
      document.getElementById("end-final-wave").textContent = this.currentWave;
      document.getElementById("end-final-score").textContent = this.score;
      document.getElementById("end-final-enemies").textContent = this.enemiesDefeatedCount;

      modal.classList.remove("hidden");
    }

    restartGame() {
      document.getElementById("end-modal").classList.add("hidden");
      this.gold = 450;
      this.mana = 100;
      this.score = 0;
      this.castleHp = this.castleMaxHp;
      this.currentWave = 1;
      this.isGameOver = false;
      this.isVictory = false;
      this.waveActive = false;
      this.enemies = [];
      this.projectiles = [];
      this.particles = [];
      this.floatingTexts = [];
      this.groundHazards = [];
      this.enemiesDefeatedCount = 0;
      this.guards = [];
      this.allies = [];
      this.draggingAlly = null;
      this.spellCooldowns.guard = 0;
      this.closeWarDrawer();
      this.selectedShopWeapon = null;
      this.closePlacementGuide();

      // Clear towers
      this.towers = [];
      this.slots.forEach(s => (s.tower = null));

      this.updateHUD();
    }

    // --- RENDERING PIPELINE ---
    render() {
      this.ctx.save();

      // Screen shake translation
      if (this.screenShakeTime > 0) {
        const ox = (Math.random() - 0.5) * this.screenShakeIntensity * 2;
        const oy = (Math.random() - 0.5) * this.screenShakeIntensity * 2;
        this.ctx.translate(ox, oy);
      }

      this.renderBattlefieldBackground();
      this.renderGroundHazards();
      this.renderCastle();
      this.renderGuards();
      this.renderSlots();
      this.renderTowers();
      this.renderAllies();
      this.renderEnemies();
      this.renderProjectiles();
      this.renderParticles();
      this.renderFloatingText();

      // Range indicator preview
      this.renderPlacementPreview();

      // Dynamic Weather Visual Overlays (Rain, Snow, Fog, Sandstorm, Lightning)
      this.renderWeatherEffects();

      this.ctx.restore();
    }

    renderBattlefieldBackground() {
      const w = this.width;
      const h = this.height;

      // 1. Natural Medieval Terrain (مروج وتربة ميدان المعركة الطبيعية)
      const bgGrad = this.ctx.createLinearGradient(0, 0, 0, h);
      bgGrad.addColorStop(0, "#193524");
      bgGrad.addColorStop(0.25, "#224730");
      bgGrad.addColorStop(0.5, "#284f36");
      bgGrad.addColorStop(0.75, "#21442e");
      bgGrad.addColorStop(1, "#183222");
      this.ctx.fillStyle = bgGrad;
      this.ctx.fillRect(0, 0, w, h);

      // Subtle grass tufts and field terrain variation
      this.ctx.fillStyle = "rgba(38, 77, 52, 0.4)";
      for (let i = 0; i < 24; i++) {
        const gx = ((i * 137) % w);
        const gy = ((i * 89) % h);
        if (gy < h * 0.35 || gy > h * 0.65) {
          this.ctx.beginPath();
          this.ctx.ellipse(gx, gy, 18, 8, 0, 0, Math.PI * 2);
          this.ctx.fill();
        }
      }

      // 2. Wide Natural Military Highway (طريق عسكري ترابي وحجري طبيعي وأنيق)
      // Layer A: Wide Earth / Soil Shoulder (كتف الطريق والتربة المحيطة)
      this.ctx.strokeStyle = "#5d4037";
      this.ctx.lineWidth = 100;
      this.ctx.lineCap = "round";
      this.ctx.lineJoin = "round";
      this.ctx.beginPath();
      this.ctx.moveTo(w * 1.05, h * 0.50);
      this.ctx.lineTo(w * 0.75, h * 0.50);
      this.ctx.lineTo(w * 0.50, h * 0.50);
      this.ctx.lineTo(w * 0.285, h * 0.50);
      this.ctx.stroke();

      // Layer B: Packed Clay, Gravel & Sandy Earth Layer (جسم الطريق الرئيسي من الحصى والتربة الممهدة)
      this.ctx.strokeStyle = "#8d6e63";
      this.ctx.lineWidth = 80;
      this.ctx.beginPath();
      this.ctx.moveTo(w * 1.05, h * 0.50);
      this.ctx.lineTo(w * 0.75, h * 0.50);
      this.ctx.lineTo(w * 0.50, h * 0.50);
      this.ctx.lineTo(w * 0.285, h * 0.50);
      this.ctx.stroke();

      // Layer C: Compacted Stone & Silt Center (طبقة السطح الحجرية الدافئة)
      this.ctx.strokeStyle = "#a1887f";
      this.ctx.lineWidth = 58;
      this.ctx.beginPath();
      this.ctx.moveTo(w * 1.05, h * 0.50);
      this.ctx.lineTo(w * 0.75, h * 0.50);
      this.ctx.lineTo(w * 0.50, h * 0.50);
      this.ctx.lineTo(w * 0.285, h * 0.50);
      this.ctx.stroke();

      // Layer D: Cobblestone Paving Core (رصف الحجارة القديمة في قلب الطريق)
      this.ctx.strokeStyle = "#bcaaa4";
      this.ctx.lineWidth = 36;
      this.ctx.beginPath();
      this.ctx.moveTo(w * 1.05, h * 0.50);
      this.ctx.lineTo(w * 0.75, h * 0.50);
      this.ctx.lineTo(w * 0.50, h * 0.50);
      this.ctx.lineTo(w * 0.285, h * 0.50);
      this.ctx.stroke();

      // Layer E: Medieval Cobblestones Texture & Flagstones (نقوش وبلاطات الحجارة الممهدة)
      this.ctx.strokeStyle = "rgba(78, 52, 46, 0.35)";
      this.ctx.lineWidth = 2;
      this.ctx.setLineDash([12, 14]);
      this.ctx.beginPath();
      this.ctx.moveTo(w * 1.05, h * 0.48);
      this.ctx.lineTo(w * 0.285, h * 0.48);
      this.ctx.moveTo(w * 1.05, h * 0.52);
      this.ctx.lineTo(w * 0.285, h * 0.52);
      this.ctx.stroke();
      this.ctx.setLineDash([]);

      // Layer F: Cart Wheel Ruts (أخاديد عجلات العربات والخيول)
      this.ctx.strokeStyle = "rgba(62, 39, 35, 0.45)";
      this.ctx.lineWidth = 3.5;
      this.ctx.beginPath();
      this.ctx.moveTo(w * 1.05, h * 0.46);
      this.ctx.lineTo(w * 0.285, h * 0.47);
      this.ctx.moveTo(w * 1.05, h * 0.54);
      this.ctx.lineTo(w * 0.285, h * 0.53);
      this.ctx.stroke();

      // Layer G: Stone Curbs & Borders along highway edges (أحجار حواف الطريق الجانبية)
      this.ctx.strokeStyle = "rgba(189, 189, 189, 0.65)";
      this.ctx.lineWidth = 3;
      this.ctx.setLineDash([8, 10]);
      this.ctx.beginPath();
      this.ctx.moveTo(w * 1.05, h * 0.42);
      this.ctx.lineTo(w * 0.35, h * 0.43);
      this.ctx.moveTo(w * 1.05, h * 0.58);
      this.ctx.lineTo(w * 0.35, h * 0.57);
      this.ctx.stroke();
      this.ctx.setLineDash([]);

      // 3. Grand Battle Arena Plaza (ساحة المعركة ورصف الحجارة الملكية أمام القلعة)
      const plazaX = w * 0.38;
      const plazaY = h * 0.50;
      const plazaR = 48;

      // Outer stone ring
      this.ctx.fillStyle = "#6d4c41";
      this.ctx.beginPath();
      this.ctx.arc(plazaX, plazaY, plazaR + 6, 0, Math.PI * 2);
      this.ctx.fill();

      // Paved flagstone plaza
      this.ctx.fillStyle = "#8d6e63";
      this.ctx.beginPath();
      this.ctx.arc(plazaX, plazaY, plazaR, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.strokeStyle = "#d4ac0d";
      this.ctx.lineWidth = 2.5;
      this.ctx.beginPath();
      this.ctx.arc(plazaX, plazaY, plazaR - 6, 0, Math.PI * 2);
      this.ctx.stroke();

      // Carved battle compass crest
      this.ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
      this.ctx.lineWidth = 1.5;
      this.ctx.beginPath();
      this.ctx.moveTo(plazaX - plazaR + 10, plazaY);
      this.ctx.lineTo(plazaX + plazaR - 10, plazaY);
      this.ctx.moveTo(plazaX, plazaY - plazaR + 10);
      this.ctx.lineTo(plazaX, plazaY + plazaR - 10);
      this.ctx.stroke();

      // 4. Roadside Torches & Warm Lantern Posts (أعمدة مشاعل تضيء الطريق بحرارة المعركة)
      const torchSpots = [
        { x: w * 0.90, y: h * 0.40 },
        { x: w * 0.90, y: h * 0.60 },
        { x: w * 0.70, y: h * 0.40 },
        { x: w * 0.70, y: h * 0.60 },
        { x: w * 0.52, y: h * 0.41 },
        { x: w * 0.52, y: h * 0.59 }
      ];

      torchSpots.forEach(t => {
        // Wooden post
        this.ctx.fillStyle = "#3e2723";
        this.ctx.fillRect(t.x - 2.5, t.y - 12, 5, 14);

        // Warm torch glow
        const glow = this.ctx.createRadialGradient(t.x, t.y - 12, 1, t.x, t.y - 12, 16);
        glow.addColorStop(0, "rgba(255, 167, 38, 0.8)");
        glow.addColorStop(0.5, "rgba(245, 124, 0, 0.35)");
        glow.addColorStop(1, "rgba(230, 81, 0, 0)");
        this.ctx.fillStyle = glow;
        this.ctx.beginPath();
        this.ctx.arc(t.x, t.y - 12, 16, 0, Math.PI * 2);
        this.ctx.fill();

        // Fire flame core
        this.ctx.fillStyle = "#ffeb3b";
        this.ctx.beginPath();
        this.ctx.arc(t.x, t.y - 12, 3, 0, Math.PI * 2);
        this.ctx.fill();
      });

      // 5. Castle Moat / Water Canal
      const moatX = w * 0.285;
      const moatGrad = this.ctx.createLinearGradient(moatX - 25, 0, moatX + 25, 0);
      moatGrad.addColorStop(0, "#0d2b45");
      moatGrad.addColorStop(0.5, "#203a43");
      moatGrad.addColorStop(1, "#0f2027");
      this.ctx.fillStyle = moatGrad;
      this.ctx.fillRect(moatX - 18, 0, 36, h);

      // Water ripples
      this.ctx.strokeStyle = "rgba(79, 195, 247, 0.35)";
      this.ctx.lineWidth = 1.5;
      for (let y = 15; y < h; y += 30) {
        this.ctx.beginPath();
        this.ctx.moveTo(moatX - 12, y);
        this.ctx.lineTo(moatX + 12, y);
        this.ctx.stroke();
      }

      // Wooden drawbridge across moat leading road to castle
      this.ctx.fillStyle = "#5d4037";
      this.ctx.fillRect(moatX - 22, h * 0.44, 44, h * 0.12);
      this.ctx.strokeStyle = "#3e2723";
      this.ctx.lineWidth = 2.5;
      this.ctx.strokeRect(moatX - 22, h * 0.44, 44, h * 0.12);

      // Drawbridge wooden planks & iron bolts
      for (let by = h * 0.45; by < h * 0.56; by += 7) {
        this.ctx.beginPath();
        this.ctx.moveTo(moatX - 22, by);
        this.ctx.lineTo(moatX + 22, by);
        this.ctx.stroke();

        this.ctx.fillStyle = "#ffd54f";
        this.ctx.beginPath();
        this.ctx.arc(moatX - 18, by, 1.5, 0, Math.PI * 2);
        this.ctx.arc(moatX + 18, by, 1.5, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }

    renderCastle() {
      const w = this.width;
      const h = this.height;
      const castleWidth = w * 0.28;

      // 1. Rear Castle Keep / Royal Bastion (Deep Left)
      this.ctx.fillStyle = "#1e2738";
      this.ctx.fillRect(0, h * 0.22, castleWidth * 0.55, h * 0.56);

      // Keep crenellations
      for (let y = h * 0.22; y <= h * 0.78; y += 28) {
        this.ctx.fillStyle = "#253248";
        this.ctx.fillRect(castleWidth * 0.52, y, 12, 16);
      }

      // 2. North Fortress Tower (Top Left)
      this.ctx.fillStyle = "#28374d";
      this.ctx.fillRect(0, 0, castleWidth * 0.7, h * 0.3);
      // North tower roof
      this.ctx.fillStyle = "#7b1113";
      this.ctx.beginPath();
      this.ctx.moveTo(0, 0);
      this.ctx.lineTo(castleWidth * 0.35, 0);
      this.ctx.lineTo(castleWidth * 0.7, h * 0.12);
      this.ctx.lineTo(0, h * 0.12);
      this.ctx.closePath();
      this.ctx.fill();

      // 3. South Fortress Tower (Bottom Left)
      this.ctx.fillStyle = "#28374d";
      this.ctx.fillRect(0, h * 0.7, castleWidth * 0.7, h * 0.3);
      // South tower roof
      this.ctx.fillStyle = "#7b1113";
      this.ctx.beginPath();
      this.ctx.moveTo(0, h);
      this.ctx.lineTo(castleWidth * 0.35, h);
      this.ctx.lineTo(castleWidth * 0.7, h * 0.88);
      this.ctx.lineTo(0, h * 0.88);
      this.ctx.closePath();
      this.ctx.fill();

      // 4. Main Massive Stone Rampart / Forward Wall
      const wallX = castleWidth * 0.58;
      const wallW = castleWidth * 0.42;

      const stoneGrad = this.ctx.createLinearGradient(wallX, 0, wallX + wallW, 0);
      stoneGrad.addColorStop(0, "#2c3e50");
      stoneGrad.addColorStop(0.7, "#34495e");
      stoneGrad.addColorStop(1, "#1e2a38");
      this.ctx.fillStyle = stoneGrad;
      this.ctx.fillRect(wallX, 0, wallW, h);

      // Stone Brick Texture Lines
      this.ctx.strokeStyle = "rgba(0, 0, 0, 0.35)";
      this.ctx.lineWidth = 1.5;
      for (let y = 0; y < h; y += 22) {
        this.ctx.beginPath();
        this.ctx.moveTo(wallX, y);
        this.ctx.lineTo(wallX + wallW, y);
        this.ctx.stroke();

        const offset = (y % 44 === 0) ? 0 : 18;
        for (let x = wallX + offset; x < wallX + wallW; x += 36) {
          this.ctx.beginPath();
          this.ctx.moveTo(x, y);
          this.ctx.lineTo(x, y + 22);
          this.ctx.stroke();
        }
      }

      // Outer Wall Battlements (Crenellations along the front edge)
      const crenX = wallX + wallW - 12;
      for (let cy = 10; cy < h; cy += 32) {
        this.ctx.fillStyle = "#1e2b37";
        this.ctx.fillRect(crenX, cy, 14, 18);
        this.ctx.fillStyle = "#4a627a";
        this.ctx.fillRect(crenX, cy, 14, 3);
      }

      // 5. Heavy Portcullis & Iron Gatehouse (Center of wall)
      const gateY = h * 0.46;
      const gateH = h * 0.18;
      this.ctx.fillStyle = "#11151c";
      this.ctx.fillRect(wallX + wallW - 20, gateY, 22, gateH);

      // Iron gate grid
      this.ctx.strokeStyle = "#7f8c8d";
      this.ctx.lineWidth = 3;
      for (let gx = wallX + wallW - 18; gx <= wallX + wallW; gx += 6) {
        this.ctx.beginPath();
        this.ctx.moveTo(gx, gateY);
        this.ctx.lineTo(gx, gateY + gateH);
        this.ctx.stroke();
      }

      // Castle Wall Decorative Banners & Torches
      this.renderCastleDecorations(wallX, wallW, h);
    }

    renderCastleDecorations(wallX, wallW, h) {
      // Golden Lion/Eagle Shield Insignia above gate
      const bannerX = wallX + wallW - 32;
      const bannerY = h * 0.44;

      this.ctx.fillStyle = "#c0392b";
      this.ctx.beginPath();
      this.ctx.moveTo(bannerX, bannerY);
      this.ctx.lineTo(bannerX + 22, bannerY);
      this.ctx.lineTo(bannerX + 22, bannerY + 28);
      this.ctx.lineTo(bannerX + 11, bannerY + 36);
      this.ctx.lineTo(bannerX, bannerY + 28);
      this.ctx.closePath();
      this.ctx.fill();

      this.ctx.fillStyle = "#f1c40f";
      this.ctx.font = "bold 14px sans-serif";
      this.ctx.textAlign = "center";
      this.ctx.fillText("🛡️", bannerX + 11, bannerY + 20);

      // Flickering Torches along the battlements
      const torchYList = [h * 0.15, h * 0.35, h * 0.65, h * 0.85];
      torchYList.forEach((ty, idx) => {
        const tx = wallX + wallW + 2;
        // Bracket
        this.ctx.fillStyle = "#333";
        this.ctx.fillRect(tx - 6, ty - 2, 8, 4);

        // Flame glow
        const flicker = Math.sin(this.ambientTime * 8 + idx) * 3;
        const flameGrad = this.ctx.createRadialGradient(tx + 2, ty, 2, tx + 2, ty, 18 + flicker);
        flameGrad.addColorStop(0, "rgba(255, 230, 100, 0.8)");
        flameGrad.addColorStop(0.4, "rgba(243, 156, 18, 0.5)");
        flameGrad.addColorStop(1, "rgba(231, 76, 60, 0)");
        this.ctx.fillStyle = flameGrad;
        this.ctx.beginPath();
        this.ctx.arc(tx + 2, ty, 18 + flicker, 0, Math.PI * 2);
        this.ctx.fill();
      });
    }

    renderSlots() {
      const isPlacing = !!this.selectedShopWeapon;

      this.slots.forEach(slot => {
        const hasTower = !!slot.tower;

        // Base slot circle
        this.ctx.save();
        this.ctx.translate(slot.x, slot.y);

        if (isPlacing && !hasTower) {
          // Highlight available building spot with glowing beacon target
          const pulse = Math.sin(this.ambientTime * 6) * 4;
          const auraPulse = Math.sin(this.ambientTime * 4) * 6;

          // 1. Outer Glowing Radar Aura
          this.ctx.fillStyle = "rgba(0, 206, 201, 0.16)";
          this.ctx.beginPath();
          this.ctx.arc(0, 0, slot.radius * 1.7 + auraPulse, 0, Math.PI * 2);
          this.ctx.fill();

          // 2. Pulsing Dashed Target Border Ring
          this.ctx.strokeStyle = "#00cec9";
          this.ctx.lineWidth = 2.5;
          this.ctx.setLineDash([7, 5]);
          this.ctx.beginPath();
          this.ctx.arc(0, 0, slot.radius * 1.35 + pulse, 0, Math.PI * 2);
          this.ctx.stroke();
          this.ctx.setLineDash([]);

          // 3. Center Solid Green Target Platform
          this.ctx.fillStyle = "rgba(46, 204, 113, 0.35)";
          this.ctx.strokeStyle = "#2ecc71";
          this.ctx.lineWidth = 2.5;
          this.ctx.beginPath();
          this.ctx.arc(0, 0, slot.radius, 0, Math.PI * 2);
          this.ctx.fill();
          this.ctx.stroke();

          // 4. Weapon icon preview hovering inside
          const wpnIcon = (this.selectedShopWeapon && this.selectedShopWeapon.icon) || "🎯";
          this.ctx.font = "18px sans-serif";
          this.ctx.textAlign = "center";
          this.ctx.textBaseline = "middle";
          this.ctx.fillText(wpnIcon, 0, -2);

          // 5. "ضع هنا" Indicator Badge under slot
          this.ctx.fillStyle = "rgba(10, 16, 26, 0.88)";
          this.ctx.strokeStyle = "#00cec9";
          this.ctx.lineWidth = 1;
          this.ctx.beginPath();
          if (this.ctx.roundRect) {
            this.ctx.roundRect(-24, slot.radius + 3, 48, 14, 4);
          } else {
            this.ctx.rect(-24, slot.radius + 3, 48, 14);
          }
          this.ctx.fill();
          this.ctx.stroke();

          this.ctx.fillStyle = "#81ecec";
          this.ctx.font = "bold 9px sans-serif";
          this.ctx.fillText(this.lang === "ar" ? "ضع هنا" : "Place", 0, slot.radius + 10);
        } else if (!hasTower) {
          // Idle empty mounting platform
          this.ctx.fillStyle = "rgba(16, 22, 32, 0.85)";
          this.ctx.strokeStyle = "rgba(241, 196, 15, 0.4)";
          this.ctx.lineWidth = 1.5;

          this.ctx.beginPath();
          this.ctx.arc(0, 0, slot.radius, 0, Math.PI * 2);
          this.ctx.fill();
          this.ctx.stroke();

          // Hexagonal center bolt
          this.ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
          this.ctx.beginPath();
          this.ctx.arc(0, 0, slot.radius * 0.5, 0, Math.PI * 2);
          this.ctx.stroke();
        }

        this.ctx.restore();
      });
    }

    renderTowers() {
      this.towers.forEach(t => {
        this.ctx.save();
        this.ctx.translate(t.x, t.y);

        // 1. Heavy Fortress Octagonal Masonry Turret Pedestal
        const platR = 25;
        this.ctx.save();
        this.ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
        this.ctx.shadowBlur = 8;
        this.ctx.shadowOffsetY = 3;

        // Base plate (Dark granite stone)
        this.ctx.fillStyle = "#1b242f";
        this.ctx.beginPath();
        for (let a = 0; a < 8; a++) {
          const ang = (a * Math.PI) / 4 + Math.PI / 8;
          const px = Math.cos(ang) * platR;
          const py = Math.sin(ang) * platR;
          if (a === 0) this.ctx.moveTo(px, py);
          else this.ctx.lineTo(px, py);
        }
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.restore();

        // Inner beveled stone ring
        this.ctx.strokeStyle = "#34495e";
        this.ctx.lineWidth = 2.5;
        this.ctx.stroke();

        // Glowing runic engravings in the foundation stone
        const runePulse = Math.sin(this.ambientTime * 3 + t.x * 0.05) * 0.35 + 0.65;
        this.ctx.strokeStyle = t.color;
        this.ctx.globalAlpha = 0.55 * runePulse;
        this.ctx.lineWidth = 1.5;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, 19, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.globalAlpha = 1.0;

        // Mechanical brass turntable gear ring
        this.ctx.strokeStyle = "#d4ac0d";
        this.ctx.lineWidth = 1.5;
        this.ctx.setLineDash([3, 4]);
        this.ctx.beginPath();
        this.ctx.arc(0, 0, 16, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.setLineDash([]);

        // Level Upgrades Jewels / Floating Mana Orbs
        for (let l = 0; l < t.level; l++) {
          const gemAngle = -Math.PI / 2 + (l - (t.level - 1) / 2) * 0.5;
          const gx = Math.cos(gemAngle) * 22;
          const gy = Math.sin(gemAngle) * 22;

          this.ctx.fillStyle = (l === 2) ? "#f39c12" : (l === 1 ? "#00e5ff" : "#2ecc71");
          this.ctx.shadowColor = this.ctx.fillStyle;
          this.ctx.shadowBlur = 6;
          this.ctx.beginPath();
          this.ctx.arc(gx, gy, 3.5, 0, Math.PI * 2);
          this.ctx.fill();
          this.ctx.shadowBlur = 0;
        }

        // 2. Weapon Carriage / Mount (Rotates towards target)
        this.ctx.rotate(t.angle);

        // Recoil kickback translation
        const recoilOffset = t.recoil || 0;
        if (recoilOffset > 0) {
          this.ctx.translate(-recoilOffset, 0);
        }

        if (t.type === "cannonball") {
          // --- HEAVY SIEGE CANNON (Dragon Mortar) ---
          this.ctx.fillStyle = "#2c3e50";
          this.ctx.fillRect(-6, -9, 14, 18);

          const barrelGrad = this.ctx.createLinearGradient(0, -6, 0, 6);
          barrelGrad.addColorStop(0, "#485460");
          barrelGrad.addColorStop(0.4, "#1e272e");
          barrelGrad.addColorStop(1, "#0f1418");
          this.ctx.fillStyle = barrelGrad;

          this.ctx.beginPath();
          this.ctx.arc(-2, 0, 7, Math.PI * 0.5, Math.PI * 1.5);
          this.ctx.fill();

          this.ctx.fillRect(0, -6, 26, 12);

          this.ctx.fillStyle = "#d35400";
          this.ctx.fillRect(7, -6.5, 3.5, 13);
          this.ctx.fillRect(16, -6.5, 3.5, 13);

          this.ctx.fillStyle = "#f39c12";
          this.ctx.fillRect(25, -7.5, 5, 15);

          this.ctx.fillStyle = "#000";
          this.ctx.fillRect(29, -4.5, 2, 9);

          if (recoilOffset > 2) {
            this.ctx.fillStyle = "#ff5722";
            this.ctx.beginPath();
            this.ctx.arc(-1, -6.5, 3, 0, Math.PI * 2);
            this.ctx.fill();
          }
        } else if (t.type === "arrow") {
          // --- ARCHER GARRISON / REPEATING CROSSBOW ---
          this.ctx.fillStyle = "#5d4037";
          this.ctx.fillRect(-6, -3, 24, 6);

          this.ctx.strokeStyle = "#8d6e63";
          this.ctx.lineWidth = 4;
          this.ctx.beginPath();
          this.ctx.moveTo(10, -18);
          this.ctx.quadraticCurveTo(15, -8, 8, 0);
          this.ctx.quadraticCurveTo(15, 8, 10, 18);
          this.ctx.stroke();

          this.ctx.fillStyle = "#f1c40f";
          this.ctx.beginPath();
          this.ctx.arc(10, -18, 3, 0, Math.PI * 2);
          this.ctx.arc(10, 18, 3, 0, Math.PI * 2);
          this.ctx.fill();

          this.ctx.strokeStyle = "#ecf0f1";
          this.ctx.lineWidth = 1.2;
          this.ctx.beginPath();
          this.ctx.moveTo(10, -18);
          this.ctx.lineTo(0, 0);
          this.ctx.lineTo(10, 18);
          this.ctx.stroke();

          const arrowColor = t.color || "#2ecc71";
          this.ctx.fillStyle = "#d7ccc8";
          this.ctx.fillRect(0, -1.2, 22, 2.4);

          this.ctx.fillStyle = "#e74c3c";
          this.ctx.beginPath();
          this.ctx.moveTo(1, -3);
          this.ctx.lineTo(5, -1.2);
          this.ctx.lineTo(5, 1.2);
          this.ctx.lineTo(1, 3);
          this.ctx.closePath();
          this.ctx.fill();

          this.ctx.fillStyle = arrowColor;
          this.ctx.beginPath();
          this.ctx.moveTo(22, -3.5);
          this.ctx.lineTo(28, 0);
          this.ctx.lineTo(22, 3.5);
          this.ctx.closePath();
          this.ctx.fill();
        } else if (t.type === "bolt") {
          // --- BALLISTA (Sniper Harpoon Engine) ---
          this.ctx.fillStyle = "#2c3e50";
          this.ctx.fillRect(-8, -4, 34, 8);

          this.ctx.fillStyle = "#00e5ff";
          this.ctx.fillRect(-4, -6, 8, 12);

          this.ctx.strokeStyle = "#3498db";
          this.ctx.lineWidth = 4.5;
          this.ctx.beginPath();
          this.ctx.moveTo(14, -22);
          this.ctx.quadraticCurveTo(20, -10, 12, 0);
          this.ctx.quadraticCurveTo(20, 10, 14, 22);
          this.ctx.stroke();

          this.ctx.strokeStyle = "#00e5ff";
          this.ctx.lineWidth = 1.8;
          this.ctx.beginPath();
          this.ctx.moveTo(14, -22);
          this.ctx.lineTo(-2, 0);
          this.ctx.lineTo(14, 22);
          this.ctx.stroke();

          this.ctx.fillStyle = "#bdc3c7";
          this.ctx.fillRect(-2, -2, 32, 4);

          this.ctx.fillStyle = "#00e5ff";
          this.ctx.beginPath();
          this.ctx.moveTo(30, -5);
          this.ctx.lineTo(39, 0);
          this.ctx.lineTo(30, 5);
          this.ctx.lineTo(33, 0);
          this.ctx.closePath();
          this.ctx.fill();

          this.ctx.strokeStyle = "rgba(0, 229, 255, 0.4)";
          this.ctx.lineWidth = 1;
          this.ctx.setLineDash([4, 6]);
          this.ctx.beginPath();
          this.ctx.moveTo(40, 0);
          this.ctx.lineTo(75, 0);
          this.ctx.stroke();
          this.ctx.setLineDash([]);
        } else if (t.type === "flame") {
          // --- FLAMETHROWER (Infernal Projector) ---
          this.ctx.fillStyle = "#d35400";
          this.ctx.fillRect(-6, -11, 14, 8);
          this.ctx.fillRect(-6, 3, 14, 8);

          this.ctx.fillStyle = "#f39c12";
          this.ctx.fillRect(-8, -10, 3, 6);
          this.ctx.fillRect(-8, 4, 3, 6);

          this.ctx.fillStyle = "#c0392b";
          this.ctx.fillRect(4, -5, 20, 10);

          this.ctx.fillStyle = "#e74c3c";
          this.ctx.beginPath();
          this.ctx.moveTo(20, -7);
          this.ctx.lineTo(28, -5);
          this.ctx.lineTo(30, 0);
          this.ctx.lineTo(28, 5);
          this.ctx.lineTo(20, 7);
          this.ctx.closePath();
          this.ctx.fill();

          const flameFlicker = Math.sin(this.ambientTime * 15) * 3;
          this.ctx.fillStyle = "#f39c12";
          this.ctx.beginPath();
          this.ctx.arc(32 + flameFlicker * 0.5, 0, 4 + flameFlicker * 0.4, 0, Math.PI * 2);
          this.ctx.fill();
        } else if (t.type === "lightning") {
          // --- TESLA SPIRE (Storm Arc Conduit) ---
          this.ctx.fillStyle = "#2c3e50";
          this.ctx.beginPath();
          this.ctx.moveTo(-5, -7);
          this.ctx.lineTo(18, -4);
          this.ctx.lineTo(26, 0);
          this.ctx.lineTo(18, 4);
          this.ctx.lineTo(-5, 7);
          this.ctx.closePath();
          this.ctx.fill();

          this.ctx.strokeStyle = "#e67e22";
          this.ctx.lineWidth = 2.5;
          for (let c = 0; c < 3; c++) {
            this.ctx.beginPath();
            this.ctx.arc(3 + c * 7, 0, 6, -Math.PI * 0.4, Math.PI * 0.4);
            this.ctx.stroke();
          }

          const orbPulse = Math.sin(this.ambientTime * 8) * 2;
          this.ctx.fillStyle = "#9b59b6";
          this.ctx.shadowColor = "#00e5ff";
          this.ctx.shadowBlur = 10;
          this.ctx.beginPath();
          this.ctx.arc(24, 0, 7 + orbPulse, 0, Math.PI * 2);
          this.ctx.fill();
          this.ctx.shadowBlur = 0;

          this.ctx.strokeStyle = "#00e5ff";
          this.ctx.lineWidth = 1.5;
          this.ctx.beginPath();
          this.ctx.moveTo(10, (Math.random() - 0.5) * 6);
          this.ctx.lineTo(17, (Math.random() - 0.5) * 8);
          this.ctx.lineTo(24, 0);
          this.ctx.stroke();
        } else if (t.type === "boulder") {
          // --- CATAPULT (Magma Trebuchet) ---
          this.ctx.fillStyle = "#6d4c41";
          this.ctx.fillRect(-8, -6, 26, 12);

          this.ctx.fillStyle = "#37474f";
          this.ctx.fillRect(-12, -7, 8, 14);

          this.ctx.fillStyle = "#8d6e63";
          this.ctx.fillRect(-2, -3.5, 30, 7);

          this.ctx.fillStyle = "#263238";
          this.ctx.beginPath();
          this.ctx.arc(26, 0, 7.5, 0, Math.PI * 2);
          this.ctx.fill();

          this.ctx.fillStyle = "#d35400";
          this.ctx.beginPath();
          this.ctx.arc(26, 0, 6, 0, Math.PI * 2);
          this.ctx.fill();

          this.ctx.fillStyle = "#f1c40f";
          this.ctx.beginPath();
          this.ctx.arc(26, 0, 3, 0, Math.PI * 2);
          this.ctx.fill();
        }

        // Center reinforced pivot cap
        this.ctx.fillStyle = "#1e272e";
        this.ctx.beginPath();
        this.ctx.arc(0, 0, 9, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.strokeStyle = "#f39c12";
        this.ctx.lineWidth = 1.5;
        this.ctx.stroke();

        this.ctx.restore();
      });
    }

    renderEnemies() {
      this.enemies.forEach(e => {
        this.ctx.save();
        this.ctx.translate(e.x, e.y);

        // Ground Drop Shadow
        this.ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
        this.ctx.beginPath();
        this.ctx.ellipse(0, e.radius * 0.75, e.radius * 1.1, e.radius * 0.45, 0, 0, Math.PI * 2);
        this.ctx.fill();

        // 1. BOSS SUMMONING RUNIC AURA (Underneath Bosses)
        if (e.isBoss) {
          const auraPulse = Math.sin(this.ambientTime * 4) * 4;
          const auraRot = this.ambientTime * 1.2;

          this.ctx.save();
          this.ctx.rotate(auraRot);
          this.ctx.strokeStyle = e.color || "#e74c3c";
          this.ctx.lineWidth = 2;
          this.ctx.globalAlpha = 0.65;

          // Outer runic ring
          this.ctx.beginPath();
          this.ctx.arc(0, 0, e.radius + 12 + auraPulse, 0, Math.PI * 2);
          this.ctx.stroke();

          // Runic star inscribed
          const pts = 6;
          this.ctx.beginPath();
          for (let p = 0; p < pts * 2; p++) {
            const r = (p % 2 === 0) ? (e.radius + 12 + auraPulse) : (e.radius + 4);
            const ang = (p * Math.PI) / pts;
            const px = Math.cos(ang) * r;
            const py = Math.sin(ang) * r;
            if (p === 0) this.ctx.moveTo(px, py);
            else this.ctx.lineTo(px, py);
          }
          this.ctx.closePath();
          this.ctx.stroke();
          this.ctx.restore();
        }

        // Frozen / Burn / Shock / Shield Auras
        if (e.frozenTime > 0) {
          this.ctx.strokeStyle = "#00e5ff";
          this.ctx.lineWidth = 3.5;
          this.ctx.shadowColor = "#00e5ff";
          this.ctx.shadowBlur = 8;
          this.ctx.beginPath();
          this.ctx.arc(0, 0, e.radius + 5, 0, Math.PI * 2);
          this.ctx.stroke();
          this.ctx.shadowBlur = 0;
        }

        if (e.burnTime > 0) {
          this.ctx.fillStyle = "rgba(230, 126, 34, 0.45)";
          this.ctx.beginPath();
          this.ctx.arc(0, 0, e.radius + 4, 0, Math.PI * 2);
          this.ctx.fill();
        }

        // Low HP Enrage Flame Aura for Bosses
        if (e.isBoss && e.enraged) {
          const flameH = Math.sin(this.ambientTime * 16) * 4;
          this.ctx.strokeStyle = "#ff3838";
          this.ctx.lineWidth = 3;
          this.ctx.beginPath();
          this.ctx.arc(0, 0, e.radius + 6 + flameH, 0, Math.PI * 2);
          this.ctx.stroke();
        }

        // Organic walking bounce motion
        const bob = Math.sin(this.ambientTime * 10 + e.x * 0.1) * 2;
        this.ctx.translate(0, bob);

        // 2. CHARACTER BODY RENDERING
        if (e.category === "fast" || e.isSprinting) {
          // --- SHADOW SPRINTER / FAST RUNNER ---
          this.ctx.strokeStyle = "rgba(0, 210, 211, 0.6)";
          this.ctx.lineWidth = 2.5;
          this.ctx.beginPath();
          this.ctx.moveTo(e.radius * 0.5, -6);
          this.ctx.lineTo(e.radius * 2.2, -6);
          this.ctx.moveTo(e.radius * 0.5, 6);
          this.ctx.lineTo(e.radius * 2.2, 6);
          this.ctx.stroke();

          const waveTail = Math.sin(this.ambientTime * 18) * 5;
          this.ctx.fillStyle = "#00d2d3";
          this.ctx.beginPath();
          this.ctx.moveTo(e.radius * 0.3, -3);
          this.ctx.quadraticCurveTo(e.radius * 1.4, -6 + waveTail, e.radius * 2.2, -3);
          this.ctx.lineTo(e.radius * 1.8, 0);
          this.ctx.quadraticCurveTo(e.radius * 1.4, 6 + waveTail, e.radius * 2.2, 5);
          this.ctx.lineTo(e.radius * 0.3, 3);
          this.ctx.closePath();
          this.ctx.fill();

          this.ctx.fillStyle = "#1e272e";
          this.ctx.beginPath();
          this.ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
          this.ctx.fill();
          this.ctx.strokeStyle = "#00d2d3";
          this.ctx.lineWidth = 2;
          this.ctx.stroke();

          this.ctx.fillStyle = "#00e5ff";
          this.ctx.beginPath();
          this.ctx.moveTo(-e.radius * 0.6, -8);
          this.ctx.lineTo(-e.radius * 1.5, -11);
          this.ctx.lineTo(-e.radius * 0.4, -5);
          this.ctx.closePath();
          this.ctx.fill();

          this.ctx.beginPath();
          this.ctx.moveTo(-e.radius * 0.6, 8);
          this.ctx.lineTo(-e.radius * 1.5, 11);
          this.ctx.lineTo(-e.radius * 0.4, 5);
          this.ctx.closePath();
          this.ctx.fill();

          this.ctx.fillStyle = "#00ffff";
          this.ctx.fillRect(-e.radius * 0.6, -3, 3, 2);
          this.ctx.fillRect(-e.radius * 0.6, 1, 3, 2);
        } else if (e.category === "armored") {
          // --- IRONCLAD KNIGHT / HEAVY VANGUARD ---
          const knightGrad = this.ctx.createRadialGradient(-3, -3, 2, 0, 0, e.radius);
          knightGrad.addColorStop(0, "#bdc3c7");
          knightGrad.addColorStop(0.7, "#7f8c8d");
          knightGrad.addColorStop(1, "#2c3e50");
          this.ctx.fillStyle = knightGrad;
          this.ctx.beginPath();
          this.ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
          this.ctx.fill();
          this.ctx.strokeStyle = "#ecf0f1";
          this.ctx.lineWidth = 2;
          this.ctx.stroke();

          this.ctx.fillStyle = "#111";
          this.ctx.fillRect(-e.radius * 0.7, -2.5, e.radius * 0.7, 5);
          this.ctx.fillStyle = "#e74c3c";
          this.ctx.fillRect(-e.radius * 0.65, -1, e.radius * 0.6, 2);

          this.ctx.fillStyle = "#95a5a6";
          this.ctx.strokeStyle = "#f39c12";
          this.ctx.lineWidth = 2;
          this.ctx.beginPath();
          this.ctx.arc(-e.radius * 0.6, 0, e.radius * 0.95, Math.PI * 0.6, Math.PI * 1.4);
          this.ctx.stroke();

          this.ctx.fillStyle = "#f39c12";
          this.ctx.beginPath();
          this.ctx.arc(-e.radius * 1.2, 0, 4, 0, Math.PI * 2);
          this.ctx.fill();

          this.ctx.fillStyle = "#34495e";
          this.ctx.fillRect(e.radius * 0.4, -e.radius * 1.1, 4, e.radius * 2);
          this.ctx.fillStyle = "#7f8c8d";
          this.ctx.fillRect(e.radius * 0.2, -e.radius * 1.2, 8, 7);
        } else if (e.category === "flying") {
          // --- WYVERN FLYER / AERIAL MONARCH ---
          const wingFlap = Math.sin(this.ambientTime * 12) * (e.radius * 0.7);

          this.ctx.fillStyle = "#c0392b";
          this.ctx.strokeStyle = "#7b1113";
          this.ctx.lineWidth = 2;

          this.ctx.beginPath();
          this.ctx.moveTo(0, -e.radius * 0.5);
          this.ctx.lineTo(e.radius * 0.6, -e.radius * 1.4 - wingFlap);
          this.ctx.lineTo(-e.radius * 0.8, -e.radius * 1.7 - wingFlap);
          this.ctx.lineTo(-e.radius * 0.3, -e.radius * 0.3);
          this.ctx.closePath();
          this.ctx.fill();
          this.ctx.stroke();

          this.ctx.beginPath();
          this.ctx.moveTo(0, e.radius * 0.5);
          this.ctx.lineTo(e.radius * 0.6, e.radius * 1.4 + wingFlap);
          this.ctx.lineTo(-e.radius * 0.8, e.radius * 1.7 + wingFlap);
          this.ctx.lineTo(-e.radius * 0.3, e.radius * 0.3);
          this.ctx.closePath();
          this.ctx.fill();
          this.ctx.stroke();

          this.ctx.fillStyle = e.color || "#eb3b5a";
          this.ctx.beginPath();
          this.ctx.ellipse(0, 0, e.radius, e.radius * 0.65, 0, 0, Math.PI * 2);
          this.ctx.fill();
          this.ctx.strokeStyle = "#111";
          this.ctx.lineWidth = 1.5;
          this.ctx.stroke();

          this.ctx.fillStyle = "#ffdd59";
          this.ctx.fillRect(-e.radius * 0.9, -2, 3, 4);
        } else if (e.category === "massive" || e.isBoss) {
          // --- MOUNTAIN COLOSSUS / BOSS GIANTS ---
          const colGrad = this.ctx.createRadialGradient(-5, -5, 4, 0, 0, e.radius);
          colGrad.addColorStop(0, "#7f1d1d");
          colGrad.addColorStop(0.5, e.color || "#d35400");
          colGrad.addColorStop(1, "#1c1917");
          this.ctx.fillStyle = colGrad;
          this.ctx.beginPath();
          this.ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
          this.ctx.fill();
          this.ctx.strokeStyle = e.isBoss ? "#f1c40f" : "#2d3436";
          this.ctx.lineWidth = e.isBoss ? 3 : 2;
          this.ctx.stroke();

          const veinPulse = Math.sin(this.ambientTime * 6) * 0.4 + 0.6;
          this.ctx.strokeStyle = "#f39c12";
          this.ctx.globalAlpha = veinPulse;
          this.ctx.lineWidth = 2.5;
          this.ctx.beginPath();
          this.ctx.moveTo(-e.radius * 0.5, -e.radius * 0.5);
          this.ctx.lineTo(0, 0);
          this.ctx.lineTo(-e.radius * 0.6, e.radius * 0.4);
          this.ctx.moveTo(0, 0);
          this.ctx.lineTo(e.radius * 0.5, 0);
          this.ctx.stroke();
          this.ctx.globalAlpha = 1.0;

          if (e.isBoss) {
            this.ctx.fillStyle = "#f1c40f";
            this.ctx.beginPath();
            this.ctx.moveTo(-e.radius * 0.8, -e.radius * 0.6);
            this.ctx.lineTo(-e.radius * 1.3, -e.radius * 1.1);
            this.ctx.lineTo(-e.radius * 0.4, -e.radius * 0.8);
            this.ctx.closePath();
            this.ctx.fill();

            this.ctx.beginPath();
            this.ctx.moveTo(-e.radius * 0.8, e.radius * 0.6);
            this.ctx.lineTo(-e.radius * 1.3, e.radius * 1.1);
            this.ctx.lineTo(-e.radius * 0.4, e.radius * 0.8);
            this.ctx.closePath();
            this.ctx.fill();
          }
        } else {
          // --- GOBLIN / ORC / STANDARD UNITS ---
          this.ctx.fillStyle = e.color || "#27ae60";
          this.ctx.beginPath();
          this.ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
          this.ctx.fill();
          this.ctx.strokeStyle = "#111";
          this.ctx.lineWidth = 1.5;
          this.ctx.stroke();

          this.ctx.fillStyle = "#34495e";
          this.ctx.beginPath();
          this.ctx.arc(0, 0, e.radius * 0.9, -Math.PI * 0.9, -Math.PI * 0.1);
          this.ctx.closePath();
          this.ctx.fill();
        }

        // Inner Icon badge for identification
        this.ctx.font = `${Math.round(e.radius * (e.isBoss ? 0.9 : 0.85))}px sans-serif`;
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.fillText(e.icon, 0, 0);

        // 3. ENHANCED HEALTH BAR
        const barW = e.isBoss ? Math.max(65, e.radius * 2.4) : (e.category === "massive" ? Math.max(50, e.radius * 2.2) : Math.max(26, e.radius * 2));
        const barH = e.isBoss ? 7 : (e.category === "massive" ? 6 : 4);
        const barY = -e.radius - (e.isBoss ? 16 : (e.category === "massive" ? 14 : 8));
        const hpPct = Math.max(0, e.hp / e.maxHp);

        this.ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
        this.ctx.fillRect(-barW / 2 - 1, barY - 1, barW + 2, barH + 2);

        this.ctx.fillStyle = hpPct < 0.25 ? "#e74c3c" : (hpPct < 0.55 ? "#f39c12" : "#2ecc71");
        this.ctx.fillRect(-barW / 2, barY, barW * hpPct, barH);

        if (e.isBoss || e.category === "massive") {
          this.ctx.fillStyle = "#f1c40f";
          this.ctx.font = "bold 9px sans-serif";
          this.ctx.textAlign = "center";
          this.ctx.fillText(`${Math.ceil(e.hp)}`, 0, barY - 3);
        }

        this.ctx.restore();
      });
    }

    renderProjectiles() {
      this.projectiles.forEach(p => {
        this.ctx.save();
        this.ctx.translate(p.x, p.y);

        if (p.type === "arrow") {
          const ang = Math.atan2(p.targetY - p.y, p.targetX - p.x);
          this.ctx.rotate(ang);

          this.ctx.fillStyle = "#8d6e63";
          this.ctx.fillRect(-10, -1.2, 18, 2.4);

          this.ctx.fillStyle = "#e74c3c";
          this.ctx.beginPath();
          this.ctx.moveTo(-10, -3.5);
          this.ctx.lineTo(-4, -1.2);
          this.ctx.lineTo(-4, 1.2);
          this.ctx.lineTo(-10, 3.5);
          this.ctx.closePath();
          this.ctx.fill();

          this.ctx.fillStyle = p.color || "#2ecc71";
          this.ctx.shadowColor = p.color || "#2ecc71";
          this.ctx.shadowBlur = 6;
          this.ctx.beginPath();
          this.ctx.moveTo(8, -3.5);
          this.ctx.lineTo(14, 0);
          this.ctx.lineTo(8, 3.5);
          this.ctx.closePath();
          this.ctx.fill();
          this.ctx.shadowBlur = 0;
        } else if (p.type === "cannonball") {
          const canGrad = this.ctx.createRadialGradient(-2, -2, 1, 0, 0, 7);
          canGrad.addColorStop(0, "#f39c12");
          canGrad.addColorStop(0.4, "#d35400");
          canGrad.addColorStop(1, "#1e272e");
          this.ctx.fillStyle = canGrad;
          this.ctx.shadowColor = "#e67e22";
          this.ctx.shadowBlur = 8;
          this.ctx.beginPath();
          this.ctx.arc(0, 0, 7, 0, Math.PI * 2);
          this.ctx.fill();
          this.ctx.shadowBlur = 0;

          this.ctx.fillStyle = "#ffdd59";
          this.ctx.beginPath();
          this.ctx.arc(-2, -2, 2.5, 0, Math.PI * 2);
          this.ctx.fill();
        } else if (p.type === "bolt") {
          this.ctx.rotate(p.angle);
          this.ctx.fillStyle = "#ecf0f1";
          this.ctx.fillRect(-16, -2, 32, 4);

          this.ctx.fillStyle = "#00e5ff";
          this.ctx.shadowColor = "#00e5ff";
          this.ctx.shadowBlur = 10;
          this.ctx.beginPath();
          this.ctx.moveTo(16, -5);
          this.ctx.lineTo(26, 0);
          this.ctx.lineTo(16, 5);
          this.ctx.closePath();
          this.ctx.fill();
          this.ctx.shadowBlur = 0;
        } else if (p.type === "boulder") {
          const bRot = (this.ambientTime * 6) % (Math.PI * 2);
          this.ctx.rotate(bRot);

          const bGrad = this.ctx.createRadialGradient(-3, -3, 2, 0, 0, 10);
          bGrad.addColorStop(0, "#f1c40f");
          bGrad.addColorStop(0.5, "#d35400");
          bGrad.addColorStop(1, "#4e1b1b");
          this.ctx.fillStyle = bGrad;
          this.ctx.shadowColor = "#e74c3c";
          this.ctx.shadowBlur = 10;
          this.ctx.beginPath();
          this.ctx.arc(0, 0, 9, 0, Math.PI * 2);
          this.ctx.fill();
          this.ctx.shadowBlur = 0;
        }

        this.ctx.restore();
      });
    }

    renderGroundHazards() {
      this.groundHazards.forEach(h => {
        this.ctx.save();
        this.ctx.fillStyle = h.color;
        this.ctx.beginPath();
        this.ctx.arc(h.x, h.y, h.radius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
      });
    }

    renderParticles() {
      this.particles.forEach(p => {
        this.ctx.save();
        const alpha = Math.max(0, Math.min(1, p.life / p.maxLife));
        this.ctx.globalAlpha = alpha;

        if (p.type === "shockwave") {
          // Radiant expanding energy shockwave ring
          this.ctx.strokeStyle = p.color;
          this.ctx.lineWidth = Math.max(1, (p.lineWidth || 3.5) * alpha);
          this.ctx.beginPath();
          this.ctx.arc(p.x, p.y, Math.max(1, p.radius), 0, Math.PI * 2);
          this.ctx.stroke();
        } else if (p.type === "spark") {
          // Directional elongated bright spark
          this.ctx.fillStyle = p.color;
          const ang = Math.atan2(p.vy, p.vx);
          const spd = Math.hypot(p.vx, p.vy);
          const len = Math.max(p.size, Math.min(24, spd * 0.08));
          this.ctx.translate(p.x, p.y);
          this.ctx.rotate(ang);
          this.ctx.beginPath();
          this.ctx.ellipse(0, 0, len, p.size * 0.5, 0, 0, Math.PI * 2);
          this.ctx.fill();
        } else if (p.type === "debris") {
          // Rotating jagged polygon debris / shrapnel
          this.ctx.fillStyle = p.color;
          this.ctx.translate(p.x, p.y);
          this.ctx.rotate(p.rot || 0);
          this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.8);
        } else if (p.type === "coin") {
          // Golden spinning coin with metallic rim and specular glint
          this.ctx.translate(p.x, p.y);
          const scaleX = Math.cos(p.rot || 0);
          this.ctx.scale(scaleX, 1);
          this.ctx.fillStyle = "#f39c12";
          this.ctx.beginPath();
          this.ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          this.ctx.fill();
          this.ctx.strokeStyle = "#f1c40f";
          this.ctx.lineWidth = 1.5;
          this.ctx.stroke();
          // Specular glint
          this.ctx.fillStyle = "#ffffff";
          this.ctx.beginPath();
          this.ctx.arc(-p.size * 0.3, -p.size * 0.3, 1.5, 0, Math.PI * 2);
          this.ctx.fill();
        } else if (p.type === "smoke") {
          // Billowing soft expanding smoke
          this.ctx.fillStyle = p.color;
          this.ctx.beginPath();
          this.ctx.arc(p.x, p.y, Math.max(1, p.size), 0, Math.PI * 2);
          this.ctx.fill();
        } else if (p.type === "ice_crystal") {
          // 4-point rotating diamond/star ice crystal
          this.ctx.translate(p.x, p.y);
          this.ctx.rotate(p.rot || 0);
          this.ctx.fillStyle = p.color;
          this.ctx.beginPath();
          this.ctx.moveTo(0, -p.size);
          this.ctx.lineTo(p.size * 0.3, -p.size * 0.3);
          this.ctx.lineTo(p.size, 0);
          this.ctx.lineTo(p.size * 0.3, p.size * 0.3);
          this.ctx.lineTo(0, p.size);
          this.ctx.lineTo(-p.size * 0.3, p.size * 0.3);
          this.ctx.lineTo(-p.size, 0);
          this.ctx.lineTo(-p.size * 0.3, -p.size * 0.3);
          this.ctx.closePath();
          this.ctx.fill();
        } else if (p.type === "holy_mote") {
          // Rising holy cross/star glyph for Castle Repair
          this.ctx.translate(p.x, p.y);
          this.ctx.rotate(p.rot || 0);
          this.ctx.fillStyle = p.color;
          this.ctx.fillRect(-p.size / 2, -p.size / 6, p.size, p.size / 3);
          this.ctx.fillRect(-p.size / 6, -p.size / 2, p.size / 3, p.size);
        } else if (p.type === "fire_ember") {
          // Flickering flame ember
          this.ctx.fillStyle = p.color;
          const emberScale = 0.8 + Math.sin(this.ambientTime * 12) * 0.2;
          this.ctx.beginPath();
          this.ctx.arc(p.x, p.y, Math.max(1, p.size * emberScale), 0, Math.PI * 2);
          this.ctx.fill();
        } else if (p.type === "lightning_segment") {
          this.ctx.strokeStyle = p.color;
          this.ctx.lineWidth = 3;
          this.ctx.beginPath();
          this.ctx.moveTo(p.x1, p.y1);
          // Zigzag mid-point
          const midX = (p.x1 + p.x2) / 2 + (Math.random() - 0.5) * 20;
          const midY = (p.y1 + p.y2) / 2 + (Math.random() - 0.5) * 20;
          this.ctx.lineTo(midX, midY);
          this.ctx.lineTo(p.x2, p.y2);
          this.ctx.stroke();
        } else {
          // Fallback circular particle
          this.ctx.fillStyle = p.color;
          this.ctx.beginPath();
          this.ctx.arc(p.x, p.y, Math.max(1, p.size), 0, Math.PI * 2);
          this.ctx.fill();
        }

        this.ctx.restore();
      });
    }

    renderFloatingText() {
      this.floatingTexts.forEach(ft => {
        this.ctx.save();
        const alpha = ft.life / ft.maxLife;
        this.ctx.globalAlpha = Math.max(0, alpha);
        this.ctx.fillStyle = ft.color;
        this.ctx.font = `bold ${Math.round(14 * ft.scale)}px sans-serif`;
        this.ctx.textAlign = "center";
        this.ctx.shadowColor = "rgba(0,0,0,0.8)";
        this.ctx.shadowBlur = 4;
        this.ctx.fillText(ft.text, ft.x, ft.y);
        this.ctx.restore();
      });
    }

    renderPlacementPreview() {
      // If weapon selected, or tower inspected, show range circle
      let range = 0;
      let rx = 0;
      let ry = 0;

      if (this.inspectingTower) {
        range = this.inspectingTower.range;
        rx = this.inspectingTower.x;
        ry = this.inspectingTower.y;
      }

      if (range > 0) {
        this.ctx.save();
        this.ctx.strokeStyle = "rgba(241, 196, 15, 0.4)";
        this.ctx.fillStyle = "rgba(241, 196, 15, 0.06)";
        this.ctx.lineWidth = 1.5;
        this.ctx.setLineDash([6, 6]);
        this.ctx.beginPath();
        this.ctx.arc(rx, ry, range, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
        this.ctx.restore();
      }
    }

    // --- CODE / FILES EXPLORER ---
    openFilesModal() {
      this.showFileContent("html");
      document.getElementById("files-modal").classList.remove("hidden");
    }

    fetchFileContent(filename, onSuccess, onFail) {
      fetch(filename)
        .then(res => {
          if (!res.ok && res.status !== 0) throw new Error("Fetch non-zero status");
          return res.text();
        })
        .then(text => {
          if (text && text.trim().length > 0) onSuccess(text);
          else onFail();
        })
        .catch(() => {
          try {
            const xhr = new XMLHttpRequest();
            xhr.open("GET", filename, true);
            xhr.onload = () => {
              if ((xhr.status === 200 || xhr.status === 0) && xhr.responseText && xhr.responseText.trim().length > 0) {
                onSuccess(xhr.responseText);
              } else {
                onFail();
              }
            };
            xhr.onerror = () => onFail();
            xhr.send();
          } catch (e) {
            onFail();
          }
        });
    }

    showFileContent(type) {
      const codeEl = document.getElementById("code-content");
      const nameEl = document.getElementById("current-filename");

      if (type === "html") {
        nameEl.textContent = "index.html";
        this.fetchFileContent("index.html",
          txt => { codeEl.textContent = txt; },
          () => { codeEl.textContent = document.documentElement.outerHTML; }
        );
      } else if (type === "css") {
        nameEl.textContent = "style.css";
        this.fetchFileContent("style.css",
          txt => { codeEl.textContent = txt; },
          () => {
            let cssRules = "";
            for (let i = 0; i < document.styleSheets.length; i++) {
              try {
                const sheet = document.styleSheets[i];
                for (let r = 0; r < sheet.cssRules.length; r++) {
                  cssRules += sheet.cssRules[r].cssText + "\n";
                }
              } catch (e) {}
            }
            codeEl.textContent = cssRules || "/* style.css is available in assets/game/style.css */";
          }
        );
      } else if (type === "js") {
        nameEl.textContent = "game.js";
        this.fetchFileContent("game.js",
          txt => { codeEl.textContent = txt; },
          () => {
            codeEl.textContent = "// File: assets/game/game.js\n// Available in assets/game/game.js for Zalith Launcher and APK build";
          }
        );
      }
    }
  }

  // Auto-initialize when DOM ready
  window.addEventListener("DOMContentLoaded", () => {
    window.game = new CastleTDGame();
  });
})();
