import {
  ArrowRight,
  BookOpen,
  GraduationCap,
  Search,
  UsersRound,
  Workflow,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useCategories } from "../hooks/useCategories";
import { useLanguage } from "../hooks/useLanguage";
import { useLecturerAuth } from "../hooks/useLecturerAuth";
import { useMisconceptions } from "../hooks/useMisconceptions";
import { useQuestions } from "../hooks/useQuestions";

export function HomePage() {
  const { language } = useLanguage();
  const { isLecturer } = useLecturerAuth();
  const { categories } = useCategories();
  const { misconceptions } = useMisconceptions();
  const { questions } = useQuestions();
  const isIndonesian = language === "id";

  return (
    <div className="pb-4">
      <section className="grid items-center gap-8 pb-8 pt-3 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12 lg:pb-10 lg:pt-7">
        <div className="home-hero-copy max-w-2xl">
          <h1 className="text-balance text-[2.7rem] font-extrabold leading-[1.07] tracking-[-0.045em] text-navy-deep sm:text-[3.45rem] lg:text-[3.5rem] xl:text-[4rem]">
            {isIndonesian ? (
              <>
                Yang terasa benar belum tentu{" "}
                <span className="text-brand">tepat</span>
              </>
            ) : (
              <>
                What feels right is not always{" "}
                <span className="text-brand">correct</span>
              </>
            )}
          </h1>
          <p className="mt-5 max-w-[58ch] text-[15px] leading-7 text-muted sm:text-base">
            {isIndonesian
              ? "Progmiscon menunjukkan mengapa jawaban pemrograman bisa salah dan konsep yang sering disalahpahami"
              : "Progmiscon shows why programming answers go wrong and which concepts students often misunderstand"}
          </p>
          <Link
            to="/miskonsepsi"
            className="mt-7 inline-flex min-h-12 items-center rounded-md bg-brand px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(182,37,42,0.18)] transition hover:-translate-y-0.5 hover:bg-brand-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            {isIndonesian ? "Lihat miskonsepsi" : "View misconceptions"}
          </Link>
        </div>

        <div className="home-hero-visual group overflow-hidden rounded-xl border border-border bg-neutral lg:justify-self-end">
          <img
            src="/home-misconception-map.webp"
            alt={
              isIndonesian
                ? "Mahasiswa membandingkan alur jawaban yang salah dan yang sudah diperbaiki."
                : "A student compares an incorrect answer path with a corrected one."
            }
            width={1448}
            height={1086}
            fetchPriority="high"
            className="aspect-[4/3] w-full object-cover transition-transform duration-700 group-hover:scale-[1.015]"
          />
        </div>
      </section>

      <section
        id="jelajahi"
        aria-labelledby="explore-title"
        className="home-reveal -mx-4 mt-16 scroll-mt-24 bg-neutral/70 py-10 shadow-[0_0_0_100vmax_#f6f5f4b3] [clip-path:inset(0_-100vmax)] sm:-mx-6 lg:-mx-8 lg:mt-20 lg:py-12"
      >
        <div className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8">
          <header>
            <h2
              id="explore-title"
              className="text-balance text-3xl font-extrabold tracking-[-0.03em] text-navy-deep sm:text-4xl"
            >
              {isIndonesian
                ? "Mau mulai dari mana?"
                : "Where do you want to start?"}
            </h2>
            <p className="mt-3 max-w-[48ch] text-sm leading-6 text-muted sm:text-base">
              {isIndonesian
                ? "Pilih bagian yang sesuai dengan kebutuhan belajar atau mengajar"
                : "Choose the section that fits the learning or teaching need"}
            </p>
          </header>

          <nav
            aria-label={isIndonesian ? "Pilihan halaman" : "Page choices"}
            className="mt-8 grid divide-y divide-border md:grid-cols-3 md:divide-x md:divide-y-0"
          >
            <Link
              to="/materi"
              className="group flex flex-col py-8 transition duration-300 hover:bg-white/80 focus-visible:relative focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand active:bg-brand-soft/70 md:min-h-[19rem] md:px-8"
            >
              <BookOpen
                aria-hidden="true"
                size={58}
                strokeWidth={1.5}
                className="text-brand transition-transform duration-300 group-hover:-translate-y-1 group-hover:-rotate-3"
              />
              <h3 className="mt-7 text-2xl font-extrabold tracking-[-0.02em] text-navy-deep sm:text-3xl">
                {isIndonesian ? "Soal" : "Questions"}
              </h3>
              <span aria-hidden="true" className="mt-2 block h-0.5 w-12 bg-brand" />
              <p className="mt-4 max-w-[29ch] text-sm leading-6 text-muted">
                {isIndonesian
                  ? "Topik, soal, dan jawaban mahasiswa"
                  : "Topics, questions, and student answers"}
              </p>
              <span className="mt-auto flex items-end justify-between gap-5 pt-8">
                <span className="flex items-center gap-2 text-sm font-bold text-brand-deep">
                  {isIndonesian ? "Buka" : "Open"}
                  <ArrowRight
                    aria-hidden="true"
                    size={18}
                    strokeWidth={2}
                    className="transition-transform duration-300 group-hover:translate-x-1.5"
                  />
                </span>
                <span className="flex gap-4 text-xs font-semibold text-navy-deep">
                  <span>{categories.length} {isIndonesian ? "topik" : "topics"}</span>
                  <span>{questions.length} {isIndonesian ? "soal" : "questions"}</span>
                </span>
              </span>
            </Link>

            <Link
              to="/konsep"
              className="group flex flex-col py-8 transition duration-300 hover:bg-white/80 focus-visible:relative focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand active:bg-brand-soft/70 md:min-h-[19rem] md:px-8"
            >
              <Workflow
                aria-hidden="true"
                size={58}
                strokeWidth={1.5}
                className="text-brand transition-transform duration-300 group-hover:-translate-y-1 group-hover:rotate-3"
              />
              <h3 className="mt-7 text-2xl font-extrabold tracking-[-0.02em] text-navy-deep sm:text-3xl">
                {isIndonesian ? "Konsep" : "Concepts"}
              </h3>
              <span aria-hidden="true" className="mt-2 block h-0.5 w-12 bg-brand" />
              <p className="mt-4 max-w-[29ch] text-sm leading-6 text-muted">
                {isIndonesian
                  ? "Penjelasan dasar pemrograman"
                  : "Programming fundamentals explained"}
              </p>
              <span className="mt-auto flex items-center gap-2 pt-8 text-sm font-bold text-brand-deep">
                {isIndonesian ? "Buka" : "Open"}
                <ArrowRight
                  aria-hidden="true"
                  size={18}
                  strokeWidth={2}
                  className="transition-transform duration-300 group-hover:translate-x-1.5"
                />
              </span>
            </Link>

            <Link
              to="/miskonsepsi"
              className="group flex flex-col py-8 transition duration-300 hover:bg-white/80 focus-visible:relative focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand active:bg-brand-soft/70 md:min-h-[19rem] md:px-8"
            >
              <Search
                aria-hidden="true"
                size={58}
                strokeWidth={1.5}
                className="text-brand transition-transform duration-300 group-hover:-translate-y-1 group-hover:rotate-3"
              />
              <h3 className="mt-7 text-2xl font-extrabold tracking-[-0.02em] text-navy-deep sm:text-3xl">
                {isIndonesian ? "Miskonsepsi" : "Misconceptions"}
              </h3>
              <span aria-hidden="true" className="mt-2 block h-0.5 w-12 bg-brand" />
              <p className="mt-4 max-w-[29ch] text-sm leading-6 text-muted">
                {isIndonesian
                  ? "Pola kesalahan yang sering muncul"
                  : "Error patterns that often appear"}
              </p>
              <span className="mt-auto flex items-end justify-between gap-5 pt-8">
                <span className="flex items-center gap-2 text-sm font-bold text-brand-deep">
                  {isIndonesian ? "Buka" : "Open"}
                  <ArrowRight
                    aria-hidden="true"
                    size={18}
                    strokeWidth={2}
                    className="transition-transform duration-300 group-hover:translate-x-1.5"
                  />
                </span>
                <span className="text-xs font-semibold text-navy-deep">
                  {misconceptions.length} {isIndonesian ? "pola" : "patterns"}
                </span>
              </span>
            </Link>
          </nav>
        </div>
      </section>

      <section
        aria-labelledby="audience-title"
        className="home-reveal mt-16 lg:mt-20 lg:grid lg:grid-cols-[1fr_0.96fr] lg:items-center"
      >
        <div className="group overflow-hidden rounded-xl border border-border bg-neutral">
          <img
            src="/home-academic-collaboration.webp"
            alt={
              isIndonesian
                ? "Dosen dan mahasiswa melihat pola jawaban bersama."
                : "A lecturer and students review answer patterns together."
            }
            width={1536}
            height={1024}
            loading="lazy"
            className="aspect-[4/3] w-full object-cover transition-transform duration-700 group-hover:scale-[1.015]"
          />
        </div>

        <div className="relative z-10 mx-4 -mt-8 rounded-xl border border-border bg-white px-6 py-7 shadow-[0_18px_45px_rgba(43,38,36,0.09)] sm:mx-8 sm:px-8 sm:py-9 lg:mx-0 lg:-ml-12 lg:mt-0 lg:px-10">
          <h2
            id="audience-title"
            className="text-balance text-3xl font-extrabold tracking-[-0.03em] text-navy-deep sm:text-4xl"
          >
            {isIndonesian
              ? "Untuk mahasiswa dan dosen"
              : "For students and lecturers"}
          </h2>

          <div className="mt-6 grid gap-5 border-t border-border pt-6 sm:grid-cols-2">
            <div>
              <span className="mb-3 grid size-9 place-items-center rounded-lg bg-brand-soft text-brand">
                <UsersRound aria-hidden="true" size={18} strokeWidth={2} />
              </span>
              <h3 className="font-bold text-navy-deep">
                {isIndonesian ? "Untuk mahasiswa" : "For students"}
              </h3>
              <p className="mt-1 text-sm leading-6 text-muted">
                {isIndonesian
                  ? "Pahami alasan sebuah jawaban bisa salah, bukan hanya mana yang benar"
                  : "Understand why your answer can be wrong, not only which answer is correct"}
              </p>
            </div>

            <div>
              <span className="mb-3 grid size-9 place-items-center rounded-lg bg-brand-soft text-brand">
                <GraduationCap aria-hidden="true" size={18} strokeWidth={2} />
              </span>
              <h3 className="font-bold text-navy-deep">
                {isIndonesian ? "Untuk dosen" : "For lecturers"}
              </h3>
              <p className="mt-1 text-sm leading-6 text-muted">
                {isIndonesian
                  ? "Periksa label miskonsepsi dan jawaban anonim di Review"
                  : "Check misconception labels and anonymous answers in Review"}
              </p>
              <Link
                to={isLecturer ? "/review" : "/dosen/login"}
                className="mt-3 inline-flex text-sm font-semibold text-brand underline decoration-brand/35 underline-offset-4 transition hover:text-brand-deep hover:decoration-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                {isLecturer
                  ? isIndonesian
                    ? "Buka Review"
                    : "Open Review"
                  : isIndonesian
                    ? "Masuk sebagai dosen"
                    : "Lecturer sign in"}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="home-reveal relative mt-16 pb-2 lg:mt-20 lg:min-h-[24rem] lg:py-7">
        <div className="ml-auto overflow-hidden rounded-xl border border-border bg-white lg:h-[22rem] lg:w-[82%]">
          <img
            src="/home-start-material.webp"
            alt={
              isIndonesian
                ? "Materi pemrograman dan jalur menuju pemahaman konsep."
                : "Programming materials and a path toward understanding the concept."
            }
            width={1704}
            height={960}
            loading="lazy"
            className="aspect-[16/9] w-full object-cover lg:h-full lg:aspect-auto"
          />
        </div>

        <div className="relative z-10 mx-4 -mt-10 border border-border bg-white px-6 py-7 shadow-[0_20px_45px_rgba(43,38,36,0.12)] sm:mx-8 sm:px-8 lg:absolute lg:left-0 lg:top-1/2 lg:mx-0 lg:mt-0 lg:w-[43%] lg:-translate-y-1/2 lg:-rotate-1 lg:px-10 lg:py-9 lg:transition-transform lg:duration-300 lg:hover:rotate-0">
          <span aria-hidden="true" className="mb-6 block h-1.5 w-16 bg-brand" />
          <h2 className="max-w-xl text-balance text-3xl font-extrabold tracking-[-0.03em] text-navy-deep sm:text-4xl">
            {isIndonesian
              ? "Mulai dari materi yang sudah dikenal"
              : "Start with a topic you know"}
          </h2>
          <p className="mt-3 max-w-[50ch] text-pretty text-sm leading-6 text-muted">
            {isIndonesian
              ? "Pilih materi, buka satu soal, lalu lihat konsep dan miskonsepsi di balik jawabannya"
              : "Choose a topic, open a question, then see the concepts and misconceptions behind its answers"}
          </p>
          <Link
            to="/materi"
            className="mt-6 inline-flex min-h-11 w-fit items-center rounded-md bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-brand-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            {isIndonesian ? "Buka soal" : "Open questions"}
          </Link>
        </div>
      </section>
    </div>
  );
}
