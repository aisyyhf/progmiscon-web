import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { formatLecturerSidebarName } from "../src/utils/lecturerSidebar.ts";

const readSource = (path) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [app, appShell, layout, sidebar, auth, language, styles, html] =
  await Promise.all([
    readSource("src/app/App.tsx"),
    readSource("src/components/layout/AppShell.tsx"),
    readSource("src/components/layout/LecturerLayout.tsx"),
    readSource("src/components/layout/LecturerSidebar.tsx"),
    readSource("src/hooks/useLecturerAuth.tsx"),
    readSource("src/hooks/useLanguage.tsx"),
    readSource("src/styles/index.css"),
    readSource("index.html"),
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
assert.match(sidebar, /!collapsed && <span className="truncate">{label}<\/span>/);
assert.match(sidebar, /title={collapsed \? label : undefined}/);
assert.match(sidebar, /onCollapsedChange\?\.\(false\)/);
assert.match(sidebar, /profile\?\.fullName/);
assert.doesNotMatch(sidebar, /lecturer-avatar|avatarInitial/);
assert.match(sidebar, /isIndonesian \? "Akun" : "Account"/);
assert.match(sidebar, /collapsed \? \([\s\S]*?<MoreHorizontal/);
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
    styles.indexOf(".lecturer-profile-summary"),
  ),
  /font-weight: 400/,
);
assert.match(styles, /--lecturer-nav-size: 0\.8125rem/);
assert.match(
  styles,
  /\.lecturer-nav-subitem[\s\S]*?font-size: 0\.75rem;[\s\S]*?line-height: 1\.125rem/,
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
  /\.lecturer-nav-item-active::before[\s\S]*?width: 3px;[\s\S]*?background: var\(--progmiscon-primary\)/,
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
assert.match(sidebar, /size={subItem \? 16 : 18}/);
assert.match(sidebar, /text-xs font-medium leading-\[18px\]/);
assert.match(sidebar, /text-\[11px\] font-normal leading-4/);
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
