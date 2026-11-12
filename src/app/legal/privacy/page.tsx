import type { Metadata } from 'next';
import LegalPage from '../components/LegalPage';
import Value from '../components/Value';
import { POLICY as P } from '../policy';

export const metadata: Metadata = { title: 'Privacy' };

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy"
      intro="Your birth date, time and place are personal. We use them to draw your chart and make your pendant, and for nothing else. We don't sell your information or use it for advertising."
    >
      <section>
        <h2>What we collect</h2>
        <ul>
          <li>
            <strong>Your birth details:</strong> date, time and place. Your chart is calculated in your browser.
            To price a design, our server builds it once and doesn't keep it. We store your details only when
            you join the waitlist or start checkout, so we can make the exact pendant you chose.
          </li>
          <li>
            <strong>Order details:</strong> your name, email, phone number and shipping address, and what you
            ordered.
          </li>
          <li>
            <strong>Payment:</strong> handled entirely by Stripe. We see the amount and the last four digits of
            your card, never the full number.
          </li>
          <li>
            <strong>Site usage:</strong> pages visited and steps reached in the designer, counted without
            cookies and without identifying you, plus error reports when something breaks.
          </li>
        </ul>
      </section>

      <section>
        <h2>How we use it</h2>
        <ul>
          <li>To calculate your chart, build your pendant and quote its price</li>
          <li>To take payment, make and ship your order, and send you updates about it</li>
          <li>To answer your questions and handle repairs</li>
          <li>To tell you when we launch, if you joined the waitlist</li>
          <li>To find and fix problems with the site</li>
          <li>To keep records the law requires, such as for sales tax</li>
        </ul>
      </section>

      <section>
        <h2>Who we share it with</h2>
        <p>Only the services that help us run the shop, and only what each one needs:</p>
        <ul>
          <li><strong>Stripe</strong> for payment, tax and receipts</li>
          <li><strong>Vercel</strong> and <strong>Neon</strong> for hosting, our database and cookie-free usage counts</li>
          <li><strong>OpenStreetMap</strong> to look up the birth place you type</li>
          <li><strong>Formspree</strong> for the waitlist sign-up form</li>
          <li><strong>Our casting partner</strong>, who receives the design file only, without your name or birth details</li>
          <li><strong>Our shipping carrier</strong>, who receives your name, address and phone number</li>
          <li><strong>Email:</strong> <Value v={P.emailProvider} /></li>
          <li><strong>Text messages:</strong> <Value v={P.textingProvider} /></li>
        </ul>
        <p>We'll also share information if the law requires it.</p>
      </section>

      <section>
        <h2>Emails and texts</h2>
        <p>
          We email you about your order. We only text you if you ask for text updates at checkout, and you can
          stop them any time by replying STOP. Marketing emails go only to people who signed up, and every one
          has an unsubscribe link.
        </p>
      </section>

      <section>
        <h2>How long we keep it</h2>
        <p>
          Order records, including the birth details behind your design, are kept for{' '}
          <Value v={P.dataRetention} />. Waitlist sign-ups are kept <Value v={P.waitlistRetention} />.
        </p>
      </section>

      <section>
        <h2>Your choices</h2>
        <p>
          You can ask to see, correct or delete the information we hold about you, or to stop hearing from us,
          by emailing <Value v={P.contactEmail} />. We'll reply within <Value v={P.privacyReplyDays} />. If we must keep an order record
          for tax purposes, we'll remove everything else and tell you what we kept. Depending on where you
          live, you may have more rights under laws such as the California Consumer Privacy Act; we honor them
          for everyone.
        </p>
      </section>

      <section>
        <h2>Security</h2>
        <p>
          Your information is stored with providers that encrypt it in transit and at rest, and only we can
          reach it. No system is perfect; if a breach ever affects you, we'll tell you promptly.
        </p>
      </section>

      <section>
        <h2>Children</h2>
        <p>The site isn't meant for children under 13, and we don't knowingly collect their information.</p>
      </section>

      <section>
        <h2>Changes and contact</h2>
        <p>
          If this policy changes, we'll update the date above and, for big changes, email customers.
          Questions: <Value v={P.contactEmail} />, or write to <Value v={P.businessName} />,{' '}
          <Value v={P.businessAddress} />.
        </p>
      </section>
    </LegalPage>
  );
}
