import { Globe, Menu, X } from "lucide-react";
import { useState } from "react";

interface StartupsHeaderProps {
  t: (key: string) => string;
  locale: "en" | "es";
  onLocaleToggle: () => void;
  onSignup: () => void;
}

const StartupsHeader = ({ t, locale, onLocaleToggle, onSignup }: StartupsHeaderProps) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const closeMenu = () => setIsMenuOpen(false);

  return (
    <header className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-5xl">
      <div className="nav-header px-6">
        <div className="flex items-center justify-between h-14">
          <a href="/" className="flex items-center gap-3">
            <span className="text-lg font-bold tracking-tight text-foreground">
              TODO.LAW<sup className="text-xs align-super">&trade;</sup>
            </span>
            <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 bg-accent/10 text-accent rounded-full text-xs font-medium uppercase tracking-wider font-body">
              {t("header.badge")}
            </span>
          </a>

          <div className="hidden md:flex items-center gap-3">
            <button
              onClick={onLocaleToggle}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Globe className="w-4 h-4" />
              {locale === "en" ? "ES" : "EN"}
            </button>
            <button onClick={onSignup} className="btn-primary text-sm py-2 px-4">
              {t("header.cta")}
            </button>
          </div>

          <button className="md:hidden p-2" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {isMenuOpen && (
          <div className="md:hidden py-4 px-2 border-t border-border">
            <div className="flex flex-col gap-3">
              <button
                onClick={() => { onLocaleToggle(); closeMenu(); }}
                className="flex items-center gap-2 text-sm text-muted-foreground px-2 py-1"
              >
                <Globe className="w-4 h-4" />
                {locale === "en" ? "Espa\u00f1ol" : "English"}
              </button>
              <button
                onClick={() => { onSignup(); closeMenu(); }}
                className="btn-primary text-sm py-2 px-4"
              >
                {t("header.cta")}
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default StartupsHeader;
