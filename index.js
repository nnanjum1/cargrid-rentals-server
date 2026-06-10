const dns = require("node:dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const express = require('express');
const cors = require('cors')

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const dotenv = require('dotenv')
dotenv.config()

const uri = process.env.MONGODB_URI;
const app = express();
const PORT = process.env.PORT;

app.use(cors())
app.use(express.json())

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        await client.connect();
        const db = client.db("cargridhub");
        const carCollection = db.collection("cars")

        app.post("/cars", async (req, res) => {
            const carData = req.body;
            const result = await carCollection.insertOne(carData);
            res.json(result)
        })
        app.get("/cars", async (req, res) => {
            const cars = await carCollection.find().toArray();
            res.send(cars);
        });

        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!")
    } catch (error) {
        console.error("MongoDB connection error:", error);
    }
}
run().catch(console.dir)

app.get('/', (req, res) => {
    res.send("Server is running fine!")
})

app.listen(PORT, () => {
    console.log(`Server is running on ${PORT}`)
})