document.getElementById("legend_selection").value = "visualizeClick"

var alreadyInitialized = false;

var pathwayValueNames,pathwayValueRanks,pathwayValues,pathwayValueReversed,placeHolder;
var map,overlay,osmLayer,svgMap,gMap,mapTransform,mapPath,projectPoint,feature

blockedLegends = []
totalMenus = 0
var width,height;
var center;
var states, counties;
var schools, possiblePrograms;
var previousCoordinates;

var lastBehavior = 0;
hovering = 0;
clicked = [];

// Make an array of nodes to display of lower opacity
var display_legend_elements = {"Elementary School":"none",
    "Middle School":"none",
    "High School":"none",
    "HS STEM Program":"none",
    "CTE":"none",
    "Community College":"none",
    "University/Colleges":"none",
    "Undergrad STEM Program":"none",
    "Graduate":"none",
    "Research Institute":"none",
    "Company":"none"
}

d3.json("counties-10m.json").then(function (us) {
    states = topojson.feature(us, us.objects.states, (a, b) => a !== b)
    counties = topojson.feature(us, us.objects.counties, (a, b) => a !== b && (a.id / 1000 | 0) === (b.id / 1000 | 0))
    nation = topojson.feature(us, us.objects.nation);
    counties = new Object({type:"FeatureCollection",features:counties.features.filter(d => d.id.slice(0, 2) === "23")})
});

window.onresize = resize;

d3.csv("simplifiedSchools.csv").then(function (includedSchools) {
    schools = includedSchools;
    // name,address,lat,lon,type,program,link
    schools = schools.map(d=> {
        const coordinates = [d.lon,d.lat];
        return {
            ...d,
            latlng: new L.LatLng(coordinates[1],coordinates[0])
        }
    })
});

d3.csv("possiblePrograms.csv").then(function (programs) {
    possiblePrograms = programs;
});

