import {
  BookOpen,
  BrainCircuit,
  ChevronDown,
  ClipboardCheck,
  Eye,
  History,
  LayoutDashboard,
  Lightbulb,
  LogOut,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useLanguage } from "../../hooks/useLanguage";
import { useLecturerAuth } from "../../hooks/useLecturerAuth";
import { cn } from "../../utils/cn";

type LecturerSidebarProps = {
  collapsed?: boolean;
  mobile?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  onNavigate?: () => void;
  onClose?: () => void;
};

type SidebarLinkProps = {
  active: boolean;
  collapsed: boolean;
  icon: LucideIcon;
  label: string;
  onNavigate?: () => void;
  to: string;
};

function SidebarLink({
  active,
  collapsed,
  icon: Icon,
  label,
  onNavigate,
  to,
}: SidebarLinkProps) {
  return (
    <Link
      to={to}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? label : undefined}
      title={collapsed ? label : undefined}
      className={cn(
        "lecturer-nav-item group",
        collapsed && "justify-center px-0",
        active
          ? "bg-brand-soft text-brand"
          : "text-muted hover:bg-neutral hover:text-navy-deep",
      )}
    >
      <Icon
        size={19}
        strokeWidth={1.9}
        aria-hidden="true"
        className="shrink-0"
      />
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
}

function ProfileMenu({
  collapsed,
  mobile,
  menuRef,
  onNavigate,
}: {
  collapsed: boolean;
  mobile: boolean;
  menuRef: RefObject<HTMLDetailsElement | null>;
  onNavigate?: () => void;
}) {
  const navigate = useNavigate();
  const { language, setLanguage } = useLanguage();
  const { profile, logout } = useLecturerAuth();
  const [logoutError, setLogoutError] = useState("");
  const isIndonesian = language === "id";
  const lecturerName =
    profile?.fullName.trim() || (isIndonesian ? "Dosen" : "Lecturer");

  const handleLogout = async () => {
    setLogoutError("");
    try {
      await logout();
      onNavigate?.();
      navigate("/", { replace: true });
    } catch (error) {
      console.error("[Progmiscon] Logout gagal", error);
      setLogoutError(
        isIndonesian
          ? "Logout belum berhasil. Silakan coba lagi."
          : "Logout was unsuccessful. Please try again.",
      );
    }
  };

  return (
    <details ref={menuRef} className="group relative">
      <summary
        aria-label={
          isIndonesian ? "Buka menu akun" : "Open account menu"
        }
        title={collapsed ? (isIndonesian ? "Akun" : "Account") : undefined}
        className={cn(
          "lecturer-profile-summary",
          collapsed && "justify-center px-0",
        )}
      >
        {collapsed ? (
          <MoreHorizontal
            size={19}
            strokeWidth={2}
            aria-hidden="true"
            className="text-muted"
          />
        ) : (
          <>
            <span className="min-w-0 flex-1 text-left">
              <span className="block truncate text-[13px] font-semibold leading-[18px] text-navy-deep">
                {lecturerName}
              </span>
              <span className="block text-xs font-normal leading-[18px] text-muted">
                {isIndonesian ? "Dosen" : "Lecturer"}
              </span>
            </span>
            <MoreHorizontal
              size={18}
              strokeWidth={2}
              aria-hidden="true"
              className="shrink-0 text-muted"
            />
          </>
        )}
      </summary>

      <div
        className={cn(
          "absolute bottom-[calc(100%+8px)] z-50 rounded-[10px] border border-border bg-white p-2 shadow-[0_16px_36px_rgba(55,44,39,0.14)]",
          collapsed && !mobile
            ? "left-[calc(100%+12px)] w-56"
            : "inset-x-0",
        )}
      >
        <p className="px-2 pb-1 pt-1 text-xs font-semibold leading-[18px] text-navy-deep">
          {isIndonesian ? "Bahasa" : "Language"}
        </p>
        <div className="grid grid-cols-2 gap-1" aria-label={isIndonesian ? "Pilih bahasa" : "Choose language"}>
          <button
            type="button"
            aria-pressed={language === "id"}
            onClick={() => setLanguage("id")}
            className={cn(
              "min-h-9 cursor-pointer rounded-lg px-2 text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand",
              language === "id"
                ? "bg-brand-soft text-brand"
                : "text-muted hover:bg-neutral hover:text-navy-deep",
            )}
          >
            Indonesia
          </button>
          <button
            type="button"
            aria-pressed={language === "en"}
            onClick={() => setLanguage("en")}
            className={cn(
              "min-h-9 cursor-pointer rounded-lg px-2 text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand",
              language === "en"
                ? "bg-brand-soft text-brand"
                : "text-muted hover:bg-neutral hover:text-navy-deep",
            )}
          >
            English
          </button>
        </div>

        <div className="my-2 border-t border-border" />
        <button
          type="button"
          onClick={() => void handleLogout()}
          className="flex min-h-10 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-left text-[13px] font-medium text-muted hover:bg-brand-soft hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand"
        >
          <LogOut size={17} strokeWidth={1.9} aria-hidden="true" />
          {isIndonesian ? "Logout" : "Logout"}
        </button>
        {logoutError && (
          <p role="alert" className="px-2 pb-1 pt-2 text-xs leading-[18px] text-incorrect">
            {logoutError}
          </p>
        )}
      </div>
    </details>
  );
}

