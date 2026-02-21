import { useState } from "react";
import pixelForgeLogo from "../assets/pixelforge-logo.png";

function FallbackAnvil(): JSX.Element {
  const px = 2;
  const cells = [
    [2, 3], [3, 3], [4, 3], [5, 3], [6, 3], [7, 3], [8, 3], [9, 3], [10, 3], [11, 3], [12, 3],
    [3, 4], [4, 4], [5, 4], [6, 4], [7, 4], [8, 4], [9, 4], [10, 4], [11, 4],
    [1, 5], [2, 5], [3, 5], [4, 5], [5, 5], [6, 5], [7, 5], [8, 5], [9, 5], [10, 5],
    [4, 6], [5, 6], [6, 6], [7, 6], [8, 6], [9, 6], [10, 6],
    [5, 7], [6, 7], [7, 7], [8, 7], [9, 7],
    [6, 8], [7, 8], [8, 8], [9, 8],
    [6, 9], [7, 9], [8, 9],
    [6, 10], [7, 10], [8, 10], [9, 10],
    [5, 11], [6, 11], [7, 11], [8, 11], [9, 11], [10, 11],
    [4, 12], [5, 12], [6, 12], [7, 12], [8, 12], [9, 12], [10, 12], [11, 12]
  ];

  const highlights = new Set(["3,3", "4,3", "5,3", "6,3", "7,3", "4,4", "5,4", "6,4", "5,7", "6,8"]);
  return (
    <svg
      className="anvil-icon"
      width={32}
      height={32}
      viewBox="0 0 32 32"
      aria-hidden="true"
      shapeRendering="crispEdges"
    >
      <rect width="32" height="32" fill="transparent" />
      {cells.map(([x, y]) => {
        const key = `${x},${y}`;
        return (
          <rect
            key={key}
            x={x * px}
            y={y * px}
            width={px}
            height={px}
            fill={highlights.has(key) ? "#bdbdbd" : "#8f8f8f"}
          />
        );
      })}
      <rect x={8} y={26} width={16} height={2} fill="#5f5f5f" />
      <rect x={10} y={28} width={12} height={2} fill="#4a4a4a" />
    </svg>
  );
}

export function AnvilIcon(): JSX.Element {
  const [failed, setFailed] = useState(false);

  if (!failed) {
    return (
      <img
        className="anvil-icon"
        src={pixelForgeLogo}
        alt=""
        aria-hidden="true"
        onError={() => setFailed(true)}
      />
    );
  }

  return <FallbackAnvil />;
}
