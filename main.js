var margin = {top: 40, right: 40, bottom: 40, left: 40};

var svg = d3.select("#map"),
    width = +svg.attr("width"),
    height = +svg.attr("height"),
    format = d3.format(",d");

var svgLegend = d3.select("#legend");

var projection = d3.geoAlbers() 
    .center([5.5, 52.05])
    .parallels([50, 53])
    .rotate(120)
    .scale(12000)
    .translate([width / 2, height / 2]);

var path = d3.geoPath()
    .projection(projection);

var color = d3.scaleThreshold()
    .domain([0, 100, 500, 750, 1500, 2500, 7500, 12500])
    .range(d3.schemeGnBu[9]);

var x = d3.scaleLinear()
    .domain([0, 12500])
    .rangeRound([10, 890]);

var g = svgLegend.append("g")
    .attr("class", "key")
    .attr("transform", "translate(0,40)");

g.selectAll("rect")
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

g.append("text")
    .attr("class", "caption")
    .attr("x", x.range()[0])
    .attr("y", -6)
    .attr("fill", "#000")
    .attr("text-anchor", "start")
    .attr("font-weight", "bold")
    .text("Inwoners per vierkante kilometer");

g.call(d3.axisBottom(x)
    .tickSize(13)
    .tickValues(color.domain()))
  .select(".domain")
    .remove();

// Select import or export with radio button
var inputElems = d3.selectAll("input")
  .on("change", function() {
    if (this.value === "Hide") {d3.select(".voronoi").style("opacity", 0);}
    else if (this.value === "Show") {d3.select(".voronoi").style("opacity", 1)}
})

d3.queue()
    .defer(d3.json, "wijk-topo-c.json")
    .defer(d3.csv, "locations.csv")
    .defer(d3.json, "spoor.geojson")
    .await(ready);

function ready(error, wijken, stations, spoor) {
  if (error) throw error;

  // Draw the map
  svg.selectAll(".wijk")
      .data(topojson.feature(wijken, wijken.objects.wijk).features)
    .enter().insert("path")
      .attr("class", "wijk")
      .attr("fill", function(d) { return color(d.properties.BEV_DICHTH); }) //d3.schemeOrRd[9][d.properties.AANT_INW]
      .attr("d", path)
    .append("title")
      .text(function(d) { return (
        d.properties.GM_NAAM + " "
        + ((d.properties.WK_NAAM !== null) ? d.properties.WK_NAAM : "")
        + "\nGem. afstand tot station: " + d.properties.AF_TREINST + " km"
        + ((d.properties.BEV_DICHTH !== -99999998 || -99999997) ? "\nBev. dichtheid: " + format(d.properties.BEV_DICHTH) : "")
        + ((d.properties.AANT_INW !== -99999998) ? "\nAantal Inwoners: " + format(d.properties.AANT_INW) : "")
        );
      });
// ((d.properties.AANT_INW !== -99999998) ? "\nAantal Inwoner: " + format(d.properties.AANT_INW) : " ");

  // Draw borders
  svg.append("path")
      .attr("class", "wijk-borders")
      .attr("d", path(topojson.mesh(wijken, wijken.objects.wijk, function(a, b) { return a !== b; })));

  // Draw the tracks
  svg.selectAll(".spoor")
      .data(spoor.features)
    .enter().insert("path")
      .attr("class", "spoor")
      .attr("d", path);

  // Draw the points for the stations
  svg.selectAll(".station")
    .data(stations)
    .enter().append("circle")
      .attr("r", 1.6)
      .attr("class", "station")
      .attr("transform", function(d) { return "translate(" + projection([d["0"], d["1"]]) + ")"; })
      .append("title")
        .text(function(d) { return "Station " + d.name; });

  var polygons = d3.voronoi()
                  .extent([[-1, -1], [width + 1, height + 1]])
                  .polygons(stations.map(projection));

  // Draw the Voronoi cells
  svg.append("path")
    .datum(polygons)
    .attr("class", "voronoi")
    .attr("d", function(d) {
      return "M" + d
        .filter(function(d) { return d != null; })
        .map(function(d) { return d.join("L"); })
        .join("ZM") + "Z";
    });
};