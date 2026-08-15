import { useLecturerAuth } from "../../hooks/useLecturerAuth";
import { uiText } from "../../utils/translation";

const publicLinks = [
  { to: "/materi", label: uiText.navMateri },
  { to: "/konsep", label: uiText.navKonsep },
  { to: "/miskonsepsi", label: uiText.navMiskonsepsi },
];

const lecturerLinks = [
  { to: "/dashboard", label: uiText.navDashboard },
  ...publicLinks,
  { to: "/review", label: uiText.navReview },
  { to: "/review/riwayat", label: uiText.navHistory },
];

export function useNavLinks() {
  const { isLecturer } = useLecturerAuth();
  return isLecturer ? lecturerLinks : publicLinks;
}
