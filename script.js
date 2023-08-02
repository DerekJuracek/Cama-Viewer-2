require([
  "esri/WebMap",
  "esri/views/MapView",
  "esri/widgets/LayerList",
  "esri/widgets/Slider",
  "esri/widgets/BasemapLayerList",
  "esri/widgets/Expand",
  "esri/widgets/Legend",
  "esri/widgets/Search",
  "esri/widgets/Home",
  "esri/widgets/DistanceMeasurement2D",
  "esri/widgets/AreaMeasurement2D",
  "esri/layers/FeatureLayer",
  "esri/core/reactiveUtils",
], function (
  WebMap,
  MapView,
  LayerList,
  Slider,
  BasemapLayerList,
  Expand,
  Legend,
  Search,
  Home,
  DistanceMeasurement2D,
  AreaMeasurement2D,
  FeatureLayer,
  reactiveUtils
) {
  const urlParams = new URLSearchParams(window.location.search);
  const configUrl = urlParams.get("viewer") || "cama/North_Haven.json";

  fetch(configUrl)
    .then((response) => response.json())
    .then((config) => {
      const layers = config.layers;
      const configWebMapId =
        config.webmapId || "54a2ab42be274473af199afc614fdf78";
      // use the webMapPortalId in your app as needed

      const webmap = new WebMap({
        portalItem: {
          id: configWebMapId,
        },
      });

      // variables read from json config files

      const headerPanel = document.getElementById("header-title");
      const headerBackGroundColor = config.cssHeaderBackground;
      headerPanel.style.backgroundColor = headerBackGroundColor;

      const viewBackgroundColor = config.cssViewBackground;

      const layerFilterBackgroundColor = config.cssLayerFilterColor;
      const layerFilterTextColor = config.cssLayerFilterTextColor;

      const layerDiv = document.getElementsByClassName("layerDiv1");
      layerDiv[0].style.backgroundColor = layerFilterBackgroundColor;
      layerDiv[1].style.backgroundColor = layerFilterBackgroundColor;

      layerDiv[0].style.color = layerFilterTextColor;
      layerDiv[1].style.color = layerFilterTextColor;

      const image = config.image;
      const Title = config.title;

      const basemapTitle = config.basemapTitle;

      // logic to create div, calcite icon, and append to filterList div

      // const filterDiv = document.createElement("div");
      const filterButton = document.createElement("calcite-icon");
      filterButton.setAttribute("icon", "reset");
      filterButton.setAttribute("id", "resetFilters");

      // filterButton.setAttribute("theme", "dark");
      filterButton.style.cursor = "pointer";
      filterButton.style.marginLeft = "200px";
      filterButton.style.marginTop = "2px";
      // filterDiv.appendChild(filterButton);

      const filterList = document.getElementById("filterDiv");
      filterList.appendChild(filterButton);

      const view = new MapView({
        container: "viewDiv",
        map: webmap,
        padding: {
          left: 300,
        },
      });

      // Helper function to parse URL query parameters
      function getQueryParams() {
        const queryParams = {};
        const queryString = window.location.search.substring(1);
        const pairs = queryString.split("&");

        for (let i = 0; i < pairs.length; i++) {
          const pair = pairs[i].split("=");
          queryParams[decodeURIComponent(pair[0])] = decodeURIComponent(
            pair[1]
          );
        }
        return queryParams;
      }

      // Function to query and zoom to the feature from url parameter
      // Format is query=Feature Layer Name,Field,Feature
      // i.e. query=Parcel Boundaries,UniqueId,100
      async function queryAndZoom(layerName, fieldName, fieldValue) {
        const layer = view.map.allLayers.find(
          (layer) => layer.title === layerName
        );

        if (layer) {
          const query = layer.createQuery();
          query.where = `${fieldName} = '${fieldValue}'`;

          const results = await layer.queryFeatures(query);

          if (results.features.length > 0) {
            const feature = results.features[0];
            view.goTo(feature);
          }
        }
      }

      view.when().then(() => {
        const queryParams = getQueryParams();

        if (queryParams.query) {
          const [layerName, fieldName, fieldValue] =
            queryParams.query.split(",");
          queryAndZoom(layerName, fieldName, fieldValue);
        }
      });

      view.when().then(() => {
        let originalRenderer;

        view.map.allLayers.forEach((layer) => {
          if (layer.title === "Parcel Boundaries") {
            originalRenderer = layer.renderer;
          }
        });

        reactiveUtils.watch(
          () => [view.map.basemap.baseLayers.map((layer) => layer.visible)],
          () => {
            const orthoLayersVisible = isAnyOrthoLayerVisible(
              view.map.basemap.baseLayers
            );
            manageBasemapVisibility(view.map.basemap.baseLayers);

            view.map.allLayers.forEach((layer) => {
              if (layer.title === "Parcel Boundaries") {
                layer.renderer = orthoLayersVisible
                  ? {
                      type: "simple",
                      symbol: {
                        type: "simple-fill",
                        color: [255, 255, 255, 0.1],
                        outline: {
                          width: 1,
                          color: [5, 252, 207],
                        },
                      },
                    }
                  : originalRenderer;
              }
            });
          }
        );
      });

      function isAnyOrthoLayerVisible(baseLayers) {
        const orthoLayerTitles = ["Ortho 2012", "Ortho 2016", "Ortho 2019"];

        return baseLayers.some((layer) => {
          return layer.visible && orthoLayerTitles.includes(layer.title);
        });
      }
      function manageBasemapVisibility(baseLayers) {
        const orthoLayerTitles = [
          "Ortho 2012",
          "Ortho 2016",
          "Ortho 2019",
          `${basemapTitle}`,
        ];

        // Filter out the layers that we're interested in
        let basemapLayers = baseLayers.filter((layer) =>
          orthoLayerTitles.includes(layer.title)
        );

        // Find the newly visible layer
        let newlyVisibleLayer = basemapLayers.find(
          (layer) => layer.visible && !layer.wasVisible
        );

        // If a newly visible layer is found, turn off all other layers
        if (newlyVisibleLayer) {
          basemapLayers.forEach((layer) => {
            if (layer !== newlyVisibleLayer) {
              layer.visible = false;
            }
          });
        }

        // Update wasVisible property
        basemapLayers.forEach((layer) => {
          layer.wasVisible = layer.visible;
        });
      }

      view.when(() => {
        const layerList = new LayerList({
          view,
          // listItemCreatedFunction: defineActions,
          container: "layers-container",
          listItemCreatedFunction: async function (event) {
            const item = event.item;
            await item.layer.when();

            // If the layer is "Centerline", hide it and return
            if (item.layer.title === "Centerline") {
              item.layer.listMode = "hide";
              item.actionsSections = [];
              item.panel = {
                content: null,
                open: false,
                visible: false,
              };
              return; // Skip the rest of this function if we're hiding this layer
            }

            // Otherwise, setup the slider functionality
            if (item.children.length < 1) {
              const opacityDiv = document.createElement("div");
              opacityDiv.innerHTML = "<p>Layer Opacity (%)</p>";
              opacityDiv.id = "opacityDiv";

              const labelDiv = document.createElement("div");
              labelDiv.innerHTML = "<p>Label Opacity (%)</p>";
              labelDiv.id = "labelDiv";

              const opacitySlider = new Slider({
                container: opacityDiv,
                min: 0,
                max: 1,
                values: [0.75],
                precision: 2,
                visibleElements: {
                  labels: true,
                  rangeLabels: true,
                },
              });

              const labelSlider = new Slider({
                container: labelDiv,
                min: 0,
                max: 1,
                values: [1],
                precision: 2,
                visibleElements: {
                  labels: true,
                  rangeLabels: true,
                },
              });

              item.panel = {
                content: [opacityDiv, labelDiv],
                className: "esri-icon-sliders-horizontal",
                title: "Change layer settings",
                label: "Change layer settings",
              };

              opacitySlider.on("thumb-drag", (event) => {
                const { value } = event;
                item.layer.opacity = value;
              });

              labelSlider.on("thumb-drag", (event) => {
                const { value } = event;
                if (item.layer.labelingInfo) {
                  item.layer.labelingInfo = item.layer.labelingInfo.map(
                    (labelClass) => {
                      const newLabelClass = labelClass.clone();
                      newLabelClass.symbol.color.a = value;
                      newLabelClass.symbol.haloColor.a = value;
                      return newLabelClass;
                    }
                  );
                }
              });
            }
          },
        });
      });

      // collapsible side bar functionality
      view.when(() => {
        const togglePanelBtn = document.getElementById("toggle-panel-btn");
        const topbar = document.getElementById("topbar");
        const panelContent = document.getElementById("panel-content");
        const sidebar = document.getElementById("sidebar");

        togglePanelBtn.addEventListener("click", () => {
          togglePanelBtn.classList.toggle("rotated");
          panelContent.classList.toggle("collapsed");

          if (panelContent.classList.contains("collapsed")) {
            sidebar.style.width = "0px";
            view.padding = { left: 0 };
          } else {
            sidebar.style.width = "300px";
            view.padding = { left: 300 };
          }
        });
      });

      view.ui.move("zoom", "top-left");

      const basemaps = new BasemapLayerList({
        view,
        basemapTitle: "Basemaps",
        expandIconClass: "esri-icon-layer-list",
      });

      basemaps.visibleElements = {
        statusIndicators: true,
        baseLayers: true,
        referenceLayers: false,
        referenceLayersTitle: false,
        errors: true,
      };

      const basemapExpand = new Expand({
        view: view,
        content: basemaps,
        group: "top-right",
        index: 0,
        expandIconClass: "esri-icon-basemap",
      });

      const legend = new Legend({
        view: view,
        container: document.createElement("div"),
      });

      // Create the calcite-icon element
      const legendToggle = document.createElement("calcite-icon");
      legendToggle.setAttribute("icon", "legend");
      legendToggle.setAttribute("scale", "m");
      legendToggle.setAttribute("theme", "dark");
      legendToggle.style.cursor = "pointer";
      legendToggle.style.marginLeft = "170px";

      const layerDiv1 = document.getElementById("layerDiv");
      layerDiv1.appendChild(legendToggle);

      let legendVisible = false;

      function toggleLegend() {
        if (legendVisible) {
          view.ui.remove(legend);
        } else {
          view.ui.add(legend, "top-right");
        }
        legendVisible = !legendVisible;
      }

      legendToggle.addEventListener("click", toggleLegend);

      // Create a new div element for the Search widget container and its configuration
      const searchWidgetContainer = document.createElement("div");
      searchWidgetContainer.id = "search-widget-container";

      const headerTitle = document.getElementById("header-title");
      const h2Element = headerTitle.querySelector("h2");

      const searchWidget = new Search({
        view: view,
        locationEnabled: false,
        searchAllEnabled: false,
        includeDefaultSources: false,
      });

      // Wait for the view to finish loading, then add the search bar
      view.when().then(function () {
        headerTitle.insertBefore(searchWidgetContainer, h2Element.nextSibling);
        searchWidget.container = searchWidgetContainer;
        searchWidget.container.style = "border-radius: 25px;";

        document.addEventListener("DOMContentLoaded", function (event) {
          const searchContainer = searchWidgetContainer.getElementsByClassName(
            "esri-search__container"
          );
          const searchInput = searchContainer[0].querySelector(
            ".esri-search__input"
          );
        });
      });

      const homebutton = new Home({
        view: view,
        index: 1,
      });

      view.ui.add(homebutton, {
        position: "top-left",
      });

      view.ui.add(basemapExpand, {
        position: "top-right",
      });

      view.ui.add("topbar", "top-right");

      // configuration for distance measurement widgets
      let activeWidget1 = null;
      document
        .getElementById("distanceButton")
        .addEventListener("click", function () {
          setActiveWidget(null);
          if (!this.classList.contains("active")) {
            setActiveWidget("distance");
          } else {
            setActiveButton(null);
          }
        });

      document
        .getElementById("areaButton")
        .addEventListener("click", function () {
          setActiveWidget(null);
          if (!this.classList.contains("active")) {
            setActiveWidget("area");
          } else {
            setActiveButton(null);
          }
        });

      function setActiveWidget(type) {
        switch (type) {
          case "distance":
            activeWidget1 = new DistanceMeasurement2D({
              view: view,
              unit: "feet",
            });
            // skip the initial 'new measurement' button
            activeWidget1.viewModel.start();

            view.ui.add(activeWidget1, "top-right");
            setActiveButton(document.getElementById("distanceButton"));
            break;
          case "area":
            activeWidget1 = new AreaMeasurement2D({
              view: view,
              unit: "square-us-feet",
            });

            activeWidget1.viewModel.start();

            view.ui.add(activeWidget1, "top-right");
            setActiveButton(document.getElementById("areaButton"));
            break;
          case null:
            if (activeWidget1) {
              view.ui.remove(activeWidget1);
              activeWidget1.destroy();
              activeWidget1 = null;
            }
            break;
        }
      }

      function setActiveButton(selectedButton) {
        // focus the view to activate keyboard shortcuts for sketching
        view.focus();
        let elements = document.getElementsByClassName("active");
        for (let i = 0; i < elements.length; i++) {
          elements[i].classList.remove("active");
        }
        if (selectedButton) {
          selectedButton.classList.add("active");
        }
      }
      // custom configuration for the search widget
      view.when(function () {
        webmap.load().then(function () {
          // Wait for all layers to be loaded
          const layersLoaded = webmap.layers.map((layer) => layer.load());
          //   console.log(layersLoaded);
          Promise.all(layersLoaded).then(() => {
            const featureLayerSources = webmap.layers
              .filter(function (layer) {
                return layer.title === "Parcel Boundaries";
              })
              .map(function (featureLayer) {
                const searchFields = ["Uniqueid", "Owner", "Location"];
                return {
                  layer: featureLayer,
                  searchFields: searchFields,
                  displayField: "Location",
                  outFields: ["*"],
                  name: featureLayer.title,
                  placeholder: ["Search UniqueID, Owner, or Location"],
                  maxSuggestions: 6,
                  searchAllEnabled: true,
                  maxResults: 300,
                  exactMatch: false,
                };
              });
            searchWidget.sources = featureLayerSources;
          });
        });
      });
      // adds title from config, add 'cama viewer' to header, and adds logo from config to header
      webmap.when(() => {
        document.querySelector("#header-title").textContent = Title;
        const camaViewer = document.createElement("h6");
        camaViewer.setAttribute("id", "cama-viewer");
        camaViewer.innerHTML = "CAMA Viewer";
        camaViewer.style = "flex-direction: column;";
        camaViewer.style = "justify-content: center;";
        headerTitle.insertBefore(camaViewer, searchWidgetContainer.firstChild);

        const img = document.createElement("img");
        // coming from json file
        img.src = image;
        img.alt = "QDS Logo";
        img.width = "50";
        img.height = "50";

        const h2 = headerTitle.querySelector("h2");
        headerTitle.insertBefore(img, h2);

        //adds calcite shell and loader to html
        document.querySelector("calcite-shell").hidden = false;
        document.querySelector("calcite-loader").hidden = true;

        // add layers to map from config file, set up filters, and add to comboboxes for dropdowns
        function addLayerToMap(config) {
          const {
            url,
            title,
            fieldName,
            isVisible,
            orderByField,
            combobox1,
            combobox2,
          } = config;

          const featureLayer = new FeatureLayer({
            url,
            title,
            popupEnabled: true,
            visible: isVisible,
          });

          webmap.add(featureLayer);

          const combobox1ID = document.querySelector(`#${combobox1}`);
          combobox1ID.maxItems = "8";
          const combobox2ID = document.querySelector(`#${combobox2}`);
          combobox2ID.maxItems = "8";

          view.whenLayerView(featureLayer).then(function (layerView) {
            const uniqueValueQuery = featureLayer.createQuery();
            uniqueValueQuery.returnDistinctValues = true;
            uniqueValueQuery.outFields = [fieldName];
            uniqueValueQuery.orderByFields = [orderByField];

            const applyFilters = () => {
              const selectedItem1 = combobox1ID.selectedItems[0];
              const selectedValue1 = selectedItem1 ? selectedItem1.value : null;
              const selectedItem2 = combobox2ID.selectedItems[0];
              const selectedValue2 = selectedItem2 ? selectedItem2.value : null;

              let filterExpression = "";

              if (selectedValue1 && selectedValue1 !== "Show_All") {
                filterExpression = `${fieldName} = '${selectedValue1}'`;
              }

              if (selectedValue2 && selectedValue2 !== "Show_All") {
                if (filterExpression) {
                  filterExpression += ` OR ${fieldName} = '${selectedValue2}'`;
                } else {
                  filterExpression = `${fieldName} = '${selectedValue2}'`;
                }
              }

              layerView.filter = {
                where: filterExpression,
              };
            };

            featureLayer.queryFeatures(uniqueValueQuery).then((results) => {
              const uniquePrimaryUses = new Set();
              results.features.forEach((feature) => {
                const primaryUseValue = feature.attributes[fieldName];
                if (
                  !uniquePrimaryUses.has(primaryUseValue) &&
                  (primaryUseValue != null) & (primaryUseValue != "") &&
                  primaryUseValue != undefined
                ) {
                  uniquePrimaryUses.add(primaryUseValue);

                  const item1 = document.createElement("calcite-combobox-item");
                  item1.value = primaryUseValue;
                  item1.textLabel = primaryUseValue;
                  combobox1ID.appendChild(item1);

                  const item2 = document.createElement("calcite-combobox-item");
                  item2.value = primaryUseValue;
                  item2.textLabel = primaryUseValue;
                  combobox2ID.appendChild(item2);
                }
              });
            });

            const showAllItem1 = document.createElement(
              "calcite-combobox-item"
            );
            showAllItem1.value = "Show_All";
            showAllItem1.textLabel = "Show All";
            combobox1ID.appendChild(showAllItem1);

            const showAllItem2 = document.createElement(
              "calcite-combobox-item"
            );
            showAllItem2.value = "Show_All";
            showAllItem2.textLabel = "Show All";
            combobox2ID.appendChild(showAllItem2);

            combobox1ID.addEventListener("calciteComboboxChange", applyFilters);
            combobox2ID.addEventListener("calciteComboboxChange", applyFilters);

            // logic to reset filters
            document
              .getElementById("resetFilters")
              .addEventListener("click", () => {
                combobox1ID.selectedItems = [];
                combobox2ID.selectedItems = [];
                applyFilters();
              });
          });
        }
        layers.forEach((layerConfig) => {
          addLayerToMap(layerConfig);
        });
      });
    });
});