function create_menu(indexOfElement, startingCutoff,type="") {
    totalMenus += 1
    clicked.push(0)

    const currentElement = document.createElement("div")
    currentElement.setAttribute("id", "typesMenu_" + indexOfElement)
    currentElement.setAttribute("class", "inner_box")

    const menuBox = document.getElementById("menu_container")

    menuBox.append(currentElement)

    var schoolTypeSelect = document.createElement("select");
    schoolTypeSelect.name = "schoolTypesDropdown";
    schoolTypeSelect.id = "typesDropdown" + indexOfElement;
    schoolTypeSelect.setAttribute("class", "types_dropdown")

    if(type===""){
        for (const elemType of pathwayValues[0].slice(startingCutoff, pathwayValues[0].length)) {
            var schoolOption = document.createElement("option");
            schoolOption.value = elemType;
            schoolOption.text = elemType;
            schoolTypeSelect.appendChild(schoolOption);
        }
    } else {
        var schoolOption = document.createElement("option");
        schoolOption.value = type;
        schoolOption.text = type;
        schoolTypeSelect.appendChild(schoolOption);
    }

    var typeLabel = document.createElement("label");
    typeLabel.innerHTML = "Type of Institution: "
    typeLabel.htmlFor = "institutions";
    typeLabel.setAttribute("class", "dropdown_label");

    headerInfo = document.createElement("div")
    headerInfo.setAttribute("id","header_"+indexOfElement)
    headerInfo.setAttribute("class","options-header")

    typeLabel.appendChild(schoolTypeSelect)
    headerInfo.appendChild(typeLabel)

    currentElement.appendChild(headerInfo);
    schoolTypeSelect.value = type
    if(schoolTypeSelect.value != ""){
        add_filters(schoolTypeSelect.value,indexOfElement)

        pathwayNameIndex = pathwayValues[0].indexOf(schoolTypeSelect.value)

        valueRank = pathwayValues[1][pathwayNameIndex]

        newCutoffIndex = pathwayValues[1].indexOf(valueRank, 0)

        nextElement = indexOfElement + 1

        create_school_list(schoolTypeSelect.value, indexOfElement)

        var buttonToVisualizeAll = document.getElementById("all_button_" + indexOfElement);
        if (buttonToVisualizeAll != null) {
            buttonToVisualizeAll.remove()
        }
    
            var buttonToVisualizeAll = document.createElement("div")
            buttonToVisualizeAll.setAttribute("class","visualizeAllButton")
            buttonToVisualizeAll.setAttribute("id","all_button_" + indexOfElement)
            buttonToVisualizeAll.onclick = function() {
                this.style.backgroundColor = "rgb(126, 126, 126)";
                // Toggle button goes here, automatically turns off when something else is clicked
                selectedElement = d3.select("#legend_"+(pathwayValueNames.indexOf(schoolTypeSelect.value)+1))
                if(clicked[indexOfElement] == 0) {
                    clicked[indexOfElement] = 1
                    listSelected = this.parentElement.querySelectorAll('input[type="checkbox"]')
                    listSelected = Array.prototype.slice.call(listSelected).map(d => d.id)
                    
                    schoolNames = []
                    
                    let schoolsToVisualize = []
                    let schoolType = null
                    for (const checkbox of listSelected) {
                        returnValue = document.getElementById(checkbox).value.split("$")
                        schoolNames.push(returnValue[0])
                        schoolType = returnValue[1]
                    }
                    elementsSchools = schools.filter(school => schoolNames.indexOf(school.name) != -1 && schoolType === school.type)
                    schoolsToVisualize.push(elementsSchools)
                    
                    display_legend_elements[schoolTypeSelect.value] = schoolsToVisualize
                    selectedElement.attr("fill","gainsboro")
                } else {
                    clicked[indexOfElement] = 0
                    display_legend_elements[schoolTypeSelect.value] = "none"
                    this.style.backgroundColor = "gainsboro";
                    selectedElement.attr("fill","transparent")
                }
                create_map()
            }
            
            buttonToVisualizeAll.innerHTML = "Visualize All"

            currentElement.appendChild(buttonToVisualizeAll)
            clicked = clicked.slice(0,newCutoffIndex)
            clicked[indexOfElement] = 0
            document.getElementById("all_button_"+indexOfElement).style.backgroundColor = "gainsboro"
    }

    schoolTypeSelect.onchange = function () {
        add_filters(schoolTypeSelect.value,indexOfElement)

        pathwayNameIndex = pathwayValues[0].indexOf(schoolTypeSelect.value)

        valueRank = pathwayValues[1][pathwayNameIndex]

        newCutoffIndex = pathwayValues[1].indexOf(valueRank, 0)

        nextElement = indexOfElement + 1

        create_school_list(schoolTypeSelect.value, indexOfElement)

        var buttonToVisualizeAll = document.getElementById("all_button_" + indexOfElement);
        if (buttonToVisualizeAll != null) {
            buttonToVisualizeAll.remove()
        }
    
        var buttonToVisualizeAll = document.createElement("div")
        buttonToVisualizeAll.setAttribute("class","visualizeAllButton")
        buttonToVisualizeAll.setAttribute("id","all_button_" + indexOfElement)
        buttonToVisualizeAll.onclick = function() {
            this.style.backgroundColor = "rgb(126, 126, 126)";
            // Toggle button goes here, automatically turns off when something else is clicked
            selectedElement = d3.select("#legend_"+(pathwayValueNames.indexOf(schoolTypeSelect.value)+1))
            if(clicked[indexOfElement] == 0) {
                clicked[indexOfElement] = 1
                listSelected = this.parentElement.querySelectorAll('input[type="checkbox"]')
                listSelected = Array.prototype.slice.call(listSelected).map(d => d.id)
                
                schoolNames = []
                
                let schoolsToVisualize = []
                let schoolType = null
                for (const checkbox of listSelected) {
                    returnValue = document.getElementById(checkbox).value.split("$")
                    schoolNames.push(returnValue[0])
                    schoolType = returnValue[1]
                }
                elementsSchools = schools.filter(school => schoolNames.indexOf(school.name) != -1 && schoolType === school.type)
                schoolsToVisualize.push(elementsSchools)
                display_legend_elements[schoolTypeSelect.value] = schoolsToVisualize
                if(document.getElementById("legend_selection").value!="menuCreation")
                    selectedElement.attr("fill","gainsboro")
            } else {
                clicked[indexOfElement] = 0
                display_legend_elements[schoolTypeSelect.value] = "none"
                this.style.backgroundColor = "gainsboro";

                if(document.getElementById("legend_selection").value!="menuCreation"){
                    selectedElement.attr("fill","transparent")
                }
            }
            create_map()
        }
        
        buttonToVisualizeAll.innerHTML = "Visualize All"

        currentElement.appendChild(buttonToVisualizeAll)
        clicked = clicked.slice(0,newCutoffIndex)
        clicked[indexOfElement] = 0
        document.getElementById("all_button_"+indexOfElement).style.backgroundColor = "gainsboro"

    delete_old_menus(nextElement)

    if(document.getElementById("legend_selection").value==="visualizeClick")
        create_menu(nextElement, newCutoffIndex) //Update this to be on visualization or node plot, not for dropdown changes
    create_map()
    }
}

