// api.js

async function fetchMovies(endpoint) {
    try {
        const response = await fetch(`${BASE_URL}${endpoint}&api_key=${API_KEY}`);
        const data = await response.json();
        return data.results;
    } catch (error) {
        console.error("Error fetching movies:", error);
        return [];
    }
}