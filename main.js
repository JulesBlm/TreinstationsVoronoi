/* TODO
-Make zoomable like
https://bl.ocks.org/mbostock/4699541
or https://bl.ocks.org/mbostock/9656675
-Province borders

-https://bl.ocks.org/iamkevinv/0a24e9126cd2fa6b283c6f2d774b69a2
*/
var width = 960,
    height = 700,
    format = d3.format(",d")
    active = d3.select(null);

var projection = d3.geoAlbers() 
    .center([5.5, 52.05])
    // .parallels([50, 53])
    .rotate(120)
    .scale(12000)
    .translate([width / 2, height / 2]);

var zoom = d3.zoom()
    .scaleExtent([1, 8])
    .on("zoom", zoomed);

var path = d3.geoPath()
    .projection(projection);

var svg = d3.select("#map")
    .attr("width", width)
    .attr("height", height)
    .on("click", stopped, true);

svg.append("rect")
    .attr("class", "background")
    .attr("width", width)
    .attr("height", height)
    .on("click", reset);

var g = svg.append("g");

svg.call(zoom);

var svgLegend = d3.select("#legend");

var color = d3.scaleThreshold()
    .domain([0, 100, 500, 750, 1500, 2500, 7500, 12500])
    .range(d3.schemeGnBu[9]);


/* LEGEND */
var x = d3.scaleSqrt()
    .domain([0, 12500])
    .rangeRound([10, 890]);

var gLegend = svgLegend.append("g")
    .attr("class", "key")
    .attr("transform", "translate(0,40)");

gLegend.selectAll("rect")
  .data(color.range().map(function(d) {
      d = color.invertExtent(d);
      if (d[0] == null) d[0] = x.domain()[0];
      if (d[1] == null) d[1] = x.domain()[1];
      return d;
    }))
  .enter().append("rect")
    .attr("height", 8)
    .attr("x", function(d) { return x(d[0]); })
    .attr("width", function(d) { return x(d[1]) - x(d[0]); })
    .attr("fill", function(d) { return color(d[0]); });

// Draw legend text
gLegend.append("text")
    .attr("class", "caption")
    .attr("x", x.range()[0])
    .attr("y", -6)
    .attr("fill", "#000")
    .attr("text-anchor", "start")
    .attr("font-weight", "bold")
    .text("Inwoners per vierkante kilometer");

// Draw axis tick marks
gLegend.call(d3.axisBottom(x)
    .tickSize(13)
    .tickValues(color.domain()))
  .select(".domain")
    .remove();

// Toggle voronoi with radio button
var inputElems = d3.selectAll("input")
  .on("change", function() {
    if (this.value === "Hide") { d3.select(".voronoi").style("opacity", 0); }
    else if (this.value === "Show") { d3.select(".voronoi").style("opacity", 1); }
})

d3.queue()
    .defer(d3.json, "wijk-topo-c.json")
    .defer(d3.csv, "locations.csv")
    .defer(d3.json, "spoor.geojson")
    .await(ready);

function ready(error, wijken, stations, spoor) {
  if (error) throw error;

  // Draw the map
  g.selectAll(".wijk")
      .data(topojson.feature(wijken, wijken.objects.wijk).features)
    .enter().insert("path")
      .attr("class", "wijk")
      .attr("fill", function(d) { return color(d.properties.BEV_DICHTH); }) //d3.schemeOrRd[9][d.properties.AANT_INW]
      .attr("d", path)
      .on("click", clicked)
    .append("title")
      .text(function(d) { return (
        d.properties.GM_NAAM + " "
        + ((d.properties.WK_NAAM !== null) ? d.properties.WK_NAAM : "")
        + ((d.properties.AF_TREINST !== -99999998) ? "\nGem. afstand tot station: " + d.properties.AF_TREINST + " km" : "")
        + ((d.properties.BEV_DICHTH !== -99999998) ? "\nBev. dichtheid: " + format(d.properties.BEV_DICHTH) : "")
        + ((d.properties.AANT_INW !== -99999998) ? "\nAantal Inwoners: " + format(d.properties.AANT_INW) : "")
        );
      });

  // Draw borders
  g.append("path")
      .attr("class", "wijk-borders")
      .attr("d", path(topojson.mesh(wijken, wijken.objects.wijk, function(a, b) { return a !== b; })));

  // Draw borders
  g.append("path")
      .attr("class", "gemeente-borders")
      .attr("d", path(topojson.mesh(wijken, wijken.objects.wijk, function(a, b) { return a.properties.GM_NAAM !== b.properties.GM_NAAM; })));

  // Draw the tracks
  g.selectAll(".spoor")
      .data(spoor.features)
    .enter().insert("path")
      .attr("class", "spoor")
      .attr("d", path);

  // Draw the points for the stations
  g.selectAll(".station")
    .data(stations)
    .enter().append("circle")
      .attr("class", "station")
      .attr("transform", function(d) { return "translate(" + projection([d["0"], d["1"]]) + ")"; })
      .append("title")
        .text(function(d) { return "Station " + d.name; });

  var polygons = d3.voronoi()
                  .extent([[-1, -1], [width + 1, height + 1]])
                  .polygons(stations.map(projection));

  // Draw the Voronoi cells
  g.append("path")
    .datum(polygons)
    .attr("class", "voronoi")
    .attr("d", function(d) {
      return "M" + d
        .filter(function(d) { return d != null; })
        .map(function(d) { return d.join("L"); })
        .join("ZM") + "Z";
    });
};

function clicked(d) {
  if (active.node() === this) return reset();
  active.classed("active", false);
  active = d3.select(this).classed("active", true);

  var bounds = path.bounds(d),
      dx = bounds[1][0] - bounds[0][0],
      dy = bounds[1][1] - bounds[0][1],
      x = (bounds[0][0] + bounds[1][0]) / 2,
      y = (bounds[0][1] + bounds[1][1]) / 2,
      scale = Math.max(1, Math.min(8, 0.9 / Math.max(dx / width, dy / height))),
      translate = [width / 2 - scale * x, height / 2 - scale * y];

  svg.transition()
      .duration(750)
      .call( zoom.transform, d3.zoomIdentity.translate(translate[0],translate[1]).scale(scale) );
}

function reset() {
  active.classed("active", false);
  active = d3.select(null);

  svg.transition()
      .duration(750)
      .call( zoom.transform, d3.zoomIdentity );
}

function zoomed() {
  g.style("stroke-width", 1.5 / d3.event.transform.k + "px");
  g.attr("transform", d3.event.transform);
}

// If the drag behavior prevents the default click,
// also stop propagation so we don’t click-to-zoom.
function stopped() {
  if (d3.event.defaultPrevented) d3.event.stopPropagation();
}

