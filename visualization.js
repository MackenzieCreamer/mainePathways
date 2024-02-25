fileNamePath = "simplifiedSchools.csv"
programsNamePath = "possiblePrograms.csv"
pathwayValueNames = ["Elementary School", "Middle School","High School", "CTE", "Community College", "University/Colleges", "Graduate"]
pathwayValueRanks = [1, 2, 3, 4, 5, 6, 7]
pathwayValues = [pathwayValueNames, pathwayValueRanks]
totalMenus = 0

var boundaryComplex, boundarySimple, states;
var landComplex, landSimple;
var lakeComplex, lakeSimple;
var riverComplex, riverSimple;

var width = 280; var height = 300;

const sensitivity = 75;
let scale = 0.75;
var draw_on_move=1;

var dx = width, 
	dy = height;

var sourceData="",
	target="",
	targetData="";

var base_r=0;
var base_g=95;
var base_b=153;
var layer_transp=255;

var radius = 4

//Dozens of rgba colors for use in different areas of the website
//First part is element of map effected, second is either fill = f, stroke = s, l = line, d = dot
//third is element type, where width is width and clr = color
var land_f2_clr="rgba(192,166,139,1)";
var land_f_clr0="rgba(255,255,255,0)";
//var land_f_clr="rgba(234,226,200,1)";
var land_f_clr="rgba(192,166,139,1)";
var borders_l_width=1;
var borders_s_clr="rgba(0,0,0,.5)";
var grid_l_width=.5;
var grid_s_clr="rgba(128,128,128,.7)";
var equator_s_clr="rgba(0,0,0,.4)";
var wtr_f_clr="rgba(" + base_r.toString()+","+base_g.toString()+","+base_b.toString()+","+layer_transp.toString()+")";
//var mrk_f_clr="rgba(70,130,180,1)";
var mrk_f_clr="rgba(255,64,0,1)";
var slc_f_clr="rgba(50,50,50,.3)";
var slc_d_clr="rgba(50,50,50,.6)";

var ocean_color="#7FB4D7";		// Natural Earth blue


const center = [width / 2, height / 2];

var svg = d3.select("#map_box")
    .append("canvas")
    .attr("width", width)
    .attr("height", height)
    .on("click",function(event){
        latLonUpdate(projection.invert(d3.pointer(event)))
    })

function latLonUpdate(coordinates){
    //Triggers from the mousemove event listener
    //Updates the lat/lon coords in the top right of the canvas container
    console.log(coordinates)
}
    

var context=svg.node().getContext("2d");

var image=new Image;

var projection  = d3.geoEquirectangular()
    .scale(1000) //361 was the ideal scale that gave all latitudes visibility on selection equirectangular projections
    .translate([width / 2, height / 2]);

var path = d3.geoPath()
	.projection(projection)
	.context(context);

const initialScale = projection.scale();


projection.scale(initialScale * scale);
var maineCenter = projection([45.367584,-68.972168])
projection.translate(maineCenter);



