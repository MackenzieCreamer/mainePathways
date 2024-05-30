// To deal with annoying artificating from caching, we set the menu option for the legend to "visualizeClick" everytime to avoid things breaking
document.getElementById("legend_selection").value = "visualizeClick"

// Check to see if the web application has already been started, impacts actions such as creating the map
var alreadyInitialized = false;

// A bunch of global variables that hold information on the map and any projections for the purposes of overlaying info on the map from other functions
var pathwayValueNames,pathwayValueRanks,pathwayValues,pathwayValueReversed,placeHolder;
var map,osmLayer,svgMap,gMap,mapTransform,mapPath,projectPoint,feature

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

// More reactive elements pertaining to elements surrounding the background when a user selects an element
const schoolSelectBackground = document.getElementById("school_background")
schoolSelectBackground.addEventListener("click",(event)=>{
    d3.select("#screen_block_for_school").classed("hidden",true)
})

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
        
        // So for whatever reason, this little line of code fixes my woes. Apparently, for higher order institutions, this matters???? But for lower order institutions it doesn't
        // Basically, everything works as intended up until you get to the point where there's multiple institutions at higher order and then it breaks the visualize all button logic
        // on line 250 as of when this comment was written. It doesn't entirely make sense, since the pathwayValues are always being updated by the array_setup() function, but I digress.
        valueRank = newCutoffIndex + 1

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

    // To ensure a unique ID for each of the elements, we assign each one a different number combination based on the menu index and school index
    schoolCount = 0
    for (const school of school_list) {
        // Actual creation of list elements, one by one
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

        // In order to have the appropriate display for addresses, we need to break down each piece separately and then stich them back together
        // Addresses with more than three components have a P.O. box, which we don't care to display
        components = school.address.split(',')
        addressBreakdown = ""
        if(components.length > 3){
            addressBreakdown = components[0] + "<br>" + components[2] + ", " + components[3]
        } else {
            addressBreakdown = components[0] + "<br>" + components[1] + ", " + components[2]
        }

        // Creation of label name and address as well as their appendage
        labelName.innerHTML = school.name
        labelAddress.innerHTML = addressBreakdown
        schoolLabel.appendChild(labelName)
        schoolLabel.appendChild(labelAddress)

        // Not entirely sure what the htmlFor tag is for, but I added the same value to the ID to keep things consistent
        schoolLabel.htmlFor = "school" + indexOfElement + "_" + schoolCount;
        
        // Piece everything together now that its all been created
        listElement.appendChild(schoolOption)
        listElement.appendChild(schoolLabel)

        // Interactivity element, basically when a user hovers a menu option, we want it to display more prominently on the map
        listElement.onmouseover = function(){
            // Checking to see if the element is already selected, as the visual will be different if it is
            listSelected = this.parentElement.querySelectorAll('input[type="checkbox"]:checked')
            listSelected = Array.prototype.slice.call(listSelected).map(d => d.id)
            childID = this.firstChild.id
            
            // Checking if the user is already hovering the element, prevents there from being a pile up of visual clutter in certain edge cases
            if(hovering == 0){
                // Once again, finding the specific school using the value associated with itself
                let [schoolName,schoolType] = this.firstChild.value.split("$")
                elementsSchools = schools.filter(school => schoolName === school.name && schoolType === school.type)

                // schools.filter returns an array, so we need to get the first (only) element of that array before going further
                singleSchool = elementsSchools[0]

                // projection using the OSM/leaflet map structure
                let cPos = map.latLngToLayerPoint(singleSchool.latlng)
                let [cxPos,cyPos] = [cPos.x,cPos.y]
                let opacity = "50%";

                // Usual D3 elements that need to be appended, either an image or a simple circle depending on whether the element has already been selected
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
            // Setting hovering to 1 until the mouse completely leaves, as the checkbox bounds are not the same as the full bounds of the hover potential
            hovering = 1
        }
        listElement.onmouseleave = function(){
            // Remove element that was being hovered on mouseleave, cheaper than re-running create_map()
            d3.select("#map_container").selectAll(".hover").remove()
            // Indicate that the user has actually had their mouse leave the checkbox
            hovering = 0
        }
        listElement.onclick = function(){
            // Ensures that when the element is clicked multiple times, it removes that element from the map on future visualizations
            clicked[indexOfElement] = 0
            create_map()
        }
        // Add child list element to full unordered list and increment counter
        schoolCount += 1
        schoolListElement.appendChild(listElement)
    }
}

