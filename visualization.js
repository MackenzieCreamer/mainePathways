pathwayValueNames = ["Elementary School", "Middle School","High School", "CTE", "Community College", "University/Colleges", "Graduate"]
pathwayValueRanks = [1, 2, 3, 4, 5, 6, 7]
pathwayValues = [pathwayValueNames, pathwayValueRanks]
totalMenus = 0
var width,height;
var center;
var states, counties;
var schools, possiblePrograms;
var projection, path;

var lastBehavior = 0;
hovering = 0;

const land = "#d0ac7a"
const water = "rgba(0,95,153,255)"

window.onresize = resize;

d3.json("counties-10m.json").then(function (us) {
    states = topojson.feature(us, us.objects.states, (a, b) => a !== b)
    counties = topojson.feature(us, us.objects.counties, (a, b) => a !== b && (a.id / 1000 | 0) === (b.id / 1000 | 0))
    nation = topojson.feature(us, us.objects.nation);
    counties = new Object({type:"FeatureCollection",features:counties.features.filter(d => d.id.slice(0, 2) === "23")})
});

d3.json("world-50m.json").then(function (world) {
    landSimple = topojson.feature(world, world.objects.land)
});

d3.csv("simplifiedSchools.csv").then(function (includedSchools) {
    schools = includedSchools;
});

d3.csv("possiblePrograms.csv").then(function (programs) {
    possiblePrograms = programs;
});




function create_menu(indexOfElement, startingCutoff) {
    totalMenus += 1

    const currentElement = document.createElement("div")
    currentElement.setAttribute("id", "typesMenu_" + indexOfElement)
    currentElement.setAttribute("class", "inner_box")

    const menuBox = document.getElementById("menu_container")

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
    }

    var typeLabel = document.createElement("label");
    typeLabel.innerHTML = "Type of Institution: "
    typeLabel.htmlFor = "institutions";
    typeLabel.setAttribute("class", "dropdown_label");

    currentElement.appendChild(typeLabel).appendChild(schoolTypeSelect);
    schoolTypeSelect.value = ""

    schoolTypeSelect.onchange = function () {

        add_filters(schoolTypeSelect.value,indexOfElement)

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
    
    
    if(type == pathwayValues[0][0] || type == pathwayValues[0][1]){
        school_list = schools.filter(school => school.type === type)
    } else {
        currentElement = document.getElementById("typesMenu_" + indexOfElement);
        optionValue = currentElement.querySelector('input[name="selector"]:checked').value;
        filter1Value = document.getElementById("filter1_" + indexOfElement).value
        filter2Value = document.getElementById("filter2_" + indexOfElement).value
        if(filter1Value == "" && filter2Value == "")
            school_list = schools.filter(school => school.type === type)
        else if(filter1Value != "" && filter2Value == "")
            school_list = schools.filter(school => school.type === type && (school.program.includes(filter1Value)))
        else if(filter1Value == "" && filter2Value != "")
            school_list = schools.filter(school => school.type === type && (school.program.includes(filter2Value)))
        else if(optionValue == "Or")
            school_list = schools.filter(school => school.type === type && (school.program.includes(filter1Value) || school.program.includes(filter2Value)))
        else
            school_list = schools.filter(school => school.type === type && (school.program.includes(filter1Value) && school.program.includes(filter2Value)))

    }

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
        listElement.onmouseover = function(){
            if(hovering == 0){
                let [schoolName,schoolType] = this.firstChild.value.split("$")
                let svg = d3.select("#map_container")
                svg = svg.select("svg")
                elementsSchools = schools.filter(school => schoolName === school.name && schoolType === school.type)

                singleSchool = elementsSchools[0]

                let [cxPos,cyPos] = projection([singleSchool.lon,singleSchool.lat])
            
                svg.append('circle')
                    .attr('fill', ordinalColor(singleSchool.type))
                    .attr('cx', cxPos)
                    .attr('cy', cyPos)
                    // .attr('r', d => 10 - getIndex(d.type))
                    .attr('stroke','black')
                    .attr("stroke-width",1)
                    .attr('r', 10)
                    .style("opacity","50%")
            }
            hovering = 1


        }
        listElement.onmouseleave = function(){
            create_map(lastBehavior)
            hovering = 0
        }
        schoolCount += 1
        schoolListElement.appendChild(listElement)
    }
}

