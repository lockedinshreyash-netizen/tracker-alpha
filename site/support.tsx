/* ── /support/ ──
   The public twin of the in-app Support Alpha page (support/SupportPage.tsx),
   built in the same pass and shell as the legal pages, so the landing and
   guide footers can link to a page that works for anyone, with no app
   JavaScript and no onboarding in the way.

   Same words (support/content.ts) and the same payment details
   (support/config.ts). The note box cannot live here: sending one needs a
   signed-in session, so this page points into the app for it.

   Like the legal pages: no FAQ markup, not a guide, only in the sitemap and
   the footers. */

import React from 'react';
import type { Crumb, SitePage } from './pages';
import { SUPPORT_COPY as C } from '../support/content';
import { SUPPORT_QR, SUPPORT_QR_SIZE, UPI_ID, supportReady, upiLink } from '../support/config';

/* The day this page last changed. */
const SUPPORT_UPDATED = '2026-10-25';

export const supportPage = (): SitePage => {
  const crumbs: Crumb[] = [{ name: 'Home', path: '/' }, { name: 'Support Alpha', path: '/support/' }];
  return {
    path: '/support/',
    label: 'Support Alpha',
    title: 'Support Alpha | Tracker Alpha',
    description: 'A note from the founder of Tracker Alpha, the free study tracker for JEE and NEET. Entirely optional. Alpha remains free to use.',
    crumbs,
    section: 'legal',
    faq: [],
    updated: SUPPORT_UPDATED,
    body: (
      <>
        <header className="hero sp-hero">
          <div className="wrap">
            <nav aria-label="Breadcrumb">
              <ol className="crumbs">
                {crumbs.map((c, i) => (
                  <li key={c.path}>{i < crumbs.length - 1 ? <a href={c.path}>{c.name}</a> : <span aria-current="page">{c.name}</span>}</li>
                ))}
              </ol>
            </nav>
            <p className="eyebrow">{C.eyebrow}</p>
            <h1>{C.title}{' '}<span className="serif">{C.accent}<span className="stop">.</span></span></h1>
            <div className="sp-letter">
              {C.letter.map((p, i) => <p key={i} className={i === 0 ? 'lead' : undefined}>{p}</p>)}
              <div className="sp-sign">
                <div>
                  <p className="serif sp-name">{C.signature}</p>
                  <p className="sp-role">{C.signatureRole}</p>
                </div>
                <p className="sp-optional">{C.optional}</p>
              </div>
            </div>
          </div>
        </header>

        <div className="wrap sp-body">
          {/* The loudest thing on the page, before the QR: paying is optional
              and changes nothing. Same words as the app (support/content.ts). */}
          <section className="sp-promise" aria-labelledby="sp-promise-h">
            <h2 id="sp-promise-h">{C.promiseTitle}<span className="stop">.</span><span className="serif">{C.promiseAccent}<span className="stop">.</span></span></h2>
            <ul>
              {C.promise.map(p => (
                <li key={p.head}>
                  <span className="sp-check" aria-hidden="true" />
                  <div><p className="sp-promise-head">{p.head}.</p><p>{p.body}</p></div>
                </li>
              ))}
            </ul>
          </section>

          <div className="sp-grid">
            <section className="sp-pay" aria-labelledby="sp-pay-h">
              <p className="sp-kicker">{C.onlyIfYouWant}</p>
              <h2 id="sp-pay-h">{C.supportTitle}<span className="stop">.</span></h2>
              <p className="sp-copy">{C.supportBody}</p>
              <p className="sp-copy sp-strong">{C.anyAmount}</p>
              {!supportReady() ? (
                <p className="sp-setup">{C.setup}</p>
              ) : (
                <>
                  {SUPPORT_QR && (
                    <figure className="sp-qr">
                      <div className="sp-plate">
                        <img
                          src={SUPPORT_QR}
                          width={SUPPORT_QR_SIZE.width}
                          height={SUPPORT_QR_SIZE.height}
                          alt={UPI_ID ? `UPI QR code for ${UPI_ID}` : 'UPI QR code for Tracker Alpha'}
                          decoding="async"
                        />
                      </div>
                      <figcaption>{C.scan}</figcaption>
                    </figure>
                  )}
                  {UPI_ID && (
                    <>
                      {SUPPORT_QR && <p className="sp-or"><span>{C.orPayTo}</span></p>}
                      <p className="sp-upi"><span className="sp-sr">UPI ID: </span><code>{UPI_ID}</code></p>
                      {/* Shown on touch screens only (site.css): a phone can't scan itself. */}
                      <a className="sp-open" href={upiLink(UPI_ID)}>Open in a UPI app</a>
                    </>
                  )}
                </>
              )}
            </section>

            <section className="sp-note" aria-labelledby="sp-note-h">
              <p className="sp-kicker">Free, always</p>
              <h2 id="sp-note-h">{C.noteTitle}<span className="stop">.</span></h2>
              <p className="sp-copy">{C.noteBody}</p>
              <p className="sp-copy sp-strong">{C.noteFree}</p>
              <div className="sp-lines" aria-hidden="true" />
              <p className="sp-copy sp-small">Notes are sent from inside Alpha, so you’ll need to sign in. Optional, and you can say whatever you like.</p>
              <a className="btn btn-red" href="/?open=support">Write a note in the app →</a>
            </section>
          </div>

          <p className="sp-closing serif">{C.closing}<span className="stop">.</span></p>
        </div>
      </>
    ),
  };
};
