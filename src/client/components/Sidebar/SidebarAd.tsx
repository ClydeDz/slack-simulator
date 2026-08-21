import { useMemo } from "react";
import ADS from "../../data/ads";

function pickAd() {
  return ADS[Math.floor(Math.random() * ADS.length)];
}

export default function SidebarAd() {
  const ad = useMemo(() => pickAd(), []);

  return (
    <aside className="ss-sidebar-ad" aria-label="Advertisement">
      <span className="ss-sidebar-ad-label">Ad</span>
      <a
        className="ss-sidebar-ad-link"
        href={ad.link}
        target="_blank"
        rel="sponsored noopener noreferrer"
      >
        <span className="ss-sidebar-ad-text">{ad.description}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="ss-sidebar-ad-icon"
          aria-hidden="true"
        >
          <path d="M7 7h10v10" />
          <path d="M7 17 17 7" />
        </svg>
      </a>
    </aside>
  );
}