function create_menu(indexOfElement, startingCutoff) {
    totalMenus += 1
    // console.log(startingCutoff)

    const currentElement = document.createElement("div")
    currentElement.setAttribute("id", "typesMenu_" + indexOfElement)
    currentElement.setAttribute("class", "inner_boxes")

    const menuBox = document.getElementById("all_menus")

    menuBox.append(currentElement)

    var schoolTypeSelect = document.createElement("select");
    schoolTypeSelect.name = "schoolTypesDropdown";
    schoolTypeSelect.id = "typesDropdown" + indexOfElement;
    schoolTypeSelect.setAttribute("class", "types_dropdown")

    for (const type of pathwayValues[0].slice(startingCutoff, pathwayValues[0].length)) {
        var schoolOption = document.createElement("option");
        schoolOption.value = type;
        schoolOption.text = type;
        schoolTypeSelect.appendChild(schoolOption);
        // console.log(cat)
    }

    var typeLabel = document.createElement("label");
    typeLabel.innerHTML = "Type of Institution: "
    typeLabel.htmlFor = "types";
    typeLabel.setAttribute("class", "dropdown_label");

    currentElement.appendChild(typeLabel).appendChild(schoolTypeSelect);
    schoolTypeSelect.value = ""

    schoolTypeSelect.onchange = function () {
        d3.csv(programsNamePath).then(function (programs) {
            console.log(programs)
            let program_list = programs.filter(program => program.types === schoolTypeSelect.value)
            program_list = program_list[0].programs.replace(/['"]+/g, '').replace(/[-]+/g, ' ')
            console.log(program_list)
            program_list = JSON.parse(program_list[0].programs)

    
            let filter1 = document.createElement("select");
            filter1.name = "programFilter1"
            filter1.id = "filter1_" + indexOfElement
            filter1.setAttribute("class", "types_dropdown")
            let filter2 = document.createElement("select");
            filter2.name = "programFilter2"
            filter2.id = "filter2_" + indexOfElement
            filter2.setAttribute("class", "types_dropdown")
            for (const program of programFilters) {
                var programOption = document.createElement("option");
                programOption.value = type;
                programOption.text = type;
                filter1.appendChild(programOption);
                filter2.appendChild(programOption);
            }
        });

        pathwayNameIndex = pathwayValues[0].indexOf(schoolTypeSelect.value)

        valueRank = pathwayValues[1][pathwayNameIndex]

        newCutoffIndex = pathwayValues[1].indexOf(valueRank, 0)

        nextElement = indexOfElement + 1

        create_school_list(schoolTypeSelect.value, indexOfElement)

        delete_old_menus(nextElement)

        create_menu(nextElement, newCutoffIndex) //Update this to be on visualization or node plot, not for dropdown changes
    }
}

function delete_old_menus(nextElement) {
    for (let i = nextElement, oldTotal = totalMenus; i < oldTotal; i++) {
        document.getElementById("typesMenu_" + i).remove();
        totalMenus -= 1
    }
}

function create_school_list(type, indexOfElement) {
    var schoolListElement = document.getElementById("school_list_" + indexOfElement);
    if (schoolListElement != null) {
        schoolListElement.remove()
    }
    schoolListElement = document.createElement("ul")
    document.getElementById("typesMenu_" + indexOfElement).appendChild(schoolListElement);
    schoolListElement.setAttribute('id', "school_list_" + indexOfElement)
    schoolListElement.setAttribute('class', "school_list")

    d3.csv(fileNamePath).then(function (schools) {
        // let school_list = schools.filter(school => school.type === type && school.program.includes(document.getElementById("filter_1").value))
        let school_list = schools.filter(school => school.type === type)

        // console.log(school_list)
        schoolCount = 0
        for (const school of school_list) {
            listElement = document.createElement("li")
            var schoolOption = document.createElement("INPUT");
            schoolOption.value = school.name + "$" + school.type;
            schoolOption.setAttribute("type", "checkbox")
            schoolOption.setAttribute("id", "school" + indexOfElement + "_" + schoolCount)
            var schoolLabel = document.createElement("label");
            schoolLabel.innerHTML = school.name
            schoolLabel.htmlFor = "school" + indexOfElement + "_" + schoolCount;
            listElement.appendChild(schoolOption)
            listElement.appendChild(schoolLabel)
            schoolCount += 1
            schoolListElement.appendChild(listElement)
        }
    });

}

function visualizePath() {
    d3.csv(fileNamePath).then(function (schools) {
        const schoolsToVisualize = []
        for (let i = 0; i < totalMenus - 1; i++) {
            var schoolListElement = document.getElementById("school_list_" + i);
            var checkboxes = schoolListElement.querySelectorAll('input[type="checkbox"]:checked');
            schoolNames = []
            schoolType = null
            for (const checkbox of checkboxes) {
                returnValue = checkbox.value.split("$")
                schoolNames.push(returnValue[0])
                schoolType = returnValue[1]
            }
            elementsSchools = schools.filter(school => schoolNames.indexOf(school.name) != -1 && schoolType === school.type)
            schoolsToVisualize.push(elementsSchools)
        }
    })
};

function create_map() {
    mapWidth = 280
    mapHeight = 300
    document.getElementById("map_box").innerHTML = ""
    d3.json('counties.geojson').then(function (json) {
        projection = d3.geoEquirectangular()
            .scale(3800)
            .translate([mapWidth / 2, mapHeight / 2])
            .rotate([100, 0]);

        const translate = projection.translate();
        centroidCoordinates = projection([45.253333, -69.233333])
        xMod = centroidCoordinates[1]
        yMod = centroidCoordinates[0]
        projection.translate([
            translate[0] - xMod / 2.305,
            translate[1] + yMod / 3.255
        ]);


        // projection.translate([100, 0])
        // projection.scale(5)

        // path = d3.geoPath().projection(projection)

        // const svg = d3.select("#map_box").append('svg')
        //     .attr('width', mapWidth)
        //     .attr('height', mapHeight);

        // draw one svg path per zip code
        svg.append("path")
            .attr("d", path(json))
            .attr("fill", '#d3d3d3')
            .attr("stroke", "white")
            .attr("stroke-width", '1px')

        d3.csv(fileNamePath).then(function (schools) {
            const schoolsToVisualize = []
            for (let i = 0; i < totalMenus - 1; i++) {
                var schoolListElement = document.getElementById("school_list_" + i);
                var checkboxes = schoolListElement.querySelectorAll('input[type="checkbox"]:checked');
                schoolNames = []
                let schoolType = null
                for (const checkbox of checkboxes) {
                    returnValue = checkbox.value.split("$")
                    schoolNames.push(returnValue[0])
                    schoolType = returnValue[1]
                }
                elementsSchools = schools.filter(school => schoolNames.indexOf(school.name) != -1 && schoolType === school.type)
                schoolsToVisualize.push(elementsSchools)
            }

            ordinalColor = d3.scaleOrdinal()
                .domain(pathwayValueNames)
                .range(d3.schemeCategory10)

            const institutions = svg.append('g');
            // schoolType.selectAll('circle')
            //     .data(schoolsToVisualize)
            //     .join('circle')
            // .attr('fill', d => console.log(i), ordinalColor(d[0].type))
            // .attr('cx', d => projection[d.lon, d.lat][0])
            // .attr('cy', d => projection[d.lon, d.lat][1])
            // .attr('r', 10);

            if (schoolsToVisualize[0] != undefined) {
                let firstSchoolList = schoolsToVisualize.slice(0, schoolsToVisualize.length - 1)
                finalSchoolList = schoolsToVisualize[schoolsToVisualize.length - 1]
                firstSchoolList = d3.merge(firstSchoolList)
                firstSchoolList = firstSchoolList.map(d => ({ name: d.name, type: d.type, lonlat: projection([d.lon, d.lat]) }))
                finalSchoolList = finalSchoolList.map(d => ({ name: d.name, type: d.type, lonlat: projection([d.lon, d.lat]) }))

                let linksBetween = []

                for (let i = 0; i < firstSchoolList.length - 1; i++) {
                    linksBetween.push([firstSchoolList[i].type,
                    { lat: firstSchoolList[i].lonlat[1], lon: firstSchoolList[i].lonlat[0] },
                    { lat: firstSchoolList[i + 1].lonlat[1], lon: firstSchoolList[i + 1].lonlat[0] }
                    ])
                };

                let finalFirstSchool = firstSchoolList[firstSchoolList.length - 1]

                // let schoolLinks = d3.cross(, finalSchoolList)
                if (finalFirstSchool != undefined) {
                    let finalFirstSchoolLatLon = ({ lat: finalFirstSchool.lonlat[1], lon: finalFirstSchool.lonlat[0] })
                    finalSchoolsLatLon = finalSchoolList.map(d => ({ lat: d.lonlat[1], lon: d.lonlat[0] }))
                    let finalLinksBetween = finalSchoolsLatLon.map(d => [finalFirstSchool.type, finalFirstSchoolLatLon, d])

                    linksBetween = linksBetween.concat(finalLinksBetween)
                    // console.log(linksBetween)
                    // console.log(finalLinksBetween)
                }
                let schoolList = firstSchoolList.concat(finalSchoolList)



                // schools = institutions.selectAll('g')
                //     .data(firstSchoolList)
                //     .join('g')
                subsetInstitutions = svg.append("g")
                pathwaysInstitutions = svg.append('g')

                subsetInstitutions.selectAll('circle')
                    // row.circles contains the array circles for the row
                    .data(schoolList)
                    .join('circle')
                    .attr('fill', d => ordinalColor(d.type))
                    .attr('cx', d => d.lonlat[0])
                    .attr('cy', d => d.lonlat[1])
                    // .attr('r', d => 10 - getIndex(d.type))
                    .attr('r', 3)

                pathwaysInstitutions.selectAll('line')
                    .data(linksBetween)
                    .join('line')
                    .attr('x1', d => d[1].lon)
                    .attr('y1', d => d[1].lat)
                    .attr('x2', d => d[2].lon)
                    .attr('y2', d => d[2].lat)
                    .attr("stroke", d => ordinalColor(d[0]))
                    .attr("stroke-width", 2)




                // institutions.selectAll('circle')
                //     // row.circles contains the array circles for the row
                //     .data(finalSchoolList)
                //     .join('circle')
                //     .attr('fill', d => ordinalColor(d.type))
                //     .attr('cx', d => projection([d.lon, d.lat])[0])
                //     .attr('cy', d => projection([d.lon, d.lat])[1])
                //     // .attr('r', d => 10 - getIndex(d.type))
                //     .attr('r', 3)
            }




        })


    })

}

function getIndex(type) {
    return pathwayValueNames.indexOf(type)
}

function initialize() {
    create_menu(0, 0)
    // create_map()
    loadSimpleBoundaries();
}

function drawSimple(){
	//Simple jsons for the draw tool, plus the various world states and provinces within countries
	context.beginPath();
	path(landSimple);
    context.fillStyle=land_f_clr;
    context.fill();
	
	context.beginPath();
	path(boundarySimple);
	context.lineWidth=borders_l_width;
	context.strokeStyle=borders_s_clr;
	context.stroke();


	context.beginPath();
	path(states);
	context.lineWidth=borders_l_width;
	context.strokeStyle=borders_s_clr;
	context.stroke();
}

function loadSimpleBoundaries() {
	d3.json("world-110m.json").then(function (world) {
		boundarySimple = topojson.mesh(world, world.objects.countries);
		landSimple = topojson.feature(world, world.objects.land);
        console.log(landSimple);
        render_image();
	});
    d3.json("states_50m.json").then(function (world) {
		states = topojson.mesh(world, world.objects.ne_50m_admin_1_states_provinces,function(a,b){return a!==b});
	});
}

function reproject_image(){
    for (var y = 0, i = -1; y < dy; ++y) {
		for (var x = 0; x < dx; ++x) {
            targetData[++i] = base_r;
            targetData[++i] = base_g;
            targetData[++i] = base_b;	
            targetData[++i] = layer_transp;
        }
    }
}

function render_image() {
	//PRE:  Receives a boolean indicating either false (for simple) or true (for complex)
	//POST: Draws canvas with source image, then draws gridlines after it's been projected through the reproject_image function
	context.drawImage(image, 0, 0, width, height);
	
	//Sourceimage data
	sourceData=context.getImageData(0, 0, dx, dy).data,
		target=context.createImageData(dx, dy),			//target image data created from nothing (starts blank)
		targetData=target.data;
	
	//Simplified projection (displayType == 2 or simple) must be drawn simply
    reproject_image();

	//--- Redraw image data ------------------------
	context.putImageData(target, 0, 0);
	
	//--- Redraw map lines -------------------------
	drawSimple();
}


d3.select("#zoom_in").on("click", function () {
	if (scale < 0.75 * Math.pow(2, 6)) {
		scale *= 2;
		projection.scale(initialScale * scale);
        maineCenter = projection([-68.972168,45.367584]);
        console.log(maineCenter)
        projection.translate([center[0]+maineCenter[0],center[1]+maineCenter[1]/2]);
		render_image();
	}
});
d3.select("#zoom_out").on("click", function () {
	if (scale > 0.75 * Math.pow(2, -2)) {
		scale /= 2;
        projection.scale(initialScale * scale);
        maineCenter = projection([-68.972168,45.367584]);
        console.log(maineCenter)
        projection.translate([center[0]+maineCenter[0],center[1]+maineCenter[1]/2]);
		render_image();
	}
});

initialize();
