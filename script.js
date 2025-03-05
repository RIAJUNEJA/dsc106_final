let aggregatedBySession = [];
// Global object to store pre-binned data for different bin sizes
const preBinnedData = {};
const units = {
  time_index: "seconds",
  heart_rate: "BPM",
  eda: "µS",
  skin_temp: "°C",
};

//Get trimmed extent (5th–95th percentile by default)
function getTrimmedExtent(data, accessor, trim = 0.05) {
  const values = data.map(accessor).sort(d3.ascending);
  const lower = d3.quantile(values, trim);
  const upper = d3.quantile(values, 1 - trim);
  return [lower, upper];
}

// // Function to aggregate data using pre-binned data
// function aggregateData(data, xKey, yKey, bins, xMin, xMax) {
//   // Check if pre-binned data exists for the selected bin size
//   const binSize = bins || 100; // Default to 100 if not provided
//   const preBinned = preBinnedData[binSize];

//   if (!preBinned) {
//     // If pre-binned data doesn't exist, fall back to the original aggregation process
//     const binWidth = (xMax - xMin) / bins;
//     const binArray = [];
//     for (let i = 0; i < bins; i++) {
//       binArray.push({
//         xStart: xMin + i * binWidth,
//         dataPoints: [],
//       });
//     }

//     // Aggregate the raw data into bins
//     data.forEach((d) => {
//       const xVal = d[xKey];
//       if (xVal >= xMin && xVal <= xMax) {
//         const binIndex = Math.floor((xVal - xMin) / binWidth);
//         if (binIndex >= 0 && binIndex < bins) {
//           binArray[binIndex].dataPoints.push(d);
//         }
//       }
//     });

//     // Aggregating data points for each bin
//     return binArray
//       .map((b) => {
//         if (b.dataPoints.length === 0) return null;
//         return {
//           x: b.xStart + binWidth / 2, // bin midpoint
//           y: d3.mean(b.dataPoints, (d) => d[yKey]),
//           students: Array.from(new Set(b.dataPoints.map((d) => d.Student))),
//         };
//       })
//       .filter((d) => d !== null && !isNaN(d.y));
//   } else {
//     // If pre-binned data is available, use it directly
//     return preBinned.map((binned) => {
//       return {
//         x: binned.time_index,
//         y: binned[yKey],
//         students: Array.from(new Set(data.map((d) => d.Student))),
//       };
//     });
//   }
// }

// Aggregate data into bins along x, computing average y and collecting Students.
function aggregateData(data, xKey, yKey, bins, xMin, xMax) {
  const binWidth = (xMax - xMin) / bins;
  const binArray = [];
  for (let i = 0; i < bins; i++) {
    binArray.push({
      xStart: xMin + i * binWidth,
      dataPoints: [],
    });
  }
  data.forEach((d) => {
    const xVal = d[xKey];
    if (xVal >= xMin && xVal <= xMax) {
      const binIndex = Math.floor((xVal - xMin) / binWidth);
      if (binIndex >= 0 && binIndex < bins) {
        binArray[binIndex].dataPoints.push(d);
      }
    }
  });
  const aggregated = binArray
    .map((b) => {
      if (b.dataPoints.length === 0) return null;
      return {
        x: b.xStart + binWidth / 2, // bin midpoint
        y: d3.mean(b.dataPoints, (d) => d[yKey]),
        // Collect unique students from this bin:
        students: Array.from(new Set(b.dataPoints.map((d) => d.Student))),
      };
    })
    .filter((d) => d !== null && !isNaN(d.y));
  return aggregated;
}

function brushed(event) {
  if (!event.selection || aggregatedBySession.length === 0) return; // Exit if no selection or no data

  const [x0, x1] = event.selection.map(xScale.invert); // Convert pixel values to data values

  // Filter data based on selection range
  const filteredData = aggregatedBySession
    .map((session) => ({
      session: session.session,
      aggregated: session.aggregated.filter((d) => d.x >= x0 && d.x <= x1),
    }))
    .filter((d) => d.aggregated.length > 0);

  // Update the chart with filtered data
  updateChartWithFilteredData(filteredData);
  displaySummary(filteredData, x0, x1);
}

