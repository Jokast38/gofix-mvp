// Guided tours: each step points at the first VISIBLE element among `target` (data-testid values, or CSS selectors
// starting with "["), so one definition works on phone (bottom nav) and desktop (header). A step without target is a
// centred dialog. Texts: i18n `tour.<id>.steps.<key>.{title,text}`. Steps whose target is missing are skipped.
export const TOURS = [
  {
    id: "welcome", route: "/", path: /^\/$/, when: ({ user }) => !user,
    steps: [
      { key: "intro" },
      { key: "search", target: ["home-search-form"] },
      { key: "universes", target: ["univers-card-services", "[data-testid^=\"univers-card-\"]"] },
      { key: "language", target: ["language-switcher"] },
      { key: "assistant", target: ["chatbot-open"] },
      { key: "register", target: ["header-register-link", "bottom-nav-login"] },
      { key: "end" },
    ],
  },
  {
    id: "navigation", route: "/", path: /^\/$/, when: ({ user }) => Boolean(user),
    steps: [
      { key: "intro" },
      { key: "messages", target: ["bottom-nav-messages", "header-messages-link"] },
      { key: "publish", target: ["bottom-nav-publish", "bottom-nav-dashboard", "header-dashboard-link"] },
      { key: "notifications", target: ["header-notifications"] },
      { key: "favorites", target: ["bottom-nav-favorites"] },
      { key: "account", target: ["bottom-nav-profile", "header-account-link"] },
      { key: "end" },
    ],
  },
  {
    id: "search", route: "/search?q=fuite%20%C3%A0%20Kouba%20aujourd%27hui", path: /^\/search/,
    steps: [
      { key: "input", target: ["catalog-search-input"] },
      { key: "understood", target: ["intent-chips", "smart-match"] },
      { key: "card", target: ["[data-testid^=\"pro-card-\"]", "[data-testid^=\"teacher-card-\"]"] },
      { key: "why", target: ["why-button", "match-why"] },
      { key: "filters", target: ["catalog-filters"] },
      { key: "publish", target: ["publish-request-bar"] },
    ],
  },
  {
    id: "profile", path: /^\/(pro|teacher)\/[^/]+$/,
    steps: [
      { key: "trust", target: ["profile-trust"] },
      { key: "reviews", target: ["profile-reviews"] },
      { key: "contact", target: ["profile-contact", "profile-unlock", "profile-login-to-unlock"] },
      { key: "request", target: ["profile-request", "profile-open-request"] },
      { key: "favorite", target: ["profile-favorite"] },
    ],
  },
  {
    id: "account", route: "/account", path: /^\/account$/, when: ({ user }) => Boolean(user),
    steps: [
      { key: "photo", target: ["account-photo-block"] },
      { key: "wilaya", target: ["prefs-detect-wilaya"] },
      { key: "links", target: ["account-links"] },
      { key: "privacy", target: ["account-export-button"] },
      { key: "replay", target: ["guided-tours"] },
    ],
  },
  {
    id: "dashboard", route: "/dashboard", path: /^\/dashboard/, when: ({ user }) => Boolean(user && (user.roles.includes("professional") || user.roles.includes("teacher"))),
    steps: [
      { key: "intro" },
      { key: "access", target: ["dashboard-free-access", "dashboard-subscribed", "dashboard-blocked"] },
      { key: "requests", target: ["dashboard-tab-requests"] },
      { key: "jobs", target: ["dashboard-tab-jobs"] },
      { key: "profile", target: ["dashboard-tab-profile"] },
      { key: "trust", target: ["dashboard-tab-trust"] },
      { key: "public", target: ["dashboard-view-public"] },
    ],
  },
  {
    id: "messages", route: "/messages", path: /^\/messages$/, when: ({ user }) => Boolean(user),
    steps: [
      { key: "list", target: ["conversation-list", "messages-empty"] },
      { key: "search", target: ["messages-search"] },
    ],
  },
  {
    id: "thread", path: /^\/messages\/[^/]+$/, when: ({ user }) => Boolean(user),
    steps: [
      { key: "input", target: ["thread-input"] },
      { key: "job", target: ["thread-propose-job"] },
      { key: "menu", target: ["thread-menu"] },
    ],
  },
];

export const tourFor = (pathname, ctx) => TOURS.find((tour) => tour.path.test(pathname) && (!tour.when || tour.when(ctx)));