function add_filters(type, indexOfElement){
    // PRE: type is a string containing the institution type name, indexOfElement is an integer 
    // POST: Add filters to the top of the menu box underneath the institution dropdown header

    // select the current menu (currentElement) and check to see if filtersSelection has already been initialized. If it has, remove it to prevent duplicates.
    const currentElement = document.getElementById("header_" + indexOfElement)
    var filtersSelection = document.getElementById("filtersSelection_" + indexOfElement);
    if(filtersSelection != null){
        filtersSelection.remove()
    }

    // These particular elements don't have programs associated with them, so there's no need for filters.
    if(!(type == "Elementary School" || type == "Middle School" || type == "HS STEM Program" || type == "Undergrad STEM Program" || type == "Research Institute" || type == null)){
        // Create the filter box and associated ID
        filtersSelection = document.createElement("div")
        filtersSelection.id = "filtersSelection_" + indexOfElement;
    
        //There's two separate filters for two different potential program selections
        let filter1 = document.createElement("select");
        let filter2 = document.createElement("select");
        filter1.name = "programFilter1"
        filter2.name = "programFilter2"
        filter1.id = "filter1_" + indexOfElement
        filter2.id = "filter2_" + indexOfElement
        filter1.setAttribute("class", "types_dropdown")
        filter2.setAttribute("class", "types_dropdown")
    
        // With the dropdowns created, we can now add the actual selection piece to the filters
        // Each option starts empty until something is clicked
        var programOption1 = document.createElement("option");
        var programOption2 = document.createElement("option");
        programOption1.value = ""
        programOption1.text = ""
        programOption2.value = ""
        programOption2.text = ""
        filter1.appendChild(programOption1);
        filter2.appendChild(programOption2);

        // Now we need the program list for the specific type of interest
        // We do a lot of removing and cleaning of the data for the dropdown here,
        // and unfortunately not all of it works. The spreadsheet needs to be updated
        // such that all commas separating programs are semicolons or some other uncommon delimter
        // before this would work properly. Update the code 4 lines down when that task is completed.
        let program_list = possiblePrograms.filter(program => program.types === type)
        program_list = program_list[0].programs.replace(/['"]+/g, '')
        program_list = program_list.replace(/[\[\]]/g,'');
        program_list = program_list.split(',');

        // Now that we have a cleaned program list, we can create a dropdown selection option for each one
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
        
        // Doubling down on making sure things are instantiated in an empty fashion
        filter1.value = ""
        filter2.value = ""
        
        // Labels at the request of PIs for the purpose of clarity, basically renaming programs to something
        // more relevant, based on the selected institution type
        var programLabel = document.createElement("label");
        if(type==="High School"){
            programLabel.innerHTML = "AP Courses"
        } else if(type==="Company"){
            programLabel.innerHTML = "Industry"
        } else {
            programLabel.innerHTML = "Programs"
        }
        
        // Setting the class/id/htmlFor attributes of the label and radioButtonContainer
        programLabel.htmlFor = "programs";
        programLabel.setAttribute("class", "dropdown_label");
        radioButtonContainer = document.createElement("fieldset")
        radioButtonContainer.setAttribute("id","field_container_"+indexOfElement)
    
        // Setting the ability for the user to select either either/both for programs that an institution has
        for (const option of ["Or","And"]){
            
            // Radio buttons and labels getting their values set, alongside "indexOfElement" for the name
            // to prevent running into issues with multiple radio button selectors coinciding and reading the same values
            radioButton = document.createElement("div")
            radioInput = document.createElement("input")
            radioLabel = document.createElement("label")
            radioInput.type = "radio"
            radioInput.value = option

            // this line ensures that each individual radio button is unique and prevents them from stealing selections
            // from other radio button containers
            radioInput.name = "selector_" + indexOfElement
            
            // Default will be "Or" (either program) for the user to select (needs to be set for the school list creation)
            if(option === "Or"){
                radioInput.checked = true;
            }

            // Finally adding the label and appending the individual options for the radio buttons for filtering
            radioLabel.for = option
            radioLabel.innerHTML = option
            radioButton.appendChild(radioInput)
            radioButton.appendChild(radioLabel)
            radioButtonContainer.appendChild(radioButton)
        }


        
        // Need a second container for the distance/alphabetical sorting
        radioButtonContainer2 = document.createElement("fieldset")
    
        // Options for user: A-Z: Alphabetical|Dist.: Ascending Distance from last selected school in previous school list menu
        for (const option of ["A-Z","Dist."]){
            
            // Same deal as previous for loop, setting default information that is necessary for HTML elements
            radioButton = document.createElement("div")
            radioInput = document.createElement("input")
            radioLabel = document.createElement("label")
            radioInput.type = "radio"
            radioInput.value = option
            // Likewise to previous loop, this line ensures that each individual radio button is unique and prevents them
            // from stealing selections from other radio button containers
            radioInput.name = "selector2_" + indexOfElement

            // For a number of reasons, we are setting alphabetical as the default for sorting of schools reported, not always going to have
            // a school from the previous list selected - also makes intuitive sense.
            if(option === "A-Z"){
                radioInput.checked = true;
            }

            // Finally adding the label and appending the individual options for the radio buttons for filtering
            radioLabel.for = option
            radioLabel.innerHTML = option
            radioButton.appendChild(radioInput)
            radioButton.appendChild(radioLabel)
            radioButtonContainer2.appendChild(radioButton)
        }
        
        // Adding the radioButtonsContainer class to the radio button container, used for the second container as well
        radioButtonContainer.classList.add("radioButtonsContainer")
        radioButtonContainer2.classList.add("radioButtonsContainer")
        
        // Now that everything has been constructed and established, we need to make the container for all the options
        // for each of the options (i.e., programLabel at the top, filter1/radioButtonContainer/filter2 in the middle-ish, and radioButtonContainer2 on bottom)
        optionsBox = document.createElement("div")
        optionsBox.classList.add("filterOptionsBox")
        optionsBox.appendChild(programLabel)
        optionsBox.appendChild(filter1)
        optionsBox.appendChild(radioButtonContainer)
        optionsBox.appendChild(filter2)
        optionsBox.appendChild(radioButtonContainer2)

        // As we cleared this element earlier, we can now re-add its contents without duplicating them.
        filtersSelection.appendChild(optionsBox)
        filtersSelection.classList.add("filtersContainer")

        // Basically, when the user changes the filters, we want to clear the selection such that they don't have anything selected that
        // shouldn't be present in that full list.
        filtersSelection.onchange = function () {
            document.getElementById("all_button_"+indexOfElement).style.backgroundColor = "gainsboro"
            d3.select("#map_container").selectAll("circle.clickedVisualization_"+indexOfElement).remove()
            create_school_list(type, indexOfElement)
            clicked[indexOfElement] = 0
        }

        // Add the filtersSelection element to the menu for that specific institution 
        currentElement.append(filtersSelection)
    }
}

function create_map(onClick = 0) {
    // PRE:  onClick is either 0 or 1 and must be an integer
    // POST: Generates the svg map overlay with leaflet in the background. 
    lastBehavior = onClick

    // Removes old overlay map elements before adding new overlay map elements to the leaflet structure.
    d3.selectAll(".mapElement").remove();

    // Tooltip for additional information on hover over different map overlay elements
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

    var mouseover = function(d) {
        // For handling the mousing over of map elements on the screen. This always causes the element itself to populate
        // but does not populate the contents within the element. That is handled by mousemove

        tooltip.style("opacity", 1)
        // This is necessary due to how leaflet handles their z-index. For some reason, rather than
        // having their z-index be left alone and stacking piece after piece on the webpage, they
        // manually set their z-index which causes a lot of layout issues. Rather than undoing their work
        // they did, I just adjust the z-index of each of the elements of the page myself, manually.
            .style("z-index",9999)
    }
    
    var mousemove = function(d,school) {
        // Making sure that as the cursor moves around the screen it does two separate things.
        // The first thing is that when the cursor moves, it moves the tooltip along with it, always roughly
        // ~7.5 pixels to the bottom right. The second thing that it does is it populates the contents of the tooltip
        // with content particularly from the institution associated with the element being hovered.

        // Split the address into several components with the intent of chopping out information on the P.O. box, which we've previously
        // done in other areas of the code.
        components = school.address.split(',')
        addressBreakdown = ""
        if(components.length > 3){
            addressBreakdown = components[0] + "<br>" + components[2] + ", " + components[3]
        } else {
            addressBreakdown = components[0] + "<br>" + components[1] + ", " + components[2]
        }

        // Create the fullHTML for the tooltip, and attach it to the tooltip.
        fullHTML = school.name + "<br>" + addressBreakdown
        tooltip.html(fullHTML)
            .style("top", (d.clientY+5)+"px")
            .style("left",(d.clientX+5)+"px")
    }

    var mouseleave = function(d) {
        // When the mouse leaves the tooltip, we want the tooltip to go away.
        
        // It's important that we set the opacity and z-index down to 0 after we're done, otherwise it hovers over the map invisibly
        // and causes hovering of other elements to not always work (since you're actually hovering the invisible tooltip)
        tooltip.style("opacity", 0)
        tooltip.style("z-index", 0)
    }

    var onclick = function(d,school){
        // When clicking a node link, we want that extra additional information to pop up on screen that the user can reference.
        // Particularly, a useful feature is getting to see all the different programs that are available to the user.

        // We unhide the pop-up menu for the school, and then populate it with all the information that a user could possibly want.
        // Aka all the information we have on the matter. The format and CSS of this is handled in index.html and styles.css, respectively.
        d3.select("#screen_block_for_school").classed("hidden",false)
        document.getElementById("name_value").innerHTML = school.name
        document.getElementById("location_value").innerHTML = school.address
        document.getElementById("link_value").innerHTML = school.link
        document.getElementById("programs_value").innerHTML = school.program
    }

    // Schools with which we need to hold on to and visualize, but not schools of which are being previewed. These are held separately.
    const schoolsToVisualize = []
    
    // We set a bound on schools we are visualizing since the schools we are visualizing are separate from the schools. The bounds are important
    // for understanding what the last set of schools are. Also, the last menu is empty in some circumstances
    bounds = totalMenus

    // Checking to see what the set-up we have going on is - if the legend option is set to visualizing elements on click and not creating menus
    // then the last menu will always be empty, and as such we need to reduce the bounds by 1 to prevent an out of bounds error.
    if(document.getElementById("legend_selection").value==="visualizeClick")
        bounds = totalMenus - 1

    // Now we go through all of the school lists and check for the schools that have been checked in each one
    for (let i = 0; i < bounds; i++) {
        var schoolListElement = document.getElementById("school_list_" + i);
        var checkboxes = schoolListElement.querySelectorAll('input[type="checkbox"]:checked');
        schoolNames = []
        let schoolType = null
        
        // Same splitting behavior we've been using previously for these checkboxes, it's always <name>$<type>
        for (const checkbox of checkboxes) {
            returnValue = checkbox.value.split("$")
            schoolNames.push(returnValue[0])
            schoolType = returnValue[1]
        }
        
        // With the full list of names of schools and the respective type for a given menu, we use its type and the names of the schools
        // this is particularly important for instances like grad school and undergradate/university as many of these schools have both
        // a grad program and an undergrad program. Noting this, we grab all schools that are present in this list of names we've compiled
        // for each of the menus, one by one. And then push them into the visualize schools array.
        elementsSchools = schools.filter(school => schoolNames.indexOf(school.name) != -1 && schoolType === school.type)
        schoolsToVisualize.push(elementsSchools)
    }

    // A better programmer than I would not have hardcoded this. I am a better programmer, but I'm lazy and this doesn't exactly impact the quality of the 
    // application. Just make sure if you need to adjust these things that you do so in a way that it references a global variable or something idk. Or be even better
    // than me and don't use global variables. It's the easy thing to do, but my naming schema is sometimes too consistent which causes issues. Basically just be careful
    // and be better.
    ordinalColor = d3.scaleOrdinal()
        .domain(["Elementary School", "Middle School","High School", "HS STEM Program", "CTE", "Community College", "University/Colleges", "Undergrad STEM Program", "Graduate", "Research Institute","Company"])
        .range(["#a5cee3","#1f78b3","#b2de89","#339f2c","#fb9a99","#e3191b","#fcbf6f","#ff7f00","#45dee0","#3b6af9","#676767"])

    // Schools we are previewing, as opposed to visualizing, are handled differently. It's possible to visualize either "all" of an institution type's schools, the first of the two
    // if/else statements, to visualize only a selection of the schools (say if you were visualizing a filtered menu list), or to visualize no schools. The default is to visualize
    // no schools, but this can be changed through user interaction.
    schoolsToPreview = []
    for(const name of pathwayValueNames){
        if(display_legend_elements[name] === "all") {
            // If the button to visualize all is clicked, or a legend element is clicked, it will trigger this flag. It gets all schools of a specific type and
            // feeds them into a list. That is then processed to get the information necessary to preview all the schools.
            previewSchoolList = schools.filter(school => name === school.type)
            previewSchoolList = previewSchoolList.slice(0, previewSchoolList.length)
            schoolsToPreview.push(previewSchoolList)
        } else if(display_legend_elements[name] !== "none") {
            // We handle the list of names elsewhere when the "visualize all" button is selected in the create_menus function (it might be create_school_list).
            // By handling it this way, we offload the handling of the schools that are actually in the list of schools after filtering. The display_legend_elements
            // array holds the full list of institution objects.
            previewSchoolList = display_legend_elements[name]
            previewSchoolList = previewSchoolList.slice(0, previewSchoolList.length)
            schoolsToPreview.push(previewSchoolList[0])
        }
    }
    // The result of "schoolsToPreview" is an array of arrays. This is not satisfactory for us, so we flatten the array. After we flatten this array, we use a function
    // to map the lonlat differently because the handling of lat/lon in leaflet is slightly different than D3. Also, not my fault, but both D3 and leaflet use the term
    // map as a function which does mean different things in different contexts. (...d) basically keeps the entire object as it was before, and lonlat just adds to what
    // is now present.
    schoolsToPreview = schoolsToPreview.flat().map(d => ({ 
        ...d,
        lonlat: map.latLngToLayerPoint(d.latlng)
    }))

    // Finally, we get to the point where we can visualize the nodes now that we have all the processing done. As long as there is an element in the schoolsToPreview
    // array, we can run this code. Basically it takes the contents of that 1D array of institution objects and spits out an arbitrary number of elements equal to the array
    // length. For interactivity elements, see earlier code for more information.
    if(schoolsToPreview[0]!=undefined){
        previewVisualizations = gMap.append("g")
        previewVisualizations.selectAll('image')
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
    
    // Same as the schoolsToPreview array, we want to make sure there's at least one school to preview before we go into the depths of handling everything
    if (schoolsToVisualize[0] != undefined) {
        
        // Arbitrary code that is left over from earlier work. By splitting this elements up, we can visualize a path between schools. It seemed more useful at
        // the time, but I realize that with how complicated everything is, it may not be the most appealing for users to simply have a line between several
        // institutions displayed on their screen that means little to nothing to them.
        let firstSchoolList = schoolsToVisualize.slice(0, schoolsToVisualize.length - 1)
        finalSchoolList = schoolsToVisualize[schoolsToVisualize.length - 1]

        // Instead of having an N-Dimesional array of N-Dimensional arrays containing isntitution objects of different types, we merge all the arrays together
        // to have a singular array of many differet types of institutions, and handle their processing separately later.
        firstSchoolList = d3.merge(firstSchoolList)

        // We need all the information present in the objects for each of these arrays, but we also need one more element, similar to what we did with previewed
        // schools, so we could accurately represent them on the map. We use (...d) to keep all the old elements, but we add "lonlat" to map the extra content from
        // the leaflet side of things.
        firstSchoolList = firstSchoolList.map(d => ({ ...d, lonlat: map.latLngToLayerPoint(d.latlng) }))
        finalSchoolList = finalSchoolList.map(d => ({ ...d, lonlat: map.latLngToLayerPoint(d.latlng) }))

        // Array that contains the connection between different institutions that will later be visualized.
        let linksBetween = []

        // As long as there are at least 2 institutions, this will add content to the linksBetween list.
        // This list is used particularly for the first set of schools so we're only ever taking the final school in each list.
        // We do this because this was an earlier conversation to prevent unnecessary overlapping and connections between different institutions.
        // (Originally, we were only going to allow one selection for the first n-1 menus, where n is the total number of menus, but we've since
        // moved away from this concept).
        for (let i = 0; i < firstSchoolList.length - 1; i++) {
            linksBetween.push([firstSchoolList[i].type,
            { lat: firstSchoolList[i].lonlat.y, lon: firstSchoolList[i].lonlat.x },
            { lat: firstSchoolList[i + 1].lonlat.y, lon: firstSchoolList[i + 1].lonlat.x }
            ])
        };

        // We get the finalFirst school as this will hold numerous links between the final school in the first school list and all of the potential schools
        // that are present in the finalSchoolList.
        let finalFirstSchool = firstSchoolList[firstSchoolList.length - 1]

        // We check here to make sure that we even have enough menus/selections before attempting to make connections between different institutions.
        if (finalFirstSchool != undefined) {
            
            // We now go through the process of mapping the latlon of the finalFirstSchool to each of the 
            // final schools until such point as all schools have the additional content attached to them for making clean nodes between everything.
            let finalFirstSchoolLatLon = ({ lat: finalFirstSchool.lonlat.y, lon: finalFirstSchool.lonlat.x })
            finalSchoolsLatLon = finalSchoolList.map(d => ({ lat: d.lonlat.y, lon: d.lonlat.x }))
            let finalLinksBetween = finalSchoolsLatLon.map(d => [finalFirstSchool.type, finalFirstSchoolLatLon, d])

            // With all these new links, we can conect the lines betwee all these schools together.
            linksBetween = linksBetween.concat(finalLinksBetween)
        }

        // This is separate from the links between elements we have before. This is to handle the combination of these lists, now that we've
        // done what we've needed to do with their separation (the elements of linking different nodes, when a user clicks the "visualize path" button)
        let schoolList = firstSchoolList.concat(finalSchoolList)

        // The "lastBehavior" variable is meant to represent the user clicking the visualize path button and letting it be a toggleable instance, but
        // I never fully figured out how to keep this variable from being reset each time I ran the function, so I gave up and just let it only exist when the user
        // visualizes the map with that button specifically. It's easy enough to do, but I had higher priorities on the project.
        if(lastBehavior == 1){
            
            // Similar to other mapping elements, just a set of lines instead though instead of several dozen images/circles.
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

        // Certain circumstances lead to instances where "schoolsToVisualize" doesn't properly instantiate as an array despite not being undefined (the earlier
        // check we had done). To double down on making sure we don't visualize something that doesn't exist, we make sure the array isn't empty.
        if(schoolsToVisualize.length!=0){
            subsetInstitutions = gMap.append("g")
            subsetInstitutions.selectAll('image')
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

function initialize() {
    // POST: Triggers all of the web application's starting elements such as the legend, the map, and the menus container.

    // A dictionary containing elements that need to be visualized from the legend, based on what has and has not been clicked yet.
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
    // Regardless of how many times initialize is called, we want to have the state of the website always reset to having no menus, no blockedLegends (talk about later) and
    // a fresh slate from which the user can interact with the site. Every time the user changes their user experience, this function triggers, so we want this to happen an
    // arbitrary number of times. This comes earlier in the function since doing it later means that there's residual visualization elements that don't belong anymore.
    delete_old_menus(0)

    // Based on the selection from the user that would trigger this function, the arraySetup() function needs to handle things in unique ways.
    arraySetup()

    // This is an artifact that is worth keeping from a time before I understood how or why the map i the background superseeded all other elements of the screen.
    // Namely, if you've been following this code, the fact that leaflet uses z-index for its elements rather than letting them stack naturally. I'm sure they have their
    // reasons, though it's still super frustrating to have to navigate.
    d3.select(".leaflet-map-pane").classed("hidden",false)
    
    // We only want to run the initilization process for the map one time, as we can just hide the map rather than destroy it whenever we need to edit the user experience.
    if(!alreadyInitialized){
        alreadyInitialized = true

        // Creation of map, centered roughly on the center of the state of Maine, more or less.
        map = new L.Map("map_container", {center: [45.2, -69.14], zoom: 7})

        // Making sure that we are giving credit where credit is due for open-source software. Also adds the necessary tile layers for things to work. 
        osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(map); 
            
        // In order to actually have interaction with the map, we need to create an svg layer over the top that's clickable that we add to the map
        L.svg({clickable:true}).addTo(map)
    
        // Now that we've added this to the map, we can get this overlayPane that is associated with interactivity, and add handle it as an SVG on D3's side of things
        svgMap = d3.select(map.getPanes().overlayPane).append("svg"),

        // I can't entirely remember the reason for the addition of the class, but the first two parts are necessary so we can add elements to the group (gMap) such that
        // all elements are correctly positioned on the greater map itself.
        gMap = svgMap.append("g").attr("class", "leaflet-zoom-hide");
    
        // Leaflet chooses to use its own projection function, so for consistency sake, we use their projection function instead of those present in D3.
        projectPoint = function(x, y) {
            const point = map.latLngToLayerPoint(new L.LatLng(y, x))
            this.stream.point(point.x, point.y)
        }
    
    
        // Because we are using the projection function that is established within Leaflet instead of D3, we need to make sure that D3 is familiar with this so that when
        // a set of points are passed in, it understands fully how to handle it, especially when the user zooms in/out and moves the map around.
        mapTransform = d3.geoTransform({point: projectPoint}),
        mapPath = d3.geoPath().projection(mapTransform);
        
        // We have several bounding boxes that pertain specifically to instances where a user zooms in and out, and it's important that the map is correctly situated
        // in such an area that those translations are maintained. To handle this, every time the user finishes zooming in/out, we call the reset function to make sure
        // all projections are correctly located on the screen.
        map.on("zoomend", reset);
    
    
        // Small little thing here - we wanted county lines for the state of map, so we just did a very basic set of D3 projections using this information.
        // This is a pretty standard thing in D3, so if you are ever curious and want to look up documentation on it, most mapping things from D3 will include information 
        // on paths.
        feature = gMap.selectAll("path")
            .data(counties.features)
            .enter().append("path");
        
        // Finally, to make sure that everything will run correctly, we need to run the reset function that sets the initial locations of both the bounding boxes and the map
        // projection translations.
        reset();

    }

    
    blockedLegends = {}
    if(document.getElementById("legend_selection").value==="visualizeClick"){
        create_menu(0, 0)
    }
}

function resize(){
    // POST: Resizing function that uses the windows height for the sake of the map's height. We want the contents to appropriately fit on different screen sizes, so these
    // elements are dynamic. Doesn't look great on screens that aren't tall/mobile, but it wasn't made with those in mind so it is what it is.
    
    // A bunch of code specifically pertaining to the resizing of elements
    height = window.innerHeight/4*3
    if(height<500)
        height = 500
    width = window.innerWidth/2
    center = [height/2,height/2]
    menuCon = document.getElementById("menu_container")
    mapCon = document.getElementById("map_container")
    legendCon = document.getElementById("legend_container")
    legendViz = document.getElementById("legend_visualization")
    
    // For whatever reason, the system breaks when you try to combine a string and an integer for the stupid height/width declarations. Not javascript itself, mind you. It
    // processes these scripts just fine. It's the HTML/CSS side of things that doesn't properly understand how to handle these elements.
    mapCon.style.height = String(height)+"px"
    mapCon.style.width = String(height)+"px"
    menuCon.style.height = String(height)+"px"
    legendCon.style.height = String(height)+"px"
    legendViz.style.height = String(height-110)+"px"
    
    // Everytime we resize the screen, we want to make sure that we are creating content that is appropriately displayed. Since these two elements draw from the height and
    // width (the map and the legend) for their displays, it's important that we recreate them to create a fluid user experience.
    create_map()
    create_legend()
}

function typeToIndex(type){
    // PRE: Receives a string containing the name of an institution type
    // POST: Returns the index of the institution type relative to the index's name (one indexed instead of zero, because idk I choose it that way? Maybe not the best, but still)
    return pathwayValueNames.indexOf(type) + 1
}

function create_legend(){
    // POST: Create/replace the legend sized based on the height of the user's webpage

    // Select the container and remove the elements that are currently populating the legend
    container = d3.select("#legend_visualization")
    container.html("")

    // Set the height of the legend to the global height as defined in resize()
    legendHeight = height

    // Clearing out the svg if it already exists so we can pave the way for a new SVG with differently sized elements
    if(typeof svg !== "undefined"){
        svg = undefined
    }

    // Set the height of the SVG (but not the container, important distinction) to the number of elements * 50
    // This sets it up with how the CSS/HTML are written to allow it to be scrolling on overflow and have a legend larger
    // than the container itself.
    svg = container.append('svg')
        .attr('height', 50*placeHolder.length)
        .attr('width', 250);
        
    // placeHolder is a reference to the different institution names. This means that when the number of institutions decreases/increases
    // we're able to handle them. Also - this is creating a new "g" element for each datum within placeHolder
    var elem = svg.selectAll("g")
        .data(placeHolder)

    // As the name suggests, this is a function set for when the user inputs their click on one of the legend elements. This function,
    // based on the legend_selection, either creates previews of the different map elements on click, or it creates menus that the user
    // can interact with directly.
    var onClick = function(d,name) {
        // "name" is the element associated with being clicked. So if a user clicks "Middle School" the name variable will store "Middle School"

        // We kick things off by just getting two separate pieces of information. The first is the ID of the element we just clicked
        // and the second is the index of the element whose ID we just clicked. This is important for visualizing the correct the correct information
        selectedElement = d3.select("#"+this.firstChild.id)
        elementID = this.firstChild.id
        elementIndex = elementID.split("_")[1]

        // Based on the dropdown selection menu at the top of the legend menu
        if(document.getElementById("legend_selection").value==="visualizeClick"){
            
            // Due to the fact that there can be a number of menus with the same type (such as "Middle School", it's important we check each one)
            // This first line finds the dropdown elements at the top of each of the menus and collects their information.
            const matches = document.querySelectorAll("select.types_dropdown");
            typeMatch = []

            // From here, we get the values of each of these dropdown selections and compare them against the name of our clicked element.
            // If they match, we keep go up the parent element relative to the match three separate times. This gives us the entire container as the element.
            // Then, once we have the whole container as the element, we get the child node with the class name "visualizeAllButton". We intend to 
            // change this button's behavior elsewhere in the code later, so we are doing are due diligence and tracking the button state through this.
            for(const match of matches){
                if(match.value===name)
                    typeMatch.push(match.parentElement.parentElement.parentElement.getElementsByClassName("visualizeAllButton")[0])
            }

            // Based on the behavior either from itself or elsewhere in the code, we have two states, one where there is no preview visualization already existing
            // in which case it visualizes everything, or one where there is a visualization preview already in place so it clears it.
            if(display_legend_elements[name]==="none"){
                
                // Setting the preview display elements to all means all elements relating to that legend item get displayed.
                display_legend_elements[name]="all"

                // To be consistent, we update the colors of preview buttons so they make sense in the context of other clicked features on the website.
                selectedElement.attr("fill","gainsboro")
                for(const element of typeMatch){
                    element.style.backgroundColor = "rgb(126, 126, 126)"
                }

            } else {

                // Setting the preview display elements to none means no elements relating to that legend item get displayed.
                display_legend_elements[name]="none"

                // To be consistent, we update the colors of preview buttons so they make sense in the context of other clicked features on the website.
                selectedElement.attr("fill","transparent")
                for(const element of typeMatch){
                    element.style.backgroundColor = "gainsboro"
                }
            }
        } else {
            
            // We now check to see if "blockedLegends" is undefined, or, in otherwords, that for the specific element that exists that its empty
            // We do this because we want to see if we need to either add a menu relating to the clicked element by the user, or if we need to delete
            // a menu relating to that element, clicked by the user.
            if(blockedLegends[elementIndex] === undefined){
                
                // Here, we add the elementIndex to the blockedLegends dictionary. By doing this we establish where in the line-up it belongs when we 
                // recreate all the menus to slot it into its appropriate spot in the list (list always go from lowest order to highest order institution)
                blockedLegends[elementIndex] = name

                // Updating **only** the element that was clicked by the user, because we have different behavior in this section (creating menus) which is
                // **not** shared by the menus themselves.
                selectedElement = d3.select("#legend_" + elementIndex)
                selectedElement.attr("fill","gainsboro")
            } else {
                
                // To remove an element from the dictionary, we delete the entire memory location of that entry. This is important since it will update the
                // displayed list of menus by removing the element the user wishes not to visualize anymore.
                delete blockedLegends[elementIndex]
                
                // Updating **only** the element that was clicked by the user, because we have different behavior in this section (creating menus) which is
                // **not** shared by the menus themselves.
                selectedElement = d3.select("#legend_" + elementIndex)
                selectedElement.attr("fill","transparent")
            }

            // Since we're deleting menus in order to update the order correctly, we need to get rid of all of them and re-add them. There's potentially a
            // more elegant approach to this problem, but I figure that I'd save myself the effort by just deleting/re-adding all menus every time.
            delete_old_menus(0)
            
            // Key/value pair of the dictionary which is actually based on the elementIndex, which, being numeric, will always sort the way we want it to
            // when creating new menus
            var keys = Object.keys(blockedLegends);
            keys.sort()

            // Now we can actually create the menus in the order we want. Since "totalMenus" increments as we go, it will always create the correct number
            // of menus without us having to do anything special, and we assign the new menu the type associated with the name given by the elementIndex order.
            for (var i=0; i<keys.length; i++) {
                var key = keys[i];
                var name = blockedLegends[key];
                create_menu(totalMenus,0,name)
            }
        }

        // Despite the fact that only one of these two elements directly influences the map, the addition and removal of new menus warrants the creation of
        // the map overlay elements again in addition to the "visualizeOptions" since a user **could have** pressed the preview button in the menu itself.
        create_map()
    }

    // To actually access and create individual elements, we follow-up the earlier "elem" variable creation by giving it the ".enter()" function which allows
    // us to create an individual visualization element for each of the datum provided.
    var elemEnter = elem.enter()
        .append('g')
        // Rather than handling the x/y translation for the elements, we move the entire box such that all child elements are moved right along with it.
        .attr("transform",function(d,i){return "translate(10," + (1+50*i) + ")"})
        .on("click",onClick)
        // Technically, this could be .attr("class","legendBoxes") as well, there's no functional difference between that and .classed("legendBoxes",true)
        // in this case. The difference is that this **adds** the class, whereas .attr('class',<class>) sets the class.
        .classed("legendBoxes",true)

    // Notably the only place where we give it an ID for these elements. That's because when the user clicks the box, we want to make sure we know which
    // element was actually clicked for the purpose of the "onClick" function for the legend elements.
    elemEnter.append('rect')
        .attr('x',0)
        .attr('y',0)
        .attr("stroke", "black")
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
    // POST: When the legend selection is changed, we update the behavior of the legend and delete any menus to
    // pave the way for the new behavior of the legend.

    // This is straight-forward, just gets the value of the dropdown menu in the legend.
    value = document.getElementById("legend_selection").value

    // Clears all the visualization dictionary elements after the change is made (since the behavior is entirely changed and we
    // want to be consistent with behavior)
    for(const name of pathwayValueNames){
        display_legend_elements[name] = "none"
    }

    // When we change the legend behavior, we want to clear all of the legend colors to reflect that they've been "reset" and used again
    for (const i of Array(pathwayValueNames.length+1).keys()) {
        selectedElement = d3.select("#legend_" + i)
        selectedElement.attr("fill","transparent")
    }
    
    // Since we're changing the behavior, it's worthwhile to just delete the menus and reset everything so that the system can have a clean slate
    // for the user to navigate among.
    delete_old_menus(0)

    // Explained earlier in the code, but when we delete old menus, we need to also recreate the map as a user could have had a visualization
    // preview in place courtesy of the menu instead of the legend.
    create_map()
    
    // Either create a new menu, or make sure the blockedLegends dictionary is cleared out, based on the behavior change.
    if(value==="menuCreation"){
        // No need to populate the menus on the right when the user selects "menuCreation", since that's the point of the legend option
        blockedLegends = {}
    } else if(value==="visualizeClick"){
        // Creates that first menu that the user can reference to create further menus from.
        create_menu(0, 0)
    }
};

function reset() {
    // POST: Resets the bounds whenever the user zooms in or out. This is important to make sure that the visualization overlay on the map
    // doesn't get lost as the user zoom/translates the map in the background.
    
    // Since (almost) all institutions are within the state of Maine, we can just have the bounds as the county lines. That said, there is
    // precisely **one** institution that is within the state of Maine but not within a county line. That being "Shoals Undergraduate Research Group"
    // located on Appledore Island, which is further south than the furthest south county lines in Maine.
    var bounds = mapPath.bounds(counties),
        topLeft = bounds[0],
        bottomRight = bounds[1];

    // Since Appledore Island is being included, we need to make sure that the bounds for the visualization overlay are **always** able to capture the
    // element being visualized on the map. In order to do this, at the max zoom level, we need to add an additional 50000 pixels in all directions to the
    // map. Realisitically, this should be scaled at an inverse relative to the zoom (lower zoom means more pixel boundaries set up) but I was trying to make sure that
    // everything worked as quickly as possible.
    // Also, the subtraction from the topLeft[0] and topLeft[1] is because the map needs to be expanded up and left, both of which correspond with a negative direction
    // since (0,0) is the top left of the visualization window, and (width,height) is the bottom right, different than how we're mathematically taught graphs, normally.
    topLeft[0] -= 50000
    topLeft[1] -= 50000
    bottomRight[0] += 50000
    bottomRight[1] += 50000

    // So despite the fact that every svg is **basically** 100,000 x 100,000 pixels, the translation earlier on in setting the center roughly on the center of Maine
    // makes sure that everything is always lined up correctly.
    // This is different than the actual map itself where the visualization is located, which is because of the next variable that gets updated "gMap"
    svgMap.attr("width", bottomRight[0] - topLeft[0])
        .attr("height", bottomRight[1] - topLeft[1])
        .style("left", topLeft[0] + "px")
        .style("top", topLeft[1] + "px");

    // Since we have to go to great lengths with the bounds to have them work correctly, we need to make sure we locate all the elements that we're going to visualize more
    // precisely on the map to where the user would see it, which is the inverse of topLeft
    gMap.attr("transform", "translate(" + -topLeft[0] + "," + -topLeft[1] + ")");

    // We use the mapPath function established in the initialize() function with the correct projection after translating to make sure everything is correctly located.
    feature.attr("d", mapPath)
        .attr("class","county");

    // When we zoom in/translate the map, it needs to be adjusted since the actual pixel location of different visualized elements may have changed.
    create_map();
}

function arraySetup(){
    // POST: Based on the user's selection from when they initialized their specific user experience, we alter the primary array from which selection dropdowns draw from,
    // legend elements draw from, and what's used to compare different schools.

    // Get the user experience value, then hide the overlay that prevents the user from seeing the entire map.
    userExperience = document.querySelector('input[name="personType"]:checked').value
    d3.select("#screen_block_for_options").classed("hidden",true)
    
    // Values pertaining directly to the institutions that we have in our system. New additions will need to be added and ordered here.
    pathwayValueNames = ["Elementary School", "Middle School","High School", "HS STEM Program", "CTE", "Community College", "University/Colleges", "Undergrad STEM Program", "Graduate", "Research Institute","Company"]
    pathwayValueRanks = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
    pathwayValueReversed = ["Elementary School", "Middle School","High School", "HS STEM Program", "CTE", "Community College", "University/Colleges", "Undergrad STEM Program", "Graduate", "Research Institute","Company"]

    // For the purposes of slicing the array, we just establish a start/end variable and assign it based on the user experience provided. In case a user gets
    // smart with us and tries to leave the selection blank, we default it to all possible institutions to display to them.
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
    } else {
        start = 0
        end = 11
    }
    pathwayValueNames = pathwayValueNames.slice(start,end)
    pathwayValueRanks = pathwayValueRanks.slice(start,end)
    pathwayValueReversed = pathwayValueReversed.slice(start,end)
    
    // Important arrays to establish for other elements of the code throughout the entire script. We establish/re-establish this every time the user makes an action.
    pathwayValues = [pathwayValueNames, pathwayValueRanks]
    placeHolder = pathwayValueReversed.reverse()
    
    // While techincally not a resizing of the screen, reiterating through the resize function is important since the container height for the legend is based on the actual
    // length of the legend (total number of elements)
    resize()
}

function resetScreen(){
    // POST: Literally just reveals the overlay for the tailored experience that handles the 
    // initialize function. Probably doesn't need to be a standalone function, but is in this case.

    d3.select("#screen_block_for_options").classed("hidden",false)
}