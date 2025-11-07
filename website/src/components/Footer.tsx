export const Footer = () => {
  return (
    <footer className="border-t mt-auto">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
          <p>© 2025 Trustless Agent Protocol. Built on Solana by Amiko.</p>
          <div className="flex gap-6">
            <a 
              href="https://github.com/HCF-S/amiko-x402" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="hover:text-foreground transition-colors"
            >
              GitHub
            </a>
            <a 
              href="https://docs.solana.com" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="hover:text-foreground transition-colors"
            >
              Solana Docs
            </a>
            <a 
              href="https://heyamiko.com" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="hover:text-foreground transition-colors"
            >
              Amiko
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};
