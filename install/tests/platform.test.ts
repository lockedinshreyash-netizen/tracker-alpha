import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Env, bookmarkKeys, chromeIntentUrl, inAppName, keepMethodFor } from '../platform';

const UA = {
  chromeAndroid: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36',
  samsung: 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/27.0 Chrome/125.0.0.0 Mobile Safari/537.36',
  firefoxAndroid: 'Mozilla/5.0 (Android 14; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0',
  iphoneSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
  iphoneChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0.7390.41 Mobile/15E148 Safari/604.1',
  ipadAsMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15',
  macSafari17: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15',
  macSafari16: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15',
  macChrome: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
  winFirefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0',
  winEdge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0',
  instagramAndroid: 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/141.0.0.0 Mobile Safari/537.36 Instagram 350.0.0.0.0 Android',
  instagramIOS: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0.0.0 (iPhone15,2; iOS 18_5; en_IN; en)',
  whatsappAndroid: 'Mozilla/5.0 (Linux; Android 13; SM-A536E; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.0.0 Mobile Safari/537.36 WhatsApp/2.24',
  facebookIOS: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/440.0.0.0]',
  /* Devtools' phone emulation on a Mac: Android UA, MacIntel platform, touch. */
  emulatedAndroidOnMac: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Mobile Safari/537.36',
};

const env = (ua: string, over: Partial<Env> = {}): Env => ({
  ua,
  platform: /Macintosh/.test(ua) ? 'MacIntel' : /Windows/.test(ua) ? 'Win32' : /iPhone/.test(ua) ? 'iPhone' : 'Linux armv8l',
  maxTouchPoints: /Mobi|iPhone|Android/.test(ua) ? 5 : 0,
  canPrompt: /Chrome|Edg|SamsungBrowser/.test(ua) && !/CriOS|wv\)/.test(ua),
  standalone: false,
  installedElsewhere: false,
  ...over,
});

const cases: Array<[string, Env, string]> = [
  ['Chrome on Android installs with the prompt', env(UA.chromeAndroid), 'prompt'],
  ['Samsung Internet installs with the prompt', env(UA.samsung), 'prompt'],
  ['Edge on Windows installs with the prompt', env(UA.winEdge), 'prompt'],
  ['Chrome on a Mac installs with the prompt', env(UA.macChrome), 'prompt'],
  ['Firefox on Android uses its menu', env(UA.firefoxAndroid, { canPrompt: false }), 'firefox-android'],
  ['Safari on iPhone is guided through Share', env(UA.iphoneSafari, { canPrompt: false }), 'ios-share'],
  ['Chrome on iPhone is guided through Share', env(UA.iphoneChrome, { canPrompt: false }), 'ios-share'],
  ['an iPad that says Mac is still an iPad', env(UA.ipadAsMac, { maxTouchPoints: 5, canPrompt: false }), 'ios-share'],
  ['Safari 17 on a Mac adds to the Dock', env(UA.macSafari17, { canPrompt: false }), 'mac-dock'],
  ['Safari 16 on a Mac falls back to a bookmark', env(UA.macSafari16, { canPrompt: false }), 'bookmark'],
  ['Firefox on Windows gets the bookmark', env(UA.winFirefox, { canPrompt: false }), 'bookmark'],
  ['Instagram on Android is sent out to Chrome', env(UA.instagramAndroid, { canPrompt: true }), 'inapp'],
  ['Instagram on iPhone is sent out to Safari', env(UA.instagramIOS, { canPrompt: false }), 'inapp'],
  ['WhatsApp on Android is sent out', env(UA.whatsappAndroid), 'inapp'],
  ['Facebook on iPhone is sent out', env(UA.facebookIOS, { canPrompt: false }), 'inapp'],
  ['phone emulation on a Mac is Android, not an iPad', env(UA.emulatedAndroidOnMac, { platform: 'MacIntel', maxTouchPoints: 5 }), 'prompt'],
  ['already installed needs nothing', env(UA.chromeAndroid, { standalone: true }), 'none'],
  ['installed elsewhere on the device needs nothing', env(UA.chromeAndroid, { installedElsewhere: true }), 'none'],
  ['an Android browser with no prompt and no known menu gets nothing', env(UA.chromeAndroid.replace('Chrome', 'Opera'), { canPrompt: false }), 'none'],
];

for (const [name, e, want] of cases) {
  test(name, () => assert.equal(keepMethodFor(e), want));
}

test('the bookmark shortcut matches the keyboard', () => {
  assert.equal(bookmarkKeys({ ua: UA.macSafari16, platform: 'MacIntel' }).mod, '⌘');
  assert.equal(bookmarkKeys({ ua: UA.winFirefox, platform: 'Win32' }).mod, 'Ctrl');
});

test('the Chrome intent keeps the path and query, and falls back to the page', () => {
  const url = chromeIntentUrl('https://trackeralpha.in/?open=today&join=ABC');
  assert.ok(url.startsWith('intent://trackeralpha.in/?open=today&join=ABC#Intent;scheme=https;package=com.android.chrome;'));
  assert.ok(url.includes(`S.browser_fallback_url=${encodeURIComponent('https://trackeralpha.in/?open=today&join=ABC')}`));
});

test('in-app browsers are named for the copy', () => {
  assert.equal(inAppName(UA.instagramIOS), 'Instagram');
  assert.equal(inAppName(UA.whatsappAndroid), 'WhatsApp');
  assert.equal(inAppName(UA.facebookIOS), 'Facebook');
});