function updateChartWithFilteredData(filteredData) {
  // Update the session lines
  const sessionLines = svg.selectAll(".session-line").data(filteredData, (d) => d.session);

  sessionLines
    .enter()
    .append("path")
    .attr("class", "session-line")
    .merge(sessionLines)
    .transition()
    .duration(500)
    .attr("d", (d) => lineGenerator(d.aggregated))
    .attr("stroke", (d) => colorScale(d.session))
    .attr("fill", "none")
    .attr("stroke-width", 1.5);

  sessionLines.exit().remove();
}

function displaySummary(filteredData, x0, x1) {
  if (filteredData.length === 0) {
    d3.select("#summary").html("No data in the selected range.");
    return;
  }

  // Calculate summary statistics
  let totalPoints = 0;
  let yValues = [];

  filteredData.forEach((session) => {
    totalPoints += session.aggregated.length;
    yValues.push(...session.aggregated.map((d) => d.y));
  });

  const minY = d3.min(yValues);
  const maxY = d3.max(yValues);
  const avgY = d3.mean(yValues);

  // Format output
  const summaryText = `
      <div class="summary-box">
          <p><strong>📊 Selected Range:</strong> ${x0.toFixed(2)} – ${x1.toFixed(2)}</p>
          <p><strong>📌 Sessions Included:</strong> ${
            filteredData.length > 0 ? filteredData.map((d) => d.session).join(", ") : "None"
          }</p>
          <p><strong>🔢 Data Points:</strong> ${totalPoints}</p>
          <p><strong>📉 Y-Value Range:</strong> ${minY.toFixed(2)} – ${maxY.toFixed(2)}</p>
          <p><strong>📈 Average Y-Value:</strong> <span class="highlight">${avgY.toFixed(2)}</span></p>
      </div>
  `;

  // Update summary div with fade-in animation
  d3.select("#summary").html(summaryText).style("opacity", 0).transition().duration(500).style("opacity", 1);
}

const margin = { top: 60, right: 200, bottom: 60, left: 80 }, // Increased margins for better fit
  width = 1200 - margin.left - margin.right, // Increase width
  height = 700 - margin.top - margin.bottom; // Increase height

const chartContainer = d3.select("#chart"); // Selects the new chart div

const svg = chartContainer
  .append("svg")
  .attr("width", width + margin.left + margin.right)
  .attr("height", height + margin.top + margin.bottom)
  .style("display", "block") // Ensures the SVG behaves well in a flex container
  .append("g")
  .attr("transform", `translate(${margin.left}, ${margin.top})`);

//BRUSH
// Define the brush behavior
const brush = d3
  .brushX()
  .extent([
    [0, 0],
    [width, height],
  ]) // Brushing area
  .on("brush end", brushed);

// Append the brush to the SVG
const brushGroup = svg.append("g").attr("class", "brush").call(brush);

//END BRUSH

//begin{zoom}
// Define zoom behavior
const zoom = d3
  .zoom()
  .scaleExtent([0.9, 4]) // Min and max zoom levels
  .translateExtent([
    [-100, -100],
    [width + 100, height + 100],
  ]) // Restrict panning area
  .on("zoom", zoomed);

// Apply zoom to the entire SVG container
d3.select("svg").call(zoom).call(zoom.transform, d3.zoomIdentity);

// Function to handle zooming and panning
function zoomed(event) {
  svg.attr("transform", event.transform); // Apply zoom transformation to the whole SVG group
}

// Reset zoom function
d3.select("#resetZoom").on("click", function () {
  d3.select("svg").transition().duration(500).call(zoom.transform, d3.zoomIdentity);
});

//end{zoom}
const tooltip = d3.select("#tooltip");

