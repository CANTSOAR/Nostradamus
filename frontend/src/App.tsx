import { useMapStore } from "./store/useMapStore";
import { CesiumMap } from "./components/CesiumMap";
import { TractSidebar } from "./components/TractSidebar";
import { LayerControl } from "./components/LayerControl";
import { Legend } from "./components/Legend";
import { NavigationBreadcrumb } from "./components/NavigationBreadcrumb";
import { VisualModeSelector } from "./components/VisualModeSelector";
import { ViewSelector } from "./components/ViewSelector";
import { FlightInfoPanel } from "./components/FlightInfoPanel";
import { MunicipalitySidebar } from "./components/MunicipalitySidebar";
import { BusinessInfoPanel } from "./components/BusinessInfoPanel";
import { BusinessListPanel } from "./components/BusinessListPanel";
import { BusinessesInFrame } from "./components/BusinessesInFrame";
import { SkyModeSelector } from "./components/SkyModeSelector";
import { WeatherHUD } from "./components/WeatherHUD";
import { SearchBar } from "./components/SearchBar";
import { BuildingSidebar } from "./components/BuildingSidebar";
import { useSimulation } from "./hooks/useSimulation";

const panelStyle: React.CSSProperties = {
  background: "rgba(15,20,30,0.85)",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.08)",
  color: "#e2e8f0",
  fontFamily: "'Inter', 'SF Pro Display', system-ui, sans-serif",
};

export default function App() {
  const { activeVariable, viewLevel, selectedTractId, trackedFlightData, selectedMunicipalityProps, selectedBusiness } = useMapStore();

  // Initialize simulation hook
  useSimulation();


  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative", background: "#020408" }}>
      {/* Globe fills entire viewport */}
      <CesiumMap />
      <WeatherHUD />

      {/* Top-center: search bar */}
      <div style={{
        position: "absolute", top: 16,
        left: "50%", transform: "translateX(-50%)",
        zIndex: 400,
      }}>
        <SearchBar />
      </div>

      {/* Business list overlay */}
      <BusinessListPanel />

      {/* Businesses in camera view HUD */}
      <BusinessesInFrame />

      {/* Panoptic HUD Overlays removed */}

      {/* Top-left: title + breadcrumb */}
      <div
        style={{
          ...panelStyle,
          position: "absolute",
          top: 16,
          left: 16,
          padding: "10px 18px",
          maxWidth: 420,
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "0.05em", color: "#94d2bd" }}>
          NOSTRADAMUS
        </div>
        <div style={{ fontSize: 11, color: "#64748b", marginTop: 2, marginBottom: 8 }}>
          NJ Economic Atlas · ACS 2023 · BLS QCEW 2023
        </div>
        <NavigationBreadcrumb />
      </div>

      {/* Flight info panel — shown when a flight is tracked */}
      {trackedFlightData && (
        <div
          style={{
            ...panelStyle,
            position: "absolute",
            top: 130,
            left: 16,
            padding: "14px 16px",
            width: 250,
          }}
        >
          <FlightInfoPanel />
        </div>
      )}


      {/* Municipality info panel — shown when a municipality is clicked */}
      {selectedMunicipalityProps && (
        <div
          style={{
            ...panelStyle,
            position: "absolute",
            top: trackedFlightData ? 260 : 130,
            left: 16,
            padding: "14px 16px",
            width: 280,
            maxHeight: "calc(100vh - 200px)",
            overflowY: "auto",
          }}
        >
          <MunicipalitySidebar />
        </div>
      )}

      {/* Business info panel — shown when a business pin is clicked */}
      {selectedBusiness && (
        <div
          style={{
            ...panelStyle,
            position: "absolute",
            top: trackedFlightData ? 260 : (selectedMunicipalityProps ? 320 : 130),
            left: 16,
            padding: "14px 16px",
            width: 260,
          }}
        >
          <BusinessInfoPanel />
        </div>
      )}

      {/* Top-right: layer control */}
      <div
        style={{
          ...panelStyle,
          position: "absolute",
          top: 16,
          right: 16,
          padding: "12px 16px",
          minWidth: 160,
          display: "flex",
          flexDirection: "column",
          gap: 16,
          maxHeight: "calc(100vh - 120px)",
          overflowY: "auto",
        }}
      >
        <LayerControl />
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 12 }}>
          <ViewSelector />
        </div>
      </div>

      {/* Bottom-left: legend */}
      <div
        style={{
          ...panelStyle,
          position: "absolute",
          bottom: 24,
          left: 16,
          padding: "12px 16px",
          minWidth: 200,
        }}
      >
        <Legend activeVariable={activeVariable} />
      </div>

      <div
        style={{
          ...panelStyle,
          position: "absolute",
          bottom: 24,
          right: 16,
          padding: "12px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <SkyModeSelector />
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 12 }}>
          <VisualModeSelector />
        </div>
      </div>

      {/* Right panel — level-specific content */}
      {
        viewLevel === "building" && (
          <div
            style={{
              ...panelStyle,
              position: "absolute",
              top: 80,
              right: 16,
              padding: "16px",
              width: 260,
            }}
          >
            <BuildingSidebar />
          </div>
        )
      }

      {
        (viewLevel === "tract") && selectedTractId && (
          <div
            style={{
              ...panelStyle,
              position: "absolute",
              top: 80,
              right: 16,
              padding: "16px",
              width: 260,
            }}
          >
            <TractSidebar geoid={selectedTractId} />
          </div>
        )
      }
    </div >
  );
}

