const fs = require('fs');
const http = require('http');
const https = require('https');
const {url} = require('inspector');
const querystring = require('querystring');

const port = 3000;
const server = http.createServer();

const {client_id, client_secret} = require('./auth/petfinders-credentials.json');
const {api_key} = require('./auth/mapquest-credentials.json');

server.on("request", connection_handler);

function connection_handler(req, res) {
    console.log(`New Request for ${req.url} from ${req.socket.remoteAddress}`);
    if (req.url === "/") {
        const main = fs.createReadStream('html/index.html');
        res.writeHead(200, {"Content-Type":"text/html"});
        main.pipe(res);
    }
    else if (req.url.startsWith("/map-photos/")) {
        let image_stream = fs.createReadStream(`.${req.url}`);
        image_stream.on("error", () => {
            res.writeHead(404, {"Content-Type": "text/plain"});
            res.end(`404 Not Found`);
        });
        image_stream.on("ready", deliver_image);
        function deliver_image() {
            res.writeHead(200, {"Content-Type":"image/jpeg"});
            image_stream.pipe(res);
        }
    }
    else if (req.url.startsWith("/search")) {
        const url = new URL(req.url, "https://localhost:3000");
        const pet_category = url.searchParams.get("category");
        input_streetaddress = url.searchParams.get("street-address");
        input_city = url.searchParams.get("city");
        input_state = url.searchParams.get("state");
        input_zipcode = url.searchParams.get("zipcode");
        if (input_streetaddress != undefined && input_city != undefined && input_state != undefined && input_zipcode != undefined) {
            const user_location = {
                streetaddress: input_streetaddress,
                city:input_city,
                state:input_state,
                zipcode:input_zipcode
            }

            const token_cache_file = './auth/petfinder-token.json';
            let cache_valid = false;
            if (fs.existsSync(token_cache_file)) {
                cached_token_object = require(token_cache_file);
                if (new Date(cached_token_object.expiration) > Date.now()) {
                    cache_valid = true;
                }
            }
            if (cache_valid) {
                let access_token = cached_token_object.access_token;
                create_search_request(access_token, pet_category, user_location, res);
            }
            else {
                request_access_token(pet_category, user_location, res);
            }
        }
        else {
            res.writeHead(404, {"Content-Type":"text/plain"});
            res.end(`Invalid Parameter`);
        }
    }
    else {
        send_error_message(res);
    }
}
function request_access_token(pet_category, user_location, res) {
    const {client_id, client_secret} = require('./auth/petfinders-credentials.json');
    const options = {
        method:"POST",
        headers:{
            "Content-Type":"application/x-www-form-urlencoded",
        }
    };
    const post_data = querystring.stringify({
        "grant_type":"client_credentials",
        "client_id": client_id,
        "client_secret": client_secret
    });
    const token_endpoint = "https://api.petfinder.com/v2/oauth2/token";
    const token_request_time = new Date();
    const token_request = https.request(token_endpoint, options);
    token_request.once("error", (err) => {
        res.writeHead(404, {"Content-Type": "text/plain"});
        res.end(`404 Not Found`);
    });
    token_request.once("response", (token_stream) => stream_to_message(token_stream, received_token, token_request_time, pet_category, res));
    
    token_request.end(post_data);
}
function stream_to_message(stream, callback, ...args) {
    let body = "";
    stream.on("data", (chunk) => body += chunk);
    stream.on("end", () => callback(body, ...args));
}
function received_token(token_string, token_request_time, pet_category, user_location, res) {
    let token_object = JSON.parse(token_string);
    let access_token = token_object.access_token;
    create_access_token_cache(token_object, token_request_time, pet_category, user_location, res);
}
function create_access_token_cache(token_object, token_request_time, ...args) {
    token_object.expiration = new Date(token_request_time.getTime() + (token_object.expires_in * 1000));
    let access_token = token_object.access_token;
    fs.writeFile('./auth/petfinder-token.json', JSON.stringify(token_object), () => create_search_request(access_token, ...args));
}
function create_search_request(access_token, pet_category, user_location, res) {
    const options = {
        method: "GET",
        headers: {
            "Authorization": `Bearer ${access_token}`
        }
    };
    const search_query = querystring.stringify({type:pet_category, location: user_location.state});
    const search_endpoint = `https://api.petfinder.com/v2/animals?${search_query}`;
    const search_request = https.request(search_endpoint, options);
    search_request.once("error", err => send_error_message(res));
    search_request.once("response", search_result_stream => stream_to_message(search_result_stream, received_search_result, pet_category, user_location, res));
    search_request.end();
}
function received_search_result(search_string, pet_category, user_location, res) {
    const search_object = JSON.parse(search_string);
    const list_of_animals = search_object.animals.map(animal => animal);

    let animals = {animals_profile:[], max_size: list_of_animals.length};
    list_of_animals.map(selected_animal => process_information(selected_animal, animals, pet_category, user_location, res));
}
function process_information(selected_animal, animals, pet_category, user_location, res) {
    let animal_location = Object.values(selected_animal.contact.address).map(address => address).join(" ");
    let img = `map-photos/${animal_location.split(' ').join('')}.jpg`;
    let animal_profile = {
        name: selected_animal.name,
        breed: selected_animal.breeds,
        age: selected_animal.age,
        gender: selected_animal.gender,
        url: selected_animal.url,
        map_image: img,
        address: animal_location
    }
    animals.animals_profile.push(animal_profile);
    fs.access(img, fs.constants.R_OK, (err) => {
        if (err) {
            download_map_photo(animal_profile, animals, pet_category, user_location, res);
        }
        else {
            load_map_direction(animal_profile, animals, pet_category, user_location, res);
        }
    });
}
function download_map_photo(selected_animal, animals, pet_category, user_location, res) {
    const start_location = Object.values(user_location).map(address => address).join(" ");
    const search_query = querystring.stringify({
        key:api_key,
        start: start_location,
        end: selected_animal.address,
        size: "200,200@2x"
    });
    const map_endpoint = `https://www.mapquestapi.com/staticmap/v5/map?${search_query}`;
    const image_request = https.request(map_endpoint, {method: "GET"});
    image_request.on("response", image_stream => {

        const save_image = fs.createWriteStream(selected_animal.map_image, {'encoding': null});
        image_stream.pipe(save_image);
        save_image.on("finish", () => {
            load_map_direction(selected_animal, animals, pet_category, user_location, res);
        });
    });
    image_request.end(search_query);
}
function load_map_direction(selected_animal, animals, pet_category, user_location, res) {
    const start_location = Object.values(user_location).map(address => address).join(" ");
    const search_query = querystring.stringify({
        key:api_key,
        from: start_location,
        to: selected_animal.address
    });
    const direction_endpoint = `http://www.mapquestapi.com/directions/v2/route?${search_query}`;
    const direction_request = http.request(direction_endpoint, {method: "GET"});
    direction_request.on("error", err => {
        res.writeHead(404, {"Content-Type": "text/plain"});
        res.end(`404 Not Found`);
    });
    direction_request.on("response", direction_stream => {stream_to_message(direction_stream, add_direction, selected_animal, animals, pet_category, res)});
    direction_request.end();
}
function add_direction(direction_string, selected_animal, animals, pet_category, res) {
    direction_object = JSON.parse(direction_string);
    direction_array = direction_object.route.legs[0].maneuvers;
    direction_transcript = direction_array.map(direction_object => direction_object.narrative).join("<br>");
    selected_animal.direction = direction_transcript;
    if (animals.animals_profile.length >= animals.max_size) {
        generate_webpage(animals, pet_category, res);
    }
}
function generate_webpage(animals, pet_category, res) {
    animal_profiles = animals.animals_profile;
    let info_component = animal_profiles.map(information => {
        let structure = `<section style="border: 1px solid"><h3><a href="${information.url}">${information.name}</a></h3>
        <p>
        Age: ${information.age}<br>
        Gender: ${information.gender}<br>`;
        if (information.breed.secondary != null) {
            structure += `Breed: ${information.breed.primary} / ${information.breed.secondary}<br>`;
        }
        else {
            structure += `Breed: ${information.breed.primary}<br>`;
        }
        structure += `Address: ${information.address}<br><img src="${information.map_image}" /></p>`;
        /** Rendering issues where information is in object but outputs undefined **/
        structure += `<p>${information.direction}</p></section>`
        return structure;
    }).join("");
    res.writeHead(200, {"Content-Type": "text/html"});
    res.end(`<h1>${pet_category.toString().toUpperCase()}</h1>` + info_component);
}
function send_error_message(res) {
    res.writeHead(404, {"Content-Type": "text/plain"});
    res.end(`404 Not Found`);
}
server.on("listening", () => {
    console.log(`Now listening on Port ${port}`);
});
server.listen(port);