// Scales and axes
let xScale = d3.scaleLinear().range([0, width]);
let yScale = d3.scaleLinear().range([height, 0]);
const xAxisGroup = svg.append("g").attr("transform", `translate(0, ${height})`);
const yAxisGroup = svg.append("g").attr("transform", `translate(0, 0)`);

// Line generator for aggregated data (per session)
const lineGenerator = d3
  .line()
  .curve(d3.curveMonotoneX)
  .x((d) => xScale(d.x))
  .y((d) => yScale(d.y));

// Color scale for sessions
const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

let rawData;
d3.csv("consolidated_stress_data.csv")
  .then((data) => {
    // Parse numeric columns; keep Session and Student as strings.
    data.forEach((d) => {
      d.time_index = +d["Time (Index)"];
      d.eda = +d["EDA"];
      d.heart_rate = +d["Heart Rate"];
      d.skin_temp = +d["Temperature"];
    });
    rawData = data;
    updateChart();
  })
  .catch((err) => console.error("Error loading CSV:", err));

function updateChart() {
  const xAttribute = d3.select("#xSelect").property("value");
  const yAttribute = d3.select("#ySelect").property("value");

  // Get selected event
  const selectedEvent = d3.select("#eventSelect").property("value");

  // Filter rawData based on selected event
  let filteredData = rawData;
  if (selectedEvent !== "all") {
    filteredData = rawData.filter((d) => d.Session === selectedEvent);
  }

  // Sort filtered data by the selected x-attribute
  filteredData.sort((a, b) => a[xAttribute] - b[xAttribute]);

  // Overall trimmed domain across all sessions
  const xExtent = getTrimmedExtent(filteredData, (d) => d[xAttribute], 0.05);
  const yExtent = getTrimmedExtent(filteredData, (d) => d[yAttribute], 0.05);
  xScale.domain(xExtent).nice();
  yScale.domain(yExtent).nice();

  // Group data by Session
  const sessionGroups = d3.group(filteredData, (d) => d.Session);
  // const binsCount = 100;
  const binsCount = d3.select("#binSize").property("value");
  aggregatedBySession = Array.from(sessionGroups, ([sessionName, groupData]) => {
    return {
      session: sessionName,
      aggregated: aggregateData(groupData, xAttribute, yAttribute, binsCount, xExtent[0], xExtent[1]),
    };
  }).filter((d) => d.aggregated.length > 0);

  // Update axes
  xAxisGroup.transition().duration(500).call(d3.axisBottom(xScale));
  yAxisGroup.transition().duration(500).call(d3.axisLeft(yScale));

  // Update session lines
  const sessionLines = svg.selectAll(".session-line").data(aggregatedBySession, (d) => d.session);
  sessionLines
    .enter()
    .append("path")
    .attr("class", "session-line")
    .merge(sessionLines)
    .transition()
    .duration(500)
    .attr("d", (d) => lineGenerator(d.aggregated))
    .attr("stroke", (d) => colorScale(d.session))
    .attr("fill", "none")
    .attr("stroke-width", 1.5);
  sessionLines.exit().remove();

  // Update circles
  const sessionGroupsSel = svg.selectAll(".session-group").data(aggregatedBySession, (d) => d.session);
  const sessionGroupsEnter = sessionGroupsSel.enter().append("g").attr("class", "session-group");
  sessionGroupsEnter.merge(sessionGroupsSel).each(function (d) {
    const group = d3.select(this);
    const circles = group.selectAll("circle").data(d.aggregated);
    circles
      .enter()
      .append("circle")
      .attr("r", 3)
      .attr("fill", colorScale(d.session))
      .attr("fill-opacity", 0.7)
      .merge(circles)
      .transition()
      .duration(500)
      .attr("cx", (dPoint) => xScale(dPoint.x))
      .attr("cy", (dPoint) => yScale(dPoint.y));
    circles.exit().remove();
  });
  sessionGroupsSel.exit().remove();

  // Update tooltips
  svg
    .selectAll("circle")
    .on("mouseover", (event, d) => {
      tooltip.transition().duration(200).style("opacity", 0.9);
      const session = d3.select(event.target.parentNode).datum().session;
      const studentList = d.students.join(", ");
      tooltip
        .html(
          `
              <strong>Session:</strong> ${session}<br/>
              <strong>${xAttribute} bin center:</strong> ${d.x.toFixed(2)}<br/>
              <strong>Avg. ${yAttribute}:</strong> ${d.y.toFixed(2)}<br/>
              <strong>Students:</strong> ${studentList || "N/A"}
          `
        )
        .style("left", event.pageX + 10 + "px")
        .style("top", event.pageY - 28 + "px");
    })
    .on("mouseout", () => {
      tooltip.transition().duration(300).style("opacity", 0);
    });

  // Update axis labels
  svg.selectAll(".axis-label").remove();
  svg
    .append("text")
    .attr("class", "axis-label")
    .attr("x", width)
    .attr("y", height + margin.bottom - 10)
    .attr("text-anchor", "end")
    .text(xAttribute.replace("_", " ").toUpperCase() + " (" + units[xAttribute] + ")");
  svg
    .append("text")
    .attr("class", "axis-label")
    .attr("transform", "rotate(-90)")
    .attr("y", -margin.left + 15)
    .attr("x", -margin.top)
    .attr("text-anchor", "end")
    .text(yAttribute.replace("_", " ").toUpperCase() + " (" + units[yAttribute] + ")");
  // Add legend for sessions (place this at the end of updateChart())
  const legend = svg.selectAll(".legend").data(aggregatedBySession, (d) => d.session);
  const legendEnter = legend
    .enter()
    .append("g")
    .attr("class", "legend")
    .attr("transform", (d, i) => `translate(${width - 150}, ${i * 20})`);
  legendEnter
    .append("rect")
    .attr("width", 12)
    .attr("height", 12)
    .attr("fill", (d) => colorScale(d.session));
  legendEnter
    .append("text")
    .attr("x", 16)
    .attr("y", 10)
    .text((d) => d.session)
    .style("font-size", "12px");
  legend.merge(legendEnter).attr("transform", (d, i) => `translate(${width + 20}, ${i * 20})`);
  legend.exit().remove();
}

