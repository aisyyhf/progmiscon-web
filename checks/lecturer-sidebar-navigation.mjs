import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { formatLecturerSidebarName } from "../src/utils/lecturerSidebar.ts";

const readSource = (path) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [app, appShell, layout, sidebar, auth, language, styles, html, packageJson] =
  await Promise.all([
    readSource("src/app/App.tsx"),
    readSource("src/components/layout/AppShell.tsx"),
    readSource("src/components/layout/LecturerLayout.tsx"),
    readSource("src/components/layout/LecturerSidebar.tsx"),
    readSource("src/hooks/useLecturerAuth.tsx"),
    readSource("src/hooks/useLanguage.tsx"),
    readSource("src/styles/index.css"),
    readSource("index.html"),
    readSource("package.json"),
  ]);

assert.match(appShell, /isLecturer && isLecturerWorkspacePath/);
assert.match(appShell, /<LecturerLayout>{children}<\/LecturerLayout>/);
assert.doesNotMatch(
  appShell.slice(
    appShell.indexOf("isLecturerWorkspacePath"),
    appShell.indexOf("export function AppShell"),
  ),
  /"\/"|\/dosen\/login|\/dosen\/daftar/,
  "landing and auth routes must not be lecturer workspace routes",
);

for (const [path, page] of [
  ["/materi", "MateriPage"],
  ["/konsep", "KonsepPage"],
  ["/miskonsepsi", "MiskonsepsiPage"],
]) {
  assert.match(
    app,
    new RegExp(`<Route path="${path}" element={<${page} \\/>} \\/>`),
    `${path} must remain public and reuse its existing page`,
  );
}

for (const route of [
  'to="/dashboard"',
  'to="/materi"',
  'to="/review?task=question"',
  'to="/konsep"',
  'to="/miskonsepsi"',
  'to="/review/riwayat"',
]) {
  assert.match(sidebar, new RegExp(route.replace(/[?]/g, "\\?")));
}

for (const label of [
  "Dashboard",
  "Bank Soal",
  "Lihat Soal",
  "Review Soal",
  "Konsep",
  "Miskonsepsi",
  "Riwayat Review",
]) {
  assert.match(sidebar, new RegExp(label));
}

