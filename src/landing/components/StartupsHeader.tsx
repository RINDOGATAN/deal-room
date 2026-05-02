import { Globe, Menu, X } from "lucide-react";
import { useState } from "react";
import { brand } from "@/config/brand";

interface StartupsHeaderProps {
  t: (key: string) => string;
  locale: "en" | "es";
  onLocaleToggle: () => void;
  onSignup: () => void;
}

// TODO uses an SVG wordmark; NEL ships a PNG. Render whichever the
// active brand actually has, with the right alt text. brand.links.website
// is the company's marketing home, not the dealroom subdomain.
const isNelBrand = brand.id === "northend";
const headerLogoSrc = isNelBrand ? brand.assets.logo : "/logo-negative.svg";

const StartupsHeader = ({ t, locale, onLocaleToggle, onSignup }: StartupsHeaderProps) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const closeMenu = () => setIsMenuOpen(false);

  return (
    <header className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-5xl">
      <div className="nav-header px-6">
        <div className="flex items-center justify-between h-14">
          <a href={brand.links.website} className="flex items-center gap-3">
            <img src={headerLogoSrc} alt={brand.company} style={{ height: "28px", width: "auto" }} />
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
