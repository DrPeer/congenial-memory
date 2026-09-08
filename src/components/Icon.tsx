/**
 * Icon — custom generated sticker icons (NO system emoji: identical art on
 * every OS). Files live with the sprite pack in src/assets/sprites/.
 */
import alert from "../assets/sprites/alert.png";
import basket from "../assets/sprites/basket.png";
import clover from "../assets/sprites/clover.png";
import coin from "../assets/sprites/coin.png";
import crown from "../assets/sprites/crown.png";
import drop from "../assets/sprites/drop.png";
import flower from "../assets/sprites/flower.png";
import home from "../assets/sprites/home.png";
import lock from "../assets/sprites/lock.png";
import mountain from "../assets/sprites/mountain.png";
import party from "../assets/sprites/party.png";
import pause from "../assets/sprites/pause.png";
import pawprint from "../assets/sprites/pawprint.png";
import play from "../assets/sprites/play.png";
import sadcat from "../assets/sprites/sadcat.png";
import shell from "../assets/sprites/shell.png";
import speaker from "../assets/sprites/speaker.png";
import speakeroff from "../assets/sprites/speakeroff.png";
import target from "../assets/sprites/target.png";
import trophy from "../assets/sprites/trophy.png";
import tv from "../assets/sprites/tv.png";

const URLS: Record<string, string> = {
  alert,
  basket,
  clover,
  coin,
  crown,
  drop,
  flower,
  home,
  lock,
  mountain,
  party,
  pause,
  pawprint,
  play,
  sadcat,
  shell,
  speaker,
  speakeroff,
  target,
  trophy,
  tv,
};

export default function Icon({ id, size = 18 }: { id: string; size?: number }) {
  const src = URLS[id];
  if (!src) return null;
  return (
    <img
      src={src}
      width={size}
      height={size}
      alt=""
      draggable={false}
      className="inline-block select-none align-[-0.15em]"
      style={{ width: size, height: size }}
    />
  );
}
