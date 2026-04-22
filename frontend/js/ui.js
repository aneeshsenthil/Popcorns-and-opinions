// ui.js

function createMovieCard(movie) {
    return `
        <div class="movie-card">
            <img src="${IMAGE_BASE}${movie.poster_path}" alt="${movie.title}">
            <div class="movie-info">
                <h3>${movie.title}</h3>
                <p>⭐ ${movie.vote_average}</p>
                <button class="secondary-btn" onclick="addToWatchlist(${movie.id})">
                    + Watchlist
                </button>
            </div>
        </div>
    `;
}

function renderMovies(movies, container) {
    container.innerHTML = "";
    movies.forEach(movie => {
        container.innerHTML += createMovieCard(movie);
    });
}

function createMovieCard(movie) {
    return `
        <div class="movie-card">
            <img src="${IMAGE_BASE}${movie.poster_path}" alt="${movie.title}">
            <div class="movie-info">
                <h3>${movie.title}</h3>
                <p>⭐ ${movie.vote_average || "N/A"}</p>
                <p>📅 ${movie.release_date || "Coming Soon"}</p>
                <button class="secondary-btn" onclick="addToWatchlist(${movie.id})">
                    + Watchlist
                </button>
            </div>
        </div>
    `;
}