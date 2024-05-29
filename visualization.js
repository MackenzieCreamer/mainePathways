// To deal with annoying artificating from caching, we set the menu option for the legend to "visualizeClick" everytime to avoid things breaking
document.getElementById("legend_selection").value = "visualizeClick"

// Check to see if the web application has already been started, impacts actions such as creating the map
var alreadyInitialized = false;

// A bunch of global variables that hold information on the map and any projections for the purposes of overlaying info on the map from other functions
var pathwayValueNames,pathwayValueRanks,pathwayValues,pathwayValueReversed,placeHolder;
var map,overlay,osmLayer,svgMap,gMap,mapTransform,mapPath,projectPoint,feature

// Information pertaining to the menus, width/height of the map, outlines of map features, and more
var blockedLegends = {}
var totalMenus = 0
var width,height;
var center;
var states, counties;
var schools, possiblePrograms;
var previousCoordinates;

// Variables that handle user interaction with the map
var lastBehavior = 0;
hovering = 0;
var clicked = [];

// Make an array of nodes to display of lower opacity
var display_legend_elements;

// Personal preference here, but I immensely dislike having to place all necessary functions and equations within asynchronous functions, so I instnantiate them here
// ------------------------------ START OF READING IN OF FILES FOR ASYNC FUNCTIONS ------------------------------
d3.json("counties-10m.json").then(function (us) {
    // Mostly not necessary with the exception of the county and state lines, since leaflet handles a lot of borders for us.
    // Regardless, we read all these in anyway since we can make use out of them, should we need them.
    states = topojson.feature(us, us.objects.states, (a, b) => a !== b)
    counties = topojson.feature(us, us.objects.counties, (a, b) => a !== b && (a.id / 1000 | 0) === (b.id / 1000 | 0))
    nation = topojson.feature(us, us.objects.nation);
    counties = new Object({type:"FeatureCollection",features:counties.features.filter(d => d.id.slice(0, 2) === "23")})
});

d3.csv("simplifiedSchools.csv").then(function (includedSchools) {
    // The meat and potatoes of the whole program, where we get the information for every institution in our list which we call "schools"
    // Poorly named due to being an artifact of when the program was first created, but I digress.
    schools = includedSchools;
    schools = schools.map(d=> {
        // We need to handle the coordinates in the way that OSM/Leaflet handles them, so we have a formatting function that is specifically associated with
        // handling this information. By passing in strings of those coordinates into this function, it formats them how OSM/leaflet wants them and subsequently won't
        // break on running with incorrectly formatted coordinates. THIS IS IMPORTANT TO REMEMBER.
        const coordinates = [d.lon,d.lat];
        return {
            // Fancy way of keeping all the old information (...d)
            ...d,
            latlng: new L.LatLng(coordinates[1],coordinates[0])
        }
    })
});

d3.csv("possiblePrograms.csv").then(function (programs) {
    //Important for dropdowns and filters
    possiblePrograms = programs;
});
// ------------------------------ END OF READING IN OF FILES FOR ASYNC FUNCTIONS ------------------------------

// Despite not using the react or node.js frameworks, we want a little reactivity from the website, so I custom programmed a resize function which is specified later in the code.
window.onresize = resize;