function add_filters(type, indexOfElement){
    const currentElement = document.getElementById("typesMenu_" + indexOfElement)
    var filtersSelection = document.getElementById("filtersSelection_" + indexOfElement);
    if(filtersSelection != null){
        filtersSelection.remove()
    }
    if(!(type == pathwayValues[0][0] || type == pathwayValues[0][1])){
        filtersSelection = document.createElement("div")

        filtersSelection.id = "filtersSelection_" + indexOfElement;
    
        let filter1 = document.createElement("select");
        filter1.name = "programFilter1"
        filter1.id = "filter1_" + indexOfElement
        filter1.setAttribute("class", "types_dropdown")

        let filter2 = document.createElement("select");
        filter2.name = "programFilter2"
        filter2.id = "filter2_" + indexOfElement
        filter2.setAttribute("class", "types_dropdown")
    
        if(type != null){
            let program_list = possiblePrograms.filter(program => program.types === type)
            program_list = program_list[0].programs.replace(/['"]+/g, '')
            program_list = program_list.replace(/[\[\]]/g,'');
            program_list = program_list.split(',');
            for (const program of program_list) {
                var programOption1 = document.createElement("option");
                var programOption2 = document.createElement("option");
                programOption1.value = program.trim();
                programOption1.text = program.trim();
                programOption2.value = program.trim();
                programOption2.text = program.trim();
                filter1.appendChild(programOption1);
                filter2.appendChild(programOption2);
            }
        }
        filter1.value = ""
        filter2.value = ""
        
            
        var programLabel = document.createElement("label");
        programLabel.innerHTML = "Programs of Interest: "
        programLabel.htmlFor = "programs";
        programLabel.setAttribute("class", "dropdown_label");
        radioButtonContainer = document.createElement("fieldset")
    
        for (const option of ["Or","And"]){
            radioButton = document.createElement("div")
            radioInput = document.createElement("input")
            radioLabel = document.createElement("label")
            radioInput.type = "radio"
            radioInput.name = "selector"
            radioInput.value = option
            if(option === "Or"){
                radioInput.checked = true;
            }
            radioLabel.for = option
            radioLabel.innerHTML = option
            radioButton.appendChild(radioInput)
            radioButton.appendChild(radioLabel)
            radioButtonContainer.appendChild(radioButton)
        }
        
        radioButtonContainer.classList.add("radioButtonsContainer")

        filtersSelection.appendChild(programLabel)
        
        optionsBox = document.createElement("div")
        optionsBox.classList.add("filterOptionsBox")
        optionsBox.appendChild(filter1)
        optionsBox.appendChild(radioButtonContainer)
        optionsBox.appendChild(filter2)
        filtersSelection.appendChild(optionsBox)
        filtersSelection.classList.add("filtersContainer")

        filtersSelection.onchange = function () {
            create_school_list(type, indexOfElement)
        }

        currentElement.append(filtersSelection)
    

    }
}

function create_map(onClick = 0) {
    lastBehavior = onClick
    document.getElementById("map_container").innerHTML = ""

    const svg = d3.select("#map_container").append('svg')
        .attr('width', height)
        .attr('height', height)
    
    svg.append("rect")
        .attr("width","100%")
        .attr("height","100%")
        .attr("fill",water);

    svg.append("path")
        .attr("d",path(landSimple))
        .attr("fill", land)
        .attr("stroke", "gray")
        .attr("stroke-width", '1px')

    svg.append("path")
        .attr("d", path(states))
        .attr("fill", land)
        .attr("stroke", "gray")
        .attr("stroke-width", '1px')

        
    // draw one svg path per zip code
    svg.append("path")
        .attr("d", path(counties))
        .attr("fill", land)
        .attr("stroke", "gray")
        .attr("stroke-width", '.5px')

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
        }
        let schoolList = firstSchoolList.concat(finalSchoolList)

        subsetInstitutions = svg.append("g")
        pathwaysInstitutions = svg.append('g')
        if(lastBehavior == 1){
            pathwaysInstitutions.selectAll('line')
            .data(linksBetween)
            .join('line')
            .attr('x1', d => d[1].lon)
            .attr('y1', d => d[1].lat)
            .attr('x2', d => d[2].lon)
            .attr('y2', d => d[2].lat)
            .attr("stroke", d => ordinalColor(d[0]))
            .attr("stroke-width", 2)
        }

        subsetInstitutions.selectAll('circle')
            // row.circles contains the array circles for the row
            .data(schoolList)
            .join('circle')
            .attr('fill', d => ordinalColor(d.type))
            .attr('cx', d => d.lonlat[0])
            .attr('cy', d => d.lonlat[1])
            // .attr('r', d => 10 - getIndex(d.type))
            .attr('stroke','black')
            .attr("stroke-width",1)
            .attr('r', 4);
    }
}

function getIndex(type) {
    return pathwayValueNames.indexOf(type)
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function initialize() {
    resize()
    create_menu(0, 0)
    create_map()
}
sleep(1000).then(() => { initialize(); });

function projectionReset(){
    projection = d3.geoTransverseMercator()
        .translate(center)
        .rotate([69.14, -45.2])
        .scale(3800)
    path = d3.geoPath().projection(projection)
}

function resize(){
    height = window.innerHeight/2
    if(height<300)
        height = 300
    width = window.innerWidth/2
    center = [height/2,height/2]
    menuCon = document.getElementById("menu_container")
    mapCon = document.getElementById("map_container")
    mapCon.style.height = String(height)+"px"
    mapCon.style.width = String(height)+"px"
    menuCon.style.height = String(height)+"px"
    projectionReset()
    create_map()
}