function delete_old_menus(nextElement) {
    for (let i = nextElement, oldTotal = totalMenus; i < oldTotal; i++) {
        type = document.getElementById("typesDropdown" + i).value
        element = document.getElementById("all_button_" + i)
        if(element!==null)
            if (window.getComputedStyle(element,null).getPropertyValue('background-color')=="rgb(126, 126, 126)") {
                display_legend_elements[type] = "none"
                d3.select("#legend_" + pathwayValueNames.indexOf(type)).attr("fill","transparent")
            }
        document.getElementById("typesMenu_" + i).remove();
        totalMenus -= 1
    }
}

function create_school_list(type, indexOfElement) {
    var schoolListElement = document.getElementById("school_list_" + indexOfElement);
    if (schoolListElement != null) {
        let child = schoolListElement.lastElementChild;
        while (child) {
            schoolListElement.removeChild(child);
            child = schoolListElement.lastElementChild;
        }
    } else {
        schoolListElement = document.createElement("ul")
        document.getElementById("typesMenu_" + indexOfElement).appendChild(schoolListElement);
        schoolListElement.setAttribute('id', "school_list_" + indexOfElement)
        schoolListElement.setAttribute('class', "school_list")
    }    
    
    if(type == "Elementary School" || type == "Middle School" || type == "HS STEM Program" || type == "Undergrad STEM Program" || type == "Research Institute"){
        school_list = schools.filter(school => school.type === type)
    } else {
        currentElement = document.getElementById("typesMenu_" + indexOfElement);
        optionValue = currentElement.querySelector('input[name="selector_' + indexOfElement + '"]:checked').value;
        optionValue2 = currentElement.querySelector('input[name="selector2_' + indexOfElement + '"]:checked').value;
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

        if(indexOfElement!=0 && optionValue2 == "Dist."){
            var potentialSchoolList = document.getElementById("school_list_" + (indexOfElement-1));
            var checkboxes = potentialSchoolList.querySelectorAll('input[type="checkbox"]:checked');
            last_school = checkboxes[checkboxes.length-1]
            if(last_school !== undefined){
                returnValue = last_school.value.split("$")
                last_school_name = returnValue[0]
                last_school_name_type = returnValue[1]
                elementsSchool = schools.filter(school => last_school_name === school.name && last_school_name_type === school.type)[0]
                var cLat = parseFloat(elementsSchool.lat),cLon = parseFloat(elementsSchool.lon);
                school_list.sort(function(a,b){
                    var [aXPos,aYPos] = [a.lon,a.lat]
                    var [bXPos,bYPos] = [b.lon,b.lat]
                    let [cXPos,cYPos] = [cLon,cLat]
                    
                    distanceA = Math.sqrt((cXPos-aXPos)**2+(cYPos-aYPos)**2)
                    distanceB = Math.sqrt((cXPos-bXPos)**2+(cYPos-bYPos)**2)
    
                    return (distanceA > distanceB) - (distanceA < distanceB)
                })
            } else {
                alert("You have selected distance sorting with no prior school selected, please don't.")
            }
        }
    }
    schoolCount = 0
    for (const school of school_list) {
        listElement = document.createElement("li")
        var schoolOption = document.createElement("INPUT");
        schoolOption.value = school.name + "$" + school.type;
        schoolOption.setAttribute("type", "checkbox")
        schoolOption.setAttribute("id", "school" + indexOfElement + "_" + schoolCount)
        var schoolLabel = document.createElement("label");
        labelName = document.createElement("p")
        labelAddress = document.createElement("p")
        labelName.setAttribute("class","label_name")
        labelAddress.setAttribute("class","label_address")

        components = school.address.split(',')
        addressBreakdown = ""
        if(components.length > 3){
            addressBreakdown = components[0] + "<br>" + components[2] + ", " + components[3]
        } else {
            addressBreakdown = components[0] + "<br>" + components[1] + ", " + components[2]
        }

        labelName.innerHTML = school.name
        labelAddress.innerHTML = addressBreakdown

        schoolLabel.appendChild(labelName)
        schoolLabel.appendChild(labelAddress)

        schoolLabel.htmlFor = "school" + indexOfElement + "_" + schoolCount;
        listElement.appendChild(schoolOption)
        listElement.appendChild(schoolLabel)
        listElement.onmouseover = function(){
            
            listSelected = this.parentElement.querySelectorAll('input[type="checkbox"]:checked')
            listSelected = Array.prototype.slice.call(listSelected).map(d => d.id)
            childID = this.firstChild.id
            
            if(hovering == 0){

                let [schoolName,schoolType] = this.firstChild.value.split("$")
                let svg = d3.select("#map_container")
                svg = svg.select("svg")
                elementsSchools = schools.filter(school => schoolName === school.name && schoolType === school.type)

                singleSchool = elementsSchools[0]

                let cPos = map.latLngToLayerPoint(singleSchool.latlng)
                let [cxPos,cyPos] = [cPos.x,cPos.y]
                let opacity = "50%";
                if (listSelected.includes(childID)){
                    gMap.append("svg:image")
                        .attr("class","hover")
                        .attr('width',50)
                        .attr('height',50)
                        .attr('x', cxPos-25)
                        .attr('y', cyPos-25)
                        .attr("xlink:href","images/inst"+typeToIndex(singleSchool.type)+".svg")
                        .attr("style", "outline: thin solid black; border-radius:100px;")
                } else {
                    gMap.append('circle')
                    .attr("class","hover")
                    .attr('fill', ordinalColor(singleSchool.type))
                    .attr('cx', cxPos)
                    .attr('cy', cyPos)
                    .attr('stroke','black')
                    .attr("stroke-width",1)
                    .attr('r', 10)
                    .style("opacity",opacity)
                }
            }
            hovering = 1
        }
        listElement.onmouseleave = function(){
        d3.select("#map_container").selectAll(".hover").remove()
            hovering = 0
        }
        listElement.onclick = function(){
            clicked[indexOfElement] = 0
            create_map()
        if(!(type == "Elementary School" || type == "Middle School" || type == "HS STEM Program" || type == "Undergrad STEM Program" || type == "Research Institute")){
            document.getElementById("all_button_"+indexOfElement).style.backgroundColor = "gainsboro"
        }
    }
        schoolCount += 1
        schoolListElement.appendChild(listElement)
    }
}