function create_menu(indexOfElement, startingCutoff,type="") {
    //PRE: indexOfElement is a numeric element where you intend to create a new element
    //PRE: startingCutoff is the numeric index of the institution you intend to be associated with the dropdown menu at the top
    //PRE: type is a string associated with the actual type for the menu. If it is blank, no type was assigned to the menu
    //POST: Creates a menu at the specific location containing only certain dropdown elements based on input.
    
    // Other areas of the code, rely on knowing the total number of menus and which elements of the menu have been clicked
    totalMenus += 1
    clicked.push(0)

    // Create the actual menu element to be added
    const currentElement = document.createElement("div")
    currentElement.setAttribute("id", "typesMenu_" + indexOfElement)
    currentElement.setAttribute("class", "inner_box")

    // Gets/adds the element we will be adding the menu element to
    const menuBox = document.getElementById("menu_container")
    menuBox.append(currentElement)

    // Once we have added the element, we start to populate the new menu box
    // Here, we are creating the dropdown menu for the associated menu
    var schoolTypeSelect = document.createElement("select");
    schoolTypeSelect.name = "schoolTypesDropdown";
    schoolTypeSelect.id = "typesDropdown" + indexOfElement;
    schoolTypeSelect.setAttribute("class", "types_dropdown")

    // If the argument for type has an institution, it's always going to have just one option, preventing it from being changed which matters later in the program
    // If the dropdown does not have a type, it will always have all menu options up to the starting cutoff, aka the institution type
    if(type===""){
        // For every element from the institution starting cutoff and beyond, we append an option element, set its value, and set its text.
        for (const elemType of pathwayValues[0].slice(startingCutoff, pathwayValues[0].length)) {
            var schoolOption = document.createElement("option");
            schoolOption.value = elemType;
            schoolOption.text = elemType;
            schoolTypeSelect.appendChild(schoolOption);
        }
    } else {
        // Create and append only one option, which is the type value that was passed earlier
        var schoolOption = document.createElement("option");
        schoolOption.value = type;
        schoolOption.text = type;
        schoolTypeSelect.appendChild(schoolOption);
    }

    // Now that we've created the dropdown, we create the label to go with it.
    var typeLabel = document.createElement("label");
    typeLabel.innerHTML = "Type of Institution: "
    typeLabel.htmlFor = "institutions";
    typeLabel.setAttribute("class", "dropdown_label");

    // Its important that as we're peacing everything together, that we give it a unique ID for the menu it represents, in case we need to delete the menu
    headerInfo = document.createElement("div")
    headerInfo.setAttribute("id","header_"+indexOfElement)
    headerInfo.setAttribute("class","options-header")

    typeLabel.appendChild(schoolTypeSelect)
    headerInfo.appendChild(typeLabel)

    //If we already have a type associated, we make sure that the dropdown isn't blank.
    currentElement.appendChild(headerInfo);
    schoolTypeSelect.value = type

    // Now that we've created the header, we need to add filters (if applicable) and add the menu features.
    if(schoolTypeSelect.value != ""){
        // Assuming that the school type is not null, we need to add filters immediately. 
        add_filters(schoolTypeSelect.value,indexOfElement)

        // When we're creating a dropdown menu, we need to get the associated value to ensure it slots into the correct sorted order of institutions.
        pathwayNameIndex = pathwayValues[0].indexOf(schoolTypeSelect.value)
        valueRank = pathwayValues[1][pathwayNameIndex]
        newCutoffIndex = pathwayValues[1].indexOf(valueRank, 0)

        // Now we create the school list with all the associated schools for the specific type that was provided.
        create_school_list(schoolTypeSelect.value, indexOfElement)
    
        // At the bottom of each menu there needs to be a button which can be used to toggle on/off map locations relative to whats in the menu list.
        // We create that button here
        var buttonToVisualizeAll = document.createElement("div")
        buttonToVisualizeAll.setAttribute("class","visualizeAllButton button")
        buttonToVisualizeAll.setAttribute("id","all_button_" + indexOfElement)

        // When clicked, the button should go gray and show all the schools listed in the school list. These are formatted differently to be identifiable, so extra work is necessary
        buttonToVisualizeAll.onclick = function() {
            this.style.backgroundColor = "rgb(126, 126, 126)";

            // Everything is 0 indexed, so its easier to just add one to everything to accomodate how certain code structure is written.
            selectedElement = d3.select("#legend_"+(pathwayValueNames.indexOf(schoolTypeSelect.value)+1))

            // Making sure that the button isn't already clicked when we go to click it. If it is, just hides the displayed map elements instead of showing them again.
            if(clicked[indexOfElement] == 0) {
                clicked[indexOfElement] = 1

                // Here we get all the elements from the list, note that they don't have checkboxes but are themselves checkboxes, in that clicking on them performs behavior similar to a checkbox. 
                listSelected = this.parentElement.querySelectorAll('input[type="checkbox"]')
                listSelected = Array.prototype.slice.call(listSelected).map(d => d.id)
                
                // List of schools we're going to have be visualized, but first we get all the school names and types
                schoolNames = []
                let schoolsToVisualize = []
                let schoolType = null
                for (const checkbox of listSelected) {
                    // Due to the formatting to ensure that every ID on the page was unique, we had to add the type to all menu list elements.
                    // Formatting is <name>$<type> for each ID that is read in from these checkboxes.
                    returnValue = document.getElementById(checkbox).value.split("$")
                    schoolNames.push(returnValue[0])
                    schoolType = returnValue[1]
                }

                // Now that we've identified all the schools and gotten their names, we can reference the full list of schools and only take those which match in both name and type
                elementsSchools = schools.filter(school => schoolNames.indexOf(school.name) != -1 && schoolType === school.type)
                schoolsToVisualize.push(elementsSchools)
                
                // To centralize the processing of schools, we add all schools that we plan to visualize here and then visualize them elsewhere.
                display_legend_elements[schoolTypeSelect.value] = schoolsToVisualize
                
                // Indicates that the button has been clicked 
                selectedElement.attr("fill","gainsboro")
            } else {
                //Reset the clicked array element, make it so no elements display in external processing, and reset the color
                clicked[indexOfElement] = 0
                display_legend_elements[schoolTypeSelect.value] = "none"
                this.style.backgroundColor = "gainsboro";
            }
            // Make sure that any changes made from the above code take place.
            create_map()
        }
        
        //Finish the creation of the button by giving it text and adding it to the menu
        buttonToVisualizeAll.innerHTML = "Visualize All"
        currentElement.appendChild(buttonToVisualizeAll)

        // When a new menu is created, its important to set the button to be the right color, as well as initializing the value of the 
        // clicked argument to 0.
        clicked[indexOfElement] = 0
        document.getElementById("all_button_"+indexOfElement).style.backgroundColor = "gainsboro"
    }

    // If there are multiple options for the institution selection, by selecting a new one it removes all subsequent menus.
    schoolTypeSelect.onchange = function () {
        
        // Assuming that the school type is not null, we need to add filters immediately. 
        add_filters(schoolTypeSelect.value,indexOfElement)

        // When we're creating a dropdown menu, we need to get the associated value to ensure it slots into the correct sorted order of institutions.
        pathwayNameIndex = pathwayValues[0].indexOf(schoolTypeSelect.value)
        valueRank = pathwayValues[1][pathwayNameIndex]
        newCutoffIndex = pathwayValues[1].indexOf(valueRank, 0)
        nextElement = indexOfElement + 1

        // Now we create the school list with all the associated schools for the specific type that was provided.
        create_school_list(schoolTypeSelect.value, indexOfElement)

        // Here we are checking to see if the button exists already. This is because when we are adding menus, if we attempt to change the current menu the button
        // will actually stay. We don't want this, so we check if the button (basically the menu itself) already exists. If it does, we get rid of the button.
        var buttonToVisualizeAll = document.getElementById("all_button_" + indexOfElement);
        if (buttonToVisualizeAll != null) {
            buttonToVisualizeAll.remove()
        }
    
        // At the bottom of each menu there needs to be a button which can be used to toggle on/off map locations relative to whats in the menu list.
        // We create that button here
        var buttonToVisualizeAll = document.createElement("div")
        buttonToVisualizeAll.setAttribute("class","visualizeAllButton button")
        buttonToVisualizeAll.setAttribute("id","all_button_" + indexOfElement)

        // When clicked, the button should go gray and show all the schools listed in the school list. These are formatted differently to be identifiable, so extra work is necessary
        buttonToVisualizeAll.onclick = function() {
            //Set the color of the button to the correct, light gray color
            this.style.backgroundColor = "rgb(126, 126, 126)";

            // Everything is 0 indexed, so its easier to just add one to everything to accomodate how certain code structure is written.
            selectedElement = d3.select("#legend_"+(pathwayValueNames.indexOf(schoolTypeSelect.value)+1))

            // Making sure that the button isn't already clicked when we go to click it. If it is, just hides the displayed map elements instead of showing them again.
            if(clicked[indexOfElement] == 0 && document.getElementById('legend_'+valueRank).attributes.fill.value !== "gainsboro") {
                clicked[indexOfElement] = 1

                // Here we get all the elements from the list, note that they don't have checkboxes but are themselves checkboxes, in that clicking on them performs behavior similar to a checkbox. 
                listSelected = this.parentElement.querySelectorAll('input[type="checkbox"]')
                listSelected = Array.prototype.slice.call(listSelected).map(d => d.id)
                
                // List of schools we're going to have be visualized, but first we get all the school names and types
                schoolNames = []
                let schoolsToVisualize = []
                let schoolType = null
                for (const checkbox of listSelected) {
                    // Due to the formatting to ensure that every ID on the page was unique, we had to add the type to all menu list elements.
                    // Formatting is <name>$<type> for each ID that is read in from these checkboxes.
                    returnValue = document.getElementById(checkbox).value.split("$")
                    schoolNames.push(returnValue[0])
                    schoolType = returnValue[1]
                }

                // Now that we've identified all the schools and gotten their names, we can reference the full list of schools and only take those which match in both name and type
                elementsSchools = schools.filter(school => schoolNames.indexOf(school.name) != -1 && schoolType === school.type)                
                schoolsToVisualize.push(elementsSchools)

                // To centralize the processing of schools, we add all schools that we plan to visualize here and then visualize them elsewhere.
                display_legend_elements[schoolTypeSelect.value] = schoolsToVisualize
                
                // Indicates that the button has been clicked 
                selectedElement.attr("fill","gainsboro")
            } else {
                //Reset the clicked array element, make it so no elements display in external processing, and reset the color
                clicked[indexOfElement] = 0
                display_legend_elements[schoolTypeSelect.value] = "none"
                this.style.backgroundColor = "gainsboro";
                selectedElement.attr("fill","transparent")
            }
            // Make sure that any changes made from the above code take place.
            create_map()
        }

        //Finish the creation of the button by giving it text and adding it to the menu
        buttonToVisualizeAll.innerHTML = "Visualize All"
        currentElement.appendChild(buttonToVisualizeAll)

        clicked = clicked.slice(0,newCutoffIndex)


        // When a new menu is created, its important to set the button to be the right color, as well as initializing the value of the 
        // clicked argument to 0.
        clicked[indexOfElement] = 0
        document.getElementById("all_button_"+indexOfElement).style.backgroundColor = "gainsboro"
        
        // Remove old_menus, particularly those that follow the changed menu here.
        delete_old_menus(nextElement)

        // Create a new menu when you select an institution type/change the institution type
        if(document.getElementById("legend_selection").value==="visualizeClick")
            create_menu(nextElement, newCutoffIndex)

        // When the institution type is changed from the dropdown, we need to visually clean up everything that used to be there
        create_map()
    }
}

