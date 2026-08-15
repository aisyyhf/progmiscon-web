import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

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
assert.match(sidebar, /profile\?\.fullName\.trim\(\)/);
assert.doesNotMatch(sidebar, /lecturer-avatar|avatarInitial/);
assert.match(sidebar, /isIndonesian \? "Akun" : "Account"/);
assert.match(sidebar, /collapsed \? \([\s\S]*?<MoreHorizontal/);
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
assert.match(html, /family=Poppins:wght@400;500;600/);

console.log("Lecturer sidebar navigation checks passed.");
