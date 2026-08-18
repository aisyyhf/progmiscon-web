import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readSource = (path) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [app, topNav, navLinks, translation, login, signup, dashboard] = await Promise.all([
  readSource("src/app/App.tsx"),
  readSource("src/components/layout/TopNav.tsx"),
  readSource("src/components/navigation/useNavLinks.ts"),
  readSource("src/utils/translation.ts"),
  readSource("src/pages/LecturerLoginPage.tsx"),
  readSource("src/pages/LecturerSignupPage.tsx"),
  readSource("src/pages/LecturerDashboardPage.tsx"),
]);

assert.match(app, /<Route path="\/" element={<HomePage \/>} \/>/);
assert.match(
  app,
  /<Route path="\/home" element={<Navigate to="\/" replace \/>} \/>/,
);

assert.doesNotMatch(
  topNav,
  /if \(location\.pathname === "\/"\)/,
  "landing and public pages must share one navbar",
);
assert.doesNotMatch(topNav, />[^<{]*Guest[^<{]*</, "visible UI must not say Guest");
assert.match(topNav, /const brandLink[\s\S]*?to="\/"/);
assert.match(topNav, /<NavTabs publicOnly \/>/);
assert.match(topNav, /to="\/dosen\/login"/);
assert.match(topNav, /uiText\.navLecturerLogin/);
assert.doesNotMatch(topNav, /Masuk sebagai Dosen|Jelajahi sebagai Pengunjung/);
const publicHeaderStart = topNav.indexOf("if (!isAdminRoute)");
const adminHeaderStart = topNav.indexOf("\n  return (", publicHeaderStart);
assert.notEqual(publicHeaderStart, -1, "public navbar branch is missing");
assert.notEqual(adminHeaderStart, -1, "admin navbar branch is missing");
const publicHeader = topNav.slice(publicHeaderStart, adminHeaderStart);
assert.doesNotMatch(
  publicHeader,
  /absolute left-1\/2|-translate-x-1\/2/,
  "public navigation must stay grouped with the logo instead of being independently centered",
);
assert.match(topNav, /const isAdminRoute = location\.pathname === "\/admin"/);
assert.match(topNav, /<NavTabs \/>/);
assert.match(
  translation,
  /navLecturerLogin: { id: "Masuk Dosen", en: "Lecturer Sign In" }/,
);

const publicLinksStart = navLinks.indexOf("const publicLinks");
const lecturerLinksStart = navLinks.indexOf("const lecturerLinks");
const publicLinks = navLinks.slice(publicLinksStart, lecturerLinksStart);
assert.deepEqual(
  [...publicLinks.matchAll(/to: "([^"]+)"/g)].map((match) => match[1]),
  ["/materi", "/konsep", "/miskonsepsi"],
  "anonymous navigation must expose only Soal, Konsep, and Miskonsepsi",
);
assert.doesNotMatch(
  publicLinks,
  /home|dashboard|review|riwayat|dosen/i,
  "anonymous navigation must not expose landing or lecturer links",
);
assert.match(navLinks, /to: "\/dashboard"/);
assert.match(navLinks, /to: "\/review"/);
assert.match(navLinks, /to: "\/review\/riwayat"/);
assert.match(
  navLinks,
  /return publicOnly \|\| !isLecturer \? publicLinks : lecturerLinks/,
);

for (const authPage of [login, signup]) {
  assert.match(authPage, /navigate\("\/dashboard", { replace: true }\)/);
  assert.doesNotMatch(authPage, /navigate\("\/review"/);
}

assert.match(
  app,
  /path="\/dashboard"[\s\S]*?<LecturerOnly>[\s\S]*?<LecturerDashboardPage \/>[\s\S]*?<\/LecturerOnly>/,
);
assert.match(
  app,
  /path="\/review"[\s\S]*?<LecturerOnly>[\s\S]*?<LecturerReviewPage \/>[\s\S]*?<\/LecturerOnly>/,
);
assert.match(
  app,
  /path="\/review\/answer\/:answerId"[\s\S]*?<LecturerOnly>[\s\S]*?<LecturerAnswerReviewRoute \/>[\s\S]*?<\/LecturerOnly>/,
);
assert.match(
  app,
  /path="\/review\/riwayat"[\s\S]*?<LecturerOnly>[\s\S]*?<LecturerReviewHistoryPage \/>[\s\S]*?<\/LecturerOnly>/,
);

for (const [path, page] of [
  ["/materi", "MateriPage"],
  ["/konsep", "KonsepPage"],
  ["/miskonsepsi", "MiskonsepsiPage"],
]) {
  assert.match(
    app,
    new RegExp(`<Route path="${path}" element={<${page} \\/>} \\/>`),
    `${path} must remain public`,
  );
}

assert.match(dashboard, /to="\/review"/);
assert.match(dashboard, /to="\/review\/riwayat"/);
assert.doesNotMatch(dashboard, /statistik|statistics|\b\d+%/i);

console.log("Application entry flow checks passed.");
