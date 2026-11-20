import Hero from "./components/Hero";
import StatsPanel from "./components/StatsPanel";
import ActivityFeed from "./components/ActivityFeed";
import MintPanels from "./components/MintPanels";
import MyNFTs from "./components/MyNFTs";
import Gallery from "./components/Gallery";
import AdminPanel from "./components/AdminPanel";
import PromptCenter from "./components/PromptCenter";
import Footer from "./components/Footer";
import WalletButton from "./components/WalletButton";
import NetworkBanner from "./components/NetworkBanner";
import { CONTRACT_DEPLOYED } from "./config/contract";

function Wordmark() {
  return (
    <a href="#top" className="flex items-center gap-2">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-antique-gold/50 bg-aurum-gold/10 font-display text-lg font-bold text-aurum-gold">
        ◆
      </span>
      <span className="font-display text-xl font-bold uppercase tracking-tight">
        <span className="text-aurum-gold">Aurum</span>{" "}
        <span className="text-bone">Agents</span>
      </span>
    </a>
  );
}

export default function App() {
  return (
    <div id="top" className="min-h-screen bg-aurum-black font-body text-bone">
      <header className="sticky top-0 z-40 border-b border-white/5 bg-aurum-black/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3.5 sm:px-8">
          <Wordmark />
          <nav aria-label="Primary" className="hidden items-center gap-6 text-sm font-medium md:flex">
            <a className="text-bone/80 hover:text-aurum-gold" href="#stats">Status</a>
            <a className="text-bone/80 hover:text-aurum-gold" href="#activity">Activity</a>
            <a className="text-bone/80 hover:text-aurum-gold" href="#mint">Mint</a>
            <a className="text-bone/80 hover:text-aurum-gold" href="#my-nfts">My NFTs</a>
            <a className="text-bone/80 hover:text-aurum-gold" href="#gallery">Gallery</a>
            <a className="text-bone/80 hover:text-aurum-gold" href="#admin">Admin</a>
            <a className="text-bone/80 hover:text-aurum-gold" href="#prompts">Agent prompts</a>
          </nav>
          <div className="flex items-center gap-3">
            {CONTRACT_DEPLOYED ? (
              <span className="hidden rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest text-emerald-200 sm:inline-block">
                ◆ Live on BSC Mainnet
              </span>
            ) : (
              <span className="hidden rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest text-amber-200 sm:inline-block">
                Contract not deployed
              </span>
            )}
            <WalletButton />
          </div>
        </div>
      </header>
      <NetworkBanner />

      <main>
        <Hero />
        <StatsPanel />
        <ActivityFeed />
        <MintPanels />
        <MyNFTs />
        <Gallery />
        <AdminPanel />
        <PromptCenter />
      </main>

      <Footer />
    </div>
  );
}
