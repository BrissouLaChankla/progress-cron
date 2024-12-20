require('dotenv').config();
const mongoose = require("mongoose");
// MongoDB Model

const DataSchema = new mongoose.Schema({
    chess: Number,
    duolingo: Number,
    sport: Number,
    money: Number,
    lol: Number,
    date: Date,
});
const DataModel = mongoose.model("Data", DataSchema);

const MONGO_URI = process.env.CONNECTION_STRING;

async function fetchDataAndStore() {
    try {
        // Connect to MongoDB
        await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

        const res = await Promise.all([
            fetch("https://api.chess.com/pub/player/brissouu/stats"),
            fetch("https://www.duolingo.com/2017-06-30/users?username=Brice853337"),
            fetch(`https://api.finary.com/users/me/portfolio/timeseries?sharing_link_id=e9c52c1f0391ee54bc4f&period=all&timeseries_type=sum&value_type=gross&new_format=true`),
            fetch(`https://euw1.api.riotgames.com/lol/league/v4/entries/by-summoner/dDH5QL0rPpppwvw4QSv2VYpm-9-b__A1sjpITII06KnE8vw?api_key=${process.env.RIOT_API_KEY}`),
        ]);


        let data = await Promise.all(res.map(r => r.json()))
        data = data.flat();

        const lastEntry = await DataModel.findOne()
            .sort({ date: -1 }) // Trie par date de création décroissante
            .exec(); // Exécute la requête


        const values = {
            chess: data[0].chess_blitz.last.rating,
            duolingo: data[1].users[0].totalXp,
            sport: lastEntry.sport,
            money: data[2].result[0].timeseries[data[2].result[0].timeseries.length - 1][1],
            lol: calculateAverageRankPoints([data[3], data[4]]),
            date: new Date(),
        }

        // Store data in MongoDB
        // const newData = new DataModel(values);

        const startOfDay = new Date();
        startOfDay.setUTCHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setUTCHours(23, 59, 59, 999);

        await DataModel.findOneAndUpdate({
            date: {
                $gte: startOfDay,
                $lte: endOfDay
            }
        }, values, { upsert: true });

        // Disconnect from MongoDB
        await mongoose.disconnect();
        console.log("Disconnected from MongoDB");
    } catch (error) {
        console.error("Error fetching or storing data:", error);
        process.exit(1);
    }
}

function calculateAverageRankPoints(data) {
    // Tiers et leurs valeurs de base
    const tierValues = {
        IRON: 0,
        BRONZE: 400,
        SILVER: 800,
        GOLD: 1200,
        PLATINUM: 1600,
        EMERALD: 2000,
        DIAMOND: 2400,
        MASTER: 2800,
        GRANDMASTER: 3200,
        CHALLENGER: 3600
    };

    // Ranks et leurs valeurs
    const rankValues = {
        IV: 0,
        III: 100,
        II: 200,
        I: 300
    };

    // Calculer les points pour chaque entrée
    const totalPoints = data.reduce((sum, entry) => {
        const tierValue = tierValues[entry.tier.toUpperCase()] || 0;
        const rankValue = rankValues[entry.rank] || 0;
        const leaguePoints = entry.leaguePoints;

        return sum + (tierValue + rankValue + leaguePoints);
    }, 0);

    // Calculer la moyenne
    return totalPoints / data.length;
}

fetchDataAndStore();

module.exports = { fetchDataAndStore }