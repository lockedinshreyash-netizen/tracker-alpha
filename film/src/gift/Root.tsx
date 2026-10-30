import { Composition } from 'remotion';
import { GiftThumb } from './GiftThumb';

export const GiftRoot: React.FC = () => (
  <>
    <Composition id="GiftThumbDiwali" component={GiftThumb} durationInFrames={1} fps={30} width={1200} height={630} defaultProps={{ diwali: true }} />
    <Composition id="GiftThumb" component={GiftThumb} durationInFrames={1} fps={30} width={1200} height={630} defaultProps={{ diwali: false }} />
  </>
);
