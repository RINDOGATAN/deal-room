interface StartupsFooterProps {
  t: (key: string) => string;
}

const StartupsFooter = ({ t }: StartupsFooterProps) => {
  return (
    <footer className="py-12 border-t border-border">
      <div className="container px-6">
        <div className="flex flex-col items-center gap-6">
          <a href="https://todo.law" className="flex items-center gap-2">
            <span className="text-lg font-bold tracking-tight text-foreground">
              TODO.LAW<sup className="text-xs align-super">&trade;</sup>
            </span>
            <span className="text-xs text-muted-foreground font-body">
              {t("footer.tagline")}
            </span>
          </a>

          <nav className="flex items-center gap-6">
            <a
              href="https://todo.law/privacy"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {t("footer.privacy")}
            </a>
            <a
              href="https://todo.law/terms"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {t("footer.terms")}
            </a>
            <a
              href="https://todo.law"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {t("footer.forLawFirms")} &rarr;
            </a>
          </nav>

          <p className="text-xs text-muted-foreground">
            <a
              href="https://creativecommons.org/licenses/by-nd/4.0/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              CC BY-ND 4.0
            </a>
            {" "}
            <a
              href="https://rindogatan.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              Rindogatan AB
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
};

export default StartupsFooter;
