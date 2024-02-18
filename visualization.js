fileNamePath = "simplifiedSchools.csv"
pathwayValueNames = ["Elementary School", "Middle School","High School", "CTE", "Community College", "University/Colleges", "Graduate"]
pathwayValueRanks = [1, 2, 3, 4, 5, 6, 7]
pathwayValues = [pathwayValueNames, pathwayValueRanks]
totalMenus = 0


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
        console.log(schools)
        school_list = schools.filter(school => school.type === type)
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

        path = d3.geoPath().projection(projection)




        const svg = d3.select("#map_box").append('svg')
            .attr('width', mapWidth)
            .attr('height', mapHeight);

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
    create_map()
}