// Update when dropdowns change.
d3.select("#xSelect").on("change", updateChart);
d3.select("#ySelect").on("change", updateChart);
d3.select("#resetBrush").on("mousedown", function (event) {
  console.log("bruh");
  brushGroup.call(brush.move, null); // Clears the brush selection
  updateChart(); // Restore full dataset
  d3.select("#summary").html(""); // Clear the summary
});

d3.select("#updateEvent").on("click", updateChart);
d3.select("#binSize").on("input", updateChart);

function updateBinSize(value) {
  document.getElementById("binSizeValue").innerText = value;
}

// Function to compute the pre-binned data
function computePreBinnedData() {
  const binSizes = [25, 50, 75, 100, 150, 200, 250, 300, 400, 500, 750];

  binSizes.forEach((binSize) => {
    preBinnedData[binSize] = binData(rawData, binSize);
  });
}

// Function to bin the data based on the selected bin size
function binData(data, binSize) {
  const binnedData = [];

  // Assuming `time_index` is the x-axis for binning.
  // Group data by the time index and bin it based on the provided bin size.
  for (let i = 0; i < data.length; i += binSize) {
    const bin = data.slice(i, i + binSize);

    // Compute the average values for each metric in the bin
    const avg = {
      time_index: bin[0].time_index, // You could also average time_index if necessary
      eda: d3.mean(bin, (d) => d.eda),
      heart_rate: d3.mean(bin, (d) => d.heart_rate),
      skin_temp: d3.mean(bin, (d) => d.skin_temp),
    };

    binnedData.push(avg);
  }

  return binnedData;
}
