// 2026-01-07 - working with filters
// create sep sections for: country/search filter ; selectionTags ; indicator msg ; pagination bar ; padding (hide on mobile)
// only sections are truly collapsable in height
// For card display: use repeater and connect to CMS

import wixData from "wix-data";

let currentPage = 1;
const pageSize = 40;

let currentFilter = {
  country: null,
  region: [],
  name: "",
};

let currentFilteredTotal = 0;

$w.onReady(async () => {
  // Initial load
  await loadPage(currentPage);

  // Hide AFTER everything loads, with double requestAnimationFrame
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      hideSelectionTags();
      $w("#selectionTags1").hide();
      $w("#selectionTags1").collapse();
      $w("#section2").collapse();
    });
  });

  // ---------------- EVENTS ----------------
  $w("#dropdown1").onChange(() => {
    currentPage = 1;
    applyCountryFilter();
  });

  let selectedRegion = null; // tracks the currently active region

  $w("#selectionTags1").onChange(() => {
    const currentValue = $w("#selectionTags1").value; // current selected tags array

    if (currentValue.length === 0) {
      // user deselected everything
      selectedRegion = null;
    } else if (currentValue.length === 1) {
      // only one tag selected
      selectedRegion = currentValue[0];
    } else if (currentValue.length > 1) {
      // user clicked a new tag, more than 1 selection
      const newTag = currentValue.find((tag) => tag !== selectedRegion);

      if (newTag === selectedRegion) {
        // same tag clicked again → deselect
        selectedRegion = null;
      } else {
        // new tag clicked → switch selection
        selectedRegion = newTag;
      }
    }

    // Update selectionTags programmatically to enforce only one selected
    $w("#selectionTags1").value = selectedRegion ? [selectedRegion] : [];

    // Update filter
    currentFilter.region = selectedRegion ? [selectedRegion] : [];
    currentPage = 1;

    // Reload repeater & pagination
    loadPage(currentPage);
  });

  $w("#input1").onInput(() => {
    currentPage = 1;
    const value = $w("#input1").value.trim();

    currentFilter.name = value;
    currentFilter.country = null;
    currentFilter.region = [];
    $w("#dropdown1").value = "RESET_ALL";
    hideSelectionTags();

    loadPage(currentPage);
  });

  // ---------------- SYNCED PAGINATION BARS ----------------
  function onPaginationChange(bar) {
    return async () => {
      const clickedPage = bar.currentPage || 1; // store the clicked page

      // Load page using clicked value
      await loadPage(clickedPage);

      // Sync both bars
      $w("#pagination1").currentPage = currentPage;
      $w("#pagination2").currentPage = currentPage;

      if (bar.id === "pagination2") $w("#repeater1").scrollTo();
    };
  }

  $w("#pagination1").onChange(onPaginationChange($w("#pagination1")));
  $w("#pagination2").onChange(onPaginationChange($w("#pagination2")));
});

// ---------------- FILTER HELPERS ----------------
function applyCountryFilter() {
  const country = $w("#dropdown1").value;
  $w("#input1").value = "";
  hideSelectionTags();

  currentFilter.country = country && country !== "RESET_ALL" ? country : null;
  currentFilter.region = [];
  currentFilter.name = "";

  loadPage(currentPage).then(() => updateRegions());
}

// ---------------- REGION ----------------
async function updateRegions() {
  if (!currentFilter.country) {
    hideSelectionTags();
    return;
  }

  try {
    const result = await wixData
      .query("Import1")
      .eq("country", currentFilter.country)
      .find();

    const regions = [
      ...new Set(result.items.flatMap((i) => i.region || [])),
    ].sort();

    if (!regions.length) {
      hideSelectionTags();
      return;
    }

    showSelectionTags(regions.map((r) => ({ label: r, value: r })));
  } catch {
    hideSelectionTags();
  }
}

// ---------------- PAGINATION ----------------
function updatePaginationBar(totalPages) {
  if (totalPages <= 1) {
    $w("#pagination1").collapse();
    $w("#pagination2").collapse();
    $w("#section5").collapse(); // Hide the entire pagination section
  } else {
    $w("#pagination1").expand();
    $w("#pagination2").expand();
    $w("#section5").expand(); // Show the entire pagination section

    $w("#pagination1").totalPages = totalPages;
    $w("#pagination2").totalPages = totalPages;

    $w("#pagination1").currentPage = currentPage;
    $w("#pagination2").currentPage = currentPage;
  }
}

// ---------------- PAGE LOAD ----------------

async function loadPage(pageNumber) {
  let query = wixData.query("Import1");
  if (currentFilter.country) query = query.eq("country", currentFilter.country);
  if (currentFilter.region.length)
    query = query.hasSome("region", currentFilter.region);
  if (currentFilter.name) query = query.contains("name", currentFilter.name);

  // Only count when filters change
  if (pageNumber === 1) {
    currentFilteredTotal = await query.count();
  }

  const totalPages = Math.ceil(currentFilteredTotal / pageSize) || 1;
  currentPage = Math.min(Math.max(pageNumber, 1), totalPages);

  const skip = (currentPage - 1) * pageSize;
  const result = await query.skip(skip).limit(pageSize).find();
  $w("#repeater1").data = result.items;

  updatePaginationBar(totalPages); // pass totalPages to avoid extra count
  updatePractitionerIndicator(currentFilteredTotal, result.items.length);
}

// ---------------- INDICATOR ----------------
function updatePractitionerIndicator(totalFiltered, visibleCount) {
  if (visibleCount === 0) {
    $w("#text157").text = `No practitioners found`;
    return;
  }

  // Build the location part
  let locationPart = "";
  if (
    currentFilter.country ||
    (currentFilter.region && currentFilter.region.length)
  ) {
    const regionPart = currentFilter.region.length
      ? `${currentFilter.region.join(", ")}, `
      : "";
    const countryPart = currentFilter.country ? currentFilter.country : "";
    locationPart = ` in ${regionPart}${countryPart}`;
  }

  let message = "";

  if (totalFiltered <= pageSize) {
    // Not paginated, just show total
    message = `${totalFiltered} practitioner${
      totalFiltered > 1 ? "s" : ""
    } found${locationPart}`;
  } else {
    // Paginated, show current range
    const startIndex = (currentPage - 1) * pageSize + 1;
    const endIndex = startIndex + visibleCount - 1;
    message = `Showing ${startIndex}-${endIndex} of ${totalFiltered} practitioner${
      totalFiltered > 1 ? "s" : ""
    } found${locationPart}`;
  }

  // If search term is active, append that info
  if (currentFilter.name) {
    message += ` matching search`;
  }

  $w("#text157").text = message;
}

// ---------------- UI ----------------
function hideSelectionTags() {
  $w("#selectionTags1").value = [];
  $w("#selectionTags1").options = [];
  $w("#selectionTags1").hide();
  $w("#selectionTags1").collapse();

  // Hide the entire section
  $w("#section2").collapse();
}

function showSelectionTags(options) {
  $w("#selectionTags1").options = options;
  $w("#selectionTags1").value = [];

  // Show the entire section first
  $w("#section2").expand();

  // Then show the tags
  $w("#selectionTags1").expand();
  $w("#selectionTags1").show();
}
