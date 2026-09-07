import { useEffect, useRef } from "react";
import { CATS } from "../game/cats";
import { drawCat } from "../game/drawCat";

interface Props {
  tier: number;
  size: number;
  className?: string;
  dim?: boolean;
}

export default function CatIcon({ tier, size, className, dim }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    c.width = size * dpr;
    c.height = size * dpr;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    const r = size * 0.36;
    drawCat(ctx, size / 2, size / 2 + size * 0.04, r, CATS[tier]);
  }, [tier, size]);

  return (
    <canvas
      ref={ref}
      className={className}
      style={{ width: size, height: size, opacity: dim ? 0.35 : 1, filter: dim ? "grayscale(1)" : undefined }}
    />
  );
}
