// This block is built with rollupjs and works from bundle.js

import { queue } from 'd3-queue'
import { json } from 'd3-request'
import { scaleQuantile } from "d3-scale"
import { select, mouse } from 'd3-selection'
import { geoPath, geoContains } from 'd3-geo'
import { geoConicConformalSpain } from 'd3-composite-projections'
import { feature } from 'topojson-client'
import 'rbush/rbush.min.js'

var context = select("canvas").node().getContext("2d"),

projection = geoConicConformalSpain(),
path = geoPath(projection, context),
path_svg = geoPath(projection),

svg = select("svg").append("g").attr('pointer-events', 'none'),
tooltip = select(".tooltip")

queue()
.defer(json, "municipalities.json")
.defer(json, "data.json")
.await(ready)

function ready(error, map, data){
  if (error) throw error

  var features = feature(map, map.objects.municipalities),
  nation = feature(map, map.objects.nation);

  var scaleColor = ["#A50026", "#D73027", "#F46D43", "#FDAE61", "#A6D96A", "#66BD63", "#1A9850", "#006837"];
  var color = scaleQuantile()
  .domain([-75, -35, -25, -15, 15, 25, 70, 400])
  .range(scaleColor);

  context.strokeStyle = "rgb(0,0,0)";
  context.lineWidth = ".1";

  // draw all the polygons
  for (var i = 0; i < features.features.length; i++) {

    if (data[features.features[i].id]) {
      context.fillStyle = color(data[features.features[i].id].p)
      context.beginPath()
      path(features.features[i])
      context.fill()
      context.stroke()
    }
  }

  // country border
  context.beginPath()
  path(feature(map, map.objects.nation))
  context.strokeStyle = "rgb(100, 100, 100)";
  context.stroke()

  createRTree(features, path)

  select("canvas").on("mousemove", function(d){
    var points = mouse(this),
    inverted = projection.invert(points)

    if (geoContains(nation, inverted)) {
      var lookup = features.lookupTree.search({
        minX: points[0],
        minY: points[1],
        maxX: points[0],
        maxY: points[1]
      })

      for (var j in lookup) {
        var feature = lookup[j].polygon
        if (inside(inverted, feature)) {
        createPath(points,feature)
        }
      }
    } else {
      // remove path if its outside the country polygon
      tooltip.style("visibility", "hidden")
      svg.selectAll("path").remove()
    }
  })

  // taken from https://github.com/newsappsio/spam/blob/master/spam.js#L66
  function createRTree(element, dataPath) {
    element.lookupTree = rbush(4)
    var elements = []

    for (var j in element.features) {
      var bounds = dataPath.bounds(element.features[j])
      elements.push({
        minX: Math.floor(bounds[0][0]),
        minY: Math.floor(bounds[0][1]),
        maxX: Math.ceil(bounds[1][0]),
        maxY: Math.ceil(bounds[1][1]),
        polygon: element.features[j]
      })
    }
    element.lookupTree.load(elements)
  }

  function createPath(points, feature){

    manageTooltip(points, feature)

    svg.selectAll("path").remove()

    return svg.selectAll("path")
    .data([feature])
    .enter()
    .append("path")
    .attr('d', path_svg)
  }

  function inside(pt, polygon) {
     var polys = polygon.geometry.coordinates
     // normalize to multipolygon
     if (polygon.geometry.type === 'Polygon')
         polys = [polys]

     var insidePoly = false
     var i = 0
     while (i < polys.length && !insidePoly) {
         // check if it is in the outer ring first
         if (inRing(pt, polys[i][0])) {
             var inHole = false
             var k = 1
             // check for the point in any of the holes
             while (k < polys[i].length && !inHole) {
                 if (inRing(pt, polys[i][k])) {
                     inHole = true
                 }
                 k++
             }
             if(!inHole)
                 insidePoly = true
         }
         i++
     }
     return insidePoly
   }
  // pt is [x,y] and ring is [[x,y], [x,y],..]
  function inRing (pt, ring) {
      var isInside = false
      for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
          var xi = ring[i][0], yi = ring[i][1]
          var xj = ring[j][0], yj = ring[j][1]
          var intersect = ((yi > pt[1]) !== (yj > pt[1])) &&
              (pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi)
          if (intersect) isInside = !isInside
      }
      return isInside
  }
  function manageTooltip(points, feature){
    var d = data[feature.id];
    if (!d) {
      return
    }

    return tooltip
    .html("<div><span>Name</span>:&nbsp;" + d.n + "</div><div><span>Pop. variation</span>&nbsp;(%):&nbsp;" + d.p +"</div>")
    .style("visibility", "visible")
  }
}
