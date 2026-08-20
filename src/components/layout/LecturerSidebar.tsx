import {
  BookOpen,
  BrainCircuit,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  Check,
  Download,
  EllipsisVertical,
  Eye,
  FileQuestion,
  Globe2,
  History,
  Languages,
  LayoutDashboard,
  Lightbulb,
  LogOut,
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
import { formatLecturerSidebarName } from "../../utils/lecturerSidebar";

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
  subItem?: boolean;
  to: string;
};

function SidebarLink({
  active,
  collapsed,
  icon: Icon,
  label,
  onNavigate,
  subItem = false,
  to,
}: SidebarLinkProps) {
  return (
    <Link
      to={to}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? label : undefined}
      data-tooltip={collapsed ? label : undefined}
      className={cn(
        "lecturer-nav-item lecturer-tooltip group",
        subItem && "lecturer-nav-subitem",
        collapsed && "justify-center px-0",
        active && "lecturer-nav-item-active",
      )}
    >
      <Icon
        size={subItem ? 14 : 16}
        strokeWidth={1.9}
        aria-hidden="true"
        className="shrink-0"
      />
      {!collapsed && <span className="truncate whitespace-nowrap">{label}</span>}
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
  const settingsLabel = isIndonesian ? "Pengaturan" : "Settings";
  const lecturerName =
    formatLecturerSidebarName(profile?.fullName) ||
    (isIndonesian ? "Dosen" : "Lecturer");

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
    <div
      className={cn(
        "lecturer-profile-area",
        collapsed && "lecturer-profile-area-collapsed",
      )}
    >
      {!collapsed && (
        <div className="min-w-0 flex-1 overflow-hidden text-left">
          <span className="block truncate whitespace-nowrap text-xs font-medium leading-4 text-navy-deep">
            {lecturerName}
          </span>
          <span className="block text-[11px] font-normal leading-[14px] text-muted">
            {isIndonesian ? "Dosen" : "Lecturer"}
          </span>
        </div>
      )}

      <details ref={menuRef} className="group relative shrink-0">
        <summary
          aria-label={settingsLabel}
          data-tooltip={settingsLabel}
          className="lecturer-account-summary lecturer-tooltip"
        >
          <EllipsisVertical
            size={16}
            strokeWidth={2}
            aria-hidden="true"
          />
        </summary>

        <div
          className={cn(
            "lecturer-account-menu absolute bottom-[calc(100%+8px)] z-50 w-44 rounded-[10px] border border-border bg-[var(--progmiscon-background)] p-2 shadow-[0_12px_28px_rgba(55,44,39,0.08)]",
            collapsed && !mobile
              ? "left-[calc(100%+28px)]"
              : mobile
                ? "right-0"
                : "right-0",
          )}
        >
          <p className="lecturer-account-heading px-2 pb-1.5 pt-1 text-muted">
            {isIndonesian ? "PENGATURAN" : "SETTINGS"}
          </p>
          <div
            className="space-y-0.5"
            aria-label={isIndonesian ? "Pilih bahasa" : "Choose language"}
          >
            <button
              type="button"
              aria-pressed={language === "id"}
              onClick={() => setLanguage("id")}
              className={cn(
                "lecturer-account-row",
                language === "id" && "lecturer-account-row-active",
              )}
            >
              <Globe2 size={14} strokeWidth={1.9} aria-hidden="true" />
              <span className="min-w-0 flex-1">Bahasa Indonesia</span>
              {language === "id" && (
                <Check
                  size={12}
                  strokeWidth={2}
                  aria-hidden="true"
                  className="lecturer-language-check"
                />
              )}
            </button>
            <button
              type="button"
              aria-pressed={language === "en"}
              onClick={() => setLanguage("en")}
              className={cn(
                "lecturer-account-row",
                language === "en" && "lecturer-account-row-active",
              )}
            >
              <Languages size={14} strokeWidth={1.9} aria-hidden="true" />
              <span className="min-w-0 flex-1">English (US)</span>
              {language === "en" && (
                <Check
                  size={12}
                  strokeWidth={2}
                  aria-hidden="true"
                  className="lecturer-language-check"
                />
              )}
            </button>
          </div>

          <div className="my-1.5 border-t border-border" />
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="lecturer-account-row"
          >
            <LogOut size={14} strokeWidth={1.9} aria-hidden="true" />
            <span>{isIndonesian ? "Keluar" : "Log out"}</span>
          </button>
          {logoutError && (
            <p
              role="alert"
              className="px-2 pb-1 pt-2 text-xs leading-[18px] text-incorrect"
            >
              {logoutError}
            </p>
          )}
        </div>
      </details>
    </div>
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
  const { isAdmin } = useLecturerAuth();
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
  const isAdminQuestions = location.pathname === "/admin/questions";
  const isAdminReviews = location.pathname === "/admin/reviews";
  const isAdminExports = location.pathname === "/admin/exports";
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
      admin: "Admin",
      adminQuestions: isIndonesian ? "Kelola Soal" : "Manage Questions",
      adminReviews: isIndonesian ? "Hasil Review Dosen" : "Lecturer Review Results",
      adminExports: isIndonesian ? "Export Data" : "Export Data",
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
  const adminLabelMatches = matches(labels.admin);
  const showAdminQuestions = adminLabelMatches || matches(labels.adminQuestions);
  const showAdminReviews = adminLabelMatches || matches(labels.adminReviews);
  const showAdminExports = adminLabelMatches || matches(labels.adminExports);
  const showAdmin =
    isAdmin && (showAdminQuestions || showAdminReviews || showAdminExports);
  const hasResults =
    showDashboard ||
    showBank ||
    showConcept ||
    showMisconception ||
    showHistory ||
    showAdmin;
  const bankExpanded = bankOpen || Boolean(normalizedQuery);
  const searchLabel = isIndonesian ? "Pencarian" : "Search";
  const sidebarToggleLabel = effectiveCollapsed
    ? isIndonesian
      ? "Perluas menu"
      : "Expand menu"
    : isIndonesian
      ? "Ringkas menu"
      : "Collapse menu";

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
        "lecturer-ui lecturer-sidebar-surface lecturer-sidebar-width flex h-full min-h-0 flex-col border-r border-border",
        mobile ? "w-72" : effectiveCollapsed ? "w-[72px]" : "w-52",
      )}
    >
      <div
        className={cn(
          "flex h-16 shrink-0 items-center",
          effectiveCollapsed
            ? "justify-center px-3"
            : "px-4",
        )}
      >
        {!effectiveCollapsed && (
          <Link
            to="/dashboard"
            onClick={onNavigate}
            aria-label="Progmiscon"
            className="inline-flex h-9 w-10 shrink-0 items-center justify-center rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white">
              <img
                src="/progmiscon-logo.png"
                alt=""
                className="h-full w-full scale-[1.4] object-cover contrast-200"
              />
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
            aria-label={sidebarToggleLabel}
            data-tooltip={sidebarToggleLabel}
            className={cn(
              "lecturer-sidebar-control lecturer-tooltip inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted hover:bg-neutral hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
              effectiveCollapsed ? "mx-auto" : "ml-auto",
            )}
          >
            {effectiveCollapsed ? (
              <PanelLeftOpen size={17} strokeWidth={1.9} aria-hidden="true" />
            ) : (
              <PanelLeftClose size={17} strokeWidth={1.9} aria-hidden="true" />
            )}
          </button>
        )}
      </div>

      <div
        className={cn(
          "shrink-0 pb-3",
          effectiveCollapsed ? "px-3" : "px-4",
        )}
      >
        {effectiveCollapsed ? (
          <button
            type="button"
            onClick={expandAndFocusSearch}
            aria-label={searchLabel}
            data-tooltip={searchLabel}
            className="lecturer-sidebar-control lecturer-tooltip flex h-9 w-full cursor-pointer items-center justify-center rounded-lg border border-border text-muted hover:border-brand/25 hover:bg-neutral hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <Search size={16} strokeWidth={1.9} aria-hidden="true" />
          </button>
        ) : (
          <label className="lecturer-search-expanded relative block">
            <span className="sr-only">
              {isIndonesian ? "Cari menu navigasi" : "Search navigation menu"}
            </span>
            <Search
              size={15}
              strokeWidth={1.9}
              aria-hidden="true"
              className="lecturer-sidebar-search-icon pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={isIndonesian ? "Cari..." : "Search..."}
              className="lecturer-sidebar-search h-9 w-full rounded-lg border border-border bg-white py-2 pl-9 pr-3 text-xs font-normal leading-[18px] text-navy-deep outline-none placeholder:text-muted/80"
            />
          </label>
        )}
      </div>

      <nav
        className={cn(
          "min-h-0 flex-1",
          effectiveCollapsed
            ? "overflow-visible px-3"
            : "overflow-y-auto px-4",
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
                  data-tooltip={labels.bank}
                  className={cn(
                    "lecturer-nav-item lecturer-tooltip list-none justify-center px-0 [&::-webkit-details-marker]:hidden",
                    isBankActive && "lecturer-nav-item-active",
                  )}
                >
                  <BookOpen size={16} strokeWidth={1.9} aria-hidden="true" />
                </summary>
                <div className="lecturer-bank-flyout absolute left-[calc(100%+12px)] top-0 z-50 w-48 rounded-[10px] border border-border bg-white p-2 shadow-[0_16px_36px_rgba(55,44,39,0.14)]">
                  <p className="px-2 pb-2 pt-1 text-[13px] font-normal leading-[18px] text-navy-deep">
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
                      subItem
                    />
                    <SidebarLink
                      to="/review?task=question"
                      label={labels.review}
                      icon={ClipboardCheck}
                      active={isReview && reviewTask !== "answer"}
                      collapsed={false}
                      onNavigate={onNavigate}
                      subItem
                    />
                  </div>
                </div>
              </details>
            ) : (
              <div>
                <button
                  type="button"
                  onClick={() => setBankOpen((current) => !current)}
                  aria-expanded={bankExpanded}
                  className={cn(
                    "lecturer-nav-item w-full cursor-pointer",
                    isBankActive && "lecturer-nav-parent-current",
                  )}
                >
                  <BookOpen size={16} strokeWidth={1.9} aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate text-left">
                    {labels.bank}
                  </span>
                  <ChevronDown
                    size={16}
                    strokeWidth={1.9}
                    aria-hidden="true"
                    className={cn(
                      "lecturer-bank-chevron shrink-0",
                      bankExpanded && "rotate-180",
                    )}
                  />
                </button>
                <div
                  inert={!bankExpanded}
                  className={cn(
                    "lecturer-bank-submenu",
                    bankExpanded && "lecturer-bank-submenu-open",
                  )}
                >
                  <div className="min-h-0 overflow-hidden">
                    <div className="mt-1 space-y-1 pl-6">
                      {showQuestions && (
                        <SidebarLink
                          to="/materi"
                          label={labels.questions}
                          icon={Eye}
                          active={isQuestionCatalog}
                          collapsed={false}
                          onNavigate={onNavigate}
                          subItem
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
                          subItem
                        />
                      )}
                    </div>
                  </div>
                </div>
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

          {showAdmin && (
            <div className="mt-3 space-y-1 border-t border-border pt-3">
              {!effectiveCollapsed && (
                <p className="px-3 pb-1 text-[10px] uppercase tracking-[0.16em] text-muted">
                  {labels.admin}
                </p>
              )}
              {showAdminQuestions && (
                <SidebarLink
                  to="/admin/questions"
                  label={labels.adminQuestions}
                  icon={FileQuestion}
                  active={isAdminQuestions}
                  collapsed={effectiveCollapsed}
                  onNavigate={onNavigate}
                />
              )}
              {showAdminReviews && (
                <SidebarLink
                  to="/admin/reviews"
                  label={labels.adminReviews}
                  icon={ClipboardList}
                  active={isAdminReviews}
                  collapsed={effectiveCollapsed}
                  onNavigate={onNavigate}
                />
              )}
              {showAdminExports && (
                <SidebarLink
                  to="/admin/exports"
                  label={labels.adminExports}
                  icon={Download}
                  active={isAdminExports}
                  collapsed={effectiveCollapsed}
                  onNavigate={onNavigate}
                />
              )}
            </div>
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
          "mt-auto shrink-0 border-t border-border py-2",
          effectiveCollapsed ? "px-3" : "px-4",
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
