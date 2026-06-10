document.addEventListener("DOMContentLoaded", () => {
  // --- State Variables ---
  let selectedFeature = null;
  let activeMetric = "currentPrice"; // currentPrice, redevScore, jobProx, transitScore, futureOutlook
  let housingType = "apartment"; // apartment, villa
  let geojsonLayer = null;
  let trendChartInstance = null;
  let radarChartInstance = null;
  let viewMode = "dong"; // dong, complex
  let selectedComplex = null;

  // Weights for custom calculator
  let weightRedev = 4;
  let weightJob = 3;
  let weightTransit = 3;

  // --- Map Tile Management ---
  let tileLayerInstance = null;

  function updateTileLayer() {
    if (tileLayerInstance) {
      map.removeLayer(tileLayerInstance);
    }
    
    // 전달받은 키를 기본 폴백값으로 지정
    const savedKey = localStorage.getItem("vworld_key") || "FDA920C2-5B69-3522-A251-E3CBBE74444F";
    
    if (savedKey.trim() !== "") {
      // V-World WMTS API 지도 타일 연동
      tileLayerInstance = L.tileLayer("https://api.vworld.kr/req/wmts/1.0.0/" + savedKey + "/Base/{z}/{y}/{x}.png", {
        attribution: '&copy; <a href="https://www.vworld.kr/">VWorld</a> / 국토교통부',
        maxZoom: 19
      }).addTo(map);
    } else {
      // 기본 다크 테마 GIS 타일 연동
      tileLayerInstance = L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
      }).addTo(map);
    }
  }

  // --- Map Initialization ---
  const map = L.map("map", {
    zoomControl: false,
    minZoom: 11,
    maxZoom: 15
  }).setView([37.412, 127.128], 12);

  // Add zoom control at bottom right
  L.control.zoom({ position: "bottomright" }).addTo(map);

  // Layer group for complex markers
  const complexLayerGroup = L.layerGroup().addTo(map);

  // 타일 레이어 첫 로드
  updateTileLayer();

  // --- Color Palette Helpers ---
  // Returns color based on selected metric and value
  function getColor(val, metric) {
    if (metric === "currentPrice") {
      // Scale based on billion KRW (억 원)
      // For villas, scale is lowered by 50%
      const limit = housingType === "apartment" ? 1.0 : 0.5;
      const v = val / limit;
      return v > 20 ? "#4f46e5" : // Deep Indigo
             v > 16 ? "#6366f1" : // Indigo
             v > 12 ? "#06b6d4" : // Cyan
             v > 9  ? "#14b8a6" : // Teal
                      "#0d9488";  // Dark Teal
    } else {
      // Score base scale (0 - 100)
      return val > 90 ? "#fbbf24" : // Amber/Gold
             val > 80 ? "#f59e0b" : // Orange
             val > 70 ? "#06b6d4" : // Cyan
             val > 50 ? "#14b8a6" : // Teal
                        "#115e59"; // Dark Green/Teal
    }
  }

  // Define Legend scales
  const legends = {
    currentPrice: {
      title: "평균 매매가 (억 원)",
      ranges: [
        { label: "20억 초과", color: "#4f46e5", villaLabel: "10억 초과" },
        { label: "16억 ~ 20억", color: "#6366f1", villaLabel: "8억 ~ 10억" },
        { label: "12억 ~ 16억", color: "#06b6d4", villaLabel: "6억 ~ 8억" },
        { label: "9억 ~ 12억", color: "#14b8a6", villaLabel: "4.5억 ~ 6억" },
        { label: "9억 이하", color: "#0d9488", villaLabel: "4.5억 이하" }
      ]
    },
    redevScore: {
      title: "재건축/재개발 지수 (점)",
      ranges: [
        { label: "90점 이상 (매우 높음)", color: "#fbbf24" },
        { label: "80 ~ 89점 (높음)", color: "#f59e0b" },
        { label: "70 ~ 79점 (보통)", color: "#06b6d4" },
        { label: "50 ~ 69점 (기초 추진)", color: "#14b8a6" },
        { label: "50점 미만 (신축 단지)", color: "#115e59" }
      ]
    },
    jobProx: {
      title: "직주근접 편의성 (점)",
      ranges: [
        { label: "90점 이상 (도보/근접)", color: "#fbbf24" },
        { label: "80 ~ 89점 (지하철 1~2정거장)", color: "#f59e0b" },
        { label: "70 ~ 79점 (버스로 환승)", color: "#06b6d4" },
        { label: "50 ~ 69점 (보통)", color: "#14b8a6" },
        { label: "50점 미만 (상대적 원거리)", color: "#115e59" }
      ]
    },
    transitScore: {
      title: "교통 인프라 점수 (점)",
      ranges: [
        { label: "90점 이상 (초역세권/환승역)", color: "#fbbf24" },
        { label: "80 ~ 89점 (일반 역세권)", color: "#f59e0b" },
        { label: "70 ~ 79점 (비역세권/버스연계)", color: "#06b6d4" },
        { label: "50 ~ 69점 (보통)", color: "#14b8a6" },
        { label: "50점 미만 (교통 취약)", color: "#115e59" }
      ]
    },
    futureOutlook: {
      title: "미래 종합 전망 지표 (점)",
      ranges: [
        { label: "90점 이상 (최유망)", color: "#fbbf24" },
        { label: "80 ~ 89점 (우수)", color: "#f59e0b" },
        { label: "70 ~ 79점 (안정)", color: "#06b6d4" },
        { label: "50 ~ 69점 (보통)", color: "#14b8a6" },
        { label: "50점 미만 (보수적 접근)", color: "#115e59" }
      ]
    }
  };

  // --- Render Legend ---
  function updateLegend() {
    const legendContainer = document.getElementById("legend-container");
    const currentLegend = legends[activeMetric];
    
    let html = `<div style="font-size: 0.7rem; font-weight: bold; margin-bottom: 2px; color: var(--text-primary);">${currentLegend.title}</div>`;
    html += `<div style="display: flex; gap: 8px; flex-wrap: wrap;">`;
    
    currentLegend.ranges.forEach(range => {
      const labelText = (activeMetric === "currentPrice" && housingType === "villa") ? range.villaLabel : range.label;
      html += `
        <div class="legend-item">
          <span class="legend-color" style="background-color: ${range.color};"></span>
          <span>${labelText}</span>
        </div>
      `;
    });
    html += `</div>`;
    legendContainer.innerHTML = html;
  }

  // --- Feature Styling & Interaction Logic ---
  // Get property value based on housing type
  function getFeatureValue(properties, metric) {
    if (metric === "currentPrice") {
      let baseVal = properties.metrics.currentPrice;
      // Villas are about 50% cheaper
      if (housingType === "villa") {
        baseVal = baseVal * 0.45;
      }
      return baseVal;
    }
    
    // Adjust redevelopment score for villas (villa areas have higher redev potential in old districts)
    if (metric === "redevScore" && housingType === "villa") {
      if (properties.gu !== "분당구") {
        return Math.min(100, properties.metrics.redevScore + 10);
      }
    }
    
    return properties.metrics[metric];
  }

  // Set style for a GeoJSON feature
  function styleFeature(feature) {
    const value = getFeatureValue(feature.properties, activeMetric);
    const fillColor = getColor(value, activeMetric);
    
    // Highlight if selected
    const isSelected = selectedFeature && selectedFeature.properties.name === feature.properties.name;
    const isComplexMode = viewMode === "complex";
    
    return {
      fillColor: fillColor,
      weight: isSelected ? (isComplexMode ? 1.5 : 3) : 1,
      opacity: isComplexMode ? 0.2 : 1,
      color: isSelected ? (isComplexMode ? "rgba(255, 255, 255, 0.4)" : "var(--primary)") : "rgba(255, 255, 255, 0.25)",
      fillOpacity: isComplexMode ? 0.04 : (isSelected ? 0.75 : 0.5),
      dashArray: isSelected ? "" : "3"
    };
  }

  // Custom tooltips on hover
  function onEachFeature(feature, layer) {
    layer.on({
      mouseover: (e) => {
        const layer = e.target;
        layer.setStyle({
          fillOpacity: 0.7,
          weight: selectedFeature && selectedFeature.properties.name === feature.properties.name ? 3 : 2,
          color: selectedFeature && selectedFeature.properties.name === feature.properties.name ? "var(--primary)" : "#ffffff"
        });
        
        if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
          layer.bringToFront();
        }

        // Show quick custom tooltip
        const val = getFeatureValue(feature.properties, activeMetric);
        const unit = activeMetric === "currentPrice" ? "억 원" : "점";
        const content = `
          <div class="custom-map-popup">
            <h4>${feature.properties.name}</h4>
            <p>${feature.properties.gu}</p>
            <div class="popup-stat">
              <span>${legends[activeMetric].title.split(" (")[0]}:</span>
              <span>${val.toFixed(1)}${unit}</span>
            </div>
          </div>
        `;
        layer.bindTooltip(content, { sticky: true, className: "glass-panel" }).openTooltip();
      },
      mouseout: (e) => {
        geojsonLayer.resetStyle(e.target);
      },
      click: (e) => {
        selectDong(feature);
        
        // Fly map focus
        const bounds = e.target.getBounds();
        map.flyToBounds(bounds, { padding: [50, 50], duration: 0.8 });
      }
    });
  }

  // Select a Dong and update layout info
  function selectDong(feature) {
    selectedFeature = feature;
    
    // Update active highlight style on map
    geojsonLayer.eachLayer(layer => {
      geojsonLayer.resetStyle(layer);
    });

    // Update selection info cards
    const props = feature.properties;
    document.getElementById("selected-gu").innerText = props.gu;
    document.getElementById("selected-dong-name").innerText = props.name;
    document.getElementById("selected-dong-desc").innerText = props.description;

    // Update Future Outlook score meter
    const outlookVal = getFeatureValue(props, "futureOutlook");
    document.getElementById("outlook-score-num").innerText = `${Math.round(outlookVal)}점`;
    document.getElementById("outlook-score-bar").style.width = `${outlookVal}%`;

    // Refresh charts
    updateCharts(props);
  }

  // Get complex value based on housing type and metric
  function getComplexValue(complex, metric) {
    if (metric === "currentPrice") {
      let baseVal = complex.metrics.currentPrice;
      if (housingType === "villa") {
        baseVal = baseVal * 0.45;
      }
      return baseVal;
    }
    return complex.metrics[metric];
  }

  // Select a Complex and update layout info
  function selectComplex(complex) {
    selectedComplex = complex;
    
    // Re-render markers to update selected highlight state
    renderComplexMarkers();

    // Update selection info cards
    document.getElementById("selected-gu").innerText = complex.gu;
    document.getElementById("selected-dong-name").innerText = complex.name;
    document.getElementById("selected-dong-desc").innerText = complex.description;

    // Update Future Outlook score meter
    const outlookVal = getComplexValue(complex, "futureOutlook");
    document.getElementById("outlook-score-num").innerText = `${Math.round(outlookVal)}점`;
    document.getElementById("outlook-score-bar").style.width = `${outlookVal}%`;

    // Refresh charts
    updateCharts(complex);
  }

  // Render the detailed complex markers on map
  function renderComplexMarkers() {
    // Clear existing markers first
    complexLayerGroup.clearLayers();

    if (viewMode !== "complex") return;

    // Filter complexes by selected Gu
    const guFilter = document.getElementById("gu-filter").value;
    const filteredComplexes = seongnamApartmentData.filter(c => {
      if (guFilter === "all") return true;
      return c.gu === guFilter;
    });

    filteredComplexes.forEach(c => {
      const value = getComplexValue(c, activeMetric);
      const color = getColor(value, activeMetric);
      
      const isSelected = selectedComplex && selectedComplex.name === c.name;

      // Custom marker icon HTML (sleek pulsing effect)
      const markerHtml = `
        <div class="custom-marker-container ${isSelected ? 'selected' : ''}" style="color: ${color};">
          <div class="marker-pulse" style="background-color: ${color};"></div>
          <div class="marker-dot" style="background-color: ${color};"></div>
        </div>
      `;

      const customIcon = L.divIcon({
        html: markerHtml,
        className: '', // Clear default styling
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      const marker = L.marker(c.coords, { icon: customIcon });

      // Add detailed custom tooltip
      const unit = activeMetric === "currentPrice" ? "억 원" : "점";
      const content = `
        <div class="custom-map-popup">
          <h4>${c.name}</h4>
          <p>${c.dong} · ${c.gu}</p>
          <div class="popup-stat">
            <span>${legends[activeMetric].title.split(" (")[0]}:</span>
            <span>${value.toFixed(1)}${unit}</span>
          </div>
        </div>
      `;
      marker.bindTooltip(content, { sticky: true, className: "glass-panel" });

      // Map click handler
      marker.on("click", () => {
        selectComplex(c);
      });

      complexLayerGroup.addLayer(marker);
    });
  }

  // Render the GeoJSON layer on map
  function renderGeoJSON() {
    if (geojsonLayer) {
      map.removeLayer(geojsonLayer);
    }

    // Filter features by selected Gu
    const guFilter = document.getElementById("gu-filter").value;
    const filteredFeatures = seongnamGeoJSON.features.filter(f => {
      if (guFilter === "all") return true;
      return f.properties.gu === guFilter;
    });

    const filteredGeoJSON = {
      type: "FeatureCollection",
      features: filteredFeatures
    };

    geojsonLayer = L.geoJSON(filteredGeoJSON, {
      style: styleFeature,
      onEachFeature: onEachFeature
    }).addTo(map);

    // Zoom/pan map to fit filtered features
    if (filteredFeatures.length > 0) {
      const bounds = geojsonLayer.getBounds();
      map.fitBounds(bounds, { padding: [30, 30] });
    }

    // Re-render complex markers
    renderComplexMarkers();

    // Auto-select based on View Mode
    if (viewMode === "complex") {
      const filteredComplexes = seongnamApartmentData.filter(c => {
        if (guFilter === "all") return true;
        return c.gu === guFilter;
      });
      const complexExists = filteredComplexes.some(c => selectedComplex && c.name === selectedComplex.name);
      if (!complexExists && filteredComplexes.length > 0) {
        selectComplex(filteredComplexes[0]);
      } else if (selectedComplex) {
        const updated = filteredComplexes.find(c => c.name === selectedComplex.name);
        if (updated) selectComplex(updated);
      }
    } else {
      // Auto-select first matching neighborhood if none selected or if selected one is filtered out
      const stillExists = filteredFeatures.some(f => selectedFeature && f.properties.name === selectedFeature.properties.name);
      if (!stillExists && filteredFeatures.length > 0) {
        selectDong(filteredFeatures[0]);
      } else if (selectedFeature) {
        // Find the updated feature to refresh data
        const updated = filteredFeatures.find(f => f.properties.name === selectedFeature.properties.name);
        if (updated) selectDong(updated);
      }
    }
  }

  // --- Chart.js Setup & Redraw Logic ---
  function updateCharts(properties) {
    const years = ["2016", "2017", "2018", "2019", "2020", "2021", "2022", "2023", "2024", "2025", "2026"];
    
    // Calculate prices based on housing type
    const multiplier = housingType === "apartment" ? 1.0 : 0.45;
    const priceData = years.map(y => (properties.prices[y] * multiplier).toFixed(2));

    // 1. Trend Chart (Line Chart)
    if (trendChartInstance) {
      trendChartInstance.destroy();
    }

    const ctxTrend = document.getElementById("trendChart").getContext("2d");
    
    // Gradient fill for sleek graph effect
    const trendGradient = ctxTrend.createLinearGradient(0, 0, 0, 150);
    trendGradient.addColorStop(0, "rgba(20, 184, 166, 0.4)");
    trendGradient.addColorStop(1, "rgba(20, 184, 166, 0.0)");

    trendChartInstance = new Chart(ctxTrend, {
      type: "line",
      data: {
        labels: years.map(y => `${y}년`),
        datasets: [{
          label: `${properties.name} 시세`,
          data: priceData,
          borderColor: "#14b8a6",
          borderWidth: 3,
          pointBackgroundColor: "#06b6d4",
          pointBorderColor: "#ffffff",
          pointHoverRadius: 6,
          fill: true,
          backgroundColor: trendGradient,
          tension: 0.3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: {
            grid: { color: "rgba(255, 255, 255, 0.05)" },
            ticks: { color: "#9ca3af", font: { size: 9 } }
          },
          y: {
            grid: { color: "rgba(255, 255, 255, 0.05)" },
            ticks: { color: "#9ca3af", font: { size: 9 } }
          }
        }
      }
    });

    // 2. Radar Chart for land scores
    if (radarChartInstance) {
      radarChartInstance.destroy();
    }

    // Get specific scores
    const redevScore = getFeatureValue(properties, "redevScore");
    const jobProx = getFeatureValue(properties, "jobProx");
    const transitScore = getFeatureValue(properties, "transitScore");
    const futureOutlook = getFeatureValue(properties, "futureOutlook");
    // Calculate simulated value rating (100 - relative price index) to make a 5-dimension grid
    const maxAptPrice = 23.0;
    const valueRating = Math.max(20, 100 - (properties.metrics.currentPrice / maxAptPrice * 60));

    const ctxRadar = document.getElementById("radarChart").getContext("2d");
    
    radarChartInstance = new Chart(ctxRadar, {
      type: "radar",
      data: {
        labels: ["재건축/재개발", "직주근접성", "교통 편의도", "미래 성장성", "시세대비 가치"],
        datasets: [{
          label: properties.name,
          data: [redevScore, jobProx, transitScore, futureOutlook, valueRating],
          backgroundColor: "rgba(6, 182, 212, 0.2)",
          borderColor: "#06b6d4",
          borderWidth: 2,
          pointBackgroundColor: "#fbbf24",
          pointBorderColor: "#ffffff",
          pointHoverRadius: 5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          r: {
            angleLines: { color: "rgba(255, 255, 255, 0.1)" },
            grid: { color: "rgba(255, 255, 255, 0.08)" },
            pointLabels: { color: "#9ca3af", font: { size: 9, weight: "bold" } },
            ticks: { display: false },
            min: 0,
            max: 100
          }
        }
      }
    });
  }

  // --- Interaction Listeners ---

  // View Mode Selector (Dong vs Complex)
  const viewModeRadios = document.querySelectorAll('input[name="view-mode"]');
  viewModeRadios.forEach(radio => {
    radio.addEventListener("change", (e) => {
      viewMode = e.target.value;
      
      // Update top stats header text labels
      updateTopStats();

      if (viewMode === "dong") {
        complexLayerGroup.clearLayers();
        selectedComplex = null;
        
        // Restore Dong selection display
        if (selectedFeature) {
          selectDong(selectedFeature);
        }
      } else {
        // Auto-select first complex in the filtered list
        const guFilter = document.getElementById("gu-filter").value;
        const filteredComplexes = seongnamApartmentData.filter(c => {
          if (guFilter === "all") return true;
          return c.gu === guFilter;
        });
        if (filteredComplexes.length > 0) {
          selectComplex(filteredComplexes[0]);
        }
      }
      
      // Update geojson polygon opacity
      geojsonLayer.eachLayer(layer => {
        geojsonLayer.resetStyle(layer);
      });

      // Render complex markers
      renderComplexMarkers();
      updateLegend();
    });
  });

  // Gu Filter Change
  document.getElementById("gu-filter").addEventListener("change", () => {
    renderGeoJSON();
    updateTopStats();
  });

  // Metric Buttons Navigation
  const metricBtns = document.querySelectorAll(".metric-btn");
  metricBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      metricBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      
      activeMetric = btn.dataset.metric;
      
      // Update map title
      document.getElementById("current-layer-title").innerText = `성남시 공간 매칭 맵 : ${btn.querySelector('span').innerText}`;
      
      // Update layer info boxes
      updateLayerInfoBox(activeMetric);

      // Re-style map & legend
      geojsonLayer.eachLayer(layer => {
        geojsonLayer.resetStyle(layer);
      });
      
      // Re-render complex markers (change colors)
      renderComplexMarkers();
      
      updateLegend();

      // Refresh charts
      if (viewMode === "complex" && selectedComplex) {
        selectComplex(selectedComplex);
      } else if (selectedFeature) {
        selectDong(selectedFeature);
      }
    });
  });

  // Housing Type Radio Selector
  const radioInputs = document.querySelectorAll('input[name="housing-type"]');
  radioInputs.forEach(input => {
    input.addEventListener("change", (e) => {
      housingType = e.target.value;
      
      // Re-calculate top values based on housing types for headers
      updateTopStats();

      // Refresh geojson styling
      geojsonLayer.eachLayer(layer => {
        geojsonLayer.resetStyle(layer);
      });
      
      // Re-render complex markers
      renderComplexMarkers();
      
      updateLegend();

      if (viewMode === "complex" && selectedComplex) {
        selectComplex(selectedComplex);
      } else if (selectedFeature) {
        selectDong(selectedFeature);
      }
    });
  });

  // Update descriptions for metric layer info box
  function updateLayerInfoBox(metric) {
    const titleEl = document.getElementById("info-title");
    const descEl = document.getElementById("info-desc");
    
    switch (metric) {
      case "currentPrice":
        titleEl.innerText = "평균 매매 시세";
        descEl.innerText = "전용면적 84㎡(국민평형 34평) 아파트 기준 최근 실거래가 평균 기준입니다. 분당구 판교 신도시 일대와 정자동, 위례신도시 등이 높은 시세를 형성하고 있습니다.";
        break;
      case "redevScore":
        titleEl.innerText = "재건축/재개발 지수";
        descEl.innerText = "아파트 준공 연식(노후도), 대지지분 비율 및 안전진단 단계 등을 반영한 정비사업 기대 가치입니다. 분당 1기 신도시(서현, 정자, 수내 등) 및 수정/중원구 노후 단지가 높은 점수를 받았습니다.";
        break;
      case "jobProx":
        titleEl.innerText = "직주근접 편의성";
        descEl.innerText = "판교테크노밸리, 야탑동 업무 단지 및 강남역(강남권역)까지 대중교통 또는 도보로 얼마나 빠르게 이동할 수 있는지를 지표화한 것입니다.";
        break;
      case "transitScore":
        titleEl.innerText = "교통 인프라 점수";
        descEl.innerText = "신분당선, 수인분당선, 8호선, 경강선 전철역과의 도보 거리 및 주요 버스 환승 노선의 다양성을 종합하여 도출한 대중교통 인프라 지표입니다.";
        break;
      case "futureOutlook":
        titleEl.innerText = "미래 종합 전망치";
        descEl.innerText = "재개발/재건축 추진 속도, 교통 호재(GTX-A 성남역 개통, 위례삼동선 등), 직업 분포성 및 연차를 조합하여 가중 평균한 종합적 3개년 투자 매력도입니다.";
        break;
    }
  }

  // --- Dynamic Stats Highlights for Header ---
  function updateTopStats() {
    let topPriceName = "";
    let topPriceVal = 0;
    let maxRiseName = "";
    let maxRiseVal = 0;
    let topOutlookName = "";
    let topOutlookVal = 0;

    const cards = document.querySelectorAll(".top-stats .stat-card");
    if (cards.length >= 3) {
      if (viewMode === "complex") {
        cards[0].querySelector(".stat-label").innerHTML = '<i class="fa-solid fa-crown text-gold"></i> 최고 시세 단지';
        cards[1].querySelector(".stat-label").innerHTML = '<i class="fa-solid fa-chart-line text-cyan"></i> 10개년 최대 상승 단지';
        cards[2].querySelector(".stat-label").innerHTML = '<i class="fa-solid fa-bolt text-amber"></i> 미래 전망 1순위 단지';

        seongnamApartmentData.forEach(c => {
          const currentPrice = getComplexValue(c, "currentPrice");
          const outlook = getComplexValue(c, "futureOutlook");
          
          // Calculate growth from 2016 to 2026
          const price2016 = c.prices["2016"] * (housingType === "apartment" ? 1.0 : 0.45);
          const risePercent = ((currentPrice - price2016) / price2016) * 100;

          if (currentPrice > topPriceVal) {
            topPriceVal = currentPrice;
            topPriceName = c.name;
          }
          if (risePercent > maxRiseVal) {
            maxRiseVal = risePercent;
            maxRiseName = c.name;
          }
          if (outlook > topOutlookVal) {
            topOutlookVal = outlook;
            topOutlookName = c.name;
          }
        });
      } else {
        cards[0].querySelector(".stat-label").innerHTML = '<i class="fa-solid fa-crown text-gold"></i> 최고 시세 지역';
        cards[1].querySelector(".stat-label").innerHTML = '<i class="fa-solid fa-chart-line text-cyan"></i> 10개년 최대 상승';
        cards[2].querySelector(".stat-label").innerHTML = '<i class="fa-solid fa-bolt text-amber"></i> 미래 전망 1순위';

        seongnamGeoJSON.features.forEach(f => {
          const p = f.properties;
          const currentPrice = getFeatureValue(p, "currentPrice");
          const outlook = getFeatureValue(p, "futureOutlook");
          
          // Calculate growth from 2016 to 2026
          const price2016 = p.prices["2016"] * (housingType === "apartment" ? 1.0 : 0.45);
          const risePercent = ((currentPrice - price2016) / price2016) * 100;

          if (currentPrice > topPriceVal) {
            topPriceVal = currentPrice;
            topPriceName = p.name.split(" ")[0];
          }
          if (risePercent > maxRiseVal) {
            maxRiseVal = risePercent;
            maxRiseName = p.name.split(" ")[0];
          }
          if (outlook > topOutlookVal) {
            topOutlookVal = outlook;
            topOutlookName = p.name.split(" ")[0];
          }
        });
      }
    }

    document.getElementById("top-price-dong").innerText = `${topPriceName} (${topPriceVal.toFixed(1)}억)`;
    document.getElementById("top-rise-dong").innerText = `${maxRiseName} (+${Math.round(maxRiseVal)}%)`;
    document.getElementById("top-outlook-dong").innerText = `${topOutlookName} (${Math.round(topOutlookVal)}점)`;
  }

  // --- Weight Slider Calculations ---
  const sliderRedev = document.getElementById("weight-redev");
  const sliderJob = document.getElementById("weight-job");
  const sliderTransit = document.getElementById("weight-transit");

  function updateSliderLabels() {
    weightRedev = parseInt(sliderRedev.value);
    weightJob = parseInt(sliderJob.value);
    weightTransit = parseInt(sliderTransit.value);
    
    const sum = weightRedev + weightJob + weightTransit;
    if (sum === 0) return; // Avoid divide by zero

    document.getElementById("val-redev").innerText = `${Math.round(weightRedev / sum * 100)}%`;
    document.getElementById("val-job").innerText = `${Math.round(weightJob / sum * 100)}%`;
    document.getElementById("val-transit").innerText = `${Math.round(weightTransit / sum * 100)}%`;
  }

  sliderRedev.addEventListener("input", updateSliderLabels);
  sliderJob.addEventListener("input", updateSliderLabels);
  sliderTransit.addEventListener("input", updateSliderLabels);

  document.getElementById("apply-weights-btn").addEventListener("click", () => {
    const sum = weightRedev + weightJob + weightTransit;
    if (sum === 0) {
      alert("적어도 하나의 가중치는 0보다 커야 합니다.");
      return;
    }

    // Re-calculate futureOutlook for all features
    seongnamGeoJSON.features.forEach(f => {
      const p = f.properties;
      const redev = p.metrics.redevScore;
      const job = p.metrics.jobProx;
      const transit = p.metrics.transitScore;
      
      const customScore = (redev * weightRedev + job * weightJob + transit * weightTransit) / sum;
      
      // Update property values (cap at 100)
      p.metrics.futureOutlook = Math.min(100, Math.max(0, customScore));
    });

    // Re-calculate futureOutlook for all complexes
    seongnamApartmentData.forEach(c => {
      const redev = c.metrics.redevScore;
      const job = c.metrics.jobProx;
      const transit = c.metrics.transitScore;
      
      const customScore = (redev * weightRedev + job * weightJob + transit * weightTransit) / sum;
      
      c.metrics.futureOutlook = Math.min(100, Math.max(0, customScore));
    });

    // Notify user of update
    alert("나만의 맞춤 가중치 조합이 반영되었습니다! 미래 종합 전망 지표 레이어 및 수치가 업데이트됩니다.");

    // Trigger Future Outlook view
    const outlookBtn = document.querySelector('[data-metric="futureOutlook"]');
    if (outlookBtn) {
      outlookBtn.click();
    } else {
      geojsonLayer.eachLayer(layer => {
        geojsonLayer.resetStyle(layer);
      });
      renderComplexMarkers();
      
      if (viewMode === "complex" && selectedComplex) {
        selectComplex(selectedComplex);
      } else if (selectedFeature) {
        selectDong(selectedFeature);
      }
    }
    
    updateTopStats();
  });

  // --- Initial Bootstrapping ---
  // 브이월드 API 키 자동 로드 및 입력 감지 리스너 설정
  const keyInput = document.getElementById("vworld-key");
  if (keyInput) {
    const defaultKey = "FDA920C2-5B69-3522-A251-E3CBBE74444F";
    // 로컬 저장소에 키가 없는 경우 기본 키로 사전 등록
    if (!localStorage.getItem("vworld_key")) {
      localStorage.setItem("vworld_key", defaultKey);
    }
    
    keyInput.value = localStorage.getItem("vworld_key");
    keyInput.addEventListener("input", (e) => {
      const key = e.target.value.trim();
      localStorage.setItem("vworld_key", key);
      updateTileLayer();
    });
  }

  updateSliderLabels();
  updateTopStats();
  renderGeoJSON();
  updateLegend();
});
