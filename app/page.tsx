import GlobalMediaUpdates from "@/components/GlobalMediaUpdates";
import Hero from "@/components/Hero";
import LatestInDepth from "@/components/LatestInDepth";
import MacroDataSidebarPanel from "@/components/MacroDataSidebarPanel";
import PolicyNewsAnalysisFeed from "@/components/PolicyNewsAnalysisFeed";

export default function Home() {
  return (
    <div className="min-h-screen bg-main text-slate-200">
      <Hero />

      <section className="relative z-10 bg-slate-50 pt-24 pb-16">
        <div className="mx-auto max-w-7xl px-4">
          <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <PolicyNewsAnalysisFeed />

              <div className="mt-8 border-t border-slate-100 pt-8">
                <LatestInDepth />
              </div>

              <div className="mt-8 border-t border-slate-100 pt-8">
                <GlobalMediaUpdates />
              </div>
            </div>

            <div className="lg:col-span-4">
              <MacroDataSidebarPanel />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
