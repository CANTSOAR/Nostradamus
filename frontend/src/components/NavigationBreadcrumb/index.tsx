import { useMapStore } from "../../store/useMapStore";
import type { ViewLevel } from "../../types/navigation";

interface Crumb {
  label: string;
  level: ViewLevel;
}

const sep = (
  <span style={{ color: "#334155", margin: "0 6px", userSelect: "none" }}>›</span>
);

export function NavigationBreadcrumb() {
  const {
    viewLevel,
    selectedCountyName,
    selectedCountyFips,
    selectedTractId,
    navigateToState,
    navigateToCounty,
    navigateToTract,
  } = useMapStore();

  const crumbs: Crumb[] = [{ label: "New Jersey", level: "state" }];

  if (viewLevel !== "state" && selectedCountyFips) {
    crumbs.push({
      label: selectedCountyName ? `${selectedCountyName} County` : `County ${selectedCountyFips}`,
      level: "county",
    });
  }

  if ((viewLevel === "tract" || viewLevel === "building") && selectedTractId) {
    crumbs.push({ label: `Tract ${selectedTractId}`, level: "tract" });
  }

  if (viewLevel === "building") {
    crumbs.push({ label: "Building", level: "building" });
  }

  const handleClick = (crumb: Crumb) => {
    if (crumb.level === "state") {
      navigateToState();
    } else if (crumb.level === "county" && selectedCountyFips && selectedCountyName) {
      navigateToCounty(selectedCountyFips, selectedCountyName);
    } else if (crumb.level === "tract" && selectedTractId) {
      navigateToTract(selectedTractId);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 2,
        fontSize: 12,
        fontFamily: "'Inter', 'SF Pro Display', system-ui, sans-serif",
      }}
    >
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <span key={crumb.level} style={{ display: "flex", alignItems: "center" }}>
            {i > 0 && sep}
            <button
              onClick={() => !isLast && handleClick(crumb)}
              style={{
                background: "none",
                border: "none",
                padding: "2px 4px",
                borderRadius: 4,
                cursor: isLast ? "default" : "pointer",
                color: isLast ? "#94d2bd" : "#64748b",
                fontWeight: isLast ? 700 : 400,
                fontSize: 12,
                fontFamily: "inherit",
                transition: "color 0.15s",
              }}
              onMouseEnter={(e) => {
                if (!isLast) (e.currentTarget as HTMLButtonElement).style.color = "#cbd5e1";
              }}
              onMouseLeave={(e) => {
                if (!isLast) (e.currentTarget as HTMLButtonElement).style.color = "#64748b";
              }}
              disabled={isLast}
              aria-current={isLast ? "page" : undefined}
            >
              {crumb.label}
            </button>
          </span>
        );
      })}
    </div>
  );
}
