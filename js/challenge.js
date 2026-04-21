/* Challenge — diagnose-and-fix scenarios with reflection prompts */
(function () {
  'use strict';

  const SCENARIOS = [
    {
      id: 'boomy-bass',
      title: "Challenge 1 — The boomy bass line",
      brief: "Load the 'Bass-heavy loop' demo in the Playground. Every few bars one note jumps out way louder than the others. The rest of the mix is fine. Fix it with multiband compression (leave EQ out of this).",
      suggested: "Source: Bass-heavy loop",
      questions: [
        "Which band did you compress, and why that one?",
        "What threshold and ratio did you land on, and how did you decide?",
        "Did you solo the band at any point to check your work? What did you listen for?",
      ],
      reveal: "One reasonable answer: compress only the <strong>low</strong> band. Set the low/mid crossover around 150 Hz, threshold at roughly -20 dB, ratio 4:1, attack ~10 ms, release ~120 ms. Gain-reduction should show 3–6 dB on the loudest bass notes and near 0 dB between them. Leave mid and high alone — the problem is dynamic and frequency-specific, which is exactly what multiband comp is for."
    },
    {
      id: 'harsh-vocal',
      title: "Challenge 2 — The hissy 'S' sounds",
      brief: "Load 'Vocal-ish (for de-essing)'. The melody is fine but the sibilants (short high-frequency noise bursts) are piercing. De-ess with the high band only.",
      suggested: "Source: Vocal-ish (for de-essing)",
      questions: [
        "Where did you put your mid/high crossover, and why?",
        "What ratio and attack worked? Why does 'fast' matter here?",
        "Did you reach for makeup gain? If not, why not?",
      ],
      reveal: "Try: mid/high crossover around 5–6 kHz so the high band only catches sibilants, not the body of the voice. Ratio 6:1–10:1, threshold low enough to catch 4–8 dB of reduction on the 's' hits, attack as fast as possible (1–2 ms) to grab the transient, release ~80 ms. Makeup gain stays near 0 — you're removing energy, not trying to match the bypassed level."
    },
    {
      id: 'glue',
      title: "Challenge 3 — Mastering glue",
      brief: "Load 'Full mix'. Nothing's broken, but you want the whole thing to feel more cohesive and a little louder without any obvious pumping. Apply gentle multiband across all three bands.",
      suggested: "Source: Full mix",
      questions: [
        "What ratio did you use across the three bands, and was it the same on each?",
        "How much gain reduction are you aiming for on each band at the loudest moments?",
        "Toggle bypass on and off. Can you still hear the dynamics of the original? If not, back off.",
      ],
      reveal: "Typical glue: ratios of 1.5:1–2:1 on all three bands, thresholds set so peaks only hit 2–3 dB of reduction, attack 20–40 ms (slow enough to let transients through), release 150–300 ms. A touch of makeup gain (0.5–1.5 dB) on each band to match bypass level. If a listener can't tell whether it's on, you've probably nailed it."
    }
  ];

  function render(root) {
    root.innerHTML = '';
    const responses = SCENARIOS.map(() => []); // responses[scIdx][qIdx] = textarea

    SCENARIOS.forEach((sc, scIdx) => {
      const card = document.createElement('div');
      card.className = 'challenge-card';
      card.innerHTML = `
        <h3>${escape(sc.title)}</h3>
        <div class="brief">${escape(sc.brief)}<br><em style="color:var(--muted)">${escape(sc.suggested)}</em></div>
      `;
      sc.questions.forEach((q, qIdx) => {
        const label = document.createElement('label');
        label.style.display = 'block';
        label.style.marginTop = '10px';
        label.style.color = 'var(--muted)';
        label.style.fontSize = '13px';
        label.textContent = `${qIdx + 1}. ${q}`;
        const ta = document.createElement('textarea');
        ta.placeholder = "Your thoughts…";
        label.appendChild(ta);
        card.appendChild(label);
        responses[scIdx][qIdx] = ta;
      });
      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.style.marginTop = '14px';
      btn.textContent = 'Show a reasonable answer';
      const reveal = document.createElement('div');
      reveal.className = 'challenge-reveal';
      reveal.innerHTML = `<strong>One way to solve it:</strong> ${sc.reveal}`;
      btn.addEventListener('click', () => {
        reveal.classList.toggle('show');
        btn.textContent = reveal.classList.contains('show') ? 'Hide answer' : 'Show a reasonable answer';
      });
      card.appendChild(btn);
      card.appendChild(reveal);
      root.appendChild(card);
    });

    const summary = window.SummaryUI.buildSummaryBlock({
      title: 'Challenge Summary',
      generate: () => buildChallengeSummary(responses),
    });
    root.appendChild(summary);
  }

  function buildChallengeSummary(responses) {
    const lines = [];
    lines.push('Multiband Compression — Challenge Reflections');
    lines.push(`Date: ${new Date().toLocaleString()}`);
    lines.push('');
    SCENARIOS.forEach((sc, scIdx) => {
      lines.push(`== ${sc.title} ==`);
      lines.push(`Brief: ${sc.brief}`);
      lines.push('');
      sc.questions.forEach((q, qIdx) => {
        const answer = (responses[scIdx][qIdx]?.value || '').trim();
        lines.push(`Q${qIdx + 1}: ${q}`);
        lines.push(`A: ${answer || '(no response)'}`);
        lines.push('');
      });
      lines.push('');
    });
    return lines.join('\n');
  }

  function escape(s) {
    return s.replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  window.Challenge = { render };
})();