export function LecturerSidebar({
  collapsed = false,
  mobile = false,
  onCollapsedChange,
  onNavigate,
  onClose,
}: LecturerSidebarProps) {
  const { language } = useLanguage();
  const location = useLocation();
  const isIndonesian = language === "id";
  const [query, setQuery] = useState("");
  const [bankOpen, setBankOpen] = useState(true);
  const [focusSearchWhenExpanded, setFocusSearchWhenExpanded] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const profileMenuRef = useRef<HTMLDetailsElement>(null);
  const effectiveCollapsed = mobile ? false : collapsed;
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const reviewTask = new URLSearchParams(location.search).get("task");

  const isDashboard = location.pathname === "/dashboard";
  const isQuestionCatalog =
    location.pathname === "/materi" ||
    location.pathname.startsWith("/question/");
  const isReviewHistory = location.pathname === "/review/riwayat";
  const isReview =
    !isReviewHistory &&
    (location.pathname === "/review" ||
      location.pathname.startsWith("/review/answer/"));
  const isConcept = location.pathname.startsWith("/konsep");
  const isMisconception = location.pathname.startsWith("/miskonsepsi");
  const isBankActive = isQuestionCatalog || isReview;

  const labels = useMemo(
    () => ({
      dashboard: isIndonesian ? "Dashboard" : "Dashboard",
      bank: isIndonesian ? "Bank Soal" : "Question Bank",
      questions: isIndonesian ? "Lihat Soal" : "View Questions",
      review: isIndonesian ? "Review Soal" : "Review Questions",
      concept: isIndonesian ? "Konsep" : "Concepts",
      misconception: isIndonesian ? "Miskonsepsi" : "Misconceptions",
      history: isIndonesian ? "Riwayat Review" : "Review History",
    }),
    [isIndonesian],
  );

  const matches = (label: string) =>
    !normalizedQuery || label.toLocaleLowerCase().includes(normalizedQuery);
  const showDashboard = matches(labels.dashboard);
  const bankLabelMatches = matches(labels.bank);
  const showQuestions = bankLabelMatches || matches(labels.questions);
  const showReview = bankLabelMatches || matches(labels.review);
  const showBank = bankLabelMatches || showQuestions || showReview;
  const showConcept = matches(labels.concept);
  const showMisconception = matches(labels.misconception);
  const showHistory = matches(labels.history);
  const hasResults =
    showDashboard || showBank || showConcept || showMisconception || showHistory;

  useEffect(() => {
    setBankOpen((current) => current || isBankActive);
    sidebarRef.current
      ?.querySelectorAll<HTMLDetailsElement>("details[open]")
      .forEach((details) => details.removeAttribute("open"));
  }, [isBankActive, location.pathname, location.search]);

  useEffect(() => {
    if (!effectiveCollapsed && focusSearchWhenExpanded) {
      searchRef.current?.focus();
      setFocusSearchWhenExpanded(false);
    }
  }, [effectiveCollapsed, focusSearchWhenExpanded]);

  const expandAndFocusSearch = () => {
    setFocusSearchWhenExpanded(true);
    onCollapsedChange?.(false);
  };

  return (
    <aside
      ref={sidebarRef}
      data-testid="lecturer-sidebar"
      aria-label={
        isIndonesian ? "Navigasi ruang kerja dosen" : "Lecturer workspace navigation"
      }
      className={cn(
        "lecturer-ui flex h-full min-h-0 flex-col bg-white transition-[width] duration-200 ease-out",
        mobile ? "w-72" : effectiveCollapsed ? "w-[72px]" : "w-52",
      )}
    >
      <div
        className={cn(
          "flex h-16 shrink-0 items-center",
          effectiveCollapsed
            ? "justify-center px-3"
            : mobile
              ? "gap-2 px-4"
              : "gap-2 px-3",
        )}
      >
        {!effectiveCollapsed && (
          <Link
            to="/dashboard"
            onClick={onNavigate}
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white">
              <img
                src="/progmiscon-logo.png"
                alt=""
                className="h-full w-full scale-[1.4] object-cover contrast-200"
              />
            </span>
            <span className="truncate text-[17px] font-semibold tracking-[-0.01em]">
              <span className="text-brand">Prog</span>
              <span className="text-navy-deep">miscon</span>
            </span>
          </Link>
        )}

        {mobile ? (
          <button
            type="button"
            onClick={onClose}
            aria-label={isIndonesian ? "Tutup navigasi" : "Close navigation"}
            className="ml-auto inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-muted hover:bg-neutral hover:text-navy-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <X size={19} strokeWidth={1.9} aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onCollapsedChange?.(!effectiveCollapsed)}
            aria-label={
              effectiveCollapsed
                ? isIndonesian
                  ? "Perluas sidebar"
                  : "Expand sidebar"
                : isIndonesian
                  ? "Perkecil sidebar"
                  : "Collapse sidebar"
            }
            title={
              effectiveCollapsed
                ? isIndonesian
                  ? "Perluas sidebar"
                  : "Expand sidebar"
                : isIndonesian
                  ? "Perkecil sidebar"
                  : "Collapse sidebar"
            }
            className={cn(
              "inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted hover:bg-neutral hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
              effectiveCollapsed && "mx-auto",
            )}
          >
            {effectiveCollapsed ? (
              <PanelLeftOpen size={19} strokeWidth={1.9} aria-hidden="true" />
            ) : (
              <PanelLeftClose size={19} strokeWidth={1.9} aria-hidden="true" />
            )}
          </button>
        )}
      </div>

      <div
        className={cn(
          "shrink-0 pb-3",
          effectiveCollapsed ? "px-3" : mobile ? "px-4" : "px-3",
        )}
      >
        {effectiveCollapsed ? (
          <button
            type="button"
            onClick={expandAndFocusSearch}
            aria-label={isIndonesian ? "Cari menu" : "Search menu"}
            title={isIndonesian ? "Cari menu" : "Search menu"}
            className="flex h-10 w-full cursor-pointer items-center justify-center rounded-lg border border-border text-muted hover:border-brand/25 hover:bg-neutral hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <Search size={18} strokeWidth={1.9} aria-hidden="true" />
          </button>
        ) : (
          <label className="relative block">
            <span className="sr-only">
              {isIndonesian ? "Cari menu navigasi" : "Search navigation menu"}
            </span>
            <Search
              size={17}
              strokeWidth={1.9}
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={isIndonesian ? "Cari menu..." : "Search menu..."}
              className="h-10 w-full rounded-lg border border-border bg-white py-2 pl-10 pr-3 text-[13px] font-normal text-navy-deep outline-none placeholder:text-muted/80 hover:border-brand/25 focus:border-brand focus:ring-2 focus:ring-brand/10"
            />
          </label>
        )}
      </div>

      <nav
        className={cn(
          "min-h-0 flex-1",
          effectiveCollapsed
            ? "overflow-visible px-3"
            : mobile
              ? "overflow-y-auto px-4"
              : "overflow-y-auto px-3",
        )}
      >
        <div className="space-y-1">
          {showDashboard && (
            <SidebarLink
              to="/dashboard"
              label={labels.dashboard}
              icon={LayoutDashboard}
              active={isDashboard}
              collapsed={effectiveCollapsed}
              onNavigate={onNavigate}
            />
          )}

          {showBank &&
            (effectiveCollapsed ? (
              <details className="group relative">
                <summary
                  aria-label={labels.bank}
                  title={labels.bank}
                  className={cn(
                    "lecturer-nav-item list-none justify-center px-0 [&::-webkit-details-marker]:hidden",
                    isBankActive
                      ? "bg-brand-soft text-brand"
                      : "text-muted hover:bg-neutral hover:text-navy-deep",
                  )}
                >
                  <BookOpen size={19} strokeWidth={1.9} aria-hidden="true" />
                </summary>
                <div className="absolute left-[calc(100%+12px)] top-0 z-50 w-48 rounded-[10px] border border-border bg-white p-2 shadow-[0_16px_36px_rgba(55,44,39,0.14)]">
                  <p className="px-2 pb-2 pt-1 text-xs font-semibold leading-[18px] text-navy-deep">
                    {labels.bank}
                  </p>
                  <div className="space-y-1">
                    <SidebarLink
                      to="/materi"
                      label={labels.questions}
                      icon={Eye}
                      active={isQuestionCatalog}
                      collapsed={false}
                      onNavigate={onNavigate}
                    />
                    <SidebarLink
                      to="/review?task=question"
                      label={labels.review}
                      icon={ClipboardCheck}
                      active={isReview && reviewTask !== "answer"}
                      collapsed={false}
                      onNavigate={onNavigate}
                    />
                  </div>
                </div>
              </details>
            ) : (
              <div>
                <button
                  type="button"
                  onClick={() => setBankOpen((current) => !current)}
                  aria-expanded={bankOpen || Boolean(normalizedQuery)}
                  className={cn(
                    "lecturer-nav-item w-full cursor-pointer",
                    isBankActive
                      ? "text-brand"
                      : "text-muted hover:bg-neutral hover:text-navy-deep",
                  )}
                >
                  <BookOpen size={19} strokeWidth={1.9} aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate text-left">
                    {labels.bank}
                  </span>
                  <ChevronDown
                    size={16}
                    strokeWidth={1.9}
                    aria-hidden="true"
                    className={cn(
                      "shrink-0 transition-transform",
                      (bankOpen || normalizedQuery) && "rotate-180",
                    )}
                  />
                </button>
                {(bankOpen || normalizedQuery) && (
                  <div className="mt-1 space-y-1 pl-6">
                    {showQuestions && (
                      <SidebarLink
                        to="/materi"
                        label={labels.questions}
                        icon={Eye}
                        active={isQuestionCatalog}
                        collapsed={false}
                        onNavigate={onNavigate}
                      />
                    )}
                    {showReview && (
                      <SidebarLink
                        to="/review?task=question"
                        label={labels.review}
                        icon={ClipboardCheck}
                        active={isReview && reviewTask !== "answer"}
                        collapsed={false}
                        onNavigate={onNavigate}
                      />
                    )}
                  </div>
                )}
              </div>
            ))}

          {showConcept && (
            <SidebarLink
              to="/konsep"
              label={labels.concept}
              icon={Lightbulb}
              active={isConcept}
              collapsed={effectiveCollapsed}
              onNavigate={onNavigate}
            />
          )}
          {showMisconception && (
            <SidebarLink
              to="/miskonsepsi"
              label={labels.misconception}
              icon={BrainCircuit}
              active={isMisconception}
              collapsed={effectiveCollapsed}
              onNavigate={onNavigate}
            />
          )}
          {showHistory && (
            <SidebarLink
              to="/review/riwayat"
              label={labels.history}
              icon={History}
              active={isReviewHistory}
              collapsed={effectiveCollapsed}
              onNavigate={onNavigate}
            />
          )}

          {!hasResults && !effectiveCollapsed && (
            <p className="px-3 py-4 text-center text-xs leading-[18px] text-muted">
              {isIndonesian ? "Menu tidak ditemukan." : "No menu found."}
            </p>
          )}
        </div>
      </nav>

      <div
        className={cn(
          "mt-auto shrink-0 border-t border-border py-3",
          effectiveCollapsed ? "px-3" : mobile ? "px-4" : "px-3",
        )}
      >
        <ProfileMenu
          collapsed={effectiveCollapsed}
          mobile={mobile}
          menuRef={profileMenuRef}
          onNavigate={onNavigate}
        />
      </div>
    </aside>
  );
}
