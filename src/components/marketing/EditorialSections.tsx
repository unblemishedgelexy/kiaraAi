import { Link } from 'react-router-dom';

export const verifiedCapabilities = [
  {
    symbol: '◉',
    title: 'Talk or type',
    description: 'Start a live voice conversation or write a message. Voice needs microphone permission and a working connection.',
    example: 'Try talking through how you want to approach a difficult conversation.',
  },
  {
    symbol: '✧',
    title: 'Keep useful context',
    description: 'Kiara has local and server-backed memory code intended to carry relevant details into later conversations.',
    example: 'Return to a goal or personal detail you have discussed before.',
  },
  {
    symbol: '◌',
    title: 'A companion with presence',
    description: 'The Android app renders a 3D avatar with conversational expressions, motion, and speech animation.',
    example: 'Choose a voice conversation for a more present, face-to-face feel.',
  },
  {
    symbol: '⌁',
    title: 'Share context when you choose',
    description: 'The app includes camera-photo and file-attachment flows so you can include material in a request.',
    example: 'Attach a note or take a photo when it helps explain what you mean.',
  },
];

export function CommunicationSection() {
  return (
    <section className="story-section" aria-labelledby="communication-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow"><span className="eyebrow-line" /> THE MOMENTS BETWEEN WORDS</p>
          <h2 id="communication-heading">A little help finding<br /><em>the words that feel like you.</em></h2>
        </div>
        <p className="section-description">
          We all replay a conversation, lose confidence before speaking up, or wish we could explain what we mean more clearly.
          Kiara is being built for those everyday moments - with room to think, try again, and choose your own next step.
        </p>
      </div>
      <div className="story-grid">
        <article className="story-card">
          <span className="feature-number">01 / FIND A START</span>
          <h3>When you are not sure how to say it</h3>
          <p>Talk through what matters to you, then explore a way to express it that still sounds like you.</p>
        </article>
        <article className="story-card">
          <span className="feature-number">02 / MAKE SENSE OF A MOMENT</span>
          <h3>When a conversation stays on your mind</h3>
          <p>Share your perspective and ask for another one - without treating a guess as the whole story.</p>
        </article>
        <article className="story-card">
          <span className="feature-number">03 / KEEP GROWING</span>
          <h3>When you want to try a different approach</h3>
          <p>Use an open conversation to reflect on confidence, boundaries, or a goal you care about.</p>
        </article>
      </div>
      <p className="story-footnote">These are examples of open-ended conversation, not separate coaching tools or guaranteed outcomes.</p>
    </section>
  );
}

export function HowItWorksSection() {
  return (
    <section className="story-section story-section-muted" aria-labelledby="how-it-works-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow"><span className="eyebrow-line" /> A SIMPLE WAY TO BEGIN</p>
          <h2 id="how-it-works-heading">Start with what is<br /><em>on your mind.</em></h2>
        </div>
        <p className="section-description">
          Kiara is a conversation, not a lesson plan. You decide what to share, how you want to communicate, and what you want to do next.
        </p>
      </div>
      <ol className="story-steps">
        <li>
          <span>01</span>
          <div><h3>Choose your way in</h3><p>Use text or start a live voice conversation in the Android app.</p></div>
        </li>
        <li>
          <span>02</span>
          <div><h3>Share only the context you choose</h3><p>Describe the situation yourself. The app also has optional photo and file attachment flows.</p></div>
        </li>
        <li>
          <span>03</span>
          <div><h3>Think it through together</h3><p>Ask a follow-up, explore another perspective, or simply leave the conversation there.</p></div>
        </li>
      </ol>
    </section>
  );
}

export function ConversationExample() {
  return (
    <section className="story-section" aria-labelledby="conversation-example-heading">
      <div className="conversation-example">
        <div className="conversation-copy">
          <p className="eyebrow"><span className="eyebrow-line" /> A MORE HUMAN TONE</p>
          <h2 id="conversation-example-heading">Less lecture.<br /><em>More listening.</em></h2>
          <p>Kiara is intended to respond to the situation you describe, ask a useful question when it helps, and leave the choice with you.</p>
          <p className="story-footnote">Illustrative example only. This is not a product screenshot or a promise of an exact response.</p>
        </div>
        <div className="conversation-card" aria-label="Illustrative conversation example">
          <p className="conversation-label">ILLUSTRATIVE EXAMPLE</p>
          <p className="conversation-speaker">You</p>
          <blockquote>I keep replaying what I said in the meeting. I wanted to disagree without sounding dismissive.</blockquote>
          <p className="conversation-speaker conversation-speaker-kiara">Kiara</p>
          <blockquote>It sounds like you were trying to be honest and considerate at once. Want to look at the words you used, or think about what you might say next time?</blockquote>
        </div>
      </div>
    </section>
  );
}

export function TrustSection() {
  return (
    <section className="story-section trust-section" aria-labelledby="trust-heading">
      <div>
        <p className="eyebrow"><span className="eyebrow-line" /> SUPPORTIVE, NOT A SUBSTITUTE</p>
        <h2 id="trust-heading">Your life and relationships<br /><em>stay yours.</em></h2>
      </div>
      <div className="trust-copy">
        <p>Kiara is meant to support reflection and real-world connection, not replace friends, family, or professional care. AI can misunderstand context; use your own judgment, especially for important decisions.</p>
        <p>The camera can be used to share a photo as conversation context. It should not be treated as a reliable way to read someone's thoughts, diagnose a mood, or determine their intentions.</p>
        <Link className="inline-link" to="/privacy">Read the privacy draft and its review notes <span aria-hidden="true">↗</span></Link>
      </div>
    </section>
  );
}
