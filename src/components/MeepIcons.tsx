import React from 'react';

export const MeepLogo: React.FC<{size?: number; className?: string}> = ({
  size = 34,
  className = '',
}) => (
  <img
    src={`${import.meta.env.BASE_URL}meep-icon.png`}
    alt="MEEP"
    width={size}
    height={size}
    className={`shrink-0 rounded-[22%] object-cover border border-[#E1E3DA]/80 ${className}`}
  />
);

export const FoodIcon: React.FC<{clave: string; size?: number}> = ({
  clave,
  size = 30,
}) => {
  if (clave === 'leche') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M8.5 3h7l1.5 4v14H7V7z" />
        <path d="M7 11h10" />
      </svg>
    );
  }
  if (clave === 'yogur') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M5 7h14l-2 14H7z" />
        <path d="M4 7h16" />
        <path d="M8 3.5h8" />
      </svg>
    );
  }
  if (clave === 'queso') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M3 11l14-6 4 6v8H3v-8z" />
        <path d="M3 11h18" />
        <circle cx="9" cy="15" r="1.2" />
        <circle cx="15" cy="14.5" r="1" />
      </svg>
    );
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3C9.5 7.5 6.5 10.5 6.5 14.5a5.5 5.5 0 0 0 11 0C17.5 10.5 14.5 7.5 12 3z" />
      <path d="M12 14.5v5" />
    </svg>
  );
};

export const ProbeIcon: React.FC<{size?: number; className?: string}> = ({
  size = 24,
  className = '',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    <path d="M12 3C9.5 7.5 6.5 10.5 6.5 14.5a5.5 5.5 0 0 0 11 0C17.5 10.5 14.5 7.5 12 3z" />
    <path d="M12 14.5v5" />
  </svg>
);
