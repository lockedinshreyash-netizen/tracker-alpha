import { loadFont } from '@remotion/fonts';
import { loadFont as loadPlayfair } from '@remotion/google-fonts/PlayfairDisplay';
import { staticFile } from 'remotion';

/** The app's own faces and nothing else: Satoshi for everything, Playfair
 *  italic for one phrase per moment. */
for (const weight of ['400', '500', '700', '900'] as const) {
  loadFont({ family: 'Satoshi', url: staticFile(`fonts/Satoshi-${weight}.woff2`), weight });
}
loadPlayfair('italic', { weights: ['400', '500'], subsets: ['latin'] });

export const SANS = "Satoshi, 'Helvetica Neue', Helvetica, Arial, sans-serif";
export const SERIF = "'Playfair Display', Georgia, serif";