function delete_old_menus(nextElement) {
    // PRE: Integer input representing the next element from which you'd like to remove all menus at and beyond
    // POST: Removes all menu elements at and beyond the integer given for the input

    // Iterate through all menu elements starting at the index for "nextElement"
    for (let i = nextElement, oldTotal = totalMenus; i < oldTotal; i++) {
        
        // Get the dropdown menu type, as well as grabbing the element for the visualize all button
        type = document.getElementById("typesDropdown" + i).value
        element = document.getElementById("all_button_" + i)
        // We want to make sure that if this element exists, that we're checking if its clicked. If it is then we're removing all associated
        // map display elements with it.
        if(element!==null)
            if (window.getComputedStyle(element,null).getPropertyValue('background-color')=="rgb(126, 126, 126)") {
                display_legend_elements[type] = "none"
                // Reset the visualize options tab for the colors of the legend
                d3.select("#legend_" + pathwayValueNames.indexOf(type)).attr("fill","transparent")
            }
        // We remove the menu and reduce the total menu counter by 1 after removing any visualized map elements
        document.getElementById("typesMenu_" + i).remove();
        totalMenus -= 1
    }
}

function create_school_list(type, indexOfElement) {
    // PRE: type is a string that is associated with an institution type, indexOfElement is an integer associated with the menu to update
    // POST: Creates a full list of schools based on filter options and the type given

    // Get the menu that we're going to be adding/updating the school list for
    var schoolListElement = document.getElementById("school_list_" + indexOfElement);
    
    // If the schoolListElement already existed, then we remove all of the menu options from it.
    if (schoolListElement != null) {
        let child = schoolListElement.lastElementChild;
        while (child) {
            schoolListElement.removeChild(child);
            child = schoolListElement.lastElementChild;
        }
    // If the schoolListElement does not exist, then we create the menu for the first time without instantiating its children yet
    } else {
        schoolListElement = document.createElement("ul")
        document.getElementById("typesMenu_" + indexOfElement).appendChild(schoolListElement);
        schoolListElement.setAttribute('id', "school_list_" + indexOfElement)
        schoolListElement.setAttribute('class', "school_list")
    }    
    
    // These specific institutions do not have programs, and as such we exclude them from filters based on programs 
    if(type == "Elementary School" || type == "Middle School" || type == "HS STEM Program" || type == "Undergrad STEM Program" || type == "Research Institute"){
        school_list = schools.filter(school => school.type === type)
    // When creating school lists, we want to abide by the potential filter options that could be provided by the user, based on their input in different fields
    } else {
        // Get the current menu before doing anything
        currentElement = document.getElementById("typesMenu_" + indexOfElement);

        // optionValue is for filtering by and/or for having both or either programs the user could select to filter by
        optionValue = currentElement.querySelector('input[name="selector_' + indexOfElement + '"]:checked').value;
        // optionValue2 is for sorting the school list elements by either alphabetical order or by distance from target (closest first)
        optionValue2 = currentElement.querySelector('input[name="selector2_' + indexOfElement + '"]:checked').value;
        
        // 
        filter1Value = document.getElementById("filter1_" + indexOfElement).value
        filter2Value = document.getElementById("filter2_" + indexOfElement).value
        
        // A bunch of filter options based on if statements for potential user interaction that handles all the potential options on user input on program selections
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

        // Sorting by distance is possible for menus beyond the first
        if(indexOfElement != 0 && optionValue2 == "Dist."){
            
            // potentialSchoolList is poorly named, references previous list of schools
            var potentialSchoolList = document.getElementById("school_list_" + (indexOfElement-1));
            
            // checkboxes to see which, if any, checkboxes have been selected in the previous list of institutions
            var checkboxes = potentialSchoolList.querySelectorAll('input[type="checkbox"]:checked');
            
            // If any checkboxes are selected, only take the final school in that list of checkboxes
            last_school = checkboxes[checkboxes.length-1]

            // So long as the previous list has one selected institution, we figure out it's lat/lon for sorting purposes
            if(last_school !== undefined){
                // Grab the institution from "schools" after splitting the pieces to filter by the correct name and type
                returnValue = last_school.value.split("$")
                last_school_name = returnValue[0]
                last_school_name_type = returnValue[1]
                elementsSchool = schools.filter(school => last_school_name === school.name && last_school_name_type === school.type)[0]
                
                // Sorting function using the pythagorean theorem to compare distances. Sorts in ascending order of distance from previous institution.
                school_list.sort(function(a,b){
                    var [aXPos,aYPos] = [a.lon,a.lat]
                    var [bXPos,bYPos] = [b.lon,b.lat]
                    let [cXPos,cYPos] = [elementsSchool.lon,elementsSchool.lat]
                    
                    distanceA = Math.sqrt((cXPos-aXPos)**2+(cYPos-aYPos)**2)
                    distanceB = Math.sqrt((cXPos-bXPos)**2+(cYPos-bYPos)**2)
    
                    return (distanceA > distanceB) - (distanceA < distanceB)
                })
            // Warning to user if they make a poor choice and attempt to sort based on distance for a non-existent element.
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

    var tooltip = d3.select("body")
    .append("div")
    .style("position", "absolute")
    .style("opacity", 0)
    .attr("class", "tooltip")
    .style("background-color", "white")
    .style("border", "solid")
    .style("border-width", "2px")
    .style("border-radius", "5px")
    .style("padding", "5px")
    .style("z-index",9999)

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
            .style("top", (d.clientY+25)+"px")
            .style("left",(d.clientX+25)+"px")
        }
    var mouseleave = function(d) {
        tooltip.style("opacity", 0)
    }
    var onclick = function(d,school){
        d3.select("#screen_block_for_school").classed("hidden",false)
        document.getElementById("name_value").innerHTML = school.name
        document.getElementById("location_value").innerHTML = school.address
        document.getElementById("link_value").innerHTML = school.link
        document.getElementById("programs_value").innerHTML = school.program
        console.log(school)
    }

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
        .domain(["Elementary School", "Middle School","High School", "HS STEM Program", "CTE", "Community College", "University/Colleges", "Undergrad STEM Program", "Graduate", "Research Institute","Company"])
        .range(["#a5cee3","#1f78b3","#b2de89","#339f2c","#fb9a99","#e3191b","#fcbf6f","#ff7f00","#45dee0","#3b6af9","#676767"])

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
    schoolsToPreview = schoolsToPreview.flat().map(d => ({ name: d.name, address:d.address, type: d.type, lonlat: map.latLngToLayerPoint(d.latlng), program:d.program, link:d.link }))

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
                .on("mouseover", mouseover)
                .on("mousemove", mousemove)
                .on("mouseleave", mouseleave)
                .on("click",onclick)
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
                    .on("click",onclick)
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
    display_legend_elements = {"Elementary School":"none",
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
    blockedLegends = {}
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
        elementIndex = elementID.split("_")[1]
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
            if(blockedLegends[elementIndex] === undefined){
                
                blockedLegends[elementIndex] = name
                selectedElement = d3.select("#legend_" + elementIndex)
                selectedElement.attr("fill","gainsboro")
            } else {
                delete blockedLegends[elementIndex]
                selectedElement = d3.select("#legend_" + elementIndex)
                selectedElement.attr("fill","transparent")
            }
            delete_old_menus(0)
            var keys = Object.keys(blockedLegends);
            keys.sort()
            for (var i=0; i<keys.length; i++) { // now lets iterate in sort order
                var key = keys[i];
                var name = blockedLegends[key];
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
        blockedLegends = {}
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
    d3.select("#screen_block_for_options").classed("hidden",false)
}

const schoolSelectBackground = document.getElementById("school_background")

schoolSelectBackground.addEventListener("click",(event)=>{
    d3.select("#screen_block_for_school").classed("hidden",true)
})