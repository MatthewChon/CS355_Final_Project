# PetFinder MapQuest API project
A NodeJS application that retrieves information about the description and location of pet's within a specified location and directions to that location. The application will first send the user a form in which the user will input an address. Once the user submits that application, the server will parse that information and send a request to the PetFinder API, which will retrieve the information and location of any nearby pets within the area that the user specified. From there, the server will then make another request to the MapQuest API to retrieve the direction and a visual representation of the map. After receiving both responses, the server will respond to the user's request by constructing an HTML page with the information of the pet and the directions on how to get there.

# Table of Contents
1. [Prerequisite](#prerequisite)
2. [Running the application](#running-the-application)
3. [See also](#see-also)

## Prerequisite
Users must be running at least NodeJS v.16.4.2+ in order for this application to run. No other prerequisite needed because the server performs basic HTTP request to the endpoints of both MapQuest and PetFinder API.

## Running the application
1. Clone the repo onto your desktop:

    ```
    git clone https://github.com/MatthewChon/petfinder_mapquest.git
    ```
    
2. Type in client id and secret for both `*-credential.json` in the auth folder
    
3. Run the application in a terminal:

    ```
    Node index.js
    ```
    
4. Open a browser and visit `https://localhost:3000`

## See also
[MDN HTTP doc](https://developer.mozilla.org/en-US/docs/Web/HTTP)  
[MapQuest API](https://developer.mapquest.com/)  
[PetFinder API](https://www.petfinder.com/developers/v2/docs/)