assert.match(sidebar, /isReviewHistory = location\.pathname === "\/review\/riwayat"/);
assert.match(sidebar, /!isReviewHistory &&/);
assert.match(sidebar, /effectiveCollapsed \? "w-\[72px\]" : "w-52"/);
assert.match(
  sidebar,
  /lecturer-sidebar-surface[^"]*border-r border-border[\s\S]*?effectiveCollapsed \? "w-\[72px\]" : "w-52"/,
  "the sidebar surface must keep its right divider at both widths",
);
assert.match(
  sidebar,
  /!collapsed && <span className="truncate whitespace-nowrap">\{label\}<\/span>/,
);
assert.match(sidebar, /data-tooltip={collapsed \? label : undefined}/);
assert.match(sidebar, /onCollapsedChange\?\.\(false\)/);
assert.match(sidebar, /profile\?\.fullName/);
assert.doesNotMatch(sidebar, /lecturer-avatar|avatarInitial/);
assert.match(sidebar, /settingsLabel = isIndonesian \? "Pengaturan" : "Settings"/);
assert.doesNotMatch(sidebar, /MoreHorizontal/);
assert.match(sidebar, /<EllipsisVertical[\s\S]*?size=\{16\}/);
assert.match(sidebar, /formatLecturerSidebarName\(profile\?\.fullName\)/);
assert.match(
  sidebar,
  /min-w-0 flex-1 overflow-hidden text-left[\s\S]*?truncate whitespace-nowrap[\s\S]*?font-medium/,
);
assert.match(sidebar, /await logout\(\)/);
assert.match(sidebar, /setLanguage\("id"\)/);
assert.match(sidebar, /setLanguage\("en"\)/);
assert.doesNotMatch(sidebar, /supabase|from "\.\.\/\.\.\/services\//i);

assert.match(layout, /progmiscon\.lecturer\.sidebar\.v1/);
assert.match(layout, /window\.localStorage\.getItem/);
assert.match(layout, /window\.localStorage\.setItem/);
assert.match(layout, /stored === "collapsed"/);
assert.match(layout, /stored === "expanded"/);
assert.match(layout, /inert={!drawerOpen}/);
assert.match(layout, /md:hidden/);
assert.match(layout, /sticky top-0 z-30[\s\S]*?overflow-visible/);
assert.match(layout, /collapsed \? "w-\[72px\]" : "w-52"/);

assert.match(auth, /logout: \(\) => Promise<void>/);
assert.match(language, /setLanguage: \(language: Language\) => void/);
assert.match(styles, /--font-lecturer: "Poppins"/);
assert.match(styles, /\.lecturer-ui/);
assert.match(
  styles.slice(
    styles.indexOf(".lecturer-nav-item"),
    styles.indexOf(".lecturer-profile-area"),
  ),
  /font-weight: 400/,
);
assert.match(styles, /--lecturer-nav-size: 0\.75rem/);
assert.match(
  styles,
  /\.lecturer-nav-subitem[\s\S]*?font-size: 0\.6875rem;[\s\S]*?line-height: 1rem/,
);
for (const [token, value] of [
  ["text", "#000000"],
  ["background", "#fbfbfe"],
  ["primary", "#B6252A"],
  ["secondary", "#ccbab0"],
  ["accent", "#b09f85"],
]) {
  assert.match(styles, new RegExp(`--progmiscon-${token}: ${value}`));
}
assert.match(
  styles,
  /\.lecturer-nav-item-active[\s\S]*?background: transparent;[\s\S]*?color: var\(--progmiscon-primary\)/,
);
assert.match(
  styles,
  /\.lecturer-nav-item::before[\s\S]*?width: 3px;[\s\S]*?background: var\(--progmiscon-primary\)[\s\S]*?opacity: 0;[\s\S]*?scaleY\(0\.65\)/,
);
assert.match(
  styles,
  /\.lecturer-nav-item-active::before[\s\S]*?opacity: 1;[\s\S]*?scaleY\(1\)/,
);
assert.match(styles, /rgb\(204 186 176 \/ 0\.18\)/);
assert.match(
  styles,
  /\.lecturer-nav-item:focus-visible[\s\S]*?outline: 2px solid var\(--progmiscon-primary\)/,
);
assert.doesNotMatch(
  sidebar.match(/active\s*\?[\s\S]*?\)/)?.[0] ?? "",
  /bg-brand-soft|font-(?:medium|semibold|bold)/,
  "active navigation must not use a filled background or bold text",
);
assert.match(sidebar, /active && "lecturer-nav-item-active"/);
assert.match(sidebar, /subItem && "lecturer-nav-subitem"/);
assert.match(sidebar, /size={subItem \? 14 : 16}/);
assert.match(sidebar, /text-\[11px\] font-medium leading-4/);
assert.match(sidebar, /text-\[10px\] font-normal leading-\[14px\]/);
assert.match(
  styles,
  /\.lecturer-profile-area[\s\S]*?min-height: 2\.25rem;[\s\S]*?padding: 0\.125rem 0\.25rem 0\.125rem 1rem/,
);
assert.match(
  styles,
  /\.lecturer-profile-area-collapsed[\s\S]*?padding-inline: 0/,
);
assert.match(
  styles,
  /\.lecturer-account-summary[\s\S]*?width: 2rem;[\s\S]*?height: 2rem/,
);
assert.match(
  sidebar,
  /!collapsed && \(\s*<div className="min-w-0 flex-1 overflow-hidden text-left">[\s\S]*?{lecturerName}[\s\S]*?<\/div>\s*\)\}[\s\S]*?<details/,
  "profile text must remain outside the interactive account details",
);
const accountSummaryStart = sidebar.indexOf(
  "<summary",
  sidebar.indexOf("function ProfileMenu"),
);
const accountSummary = sidebar.slice(
  accountSummaryStart,
  sidebar.indexOf("</summary>", accountSummaryStart),
);
assert.match(accountSummary, /EllipsisVertical/);
assert.doesNotMatch(accountSummary, /lecturerName|Dosen|Lecturer/);
assert.match(sidebar, /PENGATURAN/);
assert.match(sidebar, /Bahasa Indonesia/);
assert.match(sidebar, />English \(US\)</);
assert.match(sidebar, /isIndonesian \? "Keluar" : "Log out"/);
assert.match(
  styles,
  /\.lecturer-account-heading[\s\S]*?font-size: 0\.5625rem;[\s\S]*?font-weight: 500/,
);
assert.match(
  styles,
  /\.lecturer-account-row[\s\S]*?font-size: 0\.6875rem;[\s\S]*?font-weight: 400/,
);
assert.equal(
  [...sidebar.matchAll(/<(?:Globe2|Languages|LogOut) size=\{14\}/g)].length,
  3,
  "language and logout rows must use consistent 16px icons",
);
assert.match(sidebar, /<Globe2 size=\{14\}/);
assert.match(sidebar, /<Languages size=\{14\}/);
assert.match(
  sidebar,
  /mt-auto shrink-0 border-t border-border py-2/,
  "the compact profile footer must retain its top divider",
);
assert.match(
  sidebar,
  /searchLabel = isIndonesian \? "Pencarian" : "Search"/,
);
assert.match(sidebar, /data-tooltip=\{searchLabel\}/);
assert.match(sidebar, /\? "Perluas menu"[\s\S]*?: "Expand menu"/);
assert.match(sidebar, /\? "Ringkas menu"[\s\S]*?: "Collapse menu"/);
assert.match(
  sidebar,
  /aria-label=\{settingsLabel\}[\s\S]*?data-tooltip=\{settingsLabel\}/,
);
assert.doesNotMatch(sidebar, /Perluas sidebar|Perkecil sidebar/);
for (const [token, value] of [
  ["motion-fast", "140ms"],
  ["motion-normal", "200ms"],
  ["motion-sidebar", "220ms"],
  ["motion-popover", "160ms"],
  ["ease-standard", "cubic-bezier(0.2, 0, 0, 1)"],
]) {
  assert.match(styles, new RegExp(`--${token}: ${value.replace(/[().]/g, "\\$&")}`));
}
assert.match(
  styles,
  /\.lecturer-sidebar-width[\s\S]*?width var\(--motion-sidebar\) var\(--ease-standard\)/,
);
assert.doesNotMatch(styles, /lecturer-nav-label-collapsed|transition:[\s\S]{0,120}gap var\(--motion-sidebar\)/);
assert.doesNotMatch(
  sidebar,
  /lecturer-search-collapsed-hidden|lecturer-search-expanded-hidden|lecturer-profile-copy-collapsed/,
);
assert.match(sidebar, /\{effectiveCollapsed \? \([\s\S]*?expandAndFocusSearch[\s\S]*?\) : \([\s\S]*?lecturer-search-expanded/);
assert.match(sidebar, /!collapsed && \([\s\S]*?\{lecturerName\}/);
assert.match(
  styles,
  /\.lecturer-bank-submenu[\s\S]*?grid-template-rows: 0fr[\s\S]*?\.lecturer-bank-submenu-open[\s\S]*?grid-template-rows: 1fr/,
);
assert.match(sidebar, /inert={!bankExpanded}/);
assert.match(
  styles,
  /details\[open\] > \.lecturer-bank-flyout[\s\S]*?lecturer-flyout-in/,
);
assert.match(
  styles,
  /details\[open\] > \.lecturer-account-menu[\s\S]*?lecturer-popover-in/,
);
assert.match(
  styles,
  /\.lecturer-tooltip\[data-tooltip\][\s\S]*?transition-delay: 300ms/,
);
assert.match(
  layout,
  /lecturer-mobile-overlay[\s\S]*?lecturer-mobile-panel/,
);
assert.match(
  styles,
  /\.lecturer-mobile-overlay[\s\S]*?var\(--motion-sidebar\)[\s\S]*?\.lecturer-mobile-panel[\s\S]*?var\(--motion-sidebar\)/,
);
assert.match(
  styles,
  /@media \(prefers-reduced-motion: reduce\)[\s\S]*?animation-duration: 0\.01ms !important[\s\S]*?transition-delay: 0ms !important/,
);
assert.doesNotMatch(
  styles.match(/\.lecturer-nav-item:not\([\s\S]*?\}/)?.[0] ?? "",
  /font-weight|progmiscon-primary|#B6252A/i,
  "inactive hover must not change navigation weight or use active red",
);
assert.match(
  styles.match(/\.lecturer-nav-item:not\([\s\S]*?\}/)?.[0] ?? "",
  /background: rgb\(204 186 176 \/ 0\.18\)/,
);
assert.match(
  sidebar,
  /w-44[\s\S]*?left-\[calc\(100%\+28px\)\][\s\S]*?right-\[-12px\]/,
  "account popover must align beside the collapsed trigger and inset from the expanded edge",
);
assert.doesNotMatch(packageJson, /framer-motion|"motion"\s*:/i);
assert.match(html, /family=Poppins:wght@400;500;600/);

const brandHeaderStart = sidebar.indexOf('to="/dashboard"');
const brandHeader = sidebar.slice(
  brandHeaderStart,
  sidebar.indexOf("</Link>", brandHeaderStart),
);
assert.match(brandHeader, /aria-label="Progmiscon"/);
assert.match(brandHeader, /<img/);
assert.doesNotMatch(brandHeader, />\s*Prog(?:miscon|MisCon)?\s*</i);

assert.deepEqual(
  [...sidebar.matchAll(/font-(?:medium|semibold|bold|extrabold)/g)].map(
    ([weight]) => weight,
  ),
  ["font-medium"],
  "only the lecturer name may use weight 500 in the sidebar",
);

assert.equal(formatLecturerSidebarName("Andi"), "Andi");
assert.equal(formatLecturerSidebarName("Budi Santoso"), "Budi Santoso");
assert.equal(
  formatLecturerSidebarName("Aisy Hafidzah Fadillah"),
  "Aisy Hafidzah F.",
);
assert.equal(
  formatLecturerSidebarName("Muhammad Rizky Aditya Pratama"),
  "Muhammad Rizky A. P.",
);
assert.equal(
  formatLecturerSidebarName("  Siti   Nur Aulia  Rahmawati Putri  "),
  "Siti Nur A. R. P.",
);
assert.equal(formatLecturerSidebarName("Jean Luc O'Connor"), "Jean Luc O.");
assert.equal(formatLecturerSidebarName(undefined), "");

const originalLecturerName = "  Muhammad Rizky Aditya Pratama  ";
formatLecturerSidebarName(originalLecturerName);
assert.equal(
  originalLecturerName,
  "  Muhammad Rizky Aditya Pratama  ",
  "display formatting must not mutate profile.fullName",
);

console.log("Lecturer sidebar navigation checks passed.");