function add_filters(type, indexOfElement){
    const currentElement = document.getElementById("header_" + indexOfElement)
    var filtersSelection = document.getElementById("filtersSelection_" + indexOfElement);
    if(filtersSelection != null){
        filtersSelection.remove()
    }
    if(!(type == "Elementary School" || type == "Middle School" || type == "HS STEM Program" || type == "Undergrad STEM Program" || type == "Research Institute")){
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
            var programOption1 = document.createElement("option");
            var programOption2 = document.createElement("option");
            programOption1.value = ""
            programOption1.text = ""
            programOption2.value = ""
            programOption2.text = ""
            filter1.appendChild(programOption1);
            filter2.appendChild(programOption2);
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
        if(type==="High School"){
            programLabel.innerHTML = "AP Courses"
        } else if(type==="Company"){
            programLabel.innerHTML = "Industry"
        } else {
            programLabel.innerHTML = "Programs"
        }
        
        programLabel.htmlFor = "programs";
        programLabel.setAttribute("class", "dropdown_label");
        radioButtonContainer = document.createElement("fieldset")
        radioButtonContainer.setAttribute("id","field_container_"+indexOfElement)
    
        for (const option of ["Or","And"]){
            radioButton = document.createElement("div")
            radioInput = document.createElement("input")
            radioLabel = document.createElement("label")
            radioInput.type = "radio"
            radioInput.name = "selector_" + indexOfElement
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

        radioButtonContainer2 = document.createElement("fieldset")
    
        for (const option of ["A-Z","Dist."]){
            radioButton = document.createElement("div")
            radioInput = document.createElement("input")
            radioLabel = document.createElement("label")
            radioInput.type = "radio"
            radioInput.name = "selector2_" + indexOfElement
            radioInput.value = option
            if(option === "A-Z"){
                radioInput.checked = true;
            }
            radioLabel.for = option
            radioLabel.innerHTML = option
            radioButton.appendChild(radioInput)
            radioButton.appendChild(radioLabel)
            radioButtonContainer2.appendChild(radioButton)
        }
        radioButtonContainer2.classList.add("radioButtonsContainer")


        // filtersSelection.appendChild(programLabel)
        
        optionsBox = document.createElement("div")
        optionsBox.classList.add("filterOptionsBox")
        optionsBox.appendChild(programLabel)
        optionsBox.appendChild(filter1)
        optionsBox.appendChild(radioButtonContainer)
        optionsBox.appendChild(filter2)
        optionsBox.appendChild(radioButtonContainer2)
        filtersSelection.appendChild(optionsBox)
        filtersSelection.classList.add("filtersContainer")

        filtersSelection.onchange = function () {
            document.getElementById("all_button_"+indexOfElement).style.backgroundColor = "gainsboro"
            d3.select("#map_container").selectAll("circle.clickedVisualization_"+indexOfElement).remove()
            create_school_list(type, indexOfElement)
            clicked[indexOfElement] = 0
        }

        currentElement.append(filtersSelection)
    

    }
}

function create_map(onClick = 0) {
    lastBehavior = onClick
    d3.selectAll(".mapElement").remove();

    const schoolsToVisualize = []
    bounds = totalMenus
    if(document.getElementById("legend_selection").value==="visualizeClick")
        bounds = totalMenus - 1
    for (let i = 0; i < bounds; i++) {
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

    schoolsToPreview = []
    for(const name of pathwayValueNames){
        if(display_legend_elements[name] === "all") {
            previewSchoolList = schools.filter(school => name === school.type)
            previewSchoolList = previewSchoolList.slice(0, previewSchoolList.length)
            schoolsToPreview.push(previewSchoolList)
        } else if(display_legend_elements[name] !== "none") {
            previewSchoolList = display_legend_elements[name]
            previewSchoolList = previewSchoolList.slice(0, previewSchoolList.length)
            schoolsToPreview.push(previewSchoolList[0])
        }
    }
    schoolsToPreview = schoolsToPreview.flat().map(d => ({ name: d.name, address:d.address, type: d.type, lonlat: map.latLngToLayerPoint(d.latlng) }))

    if(schoolsToPreview[0]!=undefined){
        previewVisualizations = gMap.append("g")
        previewVisualizations.selectAll('image')
            // row.circles contains the array circles for the row
            .data(schoolsToPreview)
                .enter()
                .append("svg:image")
                .attr('width',14)
                .attr('height',14)
                .attr("xlink:href",d => "images/inst"+typeToIndex(d.type)+".svg")
                .attr('x',d => d.lonlat.x - 7)
                .attr('y',d => d.lonlat.y - 7)
                .attr("style", "outline: 1px solid black; border-radius:100px;")
                .attr("opacity","50%")
                .attr("class","mapElement")
    }
    

    if (schoolsToVisualize[0] != undefined) {
        let firstSchoolList = schoolsToVisualize.slice(0, schoolsToVisualize.length - 1)
        finalSchoolList = schoolsToVisualize[schoolsToVisualize.length - 1]
        firstSchoolList = d3.merge(firstSchoolList)
        firstSchoolList = firstSchoolList.map(d => ({ name: d.name, address:d.address, type: d.type, lonlat: map.latLngToLayerPoint(d.latlng) }))
        finalSchoolList = finalSchoolList.map(d => ({ name: d.name, address:d.address, type: d.type, lonlat: map.latLngToLayerPoint(d.latlng) }))

        let linksBetween = []

        for (let i = 0; i < firstSchoolList.length - 1; i++) {
            linksBetween.push([firstSchoolList[i].type,
            { lat: firstSchoolList[i].lonlat.y, lon: firstSchoolList[i].lonlat.x },
            { lat: firstSchoolList[i + 1].lonlat.y, lon: firstSchoolList[i + 1].lonlat.x }
            ])
        };

        let finalFirstSchool = firstSchoolList[firstSchoolList.length - 1]

        if (finalFirstSchool != undefined) {
            let finalFirstSchoolLatLon = ({ lat: finalFirstSchool.lonlat.y, lon: finalFirstSchool.lonlat.x })
            finalSchoolsLatLon = finalSchoolList.map(d => ({ lat: d.lonlat.y, lon: d.lonlat.x }))
            let finalLinksBetween = finalSchoolsLatLon.map(d => [finalFirstSchool.type, finalFirstSchoolLatLon, d])

            linksBetween = linksBetween.concat(finalLinksBetween)
        }
        let schoolList = firstSchoolList.concat(finalSchoolList)

        if(lastBehavior == 1){
            pathwaysInstitutions = gMap.append('g')
            pathwaysInstitutions.selectAll('line')
                .data(linksBetween)
                .join('line')
                .attr('x1', d => d[1].lon)
                .attr('y1', d => d[1].lat)
                .attr('x2', d => d[2].lon)
                .attr('y2', d => d[2].lat)
                .attr("stroke", d => ordinalColor(d[0]))
                .attr("stroke-width", 6)
                .attr("class","mapElement")    
        }

        var tooltip = d3.select("#map_container")
            .append("div")
            .style("position", "absolute")
            .style("opacity", 0)
            .attr("class", "tooltip")
            .style("background-color", "white")
            .style("border", "solid")
            .style("border-width", "2px")
            .style("border-radius", "5px")
            .style("padding", "5px")

        var mouseover = function(d) {
            tooltip.style("opacity", 1)
            }
        var mousemove = function(d,school) {
            components = school.address.split(',')
            addressBreakdown = ""
            if(components.length > 3){
                addressBreakdown = components[0] + "<br>" + components[2] + ", " + components[3]
            } else {
                addressBreakdown = components[0] + "<br>" + components[1] + ", " + components[2]
            }
            fullHTML = school.name + "<br>" + addressBreakdown

            tooltip.html(fullHTML)
                .style("top", (d.pageY+10)+"px")
                .style("left",(d.pageX+10)+"px")
            }
        var mouseleave = function(d) {
            tooltip.style("opacity", 0)
        }

        if(schoolsToVisualize.length!=0){
            subsetInstitutions = gMap.append("g")
            subsetInstitutions.selectAll('image')
                // row.circles contains the array circles for the row
                .data(schoolList)
                .enter()
                    .append("svg:image")
                    .attr('width',40)
                    .attr('height',40)
                    .attr("xlink:href",d => "images/inst"+typeToIndex(d.type)+".svg")
                    .attr('x',d => d.lonlat.x - 20)
                    .attr('y',d => d.lonlat.y - 20)
                    .attr("style", "outline: thin solid black; border-radius:100px;")
                    .attr("class","mapElement")
                    .on("mouseover", mouseover)
                    .on("mousemove", mousemove)
                    .on("mouseleave", mouseleave)
        }

        
    }
}

function getIndex(type) {
    return pathwayValueNames.indexOf(type)
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function initialize() {
    arraySetup()
    d3.select(".leaflet-map-pane").classed("hidden",false)

    if(!alreadyInitialized){
        alreadyInitialized = true
        map = new L.Map("map_container", {center: [45.2, -69.14], zoom: 7})

        osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(map); 
            
        //initialize svg to add to map
        L.svg({clickable:true}).addTo(map) // we have to make the svg layer clickable 
        //Create selection using D3
        overlay = d3.select(map.getPanes().overlayPane)
    
        
        svgMap = d3.select(map.getPanes().overlayPane).append("svg"),
        gMap = svgMap.append("g").attr("class", "leaflet-zoom-hide");
    
        projectPoint = function(x, y) {
            const point = map.latLngToLayerPoint(new L.LatLng(y, x))
            this.stream.point(point.x, point.y)
        }
    
    
        mapTransform = d3.geoTransform({point: projectPoint}),
        mapPath = d3.geoPath().projection(mapTransform);
        map.on("zoomend", reset);
    
    
        feature = gMap.selectAll("path")
            .data(counties.features)
            .enter().append("path");
        reset();

    }
    delete_old_menus(0)
    blockedLegends=[]
    if(document.getElementById("legend_selection").value==="visualizeClick"){
        create_menu(0, 0)
    }
}
    

function projectionReset(lon=-69.14,lat=45.2){
    projection = d3.geoTransverseMercator()
        .translate(center)
        .rotate([-lon, -lat])
        .scale(scale)
    path = d3.geoPath().projection(projection)
}

function resize(){
    height = window.innerHeight/4*3
    if(height<500)
        height = 500
    width = window.innerWidth/2
    center = [height/2,height/2]
    menuCon = document.getElementById("menu_container")
    mapCon = document.getElementById("map_container")
    legendCon = document.getElementById("legend_container")
    legendViz = document.getElementById("legend_visualization")
    mapCon.style.height = String(height)+"px"
    mapCon.style.width = String(height)+"px"
    menuCon.style.height = String(height)+"px"
    legendCon.style.height = String(height)+"px"
    legendViz.style.height = String(height-110)+"px"
    create_map()
    create_legend()
}

function typeToIndex(type){
    return pathwayValueNames.indexOf(type) + 1
}

function create_legend(){
    container = d3.select("#legend_visualization")
    container.html("")
    legendHeight = height
    if(typeof svg !== "undefined"){
        svg = undefined
    }
    svg = container.append('svg')
        .attr('height', 50*pathwayValueReversed.length)
        .attr('width', 250);
        
    var elem = svg.selectAll("g")
        .data(placeHolder)

    var onClick = function(d,name) {
        const matches = document.querySelectorAll("select.types_dropdown");
        typeMatch = []
        for(const match of matches){
            if(match.value===name)
                typeMatch.push(match.parentElement.parentElement.parentElement.getElementsByClassName("visualizeAllButton")[0])
        }
        selectedElement = d3.select("#"+this.firstChild.id)
        elementID = this.firstChild.id
        elementIndex = elementID.substring(elementID.length-1)
        if(document.getElementById("legend_selection").value==="visualizeClick"){
            if(display_legend_elements[name]==="all"){
                display_legend_elements[name]="none"
                selectedElement.attr("fill","transparent")
                for(const element of typeMatch){
                    element.style.backgroundColor = "gainsboro"
                }
            } else if(display_legend_elements[name]==="none"){
                display_legend_elements[name]="all"
                selectedElement.attr("fill","gainsboro")
                for(const element of typeMatch){
                    element.style.backgroundColor = "rgb(126, 126, 126)"
                }
            } else {
                display_legend_elements[name]="none"
                selectedElement.attr("fill","transparent")
                for(const element of typeMatch){
                    element.style.backgroundColor = "gainsboro"
                }
            }
        } else {
            if(blockedLegends.indexOf(parseInt(elementIndex)) === -1 ){
                blockedLegends = []
                for (const i of Array.from({length: elementIndex}, (_, i) => i + 1)) {
                    selectedElement = d3.select("#legend_" + i)
                    selectedElement.attr("fill","gainsboro")
                    blockedLegends.push(i)
                }
                create_menu(totalMenus,0,name)
            }
        }
        create_map()
    }

    var elemEnter = elem.enter()
        .append('g')
        .attr("transform",function(d,i){return "translate(10," + (1+50*i) + ")"})
        .on("click",onClick)
        .classed("legendBoxes",true)

    elemEnter.append('rect')
        .attr('x',0)
        .attr('y',0)
        .attr("stroke", "black")
        .attr("border-radius","100px")
        .attr("fill","transparent")
        .attr("width","90%")
        .attr("height","46px")
        .attr("id", function(d,i){var result = 'legend_'+typeToIndex(d); return result; })
    
    elemEnter.append("svg:image")
          .attr("width", 40)
          .attr('height',40)
          .attr('x',3)
          .attr('y',3)
          .attr("style", "outline: thin solid black; border-radius:100px;")
          .attr("xlink:href",d => "images/inst"+typeToIndex(d)+".svg")
        
    elemEnter.append('text')
        .attr('dx',50)
        .attr('dy',28)
        .attr("class","no-select")
        .text(d => d)
}

function selectionChange(){
    value = document.getElementById("legend_selection").value
    for(const name of pathwayValueNames){
        display_legend_elements[name] = "none"
    }
    for (const i of Array(pathwayValueNames.length+1).keys()) {
        selectedElement = d3.select("#legend_" + i)
        selectedElement.attr("fill","transparent")
    }
    delete_old_menus(0)
    create_map()
    if(value==="menuCreation"){
        blockedLegends=[]
    } else if(value==="visualizeClick"){
        create_menu(0, 0)
    }
};

function reset() {
    var bounds = mapPath.bounds(counties),
        topLeft = bounds[0],
        bottomRight = bounds[1];

    topLeft[0] -= 50000
    topLeft[1] -= 50000

    bottomRight[0] += 50000
    bottomRight[1] += 50000

    svgMap.attr("width", bottomRight[0] - topLeft[0])
        .attr("height", bottomRight[1] - topLeft[1])
        .style("left", topLeft[0] + "px")
        .style("top", topLeft[1] + "px");

    gMap.attr("transform", "translate(" + -topLeft[0] + "," + -topLeft[1] + ")");

    feature.attr("d", mapPath)
        .attr("class","county");

    create_map();
}

function arraySetup(){
    userExperience = document.querySelector('input[name="personType"]:checked').value
    d3.select("#screen_block_for_options").classed("hidden",true)
    
    pathwayValueNames = ["Elementary School", "Middle School","High School", "HS STEM Program", "CTE", "Community College", "University/Colleges", "Undergrad STEM Program", "Graduate", "Research Institute","Company"]
    pathwayValueRanks = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
    pathwayValueReversed = ["Elementary School", "Middle School","High School", "HS STEM Program", "CTE", "Community College", "University/Colleges", "Undergrad STEM Program", "Graduate", "Research Institute","Company"]

    var start,end;

    if(userExperience === "parent" || userExperience === "earlyStudent"){
        start = 0
        end = 5
    } else if(userExperience === "lateStudent"){
        start = 2
        end = 7
    } else if(userExperience === "collegeStudent" || userExperience === "business"){
        start = 5
        end = 11
    } else if(userExperience === "everyone"){
        start = 0
        end = 11
    }

    pathwayValueNames = pathwayValueNames.slice(start,end)
    pathwayValueRanks = pathwayValueRanks.slice(start,end)
    pathwayValueReversed = pathwayValueReversed.slice(start,end)
    
    
    pathwayValues = [pathwayValueNames, pathwayValueRanks]

    placeHolder = pathwayValueReversed.reverse()
    resize()
}

function resetScreen(){
    d3.select(".leaflet-map-pane").classed("hidden",true)
    d3.select("#screen_block_for_options").classed("hidden",false)
}