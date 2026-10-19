/* The day-100 book's reader now lives in reader/ (see reader/Reader.tsx).
   This file stays as the path App lazy-loads, so the whole reader and the
   book's text arrive together in one chunk and never in the main bundle. */
export { default } from '../reader/Reader';
