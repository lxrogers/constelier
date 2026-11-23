import type { Metadata } from 'next';
import Link from 'next/link';
import LegalPage from '../components/LegalPage';
import Value from '../components/Value';
import { POLICY as P, FINAL_SALE_SHORT, decided } from '../policy';

export const metadata: Metadata = { title: 'Terms of Service' };

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      intro={<>These terms cover requesting a quote and buying a pendant from Constelier, which is run by <Value v={P.businessName} />. By requesting a quote or placing an order you agree to them.</>}
    >
      <section>
        <h2>Your design</h2>
        <p>
          Constelier draws your pendant from the planetary aspects in the natal chart we calculate from the
          birth date, time and place you enter. Please check them: a different time or place can change the
          chart and the piece, and we make exactly the design you approve at checkout.
        </p>
        <p>
          Astrology here is for meaning and reflection. Nothing on the site is a prediction or advice about
          health, money or any other decision.
        </p>
      </section>

      <section>
        <h2>Prices</h2>
        <p>
          Each design is priced from the amount of <Value v={P.metal} /> it takes to cast, so two designs can
          cost different amounts. The price you see when you add a piece to your bag is checked again at
          checkout. Prices are in US dollars; sales tax is added at checkout where it applies. If we make an
          obvious pricing mistake, we'll contact you and you can pay the correct price or cancel for a full refund.
        </p>
      </section>

      <section>
        <h2>Ordering and payment</h2>
        <p>
          Payment is handled by Stripe; we never see or store your card number. Your order is accepted when
          payment goes through and you receive a confirmation. You must be at least <Value v={P.minimumAge} /> or
          have a parent or guardian's permission to order.
        </p>
      </section>

      <section>
        <h2>Making and shipping</h2>
        <p>
          Every pendant is cast to order and ships within <Value v={P.productionTime} />. Shipping options,
          signature rules and what happens if a package is lost are on the{' '}
          <Link href="/legal/shipping">Shipping</Link> page. The piece is yours, and the risk of loss passes to
          you, once it's delivered.
        </p>
      </section>

      <section>
        <h2>Cancellations and returns</h2>
        <p>
          {FINAL_SALE_SHORT} You can cancel within <Value v={P.cancelWindow} /> of ordering, before your design
          is sent to be cast. Details are on the <Link href="/legal/returns">Returns and final sale</Link> page.
        </p>
      </section>

      <section>
        <h2>Warranty</h2>
        <p>
          Your pendant is covered against casting and workmanship defects for <Value v={P.warrantyLength} />.
          See <Link href="/legal/warranty">Warranty and repairs</Link>.
        </p>
      </section>

      <section id="sms">
        <h2>SMS terms</h2>
        <p>
          If you choose “Text me” when you request a quote, or ask for text updates at checkout, you agree to
          receive text messages from Constelier (<Value v={P.businessName} />) at the mobile number you gave
          us. Texting is optional: you can ask to be emailed instead, and agreeing to texts is not a condition
          of buying anything.
        </p>
        <ul>
          <li>
            <strong>What we send:</strong> messages about your quote request and your pendant, such as
            questions about your design, a link to your pendant page, replies to your questions and, if you
            order, updates about your order. We don't send marketing texts.
          </li>
          <li><strong>How often:</strong> message frequency varies with the conversation.</li>
          <li><strong>Cost:</strong> message and data rates may apply, depending on your mobile plan.</li>
          <li>
            <strong>Stopping:</strong> reply STOP to any message to opt out. You'll get one message confirming
            it and no more after that. Reply START to opt back in.
          </li>
          <li>
            <strong>Help:</strong> reply HELP to any message, or email <Value v={P.contactEmail} />.
          </li>
          <li>Mobile carriers are not liable for delayed or undelivered messages.</li>
        </ul>
        <p>
          How we handle your number is covered in our <Link href="/legal/privacy">Privacy Policy</Link>. We
          do not sell or share your SMS opt-in data or personal information with third parties for marketing
          purposes.
        </p>
      </section>

      <section>
        <h2>Natural variation</h2>
        <p>
          Each piece is cast and finished by hand. The on-screen model is a close guide, but color, shine and
          fine detail can differ slightly from the render, and small marks from hand finishing are part of
          the piece, not defects.
        </p>
      </section>

      <section>
        <h2>The design and the site</h2>
        <p>
          The software, look and pendant designs on the site belong to <Value v={P.businessName} />. Your
          pendant is yours to wear, gift and resell. We may keep your design so we can recast or repair it,
          and we won't show it publicly without your permission.
        </p>
      </section>

      <section>
        <h2>Our responsibility</h2>
        <p>
          To the extent the law allows, our total responsibility for any order is limited to what you paid for
          it, and we aren't liable for indirect losses. Nothing in these terms limits rights you have that the
          law doesn't let a seller limit.
        </p>
      </section>

      <section>
        <h2>The legal part</h2>
        <p>
          {decided(P.governingState) && <>These terms are governed by the laws of <Value v={P.governingState} />. </>}
          If we change these terms, the version
          on this page when you ordered applies to your order.
        </p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>
          <Value v={P.businessName} />, <Value v={P.businessAddress} />, <Value v={P.contactEmail} />.
        </p>
      </section>
    </LegalPage>
  );
}
