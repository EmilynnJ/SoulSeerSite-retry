import React from "react";

export default function StarRating({
  value,
  onChange,
  readOnly = false,
  size = 7,
}: {
  value: number;
  onChange?: (v: number) => void;
  readOnly?: boolean;
  size?: number;
}) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          className="focus:outline-none"
          disabled={readOnly}
          onClick={() => !readOnly && onChange?.(i)}
          tabIndex={readOnly ? -1 : 0}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill={i <= value ? "#FF69B4" : "none"}
            viewBox="0 0 24 24"
            stroke="#FF69B4"
            strokeWidth={1.5}
            className={`w-${size} h-${size} transition`}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M11.48 3.5l2.74 6.26 6.83.57-5.21 4.56 1.65 6.61L12 17.77l-5.49 3.23 1.65-6.61-5.21-4.56 6.83-.57 2.74-6.26z"
            />
          </svg>
        </button>
      ))}
    </div>
  );
}