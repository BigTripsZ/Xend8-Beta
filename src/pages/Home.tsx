import { useState, useEffect, useCallback, useRef } from "react";
import { trpc } from "@/providers/trpc";
import Header from "@/sections/Header";
import HomeSection from "@/sections/HomeSection";
import HowSection from "@/sections/HowSection";
import SmtpToolSection from "@/sections/SmtpToolSection";
import SettingsSection from "@/sections/SettingsSection";
import SocialBar from "@/sections/SocialBar";
import Footer from "@/sections/Footer";
import Toast from "@/components/Toast";

export type ViewId = "home" | "how" | "smtp-tool" | "settings";

export default function Home() {
  const [currentView, setCurrentView] = useState<ViewId>("home");
  const [prevView, setPrevView] = useState<ViewId | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "" });
  const contentRef = useRef<HTMLDivElement>(null);

  const configQuery = trpc.config.useQuery();
  const botStatusQuery = trpc.webhook.botStatus.useQuery(undefined, {
    refetchInterval: 30000,
    retry: false,
  });

  const isBotConnected = botStatusQuery.data?.connected ?? false;

  const showToast = useCallback((message: string) => {
    setToast({ show: true, message });
    setTimeout(() => setToast({ show: false, message: "" }), 2000);
  }, []);

  const showSection = useCallback(
    (id: ViewId) => {
      if (id === currentView || isAnimating) return;
      setIsAnimating(true);
      setPrevView(currentView);

      if (contentRef.current) {
        const current = contentRef.current.querySelector(".active-section") as HTMLElement;
        if (current) {
          current.style.opacity = "0";
          current.style.transform = "translateY(-10px)";
        }
      }

      setTimeout(() => {
        setCurrentView(id);
        setPrevView(null);
        window.scrollTo({ top: 0, behavior: "smooth" });
        setTimeout(() => {
          setIsAnimating(false);
        }, 350);
      }, 300);
    },
    [currentView, isAnimating]
  );

  const triggerSweep = useCallback((element: HTMLElement) => {
    element.classList.remove("sweep-active");
    void element.offsetWidth;
    element.classList.add("sweep-active");
    setTimeout(() => {
      element.classList.remove("sweep-active");
    }, 600);
  }, []);

  useEffect(() => {
    const attachListeners = () => {
      document.querySelectorAll(".sweep-hover").forEach((btn) => {
        const el = btn as HTMLElement;
        el.addEventListener("mouseenter", () => {
          triggerSweep(el);
        });
      });

      document.querySelectorAll(".sweep-card").forEach((card) => {
        const el = card as HTMLElement;
        el.addEventListener("mouseenter", () => {
          triggerSweep(el);
        });
        el.addEventListener("click", (e) => {
          const target = e.target as HTMLElement;
          if (
            target.tagName !== "BUTTON" &&
            target.tagName !== "A" &&
            !target.closest("button") &&
            !target.closest("a")
          ) {
            triggerSweep(el);
          }
        });
      });
    };

    const timer = setTimeout(attachListeners, 100);
    return () => clearTimeout(timer);
  }, [currentView, triggerSweep]);

  return (
    <div className="xend-container">
      <Header
        currentView={currentView}
        onNavigate={showSection}
        isBotConnected={isBotConnected}
        isChecking={botStatusQuery.isLoading}
      />

      <div className="content-wrapper" ref={contentRef}>
        <div
          className={`active-section ${currentView === "home" ? "block" : "hidden"}`}
          style={{
            opacity: currentView === "home" && !prevView ? 1 : undefined,
            transform: currentView === "home" && !prevView ? "translateY(0)" : undefined,
            transition: "opacity 0.3s ease, transform 0.3s ease",
          }}
        >
          {currentView === "home" && <HomeSection onNavigate={showSection} />}
        </div>

        <div
          className={`active-section ${currentView === "how" ? "block" : "hidden"}`}
          style={{
            transition: "opacity 0.3s ease, transform 0.3s ease",
          }}
        >
          {currentView === "how" && <HowSection />}
        </div>

        <div
          className={`active-section ${currentView === "smtp-tool" ? "block" : "hidden"}`}
          style={{
            transition: "opacity 0.3s ease, transform 0.3s ease",
          }}
        >
          {currentView === "smtp-tool" && <SmtpToolSection showToast={showToast} />}
        </div>

        <div
          className={`active-section ${currentView === "settings" ? "block" : "hidden"}`}
          style={{
            transition: "opacity 0.3s ease, transform 0.3s ease",
          }}
        >
          {currentView === "settings" && (
            <SettingsSection showToast={showToast} />
          )}
        </div>
      </div>

      <SocialBar
        socialX={configQuery.data?.socialX}
        socialGh={configQuery.data?.socialGh}
        socialTg={configQuery.data?.socialTg}
      />

      <Footer />

      <Toast show={toast.show} message={toast.message} />
    </div>
  );
}
