(function (global) {
  'use strict';

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const clean = value => String(value || '').trim();

  class DialogueEngine {
    constructor({ content, similarity, normalize }) {
      if (!content || !Array.isArray(content.levels) || !content.dialogues) throw new Error('dialogue-content-required');
      this.content = content;
      this.similarity = similarity;
      this.normalize = normalize;
      this.session = null;
    }

    profile(levelId) {
      return this.content.levels.find(level => level.id === levelId) || this.content.levels[0];
    }

    conversation(placeId, levelId) {
      const profile = this.profile(levelId);
      const items = this.content.dialogues[placeId]?.[profile.id] || [];
      if (items.length < profile.turns) throw new Error(`dialogue-content-short:${placeId}:${profile.id}`);
      return items.slice(0, profile.turns);
    }

    start({ placeId, levelId, record = {}, restart = false }) {
      const profile = this.profile(levelId);
      const items = this.conversation(placeId, profile.id);
      const freshStart = restart || Boolean(record.completed);
      const resumeAt = freshStart ? 0 : clamp(Number(record.progress) || 0, 0, Math.max(0, items.length - 1));
      this.session = {
        placeId,
        levelId: profile.id,
        profile,
        items,
        index: resumeAt,
        correct: freshStart ? 0 : clamp(Number(record.correct) || 0, 0, resumeAt),
        totalAttempts: freshStart ? 0 : Math.max(0, Number(record.attempts) || 0),
        turnAttempts: 0,
        accuracyTotal: freshStart ? 0 : Math.max(0, Number(record.accuracyTotal) || 0),
        vocabularyTotal: freshStart ? 0 : Math.max(0, Number(record.vocabularyTotal) || 0),
        state: 'listening',
        lastOutcome: null
      };
      return this.session;
    }

    current() {
      return this.session?.items[this.session.index] || null;
    }

    evaluate(alternatives, elapsedSeconds = 0) {
      const session = this.session;
      const item = this.current();
      if (!session || !item || !['listening', 'retry'].includes(session.state)) return null;

      const heard = (alternatives || []).map(clean).filter(Boolean);
      const answers = [{ text: item.de, reply: item.reply }, ...(item.answers || [])]
        .filter(answer => clean(answer.text));
      let best = { score: 0, transcript: heard[0] || '', answer: answers[0] };

      for (const transcript of heard) {
        for (const answer of answers) {
          const phraseScore = this.similarity(transcript, answer.text);
          const normalizedTranscript = this.normalize(transcript);
          const intentWords = (item.keywords || []).map(this.normalize).filter(Boolean);
          const matched = intentWords.filter(word => normalizedTranscript.includes(word)).length;
          const intentScore = intentWords.length ? matched / intentWords.length : 0;
          const heardWordCount = normalizedTranscript.split(/\s+/).filter(Boolean).length;
          const targetWordCount = this.normalize(answer.text).split(/\s+/).filter(Boolean).length;
          const phraseCoverage = clamp(heardWordCount / Math.max(1, targetWordCount * .65), .4, 1);
          const score = Math.max(phraseScore, intentScore * .92 * phraseCoverage);
          if (score > best.score) best = { score, transcript, answer };
        }
      }

      session.turnAttempts += 1;
      session.totalAttempts += 1;
      const correct = best.score >= session.profile.threshold;
      const normalizedTranscript = this.normalize(best.transcript);
      const vocabulary = (item.keywords || []).length
        ? (item.keywords || []).filter(word => normalizedTranscript.includes(this.normalize(word))).length / item.keywords.length
        : best.score;
      const accuracy = Math.round(best.score * 100);
      const vocabularyPercent = Math.round(clamp(vocabulary, 0, 1) * 100);
      const speedPercent = Math.round(clamp(1 - Math.max(0, elapsedSeconds - session.profile.time * .35) / (session.profile.time * .85), .35, 1) * 100);

      if (correct) {
        session.correct += 1;
        session.accuracyTotal += accuracy;
        session.vocabularyTotal += vocabularyPercent;
        session.state = 'responding';
      } else if (session.turnAttempts < session.profile.attempts) {
        session.state = 'retry';
      } else {
        session.state = 'responding';
      }

      const outcome = {
        correct,
        retry: !correct && session.state === 'retry',
        skipped: !correct && session.state === 'responding',
        transcript: best.transcript,
        score: best.score,
        accuracy,
        vocabulary: vocabularyPercent,
        speed: speedPercent,
        reply: best.answer?.reply || item.reply,
        target: item.de,
        hint: item.hint || item.skill || '',
        attempt: session.turnAttempts
      };
      session.lastOutcome = outcome;
      return outcome;
    }

    prepareRetry() {
      if (!this.session || this.session.state !== 'retry') return false;
      this.session.state = 'listening';
      return true;
    }

    advance() {
      const session = this.session;
      if (!session) return { complete: true, item: null };
      session.index += 1;
      session.turnAttempts = 0;
      session.lastOutcome = null;
      if (session.index >= session.items.length) {
        session.state = 'complete';
        return { complete: true, item: null };
      }
      session.state = 'listening';
      return { complete: false, item: this.current() };
    }

    snapshot() {
      const session = this.session;
      if (!session) return null;
      return {
        progress: Math.min(session.index, session.items.length),
        correct: session.correct,
        attempts: session.totalAttempts,
        accuracyTotal: session.accuracyTotal,
        vocabularyTotal: session.vocabularyTotal,
        completed: session.state === 'complete',
        updatedAt: Date.now()
      };
    }

    summary() {
      const session = this.session;
      if (!session) return null;
      const turns = session.items.length;
      const accuracy = session.correct ? Math.round(session.accuracyTotal / session.correct) : 0;
      const vocabulary = session.correct ? Math.round(session.vocabularyTotal / session.correct) : 0;
      const ratio = turns ? session.correct / turns : 0;
      const stars = ratio >= .88 ? 3 : ratio >= .68 ? 2 : ratio > 0 ? 1 : 0;
      return { turns, correct: session.correct, accuracy, vocabulary, stars, ratio };
    }
  }

  global.LegramDialogueEngine = DialogueEngine;
})(window);
