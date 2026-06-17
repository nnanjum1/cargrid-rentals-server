const dns = require("node:dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const express = require('express');
const cors = require('cors')

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const dotenv = require('dotenv');
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");
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

const JWKS = createRemoteJWKSet(
    new URL("http://localhost:3000/api/auth/jwks")
);
const verifyToken = async (req, res, next) => {
    const authHeader = req?.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ message: "Unauthorized" });
    }
    const token = authHeader.split(" ")[1];
    if (!token) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    try {
        const { payload } = await jwtVerify(token, JWKS);
        req.user = payload;
        console.log(payload);
        next();
    } catch (error) {
        return res.status(403).json({ message: "Forbidden" });
    }
};


async function run() {
    try {
        await client.connect();
        const db = client.db("cargridhub");
        const carCollection = db.collection("cars")
        const bookingCollection = db.collection("bookings")

        app.post("/cars", verifyToken, async (req, res) => {
            const carData = req.body;
            carData.addedBy = req.user.email;

            const result = await carCollection.insertOne(carData);
            res.json(result)
        })

        // app.get("/cars", async (req, res) => {
        //     const cars = await carCollection.find().toArray();
        //     res.send(cars);
        // });

        app.get("/cars", async (req, res) => {
            const { search, type } = req.query;

            let query = {};

            if (search) {
                query.name = {
                    $regex: search,
                    $options: "i",
                };
            }

            if (type) {
                query.type = {
                    $in: type.split(","),
                };
            }

            const cars = await carCollection.find(query).toArray();
            res.send(cars);
        });


        app.get("/cars/:id", verifyToken, async (req, res) => {
            try {
                const car = await carCollection.findOne({
                    _id: new ObjectId(req.params.id),
                });

                if (!car) return res.status(404).json({ message: "Car not found" });

                res.send(car);
            } catch (err) {
                res.status(500).json({ message: "Server error" });
            }
        });

        app.get("/my-cars", verifyToken, async (req, res) => {
            const email = req.user.email;

            const cars = await carCollection.find({ addedBy: email }).toArray();

            res.send(cars);
        });


        // app.post("/bookings", async (req, res) => {
        //     const bookingData = req.body;
        //     const result = await bookingCollection.insertOne(bookingData);
        //     res.json(result)
        // })


        app.post("/bookings", verifyToken, async (req, res) => {

            const { carId, bookingDate } = req.body;


            const existing = await bookingCollection.findOne({
                carId,
                bookingDate,
            });

            if (existing) {
                return res.status(400).json({
                    message: "Car already booked on this date",
                });
            }

            const result = await bookingCollection.insertOne(req.body);
            await carCollection.updateOne(
                { _id: new ObjectId(carId) },
                { $inc: { bookingCount: 1 } }
            );

            res.send(result);


        });

        app.get("/bookings", verifyToken, async (req, res) => {
            const email = req.query.email;

            const bookings = await bookingCollection
                .find({ userEmail: email })
                .toArray();

            res.send(bookings);
        });

        app.delete("/cars/:id", verifyToken, async (req, res) => {
            const result = await carCollection.deleteOne({
                _id: new ObjectId(req.params.id),
            });

            res.send(result);
        });

        app.put("/cars/:id", verifyToken, async (req, res) => {
            try {
                const id = req.params.id;
                const updatedCar = req.body;

                const result = await carCollection.updateOne(
                    { _id: new ObjectId(id) },
                    {
                        $set: {
                            name: updatedCar.name,
                            price: updatedCar.price,
                            type: updatedCar.type,
                            image: updatedCar.image,
                            seat: updatedCar.seat,
                            location: updatedCar.location,
                            description: updatedCar.description,
                            availability: updatedCar.availability,
                        },
                    }
                );

                res.send(result);
            } catch (err) {
                res.status(500).send({ message: "Update failed" });
            }
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