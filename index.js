const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion } = require('mongodb');

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.eey3bcc.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();


    const db = client.db("matrimony_platform_DB");
    const usersCollection = db.collection("users");
    const biodataCollection = db.collection("biodatas");


     // CREATE biodata
    app.post("/biodatas", async (req, res) => {
  const biodata = req.body;
  const lastBiodata = await biodataCollection.find().sort({ biodataId: -1 }).limit(1).toArray();
  const lastId = lastBiodata.length > 0 ? lastBiodata[0].biodataId : 0;
  biodata.biodataId = lastId + 1;

  const result = await biodataCollection.insertOne(biodata);
  res.send(result);
});
    // GET biodata by email
app.get("/biodatas/email/:email", async (req, res) => {
  const email = req.params.email;
  const biodata = await biodataCollection.findOne({ contactEmail: email });
  if (!biodata) return res.status(404).send({ error: "Biodata not found" });
  res.send(biodata);
});

// PUT biodata by email
app.put("/biodatas/email/:email", async (req, res) => {
  const email = req.params.email;
  let updateData = req.body;

  // _id prevent
  if (updateData._id) delete updateData._id;

  try {
    const result = await biodataCollection.updateOne(
      { contactEmail: email },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).send({ error: "Biodata not found" });
    }

    res.send({ message: "Biodata updated successfully" });
  } catch (err) {
    console.error("Update error:", err);
    res.status(500).send({ error: "Internal Server Error" });
  }
});
    // GET all biodatas
    app.get("/biodatas", async (req, res) => {
      const biodatas = await biodataCollection.find().toArray();
      res.send(biodatas);
    });

    


    

    // POST route to add a new user
    app.post('/users', async (req, res) => {
      const user = req.body; // expect { name, email, password, photoURL }
      if (!user.name || !user.email) {
        return res.status(400).send({ error: 'Name, email, and password are required' });
      }

      try {
        const result = await usersCollection.insertOne(user);
        res.status(201).send({
          message: 'User created successfully',
          userId: result.insertedId
        });
        } catch (err) {
        console.error(err);
        res.status(500).send({ error: 'Failed to create user' });
      }
    });

    // GET all users (optional, for testing)
    app.get('/users', async (req, res) => {
      const users = await usersCollection.find().toArray();
      res.send(users);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);




app.get('/', (req, res) => {
    res.send('Matrimony platform Server is running');
});


app.listen(port, () => {
    console.log(`Server is listening on port ${port}`);
});