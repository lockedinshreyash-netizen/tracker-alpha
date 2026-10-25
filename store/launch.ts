/* ── Is the Alpha Store live? ──
   The store (formula sheets and flashcard packs on one page, kits when they
   launch) is live. With STORE_LAUNCHED false the app is exactly what it was
   before the store:

     - the rail shows Review, not Store, and there is no Profile page: the
       account button at the bottom of the rail opens Edit profile;
     - the Alpha Packs store lives inside Decks again, reached from its sign;
     - My Alpha in Decks lists packs and decks only (no sheets or kits);
     - the console has no Store section, and nothing calls the store's
       sheet or kit functions.

   Every file of the store stays in the repo, and `?store=debug` (DEV) still
   runs it all on fixtures. To launch: run supabase/decks.sql on the project,
   set this to true, and deploy. A saved `lastUsedTab` is mapped either way
   (App.tsx), so nobody lands on a tab that is not drawn. */

export const STORE_LAUNCHED = true;

/* Subject kits are built but not launched. With this false nobody sees a kit
   anywhere: no Kits rack or filter option in the store, no kits in My Alpha,
   no Kits table or New kit in the console, and nothing calls the kit
   functions. Sheets and packs are unaffected. Flip it to launch kits. */
export const KITS_LAUNCHED = false;
