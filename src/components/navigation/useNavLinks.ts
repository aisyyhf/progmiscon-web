import { useLecturerAuth } from "../../hooks/useLecturerAuth";
import { uiText } from "../../utils/translation";

const baseLinks = [
  { to: "/home", label: uiText.navHome },
  { to: "/materi", label: uiText.navMateri },
  { to: "/konsep", label: uiText.navKonsep },
  { to: "/miskonsepsi", label: uiText.navMiskonsepsi },
];

export function useNavLinks() {
  const { isLecturer } = useLecturerAuth();
  return isLecturer ? [...baseLinks, { to: "/review", label: uiText.navReview }] : baseLinks;
}
